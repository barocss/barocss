/** Capture actual Three resources before the public result clears its Group. */
export function observeWideSourceSurfaceResult(result) {
  if (!result?.group?.isGroup || !Array.isArray(result.group.children)) {
    throw new TypeError('A real Three Surface result Group is required');
  }
  return result.group.children.map(object => {
    if (!object.isMesh || !object.geometry?.isBufferGeometry ||
        !object.material || Array.isArray(object.material)) {
      throw new TypeError('Actual Surface Mesh geometry and single material are required');
    }
    const surfaceId = object.userData.surfaceId;
    const nativeSurface = result.surfaces.find(surface => surface.surfaceId === surfaceId);
    if (!nativeSurface || surfaceId !== object.name) throw new Error('Original Surface binding is missing');
    const geometry = object.geometry, material = object.material, attributes = {};
    for (const name of ['position', 'normal', '_CAD_UV']) {
      const attribute = geometry.getAttribute(name);
      if (!attribute?.array) throw new TypeError('Actual ' + name + ' attribute is required');
      attributes[name] = { attribute, array: attribute.array, values: Array.from(attribute.array) };
    }
    const indexAttribute = geometry.getIndex();
    if (!indexAttribute?.array) throw new TypeError('Actual Surface index attribute is required');
    const row = {
      object, surfaceId, geometry, material, attributes,
      indexAttribute, indexArray: indexAttribute.array, indices: Array.from(indexAttribute.array),
      nativeSurface, nativePacket: nativeSurface.packet, nativeMesh: nativeSurface.mesh,
      geometryDisposals: 0, materialDisposals: 0,
    };
    geometry.addEventListener('dispose', () => row.geometryDisposals++);
    material.addEventListener('dispose', () => row.materialDisposals++);
    return row;
  });
}
