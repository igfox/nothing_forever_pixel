const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portraitCanvas = document.getElementById('portrait-canvas');
const portraitCtx = portraitCanvas.getContext('2d');

// Canvas settings
const SCALE = 3;
const TILE_SIZE = 16;
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 240;
const CHAR_SIZE = 16;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
canvas.style.width = (CANVAS_WIDTH * SCALE) + 'px';
canvas.style.height = (CANVAS_HEIGHT * SCALE) + 'px';

ctx.imageSmoothingEnabled = false;
portraitCtx.imageSmoothingEnabled = false;

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

// Music tracks for each location (15 second loops with more variety)
const musicTracks = {
    apartment: [
        // Main melody
        {note: 523.25, duration: 0.3}, {note: 587.33, duration: 0.3},
        {note: 659.25, duration: 0.3}, {note: 698.46, duration: 0.3},
        {note: 783.99, duration: 0.6}, {note: 698.46, duration: 0.3},
        {note: 659.25, duration: 0.3}, {note: 587.33, duration: 0.6},
        // Variation
        {note: 659.25, duration: 0.3}, {note: 698.46, duration: 0.3},
        {note: 783.99, duration: 0.3}, {note: 880.00, duration: 0.6},
        {note: 783.99, duration: 0.3}, {note: 698.46, duration: 0.3},
        // Return
        {note: 523.25, duration: 0.3}, {note: 493.88, duration: 0.3},
        {note: 440.00, duration: 0.6}, {note: 493.88, duration: 0.3},
        {note: 523.25, duration: 0.3}, {note: 587.33, duration: 0.6},
        {note: 523.25, duration: 0.9}
    ],
    coffee: [
        // Upbeat progression
        {note: 392.00, duration: 0.25}, {note: 440.00, duration: 0.25},
        {note: 493.88, duration: 0.25}, {note: 523.25, duration: 0.5},
        {note: 587.33, duration: 0.25}, {note: 523.25, duration: 0.25},
        {note: 493.88, duration: 0.25}, {note: 440.00, duration: 0.25},
        // Bridge
        {note: 392.00, duration: 0.5}, {note: 329.63, duration: 0.25},
        {note: 349.23, duration: 0.25}, {note: 392.00, duration: 0.5},
        {note: 440.00, duration: 0.25}, {note: 493.88, duration: 0.25},
        // Climax
        {note: 523.25, duration: 0.25}, {note: 587.33, duration: 0.25},
        {note: 659.25, duration: 0.5}, {note: 587.33, duration: 0.25},
        {note: 523.25, duration: 0.75}
    ],
    hallway: [
        // Ambient melody
        {note: 261.63, duration: 0.4}, {note: 293.66, duration: 0.4},
        {note: 329.63, duration: 0.4}, {note: 349.23, duration: 0.4},
        {note: 392.00, duration: 0.8}, {note: 440.00, duration: 0.4},
        // Variation
        {note: 392.00, duration: 0.4}, {note: 349.23, duration: 0.4},
        {note: 329.63, duration: 0.4}, {note: 293.66, duration: 0.8},
        // Resolution
        {note: 329.63, duration: 0.4}, {note: 349.23, duration: 0.4},
        {note: 392.00, duration: 0.6}, {note: 329.63, duration: 0.4},
        {note: 261.63, duration: 1.0}
    ],
    street: [
        // Energetic pattern
        {note: 659.25, duration: 0.25}, {note: 587.33, duration: 0.25},
        {note: 523.25, duration: 0.25}, {note: 493.88, duration: 0.25},
        {note: 440.00, duration: 0.5}, {note: 493.88, duration: 0.25},
        {note: 523.25, duration: 0.25}, {note: 587.33, duration: 0.5},
        // Build up
        {note: 659.25, duration: 0.25}, {note: 698.46, duration: 0.25},
        {note: 783.99, duration: 0.25}, {note: 880.00, duration: 0.5},
        {note: 783.99, duration: 0.25}, {note: 698.46, duration: 0.25},
        // Finale
        {note: 659.25, duration: 0.5}, {note: 587.33, duration: 0.25},
        {note: 523.25, duration: 0.25}, {note: 493.88, duration: 0.75}
    ]
};

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

// Audio
let audioContext = null;
let backgroundMusic = null;
let currentVoiceInterval = null;
let currentMusicTrack = 'apartment';
let movementInterval = null;

// Character states
const characterStates = {
    'Larry': { x: 80, y: 140, targetX: 80, targetY: 140, facing: 'down', action: 'idle' },
    'Janet': { x: 160, y: 140, targetX: 160, targetY: 140, facing: 'down', action: 'idle' },
    'Mike': { x: 240, y: 140, targetX: 240, targetY: 140, facing: 'down', action: 'idle' }
};

// Audio functions
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function playBackgroundMusic() {
    if (!audioContext) return;
    
    stopBackgroundMusic();
    
    const melody = musicTracks[currentMusicTrack] || musicTracks.apartment;
    let currentNote = 0;
    
    function playNote() {
        if (!isPlaying || !audioContext) return;
        
        const note = melody[currentNote % melody.length];
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.value = note.note;
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.03, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + note.duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + note.duration);
        
        currentNote++;
        backgroundMusic = setTimeout(playNote, note.duration * 1000);
    }
    
    playNote();
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        clearTimeout(backgroundMusic);
        backgroundMusic = null;
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
    playCharacterVoice(name, text);
    drawPortrait(name);
}

function stopSpeaking() {
    speakingCharacter = null;
    stopCharacterVoice();
}

// Draw character portrait
function drawPortrait(name) {
    const data = characters[name];
    portraitCtx.clearRect(0, 0, 112, 112);

    // Draw the portrait image if loaded
    if (data.portraitImg && data.portraitImg.complete) {
        portraitCtx.drawImage(data.portraitImg, 0, 0, 112, 112);
    }
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
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
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
    ctx.fillRect(0, 160, CANVAS_WIDTH, CANVAS_HEIGHT - 160);
    
    const floorLight = lightenColor(currentLocation.floorColor, 10);
    const floorDark = darkenColor(currentLocation.floorColor, 15);
    
    for (let y = 160; y < CANVAS_HEIGHT; y += TILE_SIZE) {
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
        
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(80, 165, 80, 60);
        ctx.fillStyle = darkenColor('#8B4513', 20);
        ctx.fillRect(82, 167, 76, 56);
        ctx.fillStyle = lightenColor('#8B4513', 30);
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(90 + i * 20, 175, 15, 2);
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

function render() {
    animationFrame++;
    
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
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
            state.targetY = 160 + (Math.random() - 0.5) * 20;
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

async function generateScene() {
    if (isGenerating) return;
    
    isGenerating = true;
    skipBtn.disabled = true;
    
    const location = locations[Math.floor(Math.random() * locations.length)];
    const sceneType = sceneTypes[Math.floor(Math.random() * sceneTypes.length)];
    
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
    
    dialogueLinesEl.innerHTML = '<p class="generating">▶ GENERATING SCENE...</p>';
    
    const characterList = Object.entries(characters)
        .map(([name, data]) => `${name} (${data.personality})`)
        .join(', ');

    const prompt = `You are writing a Seinfeld-style sitcom scene.

Characters: ${characterList}
Location: ${location.name} - ${location.description}
Scene type: ${sceneType}

Write a MEDIUM-LENGTH comedic scene (8-12 exchanges of dialogue). Format EXACTLY as:
LARRY: dialogue text here
JANET: dialogue text here
MIKE: dialogue text here

IMPORTANT: 
- Use ONLY these character names (LARRY, JANET, MIKE) in all caps
- Do not introduce other characters
- Make the dialogue substantial - each line should be 1-3 sentences
- Keep it observational, absurd, and true to character personalities
- Make it funny and conversational with good back-and-forth
- Build to a comedic peak or realization`;

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
        const sceneText = data.content[0].text;
        
        dialogueLinesEl.innerHTML = '';
        await parseAndDisplayDialogue(sceneText);
        
    } catch (error) {
        console.error('Error generating scene:', error);
        dialogueLinesEl.innerHTML = `<p style="color: #ff6b6b; text-align: center;">ERROR: ${error.message}</p>`;
        isGenerating = false;
        skipBtn.disabled = false;
        return;
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
        
        const baseDelay = 3500;
        const wordCount = dialogue[i].text.split(' ').length;
        const delay = baseDelay + Math.min(wordCount * 100, 2000);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const line = dialogue[i];
        const lineEl = document.createElement('div');
        lineEl.className = 'dialogue-line';
        lineEl.innerHTML = `
            <span class="character" style="color: ${line.color};">${line.character}:</span>
            <span class="text">${line.text}</span>
        `;
        dialogueLinesEl.appendChild(lineEl);
        
        setCharacterSpeaking(line.character, line.text);
        
        if (Math.random() > 0.7 && i > 0) {
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            performCharacterAction(line.character, randomAction);
        }
        
        if (Math.random() > 0.8) {
            const otherChars = Object.keys(characters).filter(n => n !== line.character);
            const reactor = otherChars[Math.floor(Math.random() * otherChars.length)];
            performCharacterAction(reactor, 'approach');
        }
        
        lineEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    
    stopSpeaking();
    
    if (isPlaying) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        
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
