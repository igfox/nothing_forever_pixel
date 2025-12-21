#!/bin/bash

# Health check script for Nothing Forever Twitch Stream
# This script checks if PM2 processes are running and restarts them if needed
# Add to crontab: */5 * * * * /app/healthcheck.sh

LOG_FILE="/app/logs/healthcheck.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create logs directory if it doesn't exist
mkdir -p /app/logs

echo "[$TIMESTAMP] Running health check..." >> "$LOG_FILE"

# Check if PM2 is running
if ! command -v pm2 &> /dev/null; then
    echo "[$TIMESTAMP] ERROR: PM2 not found" >> "$LOG_FILE"
    exit 1
fi

# Check PM2 process status
PM2_STATUS=$(pm2 status 2>&1)

if echo "$PM2_STATUS" | grep -q "online"; then
    echo "[$TIMESTAMP] ✅ Processes are running" >> "$LOG_FILE"

    # Count online processes
    ONLINE_COUNT=$(echo "$PM2_STATUS" | grep -c "online")
    echo "[$TIMESTAMP] Online processes: $ONLINE_COUNT" >> "$LOG_FILE"

    # Expected: 2 processes (server + streamer)
    if [ "$ONLINE_COUNT" -lt 2 ]; then
        echo "[$TIMESTAMP] ⚠️  Warning: Only $ONLINE_COUNT processes online (expected 2)" >> "$LOG_FILE"
        echo "[$TIMESTAMP] Attempting to resurrect processes..." >> "$LOG_FILE"
        pm2 resurrect >> "$LOG_FILE" 2>&1
    fi
else
    echo "[$TIMESTAMP] ❌ No processes are online. Starting ecosystem..." >> "$LOG_FILE"

    # Try to resurrect first
    pm2 resurrect >> "$LOG_FILE" 2>&1

    # If resurrection fails, start fresh
    if ! echo "$(pm2 status 2>&1)" | grep -q "online"; then
        echo "[$TIMESTAMP] Resurrection failed. Starting from ecosystem.config.js..." >> "$LOG_FILE"
        cd /app && pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1
    fi
fi

# Check memory usage
MEM_USAGE=$(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
echo "[$TIMESTAMP] Memory usage: $MEM_USAGE" >> "$LOG_FILE"

# Keep log file size manageable (keep last 1000 lines)
tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"

exit 0
