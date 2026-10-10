import { closestSegmentBox } from '../physics-capsule-sweep-reference/reference.mjs';

const dt = 1 / 120, gravity = -9.81, walkableY = Math.cos(10 * Math.PI / 180);
const vector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const difference = (a, b) => a.map((value, axis) => value - b[axis]);

function supportedSegment(segment, queries) {
  if (!vector(segment.fromM, 3) || !vector(segment.toM, 3) || !vector(segment.displacementM, 3)
    || !Array.isArray(segment.queryIndices) || segment.queryIndices.length === 0
    || !segment.queryIndices.every(index => Number.isInteger(index) && index >= 0 && index < queries.length)) return false;
  if (distance(segment.toM, segment.fromM.map((value, axis) => value + segment.displacementM[axis])) > 1e-10) return false;
  return segment.queryIndices.some(index => {
    const query = queries[index];
    if (!query || query.error || !vector(query.input?.centerM, 3) || !vector(query.input?.displacementM, 3)
      || distance(segment.fromM, query.input.centerM) > 1e-9) return false;
    const whole = query.input.displacementM, norm2 = whole.reduce((sum, value) => sum + value * value, 0);
    if (norm2 === 0) return Math.hypot(...segment.displacementM) <= 1e-12;
    const fraction = segment.displacementM.reduce((sum, value, axis) => sum + value * whole[axis], 0) / norm2;
    const residual = distance(segment.displacementM, whole.map(value => value * fraction));
    return fraction >= -1e-9 && fraction <= (query.hit ? query.hit.toiFraction : 1) + 1e-9 && residual <= 1e-9;
  });
}

/** Independent pose, transition and query-evidence checks; no candidate policy imports. */
export function evaluate(fixture, states) {
  const checks = {}, metrics = { maxOverlapLowerBoundM: 0, maxUnitQuaternionError: 0, maxTiltDegrees: 0,
    maxVelocityMps: 0, maxHorizontalMovementM: 0, maxDirectedAdvanceM: 0, maxVerticalMovementM: 0,
    maxPositiveXProgressM: 0, maxXZDriftM: 0, maxGravityPredictionError: 0, maxQueryCount: 0,
    maxX: -Infinity, acceptedAssistFrames: 0, maxPositiveRiseM: 0, strictClearancePassed: true };
  let firstFailure = null, firstGroundY = null, restGroundSeen = false;
  function check(name, valid, step, detail) {
    checks[name] = (checks[name] ?? true) && !!valid;
    if (!valid && (!firstFailure || step < firstFailure.stepIndex)) firstFailure = { stepIndex: step, check: name, detail };
  }
  const lastStep = states.length ? states.at(-1).stepIndex : -1;
  check('complete241States', states.length === 241, Math.max(0, lastStep + 1), { count: states.length });
  check('acceptedFixture', fixture.expectedError === null, 0, fixture.expectedError);
  const ids = new Set(fixture.scene.boxes.map(box => box.id)), requestNorm = Math.hypot(fixture.requestMps[0], fixture.requestMps[2]);
  for (let i = 0; i < states.length; i++) {
    const state = states[i], p = state.positionM, v = state.velocityMps, q = state.orientationXYZW;
    check('nativeCursor', state.stepIndex === i && Math.abs(state.timeSeconds - i * dt) <= 1e-12, i, state.timeSeconds);
    check('sceneRevision', state.sceneRevision === fixture.scene.revision, i, state.sceneRevision);
    const finite = vector(p, 3) && vector(v, 3) && vector(q, 4) && Number.isFinite(state.fallVelocityYMps);
    check('finite', finite, i, null); if (!finite) continue;
    metrics.maxX = Math.max(metrics.maxX, p[0]);
    metrics.maxPositiveXProgressM = Math.max(metrics.maxPositiveXProgressM, p[0] - fixture.positionM[0]);
    metrics.maxXZDriftM = Math.max(metrics.maxXZDriftM, Math.hypot(p[0] - fixture.positionM[0], p[2] - fixture.positionM[2]));
    const speed = Math.hypot(...v), unitError = Math.abs(Math.hypot(...q) - 1);
    const norm2 = q.reduce((sum, value) => sum + value * value, 0);
    const tilt = Math.acos(Math.min(1, Math.abs(1 - 2 * (q[0] ** 2 + q[2] ** 2) / norm2))) * 180 / Math.PI;
    metrics.maxVelocityMps = Math.max(metrics.maxVelocityMps, speed);
    metrics.maxUnitQuaternionError = Math.max(metrics.maxUnitQuaternionError, unitError);
    metrics.maxTiltDegrees = Math.max(metrics.maxTiltDegrees, tilt);
    check('positionBounds', p.every(value => Math.abs(value) <= 5), i, p);
    check('velocityBound', speed <= 20, i, speed);
    check('upright', unitError <= 1e-10 && tilt <= 5, i, { unitError, tilt });
    check('identityOrientation', q.every((value, axis) => Math.abs(value - [0, 0, 0, 1][axis]) <= 1e-12), i, q);
    for (const box of fixture.scene.boxes) {
      const overlap = Math.max(0, 0.15 - closestSegmentBox(p, box).distanceM);
      metrics.maxOverlapLowerBoundM = Math.max(metrics.maxOverlapLowerBoundM, overlap);
      if (overlap > 1e-6) metrics.strictClearancePassed = false;
      check('overlapLowerBound', overlap <= 0.005, i, { bodyId: box.id, overlap });
    }
    if (state.grounded) {
      const support = state.support;
      check('walkableSupport', !!support && ids.has(support.bodyId) && vector(support.normal, 3)
        && Math.abs(Math.hypot(...support.normal) - 1) <= 1e-10 && support.normal[1] >= walkableY, i, support);
      if (firstGroundY === null) firstGroundY = p[1];
      if (fixture.name === 'REST') restGroundSeen = true;
    }
    if (firstGroundY !== null) metrics.maxPositiveRiseM = Math.max(metrics.maxPositiveRiseM, p[1] - firstGroundY);
    if (state.assist) metrics.acceptedAssistFrames++;
    check('queryBudget', Number.isInteger(state.queryCount) && state.queryCount >= 0 && state.queryCount <= 32
      && Array.isArray(state.lastQueries) && state.lastQueries.length === state.queryCount, i, state.queryCount);
    metrics.maxQueryCount = Math.max(metrics.maxQueryCount, state.queryCount);
    if (i === 0) {
      check('initialPose', distance(p, fixture.positionM) <= 1e-12 && v.every(value => value === 0)
        && state.fallVelocityYMps === 0 && state.grounded === false && state.assist === null
        && state.queryCount === 0 && Array.isArray(state.lastSegments) && state.lastSegments.length === 0
        && state.gravityPrediction === null, i, p);
      continue;
    }
    const previous = states[i - 1];
    if (!vector(previous.positionM, 3)) continue;
    const delta = difference(p, previous.positionM), horizontal = Math.hypot(delta[0], delta[2]);
    const directed = requestNorm > 0 ? (delta[0] * fixture.requestMps[0] + delta[2] * fixture.requestMps[2]) / requestNorm : horizontal;
    metrics.maxHorizontalMovementM = Math.max(metrics.maxHorizontalMovementM, horizontal);
    metrics.maxDirectedAdvanceM = Math.max(metrics.maxDirectedAdvanceM, directed);
    metrics.maxVerticalMovementM = Math.max(metrics.maxVerticalMovementM, Math.abs(delta[1]));
    check('horizontalRequestBound', horizontal <= requestNorm * dt + 1e-9 && directed <= requestNorm * dt + 1e-9, i, { horizontal, directed });
    check('verticalStepBound', Math.abs(delta[1]) <= 0.1 + 1e-6, i, delta[1]);
    check('derivedVelocity', distance(v, delta.map(value => value / dt)) <= 1e-9, i, v);
    const predicted = previous.grounded || previous.assist ? 0 : previous.fallVelocityYMps + gravity * dt;
    const log = state.gravityPrediction;
    const predictionError = log && Number.isFinite(log.predictedFallVelocityYMps) && Number.isFinite(log.predictedDeltaYM)
      ? Math.max(Math.abs(log.predictedFallVelocityYMps - predicted), Math.abs(log.predictedDeltaYM - predicted * dt)) : Infinity;
    metrics.maxGravityPredictionError = Math.max(metrics.maxGravityPredictionError, predictionError);
    check('gravityPredictor', !!log && log.previousFallVelocityYMps === previous.fallVelocityYMps
      && log.previousGrounded === previous.grounded && log.previousAssisted === !!previous.assist && predictionError <= 1e-12, i, log);
    const queries = Array.isArray(state.lastQueries) ? state.lastQueries : [], segments = state.lastSegments;
    check('segmentArray', Array.isArray(segments), i, null);
    if (Array.isArray(segments)) {
      let current = previous.positionM;
      for (const segment of segments) {
        const valid = vector(segment.fromM, 3) && vector(segment.toM, 3)
          && distance(segment.fromM, current) <= 1e-9 && supportedSegment(segment, queries);
        check('committedQueryEvidence', valid, i, segment);
        if (vector(segment.toM, 3)) current = segment.toM;
      }
      check('completeSegmentTrajectory', distance(current, p) <= 1e-9, i, { current, positionM: p });
    }
    if (fixture.name === 'REST' && restGroundSeen) check('restGroundHeight', Math.abs(p[1] - 0.502) <= 1e-6, i, p[1]);
    if (fixture.name === 'SLOPE15') check('slopePolicy', p[0] - fixture.positionM[0] <= 0.02, i, p[0]);
    if (fixture.name === 'HEADROOM' || fixture.name === 'TOO_HIGH15') check('blockedStepFront', p[0] <= 0.25 + 1e-6, i, p[0]);
    if (fixture.name === 'TOO_HIGH15') {
      check('tooHighNoAssist', state.assist === null, i, state.assist);
      if (firstGroundY !== null) check('tooHighRise', p[1] - firstGroundY <= 0.02, i, p[1] - firstGroundY);
    }
    if (fixture.name === 'WALL_SLIDE') check('wallBoundAllFrames', p[0] <= 0.298 + 1e-6, i, p[0]);
  }
  const final = states.at(-1);
  if (final && vector(final.positionM, 3)) {
    metrics.finalPositionM = final.positionM.slice();
    metrics.finalXProgressM = final.positionM[0] - fixture.positionM[0];
    metrics.finalZProgressM = final.positionM[2] - fixture.positionM[2];
    if (fixture.name === 'REST') {
      check('restXZDrift', metrics.maxXZDriftM <= 1e-12, final.stepIndex, metrics.maxXZDriftM);
      check('restGroundObserved', restGroundSeen, final.stepIndex, restGroundSeen);
    }
    if (fixture.name === 'FLAT' || fixture.name === 'STEP10') check('finalProgress', metrics.finalXProgressM >= 1.9 && metrics.finalXProgressM <= 2.1, final.stepIndex, metrics.finalXProgressM);
    if (fixture.name === 'STEP10') check('stepAssistAndCrossing', metrics.acceptedAssistFrames > 0 && metrics.maxPositiveRiseM > 1e-9 && final.positionM[0] > 0.75, final.stepIndex, metrics);
    if (fixture.name === 'WALL_SLIDE') check('wallSlideFinal', final.positionM[0] >= 0.278 && Math.abs(metrics.finalZProgressM - 1) <= 0.005, final.stepIndex, final.positionM);
  }
  return { passed: Object.values(checks).every(Boolean), checks, metrics, firstFailure };
}
