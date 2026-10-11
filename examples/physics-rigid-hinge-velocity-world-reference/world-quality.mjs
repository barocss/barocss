const magnitude = value => Math.hypot(...value);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Independent whole-trace measurements; the fixture admits four unit-mass spheres only. */
export function worldQuality(state, diagnostics, reply) {
  const failures = [], momentum = [0, 0, 0], angular = [0, 0, 0];
  let maximumComDriftM = 0, maximumAnchorGapM = 0, maximumAxisErrorRad = 0, maximumPlaneDriftM = 0;
  for (const body of state.bodies) {
    const orbital = cross(body.positionM, body.velocityMps);
    for (let axis = 0; axis < 3; axis++) {
      momentum[axis] += body.velocityMps[axis];
      angular[axis] += orbital[axis] + .4 * .1 ** 2 * body.angularVelocityRadps[axis];
    }
  }
  for (let index = 0; index < 2; index++) {
    const [a, b] = state.bodies.slice(index * 2, index * 2 + 2);
    const center = a.positionM.map((value, axis) => (value + b.positionM[axis]) * .5);
    maximumComDriftM = Math.max(maximumComDriftM, magnitude([center[0], center[1], center[2] - index]));
    maximumPlaneDriftM = Math.max(maximumPlaneDriftM, Math.abs(a.positionM[2] - index), Math.abs(b.positionM[2] - index));
    const pair = diagnostics.pairs[index];
    maximumAnchorGapM = Math.max(maximumAnchorGapM, pair.metrics.projected.anchorGapM);
    maximumAxisErrorRad = Math.max(maximumAxisErrorRad, pair.metrics.projected.axisDeviationRad);
    if (!Object.is(state.joints[index].angleRad, pair.projection.poseReport.targetAngleRad)) failures.push('outgoing angle authority');
  }
  if (maximumComDriftM > 1e-5) failures.push('long-run COM drift');
  if (maximumPlaneDriftM > 1e-12) failures.push('Z-plane drift');
  if (maximumAnchorGapM > .002) failures.push('World anchor gap');
  if (maximumAxisErrorRad > Math.PI / 180) failures.push('World axis error');
  if (magnitude(momentum) > 1e-7) failures.push('long-run linear momentum');
  if (magnitude(angular) > 1e-7) failures.push('long-run angular momentum');
  for (const mode of ['raw', 'normalized']) {
    const totalP = [0, 0, 0], totalL = [0, 0, 0];
    for (const parent of reply.reference.pairReplies) {
      const after = parent.reference.after[mode];
      for (let axis = 0; axis < 3; axis++) {
        totalP[axis] += after.linearMomentumVectorKgMps[axis];
        totalL[axis] += after.angularMomentumVectorKgM2ps[axis];
      }
    }
    if (![...totalP, ...totalL].every(Number.isFinite) || magnitude(totalP) > 1e-7 || magnitude(totalL) > 1e-7)
      failures.push(mode + ' parent long-run initial momentum budget');
  }
  if (state.contacts.length !== 0 || state.events.length !== 0 || state.ccdHits.length !== 0) failures.push('no-contact events');
  if (state.pairStats.eligiblePairs !== 32 || state.pairStats.candidatePairs !== 32 || state.pairStats.aabbTests !== 0)
    failures.push('original pair stats');
  if (![maximumComDriftM, maximumPlaneDriftM, maximumAnchorGapM, maximumAxisErrorRad,
    ...momentum, ...angular].every(value => typeof value === 'number' && Number.isFinite(value))) failures.push('nonfinite whole-trace measurement');
  return {maximumComDriftM, maximumPlaneDriftM, maximumAnchorGapM, maximumAxisErrorRad,
    linearMomentumKgMps: momentum, angularMomentumKgM2ps: angular, failures};
}
