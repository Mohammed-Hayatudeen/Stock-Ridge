# StockRidge

Multi-branch inventory, POS and back-office for Nigerian retail and wholesale businesses. This is **one repository** for the shared application and every client.

## Architecture

- `worker/` — the only cloud runtime. It serves the PWA and shared `/api` routes and **requires Turso**. There is no alternate cloud database, adapter, binding or migration path.
- `server/routes/`, `server/services/`, `server/lib/`, `domain/` — runtime-independent business and API code imported by the Worker.
- `schema/migrations/` — append-only Turso SQL migrations, administered explicitly with `tools/turso-admin.js`.
- `public/` — installable offline-capable PWA, IndexedDB mirror and outbox.
- `electron/` + `lib/` — context-isolated Electron shell with encrypted device-local SQLite for offline operation. Remote reads/writes still pass through the Worker to Turso; the shell never receives the Turso token.
- `android/` — native Android WebView wrapper around the same deployed PWA/Worker. It contains no database credentials.

Repository: **https://github.com/Mohammed-Hayatudeen/Stock-Ridge**

## Source recovery status

The supplied `o.txt` was a concatenated partial source export. The recoverable API, domain, schema, storage and wrapper code was separated into this tree. The 34 browser files omitted by that export—including `public/js/app.js` and the complete `public/js/views/` directory—were subsequently restored unchanged from the original `10client/stockridge` GitHub source. `npm run check` now verifies all 52 browser assets referenced by `public/index.html` and blocks distribution if any asset goes missing again.

The one-time recovery helper is `tools/recover-upload.py`; it expects the original upload at `/tmp/arena-coding-uploads/o.txt` and is not part of normal development or builds.

## Install and verify

Use Node.js 22.12 or newer:

```bash
npm ci
npm test
npm run check
```

Compile the Worker without deploying it:

```bash
npx wrangler deploy --dry-run --env "" --config worker/wrangler.toml --outdir .cache/worker-dry-run
```

## Worker and Turso

Set secrets through Wrangler, never in `worker/wrangler.toml` or Git:

```bash
npx wrangler secret put TURSO_AUTH_TOKEN --env "" --config worker/wrangler.toml
npx wrangler secret put JWT_SECRET --env "" --config worker/wrangler.toml
```

For explicit local Turso administration, copy `.env.example` to `.env.deploy`, fill it, then run the required command. These commands can write to the selected remote Turso database; do not run them against production unintentionally:

```bash
npm run turso:check
npm run turso:migrate
```

A deployment is a separate authorized operation:

```bash
npm run worker:deploy
```

For an authorized agent terminal with GitHub, Turso and Cloudflare egress, the complete push-and-deploy procedure is also available as one fail-fast command. It reads credentials from the ignored `.env.deploy`, prints no secrets, and refuses to run on any other branch:

```bash
./tools/agent-deploy.sh
```

In the restricted Arena sandbox, GitHub Actions can provide the external egress instead. The `Deploy StockRidge production` workflow runs on pushes to `arena/710a3fbd-stock-ridge`, but requires the five repository Actions secrets named in `.github/workflows/deploy.yml`; repository-secret administration cannot be bypassed by the workflow.

## Electron development and builds

Development window (uses this checkout's `public/`):

```bash
npm ci
npm run electron:start
```

Optional Worker override:

```bash
# macOS / Linux
STOCKRIDGE_ORIGIN=https://your-worker.example.com npm run electron:start
```

```powershell
# Windows PowerShell
$env:STOCKRIDGE_ORIGIN = "https://your-worker.example.com"
npm run electron:start
```

Build the unpacked Windows application on Windows:

```powershell
npm ci
npm test
npm run electron:build:win
```

Output: `dist/win-unpacked/StockRidge.exe`.

Build Linux AppImage on Linux:

```bash
npm ci
npm test
npm run electron:build:linux
```

Build macOS ZIP and DMG on macOS:

```bash
npm ci
npm test
npm run electron:build:mac
```

To bake a particular Worker origin into an artifact, set `STOCKRIDGE_ORIGIN` before the build command. Windows artifacts are unsigned unless appropriate signing configuration is added.

## Android builds

Prerequisites: JDK 17, Android SDK Platform 35, Android Build Tools 35.0.0, and accepted SDK licences. Set `ANDROID_HOME` (or create the ignored `android/local.properties` with `sdk.dir=...`). Edit `android/app/src/main/res/values/strings.xml` to select the Worker origin before building.

Debug APK, on macOS/Linux or Windows with Node available:

```bash
npm run android:build
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

Direct Gradle equivalents:

```bash
# macOS / Linux
cd android
./gradlew assembleDebug
```

```powershell
# Windows PowerShell
cd android
.\gradlew.bat assembleDebug
```

Install the debug APK on exactly one connected phone/emulator:

```bash
npm run android:install
```

Release APK:

```bash
npm run android:build:release
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. Configure a private upload/signing key before distributing a release; do not commit it. An APK rebuild does not deploy the Worker or PWA, and a Worker deployment does not rebuild Electron or Android.
