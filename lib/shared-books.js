'use strict';

// The PWA, the desktop till, and the Android app use this one cloud database
// at the same time. The local SQLite file is a queue, not a second ledger.
// The Turso token stays on the Worker. It is not in this file.

const SHARED_DATABASE = 'stockridge-pharmaridge.aws-eu-north-1.turso.io';
const PWA_ORIGIN = 'https://beta.stockridge0.workers.dev';
const OFFICE_ORIGIN = 'https://beta.stockridge0.workers.dev';
module.exports = { SHARED_DATABASE, PWA_ORIGIN, OFFICE_ORIGIN };
