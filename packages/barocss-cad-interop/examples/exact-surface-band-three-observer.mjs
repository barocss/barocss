import {assertSame} from './exact-surface-band-three-fixture.mjs';

const need = (condition, message) => { if (!condition) throw new Error(message); };
function pose(object) {
  return {position: object.position.toArray(), quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(), matrix: object.matrix.toArray(), matrixWorld: object.matrixWorld.toArray()};
}

/** Capture actual original SDK resources. Caller replacements are never owned. */
export function createOwnedObserver({counts, events}) {
  const rows = [], groups = new Set();
  function observe(result, key, role) {
    const object = role === 'surface' ? result.group.children[0] : result.line;
    need(result.group?.isGroup === true && object && (role === 'surface' ? object.isMesh : object.isLine),
      'Actual Three result/object kind differs');
    need(!groups.has(result.group), 'Original result Group was already observed');
    const geometry = object.geometry, material = object.material;
    need(geometry?.isBufferGeometry && material && !Array.isArray(material), 'One owned geometry/material required');
    const row = {key, role, result, group: result.group, originalDispose: result.dispose, object, geometry, material,
      geometryDisposals: 0, materialDisposals: 0,
      cache: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) =>
        [name, {attribute, array: attribute.array, values: Array.from(attribute.array)}])),
      indexAttribute: geometry.index, indexArray: geometry.index?.array ?? null,
      indices: geometry.index ? Array.from(geometry.index.array) : null};
    geometry.addEventListener('dispose', () => {
      row.geometryDisposals++; counts.livePairs--;
      events.push({event: 'geometry-dispose', key, role, geometry: geometry.uuid});
    });
    material.addEventListener('dispose', () => {
      row.materialDisposals++;
      events.push({event: 'material-dispose', key, role, material: material.uuid});
    });
    rows.push(row); groups.add(result.group);
    counts.sdkResults++; counts.groups++; counts.geometries++; counts.materials++; counts.livePairs++;
    counts.peakPairs = Math.max(counts.peakPairs, counts.livePairs);
    events.push({event: 'captured-result', key, role, livePairs: counts.livePairs});
    return row;
  }
  function rowValue(row) {
    const attributes = Object.fromEntries(Object.entries(row.cache).map(([name, saved]) => [name, {
      arrayType: saved.array.constructor.name, itemSize: saved.attribute.itemSize,
      normalized: saved.attribute.normalized, values: Array.from(saved.array)}]));
    const index = row.indexAttribute ? {arrayType: row.indexArray.constructor.name,
      itemSize: row.indexAttribute.itemSize, normalized: row.indexAttribute.normalized,
      values: Array.from(row.indexArray)} : null;
    return {key: row.key, role: row.role, groupUUID: row.group.uuid, objectUUID: row.object.uuid,
      name: row.object.name, groupName: row.group.name, geometryUUID: row.geometry.uuid,
      materialUUID: row.material.uuid, attributes, index,
      geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
      pose: pose(row.object), material: {type: row.material.type, side: row.material.side,
        depthTest: row.material.depthTest, depthWrite: row.material.depthWrite,
        transparent: row.material.transparent, opacity: row.material.opacity,
        ...(row.material.color ? {color: row.material.color.getHex()} : {}),
        ...(row.material.isLineBasicMaterial ? {linewidth: row.material.linewidth} : {})}};
  }
  function resourcesReadable() {
    for (const row of rows) {
      need(row.object.geometry === row.geometry && row.object.material === row.material,
        'Original object geometry/material identity changed');
      for (const [name, saved] of Object.entries(row.cache)) {
        const actual = row.geometry.getAttribute(name);
        need(actual === saved.attribute && actual.array === saved.array, 'Original attribute identity changed');
        assertSame(Array.from(actual.array), saved.values, 'Retained original buffer');
      }
      need(row.geometry.index === row.indexAttribute, 'Index attribute identity changed');
      if (row.indexArray) {
        need(row.geometry.index.array === row.indexArray, 'Index array identity changed');
        assertSame(Array.from(row.indexArray), row.indices, 'Retained indices');
      }
    }
  }
  function release(bundle) {
    if (bundle.released) return;
    bundle.released = true;
    let hasFailure = false, firstFailure;
    const attempt = (stage, action) => {
      try { action(); }
      catch (value) {
        if (!hasFailure) { hasFailure = true; firstFailure = value; }
        events.push({event: 'cleanup-error', stage, thrownType: typeof value,
          thrownNull: value === null, message: value instanceof Error ? value.message : String(value)});
      }
    };
    // SDK disposal marks its own closure disposed and releases the original captured resources.
    // Continue through every result; if a disposal stops early, release still-unreleased originals.
    for (const row of bundle.rows) attempt('sdk-result-dispose', () => row.originalDispose.call(row.result));
    for (const row of bundle.rows) {
      attempt('owned-object-detach', () => row.object.removeFromParent());
      if (row.geometryDisposals === 0) attempt('original-geometry-dispose', () => row.geometry.dispose());
      if (row.materialDisposals === 0) attempt('original-material-dispose', () => row.material.dispose());
    }
    for (const row of bundle.rows) {
      attempt('owned-group-detach', () => row.group.removeFromParent());
      attempt('owned-group-clear', () => row.group.clear());
    }
    if (hasFailure) throw firstFailure;
  }
  return {rows, groups, observe, rowValue, resourcesReadable, release};
}
