export function projectDistance(sheet, constraint, fixture, model) {
  const { positions: p, inverseMasses: w } = sheet;
  const { a, b, rest, kind } = constraint;
  const ia = 3 * a, ib = 3 * b;
  const x = p[ia] - p[ib], y = p[ia + 1] - p[ib + 1], z = p[ia + 2] - p[ib + 2];
  const length = Math.hypot(x, y, z);
  const weight = w[a] + w[b];
  if (length === 0 || weight === 0) return;
  const bend = kind === 'bend-distance';
  let delta;
  if (model === 'xpbd') {
    const compliance = bend ? fixture.bendComplianceMPerN : fixture.stretchComplianceMPerN;
    const alpha = compliance / fixture.dt ** 2;
    delta = (-(length - rest) - alpha * constraint.lambda) / (weight + alpha);
    constraint.lambda += delta;
  } else {
    const stiffness = bend ? fixture.bendStiffness : fixture.stretchStiffness;
    delta = -(length - rest) * stiffness / weight;
  }
  const scaleA = w[a] * delta / length, scaleB = w[b] * delta / length;
  p[ia] += scaleA * x; p[ia + 1] += scaleA * y; p[ia + 2] += scaleA * z;
  p[ib] -= scaleB * x; p[ib + 1] -= scaleB * y; p[ib + 2] -= scaleB * z;
}

export function projectSphere(sheet, fixture) {
  const { positions: p, inverseMasses: w } = sheet;
  const [cx, cy, cz] = fixture.sphereCentreM;
  const radius = fixture.sphereRadiusM + fixture.collisionOffsetM;
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 0) continue;
    const j = 3 * i, x = p[j] - cx, y = p[j + 1] - cy, z = p[j + 2] - cz;
    const distance = Math.hypot(x, y, z);
    if (distance >= radius) continue;
    if (distance === 0) { p[j] = cx; p[j + 1] = cy + radius; p[j + 2] = cz; }
    else {
      p[j] = cx + radius * x / distance;
      p[j + 1] = cy + radius * y / distance;
      p[j + 2] = cz + radius * z / distance;
    }
  }
}
