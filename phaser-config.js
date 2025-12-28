// Phaser 3 Configuration for Pixels Forever
// Resolution: 1280x720 native, optimized for streaming

const PHASER_CONFIG = {
    type: Phaser.CANVAS, // Use Canvas2D for headless browser compatibility
    parent: 'game-container',
    width: 1280,
    height: 720,
    backgroundColor: '#000000',

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    render: {
        pixelArt: true,          // Critical: disables smoothing for pixel-perfect rendering
        roundPixels: true,        // Prevents sub-pixel rendering
        antialias: false,         // No anti-aliasing for crisp pixels
        powerPreference: 'high-performance'
    },

    fps: {
        target: 30,              // Match original implementation
        forceSetTimeOut: true    // Consistent timing for streaming
    },

    // No physics needed - simple 2D rendering
    physics: {
        default: false
    },

    // Scene order matters - BootScene loads assets, then GameScene runs
    scene: [] // Will be populated in main.js after scenes are loaded
};

// Layout constants for viewport zones
const LAYOUT = {
    GAME_AREA_HEIGHT: 560,        // 0-560px: characters and environment
    SEPARATOR_Y: 560,             // 560-564px: green separator line
    SEPARATOR_HEIGHT: 4,
    DIALOGUE_AREA_Y: 564,         // 564-720px: dialogue box (156px height)
    DIALOGUE_AREA_HEIGHT: 156,
    TOTAL_HEIGHT: 720
};

// Character scale factor (4x from original 16x20 to 64x80)
const CHARACTER_SCALE = 4;

// Original character size in game.js
const ORIGINAL_CHAR_WIDTH = 16;
const ORIGINAL_CHAR_HEIGHT = 20;

// Scaled character size for Phaser
const CHAR_WIDTH = ORIGINAL_CHAR_WIDTH * CHARACTER_SCALE;  // 64px
const CHAR_HEIGHT = ORIGINAL_CHAR_HEIGHT * CHARACTER_SCALE; // 80px
