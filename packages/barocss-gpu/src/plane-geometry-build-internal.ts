/** Fixed XY grid attributes from already admitted original parameters. Internal only. */
export function buildPlaneAttributes(
  sizeXY: readonly [number, number],
  segmentsXY: readonly [number, number],
): {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
} {
  const [width, height] = sizeXY;
  const [nx, ny] = segmentsXY;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  // Rows run bottom to top; columns run left to right. Preserve Number operation order.
  for (let j = 0; j <= ny; j++) {
    const v = j / ny;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      positions.push(width * (u - 0.5), height * (v - 0.5), 0);
      normals.push(0, 0, 1);
      uvs.push(u, v);
    }
  }
  const stride = nx + 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  return { positions, normals, uvs, indices };
}
