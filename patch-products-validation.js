const fs = require('fs');
let code = fs.readFileSync('public/js/views/products.js', 'utf8');

const oldCheck = `          const validLadder = ladder.filter((l) => l.code && String(l.quantity_in_base));
          if (!validLadder.length) {
            ui.alert('Please add at least a base unit.'); return;
          }`;

const newCheck = `          // Sort ladder before saving so index 0 is truly the base unit
          ladder.sort((a, b) => Number(a.quantity_in_base || 0) - Number(b.quantity_in_base || 0));
          const validLadder = ladder.filter((l) => l.code && l.code.trim());
          if (!validLadder.length) {
            ui.alert('Please add at least a base unit.'); return;
          }
          for (let i = 0; i < validLadder.length; i++) {
            const l = validLadder[i];
            const qty = i === 0 ? 1 : Number(l.quantity_in_base);
            if (!Number.isFinite(qty) || qty <= 0) {
              ui.alert(\`Please enter a positive number of base units for "\${l.code || 'Unit'}".\`);
              return;
            }
          }`;

code = code.replace(oldCheck, newCheck);

// Let's also ensure `validLadder` is what gets mapped in the payload, not the raw `ladder` with empty rows!
const oldPayload = `units: ladder.map((l, i) => ({
                  code: l.code || (i === 0 ? 'PIECE' : \`UNIT_\${i}\`),`;
const newPayload = `units: validLadder.map((l, i) => ({
                  code: l.code || (i === 0 ? 'PIECE' : \`UNIT_\${i}\`),`;

code = code.replace(oldPayload, newPayload);

fs.writeFileSync('public/js/views/products.js', code);
console.log("Patched ladder validation in products.js");
