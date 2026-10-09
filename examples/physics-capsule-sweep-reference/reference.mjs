const radiusM = 0.15, halfLengthM = 0.35;
const initialToleranceM = 1e-12, presenceToleranceM = 1e-13, rootToleranceM = 1e-14;

function tuple(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) {
    throw new RangeError(`${label} requires ${length} finite components`);
  }
  return value.slice();
}

// XYZW Hamilton products are independent of the candidate's rotation matrix.
function multiply(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
function rotate(vector, left, right) { return multiply(multiply(left, [...vector, 0]), right).slice(0, 3); }
function preparedBox(box) {
  if (!box || typeof box !== 'object') throw new RangeError('Reference OBB required');
  const center = tuple(box.centerM, 3, 'OBB centre'), half = tuple(box.halfExtentsM, 3, 'OBB half extents');
  const q = tuple(box.orientationXYZW, 4, 'OBB quaternion');
  if (half.some(value => value <= 0) || Math.abs(Math.hypot(...q) - 1) > 1e-12) {
    throw new RangeError('Positive OBB extents and unit quaternion required');
  }
  const norm2 = q.reduce((sum, value) => sum + value * value, 0);
  const inverse = [-q[0] / norm2, -q[1] / norm2, -q[2] / norm2, q[3] / norm2];
  return { half,
    local: point => rotate(point.map((value, axis) => value - center[axis]), inverse, q),
    world: point => rotate(point, q, inverse).map((value, axis) => value + center[axis]) };
}
const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));

export function referencePointBox(pointM, box) {
  const frame = preparedBox(box), local = frame.local(tuple(pointM, 3, 'Reference point'));
  let squaredDistance = 0, nearestFace = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const delta = local[axis] - clamp(local[axis], -frame.half[axis], frame.half[axis]);
    squaredDistance += delta * delta;
    nearestFace = Math.min(nearestFace, Math.abs(Math.abs(local[axis]) - frame.half[axis]));
  }
  const distanceM = Math.sqrt(squaredDistance);
  return { distanceM, boundaryResidualM: distanceM > 0 ? distanceM : nearestFace };
}

export function closestSegmentBox(centerM, box) {
  const center = tuple(centerM, 3, 'Capsule centre'), frame = preparedBox(box);
  const a = frame.local([center[0], center[1] - halfLengthM, center[2]]);
  const b = frame.local([center[0], center[1] + halfLengthM, center[2]]);
  const direction = b.map((value, axis) => value - a[axis]);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) if (direction[axis] !== 0) {
    for (const face of [-frame.half[axis], frame.half[axis]]) {
      const fraction = (face - a[axis]) / direction[axis];
      if (fraction > 0 && fraction < 1) breaks.push(fraction);
    }
  }
  breaks.sort((left, right) => left - right);
  const knots = breaks.filter((value, index) => index === 0 || value !== breaks[index - 1]);
  let bestSquared = Infinity, bestSegment, bestPoint;
  function consider(fraction) {
    const segment = a.map((value, axis) => value + fraction * direction[axis]);
    const point = segment.map((value, axis) => clamp(value, -frame.half[axis], frame.half[axis]));
    const squared = segment.reduce((sum, value, axis) => sum + (value - point[axis]) ** 2, 0);
    if (squared < bestSquared) { bestSquared = squared; bestSegment = segment; bestPoint = point; }
  }
  for (const fraction of knots) consider(fraction);
  for (let interval = 0; interval + 1 < knots.length; interval++) {
    const lower = knots[interval], upper = knots[interval + 1], midpoint = (lower + upper) / 2;
    let quadratic = 0, linearHalf = 0;
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = a[axis] + midpoint * direction[axis];
      const face = coordinate < -frame.half[axis] ? -frame.half[axis]
        : coordinate > frame.half[axis] ? frame.half[axis] : null;
      if (face !== null) {
        quadratic += direction[axis] ** 2;
        linearHalf += direction[axis] * (a[axis] - face);
      }
    }
    consider(quadratic > 0 ? clamp(-linearHalf / quadratic, lower, upper) : lower);
  }
  const segmentM = frame.world(bestSegment), pointM = frame.world(bestPoint);
  const difference = segmentM.map((value, axis) => value - pointM[axis]);
  const worldDistance = Math.hypot(...difference);
  const distanceM = Math.sqrt(bestSquared);
  if (!Number.isFinite(distanceM) || !Number.isFinite(worldDistance)) throw new Error('Reference distance is nonfinite');
  const normalM = distanceM === 0 ? null : worldDistance > 0 ? difference.map(value => value / worldDistance) : null;
  return { distanceM, segmentM: segmentM.slice(), pointM: pointM.slice(), normalM };
}

function hit(fraction, witness) {
  if (!witness.normalM) throw Object.assign(new Error('Reference contact normal is ambiguous'), { code: 'REF_UNRESOLVED' });
  return { fraction, normalM: witness.normalM.slice(), pointM: witness.pointM.slice(), segmentM: witness.segmentM.slice() };
}

/** Numerical oracle for the frozen cases; not an exact global CCD theorem. */
export function referenceSweep(centerM, displacementM, box) {
  const center = tuple(centerM, 3, 'Sweep centre'), displacement = tuple(displacementM, 3, 'Sweep displacement');
  const at = fraction => closestSegmentBox(center.map((value, axis) => value + fraction * displacement[axis]), box);
  const initial = at(0), initialGap = initial.distanceM - radiusM;
  if (initialGap < -initialToleranceM) {
    throw Object.assign(new RangeError('Reference initial overlap is not a sweep/depenetration result'), { code: 'INITIAL_OVERLAP' });
  }
  if (Math.abs(initialGap) <= initialToleranceM) return hit(0, initial);
  if (displacement.every(value => value === 0)) return null;

  const golden = (Math.sqrt(5) - 1) / 2;
  let lower = 0, upper = 1, left = upper - golden * (upper - lower), right = lower + golden * (upper - lower);
  let leftValue = at(left).distanceM, rightValue = at(right).distanceM;
  for (let iteration = 0; iteration < 120; iteration++) {
    if (leftValue <= rightValue) {
      upper = right; right = left; rightValue = leftValue;
      left = upper - golden * (upper - lower); leftValue = at(left).distanceM;
    } else {
      lower = left; left = right; leftValue = rightValue;
      right = lower + golden * (upper - lower); rightValue = at(right).distanceM;
    }
  }
  const fractions = [0, 1, lower, upper, left, right, (lower + upper) / 2].sort((a, b) => a - b);
  let minimumFraction = 0, minimumWitness = initial;
  for (const fraction of fractions) {
    const witness = at(fraction);
    if (witness.distanceM < minimumWitness.distanceM) { minimumFraction = fraction; minimumWitness = witness; }
  }
  const minimumGap = minimumWitness.distanceM - radiusM;
  if (minimumGap > presenceToleranceM) return null;
  if (minimumGap > rootToleranceM) {
    throw Object.assign(new Error('Reference minimum lies in the unresolved presence/root tolerance band'), { code: 'REF_UNRESOLVED' });
  }
  lower = 0; upper = minimumFraction;
  for (let iteration = 0; iteration < 80; iteration++) {
    const middle = (lower + upper) / 2;
    if (at(middle).distanceM - radiusM <= rootToleranceM) upper = middle;
    else lower = middle;
  }
  return hit(upper, at(upper));
}
