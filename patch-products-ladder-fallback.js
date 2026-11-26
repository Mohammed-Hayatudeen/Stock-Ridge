const fs = require('fs');
let code = fs.readFileSync('public/js/views/products.js', 'utf8');

const oldMap = `      ? base.units.map((u) => ({ code: u.code || u.unit_code, name: u.name, quantity_in_base: u.quantity_in_base, is_base: Boolean(Number(u.is_base)) }))`;
const newMap = `      ? base.units.map((u) => ({ code: u.code || u.unit_code, name: u.name, quantity_in_base: u.quantity_in_base !== undefined ? u.quantity_in_base : u.quantityInBase, is_base: Boolean(Number(u.is_base)) }))`;

code = code.replace(oldMap, newMap);
fs.writeFileSync('public/js/views/products.js', code);
console.log("Patched ladder fallback in products.js");
