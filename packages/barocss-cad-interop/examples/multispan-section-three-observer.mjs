/** Actual adapter children, CPU attribute references and genuine geometry/material dispose events. */
export function observeMultiSpanSectionThreeResult(result, role) {
  return result.group.children.map(object => {
    const geometry = object.geometry, material = object.material;
    const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute, array: attribute.array,
      itemSize: attribute.itemSize, normalized: attribute.normalized, values: Array.from(attribute.array) }));
    const row = { result, role, object, geometry, material, attributes, indexAttribute: geometry.index, indexArray: geometry.index?.array ?? null,
      indices: geometry.index ? Array.from(geometry.index.array) : null, geometryDisposals: 0, materialDisposals: 0 };
    geometry.addEventListener('dispose', () => { row.geometryDisposals++; }); material.addEventListener('dispose', () => { row.materialDisposals++; });
    return row;
  });
}
