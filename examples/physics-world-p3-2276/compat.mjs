/** Frozen bounded control recipes. Import creates no World and runs no control. */
import { dynamicPart, staticPart, kinematicPart, makeModel } from '../physics-model-input/model.mjs';
import { makeP3Fixture } from './fixture.mjs';
import { compareOriginalStep, firstBitsDifference } from './compare.mjs';
import { negativeZeroPaths } from '../physics-rigid-hinge-velocity-world-reference/raw-codec.mjs';
import { restoreNegativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';

const clone = value => structuredClone(value);
const LIMITS = Object.freeze({ constructors: 47, attempts: 4182, queries: 18, explicitDisposals: 4, internalCapCases: 12, internalCapLeafCalls: 14 });
const KEYS = ['constructors', 'attempts', 'accepted', 'refused', 'getters', 'queries', 'explicitDisposals',
  'cleanupAttempts', 'cleanupCompleted', 'internalCapCases', 'internalCapLeafCalls', 'independentStepsQualified'];
const restriction = 'dynamic pair supports one joint between two dynamic spheres';
function need(value, message) { if (!value) throw new Error('P3 compatibility: ' + message); }
function same(expected, actual, label) {
  const difference = firstBitsDifference(expected, actual, label);
  if (difference) { const error = new Error('P3 compatibility exact mismatch: ' + label); error.firstDifference = difference; throw error; }
}

/** DATA-only covariance check. Preserve the observed traversal, then map only
 * null contact records to the immutable bank's directed physical roles/order.
 * Every position number keeps its original binary64 bits. */
export function compareVariantObservedStep(input) {
  const reject = (disposition, path, reason) => ({ qualified: false, disposition,
    checks: { traversalMapping: false }, firstDifference: { path, reason },
    certificateReuse: { authorized: false, mode: 'variant-traversal-not-qualified' } });
  if (!['RENAME', 'PERMUTE'].includes(input.variant))
    return reject('UNRESOLVED', '/variant', 'only the two frozen identity/order variants are selected');
  if (!input.trace || !Array.isArray(input.trace.negativeZeroPaths) || !Array.isArray(input.trace.contactChecks))
    return reject('UNRESOLVED', '/trace/contactChecks', 'actual traversal and signed-zero authority are required');
  const trace = clone(input.trace);
  restoreNegativeZeroPaths(trace, trace.negativeZeroPaths);
  const actualTraversal = clone(trace.contactChecks), expectedTraversal = input.bankRow?.request?.attempt?.contactChecks;
  if (actualTraversal.length !== 32 || !Array.isArray(expectedTraversal) || expectedTraversal.length !== 32)
    return reject('UNRESOLVED', '/trace/contactChecks', 'both complete 32-record traversals are required');

  // Identify A/B roles from each declared directed joint and original rest
  // coordinates. No ID text chooses the numerical role.
  function roles(bodies, joints, modern) {
    const byId = new Map(bodies.map(body => [body.id, body]));
    const result = new Map();
    for (const joint of joints) {
      const aId = modern ? joint.bodyAId : joint.aId, bId = modern ? joint.bodyBId : joint.bId;
      const a = byId.get(aId), b = byId.get(bId);
      if (!a || !b || joint.kind !== 'hinge') return null;
      const ap = modern ? a.initial.positionM : a.positionM, bp = modern ? b.initial.positionM : b.positionM;
      const z = ap[2];
      if ((z !== 0 && z !== 1) || firstBitsDifference([-.1, 0, z], ap) || firstBitsDifference([.1, 0, z], bp) ||
        result.has('A' + z) || result.has('B' + z)) return null;
      result.set('A' + z, aId); result.set('B' + z, bId);
    }
    return result.size === 4 ? result : null;
  }
  const rest = input.bankRow.request.config;
  const actualRoles = roles(input.model.bodies, input.model.joints, true), originalRoles = roles(rest.bodies, rest.joints, false);
  if (!actualRoles || !originalRoles) return reject('NUMERICAL_MISMATCH', '/model', 'directed literal physical-role mapping failed');
  const ids = new Map([...actualRoles].map(([role, id]) => [id, originalRoles.get(role)]));
  const expectedByPair = new Map();
  for (const [ordinal, contact] of expectedTraversal.entries()) {
    if (contact.hit !== null || contact.pass !== Math.floor(ordinal / 4) || contact.pairIndex !== ordinal % 4)
      return reject('UNRESOLVED', '/bank/contactChecks', 'original no-hit traversal authority is inconsistent');
    const key = contact.pass + ':' + [contact.aId, contact.bId].sort().join('\u0000');
    if (expectedByPair.has(key)) return reject('UNRESOLVED', '/bank/contactChecks', 'duplicate original pair authority');
    expectedByPair.set(key, { contact, ordinal });
  }
  const normalized = Array(32), mapping = [], raw = Buffer.alloc(32 * 6 * 8);
  for (const [ordinal, contact] of actualTraversal.entries()) {
    if (contact.hit !== null) return reject('NUMERICAL_MISMATCH', '/trace/contactChecks/' + ordinal + '/hit', 'contact-role normalization permits actual null hits only');
    if (contact.pass !== Math.floor(ordinal / 4) || contact.pairIndex !== ordinal % 4 ||
      !ids.has(contact.aId) || !ids.has(contact.bId) || contact.aId === contact.bId ||
      !Array.isArray(contact.aPositionM) || contact.aPositionM.length !== 3 ||
      !Array.isArray(contact.bPositionM) || contact.bPositionM.length !== 3 ||
      [...contact.aPositionM, ...contact.bPositionM].some(value => !Number.isFinite(value)))
      return reject('UNRESOLVED', '/trace/contactChecks/' + ordinal, 'observed traversal order/endpoints/positions are incomplete');
    const aId = ids.get(contact.aId), bId = ids.get(contact.bId);
    const entry = expectedByPair.get(contact.pass + ':' + [aId, bId].sort().join('\u0000'));
    if (!entry || normalized[entry.ordinal])
      return reject('NUMERICAL_MISMATCH', '/trace/contactChecks/' + ordinal, 'observed pair is missing, repeated or outside the cross-component set');
    const swapped = aId !== entry.contact.aId;
    normalized[entry.ordinal] = { pass: contact.pass, pairIndex: entry.contact.pairIndex,
      aId: swapped ? bId : aId, bId: swapped ? aId : bId,
      aPositionM: [...(swapped ? contact.bPositionM : contact.aPositionM)],
      bPositionM: [...(swapped ? contact.aPositionM : contact.bPositionM)], hit: contact.hit };
    [...contact.aPositionM, ...contact.bPositionM].forEach((value, component) => raw.writeDoubleLE(value, (ordinal * 6 + component) * 8));
    mapping.push({ actualOrdinal: ordinal, normalizedOrdinal: entry.ordinal, pass: contact.pass,
      actualPairIndex: contact.pairIndex, normalizedPairIndex: entry.contact.pairIndex, endpointsSwapped: swapped });
  }
  if (normalized.some(contact => !contact)) return reject('UNRESOLVED', '/trace/contactChecks', 'normalized traversal is incomplete');
  trace.contactChecks = normalized;
  delete trace.negativeZeroPaths;
  trace.negativeZeroPaths = negativeZeroPaths(trace);
  const comparison = compareOriginalStep({ ...input, trace });
  return { ...comparison, traversalMapping: {
    mode: 'null-hit-directed-physical-role-order-only', actualTraversal,
    actualTraversalNegativeZeroPaths: negativeZeroPaths(actualTraversal), actualPositionF64leHex: raw.toString('hex'),
    bodyRoleMap: [...ids].map(([actualId, originalId]) => ({ actualId, originalId })), mapping,
    numericValuesChanged: false, contactArithmeticCalls: 0, originalComparatorChanged: false,
  } };
}

export function makeControlBudget(prior = {}) {
  return { limits: { ...LIMITS }, counts: Object.fromEntries(KEYS.map(key => [key, prior[key] ?? 0])) };
}
function charge(budget, key) {
  need(budget && Object.hasOwn(budget.counts, key), 'shared count missing: ' + key);
  const next = budget.counts[key] + 1;
  if (Object.hasOwn(LIMITS, key)) need(next <= LIMITS[key], key + ' ceiling would be exceeded');
  budget.counts[key] = next;
}
function providerValid(provider) {
  need(typeof provider?.createPhysicsWorld === 'function' && typeof provider.PhysicsError === 'function', 'actual provider and error constructor required');
}
function known(provider, error) {
  need(error instanceof provider.PhysicsError, 'unknown thrown value; stop without inspecting payload');
  return { code: error.code, message: error.message, details: clone(error.details) };
}
function expectedError(provider, call, code, message) {
  let returned = false, error;
  try { call(); returned = true; } catch (value) { error = known(provider, value); }
  need(!returned, 'expected refusal returned'); same({ code, message }, { code: error.code, message: error.message }, '/knownError');
  return error;
}
function read(context, budget) { charge(budget, 'getters'); return context.world.getState(); }
function rawPublic(state) {
  const bytes = Buffer.alloc(state.bodies.length * 104); let offset = 0;
  for (const body of state.bodies) for (const key of ['positionM', 'velocityMps', 'orientationXYZW', 'angularVelocityRadps']) {
    for (const value of body[key]) { need(Number.isFinite(value), 'nonfinite public raw'); bytes.writeDoubleLE(value, offset); offset += 8; }
  }
  return bytes.toString('hex');
}
function retained(context, checkpoint, budget) {
  const actual = read(context, budget); same(checkpoint, actual, '/retainedPublicState');
  same(rawPublic(checkpoint), rawPublic(actual), '/retainedPublicRaw');
}
function comparable(state) {
  const result = clone(state); delete result.identity.providerDigest; return result;
}
async function save(record, graph, name, value, budget) {
  const detached = clone(value);
  await record({ graph, name, ...detached, counts: { ...budget.counts }, negativeZeroPaths: negativeZeroPaths(detached) });
}
function construct(provider, fixture, budget) {
  charge(budget, 'constructors');
  return provider.createPhysicsWorld(fixture.model, fixture.options);
}
async function step(context, commands, budget, advance = (value, actions) => value.world.step(actions)) {
  charge(budget, 'attempts');
  try { const state = await advance(context, commands); charge(budget, 'accepted'); return { state, error: null }; }
  catch (error) { charge(budget, 'refused'); const value = known(context.provider, error); return { state: null, error: value }; }
}
async function cleanup(context, budget) {
  charge(budget, 'cleanupAttempts'); context.world.dispose(); context.closed = true; charge(budget, 'cleanupCompleted');
}
async function qualify(context, before, after, qualifyStep, budget) {
  need(typeof qualifyStep === 'function', 'independent saved-step comparison callback required');
  const comparison = await qualifyStep({ model: context.model, options: context.options, before, after,
    stepIndex: after.stepIndex, variant: context.variant, trace: context.trace ?? null });
  need(comparison?.qualified === true && comparison.certificateReuse?.authorized === true, 'new empty step did not independently qualify');
  charge(budget, 'independentStepsQualified'); return comparison;
}

/** Two selected first steps. Parent retains RENAME only for source/compiled S1 controls. */
export async function runVariantGraph({ graph, candidate, qualifyStep, record, budget, keepRename = false, advanceStep }) {
  providerValid(candidate); need(typeof record === 'function', 'record callback required');
  let renameContext = null;
  try {
  for (const variant of ['RENAME', 'PERMUTE']) {
    const caller = makeP3Fixture(variant), fixture = clone(caller);
    const world = construct(candidate, caller, budget);
    const context = { world, provider: candidate, model: fixture.model, options: fixture.options, variant, trace: null };
    let kept = false;
    try {
      const initial = read(context, budget);
      caller.model.bodies[0].initial.positionM[0] = 99;
      caller.model.joints[0].motor.targetSpeedRadps = 99;
      retained(context, initial, budget);
      const actual = await step(context, [], budget, advanceStep);
      need(actual.error === null, variant + ' first step refused');
      const comparison = await qualify(context, initial, actual.state, qualifyStep, budget);
      await save(record, graph, variant + '-first-step', { kind: 'PUBLIC_QUALIFIED_EMPTY_STEP', variant,
        before: initial, after: actual.state, beforeRawHex: rawPublic(initial), afterRawHex: rawPublic(actual.state),
        constructorCopy: true, comparison }, budget);
      if (variant === 'RENAME' && keepRename) {
        context.setupState = actual.state; context.checkpoint = clone(actual.state);
        renameContext = context; kept = true;
      }
    } finally { if (!kept) await cleanup(context, budget); }
  }
  } catch (error) {
    if (renameContext && !renameContext.closed) await cleanup(renameContext, budget);
    throw error;
  }
  return { renameContext, counts: { ...budget.counts } };
}

function makeLegacy(name) {
  const zero = [0, 0, 0], shape = radiusM => ({ kind: 'sphere', radiusM });
  const a = (id, positionM, radiusM = .1) => dynamicPart(id, shape(radiusM), { positionM });
  let parts, joint, dt = 1 / 120, gravityMps2 = zero, commands;
  if (name === 'LC' || name === 'LO') {
    parts = [a('part:a', name === 'LO' ? [-.1, 0, 0] : zero), a('part:b', name === 'LO' ? [.1, 0, 0] : zero)];
    joint = { id: name === 'LC' ? 'joint:pair' : 'joint:hinge', kind: 'hinge', bodyAId: 'part:a', bodyBId: 'part:b',
      anchorALocalM: name === 'LO' ? [.1, 0, 0] : zero, anchorBLocalM: name === 'LO' ? [-.1, 0, 0] : zero,
      axisWorld: [0, 0, 1], limitRad: name === 'LC' ? [-.51, .51] : [-.8, .8],
      motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: name === 'LC' ? .0005 : .01 } };
    commands = name === 'LC' ? Array.from({ length: 122 }, (_, index) => index === 120 ?
      [{ kind: 'angularImpulse', bodyId: 'part:b', angularImpulseNms: [0, 0, .01] }] : []) : [[], []];
  } else {
    const fixed = (id, bodyAId, bodyBId) => ({ id, kind: 'fixed', bodyAId, bodyBId, anchorALocalM: zero, anchorBLocalM: zero });
    if (name === 'LDF') {
      parts = [a('part:a', zero), a('part:b', zero)]; joint = fixed('joint:fixed', 'part:a', 'part:b');
      commands = [[{ kind: 'angularImpulse', bodyId: 'part:b', angularImpulseNms: [0, .0001, 0] }], []];
    } else if (name === 'LSF') {
      parts = [staticPart('fixture:anchor', shape(.1), { positionM: zero }), a('part:held', zero)];
      joint = fixed('joint:fixed', 'fixture:anchor', 'part:held'); gravityMps2 = [0, -9.81, 0]; commands = [[], []];
    } else if (name === 'LSH') {
      dt = 1 / 60; parts = [staticPart('fixture:anchor', shape(.1), { positionM: zero }), a('part:held', [1, 0, 0], 1)];
      joint = { id: 'joint:hinge', kind: 'hinge', bodyAId: 'fixture:anchor', bodyBId: 'part:held',
        anchorALocalM: zero, anchorBLocalM: [-1, 0, 0], axisWorld: [0, 0, 1], limitRad: [-.5, .5], motor: null };
      commands = [[{ kind: 'angularImpulse', bodyId: 'part:held', angularImpulseNms: [0, 0, .4] }], []];
    } else {
      need(name === 'LKF', 'unknown legacy fixture'); dt = 1 / 60;
      parts = [kinematicPart('fixture:anchor', shape(.1), { positionM: zero }), a('part:held', zero)];
      joint = fixed('joint:fixed', 'fixture:anchor', 'part:held');
      commands = [[{ kind: 'kinematicTarget', bodyId: 'fixture:anchor', positionM: [.1, 0, 0] }]];
    }
  }
  return { model: makeModel({ revision: 'p3-legacy-' + name, gravityMps2, parts, joints: [joint] }),
    options: { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' }, commands };
}

async function legacyControls({ graph, baseline, candidate, record, budget }) {
  for (const name of ['LC', 'LO', 'LDF', 'LSF', 'LSH', 'LKF']) {
    const fixture = makeLegacy(name), contexts = [];
    try {
      for (const [role, provider] of [['baseline', baseline], ['candidate', candidate]]) contexts.push({
        role, provider, world: construct(provider, clone(fixture), budget), model: fixture.model, options: fixture.options });
      let checkpoints = contexts.map(context => read(context, budget));
      same(comparable(checkpoints[0]), comparable(checkpoints[1]), '/' + name + '/initial');
      for (let index = 0; index < fixture.commands.length; index++) {
        const actual = [];
        for (const [slot, context] of contexts.entries()) {
          const result = await step(context, clone(fixture.commands[index]), budget);
          if (name === 'LC') {
            need(index < 121 ? result.error === null : result.error !== null, 'LC original accepted/refused prefix changed');
            if (index === 121) same({ code: 'NUMERIC_LIMIT', message: 'joint:pair exceeded motor reaction limit' },
              { code: result.error.code, message: result.error.message }, '/LC/cap');
          }
          if (result.error) retained(context, checkpoints[slot], budget);
          actual.push({ result, retained: read(context, budget) });
        }
        same(actual[0].result.error, actual[1].result.error, '/' + name + '/error');
        same(comparable(actual[0].retained), comparable(actual[1].retained), '/' + name + '/state');
        await save(record, graph, name + '-' + (index + 1), { kind: 'LEGACY_COMPATIBILITY', recipe: name,
          commands: fixture.commands[index], baseline: actual[0], candidate: actual[1],
          baselineRawHex: rawPublic(actual[0].retained), candidateRawHex: rawPublic(actual[1].retained) }, budget);
        checkpoints = actual.map(item => item.retained);
        if (actual[0].result.error) break;
      }
    } finally {
      const failures = [];
      for (const context of contexts) { try { await cleanup(context, budget); } catch (error) { failures.push(error); } }
      if (failures.length) throw failures[0];
    }
  }
}

async function constructorControls({ graph, candidate, record, budget }) {
  const cases = [
    ['duplicate-B', model => { model.joints[1].bodyAId = model.joints[0].bodyAId; model.joints[1].bodyBId = model.joints[0].bodyBId; }, 'joint needs a distinct A and unique dynamic B'],
    ['shared-A', model => { model.joints[1].bodyAId = model.joints[0].bodyAId; model.joints[1].anchorBLocalM = [-.1, 0, -1]; }, restriction],
    ['axis', model => { model.joints[0].axisWorld = [0, 1, 0]; }, restriction],
    ['limit', model => { model.joints[0].limitRad = [-.7, .8]; }, restriction],
    ['anchor', model => { model.joints[0].anchorALocalM = [.09, 0, 0]; }, 'initial joint anchors must coincide'],
    ['sparse-anchor', model => { model.joints[0].anchorALocalM = Array(3); }, 'arrays must be dense ordinary data arrays'],
  ];
  for (const [name, mutate, message] of cases) {
    const fixture = makeP3Fixture(); mutate(fixture.model); charge(budget, 'constructors');
    let unexpected = null, error;
    try {
      error = expectedError(candidate, () => {
        unexpected = candidate.createPhysicsWorld(fixture.model, fixture.options); return unexpected;
      }, 'INVALID_CONFIG', message);
    } finally { if (unexpected) await cleanup({ world: unexpected }, budget); }
    await save(record, graph, 'constructor-' + name, { kind: 'PUBLIC_ADMISSION_REFUSAL', error }, budget);
  }
}

function newCommandCases(context) {
  const bodies = new Map(context.model.bodies.map(body => [body.id, body]));
  const joints = [...context.model.joints].sort((a, b) => bodies.get(a.bodyAId).initial.positionM[2] - bodies.get(b.bodyAId).initial.positionM[2]);
  const cases = [], axisError = 'dynamic hinge admits axis-aligned angular commands only';
  const emptyError = 'disjoint hinge profile supports empty commands only';
  for (const [index, joint] of joints.entries()) {
    for (const [name, bodyId, kind, key, vector, message] of [
      ['force', joint.bodyAId, 'force', 'forceN', [0, 0, 0], axisError],
      ['impulse', joint.bodyBId, 'impulse', 'impulseNs', [0, 0, 0], axisError],
      ['offaxis-torque', joint.bodyAId, 'torque', 'torqueNm', [.001, 0, 0], axisError],
      ['offaxis-angular', joint.bodyBId, 'angularImpulse', 'angularImpulseNms', [.001, 0, 0], axisError],
      ['axis-torque', joint.bodyAId, 'torque', 'torqueNm', [0, 0, .001], emptyError],
      ['axis-angular', joint.bodyBId, 'angularImpulse', 'angularImpulseNms', [0, 0, .001], emptyError],
    ]) cases.push({ name: 'pair' + index + '-' + name, input: [{ kind, bodyId, [key]: vector }], message });
  }
  const b0 = joints[0].bodyBId, b1 = joints[1].bodyBId;
  const angular = (bodyId, value = [0, 0, .001]) => ({ kind: 'angularImpulse', bodyId, angularImpulseNms: value });
  cases.push(
    { name: 'scalar-instead-of-commands', input: 1 / 100, message: 'commands must be a dense array of at most 64' },
    { name: 'commands-null', input: null, message: 'commands must be a dense array of at most 64' },
    { name: 'commands-hole', input: Array(1), message: 'arrays must be dense ordinary data arrays' },
    { name: 'command-missing-body', input: [{ kind: 'angularImpulse', angularImpulseNms: [0, 0, .001] }], message: 'command 0 has unsupported fields' },
    { name: 'duplicate-command', input: [angular(b1), angular(b1)], message: 'duplicate angularImpulse command for ' + b1 },
    { name: 'unknown-body', input: [{ kind: 'force', bodyId: 'missing', forceN: [0, 0, 0] }], message: 'command 0 targets an unknown or unsupported body' },
    { name: 'nonfinite', input: [angular(b1, [0, 0, NaN])], message: 'only finite plain data is supported' },
    { name: 'parse-all-precedence', input: [angular(b0), { kind: 'force', bodyId: 'missing', forceN: [0, 0, 0] }], message: 'command 1 targets an unknown or unsupported body' },
  );
  for (const [index, marker] of [new Error('1489-vector-marker'), { marker: '1489-vector-marker' }, null].entries()) {
    let reads = 0;
    const vector = [0, 0, .001]; Object.defineProperty(vector, '0', { enumerable: true, configurable: true, get() { reads++; throw marker; } });
    cases.push({ name: 'accessor-inert-' + index, input: [angular(b1, vector)], message: 'arrays must be dense ordinary data arrays',
      accessorReads: () => reads, historicalUnknownIdentity: 'NOT_APPLICABLE_P0_INERT_DATA' });
  }
  need(cases.length === 23, 'fixed command population changed'); return cases;
}

// Reuse the original independent query recipe from native-controls.mjs. No
// producer collision/query helper supplies these scalar query expectations.
function independentSphereRay(bodies, origin, direction, limit) {
  let best = null;
  for (const body of bodies) {
    const offset = origin.map((value, index) => value - body.positionM[index]);
    const c = offset.reduce((sum, value, index) => sum + value * offset[index], 0) - .1 ** 2;
    const projection = offset.reduce((sum, value, index) => sum + value * direction[index], 0);
    const discriminant = projection ** 2 - c;
    const distance = c <= 0 ? 0 : projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
    if (distance === null || distance > limit) continue;
    if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId) best = { bodyId: body.id, distanceM: distance };
  }
  return best;
}
function mutatePublic(state) {
  const body = state.bodies[0];
  body.positionM[0] = 99; body.orientationXYZW[0] = 99; body.velocityMps[0] = 99; body.angularVelocityRadps[0] = 99; body.sleeping = true;
  for (const joint of state.joints) { joint.linearImpulseOnBNs[0] = 99; joint.angularImpulseOnBNms[0] = 99; joint.angleRad = 99; joint.motorImpulseNms = 99; }
  state.pairStats.eligiblePairs = 99; state.contacts.push({ callerOnly: true }); state.events.push({ callerOnly: true }); state.ccdHits.push({ callerOnly: true });
}

async function reusedWorldControls({ graph, renameContext: context, qualifyStep, record, budget, advanceStep }) {
  need(context?.variant === 'RENAME' && context.checkpoint.stepIndex === 1, 'qualified retained RENAME S1 World required');
  const checkpoint = context.checkpoint;
  let disposed = false;
  try {
    retained(context, checkpoint, budget);
    for (const recipe of newCommandCases(context)) {
      const actual = await step(context, recipe.input, budget);
      need(actual.error !== null, 'nonempty/invalid command returned');
      same({ code: 'INVALID_COMMAND', message: recipe.message }, { code: actual.error.code, message: actual.error.message }, '/newCommand');
      if (recipe.accessorReads) same(0, recipe.accessorReads(), '/accessorReads');
      retained(context, checkpoint, budget);
      await save(record, graph, recipe.name, { kind: 'PUBLIC_ADMISSION_REFUSAL', error: actual.error,
        retainedRawHex: rawPublic(checkpoint), accessorReads: recipe.accessorReads?.() ?? null,
        historicalUnknownIdentity: recipe.historicalUnknownIdentity ?? null }, budget);
    }
    const getterCopy = read(context, budget); mutatePublic(getterCopy); mutatePublic(context.setupState); retained(context, checkpoint, budget);
    charge(budget, 'getters'); const modelCopy = context.world.getModel(); modelCopy.bodies[0].initial.positionM[0] = 99; modelCopy.joints[0].motor.targetSpeedRadps = 99;
    charge(budget, 'getters'); same(context.model, context.world.getModel(), '/modelCopy');
    await save(record, graph, 'public-copies', { kind: 'PUBLIC_COPY', passed: true, bodyShapeInState: 'NOT_APPLICABLE_P0_SCHEMA',
      retainedRawHex: rawPublic(checkpoint) }, budget);
    const colliderByBody = new Map(context.model.colliders.map(collider => [collider.bodyId, collider.id]));
    const roleJoints = [...context.model.joints].sort((a, b) => {
      const byId = new Map(context.model.bodies.map(body => [body.id, body]));
      return byId.get(a.bodyAId).initial.positionM[2] - byId.get(b.bodyAId).initial.positionM[2];
    });
    for (const [z, joint] of roleJoints.entries()) {
      charge(budget, 'queries');
      const overlap = context.world.query({ kind: 'overlap-sphere', centerM: [0, 0, z], radiusM: .2, includeSensors: true });
      same({ kind: 'overlap-sphere', colliderIds: [joint.bodyAId, joint.bodyBId].sort().map(id => colliderByBody.get(id)) }, overlap, '/overlap');
      overlap.colliderIds[0] = 'changed'; retained(context, checkpoint, budget);
      charge(budget, 'queries');
      const ray = context.world.query({ kind: 'raycast', originM: [-2, 0, z], direction: [1, 0, 0], maxDistanceM: 4, includeSensors: true });
      const expected = independentSphereRay(checkpoint.bodies, [-2, 0, z], [1, 0, 0], 4);
      need(expected?.bodyId === joint.bodyAId, 'independent nearest directed A query');
      same({ kind: 'raycast', hit: { ...expected, colliderId: colliderByBody.get(expected.bodyId) } }, ray, '/ray');
      const rayBeforeMutation = clone(ray); ray.hit.distanceM = -1; retained(context, checkpoint, budget);
      await save(record, graph, 'queries-Z' + z, { kind: 'PUBLIC_QUERY', overlapPassed: true, ray: rayBeforeMutation, expected }, budget);
    }
    for (const [name, query, message] of [
      ['query-null', null, 'query must be a plain object'],
      ['query-radius', { kind: 'overlap-sphere', centerM: [0, 0, 0], radiusM: 0, includeSensors: true }, 'radiusM must be finite and in [0.0001, 1000]'],
      ['query-direction', { kind: 'raycast', originM: [0, 0, 0], direction: [1, 1, 0], maxDistanceM: 4, includeSensors: true }, 'direction must be a unit 3-vector'],
    ]) {
      charge(budget, 'queries'); const error = expectedError(context.provider, () => context.world.query(query), 'INVALID_QUERY', message);
      retained(context, checkpoint, budget); await save(record, graph, name, { kind: 'PUBLIC_QUERY_REFUSAL', error }, budget);
    }
    const recovery = await step(context, [], budget, advanceStep); need(recovery.error === null, 'empty recovery refused');
    const comparison = await qualify(context, checkpoint, recovery.state, qualifyStep, budget);
    same(2, recovery.state.stepIndex, '/recoveryCursor');
    await save(record, graph, 'empty-recovery', { kind: 'PUBLIC_QUALIFIED_EMPTY_STEP', variant: 'RENAME', comparison,
      after: recovery.state, afterRawHex: rawPublic(recovery.state) }, budget);
    charge(budget, 'explicitDisposals'); context.world.dispose(); disposed = true; context.closed = true;
    charge(budget, 'explicitDisposals'); context.world.dispose();
    charge(budget, 'getters'); expectedError(context.provider, () => context.world.getState(), 'DISPOSED', 'world is disposed');
    const disposedStep = await step(context, 1 / 100, budget);
    same({ code: 'DISPOSED', message: 'world is disposed' }, { code: disposedStep.error?.code, message: disposedStep.error?.message }, '/disposedStep');
    for (let index = 0; index < 2; index++) { charge(budget, 'queries'); expectedError(context.provider,
      () => context.world.query(null), 'DISPOSED', 'world is disposed'); }
    await save(record, graph, 'disposal', { kind: 'PUBLIC_LIFECYCLE', repeatedDispose: true, disposedStep: disposedStep.error,
      disposedQueries: 2, disposedGetter: true }, budget);
  } finally { if (!disposed) await cleanup(context, budget); }
}

async function capControls({ graph, cap, record, budget, renameContext }) {
  need(typeof cap?.enforceHingeMotorReactionCap === 'function' && typeof cap.PhysicsError === 'function', 'owned internal cap entry and error constructor required');
  const bodies = new Map(renameContext.model.bodies.map(body => [body.id, body]));
  const joints = [...renameContext.model.joints].sort((a, b) => bodies.get(a.bodyAId).initial.positionM[2] - bodies.get(b.bodyAId).initial.positionM[2]);
  const leaf = (id, value) => { charge(budget, 'internalCapLeafCalls'); return cap.enforceHingeMotorReactionCap(id, [0, 0, value]); };
  const cases = [
    ...joints.flatMap(joint => [
      { name: joint.id + '-equal', run: () => leaf(joint.id, .01), refusedId: null },
      { name: joint.id + '-above', run: () => leaf(joint.id, .010000000000000002), refusedId: joint.id },
    ]),
    { name: 'ordered-both-above', run: () => { leaf(joints[0].id, .010000000000000002); leaf(joints[1].id, .010000000000000002); }, refusedId: joints[0].id },
    { name: 'ordered-second-above', run: () => { leaf(joints[0].id, .01); leaf(joints[1].id, .010000000000000002); }, refusedId: joints[1].id },
  ];
  for (const recipe of cases) {
    charge(budget, 'internalCapCases'); let error = null;
    if (recipe.refusedId) error = expectedError(cap, recipe.run, 'NUMERIC_LIMIT', recipe.refusedId + ' exceeded motor reaction limit');
    else recipe.run();
    await save(record, graph, recipe.name, { kind: 'INTERNAL_CAP_GUARD', error, WorldCalls: 0 }, budget);
  }
}

/** One source or compiled population; parent owns invocation and first-failure archive. */
export async function runCompatibilityGraph(options) {
  providerValid(options.baseline); providerValid(options.candidate);
  need(typeof options.record === 'function' && options.renameContext, 'record and retained qualified variant required');
  try {
    await legacyControls(options);
    await constructorControls(options);
    await reusedWorldControls(options);
    await capControls(options);
    return { status: 'PASS', counts: { ...options.budget.counts },
      proofBoundary: 'current-P0 implementation compatibility; selected RENAME first-step/recovery only; historical unknown getter identity not applicable' };
  } finally {
    if (!options.renameContext.closed) await cleanup(options.renameContext, options.budget);
  }
}
