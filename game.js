const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Canvas settings
const SCALE = 3;
const TILE_SIZE = 16;
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 320; // Increased from 240 to accommodate separate dialogue area
const GAME_AREA_HEIGHT = 192; // Game area (characters, environment) - aligned to tile grid (160 + 2*16)
const DIALOGUE_AREA_TOP = 194; // Start of dialogue area (with 2px separator at 192-194)
const CHAR_SIZE = 16;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
canvas.style.width = (CANVAS_WIDTH * SCALE) + 'px';
canvas.style.height = (CANVAS_HEIGHT * SCALE) + 'px';

// Disable all smoothing for crisp pixels and text
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.oImageSmoothingEnabled = false;

// Crisp text rendering settings
ctx.textRendering = 'geometricPrecision';
ctx.fontKerning = 'none';

// Font settings
const FONT_SIZE = 8;
let fontReady = false;

// Wait for Press Start 2P font to load
if (document.fonts) {
    document.fonts.load(`${FONT_SIZE}px "Press Start 2P"`).then(() => {
        console.log('✅ Press Start 2P font loaded');
        fontReady = true;
    }).catch(err => {
        console.warn('⚠️ Font loading failed, using fallback:', err);
        fontReady = true;
    });
} else {
    fontReady = true;
}

// Character data with voice properties
const characters = {
    'Larry': {
        color: '#4A90E2',
        hairColor: '#654321',
        skinColor: '#FFE0BD',
        shirtColor: '#2E5C8A',
        personality: 'Neurotic, observant, finds problems in everything',
        voicePitch: 0.8,
        voiceSpeed: 140,
        hasGlasses: true,
        hairStyle: 'receding',
        portraitImg: null
    },
    'Janet': {
        color: '#E24A4A',
        hairColor: '#1A1A1A',
        skinColor: '#C89664',
        shirtColor: '#C41E3A',
        personality: 'Sarcastic, intelligent, voice of reason',
        voicePitch: 1.2,
        voiceSpeed: 180,
        hasGlasses: false,
        hairStyle: 'curly',
        portraitImg: null
    },
    'Mike': {
        color: '#4AE290',
        hairColor: '#8B4513',
        skinColor: '#FFD7B5',
        shirtColor: '#5A8F4A',
        personality: 'Confident but clueless, schemes constantly',
        voicePitch: 1.0,
        voiceSpeed: 200,
        hasGlasses: false,
        hairStyle: 'wavy',
        portraitImg: null
    }
};

// Load portrait images
Object.keys(characters).forEach(name => {
    const img = new Image();
    img.src = `portraits/${name}.jpg`;
    characters[name].portraitImg = img;
});

const locations = [
    { 
        name: "APARTMENT", 
        description: "Jerry's cluttered apartment",
        floorColor: '#8B7355',
        wallColor: '#A89080',
        furnitureColor: '#654321',
        musicKey: 'apartment'
    },
    { 
        name: "COFFEE SHOP", 
        description: "Monk's Café",
        floorColor: '#6B5447',
        wallColor: '#8B7968',
        furnitureColor: '#5D4E37',
        musicKey: 'coffee'
    },
    { 
        name: "HALLWAY", 
        description: "Building corridor",
        floorColor: '#7A8B99',
        wallColor: '#9FAFBF',
        furnitureColor: '#5C6B7A',
        musicKey: 'hallway'
    },
    { 
        name: "STREET", 
        description: "New York sidewalk",
        floorColor: '#696969',
        wallColor: '#4A4A4A',
        furnitureColor: '#2F4F4F',
        musicKey: 'street'
    }
];

// Music tracks removed - now using MP3 files from the songs folder

const sceneTypes = [
    "Larry complains about a minor inconvenience",
    "The group debates a ridiculous topic",
    "Someone has a scheme that will obviously backfire",
    "A mundane situation spirals out of control",
    "Two characters have an argument while one watches",
    "Someone discovers something absurd",
    "A character tries to explain something complicated"
];

// State
let isPlaying = false;
let isGenerating = false;
let sceneCount = 0;
let currentLocation = locations[0];
let animationFrame = 0;
let speakingCharacter = null;
let speakingTimer = 0;

// Scene batching - pre-generate scenes for smoother streaming
let sceneQueue = [];
let isPreGenerating = false;
const MAX_QUEUED_SCENES = 2;

// Audio
let audioContext = null;
let backgroundMusicAudio = null; // HTML5 Audio element for MP3 playback
let backgroundMusicSource = null; // Web Audio source for streaming capture
let backgroundMusicGain = null; // Gain node for volume control
let currentVoiceInterval = null;
let currentMusicTrack = 'apartment';
let movementInterval = null;

// Music file mapping for each location
const musicFiles = {
    'apartment': 'songs/Living with Larry.mp3',
    'coffee': 'songs/Monkin around.mp3',
    'hallway': 'songs/Whistling Down the Hallway.mp3',
    'street': 'songs/The Big City.mp3'
};

// Character states - positioned in game area (y < 180 to stay above separator at y=200)
const characterStates = {
    'Larry': { x: 80, y: 110, targetX: 80, targetY: 110, facing: 'down', action: 'idle' },
    'Janet': { x: 160, y: 110, targetX: 160, targetY: 110, facing: 'down', action: 'idle' },
    'Mike': { x: 240, y: 110, targetX: 240, targetY: 110, facing: 'down', action: 'idle' }
};

// Dialogue box state for canvas rendering
const currentDialogueState = {
    text: '',
    speakerName: '',
    speakerColor: '#00ff00',
    portraitImage: null,
    visible: false,
    scrollOffset: 0,
    scrollSpeed: 0.08, // Increased from 0.05 for smoother scrolling
    needsScroll: false,
    scrollDirection: 1, // 1 for down, -1 for up
    scrollPause: 0, // Frames to pause at top/bottom
    scrollComplete: false // Track when scrolling is finished
};

// Audio functions
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function playBackgroundMusic() {
    stopBackgroundMusic();

    if (!audioContext) {
        console.warn('AudioContext not initialized, skipping music');
        return;
    }

    // Get the MP3 file path for the current location
    const musicFile = musicFiles[currentMusicTrack] || musicFiles.apartment;

    // Create new audio element
    backgroundMusicAudio = new Audio(musicFile);
    backgroundMusicAudio.loop = true; // Loop the music
    backgroundMusicAudio.crossOrigin = "anonymous"; // Required for Web Audio API

    // Connect to Web Audio API so it can be captured for streaming
    try {
        backgroundMusicSource = audioContext.createMediaElementSource(backgroundMusicAudio);
        backgroundMusicGain = audioContext.createGain();
        backgroundMusicGain.gain.value = 0.3; // Set volume (30%)

        // Connect: audio element -> gain -> destination
        backgroundMusicSource.connect(backgroundMusicGain);
        backgroundMusicGain.connect(audioContext.destination);

        console.log('🎵 Background music connected to Web Audio API for streaming');
    } catch (err) {
        console.error('Error connecting music to Web Audio API:', err);
        // Fallback to direct playback if Web Audio connection fails
        backgroundMusicAudio.volume = 0.3;
    }

    // Play the music
    backgroundMusicAudio.play().catch(err => {
        console.error('Error playing background music:', err);
    });
}

function stopBackgroundMusic() {
    // Disconnect Web Audio nodes first
    if (backgroundMusicSource) {
        try {
            backgroundMusicSource.disconnect();
        } catch (e) {
            // Already disconnected
        }
        backgroundMusicSource = null;
    }

    if (backgroundMusicGain) {
        try {
            backgroundMusicGain.disconnect();
        } catch (e) {
            // Already disconnected
        }
        backgroundMusicGain = null;
    }

    // Stop HTML5 audio element
    if (backgroundMusicAudio) {
        backgroundMusicAudio.pause();
        backgroundMusicAudio.currentTime = 0;
        backgroundMusicAudio = null;
    }
}

function playCharacterVoice(characterName, text) {
    if (!audioContext) return;
    if (currentVoiceInterval) {
        clearInterval(currentVoiceInterval);
    }
    
    const char = characters[characterName];
    let charIndex = 0;
    const textLength = text.replace(/\s/g, '').length;
    
    function makeSound() {
        if (charIndex >= textLength || speakingCharacter !== characterName) {
            clearInterval(currentVoiceInterval);
            return;
        }
        
        while (charIndex < textLength && text[charIndex] === ' ') {
            charIndex++;
        }
        
        if (charIndex >= textLength) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'triangle';
        
        const baseFreq = 200 * char.voicePitch;
        const variation = (Math.random() - 0.5) * 50;
        oscillator.frequency.value = baseFreq + variation;
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.08);
        
        charIndex++;
    }
    
    makeSound();
    currentVoiceInterval = setInterval(makeSound, char.voiceSpeed);
}

function stopCharacterVoice() {
    if (currentVoiceInterval) {
        clearInterval(currentVoiceInterval);
        currentVoiceInterval = null;
    }
}

function setCharacterSpeaking(name, text) {
    speakingCharacter = name;
    speakingTimer = 60;

    // Start voice immediately
    playCharacterVoice(name, text);

    // Delay dialogue display by 100ms to sync with audio capture latency on stream
    // (Local playback won't notice, but stream will be in sync)
    setTimeout(() => {
        // Update dialogue state for canvas rendering
        const char = characters[name];
        currentDialogueState.text = text;
        currentDialogueState.speakerName = name;
        currentDialogueState.speakerColor = char.color;
        currentDialogueState.portraitImage = char.portraitImg;
        currentDialogueState.visible = true;

        // Reset scroll state for new dialogue
        currentDialogueState.scrollOffset = 0;
        currentDialogueState.scrollDirection = 1;
        currentDialogueState.scrollPause = 150; // Pause at top for 2.5 seconds (150 frames at 60fps)
        currentDialogueState.needsScroll = false;
        currentDialogueState.scrollComplete = false;
    }, 100); // 100ms delay to match audio capture latency
}

function stopSpeaking() {
    speakingCharacter = null;
    stopCharacterVoice();
    currentDialogueState.visible = false;
}

// Sitcom-style applause and laughter
function playApplauseAndLaughter() {
    if (!audioContext) return;

    const duration = 3.5; // Total duration in seconds
    const now = audioContext.currentTime;

    // Create applause using noise
    const bufferSize = audioContext.sampleRate * duration;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate applause noise
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const applause = audioContext.createBufferSource();
    applause.buffer = noiseBuffer;

    const applauseFilter = audioContext.createBiquadFilter();
    applauseFilter.type = 'bandpass';
    applauseFilter.frequency.value = 1200;
    applauseFilter.Q.value = 0.5;

    const applauseGain = audioContext.createGain();
    applauseGain.gain.setValueAtTime(0, now);
    applauseGain.gain.linearRampToValueAtTime(0.15, now + 0.3);
    applauseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    applause.connect(applauseFilter);
    applauseFilter.connect(applauseGain);
    applauseGain.connect(audioContext.destination);

    applause.start(now);
    applause.stop(now + duration);

    // Add laughter bursts
    for (let i = 0; i < 8; i++) {
        const laughStart = now + (i * 0.4) + Math.random() * 0.2;
        const laughDuration = 0.15 + Math.random() * 0.1;

        const laugh = audioContext.createOscillator();
        const laughGain = audioContext.createGain();
        const laughFilter = audioContext.createBiquadFilter();

        laugh.type = 'sawtooth';
        laugh.frequency.setValueAtTime(200 + Math.random() * 100, laughStart);
        laugh.frequency.exponentialRampToValueAtTime(150, laughStart + laughDuration);

        laughFilter.type = 'lowpass';
        laughFilter.frequency.value = 600 + Math.random() * 400;
        laughFilter.Q.value = 3;

        laughGain.gain.setValueAtTime(0, laughStart);
        laughGain.gain.linearRampToValueAtTime(0.08, laughStart + 0.01);
        laughGain.gain.exponentialRampToValueAtTime(0.001, laughStart + laughDuration);

        laugh.connect(laughFilter);
        laughFilter.connect(laughGain);
        laughGain.connect(audioContext.destination);

        laugh.start(laughStart);
        laugh.stop(laughStart + laughDuration);
    }

    console.log('👏 Playing applause and laughter');
}

// Helper functions
function lightenColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Draw character
function drawCharacter(name, isSpeaking) {
    const state = characterStates[name];
    const data = characters[name];
    // Round to integer pixels for sharp rendering
    const x = Math.round(state.x);
    const y = Math.round(state.y);
    
    const speed = 0.8;
    if (Math.abs(state.x - state.targetX) > 1) {
        state.x += (state.targetX - state.x) * 0.1;
        state.action = 'walking';
    } else if (Math.abs(state.y - state.targetY) > 1) {
        state.y += (state.targetY - state.y) * 0.1;
        state.action = 'walking';
    } else {
        state.action = state.action === 'walking' ? 'idle' : state.action;
    }
    
    const frame = state.action === 'walking' ? Math.floor(animationFrame / 10) % 4 : 0;
    const bounce = isSpeaking ? Math.sin(animationFrame * 0.2) * 1 : 0;
    
    ctx.save();
    ctx.translate(x, y - bounce);

    // Shadow removed - was appearing below dialogue box
    // ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    // ctx.beginPath();
    // ctx.ellipse(0, 7, 6, 2, 0, 0, Math.PI * 2);
    // ctx.fill();

    let leftLegOffset = 0, rightLegOffset = 0;
    if (state.action === 'walking') {
        leftLegOffset = frame === 1 || frame === 2 ? 1 : 0;
        rightLegOffset = frame === 0 || frame === 3 ? 1 : 0;
    }
    
    ctx.fillStyle = '#1A252F';
    ctx.fillRect(-3 + leftLegOffset, 2, 2, 5);
    ctx.fillRect(1 + rightLegOffset, 2, 2, 5);
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(-3 + leftLegOffset, 2, 1, 5);
    ctx.fillRect(1 + rightLegOffset, 2, 1, 5);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(-4 + leftLegOffset, 6, 3, 2);
    ctx.fillRect(1 + rightLegOffset, 6, 3, 2);
    ctx.fillStyle = '#333333';
    ctx.fillRect(-4 + leftLegOffset, 6, 1, 1);
    ctx.fillRect(1 + rightLegOffset, 6, 1, 1);
    
    ctx.fillStyle = data.shirtColor;
    ctx.fillRect(-4, -4, 8, 6);
    
    const shirtLight = lightenColor(data.shirtColor, 30);
    const shirtDark = darkenColor(data.shirtColor, 30);
    ctx.fillStyle = shirtLight;
    ctx.fillRect(-4, -4, 2, 6);
    ctx.fillStyle = shirtDark;
    ctx.fillRect(2, -4, 2, 6);
    
    ctx.fillStyle = darkenColor(data.shirtColor, 50);
    ctx.fillRect(-2, -4, 4, 1);
    
    const armSwing = state.action === 'walking' ? Math.sin(animationFrame * 0.3) * 2 : 0;
    const speakWave = isSpeaking ? Math.sin(animationFrame * 0.3) : 0;
    
    if (isSpeaking || state.action === 'walking') {
        ctx.fillStyle = data.shirtColor;
        ctx.fillRect(-6, -2 + (isSpeaking ? speakWave : -armSwing), 2, 4);
        ctx.fillStyle = shirtDark;
        ctx.fillRect(-5, -2 + (isSpeaking ? speakWave : -armSwing), 1, 4);
        
        ctx.fillStyle = data.shirtColor;
        ctx.fillRect(4, -2 + (isSpeaking ? -speakWave : armSwing), 2, 4);
        ctx.fillStyle = shirtLight;
        ctx.fillRect(4, -2 + (isSpeaking ? -speakWave : armSwing), 1, 4);
    } else {
        ctx.fillStyle = data.shirtColor;
        ctx.fillRect(-6, -2, 2, 4);
        ctx.fillRect(4, -2, 2, 4);
        ctx.fillStyle = shirtDark;
        ctx.fillRect(-5, -2, 1, 4);
        ctx.fillStyle = shirtLight;
        ctx.fillRect(4, -2, 1, 4);
    }
    
    const handOffsetLeft = isSpeaking ? speakWave : (state.action === 'walking' ? -armSwing : 0);
    const handOffsetRight = isSpeaking ? -speakWave : (state.action === 'walking' ? armSwing : 0);
    
    ctx.fillStyle = data.skinColor;
    ctx.fillRect(-6, 2 + handOffsetLeft, 2, 2);
    ctx.fillRect(4, 2 + handOffsetRight, 2, 2);
    ctx.fillStyle = darkenColor(data.skinColor, 20);
    ctx.fillRect(-5, 2 + handOffsetLeft, 1, 2);
    ctx.fillRect(5, 2 + handOffsetRight, 1, 2);
    
    ctx.fillStyle = data.skinColor;
    ctx.fillRect(-1, -5, 2, 2);
    ctx.fillStyle = darkenColor(data.skinColor, 15);
    ctx.fillRect(0, -5, 1, 2);
    
    ctx.fillStyle = data.skinColor;
    ctx.fillRect(-4, -11, 8, 7);
    const skinLight = lightenColor(data.skinColor, 15);
    const skinDark = darkenColor(data.skinColor, 20);
    ctx.fillStyle = skinLight;
    ctx.fillRect(-4, -11, 3, 7);
    ctx.fillStyle = skinDark;
    ctx.fillRect(2, -11, 2, 7);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(-4, -11, 1, 1);
    ctx.clearRect(3, -11, 1, 1);
    ctx.clearRect(-4, -5, 1, 1);
    ctx.clearRect(3, -5, 1, 1);
    
    // Hair based on style
    ctx.fillStyle = data.hairColor;
    if (data.hairStyle === 'receding') {
        // Larry - balding with curly sides
        ctx.fillRect(-2, -13, 4, 2);
        ctx.fillRect(-4, -11, 2, 4);
        ctx.fillRect(2, -11, 2, 4);
        ctx.fillRect(-5, -10, 1, 2);
        ctx.fillRect(4, -10, 1, 2);
        const hairDark = darkenColor(data.hairColor, 30);
        ctx.fillStyle = hairDark;
        ctx.fillRect(-4, -11, 1, 3);
        ctx.fillRect(3, -11, 1, 3);
    } else if (data.hairStyle === 'curly') {
        // Janet - big afro/curly hair
        ctx.fillRect(-6, -14, 12, 5);
        ctx.fillRect(-7, -12, 2, 7);
        ctx.fillRect(5, -12, 2, 7);
        ctx.fillRect(-6, -9, 1, 2);
        ctx.fillRect(5, -9, 1, 2);
        const hairLight = lightenColor(data.hairColor, 30);
        ctx.fillStyle = hairLight;
        ctx.fillRect(-5, -14, 2, 1);
        ctx.fillRect(-2, -14, 2, 1);
        ctx.fillRect(1, -14, 2, 1);
        ctx.fillRect(4, -13, 1, 1);
        ctx.fillRect(-6, -12, 1, 1);
        ctx.fillRect(5, -11, 1, 1);
    } else {
        // Mike - full wavy swept back hair
        ctx.fillRect(-5, -14, 10, 4);
        ctx.fillRect(-5, -11, 1, 2);
        ctx.fillRect(4, -11, 1, 2);
        ctx.fillRect(-4, -15, 8, 1);
        const hairLight = lightenColor(data.hairColor, 40);
        const hairDark = darkenColor(data.hairColor, 30);
        ctx.fillStyle = hairLight;
        ctx.fillRect(-4, -14, 2, 1);
        ctx.fillRect(-1, -14, 2, 1);
        ctx.fillRect(2, -14, 2, 1);
        ctx.fillStyle = hairDark;
        ctx.fillRect(-3, -13, 1, 1);
        ctx.fillRect(0, -13, 1, 1);
        ctx.fillRect(2, -13, 1, 1);
    }
    
    ctx.fillStyle = data.skinColor;
    ctx.fillRect(-5, -8, 1, 2);
    ctx.fillRect(4, -8, 1, 2);
    ctx.fillStyle = skinDark;
    ctx.fillRect(-5, -7, 1, 1);
    ctx.fillRect(4, -7, 1, 1);
    
    const eyeBlink = isSpeaking && Math.floor(animationFrame / 40) % 8 === 0;
    ctx.fillStyle = '#FFFFFF';
    if (!eyeBlink) {
        ctx.fillRect(-3, -9, 2, 2);
        ctx.fillRect(1, -9, 2, 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-2, -8, 1, 1);
        ctx.fillRect(2, -8, 1, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-3, -9, 1, 1);
        ctx.fillRect(1, -9, 1, 1);
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(-3, -8, 2, 1);
        ctx.fillRect(1, -8, 2, 1);
    }

    // Glasses (for Larry)
    if (data.hasGlasses) {
        ctx.fillStyle = '#2C3E50';
        // Left frame
        ctx.fillRect(-4, -10, 3, 1);
        ctx.fillRect(-4, -7, 3, 1);
        ctx.fillRect(-4, -10, 1, 4);
        ctx.fillRect(-2, -10, 1, 4);
        // Right frame
        ctx.fillRect(1, -10, 3, 1);
        ctx.fillRect(1, -7, 3, 1);
        ctx.fillRect(1, -10, 1, 4);
        ctx.fillRect(3, -10, 1, 4);
        // Bridge
        ctx.fillRect(-1, -9, 2, 1);
        // Highlight on glasses
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(-3, -9, 1, 1);
        ctx.fillRect(2, -9, 1, 1);
    }

    ctx.fillStyle = darkenColor(data.hairColor, 40);
    ctx.fillRect(-3, -10, 2, 1);
    ctx.fillRect(1, -10, 2, 1);
    
    ctx.fillStyle = skinDark;
    ctx.fillRect(0, -7, 1, 2);
    ctx.fillRect(1, -6, 1, 1);
    
    if (isSpeaking && Math.floor(animationFrame / 15) % 2 === 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(-1, -5, 2, 1);
        ctx.fillStyle = '#8B4545';
        ctx.fillRect(-1, -4, 2, 1);
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(-1, -5, 2, 1);
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 15, y + 10, 30, 10);
    ctx.fillStyle = data.color;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    // Removed name label text
    
    ctx.restore();
}

// Draw environment with detail
function drawEnvironment() {
    const gradient = ctx.createLinearGradient(0, 0, 0, 100);
    gradient.addColorStop(0, '#5C7A9E');
    gradient.addColorStop(1, '#8BA4BF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 100);
    
    ctx.fillStyle = currentLocation.wallColor;
    ctx.fillRect(0, 100, CANVAS_WIDTH, 60);
    
    ctx.fillStyle = darkenColor(currentLocation.wallColor, 10);
    for (let x = 0; x < CANVAS_WIDTH; x += 32) {
        ctx.fillRect(x, 100, 2, 60);
    }
    ctx.fillRect(0, 130, CANVAS_WIDTH, 2);
    
    ctx.fillStyle = currentLocation.floorColor;
    ctx.fillRect(0, 160, CANVAS_WIDTH, GAME_AREA_HEIGHT - 160);

    const floorLight = lightenColor(currentLocation.floorColor, 10);
    const floorDark = darkenColor(currentLocation.floorColor, 15);

    for (let y = 160; y < GAME_AREA_HEIGHT; y += TILE_SIZE) {
        for (let x = 0; x < CANVAS_WIDTH; x += TILE_SIZE) {
            ctx.fillStyle = floorDark;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = currentLocation.floorColor;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            ctx.fillStyle = floorLight;
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 6, TILE_SIZE - 6);
        }
    }
    
    if (currentLocation.name === "APARTMENT") {
        const couchDark = darkenColor('#8B0000', 30);
        const couchLight = lightenColor('#8B0000', 20);
        
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(15, 125, 60, 8);
        ctx.fillStyle = couchDark;
        ctx.fillRect(15, 125, 60, 2);
        ctx.fillStyle = couchLight;
        ctx.fillRect(15, 131, 60, 2);
        
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(15, 133, 60, 25);
        ctx.fillStyle = couchDark;
        ctx.fillRect(15, 133, 3, 25);
        ctx.fillRect(72, 133, 3, 25);
        ctx.fillStyle = couchLight;
        ctx.fillRect(18, 133, 3, 25);
        
        ctx.fillStyle = couchDark;
        ctx.fillRect(25, 138, 18, 3);
        ctx.fillRect(50, 138, 18, 3);
        
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(240, 130, 50, 25);
        ctx.fillStyle = darkenColor('#3E2723', 20);
        ctx.fillRect(240, 130, 2, 25);
        ctx.fillRect(288, 130, 2, 25);
        
        ctx.fillStyle = '#1C1C1C';
        ctx.fillRect(245, 110, 40, 32);
        ctx.fillStyle = '#2E2E2E';
        ctx.fillRect(247, 112, 36, 28);
        ctx.fillStyle = '#4A6FA5';
        ctx.fillRect(249, 114, 32, 24);
        ctx.fillStyle = '#7BA3D0';
        ctx.fillRect(249, 114, 16, 12);
        
        // Coffee table (adjusted to fit in game area)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(80, 165, 80, 30);
        ctx.fillStyle = darkenColor('#8B4513', 20);
        ctx.fillRect(82, 167, 76, 26);
        ctx.fillStyle = lightenColor('#8B4513', 30);
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(90 + i * 20, 172, 15, 2);
        }
        
    } else if (currentLocation.name === "COFFEE SHOP") {
        ctx.fillStyle = '#654321';
        ctx.fillRect(10, 120, 80, 35);
        ctx.fillStyle = lightenColor('#654321', 20);
        ctx.fillRect(10, 120, 80, 3);
        ctx.fillStyle = darkenColor('#654321', 25);
        ctx.fillRect(10, 152, 80, 3);
        
        ctx.fillStyle = darkenColor('#654321', 15);
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(15 + i * 18, 125, 2, 27);
        }
        
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(20, 110, 20, 25);
        ctx.fillStyle = '#A0A0A0';
        ctx.fillRect(22, 112, 16, 20);
        ctx.fillStyle = '#FF6B00';
        ctx.fillRect(28, 118, 4, 4);
        
        ctx.fillStyle = currentLocation.furnitureColor;
        ctx.fillRect(130, 145, 60, 35);
        ctx.fillStyle = lightenColor(currentLocation.furnitureColor, 20);
        ctx.fillRect(130, 145, 60, 3);
        ctx.fillStyle = darkenColor(currentLocation.furnitureColor, 20);
        ctx.fillRect(130, 177, 60, 3);
        
        ctx.fillStyle = darkenColor(currentLocation.furnitureColor, 30);
        ctx.fillRect(138, 165, 6, 15);
        ctx.fillRect(176, 165, 6, 15);
    } else if (currentLocation.name === "STREET") {
        for (let i = 0; i < 3; i++) {
            const x = 15 + i * 80;
            const h = 40 + Math.random() * 20;
            ctx.fillStyle = '#2C2C2C';
            ctx.fillRect(x, 130 - h, 35, h);
            
            for (let j = 0; j < 3; j++) {
                const lit = Math.random() > 0.3;
                ctx.fillStyle = lit ? '#FFFF00' : '#444444';
                ctx.fillRect(x + 5, 95 + j * 12, 8, 8);
            }
        }
        
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(0, 155, CANVAS_WIDTH, 5);
        ctx.fillStyle = '#2A2A2A';
        ctx.fillRect(0, 157, CANVAS_WIDTH, 1);
    }
}

// Text wrapping helper that creates all lines (no cutting off)
function wrapTextIntoLines(text, maxWidth) {
    // Use temp context for measurement
    ctx.save();
    ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const lineWidth = ctx.measureText(testLine).width;

        if (lineWidth > maxWidth && i > 0) {
            lines.push(currentLine.trim());
            currentLine = words[i] + ' ';
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
    }

    ctx.restore();
    return lines;
}

// Scrolling text renderer for dialogue
function renderScrollingText(context, text, x, y, maxWidth, maxHeight, lineHeight) {
    // Break text into lines
    const allLines = wrapTextIntoLines(text, maxWidth);
    const maxVisibleLines = Math.floor(maxHeight / lineHeight);

    // Check if we need scrolling
    const totalHeight = allLines.length * lineHeight;
    const needsScroll = totalHeight > maxHeight;

    // Update scroll state
    if (needsScroll && !currentDialogueState.needsScroll) {
        currentDialogueState.needsScroll = true;
    }

    // Handle scrolling animation
    if (needsScroll) {
        // Pause at top/bottom before scrolling
        if (currentDialogueState.scrollPause > 0) {
            currentDialogueState.scrollPause--;
        } else if (!currentDialogueState.scrollComplete) {
            currentDialogueState.scrollOffset += currentDialogueState.scrollSpeed * currentDialogueState.scrollDirection;

            const maxScroll = (totalHeight - maxHeight) + 7;

            if (currentDialogueState.scrollOffset >= maxScroll) {
                currentDialogueState.scrollOffset = maxScroll;
                currentDialogueState.scrollPause = 240; // Pause at bottom for 4 seconds (240 frames at 60fps)
                currentDialogueState.scrollComplete = true; // Mark scroll as complete
            }
        }
    } else {
        // If no scrolling needed, mark as complete immediately
        currentDialogueState.scrollComplete = true;
    }

    // Render visible lines
    const startLineIndex = Math.floor(currentDialogueState.scrollOffset / lineHeight);
    const yOffset = -(currentDialogueState.scrollOffset % lineHeight);

    for (let i = 0; i < maxVisibleLines + 1; i++) {
        const lineIndex = startLineIndex + i;
        if (lineIndex >= allLines.length) break;

        const lineY = y + yOffset + (i * lineHeight);

        // Only draw if within visible area
        if (lineY >= y - lineHeight && lineY <= y + maxHeight) {
            context.fillText(allLines[lineIndex], Math.round(x), Math.round(lineY));
        }
    }

    // Draw scroll indicator if needed
    if (needsScroll) {
        const indicatorX = x + maxWidth + 5;
        const scrollBarHeight = maxHeight - 10;
        const scrollBarY = y + 5;

        // Background bar
        context.fillStyle = 'rgba(0, 255, 0, 0.3)';
        context.fillRect(indicatorX, scrollBarY, 3, scrollBarHeight);

        // Position indicator
        const maxScroll = totalHeight - maxHeight;
        const scrollPercent = currentDialogueState.scrollOffset / maxScroll;
        const indicatorHeight = Math.max(10, (maxHeight / totalHeight) * scrollBarHeight);
        const indicatorY = scrollBarY + (scrollPercent * (scrollBarHeight - indicatorHeight));

        context.fillStyle = '#00ff00';
        context.fillRect(indicatorX, indicatorY, 3, indicatorHeight);
    }
}

// Draw dialogue box on canvas
function drawDialogueBox() {
    if (!currentDialogueState.visible || !currentDialogueState.text) return;

    // Dialogue box dimensions - positioned in dedicated dialogue area
    const boxWidth = 288;  // 90% of 320px canvas width
    const boxHeight = 110;  // Room for multiple lines
    const boxX = (CANVAS_WIDTH - boxWidth) / 2;  // Center horizontally
    const boxY = DIALOGUE_AREA_TOP + 5;  // 5px below separator in dialogue area

    // Draw dialogue box background (black with green border)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Clip all dialogue box contents to stay within box borders
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxX + 1, boxY + 1, boxWidth - 2, boxHeight - 2); // Inset by 1px for border (was 2px)
    ctx.clip();

    // Draw portrait box (left side)
    const portraitSize = 75;
    const portraitX = Math.round(boxX + 5);
    const portraitY = Math.round(boxY + (boxHeight - portraitSize) / 2);

    // Portrait border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(portraitX, portraitY, portraitSize, portraitSize);

    // Draw portrait image if available
    if (currentDialogueState.portraitImage) {
        // Disable image smoothing for crisp pixel art
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            currentDialogueState.portraitImage,
            portraitX + 2, portraitY + 2, portraitSize - 4, portraitSize - 4
        );
    }

    // Draw dialogue text (right side)
    const textX = Math.round(portraitX + portraitSize + 8);
    const textY = Math.round(boxY + 18);
    const textWidth = Math.round(boxWidth - portraitSize - 18 - 10); // Extra space for scroll bar

    // Improve text rendering quality
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';

    // Character name - use optimized text rendering
    ctx.fillStyle = currentDialogueState.speakerColor;
    ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(currentDialogueState.speakerName + ':', Math.round(textX), Math.round(textY));

    // Set up clipping region for text scrolling
    ctx.save();
    const textAreaY = Math.round(textY + 12);  // Reduced from 15 to prevent top cutoff
    const textAreaHeight = Math.round(boxHeight - 18);  // Increased from 25 to prevent bottom cutoff

    // Create clipping rectangle - all pixel-aligned
    ctx.beginPath();
    ctx.rect(Math.round(textX), Math.round(textAreaY), Math.round(textWidth + 10), Math.round(textAreaHeight));
    ctx.clip();

    // Dialogue text with scrolling support
    ctx.fillStyle = '#ffffff';
    ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';

    renderScrollingText(
        ctx,
        currentDialogueState.text,
        textX,
        textAreaY,
        textWidth,
        textAreaHeight,
        12  // Line height - adjusted for 8px font (was 11)
    );

    ctx.restore(); // Restore from text area clipping
    ctx.restore(); // Restore from dialogue box clipping
}

function render() {
    animationFrame++;

    // Wait for font to be ready before rendering text
    if (!fontReady && animationFrame < 180) {
        requestAnimationFrame(render);
        return;
    }

    // Draw game area background (sky blue)
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);

    // Draw dialogue area background (dark)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, GAME_AREA_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - GAME_AREA_HEIGHT);

    // === GAME AREA VIEWPORT (with clipping) ===
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    ctx.clip();

    drawEnvironment();

    if (speakingCharacter && speakingTimer > 0) {
        speakingTimer--;
    } else if (speakingTimer === 0) {
        speakingCharacter = null;
    }

    // Random idle movement every few seconds
    if (isPlaying && animationFrame % 180 === 0) {
        Object.keys(characters).forEach(name => {
            if (Math.random() > 0.6) {
                const actions = ['walk_left', 'walk_right', 'pace'];
                const action = actions[Math.floor(Math.random() * actions.length)];
                performCharacterAction(name, action);
            }
        });
    }

    Object.keys(characters).forEach(name => {
        drawCharacter(name, speakingCharacter === name);
    });

    ctx.restore();
    // === END GAME AREA VIEWPORT ===

    // Draw separator line between viewports (not clipped)
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, GAME_AREA_HEIGHT, CANVAS_WIDTH, 2);

    // === DIALOGUE AREA VIEWPORT (with clipping) ===
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, GAME_AREA_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - GAME_AREA_HEIGHT);
    ctx.clip();

    // Draw dialogue box on canvas (if visible)
    if (currentDialogueState.visible) {
        drawDialogueBox();
    }

    ctx.restore();
    // === END DIALOGUE AREA VIEWPORT ===

    requestAnimationFrame(render);
}

render();

// Position characters
function positionCharactersForLocation() {
    if (currentLocation.name === "APARTMENT") {
        characterStates['Larry'].targetX = 45;
        characterStates['Larry'].targetY = 145;
        characterStates['Janet'].targetX = 160;
        characterStates['Janet'].targetY = 165;
        characterStates['Mike'].targetX = 270;
        characterStates['Mike'].targetY = 150;
    } else if (currentLocation.name === "COFFEE SHOP") {
        characterStates['Larry'].targetX = 120;
        characterStates['Larry'].targetY = 165;
        characterStates['Janet'].targetX = 160;
        characterStates['Janet'].targetY = 150;
        characterStates['Mike'].targetX = 200;
        characterStates['Mike'].targetY = 165;
    } else if (currentLocation.name === "STREET") {
        characterStates['Larry'].targetX = 80;
        characterStates['Larry'].targetY = 170;
        characterStates['Janet'].targetX = 160;
        characterStates['Janet'].targetY = 165;
        characterStates['Mike'].targetX = 240;
        characterStates['Mike'].targetY = 170;
    } else {
        characterStates['Larry'].targetX = 80;
        characterStates['Larry'].targetY = 170;
        characterStates['Janet'].targetX = 160;
        characterStates['Janet'].targetY = 170;
        characterStates['Mike'].targetX = 240;
        characterStates['Mike'].targetY = 170;
    }
}

function performCharacterAction(name, action) {
    const state = characterStates[name];
    
    switch(action) {
        case 'walk_left':
            state.targetX = Math.max(40, state.targetX - 40);
            break;
        case 'walk_right':
            state.targetX = Math.min(280, state.targetX + 40);
            break;
        case 'pace':
            setTimeout(() => {
                state.targetX = state.x + (Math.random() > 0.5 ? 30 : -30);
            }, 1000);
            break;
        case 'approach':
            state.targetX = 160 + (Math.random() - 0.5) * 40;
            // Keep Y position in game area (max 175 to stay above separator)
            state.targetY = Math.min(175, 150 + (Math.random() - 0.5) * 30);
            break;
    }
}

const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const skipBtn = document.getElementById('skip-btn');
const statusEl = document.getElementById('status');
const sceneCountEl = document.getElementById('scene-count');
const locationNameEl = document.getElementById('location-name');
const dialogueLinesEl = document.getElementById('dialogue-lines');
const locationBanner = document.getElementById('location-banner');
const bannerTitle = document.getElementById('banner-title');
const bannerDesc = document.getElementById('banner-desc');

// Pre-generate scenes in the background for smoother streaming
async function preGenerateScene() {
    if (isPreGenerating || sceneQueue.length >= MAX_QUEUED_SCENES) return;

    isPreGenerating = true;
    console.log(`📝 Pre-generating scene (queue: ${sceneQueue.length}/${MAX_QUEUED_SCENES})...`);

    try {
        const sceneType = sceneTypes[Math.floor(Math.random() * sceneTypes.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];

        const characterList = Object.entries(characters)
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

            sceneQueue.push({
                sceneText,
                sceneType,
                location
            });

            console.log(`✅ Scene pre-generated! Queue: ${sceneQueue.length}/${MAX_QUEUED_SCENES}`);

            // Keep pre-generating if queue isn't full
            if (sceneQueue.length < MAX_QUEUED_SCENES && isPlaying) {
                setTimeout(() => preGenerateScene(), 2000);
            }
        }
    } catch (error) {
        console.error('Error pre-generating scene:', error);
    } finally {
        isPreGenerating = false;
    }
}

async function generateScene() {
    if (isGenerating) return;

    isGenerating = true;
    skipBtn.disabled = true;

    // Try to use a pre-generated scene from the queue
    let sceneData = sceneQueue.shift();
    let sceneText;
    let location, sceneType;

    if (sceneData) {
        console.log(`🎬 Using pre-generated scene (${sceneQueue.length} remaining in queue)`);
        sceneText = sceneData.sceneText;
        location = sceneData.location;
        sceneType = sceneData.sceneType;

        // Start pre-generating next scene immediately
        setTimeout(() => preGenerateScene(), 100);
    } else {
        // No pre-generated scene available, generate on-the-fly
        console.log('⚠️ No pre-generated scene available, generating on-the-fly...');
        location = locations[Math.floor(Math.random() * locations.length)];
        sceneType = sceneTypes[Math.floor(Math.random() * sceneTypes.length)];
    }

    sceneCount++;
    sceneCountEl.textContent = sceneCount.toString().padStart(2, '0');
    locationNameEl.textContent = location.name;
    currentLocation = location;

    // Change music for new location
    currentMusicTrack = location.musicKey;
    if (isPlaying && audioContext) {
        stopBackgroundMusic();
        playBackgroundMusic();
    }

    bannerTitle.textContent = location.name;
    bannerDesc.textContent = location.description;
    locationBanner.style.opacity = '1';
    setTimeout(() => {
        locationBanner.style.opacity = '0';
    }, 3000);

    dialogueLinesEl.innerHTML = sceneData ? '<p class="generating">▶ LOADING SCENE...</p>' : '<p class="generating">▶ GENERATING SCENE...</p>';

    // If we don't have a pre-generated scene, generate now
    if (!sceneData) {
        const characterList = Object.entries(characters)
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

        try {
            const response = await fetch('/api/generate-scene', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt
                })
            });

        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after') || 60;
            dialogueLinesEl.innerHTML = `<p style="color: #ffaa00; text-align: center;">⚠ RATE LIMIT! WAITING ${retryAfter}s...</p>`;
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            
            if (isPlaying) {
                isGenerating = false;
                skipBtn.disabled = false;
                return generateScene();
            } else {
                isGenerating = false;
                skipBtn.disabled = false;
                return;
            }
        }

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

            const data = await response.json();
            sceneText = data.content[0].text;

            // Start pre-generating next scene
            setTimeout(() => preGenerateScene(), 2000);

        } catch (error) {
            console.error('Error generating scene:', error);
            dialogueLinesEl.innerHTML = `<p style="color: #ff6b6b; text-align: center;">ERROR: ${error.message}</p>`;
            isGenerating = false;
            skipBtn.disabled = false;
            return;
        }
    }

    // Display the dialogue (either pre-generated or freshly generated)
    if (sceneText) {
        dialogueLinesEl.innerHTML = '';
        await parseAndDisplayDialogue(sceneText);
    }
}

async function parseAndDisplayDialogue(sceneText) {
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
                character = 'Larry';
            }
            
            dialogue.push({ character, text, color: characters[character].color });
        }
    }
    
    positionCharactersForLocation();

    const actions = ['pace', 'approach', 'walk_left', 'walk_right'];

    for (let i = 0; i < dialogue.length; i++) {
        if (!isPlaying) return;

        const line = dialogue[i];

        // Update canvas dialogue state (replaces DOM manipulation)
        setCharacterSpeaking(line.character, line.text);

        // Random character actions
        if (Math.random() > 0.7 && i > 0) {
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            performCharacterAction(line.character, randomAction);
        }

        if (Math.random() > 0.8) {
            const otherChars = Object.keys(characters).filter(n => n !== line.character);
            const reactor = otherChars[Math.floor(Math.random() * otherChars.length)];
            performCharacterAction(reactor, 'approach');
        }

        // === TIMING SYSTEM ===
        // Timing: 2s initial + scroll time + 4s final

        // Check if scrolling will be needed (check early before animation starts)
        const willNeedScrolling = currentDialogueState.needsScroll;
        const isLastLine = (i === dialogue.length - 1);

        if (isPlaying) {
            if (willNeedScrolling) {
                // For scrolling text:
                // - Scroll animation handles 2s initial pause (120 frames)
                // - Scroll animation handles the scrolling
                // - Scroll animation handles 4s bottom pause (240 frames)
                while (isPlaying && !currentDialogueState.scrollComplete) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                // Add small transition buffer (except for last line)
                if (!isLastLine) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                // For non-scrolling text:
                // Add the full 2.5s + 4s pauses manually (scroll animation doesn't run)
                await new Promise(resolve => setTimeout(resolve, 2500)); // Initial reading pause (2.5s)
                while (isPlaying && !currentDialogueState.scrollComplete) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                await new Promise(resolve => setTimeout(resolve, 4000)); // Final reading pause (4s)
            }
        }
    }

    stopSpeaking();

    // Play applause and laughter at the end of the scene
    if (isPlaying && audioContext) {
        playApplauseAndLaughter();
        await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for applause to finish
    }

    if (isPlaying) {
        await new Promise(resolve => setTimeout(resolve, 6000)); // Wait before next scene
        
        if (isPlaying) {
            isGenerating = false;
            skipBtn.disabled = false;
            generateScene();
        } else {
            isGenerating = false;
            skipBtn.disabled = false;
        }
    } else {
        isGenerating = false;
        skipBtn.disabled = false;
    }
}

playBtn.addEventListener('click', () => {
    isPlaying = true;
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'flex';
    statusEl.textContent = '▶ LIVE';

    initAudio();
    playBackgroundMusic();

    if (sceneCount === 0) {
        // Start pre-generating scenes for smooth streaming
        setTimeout(() => preGenerateScene(), 3000);
        generateScene();
    }
});

pauseBtn.addEventListener('click', () => {
    isPlaying = false;
    pauseBtn.style.display = 'none';
    playBtn.style.display = 'flex';
    statusEl.textContent = '◼ PAUSED';

    stopBackgroundMusic();
    stopCharacterVoice();
});

// Auto-start for streaming mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('autoplay') === 'true') {
    console.log('🎬 Autoplay mode enabled - starting in 2 seconds...');
    setTimeout(() => {
        playBtn.click();
        console.log('✅ Autoplay started');
    }, 2000);
}

skipBtn.addEventListener('click', () => {
    if (!isGenerating) {
        stopCharacterVoice();
        generateScene();
    }
});

// Auto-hide controls and status on mouse inactivity
const controls = document.getElementById('controls');
let controlsTimeout;

function showControls() {
    controls.classList.add('visible');
    statusEl.classList.add('visible');
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
        controls.classList.remove('visible');
        statusEl.classList.remove('visible');
    }, 3000); // Hide after 3 seconds of no mouse movement
}

// Show controls on mouse movement
document.addEventListener('mousemove', showControls);

// Show controls initially so users know they exist
showControls();
