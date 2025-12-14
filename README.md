# Nothing Forever - Retro Pixel Edition

An AI-powered retro pixel sitcom generator inspired by Seinfeld. Watch AI-generated scenes unfold in a 16-bit style with procedurally generated dialogue, characters, and locations.

Uses Google Gemini API (free tier available!) to generate endless sitcom scenes.

## Features

- AI-generated sitcom dialogue using Google Gemini API
- Retro pixel art characters and environments
- Multiple locations (apartment, coffee shop, street, hallway)
- Dynamic character animations and movements
- Procedural background music for each location
- Character voice synthesis

## Prerequisites

**For Docker setup:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier available!)

**For Node.js setup:**
- [Node.js](https://nodejs.org/) (v14 or higher)
- [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier available!)

## Setup

### Option 1: Using Docker (Recommended - No Node.js installation needed!)

1. **Clone the repository**
   ```bash
   git clone https://github.com/igfox/nothing_forever_pixel.git
   cd nothing_forever_pixel
   ```

2. **Configure your API key**

   Copy the `.env.example` file to `.env`:
   ```bash
   copy .env.example .env
   ```

   Edit `.env` and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

   Get your FREE API key from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

3. **Start with Docker**
   ```bash
   docker-compose up
   ```

4. **Open in browser**

   Navigate to [http://localhost:3000/script.html](http://localhost:3000/script.html)

5. **To stop the server**

   Press `Ctrl+C` in the terminal, then run:
   ```bash
   docker-compose down
   ```

### Option 2: Using Node.js Directly

1. **Clone the repository**
   ```bash
   git clone https://github.com/igfox/nothing_forever_pixel.git
   cd nothing_forever_pixel
   ```

2. **Install Node.js**

   Download and install from [https://nodejs.org/](https://nodejs.org/)

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Configure your API key**

   Copy the `.env.example` file to `.env`:
   ```bash
   copy .env.example .env
   ```

   Edit `.env` and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

   Get your FREE API key from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open in browser**

   Navigate to [http://localhost:3000/script.html](http://localhost:3000/script.html)

## Usage

- Click the **▶ Play** button to start generating scenes
- Click **⏩ Skip** to generate a new scene immediately
- Click **❚❚ Pause** to stop the generation

## Project Structure

```
nothing_forever_pixel/
├── script.html      # Frontend - pixel art animation and UI
├── server.js        # Backend - handles Claude API calls
├── package.json     # Node.js dependencies
├── .env            # Environment variables (not committed)
├── .env.example    # Example environment file
└── README.md       # This file
```

## Security Note

⚠️ **Never commit your `.env` file or expose your API key!** The `.gitignore` file is configured to prevent this, but always double-check before pushing to GitHub.

## Technologies

- **Frontend**: HTML5 Canvas, JavaScript, Web Audio API
- **Backend**: Node.js, Express
- **AI**: Google Gemini API (gemini-2.5-flash-lite - free tier available!)

## License

See [LICENSE](LICENSE) file for details.

## Credits

Inspired by the "Nothing Forever" Twitch stream and classic sitcoms like Seinfeld.
