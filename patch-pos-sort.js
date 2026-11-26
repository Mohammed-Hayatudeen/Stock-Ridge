const fs = require('fs');
let code = fs.readFileSync('public/js/views/pos.js', 'utf8');

const oldSort = `        .sort((a, b) => Number(a.quantity_in_base) - Number(b.quantity_in_base));`;
const newSort = `        .sort((a, b) => Number(a.quantity_in_base !== undefined ? a.quantity_in_base : a.quantityInBase) - Number(b.quantity_in_base !== undefined ? b.quantity_in_base : b.quantityInBase));`;

code = code.replace(oldSort, newSort);

const oldFactor = `        const factor = Number(u.quantity_in_base) || 1;`;
const newFactor = `        const factor = Number(u.quantity_in_base !== undefined ? u.quantity_in_base : u.quantityInBase) || 1;`;
code = code.replace(oldFactor, newFactor);

fs.writeFileSync('public/js/views/pos.js', code);
console.log("Patched pos.js sort & factor");
