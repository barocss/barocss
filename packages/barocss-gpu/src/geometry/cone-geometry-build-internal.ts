/** Fixed closed cone from already admitted original parameters. Internal only. */
export function buildConeAttributes(
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
  const length = Math.hypot(height, radius);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const baseCos: number[] = [], baseSin: number[] = [];
  for (let j = 0; j < h; j++) {
    const rho = radius * (1 - j / h), y = height * (j / h - 0.5);
    const rowStart = positions.length;
    for (let i = 0; i < s; i++) {
      const phi = (2 * Math.PI) * (i / s);
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      positions.push(rho * cosPhi, y, rho * sinPhi);
      normals.push((height * cosPhi) / length, radius / length, (height * sinPhi) / length);
      uvs.push(i / s, j / h);
      if (j === 0) { baseCos.push(cosPhi); baseSin.push(sinPhi); }
    }
    positions.push(positions[rowStart], positions[rowStart + 1], positions[rowStart + 2]);
    normals.push(normals[rowStart], normals[rowStart + 1], normals[rowStart + 2]);
    uvs.push(1, j / h);
  }
  const apexStart = positions.length / 3;
  for (let i = 0; i < s; i++) {
    const phiMid = (2 * Math.PI) * ((i + 0.5) / s);
    positions.push(0, height * 0.5, 0);
    normals.push((height * Math.cos(phiMid)) / length, radius / length,
      (height * Math.sin(phiMid)) / length);
    uvs.push((i + 0.5) / s, 1);
  }
  const rimStart = positions.length / 3;
  for (let i = 0; i <= s; i++) {
    const side = i * 3;
    positions.push(positions[side], positions[side + 1], positions[side + 2]);
    normals.push(0, -1, 0);
    if (i < s) {
      // Disk UV uses angular values, not the side normal's scaled radial components.
      uvs.push((baseCos[i] + 1) / 2, (baseSin[i] + 1) / 2);
    } else {
      uvs.push(uvs[rimStart * 2], uvs[rimStart * 2 + 1]);
    }
  }
  const centre = positions.length / 3;
  positions.push(0, positions[1], 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < s; i++) {
      const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
      indices.push(a, d, b, a, c, d);
    }
  }
  const lastRow = (h - 1) * stride;
  for (let i = 0; i < s; i++) indices.push(lastRow + i, apexStart + i, lastRow + i + 1);
  for (let i = 0; i < s; i++) indices.push(centre, rimStart + i, rimStart + i + 1);
  return { positions, normals, uvs, indices };
}
