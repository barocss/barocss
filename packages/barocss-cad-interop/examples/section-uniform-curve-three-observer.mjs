export function observeSectionUniformResult(result) {
  const object = result.line, geometry = object.geometry, material = object.material;
  const row = { object, result, geometry, material, positions: Array.from(geometry.attributes.position.array), geometryDisposals: 0, materialDisposals: 0 };
  geometry.addEventListener('dispose', () => row.geometryDisposals++);
  material.addEventListener('dispose', () => row.materialDisposals++);
  return [row];
}
