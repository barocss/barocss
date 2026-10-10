/** Observe actual owned mesh/material events and one geometry instance only. */
export function observeMesh(kind, mesh) {
  const geometry = mesh.geometry, material = mesh.material;
  if (!geometry || !material) throw new Error('Actual owned Babylon resources are required');
  const row = { kind, mesh, geometry, material, geometryResourceId: geometry.id, geometryUniqueId: geometry.uniqueId,
    observedPositions: Array.from(mesh.getVerticesData('position')), observedIndices: Array.from(mesh.getIndices()),
    observedNormals: Array.from(mesh.getVerticesData('normal') ?? []),
    nativeParameters: mesh.metadata?.barocss?.nativeParameters ? Array.from(mesh.metadata.barocss.nativeParameters) : null,
    meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
  mesh.onDisposeObservable.add(() => { row.meshDisposals++; });
  material.onDisposeObservable.add(() => { row.materialDisposals++; });
  const original = geometry.dispose;
  geometry.dispose = function (...args) { row.geometryDisposals++; return original.apply(this, args); };
  return row;
}
