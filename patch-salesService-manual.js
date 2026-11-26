const fs = require('fs');
let code = fs.readFileSync('server/services/salesService.js', 'utf8');

const oldManual = `const manual = manualPriceOverrides[i] != null ? manualPriceOverrides[i] : (line.manualPrice != null ? line.manualPrice : null);`;
const newManual = `const manualOverride = manualPriceOverrides[String(product.id)];
    const manual = manualOverride != null ? (manualOverride.to != null ? manualOverride.to : manualOverride) : (line.manualPrice != null ? line.manualPrice : null);`;

code = code.replace(oldManual, newManual);
fs.writeFileSync('server/services/salesService.js', code);
console.log("Patched manualPriceOverrides in salesService.js");
