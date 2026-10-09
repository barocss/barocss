export function clothMetrics(sheet, fixture) {
  const p = sheet.positions;
  let maxExtension = 0, maxCompression = 0, maxPenetrationM = 0, maxPinDriftM = 0;
  const extensions = [];
  for (const edge of sheet.constraints) {
    if (edge.kind !== 'stretch') continue;
    const length = Math.hypot(...[0, 1, 2].map(axis => p[3 * edge.a + axis] - p[3 * edge.b + axis]));
    const strain = length / edge.rest - 1;
    maxExtension = Math.max(maxExtension, strain);
    maxCompression = Math.max(maxCompression, -strain);
    extensions.push(Math.max(0, strain));
  }
  for (let i = 0; i < p.length / 3; i++) {
    const distance = Math.hypot(...[0, 1, 2].map(axis => p[3 * i + axis] - fixture.sphereCentreM[axis]));
    maxPenetrationM = Math.max(maxPenetrationM, fixture.sphereRadiusM + fixture.collisionOffsetM - distance);
  }
  for (const pin of sheet.pins) maxPinDriftM = Math.max(maxPinDriftM,
    Math.hypot(...[0, 1, 2].map(axis => p[3 * pin + axis] - sheet.restPositions[3 * pin + axis])));
  extensions.sort((a, b) => a - b);
  const ys = Array.from(p).filter((_, index) => index % 3 === 1);
  return { maxExtension, p95Extension: extensions[Math.ceil(extensions.length * 0.95) - 1],
    maxCompression, maxPenetrationM, maxPinDriftM,
    minY: Math.min(...ys), maxY: Math.max(...ys), centreY: p[3 * ((fixture.size ** 2 - 1) / 2) + 1] };
}

export function percentile95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}
