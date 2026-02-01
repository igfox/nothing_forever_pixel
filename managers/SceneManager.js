// SceneManager - Manages scene generation, queue, and dialogue playback
// Ported from game.js:1143-1436

class SceneManager {
    constructor(scene, characterManager, audioManager, dialogueBox) {
        this.scene = scene;
        this.characterManager = characterManager;
        this.audioManager = audioManager;
        this.dialogueBox = dialogueBox;

        // Scene state
        this.sceneQueue = [];
        this.maxQueuedScenes = 2;
        this.isPreGenerating = false;
        this.isGenerating = false;
        this.isPlaying = false;
        this.sceneCount = 0;
        this.currentLocation = null;

        // Error handling and fallback
        this.consecutiveAPIErrors = 0;
        this.maxConsecutiveErrors = 3;
        this.retryDelay = 10000; // Start with 10 seconds

        // Test mode: Use pre-written 3-line scenes instead of AI generation
        // Controlled by TEST_SCENES environment variable in .env
        this.testMode = window.CONFIG?.testScenes ?? true; // Defaults to true if config not loaded

        // Scene types and locations (ported from game.js)
        this.sceneTypes = [
            "Larry complains about a minor inconvenience",
            "The group debates a ridiculous topic",
            "Someone has a scheme that will obviously backfire",
            "A mundane situation spirals out of control",
            "Two characters have an argument while one watches",
            "Someone discovers something absurd",
            "A character tries to explain something complicated"
        ];

        this.locations = [
            {
                name: "APARTMENT",
                description: "Larry's cluttered apartment",
                musicKey: 'Living with Larry.mp3'
            },
            {
                name: "COFFEE SHOP",
                description: "Local coffee shop",
                musicKey: 'Monkin around.mp3'
            },
            {
                name: "HALLWAY",
                description: "Apartment building hallway",
                musicKey: 'Whistling Down the Hallway.mp3'
            },
            {
                name: "STREET",
                description: "New York sidewalk",
                musicKey: 'The Big City.mp3'
            }
        ];

        // Test scenes (3 lines each for quick testing)
        this.testScenes = [
            {
                location: this.locations[0], // APARTMENT
                sceneText: `LARRY: Did you ever notice how the toaster always burns the last piece of bread? It's like it knows.
JANET: Maybe you should just adjust the setting.
MIKE: I solved this by eating bread raw. No toaster, no problem. Also I feel more connected to my caveman ancestors.`
            },
            {
                location: this.locations[1], // COFFEE SHOP
                sceneText: `JANET: Why is coffee so expensive here? It's just hot bean water.
LARRY: That's what I've been saying! They charge five dollars for hot bean water!
MIKE: I brought my own beans. They wouldn't let me use their hot water though. Something about health codes.`
            },
            {
                location: this.locations[2], // HALLWAY
                sceneText: `MIKE: I've been stuck in this hallway for twenty minutes. I forgot which apartment is mine.
LARRY: How do you forget where you live?
MIKE: I move around a lot. In my mind. Sometimes I think I live on a boat. Do I live on a boat?`
            },
            {
                location: this.locations[3], // STREET
                sceneText: `LARRY: The crosswalk signal changed in three seconds. THREE SECONDS! I barely made it across!
JANET: You're supposed to wait for the next one.
LARRY: Wait for the NEXT one? I have places to be! I can't spend my whole life waiting for crosswalk signals!`
            },
            {
                location: this.locations[0], // APARTMENT
                sceneText: `JANET: Your apartment smells weird. Like old socks and regret.
LARRY: That's just the ambiance. I cultivated it over years.
MIKE: I like it. It reminds me of my uncle's basement. He kept raccoons down there.`
            },
            {
                location: this.locations[1], // COFFEE SHOP
                sceneText: `MIKE: I asked for a medium coffee and they gave me a "grande." What language is that?
JANET: It's Italian. It means large.
MIKE: But I ordered a MEDIUM. Now I'm drinking a large coffee when I wanted a medium. My whole day is ruined.`
            }
        ];

        console.log(`[STREAM] SceneManager initialized (Test Mode: ${this.testMode})`);
    }

    /**
     * Handle API errors with exponential backoff and fallback
     */
    handleAPIError(errorType, errorMessage, retryCallback) {
        this.consecutiveAPIErrors++;
        console.error(`[API ERROR] ${errorType}: ${errorMessage}`);
        console.error(`[API ERROR] Consecutive errors: ${this.consecutiveAPIErrors}/${this.maxConsecutiveErrors}`);

        // After multiple failures, temporarily use test scenes as fallback
        if (this.consecutiveAPIErrors >= this.maxConsecutiveErrors) {
            console.warn('[FALLBACK] Too many API errors, temporarily using test scenes');
            console.warn('[FALLBACK] Will retry AI generation in 5 minutes');

            // Use test scene as emergency fallback
            const testScene = this.testScenes[this.sceneCount % this.testScenes.length];
            const location = testScene.location;

            this.sceneCount++;
            this.currentLocation = location;

            // Update UI
            const sceneCountEl = document.getElementById('scene-count');
            const locationNameEl = document.getElementById('location-name');
            if (sceneCountEl) sceneCountEl.textContent = this.sceneCount.toString().padStart(2, '0');
            if (locationNameEl) locationNameEl.textContent = location.name;

            // Change music and background
            if (this.audioManager) {
                this.audioManager.playBackgroundMusic(location.musicKey);
            }
            this.changeBackground(location);

            // Play the fallback scene
            this.parseAndDisplayDialogue(testScene.sceneText).then(() => {
                // Reset error counter and retry AI after delay
                setTimeout(() => {
                    console.log('[FALLBACK] Attempting to restore AI generation...');
                    this.consecutiveAPIErrors = 0;
                    this.retryDelay = 10000; // Reset retry delay
                }, 300000); // 5 minutes
            });

            return true; // Handled with fallback
        }

        // Exponential backoff: double the delay each time, up to 2 minutes
        const delay = Math.min(this.retryDelay * Math.pow(2, this.consecutiveAPIErrors - 1), 120000);
        console.log(`[RETRY] Retrying in ${delay / 1000} seconds...`);

        setTimeout(() => {
            retryCallback();
        }, delay);

        return false; // Will retry
    }

    /**
     * Reset error counter on successful API call
     */
    resetAPIErrors() {
        if (this.consecutiveAPIErrors > 0) {
            console.log('[API] Successful response, resetting error counter');
            this.consecutiveAPIErrors = 0;
            this.retryDelay = 10000;
        }
    }

    /**
     * Start scene generation and playback
     */
    start() {
        this.isPlaying = true;
        console.log('[CONTROLS] SceneManager: Starting playback');

        // Start pre-generating scenes for smooth streaming
        setTimeout(() => this.preGenerateScene(), 3000);

        // Generate first scene immediately
        this.generateScene();
    }

    /**
     * Pause scene generation
     */
    pause() {
        this.isPlaying = false;
        console.log('[CONTROLS] SceneManager: Paused');
    }

    /**
     * Skip to next scene
     */
    skip() {
        if (!this.isGenerating) {
            console.log('⏩ SceneManager: Skipping to next scene');
            this.generateScene();
        }
    }

    /**
     * Pre-generate scenes in the background for smoother streaming
     * Ported from game.js:1143-1205
     */
    async preGenerateScene() {
        if (this.isPreGenerating || this.sceneQueue.length >= this.maxQueuedScenes) return;

        this.isPreGenerating = true;
        console.log(`[TEXT] Pre-generating scene (queue: ${this.sceneQueue.length}/${this.maxQueuedScenes})...`);

        try {
            const sceneType = this.sceneTypes[Math.floor(Math.random() * this.sceneTypes.length)];
            const location = this.locations[Math.floor(Math.random() * this.locations.length)];

            const characterList = Object.entries(this.characterManager.characterData)
                .map(([name, data]) => `${name} (${data.personality})`)
                .join(', ');

            const prompt = `You are writing a Seinfeld-style sitcom scene.

Characters: ${characterList}
Location: ${location.name} - ${location.description}
Scene type: ${sceneType}

Write a LONGER comedic scene (15-20 exchanges of dialogue) for about 1 minute of runtime. Format EXACTLY as:
LARRY: dialogue text here
JANET: dialogue text here
MIKE: dialogue text here

IMPORTANT:
- Use ONLY these character names (LARRY, JANET, MIKE) in all caps
- Do not introduce other characters
- Make the dialogue substantial - each line should be 2-4 sentences
- Keep it observational, absurd, and true to character personalities
- Make it funny and conversational with good back-and-forth
- Build to a comedic peak or realization
- Ensure the conversation flows naturally with callbacks and escalation`;

            const response = await fetch('/api/generate-scene', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (response.ok) {
                const data = await response.json();
                const sceneText = data.content[0].text;

                // Success! Reset error counter
                this.resetAPIErrors();

                this.sceneQueue.push({
                    sceneText,
                    sceneType,
                    location
                });

                console.log(`[SCENE] Scene pre-generated! Queue: ${this.sceneQueue.length}/${this.maxQueuedScenes}`);

                // Keep pre-generating if queue isn't full
                if (this.sceneQueue.length < this.maxQueuedScenes && this.isPlaying) {
                    setTimeout(() => this.preGenerateScene(), 2000);
                }
            } else {
                const errorText = await response.text();
                this.handleAPIError(
                    `Pre-generation failed (${response.status})`,
                    errorText,
                    () => {
                        if (this.isPlaying && this.sceneQueue.length < this.maxQueuedScenes) {
                            this.preGenerateScene();
                        }
                    }
                );
            }
        } catch (error) {
            this.handleAPIError(
                'Pre-generation exception',
                error.message || error,
                () => {
                    if (this.isPlaying && this.sceneQueue.length < this.maxQueuedScenes) {
                        this.preGenerateScene();
                    }
                }
            );
        } finally {
            this.isPreGenerating = false;
        }
    }

    /**
     * Generate and play a scene
     * Ported from game.js:1207-1331
     */
    async generateScene() {
        if (this.isGenerating) return;

        this.isGenerating = true;

        let sceneText;
        let location, sceneType;

        // TEST MODE: Use pre-written test scenes
        if (this.testMode) {
            const testScene = this.testScenes[this.sceneCount % this.testScenes.length];
            sceneText = testScene.sceneText;
            location = testScene.location;
            sceneType = "Test Scene";
            console.log(`[TEST] Using test scene ${(this.sceneCount % this.testScenes.length) + 1}/${this.testScenes.length}`);
        } else {
            // PRODUCTION MODE: Try to use a pre-generated scene from the queue
            let sceneData = this.sceneQueue.shift();

            if (sceneData) {
                console.log(`[STREAM] Using pre-generated scene (${this.sceneQueue.length} remaining in queue)`);
                sceneText = sceneData.sceneText;
                location = sceneData.location;
                sceneType = sceneData.sceneType;

                // Start pre-generating next scene immediately
                setTimeout(() => this.preGenerateScene(), 100);
            } else {
                // No pre-generated scene available, generate on-the-fly
                console.log('[SCENE WARN] No pre-generated scene available, generating on-the-fly...');
                location = this.locations[Math.floor(Math.random() * this.locations.length)];
                sceneType = this.sceneTypes[Math.floor(Math.random() * this.sceneTypes.length)];

                // Generate scene synchronously (blocks until complete)
                try {
                    const characterList = Object.entries(this.characterManager.characterData)
                        .map(([name, data]) => `${name} (${data.personality})`)
                        .join(', ');

                    const prompt = `You are writing a Seinfeld-style sitcom scene.

Characters: ${characterList}
Location: ${location.name} - ${location.description}
Scene type: ${sceneType}

Write a LONGER comedic scene (15-20 exchanges of dialogue) for about 1 minute of runtime. Format EXACTLY as:
LARRY: dialogue text here
JANET: dialogue text here
MIKE: dialogue text here

IMPORTANT:
- Use ONLY these character names (LARRY, JANET, MIKE) in all caps
- Do not introduce other characters
- Make the dialogue substantial - each line should be 2-4 sentences
- Keep it observational, absurd, and true to character personalities
- Make it funny and conversational with good back-and-forth
- Build to a comedic peak or realization
- Ensure the conversation flows naturally with callbacks and escalation`;

                    const response = await fetch('/api/generate-scene', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        sceneText = data.content[0].text;
                        // Success! Reset error counter
                        this.resetAPIErrors();
                    } else {
                        const errorText = await response.text();
                        this.isGenerating = false;

                        // Use error handler with fallback
                        const usedFallback = this.handleAPIError(
                            `On-the-fly generation failed (${response.status})`,
                            errorText,
                            () => this.generateScene()
                        );

                        // If fallback was used, don't continue with generation
                        if (usedFallback) return;

                        // Otherwise retry is scheduled
                        return;
                    }
                } catch (error) {
                    this.isGenerating = false;

                    // Use error handler with fallback
                    const usedFallback = this.handleAPIError(
                        'On-the-fly generation exception',
                        error.message || error,
                        () => this.generateScene()
                    );

                    // If fallback was used, don't continue with generation
                    if (usedFallback) return;

                    // Otherwise retry is scheduled
                    return;
                }
            }
        }

        this.sceneCount++;
        this.currentLocation = location;

        // Update UI elements
        const sceneCountEl = document.getElementById('scene-count');
        const locationNameEl = document.getElementById('location-name');
        if (sceneCountEl) sceneCountEl.textContent = this.sceneCount.toString().padStart(2, '0');
        if (locationNameEl) locationNameEl.textContent = location.name;

        // Change music for new location
        if (this.audioManager) {
            this.audioManager.playBackgroundMusic(location.musicKey);
        }

        // Change background for new location
        this.changeBackground(location);

        // Show location banner (TODO: Implement when LocationManager is ready)
        console.log(`[POSITION] Scene ${this.sceneCount}: ${location.name} - ${location.description}`);

        // Parse and display dialogue
        await this.parseAndDisplayDialogue(sceneText);
    }

    /**
     * Change the background image for the current location
     * @param {object} location - Location data
     */
    changeBackground(location) {
        // Map location names to background texture keys
        const bgMap = {
            'APARTMENT': 'bg-apartment',
            'COFFEE SHOP': 'bg-coffee_shop',
            'HALLWAY': 'bg-hallway',
            'STREET': 'bg-street'
        };

        const textureKey = bgMap[location.name] || 'bg-apartment';

        // Update the background texture
        if (this.scene.background && this.scene.textures.exists(textureKey)) {
            this.scene.background.setTexture(textureKey);
            console.log(`[CANVAS] Background changed to ${textureKey}`);
        } else {
            console.warn(`[SCENE WARN] Background texture not found: ${textureKey}`);
        }
    }

    /**
     * Parse scene text and display dialogue line by line
     * Ported from game.js:1333-1436
     * @param {string} sceneText - Raw scene text with dialogue lines
     */
    async parseAndDisplayDialogue(sceneText) {
        const lines = sceneText.split('\n').filter(line => line.trim());
        const dialogue = [];

        const pattern = /^([A-Za-z]+):\s*(.+)$/;

        for (const line of lines) {
            const match = line.match(pattern);
            if (match) {
                const charName = match[1].toUpperCase();
                const text = match[2].trim();

                let character;
                if (charName === 'LARRY') character = 'Larry';
                else if (charName === 'JANET') character = 'Janet';
                else if (charName === 'MIKE') character = 'Mike';
                else {
                    character = 'Larry'; // Default fallback
                }

                const charData = this.characterManager.getCharacterData(character);
                dialogue.push({ character, text, color: charData.color });
            }
        }

        console.log(`[SCENE] Parsed ${dialogue.length} dialogue lines`);

        // Position characters for location
        if (this.characterManager.positionForLocation) {
            this.characterManager.positionForLocation(this.currentLocation);
        }

        // Action pool for random character movements
        const actions = ['pace', 'approach', 'walk_left', 'walk_right'];

        // Play dialogue lines sequentially
        for (let i = 0; i < dialogue.length; i++) {
            if (!this.isPlaying) {
                this.isGenerating = false;
                return;
            }

            const line = dialogue[i];
            const charData = this.characterManager.getCharacterData(line.character);

            // Set character animation to speaking
            const character = this.characterManager.characters[line.character];
            if (character) {
                character.speak(line.text); // Animation only
            }

            // Random character actions (30% chance)
            if (Math.random() > 0.7 && i > 0) {
                const randomAction = actions[Math.floor(Math.random() * actions.length)];
                this.characterManager.performAction(line.character, randomAction);
            }

            // Random reactions from other characters (20% chance)
            if (Math.random() > 0.8) {
                const otherChars = Object.keys(this.characterManager.characters).filter(n => n !== line.character);
                const reactor = otherChars[Math.floor(Math.random() * otherChars.length)];
                this.characterManager.performAction(reactor, 'approach');
            }

            // Show dialogue in DialogueBox
            await new Promise((resolve) => {
                if (this.dialogueBox) {
                    this.dialogueBox.showDialogue(
                        line.character,
                        line.text,
                        charData.portraitKey,
                        charData.color,
                        charData, // For voice synthesis
                        () => {
                            // When dialogue completes, stop speaking animation
                            if (character) {
                                character.stopSpeaking();
                            }
                            resolve();
                        }
                    );
                } else {
                    // No DialogueBox, just wait a fixed time
                    setTimeout(resolve, 5000);
                }
            });
        }

        // Stop all speaking
        this.characterManager.stopAllSpeaking();

        // Hide dialogue box
        if (this.dialogueBox) {
            this.dialogueBox.hideDialogue();
        }

        // Play applause and laughter at the end of the scene
        if (this.isPlaying && this.audioManager) {
            console.log('[EFFECT] Playing applause and laughter');
            this.audioManager.playApplauseAndLaughter();
            await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for applause
        }

        if (this.isPlaying) {
            console.log('⏳ Waiting 1s before next scene...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pause before next scene

            if (this.isPlaying) {
                this.isGenerating = false;
                this.generateScene(); // Loop to next scene
            } else {
                this.isGenerating = false;
            }
        } else {
            this.isGenerating = false;
        }
    }
}
