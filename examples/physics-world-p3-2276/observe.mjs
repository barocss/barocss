/** TESTONLY source transformations. Import performs no model or mathematical call. */
import { createHash } from 'node:crypto';
import { rawBodiesHex, negativeZeroPaths } from '../physics-rigid-hinge-velocity-world-reference/raw-codec.mjs';

const KEY = '__barocssP3Observe';
const sha = source => createHash('sha256').update(source).digest('hex');
const BRIDGE = `\n// TESTONLY: no public observer or runtime option.\nconst __p3Observe = (event: unknown): void => {\n  const sink = (globalThis as unknown as { ${KEY}?: (event: unknown) => void }).${KEY};\n  if (sink) sink(event);\n};\n`;

function replace(source, old, next, sites, label) {
  if (source.split(old).length !== 2) throw new Error('P3 observation anchor is not unique: ' + label);
  sites.push(label);
  return source.replace(old, next);
}

/** Apply only to a fresh staged copy. Freeze original AND effective bytes. */
export function instrumentP3Source(relativePath, sourceText) {
  const path = relativePath.replaceAll('\\', '/').replace(/^.*\/src\//, '');
  const sites = [];
  let source = sourceText;
  const change = (old, next, label) => { source = replace(source, old, next, sites, label); };
  const phase = (name, bodies = 'next') => `__p3Observe({ kind: 'phase', phase: '${name}', stepIndex: stepIndex + 1, bodies: ${bodies} });`;
  if (path === 'world.ts') {
    change('      const next = bodies.map(copyBody);', '      const next = bodies.map(copyBody);\n      ' + phase('source', 'bodies'), 'source');
    change('      if (disjointHinges) driveDisjointHingeMotors', '      ' + phase('angular') + '\n      if (disjointHinges) driveDisjointHingeMotors', 'angular');
    change('      for (let bodyIndex = 0; bodyIndex < next.length; bodyIndex++) {',
      '      ' + phase('motor') + "\n      __p3Observe({ kind: 'motors', motorImpulsesNms: motorImpulses });\n      for (let bodyIndex = 0; bodyIndex < next.length; bodyIndex++) {", 'motor');
    change("      const hit = ccd.kind === 'static-boxes'", '      ' + phase('free') + "\n      const hit = ccd.kind === 'static-boxes'", 'free');
    change('        for (const [aIndex, bIndex] of pairs) {', '        for (const [__p3PairIndex, [aIndex, bIndex]] of pairs.entries()) {', 'contact-pair-index');
    change('          const hit = detect(a, b);', "          const hit = detect(a, b);\n          __p3Observe({ kind: 'contact', pass, pairIndex: __p3PairIndex, aId: a.id, bId: b.id, aPositionM: a.positionM, bPositionM: b.positionM, hit });", 'actual-contact-return');
    change('        applyDisjointHingePostContact(disjointHinges, next, nextJoints, motorImpulses, stepIndex, stepIndex * dt);',
      '        ' + phase('postContact') + '\n        applyDisjointHingePostContact(disjointHinges, next, nextJoints, motorImpulses, stepIndex, stepIndex * dt);\n        ' + phase('projected'), 'postContact-and-projected');
  } else if (path === 'disjoint-hinge/stage.ts') {
    change("  for (const pair of pairs) impulses[pair.jointInputIndex] = driveDynamicHingeMotor(pair.joint,\n    bodies[pair.bodyIndices[0]], bodies[pair.bodyIndices[1]], reports[pair.jointInputIndex].angleRad!);",
      "  for (const pair of pairs) {\n    __p3Observe({ kind: 'motor-begin', jointId: pair.joint.id });\n    impulses[pair.jointInputIndex] = driveDynamicHingeMotor(pair.joint,\n      bodies[pair.bodyIndices[0]], bodies[pair.bodyIndices[1]], reports[pair.jointInputIndex].angleRad!);\n    __p3Observe({ kind: 'motor-return', jointId: pair.joint.id, impulseNms: impulses[pair.jointInputIndex] });\n  }", 'actual-motor-attempt-and-return');
    change('    sourceStepIndex, sourceTimeSeconds });', "    sourceStepIndex, sourceTimeSeconds });\n  __p3Observe({ kind: 'postcontact-result', result });", 'actual-postcontact-result');
  } else if (path === 'disjoint-hinge/postcontact.ts') {
    change('    calls.projectionCalls++;', "    __p3Observe({ kind: 'pair-begin', pairIndex: index, jointId: pair.joint.id });\n    calls.projectionCalls++;", 'canonical-pair-begin');
    change('    const returned: PairBodies = [copyBody(projected.bodies[0]),',
      "    __p3Observe({ kind: 'projection-result', pairIndex: index, projected });\n    const returned: PairBodies = [copyBody(projected.bodies[0]),", 'actual-full-projection-return');
    change('    calls.reportCalls++;', "    __p3Observe({ kind: 'report-begin', pairIndex: index });\n    calls.reportCalls++;", 'actual-report-attempt');
    change('    jointReports[pair.jointInputIndex] = report.jointReport;',
      "    __p3Observe({ kind: 'report-return', pairIndex: index });\n    jointReports[pair.jointInputIndex] = report.jointReport;", 'actual-report-return');
  } else if (path === 'disjoint-hinge/measure.ts') {
    change('Math.atan2(dot([relative[0],relative[1],relative[2]],joint.axisWorld!),relative[3])',
      "__p3Atan2('measureBodies.relativeAngle',dot([relative[0],relative[1],relative[2]],joint.axisWorld!),relative[3])", 'measureBodies-actual-atan2');
    change('Math.atan2(dot([q[0],q[1],q[2]],axis),q[3])',
      "__p3Atan2('pose.relativeAngle',dot([q[0],q[1],q[2]],axis),q[3])", 'pose-actual-atan2');
    source += `\nfunction __p3Atan2(site: string, y: number, x: number): number {\n  const value = Math.atan2(y, x);\n  __p3Observe({ kind: 'atan2', site, y, x, value });\n  return value;\n}\n`;
  }
  if (sites.length) source += BRIDGE;
  return { source, changed: sites.length !== 0, path, sites,
    originalSha256: sha(sourceText), effectiveSha256: sha(source) };
}

const bits = value => { const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value); return bytes.toString('hex'); };
const bodyData = body => ({ id: body.id, kind: body.kind, shape: structuredClone(body.shape),
  positionM: [...body.positionM], velocityMps: [...body.velocityMps], orientation: [...body.orientation],
  angularVelocityRadps: [...body.angularVelocityRadps], inertiaKgM2: body.inertiaKgM2 });

/** A per-process test collector. begin/take never construct or advance a World. */
export function installP3Observer() {
  if (Object.hasOwn(globalThis, KEY)) throw new Error('P3 observer global already exists');
  let current = null, pair = null;
  const sink = event => {
    if (!current) throw new Error('P3 observer received an event outside a trial');
    if (event.kind === 'phase') {
      if (event.stepIndex !== current.stepIndex || Object.hasOwn(current.phases, event.phase)) throw new Error('P3 phase order/cursor mismatch');
      const expected = ['source', 'angular', 'motor', 'free', 'postContact', 'projected'][Object.keys(current.phases).length];
      if (event.phase !== expected) throw new Error('P3 phase order mismatch');
      current.phases[event.phase] = { bodies: event.bodies.map(bodyData), rawHex: rawBodiesHex(event.bodies) };
    } else if (event.kind === 'motors') {
      if (current.motorImpulsesNms !== null) throw new Error('duplicate P3 motor observation');
      current.motorImpulsesNms = [...event.motorImpulsesNms];
    } else if (event.kind === 'contact') {
      const { kind: _kind, ...value } = event;
      current.contactChecks.push(structuredClone(value));
    } else if (event.kind === 'pair-begin') {
      pair = { pairIndex: event.pairIndex, jointId: event.jointId };
      current.pairBegins.push({ ...pair });
    } else if (event.kind === 'atan2') {
      if (!pair) throw new Error('P3 atan2 outside a pair');
      current.atan2.push({ ...pair, ordinal: current.atan2.length, site: event.site,
        y: event.y, x: event.x, value: event.value,
        yBits: bits(event.y), xBits: bits(event.x), valueBits: bits(event.value) });
    } else if (event.kind === 'postcontact-result') {
      if (current.postContactResult !== null) throw new Error('duplicate P3 result observation');
      current.postContactResult = structuredClone(event.result);
    } else if (event.kind === 'projection-result') {
      if (current.projections[event.pairIndex] !== null) throw new Error('duplicate P3 projection observation');
      current.projections[event.pairIndex] = structuredClone(event.projected);
    } else if (['motor-begin', 'motor-return', 'report-begin', 'report-return'].includes(event.kind)) {
      current.callEvents.push(structuredClone(event));
    } else throw new Error('unknown P3 observation kind');
  };
  Object.defineProperty(globalThis, KEY, { value: sink, configurable: true });
  function snapshot() {
    if (!current) throw new Error('no P3 observation trial');
    const result = structuredClone(current);
    result.negativeZeroPaths = negativeZeroPaths(result);
    return result;
  }
  return {
    begin(stepIndex) {
      if (current || !Number.isInteger(stepIndex) || stepIndex < 1 || stepIndex > 1200) throw new Error('invalid P3 observation begin');
      pair = null;
      current = { version: 1, stepIndex, phases: {}, motorImpulsesNms: null,
        contactChecks: [], pairBegins: [], atan2: [], projections: [null, null], postContactResult: null, callEvents: [] };
    },
    peek: snapshot,
    take() { const value = snapshot(); current = null; pair = null; return value; },
    dispose() { if (globalThis[KEY] !== sink) throw new Error('P3 observer ownership lost'); delete globalThis[KEY]; current = null; pair = null; },
  };
}
