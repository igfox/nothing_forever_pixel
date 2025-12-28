// GameScene - Main Game Loop
// Coordinates all managers and handles the core game flow

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Core managers (will be initialized in create())
        this.characterManager = null;
        this.audioManager = null;
        this.sceneManager = null;
        this.locationManager = null;
        this.dialogueBox = null;

        // Playback state
        this.isPlaying = false;

        // Frame counter for idle movements
        this.frameCount = 0;

        // Phase 0 Diagnostic: FPS monitoring
        this.diagnosticFrameCount = 0;
        this.diagnosticLastTime = 0;
    }

    create() {
        console.log('[GAME] GameScene: Creating game world...');

        // Add background
        this.createBackground();

        // Draw separator line
        this.createSeparator();

        // Initialize managers (Phase 3-7)
        this.audioManager = new AudioManager();
        this.characterManager = new CharacterManager(this, this.audioManager);
        this.dialogueBox = new DialogueBox(this, this.audioManager);
        this.add.existing(this.dialogueBox);

        // SceneManager must be created after DialogueBox (Phase 5)
        this.sceneManager = new SceneManager(this, this.characterManager, this.audioManager, this.dialogueBox);

        // this.locationManager = new LocationManager(this, this.audioManager); // Phase 7

        // Wire up UI controls
        this.setupControls();

        console.log('[GAME] GameScene: Ready');
    }

    createBackground() {
        // Add apartment background (default starting location)
        this.background = this.add.image(640, LAYOUT.GAME_AREA_HEIGHT / 2, 'bg-apartment');
        console.log('[VISUAL] Apartment background loaded');
    }

    createSeparator() {
        // Draw green separator line between game area and dialogue area
        const separator = this.add.graphics();
        separator.lineStyle(LAYOUT.SEPARATOR_HEIGHT, 0x00ff00);
        separator.beginPath();
        separator.moveTo(0, LAYOUT.SEPARATOR_Y + LAYOUT.SEPARATOR_HEIGHT / 2);
        separator.lineTo(1280, LAYOUT.SEPARATOR_Y + LAYOUT.SEPARATOR_HEIGHT / 2);
        separator.strokePath();

        console.log(`[GRAPHICS] Separator created at y=${LAYOUT.SEPARATOR_Y}`);
    }

    setupControls() {
        // Play button
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.startPlayback());
        }

        // Pause button
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pausePlayback());
        }

        // Skip button
        const skipBtn = document.getElementById('skipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipScene());
        }

        console.log('[GAME] Controls wired up');
    }

    async startPlayback() {
        console.log('[CONTROLS] Starting playback...');

        this.isPlaying = true;

        // Update UI
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const statusEl = document.getElementById('status');

        if (playBtn) playBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        if (statusEl) statusEl.textContent = '[PLAY] LIVE';

        // Initialize AudioContext (required for Web Audio API)
        if (this.audioManager) {
            await this.audioManager.initAudioContext();
        }

        // Start background music (apartment theme)
        if (this.audioManager) {
            this.audioManager.playBackgroundMusic('Living with Larry.mp3');
        }

        // Start AI scene generation (Phase 5)
        if (this.sceneManager) {
            this.sceneManager.start();
        }

        console.log('[GAME] Playback started with AI scene generation');
    }

    pausePlayback() {
        console.log('[CONTROLS] Pausing playback...');

        this.isPlaying = false;

        // Update UI
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const statusEl = document.getElementById('status');

        if (playBtn) playBtn.style.display = 'inline-block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (statusEl) statusEl.textContent = '◼ PAUSED';

        // Pause scene manager
        if (this.sceneManager) {
            this.sceneManager.pause();
        }

        // Stop audio
        if (this.audioManager) {
            this.audioManager.stopBackgroundMusic();
            this.audioManager.setPlaying(false);
        }

        // Stop characters speaking
        if (this.characterManager) {
            this.characterManager.stopAllSpeaking();
        }
    }

    skipScene() {
        console.log('[CONTROLS] Skipping scene...');

        // Skip to next scene (Phase 5)
        if (this.sceneManager) {
            this.sceneManager.skip();
        }
    }

    playTestDialogue() {
        // Test dialogue sequence with varying lengths and all three characters
        const testLines = [
            {
                character: 'Larry',
                text: 'Did you ever notice how sprite sheets are so much better than procedural rendering?'
            },
            {
                character: 'Janet',
                text: 'Here we go again.'
            },
            {
                character: 'Larry',
                text: 'No, seriously! Think about it. With procedural rendering, you have to redraw every single pixel every single frame. That\'s like repainting your entire apartment just because you moved a lamp. Who does that? Nobody does that!'
            },
            {
                character: 'Mike',
                text: 'I repaint my apartment every day. Keeps the colors fresh. The paint fumes are a bonus - they help me think outside the box. Sometimes I think so far outside the box that I forget where the box even is. Then I paint the box. Then I move the box. Then I forget where I moved it. It\'s a whole system.'
            },
            {
                character: 'Janet',
                text: 'That explains so much about you.'
            },
            {
                character: 'Larry',
                text: 'See, this is exactly what I\'m talking about! With sprites, you just move the image around. It\'s efficient. It\'s elegant. It\'s the way nature intended pixels to behave. You don\'t see atoms redrawing themselves every nanosecond, do you? No! They just move around. Sprites are the atoms of video games. And if sprites are atoms, then sprite sheets are molecules. And animations are chemical reactions. This is basic science, people!'
            },
            {
                character: 'Mike',
                text: 'I once tried to make a sprite sheet out of actual atoms. Didn\'t work. Turns out atoms are really small. Also they don\'t hold still for the camera. Very unprofessional. I gave them all one-star reviews on Yelp.'
            },
            {
                character: 'Janet',
                text: 'You reviewed... atoms... on Yelp.'
            },
            {
                character: 'Mike',
                text: 'Electrons were the worst. Always moving around, never where you expect them to be. Protons were okay. Neutrons? Totally neutral about the whole experience. Hence the name, I assume.'
            }
        ];

        // Start dialogue sequence with initial delay
        setTimeout(() => {
            this.playDialogueLine(testLines, 0);
        }, 2000);
    }

    /**
     * Play a single dialogue line, then chain to the next
     * Uses event-based timing from DialogueBox completion callbacks
     */
    playDialogueLine(lines, index) {
        if (index >= lines.length) {
            // Sequence complete
            if (this.dialogueBox) {
                this.dialogueBox.hideDialogue();
            }
            this.characterManager.stopAllSpeaking();
            console.log('[GAME] Test dialogue sequence complete');
            return;
        }

        const line = lines[index];
        const charData = this.characterManager.getCharacterData(line.character);

        // Set character animation to speaking (DialogueBox will handle voice via typewriter)
        const character = this.characterManager.characters[line.character];
        if (character) {
            character.speak(line.text); // Animation only, no audio manager passed
        }

        // Show in dialogue box with completion callback
        if (this.dialogueBox) {
            this.dialogueBox.showDialogue(
                line.character,
                line.text,
                charData.portraitKey,
                charData.color,
                charData, // Pass full character data for voice synthesis
                () => {
                    // When this line completes, stop speaking animation and play next line
                    if (character) {
                        character.stopSpeaking();
                    }
                    this.playDialogueLine(lines, index + 1);
                }
            );
        }
    }

    update(time, delta) {
        // Frame counter for idle movements (every 180 frames = 6 seconds at 30fps)
        this.frameCount++;

        // Phase 0 Diagnostic: FPS monitoring (every 2 seconds)
        this.diagnosticFrameCount++;
        if (this.diagnosticLastTime === 0) {
            this.diagnosticLastTime = performance.now();
        }
        const elapsed = performance.now() - this.diagnosticLastTime;
        if (elapsed >= 2000) { // Every 2 seconds
            const actualFPS = (this.diagnosticFrameCount / (elapsed / 1000)).toFixed(2);
            console.log(`[GAME] Actual Phaser FPS: ${actualFPS}`);
            this.diagnosticFrameCount = 0;
            this.diagnosticLastTime = performance.now();
        }

        // Update character manager
        if (this.characterManager) {
            this.characterManager.update(time, delta);
        }

        // Update dialogue box scrolling
        if (this.dialogueBox) {
            this.dialogueBox.update();
        }

        // Idle character movements
        if (this.isPlaying && this.frameCount % 180 === 0 && this.characterManager) {
            this.characterManager.updateIdleMovements();
        }
    }
}
