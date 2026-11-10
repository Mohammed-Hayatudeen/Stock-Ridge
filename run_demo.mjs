import fs from 'node:fs';
const username = 'bmstaff1abuja';
const pin = '1118';
const base = 'https://beta.stockridge0.workers.dev';
const login = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ username, pin, remember: false, deviceId: 'deploy-smoke-demo' }),
});
const auth = await login.json();
console.log(auth);
const profile = auth.profile;
const query = new URLSearchParams({ business_id: profile.businessId, branch_id: profile.branchId });
const dashboard = await fetch(base + '/api/dashboard?' + query, {
  headers: { authorization: `Bearer ${auth.token}`, accept: 'application/json' },
});
const body = await dashboard.json();
console.log(dashboard.status, body);
