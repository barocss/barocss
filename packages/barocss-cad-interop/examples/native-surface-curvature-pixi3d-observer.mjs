/** Only actual owned instances are wrapped. Every call invokes the original method. */
function observeDestroy(object, row, key) {
  const original = object.destroy;
  object.destroy = function (...args) { row[key]++; return original.apply(this, args); };
}

export function observeRoot(kind, root) {
  const row = { kind, root, rootDestroyCalls: 0 };
  observeDestroy(root, row, 'rootDestroyCalls');
  return row;
}

export function observeMesh(kind, mesh) {
  const geometry = mesh.geometry, material = mesh.material;
  if (!geometry?.positions || !geometry.indices || !material) throw new Error('Actual owned Pixi3D resources are required');
  const row = { kind, mesh, geometry, material,
    observedPositions: Array.from(geometry.positions.buffer), observedIndices: Array.from(geometry.indices.buffer),
    observedNormals: geometry.normals ? Array.from(geometry.normals.buffer) : [],
    meshDestroyCalls: 0, geometryDestroyCalls: 0, materialDestroyCalls: 0 };
  observeDestroy(mesh, row, 'meshDestroyCalls');
  observeDestroy(geometry, row, 'geometryDestroyCalls');
  observeDestroy(material, row, 'materialDestroyCalls');
  return row;
}
