// BootScene - Asset Loading
// Loads all sprites, backgrounds, and portraits before starting the game

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        console.log('[BUFFER] BootScene: Loading assets...');

        // Update status display
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Loading assets...';
        }

        // Load character sprite sheets
        this.load.spritesheet('larry', 'assets/sprites/larry.png', {
            frameWidth: CHAR_WIDTH,  // 64
            frameHeight: CHAR_HEIGHT // 80
        });

        this.load.spritesheet('janet', 'assets/sprites/janet.png', {
            frameWidth: CHAR_WIDTH,
            frameHeight: CHAR_HEIGHT
        });

        this.load.spritesheet('mike', 'assets/sprites/mike.png', {
            frameWidth: CHAR_WIDTH,
            frameHeight: CHAR_HEIGHT
        });

        // Load background images
        this.load.image('bg-apartment', 'assets/backgrounds/apartment.png');
        this.load.image('bg-coffee_shop', 'assets/backgrounds/coffee_shop.png');
        this.load.image('bg-street', 'assets/backgrounds/street.png');
        this.load.image('bg-hallway', 'assets/backgrounds/hallway.png');

        // Load portrait images
        this.load.image('portrait-larry', 'portraits/Larry.jpg');
        this.load.image('portrait-janet', 'portraits/Janet.jpg');
        this.load.image('portrait-mike', 'portraits/Mike.jpg');

        console.log('[BUFFER] Loading character sprites and backgrounds...');
    }


    create() {
        console.log('[BOOT] BootScene: Assets loaded');

        // Create animations for all characters
        this.createCharacterAnimations();

        // Update status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Assets loaded';
        }

        // Start the main game scene
        this.scene.start('GameScene');
    }

    createCharacterAnimations() {
        // Create animations for all three characters
        const characters = ['larry', 'janet', 'mike'];

        characters.forEach(char => {
            // Idle animation (frame 0)
            this.anims.create({
                key: `${char}-idle`,
                frames: [{ key: char, frame: 0 }],
                frameRate: 1,
                repeat: -1
            });

            // Walk animation (frames 1-4)
            this.anims.create({
                key: `${char}-walk`,
                frames: this.anims.generateFrameNumbers(char, { start: 1, end: 4 }),
                frameRate: 8,
                repeat: -1
            });

            // Speak animation (frames 5-6)
            this.anims.create({
                key: `${char}-speak`,
                frames: this.anims.generateFrameNumbers(char, { start: 5, end: 6 }),
                frameRate: 4,
                repeat: -1
            });

            // Blink animation (frame 7)
            this.anims.create({
                key: `${char}-blink`,
                frames: [{ key: char, frame: 7 }],
                frameRate: 1
            });
        });

        console.log('[BOOT] Character animations created for Larry, Janet, and Mike');
    }
}
