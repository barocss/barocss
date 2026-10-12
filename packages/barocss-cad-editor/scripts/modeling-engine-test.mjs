// Pure worker routing/authority test with provider stubs. No native geometry is evaluated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-engine');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const packet = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8'));
const legacyDocument = JSON.parse(readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json'), 'utf8'));
const document = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { height: 8 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }], outputs: { part: { node: 1, side: 'solid' }, other: { node: 1, side: 'solid' } } };
let modelCalls = 0, legacyCalls = 0, lastLegacy, lastPacket;
function snapshot(data) {
  const body = { report: { solidId: 'current_solid' }, certificate: { volumeMM3: { numerator: '1', denominator: '1' } }, graph: { vertices: [], edges: [], faces: [], vertexLinks: [] } };
  return { parameters: data.parameters, features: [{ kind: 'sketch', index: 0, dependencies: [] }, { kind: 'extrude', index: 1, dependencies: [0] }], bodies: { part: body, other: body },
    save: () => JSON.stringify({ ...data, outputs: Object.fromEntries(Object.entries(data.outputs).sort(([a], [b]) => a.localeCompare(b))) }), withParameters(values) { modelCalls++; if (Object.values(values).some(v => v < 0)) throw new Error('native candidate refused'); return snapshot({ ...data, parameters: { ...data.parameters, ...values } }); } };
}
globalThis.__modelingCad = { cad: { load(text) { modelCalls++; const data = JSON.parse(text); if (data.invalid) throw new Error('codec refused'); return snapshot(data); } },
  tessellateConvexPlanarSolid() { const { mesh, boundaries, internalDiagonals, report } = structuredClone(packet.components[0]); report.solidId = 'current_solid'; return { mesh, boundaries, internalDiagonals, report }; } };
globalThis.__modelingLegacy = () => {
  let accepted;
  return command => {
    legacyCalls++; lastLegacy = command;
    if (command.kind === 'open') {
      const parsed = JSON.parse(command.text); if (parsed.invalid) return { id: command.id, ok: false, message: 'legacy codec refused' };
      accepted = structuredClone(legacyDocument); accepted.version = parsed.version;
    } else {
      if (command.expectedRevision !== accepted.revision) return { id: command.id, ok: false, message: 'legacy stale' };
      accepted.revision++; for (const e of command.edits) accepted.parameters.find(p => p.id === e.parameterId).valueMM = e.valueMM;
    }
    const fraction = { numerator: '1', denominator: '1' };
    lastPacket = { ...structuredClone(packet), documentId: accepted.id, revision: accepted.revision };
    return { id: command.id, ok: true, text: JSON.stringify(accepted), display: lastPacket,
      summary: { document: structuredClone(accepted), dependencies: accepted.nodes.map(n => ({ nodeId: n.id, dependsOn: [] })),
        components: packet.outcomes, volumes: { first: fraction, second: fraction }, selectedWalls: [] } };
  };
};
const bundle = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'explicit-provider-stubs', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'stub' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === 'cad'
      ? 'export const {cad,tessellateConvexPlanarSolid}=globalThis.__modelingCad;'
      : 'export const createPrismFeatureEngine=globalThis.__modelingLegacy;' }));
  } }] });
writeFileSync(resolve(output, 'engine.mjs'), bundle.outputFiles[0].text);
const { createModelingEngine: create, modelingSourceKind: kind } = await import(pathToFileURL(resolve(output, 'engine.mjs')));
let checks = 0, id = 0;
assert.equal(kind(JSON.stringify(document)), 'model'); assert.equal(kind(JSON.stringify(legacyDocument)), 0);
assert.equal(kind(JSON.stringify({ ...legacyDocument, version: 2 })), 2); checks++;
for (const text of ['[]', 'null', '3', '{broken', '{}', JSON.stringify({ ...document, schema: 2 }), JSON.stringify({ ...legacyDocument, version: 1 }), JSON.stringify({ ...legacyDocument, version: '2' }), ' '.repeat(262145)]) assert.throws(() => kind(text));
assert.equal(modelCalls + legacyCalls, 0); checks++;
const engine = create();
const first = engine({ id: ++id, kind: 'open', text: JSON.stringify(document) }); assert.equal(first.ok, true); assert.equal(first.summary.source, 'model'); checks++;
assert.deepEqual(first.summary.outputs.map(o => o.name), Object.keys(JSON.parse(first.text).outputs));
assert.deepEqual(first.display.components.map(c => c.role), ['other', 'part']); checks++;
const edited = engine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { height: 6 } }); assert.equal(edited.ok, true); assert.equal(edited.summary.parameters.height, 6); checks++;
assert.equal(engine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { height: 5 } }).ok, false);
assert.equal(engine({ id: ++id, kind: 'apply', expectedRevision: 1, parameters: { height: -1 } }).ok, false);
assert.equal(engine({ id: ++id, kind: 'open', text: JSON.stringify({ ...legacyDocument, invalid: true }) }).ok, false);
const retained = engine({ id: ++id, kind: 'apply', expectedRevision: 1, parameters: { height: 7 } }); assert.equal(retained.ok, true); assert.equal(retained.summary.revision, 2); checks++;
const reopened = create()({ id: ++id, kind: 'open', text: retained.text, revision: 2 }); assert.equal(reopened.ok, true); assert.deepEqual(reopened.summary, retained.summary); checks++;
for (const version of [0, 2]) {
  const text = JSON.stringify({ ...legacyDocument, version });
  const legacy = engine({ id: ++id, kind: 'open', text }); assert.equal(legacy.ok, true); assert.equal(lastLegacy.version, version); assert.equal(lastLegacy.text, text);
  assert.equal(legacy.display, lastPacket); assert.equal(legacy.summary.source, 'legacy'); assert.equal(JSON.parse(legacy.text).version, version); checks++;
  assert.equal(engine({ id: ++id, kind: 'open', text: JSON.stringify({ ...document, invalid: true }) }).ok, false);
  const editedLegacy = engine({ id: ++id, kind: 'apply', expectedRevision: legacy.summary.revision, parameters: { upperX: 24 } });
  assert.equal(editedLegacy.ok, true); assert.equal(editedLegacy.display, lastPacket); assert.deepEqual(lastLegacy.edits, [{ parameterId: 'upperX', valueMM: 24 }]); checks++;
}
const before = modelCalls + legacyCalls;
assert.equal(engine({ id: ++id, kind: 'open', text: JSON.stringify({ ...legacyDocument, version: 1 }) }).ok, false);
assert.equal(modelCalls + legacyCalls, before); checks++;
const result = { ok: true, checks, modelCalls, legacyCalls, evidence: 'stubbed providers; pure worker routing and authority only; no native geometry' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
