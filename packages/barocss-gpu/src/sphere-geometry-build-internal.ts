/** Fixed spherical lattice from already admitted original parameters. Internal only. */
export function buildSphereAttributes(
  radius: number,
  longitudeSegments: number,
  latitudeSegments: number,
): {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
} {
  const w = longitudeSegments, h = latitudeSegments, stride = w + 1;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  // Interior rings precede the separate north and south pole sectors.
  for (let j = 1; j < h; j++) {
    const theta = Math.PI * (j / h);
    const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
    const rowStart = positions.length;
    for (let i = 0; i < w; i++) {
      const phi = (2 * Math.PI) * (i / w);
      const x = sinTheta * Math.cos(phi), y = cosTheta, z = sinTheta * Math.sin(phi);
      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
      uvs.push(i / w, 1 - j / h);
    }
    // Copy the original seam values exactly; U=1 remains a distinct UV endpoint.
    positions.push(positions[rowStart], positions[rowStart + 1], positions[rowStart + 2]);
    normals.push(normals[rowStart], normals[rowStart + 1], normals[rowStart + 2]);
    uvs.push(1, 1 - j / h);
  }
  const northStart = positions.length / 3;
  for (let i = 0; i < w; i++) {
    positions.push(0, radius, 0);
    normals.push(0, 1, 0);
    uvs.push((i + 0.5) / w, 1);
  }
  const southStart = positions.length / 3;
  for (let i = 0; i < w; i++) {
    positions.push(0, -radius, 0);
    normals.push(0, -1, 0);
    uvs.push((i + 0.5) / w, 0);
  }
  for (let i = 0; i < w; i++) indices.push(northStart + i, i + 1, i);
  for (let j = 1; j < h - 1; j++) {
    const row = (j - 1) * stride;
    for (let i = 0; i < w; i++) {
      const a = row + i, b = a + 1, c = a + stride, d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  const lastRow = (h - 2) * stride;
  for (let i = 0; i < w; i++) indices.push(lastRow + i, lastRow + i + 1, southStart + i);
  return { positions, normals, uvs, indices };
}
