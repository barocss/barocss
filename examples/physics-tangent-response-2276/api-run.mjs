import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makeModel, staticPart, dynamicPart } from '../physics-model-input/model.mjs';
const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..'), id = process.argv[2];
assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id ?? ''), 'fresh evidence ID required');
const caseFile = process.argv[3] ?? 'cases.mjs';
assert(/^cases(?:-[0-9]+)?\.mjs$/.test(caseFile), 'case file must be an explicit local cases module');
const { cases, gates, budget } = await import(pathToFileURL(resolve(home, caseFile)));
mkdirSync(resolve(home, 'evidence'), { recursive: true }); const out = resolve(home, 'evidence', id); mkdirSync(out, { recursive: false });
const hash = b => createHash('sha256').update(b).digest('hex');
const pins = Object.fromEntries([...new Set(['CONTRACT.md', 'cases.mjs', caseFile, ...(caseFile === 'cases-02.mjs' ? ['INPUT-CORRECTION-02.md'] : []), 'api-run.mjs', 'build/result.json', 'build/source.mjs', '../../packages/barocss-physics/dist/index.js', '../../packages/barocss-physics/dist/replay.js'])].map(p => { const b = readFileSync(resolve(home, p)); return [p, { bytes: b.length, sha256: hash(b) }]; }));
const raw = x => typeof x === 'number' ? { $f64le: (() => { assert(Number.isFinite(x)); const b = Buffer.alloc(8); b.writeDoubleLE(x); return b.toString('hex'); })() } : Array.isArray(x) ? x.map(raw) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, raw(v)])) : x;
const normalize = x => Array.isArray(x) ? x.map(normalize) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'providerDigest' ? 'VALIDATED_OWN_GRAPH' : normalize(v)])) : x;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rotate(v, n) { for (let i = 0; i < n; i++) v = [v[2], v[0], v[1]]; return v; }
function input(c) {
 const fixed = c.lexicalSwap ? 'z-floor' : 'a-floor', moving = c.lexicalSwap ? 'a-box' : 'z-box', r = v => rotate(v, c.cycles), mat = { restitution: 0, friction: { static: c.muS, dynamic: c.muD } };
 const floor = staticPart(fixed, { kind: 'box', halfExtentsM: r([2, .5, 2]) }, { positionM: r([0, -.5, 0]) }, mat);
 const box = dynamicPart(moving, { kind: 'box', halfExtentsM: r(c.half) }, { positionM: r([-c.vx * c.dt, c.half[1] + c.speed * c.dt, -c.vz * c.dt]), velocityMps: r([c.vx, -c.speed, c.vz]) }, 1, mat);
 return { fixed, moving, model: makeModel({ revision: 'g2-tangent-' + c.id, gravityMps2: [0, 0, 0], parts: c.reverse ? [box, floor] : [floor, box] }), options: { profile: 'rigid-discrete-v1', fixedStepSeconds: c.dt, broadPhase: 'direct' } };
}
function reference(c) {
 const [hx, h, hz] = c.half, inertia = [(h * h + hz * hz) / 3, (hx * hx + hz * hz) / 3, (hx * hx + h * h) / 3];
 // Physical constraints (unit mass): vx'=vx+Jx, Izz*wz=h*Jx,
 // and bottom no-slip vx'+h*wz=0. Independently, vz'=vz+Jz,
 // Ixx*wx=-h*Jz and vz'-h*wx=0. These are uncoupled scalar constraints.
 const stick = [-c.vx / (1 + h * h / inertia[2]), 0, -c.vz / (1 + h * h / inertia[0])];
 const normal = Math.max(0, c.speed), magnitude = Math.hypot(stick[0], stick[2]);
 let tangent = stick;
 if (c.branch === 'zero' || c.branch === 'no-normal') tangent = [0, 0, 0];
 if (c.branch === 'slide') { assert(magnitude > c.muS * normal, 'clear independent static failure'); const vt = Math.hypot(c.vx, c.vz); tangent = [-c.muD * normal * c.vx / vt, 0, -c.muD * normal * c.vz / vt]; }
 if (c.branch === 'stick') assert(magnitude <= c.muS * normal, 'clear independent static admission');
 // Sliding reference follows the retained dynamic ray/clamp law only. It does
 // not assert a maximum-dissipation solution for an anisotropic body.
 const impulse = [tangent[0], normal, tangent[2]], arm = [0, -h, 0], torque = cross(arm, impulse), velocity = [c.vx + tangent[0], -c.speed + normal, c.vz + tangent[2]], omega = torque.map((v, i) => v / inertia[i]);
 const energy = .5 * dot(velocity, velocity) + .5 * omega.reduce((s, v, i) => s + inertia[i] * v * v, 0), r = v => rotate(v, c.cycles);
 return { inertia: r(inertia), arm: r(arm), normalVector: r([0, 1, 0]), impulse: r(impulse), torque: r(torque), velocity: r(velocity), omega: r(omega), position: r([0, h, 0]), energy, normalImpulse: normal, stickMagnitude: magnitude };
}
let bytes = 0, graphStart = 0, phase = 'freeze', failure = null;
const put = (name, value) => { const s = JSON.stringify(value, null, 2) + '\n'; const size = Buffer.byteLength(s); assert(bytes + size <= 2 * budget.maxEvidenceBytes, 'total byte cap'); assert(bytes + size - graphStart <= budget.maxEvidenceBytes, 'graph byte cap'); writeFileSync(resolve(out, name), s, { flag: 'wx' }); bytes += size; };
const counts = {}, maxima = {}, source = new Map();
try {
 assert.equal(JSON.parse(readFileSync(resolve(home, 'build/result.json'))).status, 'PASS_BUILD');
 put('frozen-inputs.json', { pins, caseFile, cases, gates, budget, represented: raw({ cases, gates }) });
 for (const graph of ['source', 'native']) {
  phase = graph + '-import'; graphStart = bytes;
  const api = graph === 'source' ? await import(pathToFileURL(resolve(home, 'build/source.mjs'))) : { ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/index.js'))), ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/replay.js'))) };
  const count = counts[graph] = { worlds: 0, acceptedSteps: 0, restores: 0, knownRefusals: 0, unknownRefusals: 0, creationRefusals: 0 }, max = maxima[graph] = Object.fromEntries(Object.keys(gates).map(k => [k, 0])); let provider;
  const gate = (k, v) => { assert(Number.isFinite(v), k); max[k] = Math.max(max[k], Math.abs(v)); assert(Math.abs(v) <= gates[k], `${k}: ${v} > ${gates[k]}`); };
  const open = p => { assert(count.worlds < budget.maxWorlds); const w = api.createPhysicsWorld(p.model, p.options); count.worlds++; const digest = w.getState().identity.providerDigest; provider ??= digest; assert.equal(digest, provider); return w; };
  const step = (w, commands = []) => { assert(count.acceptedSteps < budget.maxAcceptedSteps); const after = w.step(commands); count.acceptedSteps++; return after; };
  const snap = r => ({ state: r.getState(), log: r.saveRecording() });
  const capture = (name, x) => { const packet = raw(x); put(graph + '-' + name + '.json', packet); if (graph === 'source') source.set(name, packet); else assert.deepEqual(normalize(packet), normalize(source.get(name)), 'Source/Native ' + name); };
  function check(c, p, ref, before, after) {
   const b = after.bodies.find(x => x.id === p.moving), initial = before.bodies.find(x => x.id === p.moving), floor = after.bodies.find(x => x.id === p.fixed); assert(b && initial && floor); assert.equal(after.ccdHits.length, 0);
   const impulse = [0, 0, 0]; let normal = 0;
   for (const contact of after.contacts) { const sign = contact.bodyBId === p.moving ? 1 : -1; assert([contact.bodyAId, contact.bodyBId].includes(p.moving)); normal += contact.normalImpulseNs; gate('tangentPlane', dot(contact.tangentImpulseOnBNs, contact.normalAtoB)); for (let i = 0; i < 3; i++) { impulse[i] += sign * (contact.normalAtoB[i] * contact.normalImpulseNs + contact.tangentImpulseOnBNs[i]); gate('geometry', contact.pointM[i] - b.positionM[i] - ref.arm[i]); gate('geometry', sign * contact.normalAtoB[i] - ref.normalVector[i]); } }
   if (c.speed > 0) assert(after.contacts.length > 0, 'actual discrete contact'); gate('impulse', normal - ref.normalImpulse);
   const torque = cross(ref.arm, impulse), slip = b.velocityMps.map((v, i) => v + cross(b.angularVelocityRadps, ref.arm)[i]);
   for (let i = 0; i < 3; i++) { gate('velocity', b.velocityMps[i] - ref.velocity[i]); gate('omega', b.angularVelocityRadps[i] - ref.omega[i]); gate('impulse', impulse[i] - ref.impulse[i]); gate('momentum', b.velocityMps[i] - initial.velocityMps[i] - impulse[i]); gate('angularMomentum', ref.inertia[i] * b.angularVelocityRadps[i] - torque[i]); gate('geometry', b.positionM[i] - ref.position[i]); gate('velocity', floor.velocityMps[i]); gate('omega', floor.angularVelocityRadps[i]); if (c.branch === 'stick') gate('slip', slip[i]); }
   const energy = x => .5 * dot(x.velocityMps, x.velocityMps) + .5 * x.angularVelocityRadps.reduce((s, v, i) => s + ref.inertia[i] * v * v, 0);
   const beforeE = energy(initial), afterE = energy(b), meanV = b.velocityMps.map((v, i) => (v + initial.velocityMps[i]) / 2), meanW = b.angularVelocityRadps.map(v => v / 2), work = dot(impulse, meanV) + dot(torque, meanW);
   gate('energy', afterE - ref.energy); gate('energy', Math.max(0, afterE - beforeE)); gate('work', afterE - beforeE - work);
   return { impulse, torque, slip, beforeEnergyJ: beforeE, afterEnergyJ: afterE, impulseWorkJ: work, reference: ref, maxima: max };
  }
  let first;
  for (const c of cases) { phase = graph + '-' + c.id; const p = input(c);
   if (c.expectedError) {
    capture(c.id + '-creation-input', { case: c, input: p, expectedCode: c.expectedError });
    let rejected, unexpectedWorld;
    try { unexpectedWorld = api.createPhysicsWorld(p.model, p.options); count.worlds++; }
    catch (error) { rejected = error; }
    finally { unexpectedWorld?.dispose(); }
    capture(c.id + '-creation-refusal', { case: c, input: p, expectedCode: c.expectedError, returnedWorld: !!unexpectedWorld, error: rejected ? { name: rejected.name, code: rejected.code ?? null, message: rejected.message } : null });
    assert(!unexpectedWorld, 'configuration must refuse before returning a World');
    assert(rejected instanceof api.PhysicsError && rejected.code === c.expectedError, 'expected public configuration refusal');
    count.creationRefusals++; continue;
   }
   const ref = reference(c), w = open(p); try { const before = w.getState(); put(graph + '-' + c.id + '-before.json', raw({ case: c, input: p, reference: ref, before })); const after = step(w), packet = { input: p, before, after }; capture(c.id, packet); const checks = check(c, p, ref, before, after); put(graph + '-' + c.id + '-checks.json', raw(checks)); if (c === cases[0]) first = packet; } finally { w.dispose(); } }
  phase = graph + '-repeat'; { const p = input(cases[0]), w = open(p); try { const packet = { input: p, before: w.getState(), after: step(w) }; capture('repeat', packet); assert.deepEqual(packet, first); } finally { w.dispose(); } }
  phase = graph + '-recorder'; { const p = input(cases[0]), w = open(p), r = api.createPhysicsRecorder(w); let restored; try { const first = step(r), saved = r.saveRecording(), continued = step(r); put(graph + '-pre-restore.json', raw({ input: p, first, saved, continued })); assert(count.worlds < budget.maxWorlds); restored = api.restorePhysicsRecording(saved, { model: p.model, options: p.options, providerDigest: provider }); count.worlds++; count.acceptedSteps++; count.restores++; assert.deepEqual(restored.recorder.getState(), first); assert.deepEqual(restored.recorder.saveRecording(), saved); const resumed = step(restored.recorder); capture('recording', { input: p, first, saved, continued, resumed }); assert.deepEqual(resumed, continued); assert.deepEqual(restored.recorder.saveRecording(), r.saveRecording()); } finally { restored?.recorder.dispose(); restored?.world.dispose(); r.dispose(); w.dispose(); } }
  for (const mode of ['known', 'unknown']) {
   phase = graph + '-' + mode; const p = input(cases[0]), w = open(p), cw = open(p), r = api.createPhysicsRecorder(w), cr = api.createPhysicsRecorder(cw);
   try { if (mode === 'known') assert.deepEqual(step(r), step(cr)); const before = snap(r); capture(mode + '-before', { input: p, before });
    if (mode === 'known') { assert.throws(() => r.step([{ kind: 'impulse', bodyId: p.moving, impulseNs: [100000, 0, 0] }]), error => error instanceof api.PhysicsError && error.code === 'NUMERIC_LIMIT'); count.knownRefusals++; }
    else { const original = Math.sqrt, marker = new Error('TANGENT_CANDIDATE_AFTER_NORMAL_FAILURE'); let caught, stack; Math.sqrt = x => { const s = new Error().stack; if (/\bat solve\b/.test(s)) { stack = s; throw marker; } return original(x); }; try { step(r); } catch (error) { caught = error; } finally { Math.sqrt = original; } put(graph + '-unknown-stack.json', { stack: stack ?? null, sameErrorObject: caught === marker, error: caught ? { name: caught.name, message: caught.message } : null }); put(graph + '-unknown-post-call.json', raw(snap(r))); assert.equal(caught, marker); assert(stack && /\bat solve\b/.test(stack)); count.unknownRefusals++; }
    const refused = snap(r); capture(mode + '-refused', { before, refused }); assert.deepEqual(refused, before); const retry = step(r), expected = step(cr); capture(mode + '-retry', { retry, expected, recovered: snap(r), control: snap(cr) }); assert.deepEqual(retry, expected); assert.deepEqual(snap(r), snap(cr));
   } finally { r.dispose(); cr.dispose(); w.dispose(); cw.dispose(); }
  }
  assert.equal(count.worlds, budget.worlds); assert.equal(count.acceptedSteps, budget.acceptedSteps); assert.equal(count.creationRefusals, budget.creationRefusals ?? 0); put(graph + '-counts.json', { count, maxima: max, evidenceBytes: bytes - graphStart });
 }
} catch (error) { failure = { phase, name: error.name, message: error.message, stack: error.stack }; }
const summary = { caseFile, status: failure ? 'FAIL_TANGENT_PUBLIC_API' : 'PASS_TANGENT_PUBLIC_API', pins, counts, maxima, firstFailure: failure, evidenceBytes: bytes, browser: 'NOT_RUN', scope: 'centered primitive cuboids with principal contact normal and zero normal-tangent coupling' };
put('summary.json', summary); console.log(JSON.stringify(summary)); if (failure) process.exitCode = 1;
