// Background Generation Script
// Converts procedural environment rendering from game.js to background images
// Usage: node scripts/generate-backgrounds.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Constants
const BG_WIDTH = 1280;
const BG_HEIGHT = 560; // Game area height (0-560px)

// Location data from game.js:93-126 (scaled to 1280x720)
const LOCATIONS = [
    {
        name: 'apartment',
        displayName: 'APARTMENT',
        floorColor: '#8B7355',
        wallColor: '#A89080',
        furnitureColor: '#654321'
    },
    {
        name: 'coffee_shop',
        displayName: 'COFFEE SHOP',
        floorColor: '#6B5447',
        wallColor: '#8B7968',
        furnitureColor: '#5D4E37'
    },
    {
        name: 'hallway',
        displayName: 'HALLWAY',
        floorColor: '#7A8B99',
        wallColor: '#9FAFBF',
        furnitureColor: '#5C6B7A'
    },
    {
        name: 'street',
        displayName: 'STREET',
        floorColor: '#696969',
        wallColor: '#4A4A4A',
        furnitureColor: '#2F4F4F'
    }
];

// Helper functions
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

// Ported and scaled drawEnvironment function from game.js:681-811
function drawEnvironment(ctx, location) {
    const { name, floorColor, wallColor, furnitureColor } = location;

    // Scale factor (1280x720 vs 320x192)
    const scaleX = BG_WIDTH / 320;
    const scaleY = BG_HEIGHT / 192;

    // Sky gradient (scaled)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, 140 * scaleY);
    skyGradient.addColorStop(0, '#5C7A9E');
    skyGradient.addColorStop(1, '#8BA4BF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, BG_WIDTH, 140 * scaleY);

    // Wall (vertical paneling)
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 140 * scaleY, BG_WIDTH, 52 * scaleY);

    // Wall paneling (vertical lines every 32px scaled)
    ctx.fillStyle = darkenColor(wallColor, 15);
    for (let x = 0; x < BG_WIDTH; x += 32 * scaleX) {
        ctx.fillRect(x, 140 * scaleY, 2 * scaleX, 52 * scaleY);
    }

    // Floor (tiled)
    const floorY = 160 * scaleY;
    ctx.fillStyle = floorColor;
    ctx.fillRect(0, floorY, BG_WIDTH, BG_HEIGHT - floorY);

    // Floor tiles (16x16 scaled)
    const tileSize = 16 * scaleX;
    for (let y = floorY; y < BG_HEIGHT; y += tileSize) {
        for (let x = 0; x < BG_WIDTH; x += tileSize) {
            // Lighter tile
            ctx.fillStyle = lightenColor(floorColor, 8);
            ctx.fillRect(x + 1 * scaleX, y + 1 * scaleY, (tileSize - 2 * scaleX), (tileSize - 2 * scaleY));

            // Darker edge
            ctx.fillStyle = darkenColor(floorColor, 12);
            ctx.fillRect(x, y, tileSize, 1 * scaleY);
            ctx.fillRect(x, y, 1 * scaleX, tileSize);

            // Even darker corner
            ctx.fillStyle = darkenColor(floorColor, 20);
            ctx.fillRect(x, y, 2 * scaleX, 2 * scaleY);
        }
    }

    // Location-specific furniture
    if (name === 'apartment') {
        drawApartmentFurniture(ctx, furnitureColor, scaleX, scaleY);
    } else if (name === 'coffee_shop') {
        drawCoffeeShopFurniture(ctx, furnitureColor, scaleX, scaleY);
    } else if (name === 'street') {
        drawStreetElements(ctx, scaleX, scaleY);
    }
    // Hallway has no special furniture
}

function drawApartmentFurniture(ctx, furnitureColor, scaleX, scaleY) {
    // Couch (red/brown, right side)
    const couchX = 210 * scaleX;
    const couchY = 120 * scaleY;

    // Couch back
    ctx.fillStyle = darkenColor(furnitureColor, 10);
    ctx.fillRect(couchX, couchY, 70 * scaleX, 10 * scaleY);

    // Couch base
    ctx.fillStyle = furnitureColor;
    ctx.fillRect(couchX + 5 * scaleX, couchY + 10 * scaleY, 60 * scaleX, 30 * scaleY);

    // Couch cushions (lighter)
    ctx.fillStyle = lightenColor(furnitureColor, 15);
    ctx.fillRect(couchX + 7 * scaleX, couchY + 12 * scaleY, 18 * scaleX, 18 * scaleY);
    ctx.fillRect(couchX + 27 * scaleX, couchY + 12 * scaleY, 18 * scaleX, 18 * scaleY);
    ctx.fillRect(couchX + 47 * scaleX, couchY + 12 * scaleY, 18 * scaleX, 18 * scaleY);

    // Couch arm rests
    ctx.fillStyle = darkenColor(furnitureColor, 20);
    ctx.fillRect(couchX, couchY + 10 * scaleY, 5 * scaleX, 30 * scaleY);
    ctx.fillRect(couchX + 65 * scaleX, couchY + 10 * scaleY, 5 * scaleX, 30 * scaleY);

    // Coffee table (center)
    const tableX = 100 * scaleX;
    const tableY = 145 * scaleY;

    ctx.fillStyle = darkenColor(furnitureColor, 30);
    ctx.fillRect(tableX, tableY, 45 * scaleX, 20 * scaleY);

    ctx.fillStyle = darkenColor(furnitureColor, 40);
    ctx.fillRect(tableX + 2 * scaleX, tableY + 2 * scaleY, 41 * scaleX, 1 * scaleY);

    // Decorative highlights
    ctx.fillStyle = lightenColor(furnitureColor, 20);
    ctx.fillRect(tableX + 5 * scaleX, tableY + 5 * scaleY, 10 * scaleX, 10 * scaleY);
    ctx.fillRect(tableX + 30 * scaleX, tableY + 5 * scaleY, 10 * scaleX, 10 * scaleY);

    // TV (left side)
    const tvX = 40 * scaleX;
    const tvY = 80 * scaleY;

    // TV stand
    ctx.fillStyle = '#000000';
    ctx.fillRect(tvX, tvY + 35 * scaleY, 40 * scaleX, 15 * scaleY);

    // TV screen frame
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(tvX + 2 * scaleX, tvY, 36 * scaleX, 35 * scaleY);

    // TV screen
    const screenGradient = ctx.createLinearGradient(
        tvX + 5 * scaleX, tvY + 3 * scaleY,
        tvX + 35 * scaleX, tvY + 32 * scaleY
    );
    screenGradient.addColorStop(0, '#4a5f7f');
    screenGradient.addColorStop(1, '#2a3f5f');
    ctx.fillStyle = screenGradient;
    ctx.fillRect(tvX + 5 * scaleX, tvY + 3 * scaleY, 30 * scaleX, 27 * scaleY);

    // Screen reflection
    ctx.fillStyle = 'rgba(200, 220, 255, 0.2)';
    ctx.fillRect(tvX + 7 * scaleX, tvY + 5 * scaleY, 10 * scaleX, 10 * scaleY);
}

function drawCoffeeShopFurniture(ctx, furnitureColor, scaleX, scaleY) {
    // Counter (left side)
    const counterX = 30 * scaleX;
    const counterY = 120 * scaleY;

    ctx.fillStyle = furnitureColor;
    ctx.fillRect(counterX, counterY, 80 * scaleX, 40 * scaleY);

    // Counter top (darker)
    ctx.fillStyle = darkenColor(furnitureColor, 20);
    ctx.fillRect(counterX, counterY, 80 * scaleX, 5 * scaleY);

    // Counter panels (vertical slats)
    ctx.fillStyle = lightenColor(furnitureColor, 10);
    for (let x = 0; x < 80; x += 10) {
        ctx.fillRect(counterX + x * scaleX, counterY + 5 * scaleY, 8 * scaleX, 35 * scaleY);
    }

    // Coffee machine (on counter)
    const machineX = counterX + 25 * scaleX;
    const machineY = counterY - 15 * scaleY;

    ctx.fillStyle = '#C0C0C0'; // Silver
    ctx.fillRect(machineX, machineY, 20 * scaleX, 15 * scaleY);

    ctx.fillStyle = '#FF6600'; // Orange element
    ctx.fillRect(machineX + 5 * scaleX, machineY + 5 * scaleY, 10 * scaleX, 5 * scaleY);

    // Additional counter (right side for more depth)
    const counter2X = 200 * scaleX;

    ctx.fillStyle = furnitureColor;
    ctx.fillRect(counter2X, counterY + 10 * scaleY, 60 * scaleX, 30 * scaleY);

    // Counter legs
    ctx.fillStyle = darkenColor(furnitureColor, 30);
    ctx.fillRect(counter2X + 5 * scaleX, counterY + 40 * scaleY, 5 * scaleX, 20 * scaleY);
    ctx.fillRect(counter2X + 50 * scaleX, counterY + 40 * scaleY, 5 * scaleX, 20 * scaleY);
}

function drawStreetElements(ctx, scaleX, scaleY) {
    // Buildings (background)
    const buildings = [
        { x: 20, height: 80 },
        { x: 100, height: 100 },
        { x: 200, height: 70 }
    ];

    buildings.forEach(building => {
        const buildingX = building.x * scaleX;
        const buildingHeight = building.height * scaleY;
        const buildingY = 60 * scaleY;

        // Building body
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(buildingX, buildingY, 70 * scaleX, buildingHeight);

        // Windows (lit and unlit randomly)
        for (let y = 0; y < buildingHeight; y += 15 * scaleY) {
            for (let x = 0; x < 60; x += 15 * scaleX) {
                const isLit = Math.random() > 0.5;
                ctx.fillStyle = isLit ? '#FFFF99' : '#1a1a1a';
                ctx.fillRect(
                    buildingX + x + 5 * scaleX,
                    buildingY + y + 5 * scaleY,
                    8 * scaleX,
                    10 * scaleY
                );
            }
        }
    });

    // Road markings (simple dashed line in distance)
    ctx.fillStyle = '#888888';
    for (let x = 0; x < BG_WIDTH; x += 40 * scaleX) {
        ctx.fillRect(x, 155 * scaleY, 20 * scaleX, 2 * scaleY);
    }
}

// Generate background for a location
function generateBackground(location) {
    console.log(`[BG] Generating background for ${location.displayName}...`);

    // Create canvas
    const canvas = createCanvas(BG_WIDTH, BG_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Disable smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;

    // Draw environment
    drawEnvironment(ctx, location);

    // Save background
    const outputDir = path.join(__dirname, '..', 'assets', 'backgrounds');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${location.name}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`Success: Generated: ${outputPath}`);
    console.log(`   Size: ${BG_WIDTH}x${BG_HEIGHT}`);
}

// Main execution
console.log('[GAME] Background Generator');
console.log('========================\n');

LOCATIONS.forEach(location => {
    generateBackground(location);
});

console.log('\n✨ All backgrounds generated successfully!');
console.log('\nNext steps:');
console.log('1. Uncomment background loading in scenes/BootScene.js');
console.log('2. Run the game to test backgrounds\n');
