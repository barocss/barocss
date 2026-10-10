/** Capture actual owned Three resources and dispose events; no global class patches. */
export function observeXYAngleArcResult(result) {
  const object = result.line, geometry = object.geometry, material = object.material;
  const row = { result, object, geometry, material, positionAttribute: geometry.getAttribute('position'), positionArray: geometry.getAttribute('position').array,
    positions: Array.from(geometry.getAttribute('position').array), nativeParameters: [...result.parameters], nativeIntervals: result.intervals.map(interval => [...interval]),
    geometryDisposals: 0, materialDisposals: 0 };
  geometry.addEventListener('dispose', () => { row.geometryDisposals++; });
  material.addEventListener('dispose', () => { row.materialDisposals++; });
  return [row];
}
