/** Fixed periodic lattice from already admitted original parameters. Internal only. */
export function buildTorusAttributes(
  majorRadius: number,
  minorRadius: number,
  majorSegments: number,
  minorSegments: number,
): {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
} {
  const w = majorSegments, h = minorSegments, stride = w + 1;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  // Tube rows precede the final copied row; each row ends with a copied major seam.
  for (let j = 0; j < h; j++) {
    const beta = (2 * Math.PI) * (j / h);
    const cosBeta = Math.cos(beta), sinBeta = Math.sin(beta);
    const radial = majorRadius + minorRadius * cosBeta;
    const rowStart = positions.length;
    for (let i = 0; i < w; i++) {
      const phi = (2 * Math.PI) * (i / w);
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      positions.push(radial * cosPhi, minorRadius * sinBeta, radial * sinPhi);
      normals.push(cosBeta * cosPhi, sinBeta, cosBeta * sinPhi);
      uvs.push(i / w, j / h);
    }
    positions.push(positions[rowStart], positions[rowStart + 1], positions[rowStart + 2]);
    normals.push(normals[rowStart], normals[rowStart + 1], normals[rowStart + 2]);
    uvs.push(1, j / h);
  }
  // Preserve every first-row position/normal bit, including the double seam corner.
  for (let i = 0; i <= w; i++) {
    const first = i * 3;
    positions.push(positions[first], positions[first + 1], positions[first + 2]);
    normals.push(normals[first], normals[first + 1], normals[first + 2]);
    uvs.push(i / w, 1);
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
      // Major-angle then tube-angle progression requires this outward CCW order.
      indices.push(a, d, b, a, c, d);
    }
  }
  return { positions, normals, uvs, indices };
}
