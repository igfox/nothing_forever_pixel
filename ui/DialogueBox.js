// DialogueBox - Displays character dialogue with portrait and scrolling text
// Ported from game.js:179-1001
// Position: y=564-720 (156px height in dialogue area)

class DialogueBox extends Phaser.GameObjects.Container {
    constructor(scene, audioManager = null) {
        super(scene, 0, LAYOUT.DIALOGUE_AREA_Y);

        // Add to scene
        scene.add.existing(this);

        // Audio manager for typewriter sound effects
        this.audioManager = audioManager;

        // Dialogue state
        this.text = '';
        this.speakerName = '';
        this.speakerColor = '#FFFFFF';
        this.portraitKey = null;
        this.characterData = null; // Store for voice synthesis
        this.visible = false;

        // Pagination state (replaces scrolling)
        this.currentPage = 0;
        this.totalPages = 0;
        this.pageComplete = false;
        this.onComplete = null; // Callback when all pages displayed
        this.displayTimers = []; // Track active timers for cleanup

        // Typewriter effect state
        this.typewriterSpeed = 30; // ms per character (Earthbound-style)
        this.revealedText = ['', '', '']; // Revealed text for each line
        this.typewriterActive = false;

        // Timing model: 5 seconds per line of content
        // - Each page shows up to 3 lines for 15 seconds (3 * 5s)
        // - Typewriter effect reveals text gradually, then progress wheel shows remaining time
        // - Long text broken into multiple pages displayed sequentially

        // Text layout
        this.lineHeight = 36; // 12px * 3 for scaling
        this.maxVisibleLines = 3; // Lines per page
        this.wrappedLines = [];

        // Create UI components
        this.createBackground();
        this.createPortraitBox();
        this.createTextElements();
        this.createProgressIndicator();

        // Start hidden
        this.setVisible(false);

        console.log('[TEXT] DialogueBox created');
    }

    /**
     * Create background and border
     */
    createBackground() {
        // Black background (1280x156)
        this.background = this.scene.add.rectangle(
            640, 78, // Center of 156px height area
            1280, 156,
            0x000000,
            0.95
        );
        this.add(this.background);

        // Green border
        const border = this.scene.add.graphics();
        border.lineStyle(4, 0x00ff00);
        border.strokeRect(4, 4, 1272, 148);
        this.add(border);
    }

    /**
     * Create portrait box on left side
     */
    createPortraitBox() {
        this.portraitSize = 120; // Store as instance variable for use in showDialogue()
        const portraitX = 70;
        const portraitY = 78; // Center of dialogue area

        // Portrait border (green)
        const portraitBorder = this.scene.add.graphics();
        portraitBorder.lineStyle(2, 0x00ff00);
        portraitBorder.strokeRect(
            portraitX - this.portraitSize/2,
            portraitY - this.portraitSize/2,
            this.portraitSize,
            this.portraitSize
        );
        this.add(portraitBorder);

        // Portrait image (will be set when dialogue shows)
        this.portraitImage = this.scene.add.image(portraitX, portraitY, '');
        this.portraitImage.setVisible(false);
        this.add(this.portraitImage);
    }

    /**
     * Create text elements (name and dialogue)
     */
    createTextElements() {
        const textX = 150; // Right of portrait

        // === CHARACTER NAME (y=10) ===
        const nameY = 10;
        this.nameText = this.scene.add.text(textX, nameY, '', {
            fontFamily: 'Fira Code',
            fontSize: '36px',
            color: '#FFFFFF'
        });
        this.add(this.nameText);

        // === DIALOGUE TEXT AREA (y=50, shows 3 lines max) ===
        this.textX = textX;
        this.textY = 50;
        this.textWidth = 1120; // 1280 - 150 (left margin) - 10 (right margin)

        // Create text objects for max visible lines (3)
        this.textLines = [];
        for (let i = 0; i < this.maxVisibleLines; i++) {
            const y = this.textY + (i * this.lineHeight);
            const lineText = this.scene.add.text(this.textX, y, '', {
                fontFamily: 'Fira Code',
                fontSize: '24px',
                color: '#FFFFFF'
            });
            lineText.setVisible(false);
            this.add(lineText);
            this.textLines.push(lineText);
        }
    }

    /**
     * Create progress indicator
     */
    createProgressIndicator() {
        // Progress wheel shows timing for current page
        this.progressWheel = this.scene.add.graphics();
        this.progressWheel.setVisible(false);
        this.add(this.progressWheel);
        this.progressWheelX = 1240;
        this.progressWheelY = 130;
        this.progressWheelRadius = 12;
        this.progressPercent = 0;
    }

    /**
     * Show dialogue for a character
     * @param {string} characterName - Name of speaking character
     * @param {string} text - Dialogue text
     * @param {string} portraitKey - Portrait image key
     * @param {string} color - Character color
     * @param {object} characterData - Full character data for voice synthesis
     * @param {function} onComplete - Callback when dialogue display completes
     */
    showDialogue(characterName, text, portraitKey, color = '#FFFFFF', characterData = null, onComplete = null) {
        // Clear any existing timers
        this.clearTimers();

        this.speakerName = characterName;
        this.text = text;
        this.portraitKey = portraitKey;
        this.speakerColor = color;
        this.characterData = characterData; // Store for voice blips
        this.onComplete = onComplete;

        // Set character name with color
        this.nameText.setText(`${characterName}:`);
        this.nameText.setColor(color);

        // Set portrait
        if (portraitKey && this.scene.textures.exists(portraitKey)) {
            this.portraitImage.setTexture(portraitKey);
            // CRITICAL: Must call setDisplaySize AFTER setTexture, otherwise it gets reset
            this.portraitImage.setDisplaySize(this.portraitSize - 4, this.portraitSize - 4);
            this.portraitImage.setVisible(true);
        } else {
            this.portraitImage.setVisible(false);
        }

        // Wrap text
        this.wrapText(text);

        // Calculate pagination
        this.totalPages = Math.ceil(this.wrappedLines.length / this.maxVisibleLines);
        this.currentPage = 0;
        this.pageComplete = false;

        // Show dialogue box
        this.setVisible(true);

        // Show first page
        this.showPage(0);

        console.log(`[TEXT] Showing dialogue: ${characterName} (${this.wrappedLines.length} lines, ${this.totalPages} pages)`);
    }

    /**
     * Hide dialogue box
     */
    hideDialogue() {
        this.clearTimers();
        this.setVisible(false);
        this.pageComplete = false;
        this.typewriterActive = false;

        // Hide all text lines
        this.textLines.forEach(line => line.setVisible(false));
    }

    /**
     * Clear all active timers (both setTimeout and setInterval)
     */
    clearTimers() {
        this.displayTimers.forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        this.displayTimers = [];
        this.progressWheel.setVisible(false);
    }

    /**
     * Show a specific page of dialogue
     * @param {number} pageIndex - Page to display (0-based)
     */
    showPage(pageIndex) {
        this.currentPage = pageIndex;

        // Calculate line range for this page
        const startLine = pageIndex * this.maxVisibleLines;
        const endLine = Math.min(startLine + this.maxVisibleLines, this.wrappedLines.length);
        const linesOnPage = endLine - startLine;

        // Get full text for each line on this page
        const pageLines = [];
        for (let i = 0; i < this.maxVisibleLines; i++) {
            const lineIndex = startLine + i;
            if (lineIndex < this.wrappedLines.length && lineIndex < endLine) {
                pageLines.push(this.wrappedLines[lineIndex]);
            } else {
                pageLines.push('');
            }
        }

        // Total display time: 5s per line
        const displayTime = linesOnPage * 5000;

        console.log(`[PAGE] Page ${pageIndex + 1}/${this.totalPages}: ${linesOnPage} lines for ${displayTime}ms`);

        // Start typewriter effect
        this.startTypewriter(pageLines, displayTime, () => {
            // After this page completes, show next page or finish
            if (pageIndex + 1 < this.totalPages) {
                this.showPage(pageIndex + 1);
            } else {
                this.fireComplete();
            }
        });
    }

    /**
     * Start typewriter effect for page lines
     * @param {Array<string>} pageLines - Lines to display (max 3)
     * @param {number} totalDisplayTime - Total time for this page (ms)
     * @param {function} onComplete - Callback when page completes
     */
    startTypewriter(pageLines, totalDisplayTime, onComplete = null) {
        // Reset revealed text
        this.revealedText = ['', '', ''];
        this.typewriterActive = true;

        // Calculate total characters to reveal
        let totalChars = 0;
        pageLines.forEach(line => totalChars += line.length);

        // Calculate typewriter duration
        const typewriterDuration = totalChars * this.typewriterSpeed;

        // If typewriter takes longer than display time, speed it up
        const actualSpeed = typewriterDuration > totalDisplayTime * 0.7
            ? Math.floor((totalDisplayTime * 0.7) / totalChars)
            : this.typewriterSpeed;

        console.log(`[TYPEWRITER] Typewriter: ${totalChars} chars at ${actualSpeed}ms/char = ${totalChars * actualSpeed}ms`);

        // Character reveal state
        let currentLine = 0;
        let currentChar = 0;
        let blipCounter = 0; // Counter for alternating blips
        let blipEvery = 3;

        // Show text lines (initially empty)
        for (let i = 0; i < this.maxVisibleLines; i++) {
            this.textLines[i].setText('');
            this.textLines[i].setVisible(pageLines[i].length > 0);
        }

        // Typewriter interval
        const typewriterInterval = setInterval(() => {
            // Find next character to reveal
            while (currentLine < pageLines.length && currentChar >= pageLines[currentLine].length) {
                currentLine++;
                currentChar = 0;
            }

            // Check if we're done
            if (currentLine >= pageLines.length || currentLine >= this.maxVisibleLines) {
                clearInterval(typewriterInterval);
                this.typewriterActive = false;

                // Give user 2s to finish reading after typewriter completes
                const pauseTime = 2000;

                console.log(`[TYPEWRITER] Typewriter complete (${totalChars * actualSpeed}ms), pausing for ${pauseTime}ms`);

                // Show progress wheel for pause time
                this.showProgressWheel(pauseTime, onComplete);
                return;
            }

            // Reveal next character
            const char = pageLines[currentLine][currentChar];
            this.revealedText[currentLine] += char;
            this.textLines[currentLine].setText(this.revealedText[currentLine]);

            // Play voice blip for every other non-whitespace character
            if (this.audioManager && this.characterData && char.trim() !== '') {
                if (blipCounter % blipEvery === 0) {
                    this.audioManager.playCharacterBlip(this.characterData);
                }
                blipCounter++;
            }

            currentChar++;
        }, actualSpeed);

        this.displayTimers.push(typewriterInterval);
    }

    /**
     * Show and animate progress wheel for specified duration
     * @param {number} duration - Duration in milliseconds
     * @param {function} onComplete - Callback when complete
     */
    showProgressWheel(duration, onComplete = null) {
        this.progressWheel.setVisible(true);
        this.updateProgressWheel(0);

        const startTime = Date.now();
        const updateInterval = 33; // ~30fps

        // Animate progress
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const percent = Math.min(elapsed / duration, 1);
            this.updateProgressWheel(percent);

            if (percent >= 1) {
                clearInterval(progressInterval);
                this.progressWheel.setVisible(false);
                if (onComplete) {
                    onComplete();
                }
            }
        }, updateInterval);

        // Store interval for cleanup
        this.displayTimers.push(progressInterval);
    }

    /**
     * Fire completion callback (all pages displayed)
     */
    fireComplete() {
        console.log('[DIALOGUE] Dialogue display complete');
        this.pageComplete = true;
        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Wrap text into lines
     * Ported from game.js:814-841
     * @param {string} text - Text to wrap
     */
    wrapText(text) {
        this.wrappedLines = [];

        const words = text.split(' ');
        let currentLine = '';

        // Create temporary text object for measurement
        // IMPORTANT: Must match the actual text style used in createTextElements()
        const tempText = this.scene.add.text(0, 0, '', {
            fontFamily: 'Fira Code',
            fontSize: '24px'
        });

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            tempText.setText(testLine);

            if (tempText.width > this.textWidth) {
                if (currentLine) {
                    this.wrappedLines.push(currentLine);
                    currentLine = word;
                } else {
                    // Word is too long, add it anyway
                    this.wrappedLines.push(word);
                    currentLine = '';
                }
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            this.wrappedLines.push(currentLine);
        }

        tempText.destroy();
    }


    /**
     * Update progress wheel
     * @param {number} percent - Progress from 0 to 1
     */
    updateProgressWheel(percent) {
        this.progressPercent = percent;
        this.progressWheel.clear();

        // Draw background circle
        this.progressWheel.lineStyle(2, 0x00ff00, 0.3);
        this.progressWheel.strokeCircle(this.progressWheelX, this.progressWheelY, this.progressWheelRadius);

        // Draw progress arc
        if (percent > 0) {
            this.progressWheel.lineStyle(3, 0x00ff00, 1);
            this.progressWheel.beginPath();
            this.progressWheel.arc(
                this.progressWheelX,
                this.progressWheelY,
                this.progressWheelRadius,
                Phaser.Math.DegToRad(-90), // Start at top
                Phaser.Math.DegToRad(-90 + (360 * percent)), // Sweep clockwise
                false
            );
            this.progressWheel.strokePath();
        }
    }

    /**
     * Update method - no longer needed with pagination
     * Kept for compatibility with GameScene.update() call
     */
    update() {
        // Pagination handles everything with timers, no per-frame updates needed
    }
}
