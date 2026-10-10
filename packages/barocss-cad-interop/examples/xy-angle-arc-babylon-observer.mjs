/** Actual Babylon instances and original owned resource events, without global patches. */
export function observeXYAngleArcBabylonResult(result) {
  const line = result.line, geometry = line.geometry, material = line.material;
  const row = { result, line, object: line, geometry, material, positionAttribute: geometry.getVertexBuffer('position'),
    positionArray: line.getVerticesData('position'), indexArray: line.getIndices(),
    positions: Array.from(line.getVerticesData('position')), indices: Array.from(line.getIndices()),
    nativeParameters: [...result.parameters], nativeIntervals: result.intervals.map(interval => [...interval]),
    meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
  line.onDisposeObservable.add(() => { row.meshDisposals++; });
  material.onDisposeObservable.add(() => { row.materialDisposals++; });
  const originalDispose = geometry.dispose;
  geometry.dispose = function (...args) { row.geometryDisposals++; return originalDispose.apply(this, args); };
  return [row];
}
