import { assertNative, assertBuffer, requireFact } from './multispan-trim-uv-three-fixture.mjs';

export function observeTrimUVThreeResult(result) {
  return result.group.children.map(object => {
    const geometry = object.geometry, material = object.material;
    const row = { result, object, geometry, material, attributes: Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute, array: attribute.array, itemSize: attribute.itemSize, values: Array.from(attribute.array) })),
      indexAttribute: geometry.index, indexArray: geometry.index?.array ?? null, indices: geometry.index ? Array.from(geometry.index.array) : null, geometryDisposals: 0, materialDisposals: 0 };
    geometry.addEventListener('dispose', () => row.geometryDisposals++); material.addEventListener('dispose', () => row.materialDisposals++); return row;
  });
}
function pose(object) { return { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), visible: object.visible, renderOrder: object.renderOrder }; }
const targetValues = row => ({ attributes: row.attributes.map(value => ({ name: value.name, itemSize: value.itemSize, values: Array.from(row.geometry.getAttribute(value.name).array) })), indices: row.geometry.index ? Array.from(row.geometry.index.array) : null });

/** Actual references/CPU observer only. Root owns the camera, real renderer/frame reads and caller counters. */
export function createThreeTrimUVObserver({ host, scene, camera, renderer, canvas, callerMarker, getCameraState, getCallerCounters }) {
  const caller = { scene, camera, renderer, canvas, marker: callerMarker, geometry: callerMarker.geometry, material: callerMarker.material };
  function callerLive() {
    requireFact(caller.marker.parent === scene && caller.marker.geometry === caller.geometry && caller.marker.material === caller.material && renderer.domElement === canvas && canvas.isConnected && !renderer.getContext().isContextLost() && Object.values(getCallerCounters()).every(value => value === 0), 'Caller resources must remain unchanged and live');
  }
  function capture() {
    callerLive(); const record = host.accepted; requireFact(record, 'Accepted original classification required');
    return { record, asset: record.asset, proof: record.proof, classification: record.classification, trim: record.trim, model: record.model, native: record.native, result: record.result, readout: record.readout,
      cpu: structuredClone({ asset: record.asset, proof: record.proof, readout: record.readout, native: record.native }), cameraState: structuredClone(getCameraState()), counters: { ...getCallerCounters() },
      sceneChildren: [...scene.children], group: record.result.group, groupChildren: [...record.result.group.children], groupPose: pose(record.result.group),
      resources: record.resources.map(row => ({ row, object: row.object, geometry: row.object.geometry, material: row.object.material, pose: pose(row.object),
        attributes: row.attributes.map(value => ({ name: value.name, attribute: row.geometry.getAttribute(value.name), array: row.geometry.getAttribute(value.name).array })),
        index: row.geometry.index, indexArray: row.geometry.index?.array ?? null, values: targetValues(row) })),
      counts: host.counts, disposalCounts: host.allResources.map(row => [row.geometryDisposals, row.materialDisposals]) };
  }
  function check(before) {
    callerLive(); const record = host.accepted;
    requireFact(record === before.record && record.asset === before.asset && record.proof === before.proof && record.classification === before.classification && record.trim === before.trim && record.model === before.model && record.native === before.native && record.result === before.result && record.readout === before.readout, 'Refusal changed complete classification/native/source acceptance references');
    assertNative({ asset: record.asset, proof: record.proof, readout: record.readout, native: record.native }, before.cpu, 'retained-complete-native-UV');
    requireFact(scene.children.length === before.sceneChildren.length && before.sceneChildren.every((object, index) => scene.children[index] === object) && record.result.group === before.group && before.group.children.length === before.groupChildren.length && before.groupChildren.every((object, index) => before.group.children[index] === object), 'Refusal changed Scene/group children');
    assertNative(pose(before.group), before.groupPose); assertNative(getCameraState(), before.cameraState); assertNative(getCallerCounters(), before.counters);
    requireFact(host.counts.callbacks === before.counts.callbacks && host.counts.pairs === before.counts.pairs && host.counts.groups === before.counts.groups && host.counts.acceptedResults === before.counts.acceptedResults, 'Refusal allocated/admitted or called render');
    for (const item of before.resources) {
      requireFact(item.row.object === item.object && item.object.geometry === item.geometry && item.object.material === item.material && item.geometry.index === item.index && (item.geometry.index?.array ?? null) === item.indexArray, 'Refusal changed actual mesh resources');
      for (const attribute of item.attributes) requireFact(item.geometry.getAttribute(attribute.name) === attribute.attribute && attribute.attribute.array === attribute.array, 'Refusal changed actual attribute/buffer references');
      assertNative(targetValues(item.row), item.values); assertNative(pose(item.object), item.pose);
    }
    assertNative(host.allResources.map(row => [row.geometryDisposals, row.materialDisposals]), before.disposalCounts);
  }
  function snapshot() {
    callerLive(); const record = host.accepted, last = host.records.at(-1);
    return structuredClone({ counts: host.counts, accepted: record ? { key: record.key, state: record.state, asset: record.asset, classification: record.classification, trim: record.trim, proof: record.proof, model: record.model, native: record.native, readout: record.readout } : null,
      retainedLast: !record && last ? { key: last.key, asset: last.asset, classification: last.classification, trim: last.trim, proof: last.proof, model: last.model, native: last.native, readout: last.readout } : null,
      history: host.records.map(value => ({ key: value.key, state: value.state, queryRows: value.proof.queryRows })),
      groups: host.allGroups.map(group => ({ uuid: group.uuid, children: group.children.length, attached: group.parent !== null })),
      resources: host.allResources.map(row => ({ name: row.object.name, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
        currentCPUAttributes: targetValues(row), cachedAttributes: row.attributes.map(value => ({ name: value.name, itemSize: value.itemSize, values: value.values })), cachedIndices: row.indices })),
      camera: getCameraState(), caller: { retained: true, counters: getCallerCounters() }, events: host.events,
      scope: 'Whole native classification/source/query proof and actual Three CPU/resource identities. No UV-to-World, clipped fill, frame read or Group disposal certificate.' });
  }
  return { capture, check, snapshot };
}
