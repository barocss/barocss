import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tiles } from './fixtures.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const result = JSON.parse(fs.readFileSync(path.join(here, 'evidence/result.json'), 'utf8'));
assert.equal(result.reference, 'Tailwind 4.3.3');
assert.match(result.chromium, /^\d+\./);
assert.equal(result.viewportScale, 1);
assert.equal(result.animationTimeMs, 500);
assert.equal(result.assetsReady, true);
assert.deepEqual(result.failures, []);
assert.equal(result.tileCount, tiles.length);
assert.ok(tiles.length >= 40 && tiles.length <= 45);
assert.deepEqual(result.tiles.map(t => t.id), tiles.map(t => t.id));
assert.deepEqual(result.showcases.map(s => s.id), ['kiosk', 'chat', 'dashboard']);
assert.match(result.baroBundleSha256, /^[0-9a-f]{64}$/);
assert.match(result.inputSha256, /^[0-9a-f]{64}$/);
for (const row of [...result.tiles, ...result.showcases]) {
  assert.ok(row.pixelDiffPct >= 0 && row.pixelDiffPct <= 100);
  assert.ok(row.meanMaxChannelDelta >= 0 && row.meanMaxChannelDelta <= 255);
}
const observed = result.tiles.filter(t => t.pixelDiffPct > 0).map(t => t.id);
for (const scene of result.showcases) {
  assert.equal(scene.pixelDiffPct, 0);
  for (const mode of ['baro', 'tailwind']) assert.ok(fs.statSync(path.join(here, `evidence/${scene.id}-${mode}.png`)).size > 1000);
  assert.ok(fs.statSync(path.join(here, `evidence/${scene.id}-side-by-side.png`)).size > 1000);
}
const tile = id => result.tiles.find(t => t.id === id);
assert.equal(tile('container-query').tailwindStyle['container-type'], 'inline-size');
assert.match(tile('container-query').tailwindNestedStyle['background-color'], /oklch/);
assert.equal(tile('perspective').tailwindStyle.perspective, '600px');
assert.match(tile('subgrid').tailwindStyle['grid-template-columns'], /subgrid/);
assert.equal(tile('theme-keyframes').tailwindStyle['animation-name'], 'orbit');
assert.match(tile('theme-font').tailwindStyle['font-family'], /Georgia/);
assert.match(tile('backdrop-blur').tailwindStyle['backdrop-filter'], /blur/);
assert.match(tile('mask-radial').tailwindStyle['mask-image'], /radial-gradient/);
assert.equal(tile('scroll-snap').tailwindStyle['scroll-snap-type'], 'x mandatory');
assert.ok(result.darkRuleEvidence.tailwind.length && result.darkRuleEvidence.baro.length);
console.log(`${tiles.length} tiles, ${observed.length} visual differences, three showcase pairs, controls and screenshots verified.`);
