const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
require('dotenv').config();

// Configuration
const CONFIG = {
  serverUrl: 'http://localhost:3000/script.html?autoplay=true',
  twitchStreamKey: process.env.TWITCH_STREAM_KEY,
  twitchServer: process.env.TWITCH_SERVER || 'rtmp://live.twitch.tv/app',

  // Video settings
  canvasWidth: 960,
  canvasHeight: 720,
  outputWidth: 1280,
  outputHeight: 720,
  fps: 30,
  videoBitrate: '2500k',

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
        '--enable-features=WebRTCPipeWireCapturer'
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
              const bufferSize = 4096; // Process audio in chunks

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

  async startFFmpeg() {
    console.log('🎬 Starting FFmpeg...');

    const rtmpUrl = `${CONFIG.twitchServer}/${CONFIG.twitchStreamKey}`;

    // Determine if we have real audio or need silent audio
    const hasRealAudio = this.audioStream !== null;

    // FFmpeg arguments for streaming to Twitch
    const ffmpegArgs = [
      // Input: raw video frames from stdin
      '-f', 'image2pipe',
      '-vcodec', 'png',
      '-r', String(CONFIG.fps),
      '-i', '-',
    ];

    // Add audio input
    if (hasRealAudio) {
      console.log('🎵 Using real Web Audio capture');
      // Input: raw PCM audio from stdin (pipe:3)
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

    // Add video encoding settings
    ffmpegArgs.push(
      '-vf', `scale=${CONFIG.outputWidth}:${CONFIG.outputHeight}:flags=neighbor`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'film',  // Changed from zerolatency for better quality/buffering balance
      '-b:v', CONFIG.videoBitrate,
      '-maxrate', '3000k',  // Slightly higher maxrate for headroom
      '-bufsize', '6000k',  // Increased buffer size to reduce buffering
      '-g', String(CONFIG.keyframeInterval),
      '-keyint_min', String(CONFIG.keyframeInterval),
      '-pix_fmt', 'yuv420p'
    );

    // Add audio encoding settings
    ffmpegArgs.push(
      '-c:a', 'aac',
      '-b:a', CONFIG.audioBitrate,
      '-ar', String(CONFIG.audioSampleRate),
      '-ac', String(CONFIG.audioChannels)
    );

    // Add A/V sync and output settings
    ffmpegArgs.push(
      '-shortest',  // End when shortest stream ends
      '-async', '1',  // Audio sync method
      '-vsync', 'cfr',  // Constant frame rate
      '-f', 'flv',
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '10',
      rtmpUrl
    );

    console.log('📡 FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

    // Set up stdio pipes - if we have real audio, we need pipe:3 for audio
    const stdioConfig = hasRealAudio
      ? ['pipe', 'pipe', 'pipe', 'pipe']  // stdin, stdout, stderr, audio
      : ['pipe', 'pipe', 'pipe'];

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: stdioConfig
    });

    // If we have real audio, pipe it to file descriptor 3
    if (hasRealAudio && this.audioStream) {
      this.audioStream.pipe(this.ffmpegProcess.stdio[3]);
      console.log('🎵 Audio stream connected to FFmpeg');
    }

    // Log FFmpeg output
    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      // Only log important messages to avoid spam
      if (message.includes('error') || message.includes('Error')) {
        console.error('🔴 FFmpeg error:', message);
      } else if (message.includes('frame=')) {
        // Frame progress - log occasionally
        if (Math.random() < 0.01) { // 1% of frames
          const match = message.match(/frame=\s*(\d+)/);
          if (match) {
            console.log(`📹 Streaming... frame ${match[1]}`);
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

    console.log('✅ FFmpeg started successfully');
  }

  async captureAndStream() {
    console.log('🎥 Starting capture and stream...');
    this.isRunning = true;

    const frameInterval = 1000 / CONFIG.fps; // milliseconds per frame
    let lastFrameTime = Date.now();
    let frameCount = 0;

    const captureFrame = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        const now = Date.now();
        const elapsed = now - lastFrameTime;

        // Maintain consistent frame rate
        if (elapsed >= frameInterval) {
          // Capture screenshot as PNG buffer
          const screenshot = await this.page.screenshot({
            type: 'png',
            clip: {
              x: 0,
              y: 0,
              width: CONFIG.canvasWidth,
              height: CONFIG.canvasHeight
            },
            omitBackground: false
          });

          // Write to FFmpeg stdin
          if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
            const success = this.ffmpegProcess.stdin.write(screenshot);

            if (!success) {
              // Backpressure - wait for drain
              await new Promise(resolve => {
                this.ffmpegProcess.stdin.once('drain', resolve);
              });
            }
          }

          frameCount++;
          if (frameCount % 300 === 0) { // Log every 10 seconds
            console.log(`✅ Captured ${frameCount} frames (${Math.round(frameCount / ((now - this.startTime) / 1000))} fps average)`);
          }

          lastFrameTime = now;
        }

        // Schedule next frame
        setImmediate(captureFrame);

      } catch (error) {
        console.error('🔴 Error capturing frame:', error);
        this.handleError(error);
      }
    };

    this.startTime = Date.now();
    console.log('✅ Capture started at', new Date().toISOString());

    // Start capturing
    captureFrame();
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
      console.log('🎬 Pixels Forever - Twitch Streamer');
      console.log('='.repeat(60) + '\n');

      await this.initialize();
      await this.setupAudioCapture();  // Set up Web Audio capture before FFmpeg
      await this.startFFmpeg();
      await this.captureAndStream();

      // Reset restart counter on successful start
      this.restartCount = 0;
      this.currentRestartDelay = CONFIG.restartDelay;

      console.log('\n✅ Streaming to Twitch!');
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
