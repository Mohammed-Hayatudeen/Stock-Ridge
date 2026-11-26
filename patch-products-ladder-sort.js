const fs = require('fs');
let code = fs.readFileSync('public/js/views/products.js', 'utf8');

const oldLadder = `    const ladder = (editing && Array.isArray(base.units) && base.units.length)
      ? base.units.map((u) => ({ code: u.code || u.unit_code, name: u.name, quantity_in_base: u.quantity_in_base, is_base: Boolean(Number(u.is_base)) }))
      : [{ code: 'PIECE', name: base.base_unit_name || 'Piece', quantity_in_base: 1, is_base: true }];
    function paintLadder() {`;

const newLadder = `    const ladder = (editing && Array.isArray(base.units) && base.units.length)
      ? base.units.map((u) => ({ code: u.code || u.unit_code, name: u.name, quantity_in_base: u.quantity_in_base, is_base: Boolean(Number(u.is_base)) }))
      : [{ code: 'PIECE', name: base.base_unit_name || 'Piece', quantity_in_base: 1, is_base: true }];
    ladder.sort((a, b) => Number(a.quantity_in_base || 0) - Number(b.quantity_in_base || 0));
    function paintLadder() {`;

code = code.replace(oldLadder, newLadder);
fs.writeFileSync('public/js/views/products.js', code);
console.log("Patched ladder initial sort in products.js");
