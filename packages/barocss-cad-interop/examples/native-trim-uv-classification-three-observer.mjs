/** Observe real public Three Surface resources; retained arrays are independent CPU data. */
export function observeTrimResult(result) {
  if (!result?.group || !Array.isArray(result.group.children)) throw new TypeError('A real native Three result is required');
  return result.group.children.map(object => {
    if (!object.isMesh || !object.geometry || !object.material || Array.isArray(object.material)) throw new TypeError('Actual Surface-only Three Mesh resources are required');
    const geometry = object.geometry, material = object.material;
    const row = { object, geometry, material,
      positions: Array.from(geometry.getAttribute('position').array), normals: Array.from(geometry.getAttribute('normal').array),
      parameters: Array.from(geometry.getAttribute('_CAD_UV').array), indices: Array.from(geometry.getIndex().array),
      geometryDisposals: 0, materialDisposals: 0 };
    geometry.addEventListener('dispose', () => row.geometryDisposals++);
    material.addEventListener('dispose', () => row.materialDisposals++);
    return row;
  });
}
