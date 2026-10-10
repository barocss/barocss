import { Scene } from '@babylonjs/core/scene.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
import { BaroCADUniformCurveBabylonLoader } from '@barocss/cad-interop/babylon-uniform-curve';
import { proveCase, createWorldOptions, createParentOptions, assertNative, assertBuffer, requireFact,
  runSectionSourceRefusals, runSectionTransportRefusals } from './multispan-section-babylon-fixture.mjs';
import { observeMultiSpanSectionBabylonResult } from './multispan-section-babylon-observer.mjs';
const clone = value => structuredClone(value);
function pose(object) { return { position: object.position?.asArray() ?? null, rotation: object.rotation?.asArray() ?? null, quaternion: object.rotationQuaternion?.asArray() ?? null,
  scale: object.scaling?.asArray() ?? null, enabled: object.isEnabled?.() ?? null, visibility: object.visibility ?? null, renderingGroupId: object.renderingGroupId ?? null }; }
function materialState(material) { return { className: material.getClassName(), alpha: material.alpha, backFaceCulling: material.backFaceCulling, disableDepthWrite: material.disableDepthWrite, depthFunction: material.depthFunction }; }

/** Whole original source transaction with actual shared-material ownership. Caller Scene resources remain live. */
export function createMultiSpanSectionBabylonHost({ scene, onChange = () => {} }) {
  requireFact(scene instanceof Scene && !scene.isDisposed && scene.useRightHandedSystem === true, 'Actual live caller right-handed Scene required');
  let accepted = null, disposed = false, peakLiveMeshes = 0, peakLiveGeometry = 0, peakLiveMaterials = 0;
  const records = [], allResources = [], allMaterials = [], materialMap = new Map(), allocatedResults = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseWorldCalls: 0, parseParentCalls: 0, loadWorldCalls: 0, loadParentCalls: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const liveMeshes = () => allResources.filter(row => row.meshDisposals === 0).length;
  const liveGeometry = () => allResources.filter(row => row.geometryDisposals === 0).length;
  const liveMaterials = () => allMaterials.filter(row => row.disposals === 0).length;
  function available() { requireFact(!disposed, 'Original section host disposed'); }
  function remember(result, role) {
    allocatedResults.push(result); const rows = observeMultiSpanSectionBabylonResult(result, role, materialMap, allMaterials); allResources.push(...rows);
    peakLiveMeshes = Math.max(peakLiveMeshes, liveMeshes()); peakLiveGeometry = Math.max(peakLiveGeometry, liveGeometry()); peakLiveMaterials = Math.max(peakLiveMaterials, liveMaterials());
    events.push({ type: 'prepared', role, meshCount: rows.length, liveMeshes: liveMeshes(), liveGeometry: liveGeometry(), liveMaterials: liveMaterials() }); return result;
  }
  function parseWorld(source, options = createWorldOptions()) {
    const loader = new BaroCADUniformCurveBabylonLoader(options); counters.parseWorldCalls++; return remember(loader.parse(source, scene), 'world');
  }
  function disableParent(result) { for (const mesh of result.meshes) mesh.setEnabled(false); return result; }
  function parseParent(source, options = createParentOptions(), role = 'parent') {
    const loader = new BaroCADBabylonLoader(scene, options); counters.parseParentCalls++;
    // Parent parse returns enabled registered meshes. Disable synchronously before capture, await or render.
    return remember(disableParent(loader.parse(source)), role);
  }
  async function loadWorld(url, transport = {}) {
    const loader = new BaroCADUniformCurveBabylonLoader(createWorldOptions()); counters.loadWorldCalls++; return remember(await loader.loadAsync(url, scene, transport), 'world');
  }
  async function loadParent(url, role, transport = {}) {
    const loader = new BaroCADBabylonLoader(scene, createParentOptions()); counters.loadParentCalls++;
    // The public URL loader awaits after its parse call. Apply caller staging on this INSTANCE in that same stack.
    const actualParse = loader.parse;
    loader.parse = function (source) { counters.parseParentCalls++; return remember(disableParent(actualParse.call(this, source)), role); };
    try { return await loader.loadAbortable(url, transport); } finally { loader.parse = actualParse; }
  }
  function release(results) { for (const result of results) { result.dispose(); result.dispose(); } }
  function identity(mesh) { assertNative(mesh.position.asArray(), [0, 0, 0]); assertNative(mesh.rotation.asArray(), [0, 0, 0]); assertNative(mesh.scaling.asArray(), [1, 1, 1]); requireFact(mesh.parent === null && mesh.rotationQuaternion === null, 'Native identity/null-quaternion pose required'); }
  function nativeExact(result, native) { for (const key of Object.keys(native)) assertNative(result[key], native[key], 'complete-native.' + key); }
  function verifyWorld(result, native) {
    nativeExact(result, native); const line = result.line;
    requireFact(line.getScene() === scene && scene.meshes.includes(line) && !line.isEnabled() && line.getTotalVertices() === 129 && Array.isArray(line.getIndices()) && line.getIndices().length === 256, 'Actual disabled original 129-vertex registered line-list required');
    requireFact(line.getVerticesData('position') instanceof Float32Array && line.getVerticesData('position') !== result.positions && line.geometry.getVerticesDataKinds().join(',') === 'position' && line.material.getClassName() === 'ShaderMaterial', 'Actual copied World Float32 positions/explicit color shader required');
    assertBuffer(line.getVerticesData('position'), native.positions); assertBuffer(line.getIndices(), Array.from({ length: 128 }, (_, index) => [index, index + 1]).flat()); identity(line);
  }
  function verifyParent(result, native) {
    nativeExact(result, native); requireFact(result.meshes.length === native.surfaces.length && result.curves.length === 0, 'Complete parent Surface-only preview required');
    assertNative(result.unrenderedCurveIds, native.model.objects.filter(object => object.kind === 'curve').map(object => object.id));
    for (const [index, mesh] of result.meshes.entries()) {
      const surface = native.surfaces[index]; requireFact(mesh.getScene() === scene && scene.meshes.includes(mesh) && !mesh.isEnabled() && mesh.getTotalVertices() === 153 && mesh.getIndices().length === 768 && mesh.material.getClassName() === 'StandardMaterial', 'Actual disabled original Surface grid/shared StandardMaterial required');
      assertNative(mesh.geometry.getVerticesDataKinds().sort(), ['normal', 'position']);
      assertBuffer(mesh.getVerticesData('position'), surface.mesh.positions); assertBuffer(mesh.getVerticesData('normal'), surface.mesh.normals); assertBuffer(mesh.getIndices(), surface.mesh.indices);
      requireFact(mesh.metadata.barocss.surfaceId === surface.surfaceId && mesh.metadata.barocss.modelName === native.model.name && mesh.metadata.barocss.nativeParameters instanceof Float32Array && !mesh.isVerticesDataPresent('uv'), 'Original identity and metadata-only native grid UV required');
      assertBuffer(mesh.metadata.barocss.nativeParameters, Float32Array.from(surface.mesh.parameters)); identity(mesh);
    }
    requireFact(new Set(result.meshes.map(mesh => mesh.material)).size === 1, 'Each Surface parent owns one actual shared material');
  }
  function stage(asset, proof, results, state) {
    const [worldResult, ...parentResults] = results;
    verifyWorld(worldResult, proof.nativeWorld); parentResults.forEach((result, index) => verifyParent(result, proof.nativeParents[index]));
    requireFact(worldResult.source === asset.worldSource, 'Complete original World source binding changed');
    for (const parent of parentResults) for (const material of new Set(parent.meshes.map(mesh => mesh.material))) { material.alpha = .32; material.backFaceCulling = false; material.disableDepthWrite = true; }
    worldResult.line.material.depthFunction = Constants.ALWAYS; worldResult.line.material.disableDepthWrite = true; worldResult.line.renderingGroupId = 1;
    const resources = allResources.filter(row => results.includes(row.result));
    const readout = clone({ assetKey: asset.key, request: asset.request, section: proof.section, report: proof.report, originalModels: proof.originalModels,
      worldSource: asset.worldSource, parentSources: asset.parentSources, dualUV: asset.dualUV, worldNative: proof.nativeWorld, parentNatives: proof.nativeParents, derivativeCounts: proof.derivativeCounts,
      display: { worldOptions: createWorldOptions(), parentOptions: createParentOptions(), worldQuality: proof.nativeWorld.quality, nativeUVLocation: 'metadata.barocss.nativeParameters; not uploaded texture UV', approximateTriangleNormals: true, uniformChords: true } });
    return { assetKey: asset.key, state, asset, proof, worldNative: proof.nativeWorld, parentNatives: proof.nativeParents, worldResult, parentResults, results, resources, readout };
  }
  function admit(record) {
    const previous = accepted;
    for (const row of record.resources) row.mesh.setEnabled(true);
    accepted = record; records.push(record); counters.acceptedResults++; events.push({ type: 'enabled', assetKey: record.assetKey, state: record.state });
    if (previous) {
      release(previous.results); requireFact(previous.resources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1), 'Previous captured objects must release before callback/render'); events.push({ type: 'old-released', assetKey: previous.assetKey });
    }
    counters.callbacks++; events.push({ type: 'change', assetKey: record.assetKey, state: record.state }); onChange(record); return record;
  }
  function capture() {
    available(); requireFact(accepted, 'Accepted complete original required');
    const collections = Object.fromEntries(['meshes', 'geometries', 'materials', 'transformNodes', 'cameras', 'lights'].map(key => [key, [...scene[key]]]));
    return { record: accepted, asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, results: accepted.results, resources: accepted.resources,
      cpu: clone({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout }), callbacks: counters.callbacks, records: records.length, rows: allResources.length, materials: allMaterials.length,
      sceneHandedness: scene.useRightHandedSystem, activeCamera: scene.activeCamera, collections, poses: [...scene.meshes, ...scene.transformNodes, ...scene.cameras, ...scene.lights].map(object => ({ object, parent: object.parent, pose: pose(object) })),
      targets: accepted.resources.map(row => ({ row, mesh: row.mesh, geometry: row.mesh.geometry, material: row.mesh.material, materialState: materialState(row.mesh.material),
        attributes: row.attributes.map(attribute => ({ name: attribute.name, vertexBuffer: row.geometry.getVertexBuffer(attribute.name), array: row.mesh.getVerticesData(attribute.name), values: Array.from(row.mesh.getVerticesData(attribute.name)) })),
        index: row.mesh.getIndices(), indices: Array.from(row.mesh.getIndices()), metadata: row.mesh.metadata, metadataCPU: clone(row.mesh.metadata) })),
      counts: { meshes: allResources.map(row => row.meshDisposals), geometry: allResources.map(row => row.geometryDisposals), materials: allMaterials.map(row => row.disposals) } };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.proof === before.proof && accepted.readout === before.readout && accepted.results === before.results && accepted.resources === before.resources, 'Refusal replaced complete original acceptance');
    assertNative({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout }, before.cpu, 'retained-complete-original');
    requireFact(counters.callbacks === before.callbacks && records.length === before.records && allResources.length === before.rows && allMaterials.length === before.materials && scene.useRightHandedSystem === before.sceneHandedness && scene.activeCamera === before.activeCamera, 'Refusal allocated, disposed, admitted or changed caller Scene');
    for (const [key, objects] of Object.entries(before.collections)) requireFact(scene[key].length === objects.length && objects.every((object, index) => scene[key][index] === object), 'Refusal changed actual Scene ' + key);
    for (const item of before.poses) { requireFact(item.object.parent === item.parent, 'Refusal changed parent pose reference'); assertNative(pose(item.object), item.pose); }
    for (const item of before.targets) {
      requireFact(item.row.mesh === item.mesh && item.mesh.geometry === item.geometry && item.mesh.material === item.material && item.mesh.getIndices() === item.index && item.mesh.metadata === item.metadata, 'Refusal changed mesh/geometry/material/metadata/index references');
      assertBuffer(item.index, item.indices); assertNative(item.metadata, item.metadataCPU); assertNative(materialState(item.material), item.materialState);
      for (const attribute of item.attributes) { requireFact(item.geometry.getVertexBuffer(attribute.name) === attribute.vertexBuffer && item.mesh.getVerticesData(attribute.name) === attribute.array, 'Refusal changed target vertex references'); assertBuffer(attribute.array, attribute.values); }
    }
    assertNative({ meshes: allResources.map(row => row.meshDisposals), geometry: allResources.map(row => row.geometryDisposals), materials: allMaterials.map(row => row.disposals) }, before.counts, 'retained-actual-disposal-counts');
  }
  function wrongHanded(source, kind) {
    const original = scene.useRightHandedSystem; scene.useRightHandedSystem = false;
    try { return kind === 'world' ? parseWorld(source) : parseParent(source); } finally { scene.useRightHandedSystem = original; }
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get allMaterials() { return allMaterials; }, get events() { return events; },
    get counts() { return { ...counters, meshes: allResources.length, geometries: new Set(allResources.map(row => row.geometry)).size, materials: allMaterials.length,
      meshDisposals: allResources.reduce((sum, row) => sum + row.meshDisposals, 0), geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: allMaterials.reduce((sum, row) => sum + row.disposals, 0),
      liveMeshes: liveMeshes(), liveGeometry: liveGeometry(), liveMaterials: liveMaterials(), peakLiveMeshes, peakLiveGeometry, peakLiveMaterials,
      pairs: allResources.length, livePairs: liveGeometry(), peakLivePairs: peakLiveGeometry, disposed }; },
    load(asset) {
      available(); const proof = proveCase(asset), start = allocatedResults.length;
      try { return admit(stage(asset, proof, [parseWorld(asset.worldSource), parseParent(asset.parentSources[0], createParentOptions(), 'surface'), parseParent(asset.parentSources[1], createParentOptions(), 'plane')], 'original')); }
      catch (error) { if (!accepted || accepted.results[0] !== allocatedResults[start]) release(allocatedResults.slice(start)); throw error; }
    },
    async coldReopen(asset, urls, transport = {}) {
      available(); requireFact(accepted && accepted.assetKey === asset.key, 'Cold original family mismatch'); assertNative(asset, accepted.asset, 'fresh-seven-original-files');
      const proof = proveCase(asset), previous = accepted, start = allocatedResults.length;
      try { const world = await loadWorld(urls.world, transport), surface = await loadParent(urls.surface, 'surface', transport), plane = await loadParent(urls.plane, 'plane', transport);
        requireFact(!disposed && accepted === previous, 'Accepted original changed during cold reopen'); return admit(stage(asset, proof, [world, surface, plane], 'cold-reopen'));
      } catch (error) { if (!accepted || accepted.results[0] !== allocatedResults[start]) release(allocatedResults.slice(start)); throw error; }
    },
    runRefusals(asset, afterRefusal = () => {}) {
      const before = capture(), start = allocatedResults.length;
      try { const result = runSectionSourceRefusals(asset, { parseWorld, parseParent, uniformWrongHanded: source => wrongHanded(source, 'world'), parentWrongHanded: source => wrongHanded(source, 'parent') }, receipt => {
        retained(before); counters.synchronousRefusals++; events.push({ type: 'refused', ...receipt }); afterRefusal({ ...receipt, pairsBefore: before.rows, pairsAfter: allResources.length });
      }); retained(before); return result; } catch (error) { release(allocatedResults.slice(start)); throw error; }
    },
    async runTransportRefusals(url, afterRefusal = () => {}) {
      const before = capture(), start = allocatedResults.length;
      try { const result = await runSectionTransportRefusals(url, loadWorld, async receipt => {
        retained(before); counters.transportRefusals++; events.push({ type: 'transport-refused', ...receipt }); await afterRefusal({ ...receipt, pairsBefore: before.rows, pairsAfter: allResources.length });
      }); retained(before); return result; } catch (error) { release(allocatedResults.slice(start)); throw error; }
    },
    dispose() {
      if (disposed) return; disposed = true; const previous = accepted; accepted = null; if (previous) release(previous.results);
      requireFact(liveMeshes() === 0 && liveGeometry() === 0 && liveMaterials() === 0, 'All actual captured owned resources must release'); counters.callbacks++; events.push({ type: 'disposed' }); onChange(null);
    },
  };
  return host;
}
