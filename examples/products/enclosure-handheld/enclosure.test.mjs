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
  await build({ stdin: { contents: "export * from './build.ts'; export * from './check.ts'; export { BodyQuery, part } from '../../../packages/barocss-cad-model/src/api'; export { rowKey } from '../../../packages/barocss-cad-model/src/engine/rowSources';", resolveDir: here, loader: 'ts' },
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


// Actual producer documents, serialized as Save/Open data. No invented fastener row or positive DTO.
let positiveEnclosure;
function savedScrews() {
  positiveEnclosure ??= JSON.parse(JSON.stringify(api.enclosure().doc));
  return structuredClone(positiveEnclosure);
}
const screw = doc => doc.instances.find(i => i.name === 'board-screw-1');
const madeNode = child => child.nodes.find(n => n.made?.command === 'fastener');
const m3 = child => child.fastenerSizes.rows.find(r => r.id === 'M3');
const m3Supply = child => child.rowSources.rows.find(r => r.kind === 'fastener-sizes' && r.id === 'M3');

function refusedScrews(doc) {
  const before = JSON.stringify(doc), result = api.checkBoardScrewRows(doc);
  assert.equal(result.ok, false, result.detail);
  assert.equal(result.code, 'P2_FASTENER_ROWS_REQUIRED');
  assert.equal(JSON.stringify(doc), before);
  return JSON.parse(result.detail);
}

test('board socket M3x5 has the independent cap, shank and rounded-hex socket volume', () => {
  const p = api.boardScrew(), before = JSON.stringify(p.doc);
  const vertices = [[1.25, 0.721688], [0, 1.443376], [-1.25, 0.721688], [-1.25, -0.721688], [0, -1.443376], [1.25, -0.721688]];
  const area = Math.abs(vertices.reduce((sum, a, i) => {
    const b = vertices[(i + 1) % vertices.length]; return sum + a[0] * b[1] - b[0] * a[1];
  }, 0)) / 2;
  const expected = Math.PI * (2.75 ** 2 * 3 + 1.5 ** 2 * 5) - area * 1.8;
  const actual = p.mass({ density: 1 }).volume;
  assert.equal(p.bodies().length, 1);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9 * Math.abs(expected), JSON.stringify({ actual, expected }));
  assert.equal(JSON.stringify(p.doc), before);
});

test('four real saved sample fasteners meet PG12 without granting product or connector acceptance', async () => {
  const doc = savedScrews(), before = JSON.stringify(doc), pg12 = api.checkBoardScrewRows(doc);
  assert.equal(pg12.ok, true, pg12.detail);
  const result = await api.checkEnclosure(doc, { engineering: false });
  assert.equal(result.checks.find(c => c.id === 'board-screw-rows').ok, true);
  assert.equal(result.checks.find(c => c.id === 'connector-rows').ok, false);
  assert.equal(result.checks.find(c => c.id === 'connector-rows').code, 'P2_CONNECTOR_ROWS_REQUIRED');
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(doc), before);
});

for (const [label, change] of [
  ['a missing screw', doc => { doc.instances = doc.instances.filter(i => i.name !== 'board-screw-4'); }],
  ['a duplicate role', doc => { doc.instances.find(i => i.name === 'board-screw-2').name = 'board-screw-1'; }],
  ['a duplicate instance id', doc => { doc.instances.find(i => i.name === 'board-screw-2').id = screw(doc).id; }],
  ['a moved screw', doc => { screw(doc).position[0] += 0.01; }],
  ['a rotated screw', doc => { screw(doc).rotation[2] = 1; }],
  ['a missing board lock', doc => { doc.mates = doc.mates.filter(m => !(m.kind === 'lock' && m.b.part === screw(doc).id)); }],
  ['a changed lock frame', doc => { doc.mates.find(m => m.kind === 'lock' && m.b.part === screw(doc).id).rel.position[2] += 0.1; }],
  ['a moved board', doc => { doc.instances.find(i => i.name === 'board').position[2] += 0.1; }],
  ['missing size rows', doc => { delete screw(doc).doc.fastenerSizes; }],
  ['a different row id', doc => { m3(screw(doc).doc).id = 'M4'; }],
  ['a missing cap length 5', doc => { const row = m3(screw(doc).doc); row.capLengths = row.capLengths.filter(l => l !== 5); }],
  ['changed row geometry', doc => { m3(screw(doc).doc).dk += 0.1; }],
  ['a changed row with a recomputed fingerprint', doc => { const child = screw(doc).doc, row = m3(child); row.pitch += 0.1; m3Supply(child).fingerprint = api.rowKey('fastener-sizes', row); }],
  ['a changed field source', doc => { m3(screw(doc).doc).fieldSources.capLengths = 'unapproved'; }],
  ['a missing receipt', doc => { delete screw(doc).doc.rowSources; }],
  ['a changed fingerprint', doc => { m3Supply(screw(doc).doc).fingerprint = 'fastener-sizes:unapproved'; }],
  ['a changed file hash', doc => { m3Supply(screw(doc).doc).file.sha256 = '0'.repeat(64); }],
  ['a different file name', doc => { m3Supply(screw(doc).doc).file.filename = 'another-file.json'; }],
  ['missing made metadata', doc => { delete madeNode(screw(doc).doc).made; }],
  ['a different command', doc => { madeNode(screw(doc).doc).made.command = 'cylinder'; }],
  ['another fastener kind', doc => { madeNode(screw(doc).doc).made.values.kind = 'hex-bolt'; }],
  ['another fastener length', doc => { madeNode(screw(doc).doc).made.values.length = '6'; }],
  ['another joint', doc => { madeNode(screw(doc).doc).made.values.joint = 'nut'; }],
  ['another local axis seat', doc => { madeNode(screw(doc).doc).made.values.z = 1; }],
  ['a false command span', doc => { madeNode(screw(doc).doc).made.nodes = 2; }],
]) test(`PG12 rejects ${label} in an actual saved positive document`, () => {
  const doc = savedScrews(); change(doc); refusedScrews(doc);
});

function withCopiedEvidence(original, replacement) {
  const child = JSON.parse(JSON.stringify(replacement.doc));
  child.fastenerSizes = structuredClone(original.fastenerSizes);
  child.rowSources = structuredClone(original.rowSources);
  child.nodes.at(-1).made = { ...structuredClone(madeNode(original).made), nodes: child.nodes.length };
  return child;
}

test('PG12 rejects the original stand-in even with copied rows, receipt, made metadata and bought flag', () => {
  const doc = savedScrews(), instance = screw(doc);
  const standIn = api.part('board-screw-m3x5').cylinder({ r: 1.5, h: 5, z: -5 })
    .union(q => q.cylinder({ r: 2.5, h: 1.6 })).material('steel').named('board screw').bought();
  instance.doc = withCopiedEvidence(instance.doc, standIn);
  const detail = refusedScrews(doc);
  assert.ok(detail.screws.some(s => s.reasons.some(r => r.includes('geometry'))), JSON.stringify(detail));
});

test('PG12 rejects a real M3x20 body with copied M3x5 command metadata', () => {
  const doc = savedScrews(), instance = screw(doc);
  instance.doc = withCopiedEvidence(instance.doc, api.caseScrew());
  const detail = refusedScrews(doc);
  assert.ok(detail.screws.some(s => s.reasons.some(r => r.includes('geometry'))), JSON.stringify(detail));
});

test('PG12 rejects copied command evidence on an unrelated evaluated body', () => {
  const doc = savedScrews(), instance = screw(doc);
  instance.doc = withCopiedEvidence(instance.doc, api.part('unrelated').box({ w: 3, d: 3, h: 5 }).material('steel').bought());
  refusedScrews(doc);
});
