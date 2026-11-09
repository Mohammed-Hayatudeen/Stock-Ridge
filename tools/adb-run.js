const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function findAdb() {
  const possiblePaths = [
    process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : null,
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'android-sdk', 'platform-tools', 'adb.exe')
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const adb = findAdb();
if (!adb) {
  console.error('Could not find Android SDK platform-tools. Is Android Studio installed?');
  process.exit(1);
}

const args = process.argv.slice(2);
console.log(`Using adb: ${adb}`);
console.log(`Running: adb ${args.join(' ')}\n`);

try {
  execSync(`"${adb}" ${args.join(' ')}`, { stdio: 'inherit' });
} catch (err) {
  // Exit with adb's exit code
  process.exit(err.status || 1);
}
