# Pixels Forever - Project Memory
- node/npm is not installed directly on this computer, it is run through docker
- do not use 'Press Start 2P' font, it seems like a system font is required to scale correctly

## Project Overview
**Pixels Forever** is an AI-powered retro pixel art sitcom that streams 24/7 to Twitch. It generates endless Seinfeld-style dialogue using Google's Gemini API and renders it in a nostalgic 16-bit aesthetic with procedurally generated music and voice synthesis.


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
