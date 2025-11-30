const COLORS = {
    U: 'White',
    D: 'Yellow',
    R: 'Red',
    L: 'Orange',
    F: 'Green',
    B: 'Blue',
    P: 'Pink',
    K: 'Black',
    M: 'Purple'
};

const COLOR_VALUES = {
    0xFFFFFF: 'White',
    0xFFD500: 'Yellow',
    0xB90000: 'Red',
    0xFF5800: 'Orange',
    0x009E60: 'Green',
    0x0051BA: 'Blue',
    0xFF69B4: 'Pink',
    0x111111: 'Black',
    0x800080: 'Purple'
};

// Arrays from Molecube.js
const corners = ['White', 'Yellow', 'Red', 'Orange', 'Green', 'Blue', 'Pink', 'Pink'];
const edges = ['White', 'Yellow', 'Red', 'Orange', 'Green', 'Blue', 'Black', 'Black', 'Black', 'Purple', 'Purple', 'Purple'];

let cIdx = 0;
let eIdx = 0;

const pieces = [];

for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
            if (x === 0 && y === 0 && z === 0) continue;

            let name = '';
            // Y axis (U/D)
            if (y === 1) name += 'U';
            if (y === -1) name += 'D';
            // Z axis (F/B)
            if (z === 1) name += 'F';
            if (z === -1) name += 'B';
            // X axis (R/L)
            if (x === 1) name += 'R';
            if (x === -1) name += 'L';

            let color = '';
            const absX = Math.abs(x);
            const absY = Math.abs(y);
            const absZ = Math.abs(z);
            const sum = absX + absY + absZ;

            if (sum === 1) {
                // Center
                if (x === 1) color = 'Red';
                if (x === -1) color = 'Orange';
                if (y === 1) color = 'White';
                if (y === -1) color = 'Yellow';
                if (z === 1) color = 'Green';
                if (z === -1) color = 'Blue';
            } else if (sum === 2) {
                // Edge
                color = edges[eIdx++];
            } else if (sum === 3) {
                // Corner
                color = corners[cIdx++];
            }

            pieces.push({ name, color });
        }
    }
}

pieces.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} ${p.color}`);
});
