import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makeModel, dynamicPart } from '../physics-model-input/model.mjs';
import { cases, gates, budget } from './cases.mjs';
const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..'), id = process.argv[2];
assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id ?? ''), 'fresh evidence ID required');
mkdirSync(resolve(home, 'evidence'), { recursive: true }); const out = resolve(home, 'evidence', id); mkdirSync(out, { recursive: false });
const hash = b => createHash('sha256').update(b).digest('hex');
const pinnedPaths = ['CONTRACT.md', 'api-run.mjs', 'cases.mjs', 'build/result.json', 'build/source.mjs', '../../packages/barocss-physics/dist/index.js', '../../packages/barocss-physics/dist/replay.js', '../../packages/barocss-physics/dist/ccd-sphere-pair-exact.js', '../../packages/barocss-physics/src/ccd-sphere-pair-exact.ts', '../../packages/barocss-physics/src/ccd-pair.ts'];
const pins = Object.fromEntries(pinnedPaths.map(p => { const b = readFileSync(resolve(home, p)); return [p, { bytes: b.length, sha256: hash(b) }]; }));
const raw = x => typeof x === 'number' ? { $f64le: (() => { assert(Number.isFinite(x)); const b = Buffer.alloc(8); b.writeDoubleLE(x); return b.toString('hex'); })() } : Array.isArray(x) ? x.map(raw) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, raw(v)])) : x;
const normalize = x => Array.isArray(x) ? x.map(normalize) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'providerDigest' ? 'VALIDATED_OWN_GRAPH' : normalize(v)])) : x;
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function input(c) {
 const ids = ['a-sphere', 'z-sphere'];
 const parts = ids.map((id, i) => dynamicPart(id, { kind: 'sphere', radiusM: c.radii[i] }, { positionM: c.starts[i], velocityMps: c.velocities[i] }, 1, { restitution: 0, ccd: i === c.marker }));
 const ends = c.starts.map((p, i) => p.map((x, j) => x + c.velocities[i][j] * c.dt));
 return { ids, markedId: ids[c.marker], otherId: ids[1 - c.marker], radii: c.radii, starts: c.starts, ends, velocities: c.velocities, model: makeModel({ revision: 'g2-sphere-pair-' + c.id, gravityMps2: [0, 0, 0], parts: c.reverse ? parts.toReversed() : parts }), options: { profile: 'rigid-discrete-v1', fixedStepSeconds: c.dt, broadPhase: 'direct' } };
}
function physicalReference(c, p) {
 // Independent axis-X ray/sphere geometry: closest approach is its transverse
 // distance; entry is one chord length before the center-plane crossing. Exact
 // Fraction/Decimal audit receives BOTH radius words and all endpoint words.
 const m = c.marker, o = 1 - m, separation = p.starts[m].map((x, i) => x - p.starts[o][i]), travel = p.ends[m].map((x, i) => (x - p.starts[m][i]) - (p.ends[o][i] - p.starts[o][i]));
 assert.equal(travel[1], 0); assert.equal(travel[2], 0);
 const transverse = Math.hypot(separation[1], separation[2]), radiusRoundedForFloatGate = c.radii[0] + c.radii[1];
 const closestTime = travel[0] === 0 ? 0 : Math.max(0, Math.min(1, -separation[0] / travel[0]));
 const closestDistance = Math.hypot(separation[0] + travel[0] * closestTime, transverse);
 if (c.expectedClass !== 'HIT') return { expectedClass: c.expectedClass, closestTime, closestDistance, radiusOperands: c.radii, positiveClosestGap: closestDistance - radiusRoundedForFloatGate };
 const chord = Math.sqrt((radiusRoundedForFloatGate - transverse) * (radiusRoundedForFloatGate + transverse));
 const fraction = (-separation[0] + Math.sign(separation[0]) * chord) / travel[0];
 const normal = [Math.sign(separation[0]) * chord / radiusRoundedForFloatGate, separation[1] / radiusRoundedForFloatGate, separation[2] / radiusRoundedForFloatGate];
 return { expectedClass: 'HIT', fraction, normal, closestTime, closestDistance, radiusOperands: c.radii, chord };
}
let bytes = 0, graphStart = 0, phase = 'freeze', failure = null;
const put = (name, value) => { const s = JSON.stringify(value, null, 2) + '\n', n = Buffer.byteLength(s); assert(bytes + n <= 2 * budget.maxEvidenceBytes); assert(bytes + n - graphStart <= budget.maxEvidenceBytes); writeFileSync(resolve(out, name), s, { flag: 'wx' }); bytes += n; };
const source = new Map(), counts = {}, maxima = {};
try {
 assert.equal(JSON.parse(readFileSync(resolve(home, 'build/result.json'))).status, 'PASS_BUILD');
 put('frozen-inputs.json', { pins, cases, gates, budget, represented: raw({ cases, gates }) });
 for (const graph of ['source', 'native']) {
  phase = graph + '-import'; graphStart = bytes;
  const api = graph === 'source' ? await import(pathToFileURL(resolve(home, 'build/source.mjs'))) : { ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/index.js'))), ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/replay.js'))), ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/ccd-sphere-pair-exact.js'))) };
  const count = counts[graph] = { worlds: 0, acceptedSteps: 0, directHelperCalls: 0, knownRefusals: 0, unknownRefusals: 0, restores: 0 }, max = maxima[graph] = Object.fromEntries(Object.keys(gates).map(k => [k, 0])); let provider;
  const gate = (key, value) => { assert(Number.isFinite(value), key); max[key] = Math.max(max[key], Math.abs(value)); assert(Math.abs(value) <= gates[key], `${key}: ${value} > ${gates[key]}`); };
  const open = p => { assert(count.worlds < budget.maxWorlds); const w = api.createPhysicsWorld(p.model, p.options); count.worlds++; const own = w.getState().identity.providerDigest; provider ??= own; assert.equal(own, provider); return w; };
  const step = (owner, commands = []) => { assert(count.acceptedSteps < budget.maxAcceptedSteps); const s = owner.step(commands); count.acceptedSteps++; return s; };
  const capture = (name, value) => { const packet = raw(value); put(graph + '-' + name + '.json', packet); if (graph === 'source') source.set(name, packet); else assert.deepEqual(normalize(packet), normalize(source.get(name)), 'Source/Native ' + name); };
  const snap = r => ({ state: r.getState(), log: r.saveRecording() });
  function checkHit(c, p, ref, hit, helper = false) {
   if (c.expectedClass !== 'HIT') { assert.equal(hit, null, 'exact classification ' + c.id); return null; }
   assert(hit, 'expected true hit ' + c.id); const fraction = helper ? hit.fraction : hit.toiFraction, normal = helper ? hit.normal : hit.normalFixtureToBody;
   assert(fraction >= 0 && fraction <= 1); gate('toi', fraction - ref.fraction); gate('normalNormSquared', dot(normal, normal) - 1);
   for (let i = 0; i < 3; i++) gate('normal', normal[i] - ref.normal[i]);
   const centers = p.starts.map((start, j) => start.map((x, i) => x + (p.ends[j][i] - x) * fraction));
   const separation = centers[c.marker].map((x, i) => x - centers[1 - c.marker][i]);
   const distance = Math.hypot(...separation), radiusOperands = c.radii;
   gate('distance', distance - (radiusOperands[0] + radiusOperands[1]));
   if (!helper) { assert.equal(hit.bodyId, p.markedId); assert.equal(hit.colliderId, p.otherId + '.shape'); }
   return { fraction, normal, unbiasedCenters: centers, unbiasedDistance: distance, radiusOperands, unbiasedGapUsingRoundedSum: distance - (radiusOperands[0] + radiusOperands[1]) };
  }
  let first;
  for (const c of cases) {
   phase = graph + '-' + c.id; const p = input(c), ref = physicalReference(c, p);
   put(graph + '-' + c.id + '-before-helper.json', raw({ case: c, input: p, reference: ref }));
   if (c.id === 'zero-relative') for (let i = 0; i < 3; i++) assert.equal((p.ends[0][i] - p.starts[0][i]) - (p.ends[1][i] - p.starts[1][i]), 0, 'represented zero relative travel');
   const helper = api.sweepSpherePairExact(p.starts[c.marker], p.ends[c.marker], p.starts[1 - c.marker], p.ends[1 - c.marker], c.radii[c.marker], c.radii[1 - c.marker]); count.directHelperCalls++;
   capture(c.id + '-helper', { input: p, helper }); const helperMeasurements = checkHit(c, p, ref, helper, true);
   const w = open(p); try { const before = w.getState(); put(graph + '-' + c.id + '-before.json', raw({ case: c, input: p, before })); const after = step(w); capture(c.id, { input: p, before, after }); const hit = after.ccdHits[0] ?? null; assert.equal(after.ccdHits.length, c.expectedClass === 'HIT' ? 1 : 0); const measurements = checkHit(c, p, ref, hit);
    if (c.expectedClass === 'OWNED') assert(after.contacts.length > 0, 'initial touch/overlap discrete ownership');
    if (c.expectedClass === 'MISS') { assert.equal(after.contacts.length, 0); for (let j = 0; j < 2; j++) { const b = after.bodies.find(x => x.id === p.ids[j]); for (let i = 0; i < 3; i++) { gate('finiteMotion', b.positionM[i] - p.ends[j][i]); gate('finiteMotion', b.velocityMps[i] - c.velocities[j][i]); gate('finiteMotion', b.angularVelocityRadps[i]); } } }
    for (const body of after.bodies) for (const list of [body.positionM, body.velocityMps, body.angularVelocityRadps, body.orientationXYZW]) for (const x of list) assert(Number.isFinite(x));
    if (c.id === 'original-head-on') { const a = after.bodies.find(x => x.id === p.ids[0]), b = after.bodies.find(x => x.id === p.ids[1]); gate('finiteMotion', a.positionM[0] + .05); gate('finiteMotion', b.positionM[0] - .05); assert.equal(a.velocityMps[0], 0); assert.equal(b.velocityMps[0], 0); }
    put(graph + '-' + c.id + '-checks.json', raw({ reference: ref, helperMeasurements, measurements, maxima: max })); if (c === cases[0]) first = { input: p, before, after };
   } finally { w.dispose(); }
  }
  phase = graph + '-repeat'; { const p = input(cases[0]), w = open(p); try { const packet = { input: p, before: w.getState(), after: step(w) }; capture('repeat', packet); assert.deepEqual(packet, first); } finally { w.dispose(); } }
  phase = graph + '-recording'; { const p = input(cases[0]), w = open(p), r = api.createPhysicsRecorder(w); let restored; try { const first = step(r), saved = r.saveRecording(), continued = step(r); put(graph + '-pre-restore.json', raw({ input: p, first, saved, continued })); assert(count.worlds < budget.maxWorlds); restored = api.restorePhysicsRecording(saved, { model: p.model, options: p.options, providerDigest: provider }); count.worlds++; count.acceptedSteps++; count.restores++; assert.deepEqual(restored.recorder.getState(), first); assert.deepEqual(restored.recorder.saveRecording(), saved); const resumed = step(restored.recorder); capture('recording', { input: p, first, saved, continued, resumed }); assert.deepEqual(continued, resumed); assert.deepEqual(r.saveRecording(), restored.recorder.saveRecording()); } finally { restored?.recorder.dispose(); restored?.world.dispose(); r.dispose(); w.dispose(); } }
  for (const mode of ['known', 'unknown']) {
   phase = graph + '-' + mode; const p = input(cases[0]), w = open(p), cw = open(p), r = api.createPhysicsRecorder(w), cr = api.createPhysicsRecorder(cw);
   try { if (mode === 'known') assert.deepEqual(step(r), step(cr)); const before = snap(r); capture(mode + '-before', { input: p, before });
    if (mode === 'known') { assert.throws(() => r.step([{ kind: 'impulse', bodyId: p.ids[0], impulseNs: [100000, 0, 0] }]), error => error instanceof api.PhysicsError && error.code === 'NUMERIC_LIMIT'); count.knownRefusals++; }
    else { const original = Math.sqrt, marker = new Error('SPHERE_PAIR_EXACT_UNKNOWN_FAILURE'); let caught, stack; Math.sqrt = x => { const s = new Error().stack; if (s.includes('sweepSpherePairExact')) { stack = s; throw marker; } return original(x); }; try { step(r); } catch (error) { caught = error; } finally { Math.sqrt = original; } put(graph + '-unknown-stack.json', { stack: stack ?? null, sameErrorObject: caught === marker, error: caught ? { name: caught.name, message: caught.message } : null }); put(graph + '-unknown-post-call.json', raw(snap(r))); assert.equal(caught, marker); assert(stack?.includes('sweepSpherePairExact')); count.unknownRefusals++; }
    const refused = snap(r); capture(mode + '-refused', { before, refused }); assert.deepEqual(refused, before); const retry = step(r), expected = step(cr); capture(mode + '-retry', { retry, expected, recovered: snap(r), control: snap(cr) }); assert.deepEqual(retry, expected); assert.deepEqual(snap(r), snap(cr));
   } finally { r.dispose(); cr.dispose(); w.dispose(); cw.dispose(); }
  }
  assert.equal(count.worlds, budget.worlds); assert.equal(count.acceptedSteps, budget.acceptedSteps); assert.equal(count.directHelperCalls, budget.directHelperCalls); put(graph + '-counts.json', { count, maxima: max, evidenceBytes: bytes - graphStart });
 }
} catch (error) { failure = { phase, name: error.name, message: error.message, stack: error.stack }; }
const summary = { status: failure ? 'FAIL_SPHERE_PAIR_PUBLIC_API' : 'PASS_SPHERE_PAIR_PUBLIC_API', pins, counts, maxima, firstFailure: failure, evidenceBytes: bytes, browser: 'NOT_RUN', scope: 'finite represented sphere-pair rays; continuation validates reproduction only' };
put('summary.json', summary); console.log(JSON.stringify(summary)); if (failure) process.exitCode = 1;
