const fs = require('fs');
let content = fs.readFileSync('domain/crypto.js', 'utf8');

const hashPinFind = `async function hashPin(pin, saltHex) {
  const salt = saltHex ? base64urlToBytes(saltHex) : globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await cryptoSubtle().importKey('raw', toBytes(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await cryptoSubtle().deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, PBKDF2_KEY_LENGTH_BITS,
  );
  const hashHex = bytesToHex(new Uint8Array(bits));`;
  
const hashPinReplace = `async function hashPin(pin, saltHex) {
  const salt = saltHex ? base64urlToBytes(saltHex) : globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  let hashHex;
  // Use node:crypto for massive local performance boost during PBKDF2 if available
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const { pbkdf2Sync } = require('node:crypto');
    hashHex = bytesToHex(pbkdf2Sync(String(pin), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH_BITS / 8, 'sha256'));
  } else {
    const key = await cryptoSubtle().importKey('raw', toBytes(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await cryptoSubtle().deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      key, PBKDF2_KEY_LENGTH_BITS,
    );
    hashHex = bytesToHex(new Uint8Array(bits));
  }`;

content = content.replace(hashPinFind, hashPinReplace);

const verifyPinFind = `    const salt = base64urlToBytes(parts[3]);
    const key = await cryptoSubtle().importKey('raw', toBytes(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await cryptoSubtle().deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, PBKDF2_KEY_LENGTH_BITS,
    );
    const candidate = bytesToHex(new Uint8Array(bits));`;

const verifyPinReplace = `    const salt = base64urlToBytes(parts[3]);
    let candidate;
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const { pbkdf2Sync } = require('node:crypto');
      candidate = bytesToHex(pbkdf2Sync(String(pin), salt, iterations, PBKDF2_KEY_LENGTH_BITS / 8, 'sha256'));
    } else {
      const key = await cryptoSubtle().importKey('raw', toBytes(pin), 'PBKDF2', false, ['deriveBits']);
      const bits = await cryptoSubtle().deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, PBKDF2_KEY_LENGTH_BITS,
      );
      candidate = bytesToHex(new Uint8Array(bits));
    }`;

content = content.replace(verifyPinFind, verifyPinReplace);

fs.writeFileSync('domain/crypto.js', content);
console.log('patched domain/crypto.js');
