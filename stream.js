const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const WebSocket = require('ws');
require('dotenv').config();

// Configuration
const CONFIG = {
  serverUrl: 'http://localhost:3000/script.html?autoplay=true',
  twitchStreamKey: process.env.TWITCH_STREAM_KEY,
  twitchServer: process.env.TWITCH_SERVER || 'rtmp://live.twitch.tv/app',

  // WebSocket settings
  wsPort: 3001,

  // Video settings
  canvasWidth: 960,  // 320 * 3
  canvasHeight: 960,  // 320 * 3 (updated for new layout with dialogue area)
  outputWidth: 960,   // 1:1 aspect ratio to match new canvas
  outputHeight: 960,
  fps: 30,  // Target 30fps with canvas.captureStream
  videoBitrate: '2500k',  // Increased for 30fps 720p
  maxBitrate: '3000k',
  bufferSize: '6000k',

  // Audio settings
  audioSampleRate: 48000,
  audioChannels: 2,
  audioBitrate: '128k',

  // Stream settings
  keyframeInterval: 60, // 2 seconds at 30fps

  // Restart settings
  maxRestarts: 10,
  restartDelay: 5000,
  maxRestartDelay: 60000,
  restartBackoffMultiplier: 1.5
};

class TwitchStreamer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.ffmpegProcess = null;
    this.audioStream = null;
    this.videoStream = null;
    this.wss = null;
    this.wsConnection = null;
    this.isRunning = false;
    this.restartCount = 0;
    this.currentRestartDelay = CONFIG.restartDelay;
  }

  async initialize() {
    console.log('🚀 Initializing Twitch Streamer...');

    if (!CONFIG.twitchStreamKey) {
      throw new Error('TWITCH_STREAM_KEY not found in environment variables. Please add it to .env file.');
    }

    // Launch Puppeteer
    console.log('🌐 Launching headless browser...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--window-size=${CONFIG.canvasWidth},${CONFIG.canvasHeight}`,
        '--autoplay-policy=no-user-gesture-required',
        '--enable-audio-service-sandbox=false',
        '--disable-audio-output',  // Disable actual audio output to speakers
        '--enable-features=WebRTCPipeWireCapturer',
        '--force-device-scale-factor=1',  // Prevent DPI scaling for crisp pixels
        '--disable-lcd-text'  // Disable subpixel text rendering for sharper text
      ],
      defaultViewport: {
        width: CONFIG.canvasWidth,
        height: CONFIG.canvasHeight
      }
    });

    this.page = await this.browser.newPage();

    // Set up console logging from the page
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.error('🔴 Browser error:', msg.text());
      }
    });

    // Set up error handling
    this.page.on('error', error => {
      console.error('🔴 Page crashed:', error);
      this.handleError(error);
    });

    // Navigate to the page
    console.log(`📺 Navigating to ${CONFIG.serverUrl}...`);
    await this.page.goto(CONFIG.serverUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for canvas to be ready
    await this.page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✅ Canvas detected');

    // Wait a bit for the page to fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ Browser initialized successfully');
  }

  async setupAudioCapture() {
    console.log('🎵 Setting up audio capture from Web Audio API...');

    // Expose a function that the browser can call to send audio data
    await this.page.exposeFunction('sendAudioData', (audioDataBase64) => {
      if (this.audioStream && audioDataBase64) {
        const buffer = Buffer.from(audioDataBase64, 'base64');
        this.audioStream.write(buffer);
      }
    });

    // Inject audio capture code into the page
    const captureEnabled = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        // Wait for audioContext to be created by the game
        const checkAudioContext = setInterval(() => {
          // Check if audioContext exists as a global variable (from game.js)
          if (typeof audioContext !== 'undefined' && audioContext) {
            clearInterval(checkAudioContext);

            try {
              const sampleRate = audioContext.sampleRate;
              const bufferSize = 2048; // Reduced from 4096 for lower latency (~43ms instead of ~85ms)

              // Create a script processor to capture raw audio samples
              const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 2, 2);

              // Create a gain node to tap into the audio without affecting output
              const captureNode = audioContext.createGain();
              captureNode.gain.value = 1.0;

              // Intercept all audio going to destination
              const originalDestination = audioContext.destination;

              // Connect capture node between all sources and destination
              // We'll do this by patching the connect method
              const originalConnect = AudioNode.prototype.connect;
              window.connectedNodes = new Set();

              AudioNode.prototype.connect = function(destination, ...args) {
                const result = originalConnect.call(this, destination, ...args);

                // If connecting to the main destination, also connect to our capture node
                if (destination === originalDestination && !window.connectedNodes.has(this)) {
                  window.connectedNodes.add(this);
                  try {
                    originalConnect.call(this, captureNode);
                  } catch (e) {
                    console.warn('Could not connect to capture node:', e);
                  }
                }

                return result;
              };

              // Connect capture chain
              captureNode.connect(scriptProcessor);
              scriptProcessor.connect(audioContext.destination);

              // Process audio data
              scriptProcessor.onaudioprocess = (event) => {
                const inputL = event.inputBuffer.getChannelData(0);
                const inputR = event.inputBuffer.getChannelData(1);

                // Interleave stereo channels into Int16 PCM format
                const buffer = new Int16Array(inputL.length * 2);
                for (let i = 0; i < inputL.length; i++) {
                  // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
                  buffer[i * 2] = Math.max(-1, Math.min(1, inputL[i])) * 0x7FFF;
                  buffer[i * 2 + 1] = Math.max(-1, Math.min(1, inputR[i])) * 0x7FFF;
                }

                // Convert to base64 and send to Node.js
                const uint8Array = new Uint8Array(buffer.buffer);
                const binary = String.fromCharCode.apply(null, uint8Array);
                const base64 = btoa(binary);

                // Send to Node.js (this is exposed by Puppeteer)
                if (typeof sendAudioData !== 'undefined') {
                  sendAudioData(base64);
                }
              };

              console.log('✅ Web Audio capture initialized (sample rate:', sampleRate, ')');
              resolve(true);
            } catch (error) {
              console.error('❌ Failed to set up audio capture:', error);
              resolve(false);
            }
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkAudioContext);
          console.warn('⚠️ AudioContext not found after 10s, proceeding without audio capture');
          resolve(false);
        }, 10000);
      });
    });

    if (captureEnabled) {
      console.log('✅ Audio capture enabled - real audio will be streamed');
      this.audioStream = new PassThrough();
      return true;
    } else {
      console.log('⚠️ Audio capture not available - using silent audio');
      this.audioStream = null;
      return false;
    }
  }

  async setupWebSocketServer() {
    console.log('🔌 Setting up WebSocket server for video streaming...');

    return new Promise((resolve, reject) => {
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        port: CONFIG.wsPort,
        maxPayload: 10 * 1024 * 1024  // 10MB max payload for video chunks
      });

      this.wss.on('listening', () => {
        console.log(`✅ WebSocket server listening on port ${CONFIG.wsPort}`);
        resolve();
      });

      this.wss.on('error', (error) => {
        console.error('🔴 WebSocket server error:', error);
        reject(error);
      });

      this.wss.on('connection', (ws) => {
        console.log('🔌 Browser connected to WebSocket server');
        this.wsConnection = ws;

        // Create video stream for FFmpeg
        this.videoStream = new PassThrough();

        // Connect video stream to FFmpeg stdin NOW that it exists
        if (this.ffmpegProcess && this.ffmpegProcess.stdin) {
          this.videoStream.pipe(this.ffmpegProcess.stdin);
          console.log('📹 Video stream (WebM) connected to FFmpeg stdin');
        }

        let chunkCount = 0;
        let bytesReceived = 0;

        ws.on('message', (data) => {
          // Receive WebM chunks from browser
          if (this.videoStream && Buffer.isBuffer(data)) {
            chunkCount++;
            bytesReceived += data.length;

            // Write to FFmpeg stdin
            this.videoStream.write(data);

            // Log progress occasionally
            if (chunkCount % 100 === 0) {
              const mbReceived = (bytesReceived / (1024 * 1024)).toFixed(2);
              console.log(`📹 Received ${chunkCount} video chunks (${mbReceived} MB)`);
            }
          }
        });

        ws.on('close', () => {
          console.log('🔌 Browser disconnected from WebSocket');
          this.wsConnection = null;

          // Attempt to reconnect after a short delay
          setTimeout(() => {
            if (this.isRunning && !this.wsConnection) {
              console.log('🔄 Waiting for browser to reconnect...');
            }
          }, 2000);
        });

        ws.on('error', (error) => {
          console.error('🔴 WebSocket connection error:', error);
        });
      });
    });
  }

  async setupVideoCapture() {
    console.log('📹 Setting up canvas video capture...');

    // Wait for the first dialogue to actually appear before capturing
    console.log('⏱️ Waiting for first dialogue box to appear...');
    const dialogBoxAppeared = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let checks = 0;
        const checkInterval = setInterval(() => {
          checks++;

          // Check if dialogue is actually being displayed in the DOM
          const dialogueEl = document.getElementById('dialogue-lines');

          if (dialogueEl) {
            // Check if there are actual dialogue lines (not just "LOADING" or "GENERATING" messages)
            const dialogueLines = dialogueEl.querySelectorAll('.dialogue-line');
            const hasRealDialogue = dialogueLines && dialogueLines.length > 0;

            if (hasRealDialogue) {
              console.log(`✅ First dialogue detected after ${checks * 0.5}s (${dialogueLines.length} lines), ready to capture`);
              clearInterval(checkInterval);
              resolve(true);
              return;
            }
          }

          // Log progress every 4 seconds
          if (checks % 8 === 0) {
            const lineCount = dialogueEl ? dialogueEl.querySelectorAll('.dialogue-line').length : 0;
            const innerHTML = dialogueEl ? dialogueEl.innerHTML.substring(0, 50) : 'not found';
            console.log(`⏱️ Still waiting for dialogue... (${checks * 0.5}s elapsed, lines=${lineCount}, content="${innerHTML}...")`);
          }
        }, 500);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('⚠️ Timeout waiting for dialogue, starting capture anyway');
          resolve(true);
        }, 30000);
      });
    });

    if (!dialogBoxAppeared) {
      console.warn('⚠️ Dialogue may not be ready, but proceeding with capture');
    }

    // Inject canvas.captureStream() code into browser
    const captureSetup = await this.page.evaluate((wsPort) => {
      return new Promise(async (resolve) => {
        const canvas = document.getElementById('canvas');

        if (!canvas) {
          console.error('❌ Canvas not found');
          resolve(false);
          return;
        }

        try {
          console.log('✅ Canvas found, setting up captureStream()');

          // Capture canvas at 60fps (the game's animation rate)
          // FFmpeg will downsample to 30fps with the -r parameter
          const stream = canvas.captureStream(60);
          console.log('✅ Canvas stream created at 60fps');

          // Set up MediaRecorder with WebM/VP9 encoding
          let mimeType = 'video/webm;codecs=vp9';
          let fallbackUsed = false;

          if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn('⚠️ VP9 not supported, trying VP8');
            mimeType = 'video/webm;codecs=vp8';
            fallbackUsed = true;

            if (!MediaRecorder.isTypeSupported(mimeType)) {
              console.error('❌ WebM not supported at all');
              resolve(false);
              return;
            }
          }

          const recorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 4000000  // Increased to 4 Mbps for better quality
          });

          console.log(`✅ MediaRecorder created with ${mimeType} at 4Mbps`);

          // Connect to WebSocket server
          const ws = new WebSocket(`ws://localhost:${wsPort}`);

          ws.onopen = () => {
            console.log('✅ WebSocket connected to Node.js server');

            // Handle recorded data chunks
            recorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data);
              }
            };

            recorder.onerror = (event) => {
              console.error('❌ MediaRecorder error:', event.error);
            };

            // Start recording with 100ms chunks for low latency
            recorder.start(100);
            console.log('✅ MediaRecorder started (100ms chunks)');

            resolve(true);
          };

          ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            resolve(false);
          };

          ws.onclose = () => {
            console.warn('⚠️ WebSocket closed, stopping recorder');
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          };

        } catch (error) {
          console.error('❌ Failed to set up video capture:', error);
          resolve(false);
        }
      });
    }, CONFIG.wsPort);

    if (captureSetup) {
      console.log('✅ Video capture setup complete - streaming at 30fps');
      return true;
    } else {
      console.error('❌ Failed to set up video capture');
      return false;
    }
  }

  async startFFmpeg() {
    console.log('🎬 Starting FFmpeg with WebM → H.264 transcoding...');

    const rtmpUrl = `${CONFIG.twitchServer}/${CONFIG.twitchStreamKey}`;

    // Determine if we have real audio or need silent audio
    const hasRealAudio = this.audioStream !== null;

    // FFmpeg arguments for WebM → RTMP transcoding
    const ffmpegArgs = [
      // Video input: WebM stream from WebSocket
      '-f', 'webm',
      '-i', 'pipe:0',  // Video from stdin
    ];

    // Add audio input
    if (hasRealAudio) {
      console.log('🎵 Using real Web Audio capture');
      // Input: raw PCM audio from pipe:3
      ffmpegArgs.push(
        '-f', 's16le',  // Signed 16-bit little-endian PCM
        '-ar', String(CONFIG.audioSampleRate),
        '-ac', String(CONFIG.audioChannels),
        '-i', 'pipe:3'  // Audio will come from file descriptor 3
      );
    } else {
      console.log('🔇 Using silent audio (Web Audio capture not available)');
      // Generate silent audio source as fallback
      ffmpegArgs.push(
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'
      );
    }

    // Video encoding: Decode WebM/VP9, re-encode to H.264
    ffmpegArgs.push(
      // Video filters: scale with pixel-perfect nearest-neighbor (no interpolation)
      '-vf', `scale=${CONFIG.outputWidth}:${CONFIG.outputHeight}:flags=neighbor`,
      '-sws_flags', 'neighbor+full_chroma_int+accurate_rnd',  // Pixel-perfect scaling flags

      // Video codec settings
      '-c:v', 'libx264',
      '-preset', 'veryfast',  // Good balance for live streaming
      '-tune', 'zerolatency',  // Minimize latency
      '-b:v', CONFIG.videoBitrate,
      '-maxrate', CONFIG.maxBitrate,
      '-bufsize', CONFIG.bufferSize,
      '-g', String(CONFIG.keyframeInterval),  // Keyframe every 2 seconds
      '-keyint_min', String(CONFIG.keyframeInterval),
      '-pix_fmt', 'yuv420p',
      '-r', String(CONFIG.fps),  // Force 30fps output
      '-profile:v', 'main',  // H.264 main profile for compatibility
      '-level', '4.1'  // H.264 level for 1080p streaming
    );

    // Audio encoding settings
    ffmpegArgs.push(
      '-c:a', 'aac',
      '-b:a', CONFIG.audioBitrate,
      '-ar', String(CONFIG.audioSampleRate),
      '-ac', String(CONFIG.audioChannels)
    );

    // A/V sync and output settings
    ffmpegArgs.push(
      // Audio processing: reduce latency and improve sync
      '-af', 'aresample=async=1:min_hard_comp=0.100000:first_pts=0',
      '-async', '1',  // Audio sync method
      '-vsync', 'cfr',  // Constant frame rate
      '-max_muxing_queue_size', '1024',
      '-shortest',  // End when shortest input ends
      '-fflags', '+genpts',  // Generate presentation timestamps

      // FLV output for RTMP
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',

      // RTMP reconnection settings
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '10',

      rtmpUrl
    );

    console.log('📡 FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

    // Set up stdio pipes
    const stdioConfig = hasRealAudio
      ? ['pipe', 'pipe', 'pipe', 'pipe']  // stdin (video), stdout, stderr, pipe:3 (audio)
      : ['pipe', 'pipe', 'pipe'];

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: stdioConfig
    });

    // Note: Video stream will be connected when WebSocket connects (in setupWebSocketServer)

    // Pipe audio stream (PCM) to FFmpeg pipe:3
    if (hasRealAudio && this.audioStream) {
      this.audioStream.pipe(this.ffmpegProcess.stdio[3]);
      console.log('🎵 Audio stream (PCM) connected to FFmpeg pipe:3');
    }

    // Log FFmpeg output
    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();

      // Log errors
      if (message.includes('error') || message.includes('Error')) {
        console.error('🔴 FFmpeg error:', message);
      }
      // Log warnings
      else if (message.includes('warning') || message.includes('Warning')) {
        console.warn('⚠️ FFmpeg warning:', message);
      }
      // Log frame progress occasionally
      else if (message.includes('frame=')) {
        if (Math.random() < 0.02) { // 2% of progress updates
          const frameMatch = message.match(/frame=\s*(\d+)/);
          const fpsMatch = message.match(/fps=\s*([\d.]+)/);
          const bitrateMatch = message.match(/bitrate=\s*([\d.]+)kbits\/s/);

          if (frameMatch) {
            const frame = frameMatch[1];
            const fps = fpsMatch ? fpsMatch[1] : '?';
            const bitrate = bitrateMatch ? bitrateMatch[1] : '?';
            console.log(`📹 Streaming: frame ${frame}, fps ${fps}, bitrate ${bitrate}kbps`);
          }
        }
      }
    });

    this.ffmpegProcess.on('error', (error) => {
      console.error('🔴 FFmpeg process error:', error);
      this.handleError(error);
    });

    this.ffmpegProcess.on('close', (code) => {
      console.log(`🔴 FFmpeg process exited with code ${code}`);
      if (this.isRunning) {
        this.handleError(new Error(`FFmpeg exited unexpectedly with code ${code}`));
      }
    });

    console.log('✅ FFmpeg started - WebM decoding → H.264 encoding → RTMP');
  }

  async waitForStreaming() {
    console.log('🎥 Waiting for WebSocket video stream to start...');
    this.isRunning = true;

    // Wait for WebSocket connection
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (!this.wsConnection && (Date.now() - startTime < maxWaitTime)) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!this.wsConnection) {
      throw new Error('Browser failed to connect to WebSocket server within 30 seconds');
    }

    console.log('✅ WebSocket connected - video streaming active');
    console.log(`📊 Canvas.captureStream() @ ${CONFIG.fps}fps → MediaRecorder → WebM → FFmpeg → H.264 → RTMP`);

    // Keep the process running and log status periodically
    const statusInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(statusInterval);
        return;
      }

      if (this.wsConnection) {
        console.log('✅ Stream active - WebSocket connected, FFmpeg processing');
      } else {
        console.warn('⚠️ WebSocket disconnected - waiting for reconnection...');
      }
    }, 60000); // Log status every minute
  }

  async handleError(error) {
    console.error('💥 Error occurred:', error.message);

    if (this.restartCount >= CONFIG.maxRestarts) {
      console.error(`🛑 Maximum restart attempts (${CONFIG.maxRestarts}) reached. Exiting.`);
      await this.cleanup();
      process.exit(1);
    }

    this.restartCount++;
    console.log(`🔄 Attempting restart ${this.restartCount}/${CONFIG.maxRestarts} in ${this.currentRestartDelay}ms...`);

    await this.cleanup();

    setTimeout(() => {
      this.start().catch(error => {
        console.error('🔴 Restart failed:', error);
        process.exit(1);
      });
    }, this.currentRestartDelay);

    // Increase restart delay with exponential backoff
    this.currentRestartDelay = Math.min(
      this.currentRestartDelay * CONFIG.restartBackoffMultiplier,
      CONFIG.maxRestartDelay
    );
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    this.isRunning = false;

    // Close WebSocket connection
    if (this.wsConnection) {
      try {
        this.wsConnection.close();
      } catch (error) {
        console.error('Error closing WebSocket connection:', error);
      }
      this.wsConnection = null;
    }

    // Close WebSocket server
    if (this.wss) {
      try {
        this.wss.close();
        console.log('✅ WebSocket server closed');
      } catch (error) {
        console.error('Error closing WebSocket server:', error);
      }
      this.wss = null;
    }

    // Clean up video stream
    if (this.videoStream) {
      try {
        this.videoStream.end();
      } catch (error) {
        console.error('Error closing video stream:', error);
      }
      this.videoStream = null;
    }

    // Clean up audio stream
    if (this.audioStream) {
      try {
        this.audioStream.end();
      } catch (error) {
        console.error('Error closing audio stream:', error);
      }
      this.audioStream = null;
    }

    if (this.ffmpegProcess) {
      try {
        this.ffmpegProcess.stdin.end();
        this.ffmpegProcess.kill('SIGTERM');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.ffmpegProcess.killed) {
          this.ffmpegProcess.kill('SIGKILL');
        }
      } catch (error) {
        console.error('Error killing FFmpeg process:', error);
      }
      this.ffmpegProcess = null;
    }

    if (this.page) {
      try {
        await this.page.close();
      } catch (error) {
        console.error('Error closing page:', error);
      }
      this.page = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
      this.browser = null;
    }

    console.log('✅ Cleanup complete');
  }

  async start() {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🎬 Pixels Forever - Twitch Streamer (WebSocket Mode)');
      console.log('='.repeat(60) + '\n');

      // Step 1: Initialize browser
      await this.initialize();

      // Step 2: Set up WebSocket server (must be before FFmpeg)
      await this.setupWebSocketServer();

      // Step 3: Set up audio capture from Web Audio API
      await this.setupAudioCapture();

      // Step 4: Start FFmpeg (will wait for WebM chunks from WebSocket)
      await this.startFFmpeg();

      // Step 5: Inject canvas capture code into browser
      const videoCaptureSuccess = await this.setupVideoCapture();
      if (!videoCaptureSuccess) {
        throw new Error('Failed to set up video capture in browser');
      }

      // Step 6: Wait for WebSocket connection and monitor
      await this.waitForStreaming();

      // Reset restart counter on successful start
      this.restartCount = 0;
      this.currentRestartDelay = CONFIG.restartDelay;

      console.log('\n✅ Streaming to Twitch at 30fps!');
      console.log('📺 Check your stream at https://twitch.tv/your_channel\n');

    } catch (error) {
      console.error('🔴 Failed to start stream:', error);
      await this.handleError(error);
    }
  }

  async stop() {
    console.log('🛑 Stopping stream...');
    await this.cleanup();
    process.exit(0);
  }
}

// Main execution
const streamer = new TwitchStreamer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n📡 Received SIGTERM signal');
  await streamer.stop();
});

process.on('SIGINT', async () => {
  console.log('\n📡 Received SIGINT signal (Ctrl+C)');
  await streamer.stop();
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('🔴 Uncaught exception:', error);
  await streamer.handleError(error);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('🔴 Unhandled rejection at:', promise, 'reason:', reason);
  await streamer.handleError(new Error(String(reason)));
});

// Start streaming
streamer.start();
