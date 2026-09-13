const fs = require('fs');
const path = require('path');

const releaseDir = path.join(__dirname, '..', 'release');

fs.rmSync(releaseDir, { recursive: true, force: true });
console.log('Pasta client/release limpa.');
