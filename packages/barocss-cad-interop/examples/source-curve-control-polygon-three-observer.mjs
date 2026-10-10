/** Actual owned Three instances and independent CPU data; no SDK/prototype hooks. */
export function observeSourceCurveEditResult(result) {
  const { group, line } = result, geometry = line.geometry, material = line.material;
  const positionAttribute = geometry.getAttribute('position'), positionArray = positionAttribute.array;
  const row = { result, object: line, group, line, geometry, material, positionAttribute, positionArray,
    positions: Array.from(positionArray), geometryDisposals: 0, materialDisposals: 0 };
  geometry.addEventListener('dispose', () => { row.geometryDisposals++; });
  material.addEventListener('dispose', () => { row.materialDisposals++; });
  return row;
}
