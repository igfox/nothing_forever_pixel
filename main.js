// Main entry point for Pixels Forever (Phaser 3 version)
// This file initializes Phaser after all dependencies are loaded

// Global game instance (accessible for controls)
let game = null;

// Catch any uncaught errors
window.addEventListener('error', (event) => {
    console.error('[MAIN ERROR] Uncaught error:', event.error?.message || event.message);
    console.error('   File:', event.filename);
    console.error('   Line:', event.lineno);
    if (event.error?.stack) {
        console.error('   Stack:', event.error.stack);
    }
});

// Initialize Phaser when DOM and fonts are ready
window.addEventListener('load', async () => {
    console.log('[GAME] Initializing Pixels Forever (Phaser 3)...');

    // Wait for Press Start 2P font to load
    console.log('⏳ Waiting for fonts to load...');
    try {
        await document.fonts.load('16px "Press Start 2P"');
        console.log('[MAIN] Press Start 2P font loaded');
    } catch (error) {
        console.warn('[MAIN WARN] Font loading failed, using fallback:', error);
    }

    // Verify scenes are loaded
    console.log('[DEBUG] Checking if scenes are loaded...');
    console.log('  - BootScene:', typeof BootScene !== 'undefined' ? 'OK' : 'MISSING');
    console.log('  - GameScene:', typeof GameScene !== 'undefined' ? 'OK' : 'MISSING');

    // Add scenes to config (they should be loaded by now)
    PHASER_CONFIG.scene = [BootScene, GameScene];

    // Use the existing canvas element for streaming compatibility
    PHASER_CONFIG.canvas = document.getElementById('canvas');

    // Create Phaser game instance
    console.log('[GAME] Creating Phaser game instance...');
    try {
        game = new Phaser.Game(PHASER_CONFIG);
        console.log('[GAME] Phaser 3 initialized');
    } catch (error) {
        console.error('[MAIN ERROR] Failed to create Phaser game:', error.message || error);
        console.error('   Stack:', error.stack);
        throw error;
    }

    // Wait for game to be ready and log renderer info
    game.events.once('ready', () => {
        const rendererName = game.renderer.type === Phaser.WEBGL
            ? 'WebGL (GPU)'
            : 'Canvas2D (CPU)';

        console.log('[STATS] Renderer:', rendererName);
        console.log('[RENDER] Resolution: 1280x720 (native)');
        console.log('[GRAPHICS] Pixel Art Mode: Enabled');
        console.log('[CONFIG] Target FPS: 30');

        // Update status display if it exists
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = '[PLAY] READY';
        }
    });

    // Check for autoplay mode (critical for streaming)
    const urlParams = new URLSearchParams(window.location.search);
    const autoplay = urlParams.get('autoplay') === 'true';

    if (autoplay) {
        console.log('[STREAM] Autoplay mode detected');
        setTimeout(() => {
            console.log('[STREAM] Triggering autoplay...');
            const playBtn = document.getElementById('playBtn');
            if (playBtn) {
                playBtn.click();
            }
        }, 2000);
    }
});

// Auto-hide controls after 3 seconds of inactivity (port from game.js)
let controlsTimeout;

document.addEventListener('mousemove', () => {
    const controls = document.getElementById('controls');
    const status = document.getElementById('status');

    if (controls) controls.style.opacity = '1';
    if (status) status.style.opacity = '1';

    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
        if (controls) controls.style.opacity = '0';
        if (status) status.style.opacity = '0';
    }, 3000);
});

// Make game instance globally accessible for controls
window.phaserGame = game;
