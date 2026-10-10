/** Actual Babylon instances, disposal events and independent retained CPU buffers. */
export function observeSourceCurveEditBabylonResult(result) {
  const line = result.line, geometry = line.geometry, material = line.material, vertexBuffer = geometry.getVertexBuffer('position');
  const positionArray = line.getVerticesData('position'), indexArray = line.getIndices();
  const row = { result, object: line, line, mesh: line, geometry, material, vertexBuffer, positionArray, indexArray,
    positions: Array.from(positionArray), indices: Array.from(indexArray), meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
  line.onDisposeObservable.add(() => { row.meshDisposals++; });
  material.onDisposeObservable.add(() => { row.materialDisposals++; });
  const original = geometry.dispose;
  geometry.dispose = function (...args) { row.geometryDisposals++; return original.apply(this, args); };
  return row;
}
