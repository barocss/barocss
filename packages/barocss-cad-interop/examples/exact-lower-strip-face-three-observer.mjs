import { assertNative, requireFact } from './exact-lower-strip-face-three-fixture.mjs';

/** Keep the actual Mesh before dispose removes it from its Group. */
export function observeExactLowerStripFaceThreeResult(result) {
  return result.group.children.map(object => {
    const geometry = object.geometry, material = object.material;
    const row = { result, object, geometry, material,
      attributes: Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute, array: attribute.array, itemSize: attribute.itemSize, values: Array.from(attribute.array) })),
      indexAttribute: geometry.index, indexArray: geometry.index.array, indices: Array.from(geometry.index.array), geometryDisposals: 0, materialDisposals: 0 };
    geometry.addEventListener('dispose', () => row.geometryDisposals++); material.addEventListener('dispose', () => row.materialDisposals++); return row;
  });
}
const pose = object => ({ position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), visible: object.visible, renderOrder: object.renderOrder });
const values = row => ({ attributes: row.attributes.map(value => ({ name: value.name, itemSize: value.itemSize, values: Array.from(value.array) })), indices: Array.from(row.indexArray) });

/** Observe actual identities and retained CPU only. Browser owns all frame reads. */
export function createExactLowerStripFaceThreeObserver({ host, scene, camera, renderer, canvas, callerMarker, getCameraState, getCallerCounters }) {
  const caller = { scene, camera, renderer, canvas, marker: callerMarker, geometry: callerMarker.geometry, material: callerMarker.material };
  function callerLive() {
    requireFact(caller.marker.parent === scene && caller.marker.geometry === caller.geometry && caller.marker.material === caller.material && renderer.domElement === canvas && canvas.isConnected && !renderer.getContext().isContextLost() && Object.values(getCallerCounters()).every(value => value === 0), 'Caller resources must remain live');
  }
  function capture() {
    callerLive(); const record = host.accepted; requireFact(record, 'Accepted exact original Face required');
    return { record, asset: record.asset, proof: record.proof, wall: record.wall, model: record.model, native: record.native, result: record.result, readout: record.readout,
      cpu: structuredClone({ asset: record.asset, proof: record.proof, native: record.native, readout: record.readout }), cameraState: structuredClone(getCameraState()), counters: getCallerCounters(), sceneChildren: [...scene.children],
      group: record.result.group, groupChildren: [...record.result.group.children], groupPose: pose(record.result.group),
      resources: record.resources.map(row => ({ row, object: row.object, geometry: row.geometry, material: row.material, pose: pose(row.object), attributes: row.attributes.map(value => ({ name: value.name, attribute: value.attribute, array: value.array })), index: row.indexAttribute, indexArray: row.indexArray, values: values(row) })),
      counts: host.counts, disposals: host.allResources.map(row => [row.geometryDisposals, row.materialDisposals]) };
  }
  function check(before) {
    callerLive(); const record = host.accepted;
    requireFact(record === before.record && record.asset === before.asset && record.proof === before.proof && record.wall === before.wall && record.model === before.model && record.native === before.native && record.result === before.result && record.readout === before.readout, 'Refusal changed complete Face/source/native references');
    assertNative({ asset: record.asset, proof: record.proof, native: record.native, readout: record.readout }, before.cpu); assertNative(getCameraState(), before.cameraState); assertNative(getCallerCounters(), before.counters);
    requireFact(scene.children.length === before.sceneChildren.length && before.sceneChildren.every((value, index) => scene.children[index] === value) && record.result.group === before.group && before.group.children.length === before.groupChildren.length && before.groupChildren.every((value, index) => before.group.children[index] === value), 'Refusal changed Scene/group order');
    assertNative(pose(before.group), before.groupPose);
    requireFact(host.counts.callbacks === before.counts.callbacks && host.counts.pairs === before.counts.pairs && host.counts.groups === before.counts.groups && host.counts.acceptedResults === before.counts.acceptedResults, 'Refusal allocated or admitted a target');
    for (const item of before.resources) {
      requireFact(item.row.object === item.object && item.object.geometry === item.geometry && item.object.material === item.material && item.geometry.index === item.index && item.index.array === item.indexArray, 'Refusal changed actual resource references');
      for (const attribute of item.attributes) requireFact(item.geometry.getAttribute(attribute.name) === attribute.attribute && attribute.attribute.array === attribute.array, 'Refusal changed target attributes');
      assertNative(values(item.row), item.values); assertNative(pose(item.object), item.pose);
    }
    assertNative(host.allResources.map(row => [row.geometryDisposals, row.materialDisposals]), before.disposals);
  }
  function snapshot() {
    callerLive(); const record = host.accepted, last = host.records.at(-1);
    const nativeRecord = value => value ? { key: value.key, state: value.state, asset: value.asset, wall: value.wall, proof: value.proof, model: value.model, native: value.native, readout: value.readout } : null;
    return structuredClone({ counts: host.counts, accepted: nativeRecord(record), retainedLast: record ? null : nativeRecord(last),
      history: host.records.map(value => ({ key: value.key, state: value.state, orientation: value.wall.face.orientation, face: value.wall.face, uses: value.wall.loop.uses, observationCount: value.wall.observations.length })),
      groups: host.allGroups.map(group => ({ uuid: group.uuid, children: group.children.length, attached: group.parent !== null })),
      resources: host.allResources.map(row => ({ name: row.object.name, meshUuid: row.object.uuid, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
        currentCPU: values(row), cachedCPU: { attributes: row.attributes.map(value => ({ name: value.name, itemSize: value.itemSize, values: value.values })), indices: row.indices } })),
      camera: getCameraState(), caller: { retained: true, counters: getCallerCounters() }, events: host.events,
      scope: 'Complete original Face/source/native/readout and actual Three identities/retained CPU. No Mesh objects, frame capture, clipped fill or Body/Solid certificate.' });
  }
  return { capture, check, snapshot };
}
