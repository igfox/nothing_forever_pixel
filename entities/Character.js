// Character Entity Class
// Manages individual character sprites, animations, and behaviors

class Character extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, characterData) {
        super(scene, x, y, characterData.spriteKey);

        // Add to scene
        scene.add.existing(this);

        // Store character data
        this.characterData = characterData;
        this.characterName = characterData.name;

        // State
        this.isSpeaking = false;
        this.targetPosition = { x, y };
        this.currentAction = 'idle';

        // Set origin to bottom-center for proper floor positioning
        this.setOrigin(0.5, 1);

        // Start with idle animation
        this.play(`${characterData.spriteKey}-idle`);

        console.log(`[CHAR] ${this.characterName} created at (${x}, ${y})`);
    }

    /**
     * Make the character start speaking
     * @param {string} text - The dialogue text
     * @param {AudioManager} audioManager - Audio manager instance (optional)
     */
    speak(text, audioManager = null) {
        if (this.isSpeaking) return;

        this.isSpeaking = true;
        this.play(`${this.characterData.spriteKey}-speak`);

        console.log(`[DIALOGUE] ${this.characterName}: ${text.substring(0, 50)}...`);

        // Trigger voice synthesis if audio manager available
        if (audioManager) {
            audioManager.playCharacterVoice(this.characterData, text);
        }
    }

    /**
     * Stop speaking and return to idle
     * @param {AudioManager} audioManager - Audio manager instance (optional)
     */
    stopSpeaking(audioManager = null) {
        if (!this.isSpeaking) return;

        this.isSpeaking = false;
        this.play(`${this.characterData.spriteKey}-idle`);

        // Stop voice synthesis if audio manager available
        if (audioManager) {
            audioManager.stopCharacterVoice();
        }
    }

    /**
     * Move character to a new position with walk animation
     * @param {number} targetX - Target X position
     * @param {number} targetY - Target Y position
     * @param {number} duration - Duration in milliseconds (default 2000)
     */
    moveTo(targetX, targetY, duration = 2000) {
        this.targetPosition = { x: targetX, y: targetY };

        // Flip sprite based on direction
        if (targetX < this.x) {
            this.setFlipX(true); // Moving left
        } else if (targetX > this.x) {
            this.setFlipX(false); // Moving right
        }

        // Play walk animation
        this.play(`${this.characterData.spriteKey}-walk`);

        // Tween to target position
        this.scene.tweens.add({
            targets: this,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                // Return to idle when movement completes
                if (!this.isSpeaking) {
                    this.play(`${this.characterData.spriteKey}-idle`);
                }
            }
        });
    }

    /**
     * Perform a character action
     * @param {string} action - Action type (walk_left, walk_right, pace, approach)
     */
    performAction(action) {
        this.currentAction = action;

        switch (action) {
            case 'walk_left':
                const leftX = Math.max(40 * 4, this.x - 40 * 4); // Min x=160 (scaled)
                this.moveTo(leftX, this.y, 1500);
                break;

            case 'walk_right':
                const rightX = Math.min(280 * 4, this.x + 40 * 4); // Max x=1120 (scaled)
                this.moveTo(rightX, this.y, 1500);
                break;

            case 'pace':
                // Random small movement after 1 second
                this.scene.time.delayedCall(1000, () => {
                    const randomX = this.x + (Math.random() * 60 - 30) * 4; // ±120px
                    this.moveTo(randomX, this.y, 1000);
                });
                break;

            case 'approach':
                // Move toward center area
                const centerX = 640 + (Math.random() * 40 - 20) * 4; // Center ±80px
                const centerY = Math.min(540, 150 * 4 + (Math.random() * 30 - 15) * 4); // ~540-600, clamped
                this.moveTo(centerX, centerY, 2000);
                break;
        }
    }

    /**
     * Trigger blink animation
     */
    blink() {
        // Play blink frame briefly
        const currentAnim = this.anims.currentAnim.key;
        this.play(`${this.characterData.spriteKey}-blink`);

        // Return to previous animation after 200ms
        this.scene.time.delayedCall(200, () => {
            this.play(currentAnim);
        });
    }

    /**
     * Update method called every frame
     * @param {number} time - Current time
     * @param {number} delta - Delta time since last frame
     */
    update(time, delta) {
        // Blink occasionally while speaking (every 40 frames at 30fps = ~1.3 seconds)
        if (this.isSpeaking && time % (40 * 33) < 33) { // 33ms per frame at 30fps
            // Blink animation is handled by animation manager
        }
    }
}
