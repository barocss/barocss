import { Camera, LightingEnvironment } from 'pixi3d/pixi7';
import { assertNative, assertBuffer, requireFact } from './multispan-section-pixi3d-fixture.mjs';

/** Actual returned resources only; wrappers delegate to the original instance methods. */
export function observePixiSectionResult(result, role) {
  const root = result.root, rootRow = { root, role, result, rootDestroyCalls: 0 }, originalRootDestroy = root.destroy;
  root.destroy = function (...args) { rootRow.rootDestroyCalls++; return originalRootDestroy.apply(this, args); };
  const entries = role === 'world' ? [{ mesh: result.mesh, curveId: result.curveId }] : result.renderedSurfaces;
  const resources = entries.map((entry, index) => {
    const mesh = entry.mesh, geometry = mesh.geometry, material = mesh.material;
    const row = { result, role, root, mesh, geometry, material, nativeId: entry.surfaceId ?? entry.curveId,
      positionAttribute: geometry.positions, normalAttribute: geometry.normals, indexAttribute: geometry.indices,
      positionArray: geometry.positions.buffer, normalArray: geometry.normals.buffer, indexArray: geometry.indices.buffer,
      positions: Array.from(geometry.positions.buffer), normals: Array.from(geometry.normals.buffer), indices: Array.from(geometry.indices.buffer),
      nativeUVArray: role === 'world' ? null : result.surfaces[index].mesh.parameters,
      nativeUV: role === 'world' ? null : Array.from(result.surfaces[index].mesh.parameters),
      meshDestroyCalls: 0, geometryDestroyCalls: 0, materialDestroyCalls: 0, shaderCreateCalls: 0, shader: null };
    for (const [kind, object] of Object.entries({ mesh, geometry, material })) {
      const original = object.destroy; object.destroy = function (...args) { row[kind + 'DestroyCalls']++; return original.apply(this, args); };
    }
    const originalCreateShader = material.createShader;
    material.createShader = function (...args) { const shader = originalCreateShader.apply(this, args); row.shaderCreateCalls++; if (shader) row.shader = shader; return shader; };
    return row;
  });
  return { rootRow, resources };
}
function pose(object) {
  return { position: object.position?.array ? Array.from(object.position.array) : [object.position.x, object.position.y],
    scale: object.scale?.array ? Array.from(object.scale.array) : [object.scale.x, object.scale.y],
    quaternion: object.rotationQuaternion ? Array.from(object.rotationQuaternion.array) : null,
    visible: object.visible, renderable: object.renderable, alpha: object.alpha, renderSortOrder: object.renderSortOrder ?? null };
}
function materialState(material) { return { color: Array.from(material.baseColor.rgba), drawMode: material.drawMode, unlit: material.unlit, doubleSided: material.doubleSided,
  alphaMode: material.alphaMode, depthMask: material.depthMask, depthTest: material.state.depthTest, renderSortType: material.renderSortType }; }
function nativeResult(result, native) { return Object.fromEntries(Object.keys(native).map(key => [key, result[key]])); }

/** CPU/reference observer. The caller owns all actual frame reads and GL depth initialization. */
export function createPixiSectionObserver({ host, stage, camera, lighting, renderer, canvas, callerMarker, getCameraState, getCallerCounters }) {
  const mainCamera = Camera.main, mainLighting = LightingEnvironment.main;
  const caller = { stage, camera, lighting, renderer, canvas, callerMarker, markerGeometry: callerMarker.geometry, markerMaterial: callerMarker.material };
  function checkCaller() {
    requireFact(!stage.destroyed && !camera.destroyed && !callerMarker.destroyed && callerMarker.parent === stage && callerMarker.geometry === caller.markerGeometry && callerMarker.material === caller.markerMaterial && canvas.isConnected && !renderer.gl.isContextLost(), 'Caller objects/canvas/context must stay live');
    requireFact(Camera.main === mainCamera && LightingEnvironment.main === mainLighting && renderer.plugins.lighting === lighting && camera.renderer === renderer && lighting.renderer === renderer, 'Caller global camera/lighting/renderer identity changed');
    requireFact(Object.values(getCallerCounters()).every(value => value === 0), 'Caller destruction was observed');
  }
  function capture() {
    checkCaller(); const record = host.accepted; requireFact(record, 'Accepted original section required for capture');
    return { record, asset: record.asset, proof: record.proof, readout: record.readout, worldNative: record.worldNative, parentNatives: record.parentNatives,
      results: record.results, roots: record.roots, resources: record.resources,
      cpu: structuredClone({ asset: record.asset, proof: record.proof, readout: record.readout, world: nativeResult(record.worldResult, record.worldNative), parents: record.parentResults.map((result, index) => nativeResult(result, record.parentNatives[index])) }),
      sceneChildren: [...stage.children], rootChildren: record.roots.map(root => ({ root, children: [...root.children], parent: root.parent })),
      pose: [stage, ...stage.children, ...record.resources.map(row => row.mesh)].map(object => ({ object, values: pose(object) })),
      targets: record.resources.map(row => ({ row, root: row.root, mesh: row.mesh, geometry: row.mesh.geometry, material: row.mesh.material,
        positions: row.geometry.positions, normals: row.geometry.normals, indices: row.geometry.indices,
        positionArray: row.geometry.positions.buffer, normalArray: row.geometry.normals.buffer, indexArray: row.geometry.indices.buffer,
        data: structuredClone({ positions: row.geometry.positions, normals: row.geometry.normals, indices: row.geometry.indices }),
        nativeUVArray: row.nativeUVArray, nativeUV: row.nativeUVArray ? Array.from(row.nativeUVArray) : null,
        materialCamera: row.material.camera, materialLighting: row.material.lightingEnvironment, materialState: materialState(row.material) })),
      resourceLength: host.allResources.length, rootLength: host.allRoots.length, recordLength: host.records.length, callbacks: host.counts.callbacks,
      resourceCounts: host.allResources.map(row => [row.meshDestroyCalls, row.geometryDestroyCalls, row.materialDestroyCalls]), rootCounts: host.allRoots.map(row => row.rootDestroyCalls),
      cameraValues: structuredClone(getCameraState()), callerCounters: { ...getCallerCounters() } };
  }
  function check(before) {
    checkCaller(); const record = host.accepted;
    requireFact(record === before.record && record.asset === before.asset && record.proof === before.proof && record.readout === before.readout && record.worldNative === before.worldNative && record.parentNatives === before.parentNatives && record.results === before.results && record.roots === before.roots && record.resources === before.resources, 'Refusal changed complete acceptance references');
    assertNative({ asset: record.asset, proof: record.proof, readout: record.readout, world: nativeResult(record.worldResult, record.worldNative), parents: record.parentResults.map((result, index) => nativeResult(result, record.parentNatives[index])) }, before.cpu, 'retained-whole-original/native');
    requireFact(host.allResources.length === before.resourceLength && host.allRoots.length === before.rootLength && host.records.length === before.recordLength && host.counts.callbacks === before.callbacks, 'Refusal allocated/admitted or called observer');
    requireFact(stage.children.length === before.sceneChildren.length && before.sceneChildren.every((child, index) => stage.children[index] === child), 'Refusal changed caller Stage order');
    for (const row of before.rootChildren) requireFact(row.root.parent === row.parent && row.root.children.length === row.children.length && row.children.every((child, index) => row.root.children[index] === child), 'Refusal changed owned root children');
    for (const item of before.pose) assertNative(pose(item.object), item.values, 'retained-native/caller-pose');
    for (const target of before.targets) {
      requireFact(target.row.root === target.root && target.row.mesh === target.mesh && target.mesh.geometry === target.geometry && target.mesh.material === target.material && target.geometry.positions === target.positions && target.geometry.normals === target.normals && target.geometry.indices === target.indices && target.positions.buffer === target.positionArray && target.normals.buffer === target.normalArray && target.indices.buffer === target.indexArray, 'Refusal changed actual resource/attribute/buffer references');
      assertNative({ positions: target.positions, normals: target.normals, indices: target.indices }, target.data, 'retained-target-attributes');
      requireFact(target.row.nativeUVArray === target.nativeUVArray && target.material.camera === target.materialCamera && target.material.lightingEnvironment === target.materialLighting, 'Refusal changed nativeUV/caller material context');
      if (target.nativeUV) assertBuffer(target.nativeUVArray, target.nativeUV); assertNative(materialState(target.material), target.materialState, 'retained-display-material');
    }
    assertNative(host.allResources.map(row => [row.meshDestroyCalls, row.geometryDestroyCalls, row.materialDestroyCalls]), before.resourceCounts); assertNative(host.allRoots.map(row => row.rootDestroyCalls), before.rootCounts);
    assertNative(getCameraState(), before.cameraValues, 'retained-caller-camera'); assertNative(getCallerCounters(), before.callerCounters, 'retained-caller-counters');
  }
  function snapshot() {
    checkCaller(); const record = host.accepted, last = host.records.at(-1);
    return structuredClone({ counts: host.counts, accepted: record ? { key: record.key, asset: record.asset, proof: record.proof, worldNative: record.worldNative, parentNatives: record.parentNatives, readout: record.readout } : null,
      retainedLast: !record && last ? { key: last.key, asset: last.asset, proof: last.proof, worldNative: last.worldNative, parentNatives: last.parentNatives, readout: last.readout } : null,
      records: host.records.map(value => ({ key: value.key, state: value.state, readout: value.readout })),
      roots: host.allRoots.map(row => ({ role: row.role, rootDestroyCalls: row.rootDestroyCalls, destroyed: row.root.destroyed, attached: row.root.parent !== null })),
      resources: host.allResources.map(row => ({ role: row.role, nativeId: row.nativeId, meshDestroyCalls: row.meshDestroyCalls, geometryDestroyCalls: row.geometryDestroyCalls, materialDestroyCalls: row.materialDestroyCalls,
        positions: row.positions, normals: row.normals, indices: row.indices, nativeUV: row.nativeUV,
        currentCPUPositions: Array.from(row.geometry.positions.buffer), currentCPUNormals: Array.from(row.geometry.normals.buffer), currentCPUIndices: Array.from(row.geometry.indices.buffer),
        shaderCreateCalls: row.shaderCreateCalls, shaderGeometryReady: row.meshDestroyCalls === 0 && !!row.shader && row.geometry.hasShaderGeometry(row.shader, false) })),
      camera: getCameraState(), caller: { counters: getCallerCounters(), retained: true, stageChildren: stage.children.length, globalsRetained: true }, events: host.events,
      scope: 'Actual original CPU data/resources/caller identity. Root owns real frames/depth clear; readable destroyed CPU arrays are not a GPU-liveness certificate.' });
  }
  return { capture, check, snapshot };
}
