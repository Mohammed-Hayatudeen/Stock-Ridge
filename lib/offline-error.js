'use strict';

// Keep the Node checks on the exact renderer decision. The previous second
// implementation still required the whole shop catalogue after the shared
// stock-only rule had shipped.
module.exports = require('../public/js/save-status.js');
'use strict';

// A 502 from the desktop proxy is the shop being unreachable, not a wrong PIN.
// The till must open from the saved verifier instead of stopping on that sentence.

function shopUnreachable(err) {
  if (!err) return false;
  const payload = err.payload && typeof err.payload === 'object' ? err.payload : null;
  const code = String(err.code || (payload && payload.code) || '');
  if (code === 'UPSTREAM_UNREACHABLE' || code === 'OFFLINE') return true;
  const message = String(err.message || (payload && (payload.error || payload.message)) || '');
  if (/shop server could not be reached/i.test(message)) return true;
  if (err.isOffline) return true;
  return Number(err.status) === 0;
}
