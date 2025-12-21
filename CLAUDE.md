# Pixels Forever - Project Memory

## Project Overview
**Pixels Forever** is an AI-powered retro pixel art sitcom that streams 24/7 to Twitch. It generates endless Seinfeld-style dialogue using Google's Gemini API and renders it in a nostalgic 16-bit aesthetic with procedurally generated music and voice synthesis.

## Core Architecture

### Technology Stack
- **Frontend**: HTML5 Canvas (320x240 scaled 3x), Web Audio API
- **Backend**: Node.js/Express
- **AI**: Google Gemini API (gemma-3-27b-it model)
- **Streaming**: Puppeteer (headless Chrome) + FFmpeg → Twitch RTMP
- **Process Management**: PM2 with auto-restart
- **Containerization**: Docker + docker-compose
- **Hosting**: Oracle Cloud Free Tier (ARM compute)

### Key Files

#### Application Core
- **game.js** (~1200 lines) - Main canvas rendering, character animation, audio synthesis, scene management
- **server.js** (~80 lines) - Express server, Gemini API integration
- **script.html** - Single-page UI with controls
- **styles.css** - Retro 16-bit styling

#### Streaming Infrastructure
- **stream.js** (~380 lines) - Puppeteer capture + FFmpeg RTMP streaming
- **ecosystem.config.js** - PM2 configuration with TEST_MODE support
- **Dockerfile** - Container with Chromium, FFmpeg, Node.js
- **docker-compose.yml** - Service orchestration

#### Documentation
- **DEPLOYMENT.md** - Oracle Cloud setup guide
- **TEST_MODE.md** - Development mode documentation
- **RATE_LIMITS.md** - Gemini API rate limit analysis
- **healthcheck.sh** - PM2 health monitoring script

## Critical Implementation Details

### Scene Generation & Batching
- **Pre-generation**: Maintains queue of 2 scenes for smooth transitions
- **Scene length**: 15-20 dialogue exchanges (~1 minute)
- **API calls**: ~2 requests/minute, ~1440/day (well within 1,500/day limit)
- **Model**: gemini-1.5-flash (1,500 requests/day, NOT gemini-2.5-flash-lite which only has 20/day)

### Character System
- **Characters**: Larry (neurotic protagonist), Janet (voice of reason), Mike (eccentric)
- **Positioning**: Y coordinates constrained to max 130 to avoid dialogue box (which is at y=150)
- **Movement**: Subtle idle animations, walking between positions
- **Rendering**: 16x20 pixel sprites with 2-frame walk cycle
- **Shadows**: REMOVED (were appearing below dialogue box)

### Dialogue Timing
- **Base delay**: 4500ms between lines (increased from 3500ms for readability)
- **Word count adjustment**: +150ms per word (max +3000ms)
- **Final line handling**: 2.5 second delay before applause to let voice finish
- **Scene end**: Applause/laughter (3.5s) + 4s wait + 6s pause before next scene

### Audio Synthesis
- **Music**: Procedural 16-bit style with bassline, melody, drums
- **Voice**: Sawtooth oscillator with character-specific pitch (Larry: 110Hz, Janet: 150Hz, Mike: 90Hz)
- **Applause**: Bandpass-filtered noise (800-2000Hz)
- **Laughter**: 8 randomized bursts with sawtooth oscillators

### Streaming Configuration
- **Resolution**: 1280x720 (upscaled from 960x720 canvas)
- **Framerate**: 30fps
- **Video codec**: H.264, 2500kbps, preset: veryfast
- **Audio codec**: AAC, 128kbps, 48kHz
- **Scaling**: `flags=neighbor` for pixel-perfect upscaling
- **RTMP**: rtmp://live.twitch.tv/app/{STREAM_KEY}

### Test Mode
- **Environment variable**: `TEST_MODE=true` in .env
- **When enabled**: Only runs web server (no Puppeteer/FFmpeg/streaming)
- **Access**: http://localhost:3000/script.html
- **Resource savings**: ~90% less RAM/CPU vs streaming mode
- **Use case**: Development, testing, local iteration

## Important Constants & Limits

### API Rate Limits
- **gemini-1.5-flash**: 1,500 requests/day (CURRENT)
- **gemini-2.5-flash-lite**: 20 requests/day (AVOID - too restrictive)
- **Current usage**: ~1440 requests/day (within limits)

### Resource Usage
- **Test mode**: ~100-200MB RAM, ~5-10% CPU
- **Streaming mode**: ~1-1.5GB RAM, ~60-80% CPU
- **Bandwidth**: ~2.8 Mbps upload (~900GB/month)

### Canvas Layout
- **Canvas size**: 320x240 (scaled 3x to 960x720)
- **Character zone**: y < 130 (safe from dialogue box)
- **Dialogue box**: y=150-240
- **Location banner**: Top of screen during transitions

## Known Issues & Solutions

### Fixed Issues
1. **Character positioning** - Characters were obscured by dialogue box → Moved to y=110, max y=130
2. **Rate limits** - Hit 20/day limit → Switched from gemini-2.5-flash-lite to gemini-1.5-flash
3. **Dialogue speed** - Too fast to read → Increased delays (4500ms base + word count)
4. **Missing atmosphere** - Felt flat → Added applause/laughter at scene end
5. **Shadow artifacts** - Shadows below dialogue box → Removed character shadows
6. **Applause timing** - Started during final line → Added 2.5s delay before applause

### Current Status
- ✅ All core features implemented
- ✅ Test mode working
- ✅ Streaming infrastructure ready
- ✅ Rate limits resolved
- ✅ Timing and pacing finalized
- ⚠️ **Need to verify**: Correct Gemini model (gemini-1.5-flash) in production

## Deployment Checklist

Before going live:
- [ ] Verify server.js uses `gemini-1.5-flash` (NOT gemini-2.5-flash-lite or gemma-3-27b-it)
- [ ] Set `TEST_MODE=false` in .env
- [ ] Add valid `TWITCH_STREAM_KEY` in .env
- [ ] Test locally with `docker-compose up`
- [ ] Verify scenes generate (check logs for "GEMINI RESPONSE")
- [ ] Confirm applause timing (should play AFTER final dialogue)
- [ ] Monitor resource usage for 1 hour
- [ ] Check Twitch stream quality

## Environment Variables

```bash
GEMINI_API_KEY=your_key_here          # Required: Google AI Studio API key
PORT=3000                              # Optional: Server port (default 3000)
TWITCH_STREAM_KEY=your_key_here       # Required for streaming: Twitch stream key
TWITCH_SERVER=rtmp://...              # Optional: Custom RTMP server
TEST_MODE=true                         # Set to false for production streaming
```

## Development Workflow

```bash
# Enable test mode for development
echo "TEST_MODE=true" >> .env

# Start in test mode (no streaming)
docker-compose up -d

# View logs
docker-compose logs -f

# Access web interface
# http://localhost:3000/script.html

# Make code changes, then restart
docker-compose restart

# For production streaming
# Set TEST_MODE=false, add TWITCH_STREAM_KEY
docker-compose down
docker-compose build
docker-compose up -d
```

## Scene Generation Prompt Template

The AI generates scenes with this structure:
- 15-20 dialogue exchanges
- Seinfeld-style observational humor
- Mundane situations (toothpaste caps, grocery carts, elevator buttons, etc.)
- Character dynamics: Larry complains, Janet grounds him, Mike has absurd ideas
- Format: `CHARACTER: dialogue text`

## Future Considerations

### Potential Improvements
- Add more locations (currently: apartment, street, diner, office)
- More character expressions/animations
- Background music variations
- Scene transition effects
- Viewer interaction (Twitch chat integration)

### Scaling Considerations
- Current setup handles 1,440 scenes/day comfortably
- Could add scene caching/storage for offline replay
- May need CDN for multiple concurrent streams
- Consider backup API keys for failover

## Quick Reference

| Command | Purpose |
|---------|---------|
| `docker-compose up -d` | Start in background |
| `docker-compose logs -f` | View live logs |
| `docker-compose restart` | Apply .env changes |
| `docker-compose down` | Stop everything |
| `docker-compose build --no-cache` | Rebuild from scratch |

## Contact & Resources

- Gemini API: https://aistudio.google.com/app/apikey
- Twitch Stream Key: https://dashboard.twitch.tv/settings/stream
- Oracle Cloud: https://cloud.oracle.com/
- Twitch Ingest Servers: https://stream.twitch.tv/ingests/

---

**Last Updated**: 2025-12-21
**Status**: Development complete, ready for production deployment
**Current Mode**: TEST_MODE=true (streaming disabled)
