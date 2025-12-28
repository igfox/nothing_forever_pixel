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
  canvasWidth: 1280,  // Phaser 3 native resolution
  canvasHeight: 720,  // 16:9 aspect ratio (720p)
  outputWidth: 1280,   // Match canvas resolution
  outputHeight: 720,
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
    console.log('[INIT] Initializing Twitch Streamer...');

    if (!CONFIG.twitchStreamKey) {
      throw new Error('TWITCH_STREAM_KEY not found in environment variables. Please add it to .env file.');
    }

    // Launch Puppeteer
    console.log('[BROWSER] Launching headless browser...');
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

    // Set up console logging from the page (capture ALL messages for debugging)
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      // Log all console messages with appropriate prefix
      if (type === 'error') {
        console.error('[BROWSER ERROR]', text);
      } else if (type === 'warning') {
        console.warn('[STREAM WARN] Browser warning:', text);
      } else {
        // Log regular console.log/info messages
        console.log('[BROWSER]', text);
      }
    });

    // Set up error handling
    this.page.on('error', error => {
      console.error('[ERROR] Page crashed:', error);
      this.handleError(error);
    });

    // Navigate to the page
    console.log(`[VIDEO] Navigating to ${CONFIG.serverUrl}...`);
    await this.page.goto(CONFIG.serverUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for canvas to be ready
    await this.page.waitForSelector('canvas', { timeout: 10000 });
    console.log('[STREAM] Canvas detected');

    // Phase 4: Force audio initialization before capture starts
    console.log('[MUSIC] Initializing audio system...');
    const audioInitialized = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
          playBtn.click();
          console.log('[STREAM] Play button clicked to initialize audio');

          // Wait for AudioContext to be ready
          const checkAudio = setInterval(() => {
            if (window.audioContext && window.audioContext.state === 'running') {
              clearInterval(checkAudio);
              console.log('[STREAM] AudioContext ready for streaming (state: running)');
              resolve(true);
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkAudio);
            const state = window.audioContext ? window.audioContext.state : 'undefined';
            console.warn(`[STREAM WARN] AudioContext timeout after 5s (state: ${state}), continuing anyway`);
            resolve(false);
          }, 5000);
        } else {
          console.warn('[STREAM WARN] Play button not found, AudioContext may not initialize');
          resolve(false);
        }
      });
    });

    if (audioInitialized) {
      console.log('[STREAM] Audio system initialized and ready');
    } else {
      console.warn('[STREAM WARN] Audio system may not be ready - stream will use video-only if AudioContext unavailable');
    }

    // Wait for game to stabilize after audio initialization
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('[STREAM] Browser initialized successfully');
  }

  async setupWebSocketServer() {
    console.log('[WEBSOCKET] Setting up WebSocket server for video streaming...');

    return new Promise((resolve, reject) => {
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        port: CONFIG.wsPort,
        maxPayload: 10 * 1024 * 1024  // 10MB max payload for video chunks
      });

      this.wss.on('listening', () => {
        console.log(`[STREAM] WebSocket server listening on port ${CONFIG.wsPort}`);
        resolve();
      });

      this.wss.on('error', (error) => {
        console.error('[ERROR] WebSocket server error:', error);
        reject(error);
      });

      this.wss.on('connection', (ws) => {
        console.log('[WEBSOCKET] Browser connected to WebSocket server');
        this.wsConnection = ws;

        // Create video stream for FFmpeg
        this.videoStream = new PassThrough();

        // Connect video stream to FFmpeg stdin NOW that it exists
        if (this.ffmpegProcess && this.ffmpegProcess.stdin) {
          this.videoStream.pipe(this.ffmpegProcess.stdin);
          console.log('[VIDEO] Video stream (WebM) connected to FFmpeg stdin');
        }

        let chunkCount = 0;
        let bytesReceived = 0;

        // Phase 0 Diagnostic: Track WebM input bitrate
        let diagnosticBytesReceived = 0;
        let diagnosticChunkCount = 0;
        const bitrateInterval = setInterval(() => {
          const kbps = (diagnosticBytesReceived * 8 / 1000).toFixed(2);
          console.log(`[STATS] WebM input: ${kbps} kbps (${diagnosticChunkCount} chunks/sec)`);
          diagnosticBytesReceived = 0;
          diagnosticChunkCount = 0;
        }, 1000);

        ws.on('message', (data) => {
          // Receive WebM chunks from browser
          if (this.videoStream && Buffer.isBuffer(data)) {
            chunkCount++;
            bytesReceived += data.length;

            // Phase 0 Diagnostic: Track for bitrate calculation
            diagnosticBytesReceived += data.length;
            diagnosticChunkCount++;

            // Write to FFmpeg stdin
            this.videoStream.write(data);

            // Log progress occasionally
            if (chunkCount % 100 === 0) {
              const mbReceived = (bytesReceived / (1024 * 1024)).toFixed(2);
              console.log(`[VIDEO] Received ${chunkCount} video chunks (${mbReceived} MB)`);
            }
          }
        });

        ws.on('close', () => {
          console.log('[WEBSOCKET] Browser disconnected from WebSocket');
          this.wsConnection = null;

          // Phase 0 Diagnostic: Clean up bitrate interval
          if (bitrateInterval) {
            clearInterval(bitrateInterval);
          }

          // Attempt to reconnect after a short delay
          setTimeout(() => {
            if (this.isRunning && !this.wsConnection) {
              console.log('[RETRY] Waiting for browser to reconnect...');
            }
          }, 2000);
        });

        ws.on('error', (error) => {
          console.error('[ERROR] WebSocket connection error:', error);
        });
      });
    });
  }

  async setupUnifiedAudioVideoCapture() {
    console.log('[CAPTURE][MUSIC] Setting up unified audio/video capture...');

    // Wait for the first dialogue to actually appear before capturing
    console.log('[TIMER] Waiting for first dialogue box to appear...');
    const dialogBoxAppeared = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let checks = 0;
        const checkInterval = setInterval(() => {
          checks++;

          // Check if dialogue is actually being displayed in the DOM
          const dialogueEl = document.getElementById('dialogue-lines');

          if (dialogueEl) {
            // Check if there are actual dialogue lines
            const dialogueLines = dialogueEl.querySelectorAll('.dialogue-line');
            const hasRealDialogue = dialogueLines && dialogueLines.length > 0;

            if (hasRealDialogue) {
              console.log(`[STREAM] First dialogue detected after ${checks * 0.5}s (${dialogueLines.length} lines), ready to capture`);
              clearInterval(checkInterval);
              resolve(true);
              return;
            }
          }

          // Log progress every 4 seconds
          if (checks % 8 === 0) {
            const lineCount = dialogueEl ? dialogueEl.querySelectorAll('.dialogue-line').length : 0;
            const innerHTML = dialogueEl ? dialogueEl.innerHTML.substring(0, 50) : 'not found';
            console.log(`[TIMER] Still waiting for dialogue... (${checks * 0.5}s elapsed, lines=${lineCount}, content="${innerHTML}...")`);
          }
        }, 500);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('[STREAM WARN] Timeout waiting for dialogue, starting capture anyway');
          resolve(true);
        }, 30000);
      });
    });

    if (!dialogBoxAppeared) {
      console.warn('[STREAM WARN] Dialogue may not be ready, but proceeding with capture');
    }

    // Inject unified audio/video capture code into browser
    const captureSetup = await this.page.evaluate((wsPort) => {
      return new Promise(async (resolve) => {
        const canvas = document.getElementById('canvas');

        if (!canvas) {
          console.error('[STREAM ERROR] Canvas not found');
          resolve(false);
          return;
        }

        try {
          console.log('[STREAM] Canvas found, setting up unified capture');

          // Step 1: Get video stream from canvas
          const videoStream = canvas.captureStream(30);
          console.log('[STREAM] Canvas video stream created at 30fps');

          // Step 2: Wait for AudioContext and create unified stream
          let audioContext = window.audioContext;
          let attempts = 0;

          while (!audioContext && attempts < 100) {
            await new Promise(r => setTimeout(r, 100));
            audioContext = window.audioContext;
            attempts++;
          }

          let combinedStream = videoStream;

          if (audioContext && audioContext.state === 'running') {
            console.log('[STREAM] AudioContext found and running, adding audio track');

            try {
              // Create MediaStreamDestination to route Web Audio to MediaStream
              const destination = audioContext.createMediaStreamDestination();
              window._audioCaptureDest = destination;

              // Intercept AudioNode connections to duplicate to capture destination
              const originalConnect = AudioNode.prototype.connect;

              AudioNode.prototype.connect = function(dest, ...args) {
                const result = originalConnect.call(this, dest, ...args);

                // If connecting to main destination, also connect to capture
                if (dest === audioContext.destination && window._audioCaptureDest) {
                  try {
                    originalConnect.call(this, window._audioCaptureDest);
                  } catch (e) {
                    console.warn('Could not duplicate to capture:', e);
                  }
                }

                return result;
              };

              // Get audio track from destination
              const audioTracks = destination.stream.getAudioTracks();
              if (audioTracks.length > 0) {
                const audioTrack = audioTracks[0];
                combinedStream.addTrack(audioTrack);
                console.log('[STREAM] Audio track added to video stream (unified stream ready)');
              } else {
                console.warn('[STREAM WARN] No audio track from MediaStreamDestination, using video-only');
              }
            } catch (error) {
              console.error('[STREAM ERROR] Failed to add audio track:', error);
              console.warn('[STREAM WARN] Continuing with video-only stream');
            }
          } else {
            console.warn(`[STREAM WARN] AudioContext not available (state: ${audioContext ? audioContext.state : 'undefined'}), using video-only`);
          }

          // Step 3: Set up canvas change detection (diagnose duplicate frames)
          let lastCanvasHash = null;
          let unchangedFrames = 0;
          let totalFrameChecks = 0;

          const checkCanvasChange = () => {
            try {
              const ctx = canvas.getContext('2d');
              // Sample 10x10 grid of pixels for efficiency
              const sampleData = [];
              for (let y = 0; y < 720; y += 72) {
                for (let x = 0; x < 1280; x += 128) {
                  const pixel = ctx.getImageData(x, y, 1, 1).data;
                  sampleData.push(pixel[0], pixel[1], pixel[2]);
                }
              }
              const hash = sampleData.join(',');

              totalFrameChecks++;
              if (hash === lastCanvasHash) {
                unchangedFrames++;
              }
              lastCanvasHash = hash;

              // Log every 2 seconds (60 frames at 30fps)
              if (totalFrameChecks % 60 === 0) {
                const unchangedPct = ((unchangedFrames / totalFrameChecks) * 100).toFixed(2);
                console.log(`[CANVAS] Canvas change: ${unchangedPct}% frames visually identical (${unchangedFrames}/${totalFrameChecks})`);
              }
            } catch (e) {
              // Silently ignore - may not be able to read canvas
            }
          };

          // Check canvas changes at 30fps
          const canvasCheckInterval = setInterval(checkCanvasChange, 33);

          // Step 4: Set up MediaRecorder with unified stream
          let mimeType = 'video/webm;codecs=vp9,opus';

          if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn('[STREAM WARN] VP9+Opus not supported, trying VP8+Opus');
            mimeType = 'video/webm;codecs=vp8,opus';

            if (!MediaRecorder.isTypeSupported(mimeType)) {
              console.warn('[STREAM WARN] VP8+Opus not supported, trying VP8 only');
              mimeType = 'video/webm;codecs=vp8';

              if (!MediaRecorder.isTypeSupported(mimeType)) {
                console.error('[STREAM ERROR] WebM not supported at all');
                resolve(false);
                return;
              }
            }
          }

          const recorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 5000000,  // 5 Mbps for WebM (will transcode to 2.5-3 Mbps H.264)
            audioBitsPerSecond: 192000     // 192 kbps for audio
          });

          console.log(`[STREAM] Unified MediaRecorder created with ${mimeType} (video: 5Mbps, audio: 192kbps)`);
          console.log(`[STATS] Audio tracks: ${combinedStream.getAudioTracks().length}, Video tracks: ${combinedStream.getVideoTracks().length}`);

          // Step 4: Connect to WebSocket server
          const ws = new WebSocket(`ws://localhost:${wsPort}`);

          ws.onopen = () => {
            console.log('[STREAM] WebSocket connected to Node.js server');

            // MediaRecorder timing diagnostics
            let lastChunkTime = performance.now();
            let chunkCount = 0;
            let totalChunkInterval = 0;
            let minInterval = Infinity;
            let maxInterval = 0;

            // Chunk buffering: batch small chunks into 100ms intervals
            let chunkBuffer = [];
            let lastFlushTime = performance.now();
            const FLUSH_INTERVAL = 100;  // 100ms target

            const flushBuffer = () => {
              if (chunkBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
                // Combine all buffered chunks into one blob
                const combinedBlob = new Blob(chunkBuffer, { type: chunkBuffer[0].type });
                ws.send(combinedBlob);

                const now = performance.now();
                const flushInterval = now - lastFlushTime;

                console.log(`[BUFFER] Buffered flush: ${chunkBuffer.length} chunks → ${(combinedBlob.size / 1024).toFixed(2)}KB (${flushInterval.toFixed(2)}ms interval)`);

                chunkBuffer = [];
                lastFlushTime = now;
              }
            };

            // Set up periodic flush every 100ms
            const flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);

            // Handle recorded data chunks
            recorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                // Add to buffer instead of sending immediately
                chunkBuffer.push(event.data);

                // Track chunk timing (for diagnostics)
                const now = performance.now();
                const interval = now - lastChunkTime;
                chunkCount++;

                if (chunkCount > 1) {  // Skip first chunk
                  totalChunkInterval += interval;
                  minInterval = Math.min(minInterval, interval);
                  maxInterval = Math.max(maxInterval, interval);

                  // Log every 300 chunks (for high-frequency chunks)
                  if (chunkCount % 300 === 0) {
                    const avgInterval = (totalChunkInterval / (chunkCount - 1)).toFixed(2);
                    const jitter = (maxInterval - minInterval).toFixed(2);
                    console.log(`[STREAM] Raw MediaRecorder: avg=${avgInterval}ms interval, jitter=${jitter}ms (buffering to ${FLUSH_INTERVAL}ms)`);

                    // Reset stats for next window
                    totalChunkInterval = 0;
                    minInterval = Infinity;
                    maxInterval = 0;
                  }
                }

                lastChunkTime = now;
              }
            };

            recorder.onerror = (event) => {
              console.error('[STREAM ERROR] MediaRecorder error:', event.error);
            };

            // Start recording with 100ms chunks for low latency
            recorder.start(100);
            console.log('[STREAM] Unified MediaRecorder started (100ms chunks, A+V synchronized)');

            resolve(true);
          };

          ws.onerror = (error) => {
            console.error('[STREAM ERROR] WebSocket error:', error);
            clearInterval(flushTimer);
            clearInterval(canvasCheckInterval);
            resolve(false);
          };

          ws.onclose = () => {
            console.warn('[STREAM WARN] WebSocket closed, stopping recorder');
            clearInterval(flushTimer);
            clearInterval(canvasCheckInterval);
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          };

        } catch (error) {
          console.error('[STREAM ERROR] Failed to set up unified capture:', error);
          resolve(false);
        }
      });
    }, CONFIG.wsPort);

    if (captureSetup) {
      console.log('[STREAM] Unified audio/video capture setup complete - A/V synchronized');
      return true;
    } else {
      console.error('[STREAM ERROR] Failed to set up unified capture');
      return false;
    }
  }

  async setupVideoCapture() {
    console.log('[VIDEO] Setting up canvas video capture...');

    // Wait for the first dialogue to actually appear before capturing
    console.log('[TIMER] Waiting for first dialogue box to appear...');
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
              console.log(`[STREAM] First dialogue detected after ${checks * 0.5}s (${dialogueLines.length} lines), ready to capture`);
              clearInterval(checkInterval);
              resolve(true);
              return;
            }
          }

          // Log progress every 4 seconds
          if (checks % 8 === 0) {
            const lineCount = dialogueEl ? dialogueEl.querySelectorAll('.dialogue-line').length : 0;
            const innerHTML = dialogueEl ? dialogueEl.innerHTML.substring(0, 50) : 'not found';
            console.log(`[TIMER] Still waiting for dialogue... (${checks * 0.5}s elapsed, lines=${lineCount}, content="${innerHTML}...")`);
          }
        }, 500);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('[STREAM WARN] Timeout waiting for dialogue, starting capture anyway');
          resolve(true);
        }, 30000);
      });
    });

    if (!dialogBoxAppeared) {
      console.warn('[STREAM WARN] Dialogue may not be ready, but proceeding with capture');
    }

    // Inject canvas.captureStream() code into browser
    const captureSetup = await this.page.evaluate((wsPort) => {
      return new Promise(async (resolve) => {
        const canvas = document.getElementById('canvas');

        if (!canvas) {
          console.error('[STREAM ERROR] Canvas not found');
          resolve(false);
          return;
        }

        try {
          console.log('[STREAM] Canvas found, setting up captureStream()');

          // Capture canvas at 30fps to match Phaser's frame rate
          // This prevents duplicate frames (was 60fps causing 22% duplicates)
          const stream = canvas.captureStream(30);
          console.log('[STREAM] Canvas stream created at 30fps');

          // Set up MediaRecorder with WebM/VP9 encoding
          let mimeType = 'video/webm;codecs=vp9';
          let fallbackUsed = false;

          if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn('[STREAM WARN] VP9 not supported, trying VP8');
            mimeType = 'video/webm;codecs=vp8';
            fallbackUsed = true;

            if (!MediaRecorder.isTypeSupported(mimeType)) {
              console.error('[STREAM ERROR] WebM not supported at all');
              resolve(false);
              return;
            }
          }

          const recorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 4000000  // Increased to 4 Mbps for better quality
          });

          console.log(`[STREAM] MediaRecorder created with ${mimeType} at 4Mbps`);

          // Connect to WebSocket server
          const ws = new WebSocket(`ws://localhost:${wsPort}`);

          ws.onopen = () => {
            console.log('[STREAM] WebSocket connected to Node.js server');

            // Handle recorded data chunks
            recorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data);
              }
            };

            recorder.onerror = (event) => {
              console.error('[STREAM ERROR] MediaRecorder error:', event.error);
            };

            // Start recording with 100ms chunks for low latency
            recorder.start(100);
            console.log('[STREAM] MediaRecorder started (100ms chunks)');

            resolve(true);
          };

          ws.onerror = (error) => {
            console.error('[STREAM ERROR] WebSocket error:', error);
            resolve(false);
          };

          ws.onclose = () => {
            console.warn('[STREAM WARN] WebSocket closed, stopping recorder');
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          };

        } catch (error) {
          console.error('[STREAM ERROR] Failed to set up video capture:', error);
          resolve(false);
        }
      });
    }, CONFIG.wsPort);

    if (captureSetup) {
      console.log('[STREAM] Video capture setup complete - streaming at 30fps');
      return true;
    } else {
      console.error('[STREAM ERROR] Failed to set up video capture');
      return false;
    }
  }

  async startFFmpeg() {
    console.log('[STREAM] Starting FFmpeg with unified WebM → H.264 transcoding...');

    const rtmpUrl = `${CONFIG.twitchServer}/${CONFIG.twitchStreamKey}`;

    // FFmpeg arguments for unified WebM input → RTMP transcoding
    const ffmpegArgs = [
      // Single unified input: WebM stream with audio+video
      '-thread_queue_size', '1024',  // Larger buffer for unified stream
      '-f', 'webm',
      '-i', 'pipe:0',  // Unified A/V from stdin

      // Video encoding: Decode WebM/VP9, re-encode to H.264 with CBR
      '-c:v', 'libx264',
      '-preset', 'medium',  // Better quality than veryfast (worth CPU cost)
      '-tune', 'zerolatency',  // Low latency for live streaming

      // ENFORCE BITRATE - CBR MODE (NO CRF!)
      '-b:v', '2800k',      // Target 2.8 Mbps
      '-minrate', '2500k',  // HARD MINIMUM - will not go below this
      '-maxrate', '3000k',  // HARD MAXIMUM
      '-bufsize', '3000k',  // Buffer size = maxrate for CBR
      '-qdiff', '4',        // Limit quantizer difference between frames

      // Prevent quality from crushing bitrate
      '-qmin', '18',        // Minimum quantizer (higher = worse quality floor)
      '-qmax', '32',        // Maximum quantizer (prevents too high quality)

      // Keyframe settings - fix duplicate frames
      '-g', String(CONFIG.keyframeInterval),         // Keyframe every 2 seconds at 30fps
      '-keyint_min', String(CONFIG.keyframeInterval),
      '-sc_threshold', '0',  // Disable scene detection (prevents random keyframes)
      '-force_key_frames', 'expr:gte(t,n_forced*2)',  // Force keyframe every 2s

      // Resolution & frame rate - FIX DUPLICATE FRAMES
      '-pix_fmt', 'yuv420p',
      '-s', `${CONFIG.outputWidth}x${CONFIG.outputHeight}`,
      '-r', String(CONFIG.fps),  // Force 30fps output
      '-vsync', 'cfr',           // Constant frame rate (drop/dup frames to maintain 30fps)

      // H.264 profile
      '-profile:v', 'high',
      '-level', '4.1',

      // Audio encoding settings
      '-c:a', 'aac',
      '-b:a', '160k',  // Increased audio bitrate
      '-ar', String(CONFIG.audioSampleRate),
      '-ac', String(CONFIG.audioChannels),

      // Sync settings (simpler with unified input)
      '-async', '1',
      '-max_muxing_queue_size', '1024',

      // Output flags
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',

      // RTMP reconnection settings
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '10',

      rtmpUrl
    ];

    console.log('[NETWORK] FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
    console.log('[CONFIG] Bitrate mode: CBR (2.5-3 Mbps enforced, NO CRF)');

    // Single stdio configuration for unified stream
    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']  // Only need stdin for unified stream
    });

    // Note: Video stream will be connected when WebSocket connects (in setupWebSocketServer)

    // Phase 0 Diagnostic: Monitor FFmpeg stdin throughput
    let stdinBytes = 0;
    if (this.videoStream) {
      this.videoStream.on('data', (chunk) => {
        stdinBytes += chunk.length;
      });

      setInterval(() => {
        const kbps = (stdinBytes * 8 / 1000).toFixed(2);
        console.log(`[INPUT] FFmpeg stdin: ${kbps} kbps`);
        stdinBytes = 0;
      }, 1000);
    }

    // Note: Audio is now included in the unified WebM stream (no separate pipe:3 needed)

    // Log FFmpeg output
    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();

      // Phase 0 Diagnostic: Log stream info on initialization
      if (message.includes('Stream #0')) {
        console.log('[VIDEO] FFmpeg stream info:', message.trim());
      }

      // Log errors
      if (message.includes('error') || message.includes('Error')) {
        console.error('[ERROR] FFmpeg error:', message);
      }
      // Log warnings
      else if (message.includes('warning') || message.includes('Warning')) {
        console.warn('[STREAM WARN] FFmpeg warning:', message);
      }
      // Log frame progress occasionally with duplicate/drop statistics
      else if (message.includes('frame=')) {
        if (Math.random() < 0.02) { // 2% of progress updates
          const frameMatch = message.match(/frame=\s*(\d+)/);
          const fpsMatch = message.match(/fps=\s*([\d.]+)/);
          const bitrateMatch = message.match(/bitrate=\s*([\d.]+)kbits\/s/);
          const dupMatch = message.match(/dup=\s*(\d+)/);
          const dropMatch = message.match(/drop=\s*(\d+)/);

          if (frameMatch) {
            const frame = frameMatch[1];
            const fps = fpsMatch ? fpsMatch[1] : '?';
            const bitrate = bitrateMatch ? bitrateMatch[1] : '?';
            const dup = dupMatch ? dupMatch[1] : '0';
            const drop = dropMatch ? dropMatch[1] : '0';

            // Calculate duplicate percentage
            const dupPct = frame > 0 ? ((parseInt(dup) / parseInt(frame)) * 100).toFixed(2) : '0';

            console.log(`[VIDEO] FFmpeg: frame ${frame}, fps ${fps}, bitrate ${bitrate}kbps, dup=${dup} (${dupPct}%), drop=${drop}`);
          }
        }
      }
    });

    this.ffmpegProcess.on('error', (error) => {
      console.error('[ERROR] FFmpeg process error:', error);
      this.handleError(error);
    });

    this.ffmpegProcess.on('close', (code) => {
      console.log(`[ERROR] FFmpeg process exited with code ${code}`);
      if (this.isRunning) {
        this.handleError(new Error(`FFmpeg exited unexpectedly with code ${code}`));
      }
    });

    console.log('[STREAM] FFmpeg started - WebM decoding → H.264 encoding → RTMP');
  }

  async waitForStreaming() {
    console.log('[CAPTURE] Waiting for WebSocket video stream to start...');
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

    console.log('[STREAM] WebSocket connected - video streaming active');
    console.log(`[STATS] Canvas.captureStream() @ ${CONFIG.fps}fps → MediaRecorder → WebM → FFmpeg → H.264 → RTMP`);

    // Keep the process running and log status periodically
    const statusInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(statusInterval);
        return;
      }

      if (this.wsConnection) {
        console.log('[STREAM] Stream active - WebSocket connected, FFmpeg processing');
      } else {
        console.warn('[STREAM WARN] WebSocket disconnected - waiting for reconnection...');
      }
    }, 60000); // Log status every minute
  }

  async handleError(error) {
    console.error('[CRITICAL] Error occurred:', error.message);

    if (this.restartCount >= CONFIG.maxRestarts) {
      console.error(`[STOP] Maximum restart attempts (${CONFIG.maxRestarts}) reached. Exiting.`);
      await this.cleanup();
      process.exit(1);
    }

    this.restartCount++;
    console.log(`[RETRY] Attempting restart ${this.restartCount}/${CONFIG.maxRestarts} in ${this.currentRestartDelay}ms...`);

    await this.cleanup();

    setTimeout(() => {
      this.start().catch(error => {
        console.error('[ERROR] Restart failed:', error);
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
    console.log('[CLEANUP] Cleaning up...');
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
        console.log('[STREAM] WebSocket server closed');
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

    console.log('[STREAM] Cleanup complete');
  }

  async start() {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('[STREAM] Pixels Forever - Twitch Streamer (WebSocket Mode)');
      console.log('='.repeat(60) + '\n');

      // Step 1: Initialize browser
      await this.initialize();

      // Step 2: Set up WebSocket server (must be before FFmpeg)
      await this.setupWebSocketServer();

      // Step 3: Start FFmpeg (will wait for unified WebM chunks from WebSocket)
      await this.startFFmpeg();

      // Step 4: Set up unified audio/video capture (replaces separate audio and video setup)
      const captureSuccess = await this.setupUnifiedAudioVideoCapture();
      if (!captureSuccess) {
        throw new Error('Failed to set up unified audio/video capture in browser');
      }

      // Step 5: Wait for WebSocket connection and monitor
      await this.waitForStreaming();

      // Reset restart counter on successful start
      this.restartCount = 0;
      this.currentRestartDelay = CONFIG.restartDelay;

      console.log('\n[STREAM] Streaming to Twitch at 30fps!');
      console.log('[VIDEO] Check your stream at https://twitch.tv/your_channel\n');

    } catch (error) {
      console.error('[ERROR] Failed to start stream:', error);
      await this.handleError(error);
    }
  }

  async stop() {
    console.log('[STOP] Stopping stream...');
    await this.cleanup();
    process.exit(0);
  }
}

// Main execution
const streamer = new TwitchStreamer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[NETWORK] Received SIGTERM signal');
  await streamer.stop();
});

process.on('SIGINT', async () => {
  console.log('\n[NETWORK] Received SIGINT signal (Ctrl+C)');
  await streamer.stop();
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('[ERROR] Uncaught exception:', error);
  await streamer.handleError(error);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
  await streamer.handleError(new Error(String(reason)));
});

// Start streaming
streamer.start();
