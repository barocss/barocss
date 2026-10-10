/** Fixed closed cylinder from already admitted original parameters. Internal only. */
export function buildCylinderAttributes(
  radius: number,
  height: number,
  radialSegments: number,
  heightSegments: number,
): {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
} {
  const s = radialSegments, h = heightSegments, stride = s + 1;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let j = 0; j <= h; j++) {
    const rowStart = positions.length;
    const y = height * (j / h - 0.5);
    for (let i = 0; i < s; i++) {
      const phi = (2 * Math.PI) * (i / s);
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      positions.push(radius * cosPhi, y, radius * sinPhi);
      normals.push(cosPhi, 0, sinPhi);
      uvs.push(i / s, j / h);
    }
    // Preserve the original radial seam bits while keeping U=1 distinct.
    positions.push(positions[rowStart], positions[rowStart + 1], positions[rowStart + 2]);
    normals.push(normals[rowStart], normals[rowStart + 1], normals[rowStart + 2]);
    uvs.push(1, j / h);
  }
  function appendCap(sideRow: number, normalY: number): { rim: number; centre: number } {
    const rim = positions.length / 3;
    for (let i = 0; i <= s; i++) {
      const side = (sideRow + i) * 3;
      // Separate flat vertices copy the actual side endpoint geometry, including its seam.
      positions.push(positions[side], positions[side + 1], positions[side + 2]);
      uvs.push((normals[side] + 1) / 2, (normals[side + 2] + 1) / 2);
      normals.push(0, normalY, 0);
    }
    const centre = positions.length / 3;
    positions.push(0, positions[sideRow * 3 + 1], 0);
    normals.push(0, normalY, 0);
    uvs.push(0.5, 0.5);
    return { rim, centre };
  }
  // Vertex order is all sides, top rim/centre, then bottom rim/centre.
  const top = appendCap(h * stride, 1), bottom = appendCap(0, -1);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < s; i++) {
      const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
      indices.push(a, d, b, a, c, d);
    }
  }
  for (let i = 0; i < s; i++) indices.push(top.centre, top.rim + i + 1, top.rim + i);
  for (let i = 0; i < s; i++) indices.push(bottom.centre, bottom.rim + i, bottom.rim + i + 1);
  return { positions, normals, uvs, indices };
}
