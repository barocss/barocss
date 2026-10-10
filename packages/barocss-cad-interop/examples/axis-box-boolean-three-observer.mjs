/** Actual public Surface resources, event counts and independent retained CPU arrays. */
export function observeAxisBoxResult(result) {
  if (!result?.group || !Array.isArray(result.group.children)) throw new TypeError('A genuine Three result is required');
  return result.group.children.map(object => {
    if (!object.isMesh || !object.geometry || !object.material || Array.isArray(object.material)) throw new TypeError('Surface-only Mesh resources are required');
    const geometry = object.geometry, material = object.material;
    const row = { object, surfaceId: object.name, geometry, material,
      positions: Array.from(geometry.getAttribute('position').array), normals: Array.from(geometry.getAttribute('normal').array),
      parameters: Array.from(geometry.getAttribute('_CAD_UV').array), indices: Array.from(geometry.getIndex().array),
      geometryDisposals: 0, materialDisposals: 0 };
    geometry.addEventListener('dispose', () => row.geometryDisposals++);
    material.addEventListener('dispose', () => row.materialDisposals++);
    return row;
  });
}
