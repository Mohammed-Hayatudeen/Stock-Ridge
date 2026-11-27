// PROTOCOL: Always reference the agent.md file before any further fix on this page.
const { createTursoDatabase } = require('../worker/src/turso');
const { verifyPin } = require('../domain/crypto');
async function run() {
  const db = createTursoDatabase({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  const user = await db.first("SELECT id, username, pin_hash, is_active FROM users WHERE username = 'admin'");
  console.log("User:", user);
  if (!user) return;
  const pinOk = await verifyPin('7000', user.pin_hash);
  console.log("PIN OK?", pinOk);
}
run().catch(console.error);
