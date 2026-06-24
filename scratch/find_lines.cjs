const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/DyedYarn/OrderStock.jsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split(/\r?\n/);
for (let i = 1785; i <= 1820; i++) {
  console.log(`${i}: [${lines[i - 1]}]`);
}
