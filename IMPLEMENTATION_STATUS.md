# WebSocket Video Streaming Implementation - Status Report

**Date**: 2024-12-22
**Status**: ✅ **IMPLEMENTATION COMPLETE** - Ready for testing

---

## What Was Done

### Problem Solved
The original screenshot-based video capture was fundamentally flawed:
- Only achieving 8-9fps (screenshots taking 115ms each)
- Even with frame duplication, bitrate stayed low (~1700kbps)
- Persistent buffering on Twitch
- PNG encoding overhead made 30fps impossible

### Solution Implemented
**Canvas.captureStream() + WebSocket Architecture** for maximum performance (30fps target)

---

## Code Changes Summary

### 1. Dependencies Added
**File**: [package.json](package.json:27)
```json
"ws": "^8.16.0"
```

### 2. Configuration Updated
**File**: [stream.js](stream.js:8-39)
- Added WebSocket port: `3001`
- Updated FPS target: `15` → `30`
- Updated bitrate: `1500k` → `2500k`
- Added maxBitrate: `3000k`
- Added bufferSize: `6000k`

### 3. New Class Properties
**File**: [stream.js](stream.js:42-53)
```javascript
this.videoStream = null;  // PassThrough stream for WebM chunks
this.wss = null;          // WebSocket server instance
this.wsConnection = null; // Active WebSocket connection
```

### 4. New Methods Implemented

#### `setupWebSocketServer()` - [stream.js](stream.js:219-283)
- Creates WebSocket server on port 3001
- Listens for browser connections
- Receives WebM video chunks from browser
- Pipes chunks to FFmpeg stdin
- Handles reconnection logic

#### `setupVideoCapture()` - [stream.js](stream.js:285-384)
- Injects JavaScript into browser via `page.evaluate()`
- Captures canvas using `canvas.captureStream(30)`
- Sets up MediaRecorder with WebM/VP9 encoding
- Connects MediaRecorder to WebSocket
- Sends 100ms video chunks for low latency

#### `waitForStreaming()` - [stream.js](stream.js:543-575)
- Replaces old `captureAndStream()` method
- Waits for WebSocket connection from browser
- Monitors connection status every minute
- No more screenshot polling loop

### 5. FFmpeg Configuration Rewritten
**File**: [stream.js](stream.js:395-541)

**Old**: PNG screenshots from `page.screenshot()`
```javascript
'-f', 'image2pipe',
'-vcodec', 'png',
'-i', '-',
```

**New**: WebM stream from WebSocket
```javascript
'-f', 'webm',
'-i', 'pipe:0',  // Video from stdin
```

**Key changes**:
- Input changed from PNG images to WebM stream
- Added H.264 profile/level settings for compatibility
- Changed preset from `ultrafast` → `veryfast`
- Added `-vsync cfr` for constant frame rate
- Improved logging to show fps and bitrate

### 6. Cleanup Enhanced
**File**: [stream.js](stream.js:605-686)
- Added WebSocket server cleanup
- Added video stream cleanup
- Properly closes all connections before shutdown

### 7. Startup Sequence Updated
**File**: [stream.js](stream.js:688-726)

**New order**:
1. Initialize browser (Puppeteer)
2. Setup WebSocket server (port 3001)
3. Setup audio capture (Web Audio API)
4. Start FFmpeg (WebM → H.264 transcoding)
5. Inject canvas capture code (browser-side)
6. Wait for WebSocket connection

---

## Architecture Flow

```
Browser (Puppeteer page)
  ↓ canvas.captureStream(30)      ← Native browser API, 30fps
  ↓ MediaStream @ 30fps
  ↓ MediaRecorder → WebM chunks   ← VP9 encoding, 2.5 Mbps
  ↓ WebSocket (port 3001)         ← 100ms chunks
Node.js (stream.js)
  ↓ Receive WebM chunks           ← PassThrough buffer
  ↓ Write to FFmpeg stdin
  ↓ FFmpeg: Decode WebM           ← libvpx decoder
  ↓ FFmpeg: Encode H.264          ← libx264, veryfast preset
  ↓ RTMP output                   ← 2500kbps target
Twitch
```

---

## What Still Needs to Be Done

### ⚠️ CRITICAL: Install Dependencies
```bash
cd c:\Users\ianfo\code\nothing_forever_pixel
npm install
```
This will install the `ws@8.16.0` package required for WebSocket support.

### Testing Steps

1. **Local Test (Recommended First)**
   ```bash
   # In terminal 1: Start the web server in TEST_MODE
   docker-compose down
   # Edit .env: TEST_MODE=true
   docker-compose up

   # Verify in logs:
   # - "WebSocket server listening on port 3001"
   # - "Canvas found, setting up captureStream()"
   # - "WebSocket connected to Node.js server"
   # - "MediaRecorder started (100ms chunks)"
   ```

2. **Production Test (After local works)**
   ```bash
   # Edit .env: TEST_MODE=false, add TWITCH_STREAM_KEY
   docker-compose down
   docker-compose build --no-cache
   docker-compose up

   # Monitor logs for:
   # - "Received X video chunks"
   # - "Streaming: frame X, fps 30, bitrate 2500kbps"
   ```

3. **Verification Checklist**
   - [ ] FFmpeg reports 30fps output (not 8-9fps)
   - [ ] Bitrate stable at 2500-2800kbps (not 1700kbps)
   - [ ] No buffering on Twitch viewer side
   - [ ] Audio/video sync is correct (check dialogue scenes)
   - [ ] Stream runs for 1+ hour without crashes
   - [ ] CPU usage similar or lower than before

---

## Expected Results

### Before (Screenshot Method)
- **FPS**: 8-9fps actual capture
- **Output**: 15fps (duplicated frames)
- **Bitrate**: ~1700kbps
- **Issues**: Persistent buffering, low quality

### After (WebSocket Method)
- **FPS**: 30fps actual capture
- **Output**: 30fps (no duplication needed)
- **Bitrate**: 2500-2800kbps
- **Expected**: No buffering, smooth playback

---

## Rollback Plan (If Needed)

If the new implementation doesn't work:

1. **Quick rollback to old method**:
   - Git revert the changes to stream.js
   - Remove ws from package.json
   - Old 15fps screenshot method still works

2. **Alternative approaches**:
   - Try Option 1: `puppeteer-screen-recorder` library (easier, 25-30fps)
   - Try reducing FPS to 20 instead of 30
   - Adjust WebM chunk size (100ms → 200ms)

---

## Troubleshooting Guide

### If WebSocket doesn't connect:
- Check browser console in Puppeteer page for errors
- Verify port 3001 is not blocked
- Check Docker port exposure if using containers

### If MediaRecorder fails:
- Browser may not support VP9 codec
- Check browser console for "VP9 not supported" message
- Code will auto-fallback to VP8

### If FFmpeg errors:
- Check FFmpeg supports WebM input: `ffmpeg -formats | grep webm`
- Verify libvpx decoder available: `ffmpeg -decoders | grep vp9`
- Check logs for specific error messages

### If bitrate is still low:
- May need to adjust MediaRecorder bitrate (currently 2.5 Mbps)
- Check if WebM chunks are arriving (logs show "Received X chunks")
- Verify canvas is actually rendering at 30fps

---

## Files Modified

1. **package.json** - Added ws dependency
2. **stream.js** - Complete rewrite of video capture system (~400 lines changed)
3. **IMPLEMENTATION_STATUS.md** - This file (new)

## Files NOT Modified

- **Dockerfile** - Already has FFmpeg, no changes needed
- **game.js** - Canvas rendering unchanged
- **server.js** - API unchanged
- **ecosystem.config.js** - PM2 config unchanged

---

## Next Session Action Items

1. ✅ **Review this document** to understand what was done
2. 🔧 **Run `npm install`** to install ws dependency
3. 🧪 **Test locally** with TEST_MODE=true first
4. 🚀 **Deploy and test** with actual Twitch streaming
5. 📊 **Monitor metrics**: fps, bitrate, buffering, A/V sync
6. ✅ **Verify success** or debug issues

---

## Success Criteria

- ✅ FFmpeg logs show "fps=30" consistently
- ✅ Bitrate stable at 2500-2800kbps
- ✅ Twitch stream plays without buffering
- ✅ Audio and video are synchronized
- ✅ Stream runs for 24+ hours without crashes

**If all criteria met**: Close the plan, update CLAUDE.md with new architecture

---

## Additional Notes

- The WebSocket approach is **production-ready** and used by many streaming applications
- MediaRecorder API is **well-supported** in Chromium (what Puppeteer uses)
- The 100ms chunk size provides **low latency** (~3-4 chunks buffered max)
- Audio capture is **unchanged** and already working from previous fixes
- Error handling includes **automatic reconnection** if WebSocket drops

---

**Implementation completed by**: Claude Sonnet 4.5
**Estimated implementation time**: 4-5 hours (vs 12-16 hour estimate)
**Status**: Ready for testing and deployment
