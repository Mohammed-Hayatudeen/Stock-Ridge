const fs = require('fs');
let code = fs.readFileSync('server/routes/sales.js', 'utf8');

const oldDiscount = `    discountAmount: raw.discount_amount != null || raw.discountAmount != null ? Number(raw.discount_amount ?? raw.discountAmount) : null,`;
const newDiscount = `    discountAmount: raw.discount_amount != null || raw.discountAmount != null || raw.line_discount != null || raw.lineDiscount != null ? Number(raw.discount_amount ?? raw.discountAmount ?? raw.line_discount ?? raw.lineDiscount) : null,`;

code = code.replace(oldDiscount, newDiscount);
fs.writeFileSync('server/routes/sales.js', code);
console.log("Patched sales.js discountAmount");
