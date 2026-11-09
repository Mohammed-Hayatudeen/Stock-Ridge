# StockRidge multi-client deployment runbook

Operational guide for deploying **isolated StockRidge installations for different clients** from one Windows workstation. Updated for the current single-repository Worker/Turso, PWA, Electron, and Android structure.

## 1. Non-negotiable isolation rule

**One client checkout → one Git remote → one Cloudflare account → one Worker → one Turso database → one set of secrets.**

A single installation may contain many businesses and branches belonging to that client. Different clients must not share a Worker, Turso database, JWT secret, authentication token, backup, or offline demonstration accounts.

The demonstration installation at `https://beta.stockridge.workers.dev` is not a template database for a new client. Never point a client at its Turso URL.

## 2. Current architecture

| Component | Location | Deployment behavior |
|---|---|---|
| Cloudflare Worker | `worker/` | Only cloud runtime; serves API and PWA assets |
| Turso | External Turso database | Only cloud database; no D1 fallback |
| Shared business/API code | `domain/`, `server/` | Imported by the Worker |
| Migrations | `schema/migrations/` | Immutable, append-only SQL |
| PWA | `public/` | Published as part of Worker deployment |
| Electron | `electron/`, `lib/` | Built separately on the target desktop OS |
| Android | `android/` | Built separately as a native APK |

There is no separate Pages site, alternate cloud database, or native application embedded in a Worker deployment.

## 3. Prerequisites

On the Windows deployment workstation install:

- Windows Terminal / PowerShell and VS Code
- Git for Windows and access to the intended GitHub account
- Node.js **22.12 or newer**, including npm
- Access to the intended Cloudflare account
- A Turso organization/database for the client
- A private deployment register outside Git
- For Android: JDK 17, Android SDK Platform 35, Build Tools 35.0.0, accepted SDK licences, and ADB for installation
- For Electron: build on the operating system you intend to distribute

Do not use the sandbox's or another operator's credentials. Use the client/operator's existing authenticated tools and secure secret storage.

## 4. Create a separate checkout

Recommended layout:

```text
C:\StockRidgeClients\
├── NorthlineStores\stockridge\
├── HarbourMart\stockridge\
└── Demonstration\Stock-Ridge\
```

Clone a fresh checkout for each client:

```powershell
New-Item -ItemType Directory -Force "C:\StockRidgeClients\NorthlineStores"
Set-Location "C:\StockRidgeClients\NorthlineStores"
git clone https://github.com/<client-owner>/<client-repository>.git stockridge
Set-Location stockridge
git remote -v
```

Do not repeatedly edit one checkout to switch clients. A path containing spaces is supported; the Android launcher uses discrete process arguments.

## 5. Maintain a deployment register outside Git

Record identifiers, not secrets:

| Field | Example |
|---|---|
| Client | Northline Stores |
| Checkout | `C:\StockRidgeClients\NorthlineStores\stockridge` |
| Git remote | `github.com/northline-org/stockridge` |
| Cloudflare account | Secure account identifier |
| Worker | `northline-stockridge` |
| Turso URL | Client-specific HTTPS/libSQL URL |
| Application URL | `https://northline-stockridge.<account>.workers.dev` |
| Android application ID | Client-specific, if rebranded |

Keep Cloudflare tokens, Turso tokens, JWT secrets, signing keys, and real-user PINs in approved secret storage—not in this register or Git.

### Multiple GitHub accounts on one Windows computer

Use a distinct existing GitHub identity for each client repository. HTTPS credential managers can select accounts per remote; SSH users can instead maintain separate host aliases. Never overwrite an existing key or change another account's configuration.

For SSH, create/register a client-specific key through the client's approved GitHub process, then add an entry to `$HOME\.ssh\config`:

```sshconfig
Host github-northline
    HostName github.com
    User git
    IdentityFile C:/Users/YourName/.ssh/id_ed25519_github_northline
    IdentitiesOnly yes
```

Use that alias only in the matching client checkout:

```powershell
git remote set-url origin git@github-northline:northline-org/stockridge.git
ssh -T github-northline
git remote -v
```

Expected: GitHub identifies the intended account. Keep private keys out of the repository and never print them. GitHub CLI authentication (`gh auth status`) is separate from Git SSH authentication; success in one does not prove the other. If organization SSO applies, authorize the key/credential for that organization.

Add the SSH alias or HTTPS account label to the deployment register. Stop if authentication resolves to another client's account.

### One client database, three application surfaces

For each client, the PWA, Electron application, and Android application all use that client's **same Worker and Turso database**. Electron's local SQLite is an encrypted offline store/queue, not a second cloud ledger. Android is a WebView around the Worker and does not open Electron's SQLite file.

Do not create separate Turso databases for the phone and desktop, and never place Turso tokens in Electron or Android. Different staff can use the three surfaces concurrently; account/session behavior still follows the application's authentication rules.

## 6. Install and verify the source

From the client checkout root:

```powershell
npm ci
npm test
npm run check
```

Expected gates:

- All tests pass.
- The source check reports all 52 browser assets present.
- The Worker is Turso-only and wrapper entry points are valid.

Do not deploy after a failed gate.

## 7. Configure the client Worker

Edit `worker/wrangler.toml` in the client checkout:

```toml
name = "northline-stockridge"
main = "src/index.mjs"
compatibility_date = "2026-11-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "../public"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/diagnose"]

[vars]
ENVIRONMENT = "production"
DB_NAME = "northline-stockridge"
TURSO_DATABASE_URL = "https://<client-database>.<client-org>.turso.io"

[observability]
enabled = true
```

Use the client's own Worker name and Turso URL. The top-level configuration is production; omitting `--env` does **not** mean staging. The checked-in `staging` block is only a template and requires a separate staging Turso URL before use.

The `sample` environment belongs to the existing demonstration structure. Do not reuse it for an unrelated client.

## 8. Configure credentials safely

Before deployment, verify both identity and target:

```powershell
git remote -v
gh auth status
npx wrangler whoami --config worker/wrangler.toml
Select-String -Path .\worker\wrangler.toml -Pattern '^name =|TURSO_DATABASE_URL'
```

`gh auth status` is optional when GitHub CLI is not used. Compare every result with the client register. Cloudflare authentication must belong to the intended client account, not merely the last account used on the workstation.

### Local operator terminal

Copy `.env.example` to `.env.deploy` and populate it locally. Add the Cloudflare values required by the deployment helper:

```dotenv
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
JWT_SECRET=
```

Use a unique, randomly generated JWT secret of at least 32 characters. `.env.deploy` is ignored by Git. Verify:

```powershell
git check-ignore .env.deploy
git status --short
```

### GitHub Actions

For a push-based deployment, configure these repository Actions secrets in the client's repository:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`

Update the workflow's branch and checkout ref for that client's own repository/branch policy. Never copy another client's secret values.

## 9. Apply Turso migrations

Confirm the target URL identifies the client's empty/intended database, then run:

```powershell
npm run turso:check
npm run turso:migrate
```

The current migration sequence is:

1. `0001_schema.sql`
2. `0002_nigerian_market.sql`
3. `0003_nafdac_catalog.sql`
4. `0004_sync_indexes.sql`

Never edit an applied migration. Add a new migration for later schema changes. Do not create D1 bindings or run D1 migration commands.

## 10. Deploy the Worker and PWA

### Preferred repository workflow

Push the reviewed client configuration to the branch configured in `.github/workflows/deploy.yml`, or manually dispatch that workflow. It performs dependency installation, tests, source checks, Turso checks/migrations, Worker deployment, and readiness verification.

The checked-in `production-seed-request.txt` mechanism is specific to the synthetic demonstration dataset. Do not add that marker for a real client.

### Direct authorized terminal

```powershell
printf '%s' "$env:TURSO_AUTH_TOKEN" | npx wrangler secret put TURSO_AUTH_TOKEN --env "" --config worker/wrangler.toml
printf '%s' "$env:JWT_SECRET" | npx wrangler secret put JWT_SECRET --env "" --config worker/wrangler.toml
npx wrangler deploy --dry-run --env "" --config worker/wrangler.toml --outdir .cache/worker-dry-run
npm run worker:deploy
```

In PowerShell, `printf` may not be available as desired; alternatively use the repository's Unix `tools/agent-deploy.sh` in a compatible shell with a complete `.env.deploy`, or run `npx wrangler secret put ...` interactively. Do not paste tokens into source files.

The helper also requires the exact working branch configured in that script; adjust it only in the client's independent checkout to match its approved deployment branch.

## 11. Verify production readiness

```powershell
$AppUrl = "https://northline-stockridge.<account>.workers.dev"
Invoke-RestMethod "$AppUrl/api/diagnose"
Start-Process $AppUrl
```

Confirm:

- JSON reports `ok: true`, not HTML.
- Turso is connected.
- The expected table/view and migration counts are reported.
- The Worker name and URL belong to this client.
- The browser opens StockRidge and not another application.

Deployment/readiness does not prove login, native installation, physical offline behavior, printers, scanners, cameras, or multi-device contention; test those separately.

## 12. Provision the first real business and users

Use the application's authorized setup/administration flow. Do not insert chart-of-account, branch, role, or user rows manually in SQL.

1. Create the client's first business.
2. Select its vertical and give the first branch a real code.
3. Create the owner/proprietor through the application.
4. Create general managers, branch managers, and staff with the correct business/branch scope.
5. Deliver real credentials privately and require appropriate credential rotation.
6. Sign in as each role and verify visible businesses/branches and permissions.

Available vertical codes:

- `ELECTRONICS`
- `FURNITURE`
- `WHOLESALE_RETAIL`
- `BUILDING_MATERIALS`
- `EVENT_RENTAL`
- `EQUIPMENT_RENTAL`
- `LEASING`
- `SELL_AND_LEASE`
- `PROVISIONS_FABRICS`
- `PHARMACEUTICAL`
- `SUPERMARKET`
- `WATER_PACKING`
- `BAKERY`
- `GENERAL_RETAIL`

Multiple trades belonging to the same client can be separate businesses in the same installation. Do not use the committed `docs/DEMO_SIGNINS.md` accounts for real-client access.

## 13. Optional custom domain

The domain must belong to the same Cloudflare account. Add a route to the deployed Worker configuration:

```toml
[[routes]]
pattern = "app.northline.example"
custom_domain = true
```

Redeploy the same target, then verify `https://app.northline.example/api/diagnose`. Keep Worker assets and `/api/*` on the same application hostname.

## 14. Electron: complete Windows build and run sequence

Run every command from the client repository root unless a command changes the directory. A Worker deployment does not build or update Electron.

### 14.1 Prepare and optionally run the development window

```powershell
Set-Location "C:\StockRidgeClients\NorthlineStores\stockridge"
git pull
npm ci
npm test
npm run check
$AppUrl = "https://northline-stockridge.<account>.workers.dev"
$env:STOCKRIDGE_ORIGIN = $AppUrl
npm run electron:start
```

Close the development window before packaging. The optional origin override selects this client's Worker; do not put a Turso token in it.

### 14.2 Build and open the unpacked Windows application

```powershell
npm run electron:build:win
Get-Item .\dist\win-unpacked\StockRidge.exe
& .\dist\win-unpacked\StockRidge.exe
```

Output: `dist\win-unpacked\StockRidge.exe`. Confirm the executable opens and connects to `$AppUrl`. This is an unpacked, unsigned Windows build—not a signed installer. Linux AppImage and macOS ZIP/DMG commands are in `README.md`.

Electron uses encrypted device-local SQLite for offline data but still sends remote reads/writes through the Worker. Never embed or copy the Turso token into the desktop checkout or handover folder.

## 15. Android: SDK, debug, signed release, and installation

### 15.1 Configure the SDK

```powershell
Set-Location "C:\StockRidgeClients\NorthlineStores\stockridge"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Test-Path "$sdk\platforms\android-35"
Test-Path "$sdk\build-tools\35.0.0"
Test-Path "$sdk\platform-tools\adb.exe"
"sdk.dir=$($sdk -replace '\\', '/')" | Set-Content .\android\local.properties -Encoding ascii
Get-Content .\android\local.properties
git check-ignore .\android\local.properties
java -version
node -v
```

All three `Test-Path` checks must be `True`; `git check-ignore` must print the local-properties path. Node must be 22.12+ and Java 17. If Android Studio uses another SDK location, use that path instead. Never commit `local.properties`.

Set the Worker origin in `android\app\src\main\res\values\strings.xml` before building. It must be the same `$AppUrl` used by Electron, not another client's Worker.

### 15.2 Build and verify the debug APK

```powershell
npm ci
npm test
npm run check
npm run android:build
$DebugApk = Resolve-Path .\android\app\build\outputs\apk\debug\app-debug.apk
$DebugApk
& "$sdk\build-tools\35.0.0\apksigner.bat" verify --verbose --print-certs $DebugApk
```

Expected APK: `android\app\build\outputs\apk\debug\app-debug.apk`. Android Gradle Plugin signs the debug build with the machine's debug key. `apksigner verify` must succeed; the debug certificate is for testing, not client release distribution.

### 15.3 Install debug through ADB

Enable Developer Options and USB debugging on one authorized phone. Connect a data cable, unplug other phones, close emulators, and accept the phone's authorization prompt.

```powershell
$adb = "$sdk\platform-tools\adb.exe"
& $adb devices
& $adb install -r $DebugApk
& $adb shell am start -n com.stockridge.till/.MainActivity
```

`adb devices` must show exactly one authorized entry ending in `device`, and installation must print `Success`. The npm equivalent that rebuilds first is:

```powershell
npm run android:install
```

For manual phone installation, copy only `app-debug.apk` to the phone and open it. Allow installation from the chosen file manager only when the operator approves. Do not use the unsigned release APK for manual testing.

If Android reports a signature conflict, an older StockRidge build was signed with another key. Preserve required offline data first, then remove that test package and reinstall. Do not clear or uninstall a till containing unsynced sales.

### 15.4 Create and protect a private client release key

Create the key once per client, outside every Git checkout. Use a unique alias and strong passwords entered at the prompts; do not put passwords on the command line or in Git.

```powershell
$PrivateKeyDir = "C:\StockRidgeClients\PrivateKeys\NorthlineStores"
New-Item -ItemType Directory -Force $PrivateKeyDir
$javaExe = (Get-Command java).Source
$jdkHome = Split-Path (Split-Path $javaExe -Parent) -Parent
$keytool = Join-Path $jdkHome "bin\keytool.exe"
$Keystore = Join-Path $PrivateKeyDir "northline-upload.jks"
Test-Path $Keystore
& $keytool -genkeypair -v -keystore $Keystore -alias northline-upload -keyalg RSA -keysize 4096 -validity 10000
& $keytool -list -v -keystore $Keystore -alias northline-upload
```

If `Test-Path $Keystore` is already `True`, **stop**: do not overwrite the existing key. Back up the keystore and its passwords separately in approved secret storage. Losing the release key can prevent normal application updates. Restrict the private-key directory to authorized operators; never copy it into the repository, phone, APK output, Actions artifacts, or support messages.

For Google Play, follow the client's Play App Signing/upload-key arrangement. The upload key and Play's app-signing key are distinct roles; follow the Play Console instructions for that client rather than assuming this local key is Play's final signing key.

### 15.5 Build the unsigned release APK

```powershell
Set-Location "C:\StockRidgeClients\NorthlineStores\stockridge"
npm test
npm run check
npm run android:build:release
$UnsignedApk = Resolve-Path .\android\app\build\outputs\apk\release\app-release.apk
$UnsignedApk
```

Direct Gradle fallback:

```powershell
Set-Location .\android
.\gradlew.bat assembleRelease
Set-Location ..
```

The current build configuration intentionally produces an unsigned release APK. Android can reject that unsigned package as `App not installed as package appears to be invalid`; this is a signing issue, not a failed Gradle build.

### 15.6 Align, sign, and verify the release APK

Run ZIP alignment before signing. The commands prompt for the keystore/key passwords without recording them in PowerShell history.

```powershell
$BuildTools = "$sdk\build-tools\35.0.0"
$AlignedApk = Join-Path $PrivateKeyDir "northline-release-aligned.apk"
$SignedApk = Join-Path $PrivateKeyDir "northline-release-signed.apk"
& "$BuildTools\zipalign.exe" -p -f 4 $UnsignedApk $AlignedApk
& "$BuildTools\apksigner.bat" sign --ks $Keystore --ks-key-alias northline-upload --out $SignedApk $AlignedApk
& "$BuildTools\zipalign.exe" -c -v 4 $SignedApk
& "$BuildTools\apksigner.bat" verify --verbose --print-certs $SignedApk
Get-Item $SignedApk
```

Alignment verification and signature verification must both succeed. Distribute only the verified signed APK. Do not distribute the aligned-but-unsigned intermediate file. Keep the signed output outside Git; APK paths are already ignored.

For later releases, increment `versionCode` and `versionName` in `android/app/build.gradle`, rebuild, align, and sign with the **same client key**. A different key produces an update/signature conflict rather than a normal upgrade.

### 15.7 Install and open the signed release

```powershell
& $adb devices
& $adb install -r $SignedApk
& $adb shell am start -n com.stockridge.till/.MainActivity
```

For manual distribution, copy `$SignedApk` to the authorized phone and install it. Verify the app opens, points to `$AppUrl`, and supports the intended demo or real account. Remove test accounts and demo access before a real-client handover.

The Windows npm launcher supports checkout paths containing spaces. Java deprecation notes and SDK XML-version warnings did not block the verified build, but any failed `apksigner`, `zipalign`, ADB, compile, or test command is a stop condition.

### Verified Windows build evidence

On 2026-11-09, the operator's Windows terminal confirmed Electron packaging at `dist\win-unpacked\StockRidge.exe` and Android `assembleRelease` completed **`BUILD SUCCESSFUL`** in 1m 9s with 42 actionable tasks. This proves packaging only. APK installation, opened-app behavior, and physical offline/hardware checks remain separate acceptance steps. Java deprecation notes and SDK XML version warnings did not block that build.

## 16. First-client acceptance checklist

- [ ] `/api/diagnose` returns healthy JSON for the correct client.
- [ ] Owner can sign in and sees only intended businesses.
- [ ] General manager, branch manager, and staff scopes are correct.
- [ ] Create supplier and receive a small controlled stock batch.
- [ ] Open a till, complete a cash sale, and review the receipt.
- [ ] Close the till against the physical amount.
- [ ] Verify accounting entries and stock movement.
- [ ] Reload the PWA and confirm the current build.
- [ ] Install/open Electron and Android; deployment alone is insufficient.
- [ ] Test real airplane mode, reconnection, queued sync, and duplicate prevention.
- [ ] Test required scanners, cameras, printers, and LAN contention.
- [ ] Record evidence and any failed layer in the client handover.

## 17. Routine updates

From the correct client checkout:

```powershell
git remote -v
git status
git pull
npm ci
npm test
npm run check
npm run turso:check
npm run turso:migrate
npm run worker:deploy
Invoke-RestMethod "$AppUrl/api/diagnose"
```

Prefer the reviewed GitHub Actions workflow when that is the client's deployment policy. Rebuild native applications only when native/shared assets or configuration require it; a Worker update does not replace installed APKs or Electron binaries.

## 18. Rollback and recovery

- Revert the application change through Git and redeploy the same client target.
- Do not rewrite applied migrations to roll back code.
- A Worker rollback does not reverse data writes or remove a new schema migration.
- Restore client data only from that client's verified backup and under an explicit recovery plan.
- Never run destructive reset/format/copy scripts against live books.
- Preserve offline outboxes before clearing application/device data.

## 19. Stop immediately if

- The Worker or Turso URL still identifies `stockridge`, `stock2`, or the demonstration deployment.
- Git remote, checkout, Cloudflare account, Worker, and database disagree with the register.
- `git status` shows `.env.deploy`, tokens, SQL dumps, databases, signing keys, or real credential documents.
- `/api/diagnose` returns HTML or identifies another application.
- A migration/test/source gate fails.
- A command would reset users/PINs, delete businesses, or copy another database.
- You are about to run the synthetic demo seed for a real client.
- A native build is being described as installed/opened without actual device evidence.

Correct the target or failed layer before continuing. Never “try it and see” against a client's live books.
