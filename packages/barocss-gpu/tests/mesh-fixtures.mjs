// Independent host fixtures. No CAD runtime or renderer source imports.
export const meshOptions = { mmToSceneUnit: 0.25, translate: [-1.125, -1.5, -0.5], color: [1, 0.2, 0.1], background: [0.04, 0.08, 0.12] };
export function packet(surfaceId, positions, normals, indices, parameters, revision = 0) {
  const min = [0, 1, 2].map((axis) => Math.min(...positions.filter((_, i) => i % 3 === axis)));
  const max = [0, 1, 2].map((axis) => Math.max(...positions.filter((_, i) => i % 3 === axis)));
  return { version: 0, surfaceId, revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions, normals, indices, parameters, bounds: { min, max } };
}
// Literal asymmetric patch: U-major rows and a non-square UV domain.
export const asymmetric = packet('flat_patch', [1,2,2, 2,9,2, 7,3,2, 8,10,2], [0,0,1, 0,0,1, 0,0,1, 0,0,1], [0,2,1, 2,3,1], [-2,4, -2,6, 3,4, 3,6], 7);
export function quarterCylinder() {
  const positions = [], normals = [], parameters = [], indices = [];
  const countU = 17, countV = 9;
  for (let i = 0; i < countU; i++) for (let j = 0; j < countV; j++) {
    const u = i / (countU - 1), v = j / (countV - 1), angle = Math.PI * u / 2;
    // Explicit host rotation -90 degrees about X: (x,y,z) -> (x,z,-y).
    positions.push(10 * Math.cos(angle), 30 * v, -10 * Math.sin(angle));
    normals.push(Math.cos(angle), 0, -Math.sin(angle)); parameters.push(u, v);
    if (i < countU - 1 && j < countV - 1) { const a = i * countV + j, b = a + countV, c = a + 1, d = b + 1; indices.push(a,b,c, b,d,c); }
  }
  return packet('quarter-cylinder', positions, normals, indices, parameters);
}
export function depthFixtures() {
  const near = packet('near', [-10,-10,5, -10,10,5, 10,-10,5, 10,10,5], Array(4).fill([0,0,1]).flat(), [0,2,1,2,3,1], [0,0,0,1,1,0,1,1]);
  const far = packet('far', [-10,-10,-5, -10,10,-5, 10,-10,-5, 10,10,-5], Array(4).fill([0,0.8,0.6]).flat(), [0,2,1,2,3,1], [0,0,0,1,1,0,1,1]);
  const combined = packet('depth', [...near.positions, ...far.positions], [...near.normals, ...far.normals], [...near.indices, ...far.indices.map(i=>i+4)], [...near.parameters,...far.parameters]);
  return { near, far, combined };
}
