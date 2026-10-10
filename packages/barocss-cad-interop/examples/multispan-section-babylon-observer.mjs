/** Actual Babylon mesh/geometry observations with one event listener per unique shared material. */
export function observeMultiSpanSectionBabylonResult(result, role, materialMap, allMaterials) {
  const meshes = result.meshes ?? [result.line];
  return meshes.map(mesh => {
    const geometry = mesh.geometry, material = mesh.material;
    let materialRecord = materialMap.get(material);
    if (!materialRecord) { materialRecord = { material, disposals: 0, get materialDisposals() { return this.disposals; } }; materialMap.set(material, materialRecord); allMaterials.push(materialRecord); material.onDisposeObservable.add(() => materialRecord.disposals++); }
    const attributes = geometry.getVerticesDataKinds().map(name => ({ name, vertexBuffer: geometry.getVertexBuffer(name), array: mesh.getVerticesData(name), values: Array.from(mesh.getVerticesData(name)) }));
    const row = { result, role, mesh, object: mesh, geometry, material, materialRecord, attributes,
      indexArray: mesh.getIndices(), indices: Array.from(mesh.getIndices()), nativeUVArray: mesh.metadata?.barocss?.nativeParameters ?? null,
      nativeUV: mesh.metadata?.barocss?.nativeParameters ? Array.from(mesh.metadata.barocss.nativeParameters) : null,
      meshDisposals: 0, geometryDisposals: 0, get materialDisposals() { return materialRecord.materialDisposals; } };
    mesh.onDisposeObservable.add(() => row.meshDisposals++);
    const originalDispose = geometry.dispose; geometry.dispose = function (...args) { row.geometryDisposals++; return originalDispose.apply(this, args); };
    return row;
  });
}
