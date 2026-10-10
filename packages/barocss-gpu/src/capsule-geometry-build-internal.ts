/** Fixed closed capsule from admitted original parameters. Internal only. */
export function buildCapsuleAttributes(
  radius: number,
  halfLength: number,
  radialSegments: number,
  bodySegments: number,
  capSegments: number,
): {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
} {
  const s = radialSegments, b = bodySegments, c = capSegments, stride = s + 1;
  const ringCount = b + 2 * c - 1, denominator = b + 2 * c;
  const extent = halfLength + radius, bottomY = -extent, topY = extent;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  let previousY = bottomY;
  function appendRing(rho: number, y: number, radialNormal: number, normalY: number, v: number): void {
    if (!(y > previousY && y < topY)) {
      throw new RangeError('Capsule original axial levels must remain strictly increasing');
    }
    previousY = y;
    const rowStart = positions.length;
    for (let i = 0; i < s; i++) {
      const phi = (2 * Math.PI) * (i / s);
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      positions.push(rho * cosPhi, y, rho * sinPhi);
      normals.push(radialNormal * cosPhi, normalY, radialNormal * sinPhi);
      uvs.push(i / s, v);
    }
    positions.push(positions[rowStart], positions[rowStart + 1], positions[rowStart + 2]);
    normals.push(normals[rowStart], normals[rowStart + 1], normals[rowStart + 2]);
    uvs.push(1, v);
  }
  for (let j = 1; j < c; j++) {
    const theta = (Math.PI / 2) * (j / c);
    const a = Math.sin(theta), normal = Math.cos(theta);
    appendRing(radius * a, -halfLength - radius * normal, a, -normal, j / denominator);
  }
  // The two equators are exact body endpoints, not hemispherical trig samples.
  for (let k = 0; k <= b; k++) {
    const y = k === 0 ? -halfLength : k === b ? halfLength : halfLength * (2 * (k / b) - 1);
    appendRing(radius, y, 1, 0, (c + k) / denominator);
  }
  for (let j = 1; j < c; j++) {
    const theta = (Math.PI / 2) * (j / c);
    const a = Math.cos(theta), normal = Math.sin(theta);
    appendRing(radius * a, halfLength + radius * normal, a, normal, (c + b + j) / denominator);
  }
  const bottomPoleStart = positions.length / 3;
  for (let i = 0; i < s; i++) {
    positions.push(0, bottomY, 0);
    normals.push(0, -1, 0);
    uvs.push((i + 0.5) / s, 0);
  }
  const topPoleStart = positions.length / 3;
  for (let i = 0; i < s; i++) {
    positions.push(0, topY, 0);
    normals.push(0, 1, 0);
    uvs.push((i + 0.5) / s, 1);
  }
  for (let j = 0; j < ringCount - 1; j++) {
    for (let i = 0; i < s; i++) {
      const a = j * stride + i, next = a + 1, above = a + stride, diagonal = above + 1;
      indices.push(a, diagonal, next, a, above, diagonal);
    }
  }
  for (let i = 0; i < s; i++) indices.push(bottomPoleStart + i, i, i + 1);
  const lastRingStart = (ringCount - 1) * stride;
  for (let i = 0; i < s; i++) indices.push(lastRingStart + i, topPoleStart + i, lastRingStart + i + 1);
  return { positions, normals, uvs, indices };
}
