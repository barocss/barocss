import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const id = process.argv[2]; assert(/^[a-z0-9-]+$/.test(id ?? ''), 'fresh evidence ID required');
const out = resolve(home, 'evidence', id); mkdirSync(out, { recursive: false });
const dt = 1 / 120, mass = 2, g = 9.81, e = .25, speed = 2 + g * dt;
const impactVelocity = speed * e, flightVelocity = impactVelocity - g * dt;
const commands = [{ kind: 'impulse', bodyId: 'moving', impulseNs: [0, -4, 0] }];
const model = makeModel({ revision: 'g2-persistent-warmed-impact', gravityMps2: [0, -g, 0], parts: [
 staticPart('floor', { kind: 'box', halfExtentsM: [2, .5, 2] }, { positionM: [0, -.5, 0] }, { restitution: e }),
 dynamicPart('moving', { kind: 'box', halfExtentsM: [.5, .5, .5] }, { positionM: [0, .5, 0] }, mass, { restitution: .8 }),
] });
const options = { profile: 'rigid-persistent-box-v1', fixedStepSeconds: dt, broadPhase: 'direct' };
const gates = { velocity: 1e-10, omega: 1e-10, impulse: 1e-10, momentum: 1e-10, angularMomentum: 1e-10, gap: 1e-10, energy: 1e-10, tangent: 1e-12 };
const budget = { worlds: 3, acceptedSteps: 9, maxWorlds: 8, maxAcceptedSteps: 16, maxEvidenceBytes: 16 * 1024 * 1024 };
const raw = x => typeof x === 'number' ? { $f64le: (() => { assert(Number.isFinite(x)); const b = Buffer.alloc(8); b.writeDoubleLE(x); return b.toString('hex'); })() } : Array.isArray(x) ? x.map(raw) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, raw(v)])) : x;
const normalize = x => Array.isArray(x) ? x.map(normalize) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'providerDigest' ? 'VALIDATED_OWN_GRAPH' : normalize(v)])) : x;
let bytes = 0, graphStartBytes = 0, phase = 'freeze', failure = null;
const put = (name, value) => { const s = JSON.stringify(value, null, 2) + '\n'; bytes += Buffer.byteLength(s); assert(bytes - graphStartBytes <= budget.maxEvidenceBytes, 'evidence byte cap'); writeFileSync(resolve(out, name), s, { flag: 'wx' }); };
const pins = Object.fromEntries(['WARM-CONTRACT.md', 'warm-run.mjs'].map(name => [name, createHash('sha256').update(readFileSync(resolve(home, name))).digest('hex')]));
put('frozen-inputs.json', { pins, model, options, commands, gates, budget, reference: { speed, impactVelocity, impactImpulse: mass * speed * (1 + e), flightVelocity }, represented: raw({ model, options, commands, gates, dt, mass, g, e, speed, impactVelocity, flightVelocity }) });
const source = new Map(), counts = {}, maxima = {};
try {
 for (const graph of ['source', 'native']) {
  phase = graph + '-import'; graphStartBytes = bytes;
  const api = graph === 'source' ? await import(pathToFileURL(resolve(home, 'build/source.mjs'))) : { ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/index.js'))), ...await import(pathToFileURL(resolve(root, 'packages/barocss-physics/dist/replay.js'))) };
  const count = counts[graph] = { worlds: 0, acceptedSteps: 0, restores: 0, unknownRefusals: 0 };
  const max = maxima[graph] = Object.fromEntries(Object.keys(gates).map(k => [k, 0]));
  let provider;
  const open = () => { assert(count.worlds < budget.maxWorlds); const w = api.createPhysicsWorld(model, options); count.worlds++; const digest = w.getState().identity.providerDigest; provider ??= digest; assert.equal(digest, provider); return w; };
  const step = (recorder, input = []) => { assert(count.acceptedSteps < budget.maxAcceptedSteps); const state = recorder.step(input); count.acceptedSteps++; return state; };
  const snapshot = r => ({ state: r.getState(), log: r.saveRecording() });
  const capture = (name, data) => { const packet = raw(data); put(graph + '-' + name + '.json', packet); if (graph === 'source') source.set(name, packet); else assert.deepEqual(normalize(packet), normalize(source.get(name)), 'Source/Native ' + name); };
  const gate = (key, value) => { assert(Number.isFinite(value), key); max[key] = Math.max(max[key], Math.abs(value)); assert(Math.abs(value) <= gates[key], `${key}: ${value} > ${gates[key]}`); };
  // Free velocities include the command and this step's gravity. Newton restitution,
  // linear momentum, primitive COM angular momentum and energy give the reference.
  function check(state, freeVelocity, expectedVelocity, expectedImpulse, height, restitution) {
   const body = state.bodies.find(b => b.id === 'moving'); assert(body);
   for (let i = 0; i < 3; i++) { gate('velocity', body.velocityMps[i] - (i === 1 ? expectedVelocity : 0)); gate('omega', body.angularVelocityRadps[i]); gate('angularMomentum', mass / 6 * body.angularVelocityRadps[i] + mass * (body.positionM[(i + 1) % 3] * body.velocityMps[(i + 2) % 3] - body.positionM[(i + 2) % 3] * body.velocityMps[(i + 1) % 3])); }
   const impulse = state.contacts.reduce((sum, c) => sum + c.normalImpulseNs, 0);
   gate('impulse', impulse - expectedImpulse); gate('momentum', mass * (body.velocityMps[1] - freeVelocity) - impulse);
   gate('gap', body.positionM[1] - height);
   for (const contact of state.contacts) for (const v of contact.tangentImpulseOnBNs) gate('tangent', v);
   const kinetic = mass / 2 * body.velocityMps.reduce((sum, v) => sum + v * v, 0) + mass / 12 * body.angularVelocityRadps.reduce((sum, v) => sum + v * v, 0);
   const loss = restitution === null ? 0 : mass / 2 * freeVelocity * freeVelocity * (1 - restitution * restitution);
   gate('energy', kinetic - mass / 2 * freeVelocity * freeVelocity + loss);
   if (restitution !== null && restitution > 0) assert(body.velocityMps[1] > 0, 'strict positive rebound');
   return { freeVelocity, expectedVelocity, expectedImpulse, height, restitution, impulse, kinetic, loss };
  }
  const checkSupport = s => { assert(s.contacts.length > 0); assert(s.contacts.some(c => c.normalImpulseNs > 0), 'nonzero warmed impulse'); return check(s, -g * dt, 0, mass * g * dt, .5, 0); };
  const checkImpact = s => check(s, -speed, impactVelocity, mass * speed * (1 + e), .5, e);
  const checkFlight = s => { assert.equal(s.contacts.length, 0, 'prior target must clear in flight'); return check(s, flightVelocity, flightVelocity, 0, .5 + dt * flightVelocity, null); };
  const world = open(), clean = api.createPhysicsRecorder(world); let restored, faultWorld, fault;
  try {
   phase = graph + '-support'; const initial = snapshot(clean), supported = step(clean), warmed = snapshot(clean); capture('support', { initial, supported, warmed }); const supportReference = checkSupport(supported);
   phase = graph + '-restore-warmed'; assert(count.worlds < budget.maxWorlds); restored = api.restorePhysicsRecording(warmed.log, { model, options, providerDigest: provider }); count.worlds++; count.acceptedSteps++; count.restores++;
   const restoredWarm = snapshot(restored.recorder); capture('restored-warm', restoredWarm); assert.deepEqual(restoredWarm, warmed);
   phase = graph + '-clean-impact'; const impact = step(clean, commands), cleanImpact = snapshot(clean); capture('clean-impact', cleanImpact); const impactReference = checkImpact(impact);
   phase = graph + '-restored-impact'; const restoredImpact = step(restored.recorder, commands), restoredImpactSnapshot = snapshot(restored.recorder); capture('restored-impact', restoredImpactSnapshot); checkImpact(restoredImpact); assert.deepEqual(restoredImpactSnapshot, cleanImpact);
   phase = graph + '-clean-flight'; const flight = step(clean), cleanFlight = snapshot(clean); capture('clean-flight', cleanFlight); const flightReference = checkFlight(flight);
   phase = graph + '-restored-flight'; const restoredFlight = step(restored.recorder), restoredFlightSnapshot = snapshot(restored.recorder); capture('restored-flight', restoredFlightSnapshot); checkFlight(restoredFlight); assert.deepEqual(restoredFlightSnapshot, cleanFlight);
   phase = graph + '-fault-warm'; faultWorld = open(); fault = api.createPhysicsRecorder(faultWorld); const faultSupport = step(fault), before = snapshot(fault); capture('fault-before', before); checkSupport(faultSupport); assert.deepEqual(before, warmed);
   phase = graph + '-fault-impact'; const original = Math.sqrt, marker = new Error('PERSISTENT_WARMED_AFTER_NORMAL_IMPULSE_FAILURE'); let stack, sqrtCalls = 0, caught;
   Math.sqrt = x => { sqrtCalls++; const here = new Error().stack; if (here.includes('solvePersistentPoint')) { stack = here; throw marker; } return original(x); };
   try { fault.step(commands); count.acceptedSteps++; } catch (error) { caught = error; } finally { Math.sqrt = original; }
   const refused = snapshot(fault); put(graph + '-unknown-stack.json', { stack: stack ?? null, sqrtCalls, sameErrorObject: caught === marker, error: caught ? { name: caught.name, message: caught.message } : null }); capture('fault-refused', { before, refused });
   assert.equal(caught, marker, 'same actual solver fault object'); assert(stack.includes('solvePersistentPoint')); count.unknownRefusals++; assert.deepEqual(refused, before);
   phase = graph + '-fault-retry'; const retry = step(fault, commands), retried = snapshot(fault); capture('fault-retry', retried); checkImpact(retry); assert.deepEqual(retried, cleanImpact);
   phase = graph + '-fault-flight'; const recoveryFlight = step(fault), recovered = snapshot(fault); capture('fault-flight', recovered); checkFlight(recoveryFlight); assert.deepEqual(recovered, cleanFlight);
   put(graph + '-references.json', { supportReference, impactReference, flightReference });
   assert.equal(count.worlds, budget.worlds); assert.equal(count.acceptedSteps, budget.acceptedSteps); assert.equal(count.unknownRefusals, 1); put(graph + '-counts.json', { count, maxima: max, evidenceBytes: bytes - graphStartBytes });
  } finally { fault?.dispose(); faultWorld?.dispose(); restored?.recorder.dispose(); restored?.world.dispose(); clean.dispose(); world.dispose(); }
 }
} catch (error) { failure = { phase, name: error.name, message: error.message, stack: error.stack }; }
const summary = { status: failure ? 'FAIL_WARMED_PERSISTENT_PUBLIC_API' : 'PASS_WARMED_PERSISTENT_PUBLIC_API', pins, counts, maxima, firstFailure: failure, evidenceBytes: bytes, originalQualification: 'PRESERVED', browser: 'NOT_RUN' };
put('summary.json', summary); console.log(JSON.stringify(summary)); if (failure) process.exitCode = 1;
