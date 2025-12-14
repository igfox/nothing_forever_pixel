# Nothing Forever - Retro Pixel Edition

An AI-powered retro pixel sitcom generator inspired by Seinfeld. Watch AI-generated scenes unfold in a 16-bit style with procedurally generated dialogue, characters, and locations.

## Features

- AI-generated sitcom dialogue using Claude API
- Retro pixel art characters and environments
- Multiple locations (apartment, coffee shop, street, hallway)
- Dynamic character animations and movements
- Procedural background music for each location
- Character voice synthesis

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Anthropic API key](https://console.anthropic.com/)

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/igfox/nothing_forever_pixel.git
   cd nothing_forever_pixel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your API key**

   Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

   Get your API key from [https://console.anthropic.com/](https://console.anthropic.com/)

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**

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
- **AI**: Anthropic Claude API (Sonnet 4)

## License

See [LICENSE](LICENSE) file for details.

## Credits

Inspired by the "Nothing Forever" Twitch stream and classic sitcoms like Seinfeld.
