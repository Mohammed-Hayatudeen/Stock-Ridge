#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function gradleInvocation({ platform = process.platform, root = path.resolve(__dirname, '..'), release = false, wrapperExists = fs.existsSync } = {}) {
  const windows = platform === 'win32';
  const platformPath = windows ? path.win32 : path;
  const android = platformPath.join(root, 'android');
  const task = release ? 'assembleRelease' : 'assembleDebug';
  const gradlew = platformPath.join(android, windows ? 'gradlew.bat' : 'gradlew');
  const executable = wrapperExists(gradlew) ? gradlew : 'gradle';
  return {
    // Keep the quoted executable and task as distinct verbatim cmd arguments.
    // /s outer-quote rewriting would otherwise merge the task into the filename.
    command: windows ? (process.env.ComSpec || 'cmd.exe') : executable,
    args: windows ? ['/d', '/c', `"${executable}"`, task] : [task],
    options: {
      cwd: android,
      stdio: 'inherit',
      shell: false,
      // Preserve the explicit cmd /s /c quoting instead of letting Node quote it again.
      windowsVerbatimArguments: windows,
    },
  };
}

function run() {
  const { command, args, options } = gradleInvocation({ release: process.argv[2] === 'release' });
  const result = spawnSync(command, args, options);
  if (result.error) {
    console.error(`Gradle could not start: ${result.error.message}`);
    console.error('Install JDK 17 and Android SDK 35, then run `gradle wrapper --gradle-version 8.9` in android/ if the wrapper is unavailable.');
    return 1;
  }
  return result.status == null ? 1 : result.status;
}

if (require.main === module) process.exit(run());

module.exports = { gradleInvocation, run };
