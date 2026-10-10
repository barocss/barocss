/** Fixed attributes from already admitted original scene-unit sizes. Internal only. */
export function buildBoxAttributes(sizeXYZ: readonly [number, number, number]): {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
} {
  const x = sizeXYZ[0] / 2, y = sizeXYZ[1] / 2, z = sizeXYZ[2] / 2;
  // Face order and UV seams are fixed: +X, -X, +Y, -Y, +Z, -Z.
  const positions = [
    x, -y, -z, x, y, -z, x, y, z, x, -y, z,
    -x, -y, z, -x, y, z, -x, y, -z, -x, -y, -z,
    -x, y, z, x, y, z, x, y, -z, -x, y, -z,
    -x, -y, -z, x, -y, -z, x, -y, z, -x, -y, z,
    -x, -y, z, x, -y, z, x, y, z, -x, y, z,
    x, -y, -z, -x, -y, -z, -x, y, -z, x, y, -z,
  ];
  const faceNormals = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0],
    [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let face = 0; face < 6; face++) {
    for (let corner = 0; corner < 4; corner++) normals.push(...faceNormals[face]);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    const base = face * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, uvs, indices };
}
