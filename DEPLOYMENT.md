# Deployment Guide: 24/7 Twitch Streaming

This guide will help you deploy Nothing Forever to stream 24/7 to Twitch using free Oracle Cloud hosting.

## Prerequisites

1. **Twitch Account** with streaming enabled
2. **Google Gemini API Key** (already configured in .env)
3. **Oracle Cloud Account** (free tier, requires credit card but won't charge)

## Quick Start (Local Testing)

Before deploying to Oracle Cloud, test the streaming setup locally:

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Twitch Stream Key

1. Go to [Twitch Dashboard](https://dashboard.twitch.tv/settings/stream)
2. Navigate to Settings → Stream
3. Copy your "Primary Stream Key"
4. Update `.env` file:
   ```
   TWITCH_STREAM_KEY=your_actual_stream_key_here
   ```

### 3. Test Locally

**Option A: Test with Docker (recommended)**
```bash
docker-compose build
docker-compose up
```

**Option B: Test without Docker**
```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Start the streamer (in a new terminal)
node stream.js
```

### 4. Verify Stream

1. Go to [Twitch Creator Dashboard](https://dashboard.twitch.tv/)
2. Check if your stream is live
3. Watch for a few minutes to ensure stability
4. Check console logs for any errors

## Production Deployment: Oracle Cloud Free Tier

### Step 1: Create Oracle Cloud Account

1. Go to [cloud.oracle.com](https://cloud.oracle.com)
2. Click "Sign Up" and complete registration
3. Verify your identity (requires credit card, but free tier won't charge)
4. Wait for account approval (usually instant to 24 hours)

### Step 2: Create Compute Instance

1. **Log in** to Oracle Cloud Console
2. Navigate to **Compute → Instances**
3. Click **"Create Instance"**

**Instance Configuration:**
- **Name:** `nothing-forever-stream`
- **Compartment:** (root) or create a new one
- **Availability Domain:** Any (choose closest to Twitch servers)
- **Image:**
  - Click "Change Image"
  - Select **Ubuntu 22.04** (not minimal)
  - Architecture: **ARM** (Ampere A1)
- **Shape:**
  - Click "Change Shape"
  - Select **VM.Standard.A1.Flex**
  - OCPUs: **2**
  - Memory: **12 GB**

**Networking:**
- **Virtual Cloud Network:** Create new VCN (or use existing)
- **Subnet:** Create new public subnet
- **Public IP:** Assign a public IPv4 address

**SSH Keys:**
- **Generate new key pair** (download both private and public keys)
- OR upload your existing public key

4. Click **"Create"** and wait ~2 minutes for provisioning

### Step 3: Configure Network Security

1. On the instance details page, click on the **VCN name**
2. Click **"Security Lists"** in the left sidebar
3. Click the default security list
4. Click **"Add Ingress Rules"**

**Add these rules:**

**Rule 1: SSH**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: TCP
- Destination Port: `22`
- Description: SSH access

**Rule 2: HTTP (Optional - for debugging)**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: TCP
- Destination Port: `3000`
- Description: Web interface

5. Click **"Add Ingress Rules"**

### Step 4: Connect to Instance

```bash
# On your local machine
ssh -i /path/to/private-key ubuntu@<instance-public-ip>
```

Replace:
- `/path/to/private-key` with your downloaded SSH private key
- `<instance-public-ip>` with the IP shown in Oracle Cloud Console

### Step 5: Install Dependencies on VM

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo apt install docker-compose -y

# Install Git
sudo apt install git -y

# Verify installations
docker --version
docker-compose --version
git --version
```

### Step 6: Deploy Application

```bash
# Clone your repository
git clone https://github.com/yourusername/nothing_forever_pixel.git
cd nothing_forever_pixel

# OR if uploading files directly:
# scp -i /path/to/key -r . ubuntu@<instance-ip>:~/nothing_forever_pixel
```

**Create/Update .env file:**
```bash
nano .env
```

Make sure it contains:
```
GEMINI_API_KEY=your_gemini_key_here
TWITCH_STREAM_KEY=your_twitch_stream_key_here
PORT=3000
```

Save (Ctrl+O, Enter, Ctrl+X)

### Step 7: Build and Start

```bash
# Build Docker image (this will take 5-10 minutes)
docker-compose build

# Start the services
docker-compose up -d

# View logs
docker-compose logs -f
```

**Expected output:**
```
server      | 🎬 Nothing Forever server running on http://localhost:3000
streamer    | 🚀 Initializing Twitch Streamer...
streamer    | 🌐 Launching headless browser...
streamer    | ✅ Canvas detected
streamer    | 🎬 Starting FFmpeg...
streamer    | 🎥 Starting capture and stream...
streamer    | ✅ Streaming to Twitch!
```

### Step 8: Verify Stream is Live

1. Go to [https://twitch.tv/your_channel](https://twitch.tv)
2. Your stream should be live with the pixel sitcom
3. Check stream quality and stability
4. Monitor logs: `docker-compose logs -f streamer`

### Step 9: Set Up Health Monitoring (Optional)

```bash
# Enter the container
docker-compose exec app bash

# Set up cron job for health checks
crontab -e

# Add this line (check every 5 minutes):
*/5 * * * * /app/healthcheck.sh

# Save and exit
```

## Monitoring & Management

### View Logs

```bash
# All logs
docker-compose logs -f

# Only streamer logs
docker-compose logs -f streamer

# Only server logs
docker-compose logs -f server

# Last 100 lines
docker-compose logs --tail=100
```

### Check Process Status

```bash
# Enter container
docker-compose exec app sh

# Check PM2 status
pm2 status

# View detailed info
pm2 monit
```

### Restart Services

```bash
# Restart everything
docker-compose restart

# Restart only streamer
docker-compose restart app

# Restart from inside container
docker-compose exec app pm2 restart all
```

### Stop Streaming

```bash
# Stop all services
docker-compose down

# Stop but keep data
docker-compose stop
```

## Troubleshooting

### Stream Not Starting

**Check logs:**
```bash
docker-compose logs streamer
```

**Common issues:**
1. **TWITCH_STREAM_KEY not set:** Update .env file
2. **FFmpeg not found:** Rebuild Docker image (`docker-compose build`)
3. **Canvas not loading:** Check if server is running (`docker-compose logs server`)

### Stream Keeps Disconnecting

**Check network:**
```bash
ping twitch.tv
```

**Check resource usage:**
```bash
docker stats
```

**If memory is high:**
- Restart: `docker-compose restart`
- Check for memory leaks in logs

### Poor Stream Quality

**Adjust bitrate in stream.js:**
```javascript
videoBitrate: '1500k',  // Lower from 2500k
```

**Or reduce FPS:**
```javascript
fps: 24,  // Lower from 30
```

Then rebuild: `docker-compose down && docker-compose build && docker-compose up -d`

### Gemini API Rate Limiting

**Error:** "429 Too Many Requests"

**Solution:** The code already has retry logic. If persistent:
1. Check API quota at [Google AI Studio](https://aistudio.google.com)
2. Reduce scene generation frequency (increase wait time in game.js)

## Cost Monitoring

### Oracle Cloud Free Tier Limits

**✅ Always Free Resources Used:**
- Compute: 2 OCPUs (ARM) = **FREE**
- Memory: 12 GB = **FREE**
- Storage: 50 GB boot volume = **FREE** (within 200GB limit)
- Bandwidth: ~900 GB/month = **FREE** (within 10TB limit)

**Total Cost: $0/month**

### Check Usage

1. Go to Oracle Cloud Console
2. Navigate to **Governance → Cost Analysis**
3. Verify you're within free tier limits

## Updating the Code

```bash
# SSH into Oracle Cloud instance
ssh -i /path/to/key ubuntu@<instance-ip>

cd nothing_forever_pixel

# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

## Performance Optimization

### Current Resource Usage (Expected)

- **CPU:** 60-80% of 2 cores
- **RAM:** 1-1.5 GB
- **Network:** ~2.8 Mbps upload
- **Storage:** <1 GB (with log rotation)

### If Resources Are Constrained

**1. Lower video quality:**
Edit `stream.js`:
```javascript
outputWidth: 960,   // Down from 1280
outputHeight: 540,  // Down from 720
videoBitrate: '1500k',  // Down from 2500k
```

**2. Enable log rotation:**
```bash
docker-compose exec app sh
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 3
```

**3. Disable health checks:**
Remove cron job if it's consuming resources unnecessarily.

## Security Best Practices

1. **Never commit .env to Git:**
   - Already in .gitignore
   - Keep API keys and stream keys private

2. **Restrict SSH access:**
   - Update Oracle Cloud security list to allow SSH only from your IP
   - Use SSH key authentication (already configured)

3. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Monitor logs for suspicious activity:**
   ```bash
   docker-compose logs | grep -i error
   ```

## Backup & Recovery

### Backup Configuration

```bash
# On your local machine
scp -i /path/to/key ubuntu@<instance-ip>:~/nothing_forever_pixel/.env ./backup.env
```

### Recreate Instance

If instance fails:
1. Create new Oracle Cloud instance (follow Step 2-6)
2. Restore .env file
3. Redeploy with docker-compose

## Support & Resources

- **Twitch Stream Manager:** https://dashboard.twitch.tv/
- **Oracle Cloud Console:** https://cloud.oracle.com
- **Google Gemini API:** https://aistudio.google.com/
- **FFmpeg Documentation:** https://ffmpeg.org/documentation.html
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/

## Success Checklist

- [ ] Oracle Cloud instance created and running
- [ ] SSH access working
- [ ] Docker and dependencies installed
- [ ] Application deployed with docker-compose
- [ ] Twitch stream is live
- [ ] Stream quality is acceptable (720p, 30fps)
- [ ] No errors in logs for 10+ minutes
- [ ] Auto-restart working (test by killing process: `pm2 kill` inside container)
- [ ] Health monitoring set up (optional)
- [ ] Resource usage within limits (~70% CPU, ~1.5GB RAM)

## Next Steps

Once your stream is stable:

1. **Set stream title/category** on Twitch Dashboard
2. **Add stream overlays** (optional - edit script.html)
3. **Monitor viewer engagement** and adjust content if needed
4. **Schedule regular updates** for dependencies
5. **Consider backup streaming key** for redundancy

---

**🎬 Enjoy your 24/7 AI sitcom stream!**

For issues or questions, check the logs first:
```bash
docker-compose logs -f
```
