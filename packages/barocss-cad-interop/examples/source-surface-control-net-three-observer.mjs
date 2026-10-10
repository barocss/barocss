/** Observe actual public result resources. The retained arrays are independent CPU data. */
export function observeSourceEditResult(result) {
  if (!result?.group || !Array.isArray(result.group.children)) throw new TypeError('A real native Three result is required');
  return result.group.children.map(object => {
    if (!object.isMesh || !object.geometry || !object.material || Array.isArray(object.material)) throw new TypeError('Surface-only native Three Mesh resources are required');
    const geometry = object.geometry, material = object.material;
    const surfaceId = object.userData.surfaceId;
    if (surfaceId !== object.name || !result.surfaces.some(surface => surface.surfaceId === surfaceId)) throw new Error('Original Surface identity differs from the actual target binding');
    const record = { object, surfaceId, geometry, material, geometryDisposals: 0, materialDisposals: 0,
      positions: Float32Array.from(geometry.getAttribute('position').array),
      normals: Float32Array.from(geometry.getAttribute('normal').array),
      parameters: Float32Array.from(geometry.getAttribute('_CAD_UV').array),
      indices: Uint16Array.from(geometry.getIndex().array) };
    geometry.addEventListener('dispose', () => record.geometryDisposals++);
    material.addEventListener('dispose', () => record.materialDisposals++);
    return record;
  });
}
