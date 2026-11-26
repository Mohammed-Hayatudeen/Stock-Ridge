const fs = require('fs');
let code = fs.readFileSync('public/js/views/products.js', 'utf8');

// First, fix the validLadder error I introduced
code = code.replace(`units: validLadder.map((l, i) => ({`, `units: ladder.map((l, i) => ({`);

// Now add the actual validation before the payload!
const oldSubmit = `              const payload = Object.assign({`;
const newSubmit = `              // Validate ladder
              ladder.sort((a, b) => Number(a.quantity_in_base || 0) - Number(b.quantity_in_base || 0));
              const validLadder = ladder.filter((l) => l.code && l.code.trim());
              if (!validLadder.length) {
                ui.alert('Please add at least a base unit.'); return;
              }
              for (let i = 0; i < validLadder.length; i++) {
                const l = validLadder[i];
                const qty = i === 0 ? 1 : Number(l.quantity_in_base);
                if (!Number.isFinite(qty) || qty <= 0) {
                  ui.alert(\`Please enter a positive number of base units for "\${l.code || 'Unit'}" (level \${i+1}).\`);
                  return;
                }
              }
              // Replace empty ladder with validLadder so empty inputs are dropped instead of crashing backend
              ladder.length = 0;
              ladder.push(...validLadder);

              const payload = Object.assign({`;

code = code.replace(oldSubmit, newSubmit);
fs.writeFileSync('public/js/views/products.js', code);
console.log("Fixed validLadder syntax error");
