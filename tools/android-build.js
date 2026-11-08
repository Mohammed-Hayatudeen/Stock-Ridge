#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function gradleInvocation({ platform = process.platform, root = path.resolve(__dirname, '..'), release = false } = {}) {
  const android = path.join(root, 'android');
  const task = release ? 'assembleRelease' : 'assembleDebug';
  const gradlew = path.join(android, platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  return {
    command: fs.existsSync(gradlew) ? gradlew : 'gradle',
    args: [task],
    options: {
      cwd: android,
      stdio: 'inherit',
      // Current Node releases refuse to spawn Windows batch files directly
      // with shell:false (EINVAL). The task and path are not user input.
      shell: platform === 'win32',
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
