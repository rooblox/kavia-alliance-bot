const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../alliances.json');

function loadAlliances() {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Failed to load alliances:', err);
        return [];
    }
}

function saveAlliances(alliances) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(alliances, null, 4), 'utf8');
    } catch (err) {
        console.error('Failed to save alliances:', err);
    }
}

module.exports = {
    loadAlliances,
    saveAlliances
};
