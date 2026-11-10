'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name));

function assertPng(name, size) {
  const png = read(name);
  assert.equal(png.subarray(1, 4).toString(), 'PNG', `${name} is a PNG`);
  assert.equal(png.readUInt32BE(16), size, `${name} width`);
  assert.equal(png.readUInt32BE(20), size, `${name} height`);
  assert.ok(png.length > 500, `${name} contains rendered artwork`);
}

test('premium vector mark is consistent across browser brand surfaces', () => {
  const master = read('public/brand/stockridge-logo.svg');
  assert.equal(master.toString(), read('public/brand/mark.svg').toString());
  assert.equal(master.toString(), read('public/icons/icon.svg').toString());
});

test('PWA and Electron raster icons have their required dimensions', () => {
  for (const [name, size] of Object.entries({
    'favicon.png': 32,
    'apple-touch.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
    'icon-maskable-512.png': 512,
    'icon-1024.png': 1024,
  })) assertPng(`public/icons/${name}`, size);
  assertPng('public/brand/mark.png', 512);
  assert.ok(read('public/brand/logo.jpg').length > 500);

  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  for (const size of ['192x192', '512x512']) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === size), `manifest includes ${size}`);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  assert.match(read('tools/stage-ui.js').toString(), /icon-1024\.png/);
  assert.match(read('electron/main.js').toString(), /icon-512\.png/);
});

test('Android launcher uses branded legacy and adaptive resources', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml').toString();
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  for (const [density, legacy, adaptive] of [
    ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
  ]) {
    assertPng(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, legacy);
    assertPng(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, legacy);
    assertPng(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, adaptive);
  }
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = read(`android/app/src/main/res/mipmap-anydpi-v26/${name}`).toString();
    assert.match(xml, /<adaptive-icon/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
    assert.match(xml, /@color\/ic_launcher_background/);
  }
});

test('every local service-worker shell asset exists', () => {
  const worker = read('public/sw.js').toString();
  const shell = worker.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  for (const match of shell.matchAll(/'(\/[^']+)'/g)) {
    const pathname = match[1].split('?')[0];
    if (pathname === '/') continue;
    assert.ok(fs.existsSync(path.join(root, 'public', pathname)), `missing cached asset ${pathname}`);
  }
});
