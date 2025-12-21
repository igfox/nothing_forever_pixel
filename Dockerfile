# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory in container
WORKDIR /app

# Install Chromium, FFmpeg, PulseAudio, and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ffmpeg \
    bash \
    pulseaudio \
    pulseaudio-utils \
    alsa-plugins-pulse

# Set Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install PM2 globally
RUN npm install -g pm2

# Copy the rest of the application
COPY . .

# Create logs directory
RUN mkdir -p logs

# Make healthcheck script executable
RUN chmod +x healthcheck.sh

# Expose port 3000
EXPOSE 3000

# Start with PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
