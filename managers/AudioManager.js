// AudioManager - Handles all audio: voice synthesis, music, and effects
// Ported from game.js:154-423
// CRITICAL: Keep Web Audio API approach - proven to work with streaming

class AudioManager {
    constructor() {
        // Audio context (will be initialized on first play)
        this.audioContext = null;
        this.audioUnlocked = false; // Track if audio is unlocked by user gesture

        // Voice synthesis
        this.currentVoiceInterval = null;
        this.currentSpeaker = null;
        this.isPlaying = false;

        // Background music
        this.backgroundMusic = null;
        this.musicSource = null;
        this.musicGainNode = null;

        console.log('[AUDIO] AudioManager initialized (AudioContext will start on user interaction)');

        // Set up audio unlock on first user interaction
        this.setupAudioUnlock();
    }

    /**
     * Set up audio unlock on first real user interaction
     * Required for browser autoplay policies - programmatic clicks don't count
     */
    setupAudioUnlock() {
        const unlockAudio = async () => {
            if (this.audioUnlocked) return;

            console.log('[USER] User interaction detected, attempting to unlock audio...');

            if (this.audioContext) {
                try {
                    await this.audioContext.resume();
                    if (this.audioContext.state === 'running') {
                        this.audioUnlocked = true;
                        console.log('[AUDIO] Audio unlocked successfully!');

                        // Remove listeners after successful unlock
                        document.removeEventListener('click', unlockAudio);
                        document.removeEventListener('keydown', unlockAudio);

                        // Hide audio prompt overlay if it exists
                        const audioPrompt = document.getElementById('audio-prompt');
                        if (audioPrompt) {
                            audioPrompt.style.display = 'none';
                        }

                        // Retry background music if it was attempted before unlock
                        if (this.backgroundMusic && this.backgroundMusic.paused) {
                            console.log('[RETRY] Retrying background music after unlock...');
                            this.backgroundMusic.play().catch(err => {
                                console.warn('[AUDIO WARN] Music playback still failed:', err);
                            });
                        }
                    }
                } catch (error) {
                    console.error('[AUDIO ERROR] Failed to unlock audio:', error);
                }
            }
        };

        // Listen for any real user interaction (click or keypress)
        document.addEventListener('click', unlockAudio);
        document.addEventListener('keydown', unlockAudio);

        console.log('[AUDIO] Audio unlock listeners registered (waiting for user click/keypress)');
    }

    /**
     * Show audio unlock prompt (called when autoplay starts but audio is locked)
     */
    showAudioPrompt() {
        if (this.audioUnlocked) return;

        // Create overlay if it doesn't exist
        let audioPrompt = document.getElementById('audio-prompt');
        if (!audioPrompt) {
            audioPrompt = document.createElement('div');
            audioPrompt.id = 'audio-prompt';
            audioPrompt.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: #00ff00;
                padding: 40px 60px;
                border: 4px solid #00ff00;
                font-family: 'Press Start 2P', monospace;
                font-size: 18px;
                text-align: center;
                z-index: 10000;
                cursor: pointer;
                line-height: 1.8;
            `;
            audioPrompt.innerHTML = '[AUDIO]<br><br>CLICK ANYWHERE<br>TO ENABLE AUDIO';
            document.body.appendChild(audioPrompt);

            // Hide on click
            audioPrompt.addEventListener('click', () => {
                audioPrompt.style.display = 'none';
            });
        }

        audioPrompt.style.display = 'block';
        console.log('[PROMPT] Audio prompt displayed');
    }

    /**
     * Initialize AudioContext (must be called after user interaction)
     */
    async initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[AUDIO] AudioContext initialized, state:', this.audioContext.state);

            // Expose globally for streaming capture (stream.js needs this)
            window.audioContext = this.audioContext;
        }

        // Resume if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            console.log('[AUDIO] AudioContext suspended, attempting to resume...');
            try {
                await this.audioContext.resume();
                if (this.audioContext.state === 'running') {
                    console.log('[AUDIO] AudioContext resumed, state:', this.audioContext.state);
                    this.audioUnlocked = true;
                } else {
                    console.warn('[AUDIO WARN] AudioContext still suspended after resume attempt');
                    // Show prompt asking user to click to enable audio
                    this.showAudioPrompt();
                }
            } catch (error) {
                console.error('[AUDIO ERROR] Failed to resume AudioContext:', error);
                // Show prompt asking user to click to enable audio
                this.showAudioPrompt();
            }
        } else {
            console.log('[AUDIO] AudioContext already running, state:', this.audioContext.state);
            this.audioUnlocked = true;
        }

        this.isPlaying = true;
    }

    /**
     * Ensure AudioContext is running (helper method)
     * Attempts to resume if suspended
     */
    async ensureAudioContextRunning() {
        if (!this.audioContext) return false;

        if (this.audioContext.state === 'suspended') {
            console.log('[AUDIO WARN] AudioContext suspended, attempting resume...');
            try {
                await this.audioContext.resume();
                console.log('[AUDIO] AudioContext resumed');
                return this.audioContext.state === 'running';
            } catch (error) {
                console.error('[AUDIO ERROR] Failed to resume AudioContext:', error);
                return false;
            }
        }

        return this.audioContext.state === 'running';
    }

    /**
     * Character voice synthesis using triangle wave oscillator
     * Ported from game.js:268-321
     * @param {object} characterData - Character data with voicePitch and voiceSpeed
     * @param {string} text - Text to speak
     */
    playCharacterVoice(characterData, text) {
        if (!this.audioContext || !this.isPlaying) return;

        // Stop previous voice
        this.stopCharacterVoice();

        const { voicePitch, voiceSpeed } = characterData;
        this.currentSpeaker = characterData.name;

        let charIndex = 0;

        // Generate voice sounds for each character in the text
        this.currentVoiceInterval = setInterval(() => {
            if (!this.isPlaying || charIndex >= text.length) {
                this.stopCharacterVoice();
                return;
            }

            // Skip whitespace
            if (text[charIndex].trim() === '') {
                charIndex++;
                return;
            }

            // Create triangle wave oscillator
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = 'triangle';

            // Character-specific frequency with random variation
            // Base: pitch * 200Hz, variation: ±25Hz
            oscillator.frequency.value = voicePitch * 200 + (Math.random() * 50 - 25);

            // Envelope: 5ms attack, 80ms release
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            // Connect and play
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.start(now);
            oscillator.stop(now + 0.08);

            charIndex++;
        }, voiceSpeed); // Character-specific speed (140-200ms)

        // Voice logging disabled to reduce spam
        // console.log(`[VOICE] ${characterData.name} speaking (pitch: ${voicePitch}, speed: ${voiceSpeed}ms)`);
    }

    /**
     * Stop character voice synthesis
     */
    stopCharacterVoice() {
        if (this.currentVoiceInterval) {
            clearInterval(this.currentVoiceInterval);
            this.currentVoiceInterval = null;
            this.currentSpeaker = null;
        }
    }

    /**
     * Play a single character voice blip (for typewriter effect)
     * @param {object} characterData - Character data with voicePitch
     */
    playCharacterBlip(characterData) {
        if (!this.audioContext || !this.isPlaying) return;

        // Check AudioContext state
        if (this.audioContext.state !== 'running') {
            // Attempt to resume asynchronously (won't block typewriter)
            this.ensureAudioContextRunning();
            return;
        }

        const { voicePitch } = characterData;

        // Create triangle wave oscillator
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'triangle';

        // Character-specific frequency with random variation
        // Base: pitch * 200Hz, variation: ±25Hz
        oscillator.frequency.value = voicePitch * 200 + (Math.random() * 50 - 25);

        // Envelope: 5ms attack, 80ms release
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        // Connect and play
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.08);
    }

    /**
     * Play background music
     * Ported from game.js:201-266
     * @param {string} musicFile - Filename of the music track (e.g., "Living with Larry.mp3")
     */
    playBackgroundMusic(musicFile) {
        if (!this.audioContext) {
            console.warn('[AUDIO WARN] AudioContext not initialized, skipping music');
            return;
        }

        // Check AudioContext state
        if (this.audioContext.state !== 'running') {
            console.warn('[AUDIO WARN] AudioContext not running (state:', this.audioContext.state + '), attempting to resume...');
            this.ensureAudioContextRunning().then(isRunning => {
                if (isRunning) {
                    console.log('[AUDIO] AudioContext resumed, retrying music playback');
                    this.playBackgroundMusic(musicFile);
                }
            });
            return;
        }

        // Stop previous music
        this.stopBackgroundMusic();

        // Create Audio element
        this.backgroundMusic = new Audio(`songs/${musicFile}`);
        this.backgroundMusic.loop = true;
        this.backgroundMusic.crossOrigin = "anonymous";

        try {
            // Route through Web Audio API for stream capture
            this.musicSource = this.audioContext.createMediaElementSource(this.backgroundMusic);
            this.musicGainNode = this.audioContext.createGain();
            this.musicGainNode.gain.value = 0.3; // 30% volume

            this.musicSource.connect(this.musicGainNode);
            this.musicGainNode.connect(this.audioContext.destination);

            // Play
            this.backgroundMusic.play().catch(err => {
                console.warn('[AUDIO WARN] Music playback failed:', err);
            });

            console.log(`[MUSIC] Playing background music: ${musicFile} (AudioContext state: ${this.audioContext.state})`);
        } catch (err) {
            console.warn('[AUDIO WARN] Failed to route music through Web Audio:', err);
            // Fallback: play without Web Audio routing
            this.backgroundMusic.play().catch(err2 => {
                console.warn('[AUDIO WARN] Music playback failed completely:', err2);
            });
        }
    }

    /**
     * Stop background music
     */
    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
        }

        if (this.musicSource) {
            try {
                this.musicSource.disconnect();
            } catch (err) {
                // Already disconnected
            }
            this.musicSource = null;
        }

        if (this.musicGainNode) {
            try {
                this.musicGainNode.disconnect();
            } catch (err) {
                // Already disconnected
            }
            this.musicGainNode = null;
        }

        this.backgroundMusic = null;
    }

    /**
     * Play applause and laughter at end of scene
     * Ported from game.js:356-423
     */
    playApplauseAndLaughter() {
        if (!this.audioContext || !this.isPlaying) return;

        const now = this.audioContext.currentTime;
        const duration = 3.5; // seconds

        console.log('[EFFECT] Playing applause and laughter');

        // === APPLAUSE COMPONENT ===
        // White noise through bandpass filter

        // Create buffer for white noise
        const bufferSize = this.audioContext.sampleRate * duration;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);

        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        // Create noise source
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        // Bandpass filter (1200Hz, Q=0.5)
        const bandpassFilter = this.audioContext.createBiquadFilter();
        bandpassFilter.type = 'bandpass';
        bandpassFilter.frequency.value = 1200;
        bandpassFilter.Q.value = 0.5;

        // Envelope for applause
        const applauseGain = this.audioContext.createGain();
        applauseGain.gain.setValueAtTime(0, now);
        applauseGain.gain.linearRampToValueAtTime(0.15, now + 0.3); // 0.3s fade-in
        applauseGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Fade out

        // Connect applause chain
        noiseSource.connect(bandpassFilter);
        bandpassFilter.connect(applauseGain);
        applauseGain.connect(this.audioContext.destination);

        // Start applause
        noiseSource.start(now);
        noiseSource.stop(now + duration);

        // === LAUGHTER COMPONENT ===
        // 8 randomized laugh bursts with sawtooth oscillators

        for (let i = 0; i < 8; i++) {
            // Random timing: every 0.4s ± 0.2s
            const startTime = now + (i * 0.4) + (Math.random() * 0.4 - 0.2);

            // Random duration: 150-250ms
            const burstDuration = 0.15 + Math.random() * 0.1;

            // Create sawtooth oscillator
            const laughOsc = this.audioContext.createOscillator();
            laughOsc.type = 'sawtooth';

            // Frequency sweep: 200-300Hz down to 150Hz
            const startFreq = 200 + Math.random() * 100;
            laughOsc.frequency.setValueAtTime(startFreq, startTime);
            laughOsc.frequency.exponentialRampToValueAtTime(150, startTime + burstDuration);

            // Lowpass filter (600-1000Hz, Q=3)
            const laughFilter = this.audioContext.createBiquadFilter();
            laughFilter.type = 'lowpass';
            laughFilter.frequency.value = 600 + Math.random() * 400;
            laughFilter.Q.value = 3;

            // Gain envelope
            const laughGain = this.audioContext.createGain();
            laughGain.gain.setValueAtTime(0.08, startTime);
            laughGain.gain.exponentialRampToValueAtTime(0.001, startTime + burstDuration);

            // Connect laugh chain
            laughOsc.connect(laughFilter);
            laughFilter.connect(laughGain);
            laughGain.connect(this.audioContext.destination);

            // Start and stop
            laughOsc.start(startTime);
            laughOsc.stop(startTime + burstDuration);
        }
    }

    /**
     * Set playing state
     * @param {boolean} playing - Whether audio should be playing
     */
    setPlaying(playing) {
        this.isPlaying = playing;

        if (!playing) {
            this.stopCharacterVoice();
        }
    }

    /**
     * Get current speaker
     * @returns {string|null} Current speaker name
     */
    getCurrentSpeaker() {
        return this.currentSpeaker;
    }
}
