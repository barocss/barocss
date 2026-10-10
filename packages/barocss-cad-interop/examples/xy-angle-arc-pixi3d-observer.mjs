/** Actual captured Pixi resources and CPU attributes; wrappers invoke their real instance methods. */
export function observeXYAngleArcPixi3DResult(result) {
  const { root, mesh } = result, geometry = mesh.geometry, material = mesh.material;
  const row = { result, root, mesh, geometry, material,
    positionAttribute: geometry.positions, normalAttribute: geometry.normals, indexAttribute: geometry.indices,
    positionArray: geometry.positions.buffer, normalArray: geometry.normals.buffer, indexArray: geometry.indices.buffer,
    positions: Array.from(geometry.positions.buffer), normals: Array.from(geometry.normals.buffer), indices: Array.from(geometry.indices.buffer),
    nativeParameters: [...result.parameters], nativeIntervals: result.intervals.map(interval => [...interval]),
    rootDisposals: 0, meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
  for (const [kind, object] of Object.entries({ root, mesh, geometry, material })) {
    const originalDestroy = object.destroy;
    object.destroy = function (...args) { row[kind + 'Disposals']++; return originalDestroy.apply(this, args); };
  }
  return [row];
}
