// Character Sprite Generation Script
// Converts procedural character rendering from game.js to sprite sheets
// Usage: node scripts/generate-character-sprites.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Constants from original game.js
const ORIGINAL_CHAR_SIZE = 16;
const SCALE = 4; // 16x20 → 64x80
const CHAR_WIDTH = ORIGINAL_CHAR_SIZE * SCALE;
const CHAR_HEIGHT = 20 * SCALE;

// Character data from game.js
const CHARACTERS = {
    Larry: {
        color: '#4A90E2',
        hairColor: '#654321',
        skinColor: '#FFE0BD',
        shirtColor: '#2E5C8A',
        hasGlasses: true,
        hairStyle: 'receding'
    },
    Janet: {
        color: '#E24A4A',
        hairColor: '#1A1A1A',
        skinColor: '#C89664',
        shirtColor: '#C41E3A',
        hasGlasses: false,
        hairStyle: 'curly'
    },
    Mike: {
        color: '#4AE290',
        hairColor: '#8B4513',
        skinColor: '#FFD7B5',
        shirtColor: '#5A8F4A',
        hasGlasses: false,
        hairStyle: 'wavy'
    }
};

// Helper functions from game.js
function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, ((num >> 16) & 0xFF) + amt);
    const G = Math.min(255, ((num >> 8) & 0xFF) + amt);
    const B = Math.min(255, (num & 0xFF) + amt);
    return '#' + (0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, ((num >> 16) & 0xFF) - amt);
    const G = Math.max(0, ((num >> 8) & 0xFF) - amt);
    const B = Math.max(0, (num & 0xFF) - amt);
    return '#' + (0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

// Ported and scaled drawCharacter function from game.js:445-678
function drawCharacter(ctx, characterData, frame = 'idle', isSpeaking = false) {
    const { hairColor, skinColor, shirtColor, hasGlasses, hairStyle } = characterData;

    // Scale all coordinates by SCALE factor
    const s = SCALE;

    // No offset - character fills entire 64x80 frame
    const offsetX = 0;
    const offsetY = 0;

    // Legs (based on frame)
    ctx.fillStyle = '#333333'; // Black pants

    if (frame.startsWith('walk')) {
        const walkFrame = parseInt(frame.replace('walk', '')) || 1;
        // Animated walk cycle
        const legOffset = (walkFrame % 2 === 0) ? 1 * s : -1 * s;
        ctx.fillRect(offsetX + 5*s, offsetY + 16*s - legOffset, 3*s, 4*s); // left leg
        ctx.fillRect(offsetX + 8*s, offsetY + 16*s + legOffset, 3*s, 4*s); // right leg
    } else {
        // Standing legs
        ctx.fillRect(offsetX + 5*s, offsetY + 16*s, 3*s, 4*s); // left leg
        ctx.fillRect(offsetX + 8*s, offsetY + 16*s, 3*s, 4*s); // right leg
    }

    // Shoes
    ctx.fillStyle = '#000000';
    ctx.fillRect(offsetX + 4*s, offsetY + 19*s, 4*s, 1*s); // left shoe
    ctx.fillRect(offsetX + 8*s, offsetY + 19*s, 4*s, 1*s); // right shoe

    // Torso (shirt)
    ctx.fillStyle = shirtColor;
    ctx.fillRect(offsetX + 4*s, offsetY + 10*s, 8*s, 6*s);
    // Shading
    ctx.fillStyle = lightenColor(shirtColor, 30);
    ctx.fillRect(offsetX + 5*s, offsetY + 11*s, 3*s, 4*s);
    ctx.fillStyle = darkenColor(shirtColor, 30);
    ctx.fillRect(offsetX + 10*s, offsetY + 12*s, 1*s, 3*s);

    // Arms
    ctx.fillStyle = skinColor;
    if (isSpeaking && frame !== 'blink') {
        // Animated arm gesture
        ctx.fillRect(offsetX + 2*s, offsetY + 11*s - 1*s, 2*s, 4*s); // left arm raised
        ctx.fillRect(offsetX + 12*s, offsetY + 11*s + 1*s, 2*s, 4*s); // right arm down
    } else if (frame.startsWith('walk')) {
        // Walking arm swing
        const walkFrame = parseInt(frame.replace('walk', '')) || 1;
        const armSwing = (walkFrame % 2 === 0) ? 1 * s : -1 * s;
        ctx.fillRect(offsetX + 2*s, offsetY + 11*s - armSwing, 2*s, 4*s); // left arm
        ctx.fillRect(offsetX + 12*s, offsetY + 11*s + armSwing, 2*s, 4*s); // right arm
    } else {
        // Normal arms
        ctx.fillRect(offsetX + 2*s, offsetY + 11*s, 2*s, 4*s); // left arm
        ctx.fillRect(offsetX + 12*s, offsetY + 11*s, 2*s, 4*s); // right arm
    }

    // Hands
    ctx.fillStyle = skinColor;
    ctx.fillRect(offsetX + 2*s, offsetY + 15*s, 2*s, 2*s); // left hand
    ctx.fillRect(offsetX + 12*s, offsetY + 15*s, 2*s, 2*s); // right hand
    ctx.fillStyle = darkenColor(skinColor, 20);
    ctx.fillRect(offsetX + 3*s, offsetY + 16*s, 1*s, 1*s);
    ctx.fillRect(offsetX + 13*s, offsetY + 16*s, 1*s, 1*s);

    // Neck
    ctx.fillStyle = skinColor;
    ctx.fillRect(offsetX + 6*s, offsetY + 9*s, 4*s, 2*s);
    ctx.fillStyle = darkenColor(skinColor, 15);
    ctx.fillRect(offsetX + 6*s, offsetY + 10*s, 4*s, 1*s);

    // Head (rounded)
    ctx.fillStyle = skinColor;
    // Head oval (8x7 pixels scaled)
    ctx.fillRect(offsetX + 5*s, offsetY + 2*s, 6*s, 7*s); // main head
    ctx.fillRect(offsetX + 4*s, offsetY + 3*s, 1*s, 5*s); // left round
    ctx.fillRect(offsetX + 11*s, offsetY + 3*s, 1*s, 5*s); // right round

    // Head shading
    ctx.fillStyle = lightenColor(skinColor, 20);
    ctx.fillRect(offsetX + 5*s, offsetY + 3*s, 2*s, 4*s);
    ctx.fillStyle = darkenColor(skinColor, 15);
    ctx.fillRect(offsetX + 10*s, offsetY + 4*s, 1*s, 3*s);

    // Hair (different styles)
    ctx.fillStyle = hairColor;
    if (hairStyle === 'receding') {
        // Larry's receding hairline
        ctx.fillRect(offsetX + 4*s, offsetY + 2*s, 8*s, 2*s); // top
        ctx.fillRect(offsetX + 3*s, offsetY + 3*s, 2*s, 2*s); // left side
        ctx.fillRect(offsetX + 11*s, offsetY + 3*s, 2*s, 2*s); // right side
    } else if (hairStyle === 'curly') {
        // Janet's big curly hair (afro-style)
        ctx.fillRect(offsetX + 3*s, offsetY + 1*s, 10*s, 6*s); // big volume
        ctx.fillRect(offsetX + 2*s, offsetY + 2*s, 12*s, 4*s); // wider middle
        ctx.fillRect(offsetX + 4*s, offsetY + 0*s, 8*s, 1*s); // top puff
    } else if (hairStyle === 'wavy') {
        // Mike's wavy swept-back hair
        ctx.fillRect(offsetX + 4*s, offsetY + 2*s, 9*s, 3*s); // main hair
        ctx.fillRect(offsetX + 5*s, offsetY + 1*s, 7*s, 1*s); // top
        ctx.fillRect(offsetX + 3*s, offsetY + 3*s, 2*s, 2*s); // left side
        ctx.fillRect(offsetX + 12*s, offsetY + 3*s, 2*s, 2*s); // right side
    }

    // Ears
    ctx.fillStyle = skinColor;
    ctx.fillRect(offsetX + 3*s, offsetY + 5*s, 1*s, 2*s); // left ear
    ctx.fillRect(offsetX + 12*s, offsetY + 5*s, 1*s, 2*s); // right ear
    ctx.fillStyle = darkenColor(skinColor, 25);
    ctx.fillRect(offsetX + 3*s, offsetY + 6*s, 1*s, 1*s);
    ctx.fillRect(offsetX + 12*s, offsetY + 6*s, 1*s, 1*s);

    // Eyes
    const eyesClosed = (frame === 'blink');

    if (eyesClosed) {
        // Closed eyes (just a line)
        ctx.fillStyle = hairColor;
        ctx.fillRect(offsetX + 6*s, offsetY + 5*s, 2*s, 1*s); // left eye
        ctx.fillRect(offsetX + 10*s, offsetY + 5*s, 2*s, 1*s); // right eye
    } else {
        // Open eyes
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(offsetX + 6*s, offsetY + 5*s, 2*s, 2*s); // left white
        ctx.fillRect(offsetX + 10*s, offsetY + 5*s, 2*s, 2*s); // right white

        // Pupils
        ctx.fillStyle = '#000000';
        ctx.fillRect(offsetX + 6*s, offsetY + 5*s, 1*s, 1*s); // left pupil
        ctx.fillRect(offsetX + 10*s, offsetY + 5*s, 1*s, 1*s); // right pupil

        // Eye highlights
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(offsetX + 7*s, offsetY + 6*s, 1*s, 1*s); // left highlight
        ctx.fillRect(offsetX + 11*s, offsetY + 6*s, 1*s, 1*s); // right highlight
    }

    // Glasses (Larry only)
    if (hasGlasses && !eyesClosed) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1 * s / 2;

        // Left frame
        ctx.strokeRect(offsetX + 5*s, offsetY + 4*s, 3*s, 3*s);
        // Right frame
        ctx.strokeRect(offsetX + 9*s, offsetY + 4*s, 3*s, 3*s);
        // Bridge
        ctx.fillStyle = '#333333';
        ctx.fillRect(offsetX + 8*s, offsetY + 5*s, 1*s, 1*s);

        // Reflection highlights
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(offsetX + 6*s, offsetY + 5*s, 1*s, 1*s);
        ctx.fillRect(offsetX + 10*s, offsetY + 5*s, 1*s, 1*s);
        ctx.globalAlpha = 1.0;
    }

    // Eyebrows
    ctx.fillStyle = hairColor;
    ctx.fillRect(offsetX + 6*s, offsetY + 4*s, 2*s, 1*s); // left
    ctx.fillRect(offsetX + 10*s, offsetY + 4*s, 2*s, 1*s); // right

    // Nose
    ctx.fillStyle = darkenColor(skinColor, 20);
    ctx.fillRect(offsetX + 8*s, offsetY + 6*s, 1*s, 2*s);

    // Mouth
    const mouthOpen = isSpeaking && (frame === 'speak1' || frame.startsWith('speak'));
    ctx.fillStyle = '#000000';
    if (mouthOpen) {
        ctx.fillRect(offsetX + 7*s, offsetY + 8*s, 3*s, 1*s); // open mouth
    } else {
        ctx.fillRect(offsetX + 7*s, offsetY + 8*s, 2*s, 1*s); // closed mouth
    }
}

// Generate sprite sheet for a character
function generateSpriteSheet(characterName, characterData) {
    console.log(`[GRAPHICS] Generating sprite sheet for ${characterName}...`);

    // 8 frames: idle, walk1-4, speak1-2, blink
    const frames = [
        { name: 'idle', isSpeaking: false },
        { name: 'walk1', isSpeaking: false },
        { name: 'walk2', isSpeaking: false },
        { name: 'walk3', isSpeaking: false },
        { name: 'walk4', isSpeaking: false },
        { name: 'speak1', isSpeaking: true },
        { name: 'speak2', isSpeaking: true },
        { name: 'blink', isSpeaking: false }
    ];

    // Create sprite sheet canvas (8 frames × 64px wide, 80px tall)
    const sheetWidth = CHAR_WIDTH * frames.length;
    const sheetHeight = CHAR_HEIGHT;
    const canvas = createCanvas(sheetWidth, sheetHeight);
    const ctx = canvas.getContext('2d');

    // Disable smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;

    // Draw each frame
    frames.forEach((frame, index) => {
        ctx.save();
        ctx.translate(index * CHAR_WIDTH, 0);
        drawCharacter(ctx, characterData, frame.name, frame.isSpeaking);
        ctx.restore();
    });

    // Save sprite sheet
    const outputDir = path.join(__dirname, '..', 'assets', 'sprites');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${characterName.toLowerCase()}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`Success: Generated: ${outputPath}`);
    console.log(`   Size: ${sheetWidth}x${sheetHeight} (${frames.length} frames)`);
}

// Main execution
console.log('[GAME] Character Sprite Generator');
console.log('==============================\n');

Object.keys(CHARACTERS).forEach(name => {
    generateSpriteSheet(name, CHARACTERS[name]);
});

console.log('\n✨ All character sprites generated successfully!');
console.log('\nNext steps:');
console.log('1. Uncomment sprite loading in scenes/BootScene.js');
console.log('2. Uncomment animation creation in BootScene.js');
console.log('3. Run the game to test sprites\n');
