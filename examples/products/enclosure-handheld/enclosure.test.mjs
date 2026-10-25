import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname, dir = mkdtempSync(join(tmpdir(), 'enclosure-test-'));
let api;
try {
  await build({ stdin: { contents: "export * from './build.ts'; export * from './check.ts'; export { BodyQuery } from '../../../packages/barocss-cad-model/src/api';", resolveDir: here, loader: 'ts' },
    outfile: join(dir, 'p2.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
    define: { 'import.meta.dirname': JSON.stringify(here) }, nodePaths: [join(here, '../../../packages/barocss-cad-model/node_modules')] });
  api = await import(pathToFileURL(join(dir, 'p2.mjs')).href);
} finally { rmSync(dir, { recursive: true, force: true }); }

for (const [name, make] of [['heat-sink', api.heatSink], ['board', api.board], ['cell-18650', api.cell], ['insert-m3', api.insert]]) {
  test(`${name}: exact volume meets the independent closed form`, () => {
    const p = make(), doc = JSON.stringify(p.doc);
    const volume = p.bodies().reduce((sum, key) => sum + p.body(key).mass({ density: 1 }).volume, 0);
    assert.ok(api.checkVolume(name, volume).ok, JSON.stringify(api.checkVolume(name, volume)));
    assert.equal(JSON.stringify(p.doc), doc);
  });
}

test('the oracle rejects missing, nonfinite and incorrect volumes', () => {
  for (const actual of [0, NaN, Infinity, api.VOLUMES.board * 1.001]) assert.equal(api.checkVolume('board', actual).ok, false);
  assert.equal(api.checkVolume('unknown', 1).ok, false);
});

test('a lone board cannot pass the product checker', async () => {
  const doc = api.board().doc;
  const result = await api.checkEnclosure(doc);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find(c => c.id === 'parts').ok, false);
  assert.equal(result.checks.find(c => c.id === 'locks').ok, false);
  assert.equal(result.checks.find(c => c.id === 'connector-rows').code, 'P2_CONNECTOR_ROWS_REQUIRED');
});

test('partMass keeps the geometry volume when the placeholder has no material', () => {
  const mass = api.partMass(api.board());
  assert.ok(api.checkVolume('board', mass.volume).ok);
  assert.equal(mass.mass, null);
});

const face = (name, area, x = 0) => ({ name, kind: 'plane', normal: [0, 0, -1], centroid: [x, 0, 0], area, edges: [] });
test('support selection uses area or location and preserves ambiguous ties', () => {
  const query = new api.BodyQuery([], [face('floor', 100), face('boss', 10, 4)]);
  assert.deepEqual(api.flatAt(-1, 0)(query).names(), ['floor']);
  assert.deepEqual(api.flatAt(-1, 0, [4, 0])(query).names(), ['boss']);
  assert.equal(api.flatAt(-1, 0)(new api.BodyQuery([], [face('a', 10), face('b', 10)])).count, 2);
});
