#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android');
const mode = process.argv[2] === 'release' ? 'assembleRelease' : 'assembleDebug';
const gradlew = path.join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const command = fs.existsSync(gradlew) ? gradlew : 'gradle';
const result = spawnSync(command, [mode], { cwd: android, stdio: 'inherit', shell: false });
if (result.error) {
  console.error(`Gradle could not start: ${result.error.message}`);
  console.error('Install JDK 17 and Android SDK 35, then run `gradle wrapper --gradle-version 8.9` in android/ if the wrapper is unavailable.');
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
