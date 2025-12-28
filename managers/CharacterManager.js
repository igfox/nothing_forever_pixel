// CharacterManager - Manages all characters in the scene
// Handles creation, positioning, idle movements, and actions

class CharacterManager {
    constructor(scene, audioManager = null) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.characters = {};

        // Character data from game.js (scaled for 1280x720)
        this.characterData = {
            Larry: {
                name: 'Larry',
                spriteKey: 'larry',
                color: '#4A90E2',
                hairColor: '#654321',
                skinColor: '#FFE0BD',
                shirtColor: '#2E5C8A',
                personality: 'Neurotic, observant, finds problems in everything',
                voicePitch: 0.8,
                voiceSpeed: 140,
                hasGlasses: true,
                hairStyle: 'receding',
                portraitKey: 'portrait-larry'
            },
            Janet: {
                name: 'Janet',
                spriteKey: 'janet',
                color: '#E24A4A',
                hairColor: '#1A1A1A',
                skinColor: '#C89664',
                shirtColor: '#C41E3A',
                personality: 'Sarcastic, intelligent, voice of reason',
                voicePitch: 1.2,
                voiceSpeed: 180,
                hasGlasses: false,
                hairStyle: 'curly',
                portraitKey: 'portrait-janet'
            },
            Mike: {
                name: 'Mike',
                spriteKey: 'mike',
                color: '#4AE290',
                hairColor: '#8B4513',
                skinColor: '#FFD7B5',
                shirtColor: '#5A8F4A',
                personality: 'Confident but clueless, schemes constantly',
                voicePitch: 1.0,
                voiceSpeed: 200,
                hasGlasses: false,
                hairStyle: 'wavy',
                portraitKey: 'portrait-mike'
            }
        };

        // Action pool for idle movements
        this.actionPool = ['walk_left', 'walk_right', 'pace', 'approach'];

        // Create all characters
        this.createCharacters();
    }

    /**
     * Create all three characters
     */
    createCharacters() {
        // Initial positions (apartment layout, scaled for 1280x720)
        // Original positions from game.js were for 320x192, now scaled ~4x
        // Characters positioned at y=440 (floor level in 560px game area)

        this.characters.Larry = new Character(
            this.scene,
            180,  // x position (45 * 4)
            440,  // y position (floor level)
            this.characterData.Larry
        );

        this.characters.Janet = new Character(
            this.scene,
            640,  // x position (160 * 4, center)
            500,  // y position
            this.characterData.Janet
        );

        this.characters.Mike = new Character(
            this.scene,
            1080, // x position (270 * 4)
            480,  // y position
            this.characterData.Mike
        );

        console.log('[CHARACTER] All characters created');
    }

    /**
     * Position characters for a specific location
     * Ported from game.js:1076-1106
     * @param {object} location - Location data
     */
    positionForLocation(location) {
        if (!location) return;

        const locationName = location.name.toUpperCase();

        // Position mappings (scaled from original 320x192 to 1280x720)
        const positions = {
            'APARTMENT': {
                Larry: { x: 180, y: 440 },   // (45, 110) * 4 scaled
                Janet: { x: 640, y: 500 },   // (160, 125) * 4 scaled
                Mike: { x: 1080, y: 480 }    // (270, 120) * 4 scaled
            },
            'COFFEE SHOP': {
                Larry: { x: 480, y: 500 },   // (120, 125) * 4 scaled
                Janet: { x: 640, y: 480 },   // (160, 120) * 4 scaled
                Mike: { x: 800, y: 500 }     // (200, 125) * 4 scaled
            },
            'STREET': {
                Larry: { x: 320, y: 540 },   // (80, 135) * 4 scaled
                Janet: { x: 640, y: 500 },   // (160, 125) * 4 scaled
                Mike: { x: 960, y: 540 }     // (240, 135) * 4 scaled
            },
            'HALLWAY': {
                Larry: { x: 320, y: 540 },   // (80, 135) * 4 scaled
                Janet: { x: 640, y: 540 },   // (160, 135) * 4 scaled
                Mike: { x: 960, y: 540 }     // (240, 135) * 4 scaled
            }
        };

        const locationPositions = positions[locationName] || positions['HALLWAY'];

        // Move all characters to their positions
        Object.keys(this.characters).forEach(name => {
            const pos = locationPositions[name];
            if (pos) {
                this.characters[name].moveTo(pos.x, pos.y, 1500);
            }
        });

        console.log(`[POSITION] Characters positioned for ${locationName}`);
    }

    /**
     * Perform a random action for a specific character
     * Ported from game.js:1108-1129
     * @param {string} characterName - Name of character
     * @param {string} action - Action to perform (optional, random if not specified)
     */
    performAction(characterName, action = null) {
        const character = this.characters[characterName];
        if (!character) return;

        // Use specified action or pick random
        const selectedAction = action || this.actionPool[Math.floor(Math.random() * this.actionPool.length)];

        character.performAction(selectedAction);
    }

    /**
     * Update idle movements for all characters
     * Called periodically (every 180 frames = 6 seconds at 30fps)
     * Ported from game.js:1035-1043
     */
    updateIdleMovements() {
        Object.keys(this.characters).forEach(name => {
            // 60% chance each character does something
            if (Math.random() < 0.6) {
                this.performAction(name);
            }
        });
    }

    /**
     * Set a character as speaking
     * @param {string} characterName - Name of character
     * @param {string} text - Dialogue text
     */
    setCharacterSpeaking(characterName, text) {
        const character = this.characters[characterName];
        if (!character) {
            console.warn(`[CHARACTER WARN] Character not found: ${characterName}`);
            return;
        }

        // Stop all other characters from speaking
        Object.values(this.characters).forEach(char => {
            if (char !== character) {
                char.stopSpeaking(this.audioManager);
            }
        });

        // Start this character speaking
        character.speak(text, this.audioManager);
    }

    /**
     * Stop all characters from speaking
     */
    stopAllSpeaking() {
        Object.values(this.characters).forEach(char => {
            char.stopSpeaking(this.audioManager);
        });
    }

    /**
     * Get character data by name
     * @param {string} characterName - Name of character
     * @returns {object} Character data
     */
    getCharacterData(characterName) {
        return this.characterData[characterName];
    }

    /**
     * Update method called every frame
     * @param {number} time - Current time
     * @param {number} delta - Delta time
     */
    update(time, delta) {
        // Update all character entities
        Object.values(this.characters).forEach(char => {
            if (char.update) {
                char.update(time, delta);
            }
        });
    }
}
