import fs from 'node:fs';
const doc = fs.readFileSync('docs/DEMO_SIGNINS.md', 'utf8');
const row = doc.split('\n').find((line) => line.includes('bmstaff1abuja'));
const cells = row.split('|').map((cell) => cell.trim());
console.log(cells);
const username = cells[1].replaceAll('`', '');
const pin = cells[4].replaceAll('`', '');
console.log(username, pin);
const base = 'https://beta.stockridge0.workers.dev';
const login = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ username, pin, remember: false, deviceId: 'deploy-smoke-demo' }),
});
const auth = await login.json();
console.log("Auth:", auth);
const profile = auth.profile;
if (profile) {
  const query = new URLSearchParams({ business_id: profile.businessId, branch_id: profile.branchId });
  const dashboard = await fetch(base + '/api/dashboard?' + query, {
      headers: { authorization: 'Bearer ' + auth.token, accept: 'application/json' },
  });
  console.log("Dashboard status:", dashboard.status);
}
