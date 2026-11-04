import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
import { cases, gates, budget, support } from './cases.mjs';
const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const id = process.argv[2]; assert(/^[a-z0-9-]+$/.test(id ?? ''), 'fresh evidence ID required');
const out = resolve(home, 'evidence', id); mkdirSync(out, { recursive: false });
let bytes = 0, phase = 'freeze', failure = null;
const put = (name, value) => { const s = JSON.stringify(value, null, 2) + '\n'; bytes += Buffer.byteLength(s); assert(bytes <= budget.maxEvidenceBytes * 2, 'two-graph evidence bound'); writeFileSync(resolve(out, name), s, { flag: 'wx' }); };
const raw = x => typeof x === 'number' ? { $f64le: (() => { assert(Number.isFinite(x)); const b = Buffer.alloc(8); b.writeDoubleLE(x); return b.toString('hex'); })() } : Array.isArray(x) ? x.map(raw) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, raw(v)])) : x;
const normalized = x => Array.isArray(x) ? x.map(normalized) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'providerDigest' ? 'VALIDATED_OWN_GRAPH' : normalized(v)])) : x;
const pins = Object.fromEntries(['CONTRACT.md', 'cases.mjs', 'api-run.mjs'].map(name => [name, createHash('sha256').update(readFileSync(resolve(home, name))).digest('hex')]));
put('frozen-inputs.json', { pins, cases, gates, budget, support, represented: raw({ cases, gates, support }) });
const axis = (i, x) => [0, 1, 2].map(j => i === j ? x : 0);
function input(c) {
 const fixed = c.lexicalSwap ? 'z-fixed' : 'a-fixed', moving = c.lexicalSwap ? 'a-moving' : 'z-moving';
 const half = c.kind === 'pair' ? [.5, .5, .5] : [2, 2, 2].map((x, i) => i === c.axis ? .5 : x);
 const first = (c.kind === 'pair' ? dynamicPart : staticPart)(fixed, { kind: 'box', halfExtentsM: half }, { positionM: axis(c.axis, -.5) }, ...(c.kind === 'pair' ? [c.mass, { restitution: c.fixedE }] : [{ restitution: c.fixedE }]));
 const second = dynamicPart(moving, { kind: 'box', halfExtentsM: [.5, .5, .5] }, { positionM: axis(c.axis, .5), velocityMps: axis(c.axis, -c.speed) }, c.mass, { restitution: c.movingE });
 return { model: makeModel({ revision: 'g2-persistent-' + c.id, gravityMps2: c.gravity ?? [0, 0, 0], parts: c.reverse ? [second, first] : [first, second] }), options: { profile: 'rigid-persistent-box-v1', fixedStepSeconds: c.dt, broadPhase: 'direct' }, fixed, moving };
}
const source = new Map(), counts = {}, maxima = {};
try {
 for (const graph of ['source', 'native']) {
  phase = graph + '-import';
  const api = graph === 'source' ? await import(pathToFileURL(resolve(home, 'build/source.mjs'))) : { ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/index.js'))), ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/replay.js'))) };
  const count = counts[graph] = { worlds: 0, acceptedSteps: 0, knownRefusals: 0, unknownRefusals: 0, restores: 0 }, max = maxima[graph] = Object.fromEntries(Object.keys(gates).map(k => [k, 0]));
  let provider, graphBytes = bytes;
  const open = p => { assert(count.worlds < budget.maxWorlds); const w = api.createPhysicsWorld(p.model, p.options); count.worlds++; const digest = w.getState().identity.providerDigest; provider ??= digest; assert.equal(digest, provider); return w; };
  const step = (w, commands = []) => { assert(count.acceptedSteps < budget.maxAcceptedSteps); const s = w.step(commands); count.acceptedSteps++; return s; };
  const capture = (name, x) => { const packet = raw(x); put(graph + '-' + name + '.json', packet); assert(bytes - graphBytes <= budget.maxEvidenceBytes); if (graph === 'source') source.set(name, packet); else assert.deepEqual(normalized(packet), normalized(source.get(name)), 'Source/Native parity ' + name); };
  const gate = (k, value) => { assert(Number.isFinite(value), k); max[k] = Math.max(max[k], Math.abs(value)); assert(Math.abs(value) <= gates[k], `${k}: ${value} > ${gates[k]}`); };
  function check(c, p, before, after) {
   const a = after.bodies.find(b => b.id === p.fixed), b = after.bodies.find(b => b.id === p.moving);
   const e = c.speed > .5 ? Math.min(c.fixedE, c.movingE) : 0, closing = Math.max(0, c.speed);
   // Newton velocity ratio and momentum determine these centered one-dimensional outcomes.
   const target = c.kind === 'pair' ? [-closing * (1 + e) / 2, -c.speed + closing * (1 + e) / 2] : [0, -c.speed + closing * (1 + e)];
   const impulse = c.mass * closing * (1 + e) / (c.kind === 'pair' ? 2 : 1);
   const contacts = after.contacts, totalImpulse = contacts.reduce((s, x) => s + x.normalImpulseNs, 0);
   for (let i = 0; i < 3; i++) { gate('velocity', a.velocityMps[i] - (i === c.axis ? target[0] : 0)); gate('velocity', b.velocityMps[i] - (i === c.axis ? target[1] : 0)); for (const body of [a, b]) gate('omega', body.angularVelocityRadps[i]); }
   gate('impulse', totalImpulse - impulse);
   for (const contact of contacts) for (const v of contact.tangentImpulseOnBNs) gate('tangent', v);
   const gap = b.positionM[c.axis] - a.positionM[c.axis] - 1; gate('gap', gap - Math.max(0, -c.speed * c.dt));
   const dynamic = after.bodies.filter(x => x.kind === 'dynamic'), initial = before.bodies.filter(x => x.kind === 'dynamic');
   for (let i = 0; i < 3; i++) {
    const deltaP = c.mass * dynamic.reduce((s, x) => s + x.velocityMps[i], 0) - c.mass * initial.reduce((s, x) => s + x.velocityMps[i], 0);
    gate('momentum', deltaP - (c.kind === 'pair' || i !== c.axis ? 0 : impulse));
    const j = (i + 1) % 3, k = (i + 2) % 3;
    const angular = list => list.reduce((s, x) => s + c.mass * (x.positionM[j] * x.velocityMps[k] - x.positionM[k] * x.velocityMps[j]) + c.mass / 6 * x.angularVelocityRadps[i], 0);
    gate('angularMomentum', angular(dynamic) - angular(initial));
   }
   const energy = list => list.reduce((s, x) => s + c.mass / 2 * x.velocityMps.reduce((q, v) => q + v * v, 0) + c.mass / 12 * x.angularVelocityRadps.reduce((q, v) => q + v * v, 0), 0);
   const loss = .5 * (c.kind === 'pair' ? c.mass / 2 : c.mass) * closing * closing * (1 - e * e);
   gate('energy', energy(dynamic) - energy(initial) + loss);
   if (c.speed > 0) { const outgoing = b.velocityMps[c.axis] - a.velocityMps[c.axis]; if (c.speed > .5 && e > 0) assert(outgoing > 0, 'strict positive restitution branch'); else gate('velocity', outgoing); }
   return { e, target, impulse, loss, measuredEnergyJ: energy(dynamic), gap };
  }
  let firstPacket;
  for (const c of cases) {
   phase = graph + '-' + c.id; const p = input(c), w = open(p); let before, after;
   try { before = w.getState(); after = step(w); capture(c.id, { input: p, before, after }); const reference = check(c, p, before, after); put(graph + '-' + c.id + '-oracle.json', { reference, maxima: max }); if (c === cases[0]) firstPacket = { before, after }; } finally { w.dispose(); }
  }
  phase = graph + '-repeat'; { const p = input(cases[0]), w = open(p); try { const packet = { before: w.getState(), after: step(w) }; capture('repeat', packet); assert.deepEqual(packet, firstPacket); } finally { w.dispose(); } }
  phase = graph + '-support'; { const p = input(support), w = open(p), states = []; try { const before = w.getState(); for (let n = 0; n < support.steps; n++) { const after = step(w); states.push(after); capture('support-step-' + String(n + 1).padStart(3, '0'), { input: p, after }); const b = after.bodies.find(x => x.id === p.moving); for (const v of b.velocityMps) gate('velocity', v); for (const v of b.angularVelocityRadps) gate('omega', v); gate('gap', b.positionM[1] - .5); gate('impulse', after.contacts.reduce((s, x) => s + x.normalImpulseNs, 0) - support.mass * 9.81 * support.dt); for (const x of after.contacts) for (const v of x.tangentImpulseOnBNs) gate('tangent', v); } capture('support', { input: p, before, states }); } finally { w.dispose(); } }
  phase = graph + '-recorder'; { const p = input(cases[0]), w = open(p), r = api.createPhysicsRecorder(w); let restored; try { const first = step(r), saved = r.saveRecording(), continued = step(r); put(graph + '-recorder-before-restore.json', raw({ input: p, first, saved, continued })); assert(count.worlds < budget.maxWorlds); restored = api.restorePhysicsRecording(saved, { model: p.model, options: p.options, providerDigest: provider }); count.worlds++; count.acceptedSteps++; count.restores++; assert.deepEqual(restored.recorder.getState(), first); assert.deepEqual(restored.recorder.saveRecording(), saved); const resumed = step(restored.recorder); assert.deepEqual(resumed, continued); capture('recorder', { input: p, first, saved, continued, resumed }); } finally { restored?.recorder.dispose(); restored?.world.dispose(); r.dispose(); w.dispose(); } }
  for (const mode of ['known', 'unknown']) {
   phase = graph + '-' + mode + '-refusal'; const p = input(cases[0]), w = open(p), control = open(p), r = api.createPhysicsRecorder(w), cr = api.createPhysicsRecorder(control);
   try {
    // Known refusal occurs after an accepted step: retention includes an existing log/cache.
    if (mode === 'known') { assert.deepEqual(step(r), step(cr)); }
    const before = { state: r.getState(), log: r.saveRecording() }; put(graph + '-' + mode + '-before.json', raw({ input: p, before })); let stack;
    if (mode === 'known') { assert.throws(() => r.step([{ kind: 'impulse', bodyId: p.moving, impulseNs: [100000, 0, 0] }]), e => e instanceof api.PhysicsError && e.code === 'NUMERIC_LIMIT'); count.knownRefusals++; }
    else { const original = Math.sqrt, marker = new Error('PERSISTENT_UNKNOWN_FAILURE'); Math.sqrt = () => { stack = new Error().stack; throw marker; }; try { assert.throws(() => r.step(), e => e === marker); } finally { Math.sqrt = original; } assert(stack.includes('solvePersistentPoint'), 'fault must reach actual persistent solver'); count.unknownRefusals++; }
    const refused = { state: r.getState(), log: r.saveRecording() }; put(graph + '-' + mode + '-refused.json', raw(refused)); assert.deepEqual(refused, before);
    const retry = step(r), expected = step(cr); assert.deepEqual(retry, expected); assert.deepEqual(r.saveRecording(), cr.saveRecording());
    // Stack paths differ between source bundle and canonical native output.
    if (stack) put(graph + '-unknown-stack.json', { stack });
    capture(mode + '-refusal', { input: p, before, refused, retry, expected, log: r.saveRecording() });
   } finally { r.dispose(); cr.dispose(); w.dispose(); control.dispose(); }
  }
  assert.equal(count.worlds, budget.worlds); assert.equal(count.acceptedSteps, budget.acceptedSteps); put(graph + '-counts.json', { count, maxima: max, evidenceBytes: bytes - graphBytes });
 }
} catch (error) { failure = { phase, name: error.name, message: error.message, stack: error.stack }; }
const summary = { status: failure ? 'FAIL_PERSISTENT_PUBLIC_API' : 'PASS_PERSISTENT_PUBLIC_API', pins, counts, maxima, firstFailure: failure, evidenceBytes: bytes, browser: 'NOT_RUN', scope: 'centered zero-friction principal-axis impacts and separate e0 gravity support' };
put('summary.json', summary); console.log(JSON.stringify(summary)); if (failure) process.exitCode = 1;
