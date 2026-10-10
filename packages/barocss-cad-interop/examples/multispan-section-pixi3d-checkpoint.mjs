import { Container3D, Mesh3D, MeshGeometry3D, StandardMaterial, Color, StandardMaterialAlphaMode, MaterialRenderSortType } from 'pixi3d/pixi7';
import { DRAW_MODES } from 'pixi.js';
import { BaroCADPixi3DLoader } from '@barocss/cad-interop/pixi3d';
import { BaroCADUniformCurvePixi3DLoader } from '@barocss/cad-interop/pixi3d-uniform-curve';
import { proveCase, createWorldOptions, createParentOptions, assertNative, assertBuffer, requireFact,
  runSectionSourceRefusals, runSectionTransportRefusals } from './multispan-section-pixi3d-fixture.mjs';
import { observePixiSectionResult } from './multispan-section-pixi3d-observer.mjs';
const clone = value => structuredClone(value);
function pose(object) { return { position: Array.from(object.position.array), quaternion: Array.from(object.rotationQuaternion.array), scale: Array.from(object.scale.array), visible: object.visible, renderSortOrder: object.renderSortOrder }; }
function identity(object) { assertBuffer(object.position.array, [0, 0, 0]); assertBuffer(object.scale.array, [1, 1, 1]); assertBuffer(object.rotationQuaternion.array, [0, 0, 0, 1]); }
function nativeFields(result, native) { return Object.fromEntries(Object.keys(native).map(key => [key, result[key]])); }
function materialState(material) { return { color: Array.from(material.baseColor.rgba), drawMode: material.drawMode, unlit: material.unlit, doubleSided: material.doubleSided, alphaMode: material.alphaMode,
  depthMask: material.depthMask, depthTest: material.state.depthTest, renderSortType: material.renderSortType }; }

/** Original whole-source host using only genuine existing Pixi loaders and detached qualification. */
export function createMultiSpanSectionPixiHost({ stage, camera, lighting, onChange = () => {} }) {
  let accepted = null, disposed = false, peakLiveMeshes = 0, peakLiveGeometry = 0, peakLiveMaterials = 0, peakLiveRoots = 0;
  const records = [], allResources = [], allRoots = [], allocatedResults = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseWorldCalls: 0, parseParentCalls: 0, loadWorldCalls: 0, loadParentCalls: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const liveMeshes = () => allResources.filter(row => row.meshDestroyCalls === 0).length;
  const liveGeometry = () => allResources.filter(row => row.geometryDestroyCalls === 0).length;
  const liveMaterials = () => allResources.filter(row => row.materialDestroyCalls === 0).length;
  const liveRoots = () => allRoots.filter(row => row.rootDestroyCalls === 0).length;
  function available() { requireFact(!disposed, 'Original section host disposed'); }
  function remember(result, role) {
    const captured = observePixiSectionResult(result, role); allocatedResults.push(result); allRoots.push(captured.rootRow); allResources.push(...captured.resources);
    peakLiveMeshes = Math.max(peakLiveMeshes, liveMeshes()); peakLiveGeometry = Math.max(peakLiveGeometry, liveGeometry()); peakLiveMaterials = Math.max(peakLiveMaterials, liveMaterials()); peakLiveRoots = Math.max(peakLiveRoots, liveRoots());
    events.push({ type: 'prepared', role, liveMeshes: liveMeshes(), liveGeometry: liveGeometry(), liveMaterials: liveMaterials(), liveRoots: liveRoots() }); return result;
  }
  function parseWorld(source, options = createWorldOptions()) { const loader = new BaroCADUniformCurvePixi3DLoader(options); counters.parseWorldCalls++; return remember(loader.parse(source), 'world'); }
  function parseParent(source, options = createParentOptions(), role = 'parent') { const loader = new BaroCADPixi3DLoader(options); counters.parseParentCalls++; return remember(loader.parse(source), role); }
  async function loadWorld(url, transport = {}) {
    const loader = new BaroCADUniformCurvePixi3DLoader(createWorldOptions()); counters.loadWorldCalls++;
    const actualParse = loader.parse; loader.parse = function (source) { counters.parseWorldCalls++; return remember(actualParse.call(this, source), 'world'); };
    try { return await loader.loadAsync(url, transport); } finally { loader.parse = actualParse; }
  }
  async function loadParent(url, role, transport = {}) {
    const loader = new BaroCADPixi3DLoader(createParentOptions()); counters.loadParentCalls++;
    const actualParse = loader.parse; loader.parse = function (source) { counters.parseParentCalls++; return remember(actualParse.call(this, source), role); };
    try { return await loader.loadAbortable(url, transport); } finally { loader.parse = actualParse; }
  }
  function release(results) { for (const result of results) { result.dispose(); result.dispose(); } }
  function verifyMesh(mesh, root, positions, normals, indices, actualNativePositions) {
    requireFact(root instanceof Container3D && mesh instanceof Mesh3D && mesh.geometry instanceof MeshGeometry3D && mesh.material instanceof StandardMaterial && root.parent === null && mesh.parent === root, 'Real detached original Pixi objects required');
    identity(root); identity(mesh); const geometry = mesh.geometry;
    requireFact(geometry.positions.buffer instanceof Float32Array && geometry.positions.buffer !== actualNativePositions && geometry.normals.buffer instanceof Float32Array && geometry.indices.buffer instanceof Uint16Array, 'Actual separate Float32 positions/normals and Uint16 target indices required');
    assertBuffer(geometry.positions.buffer, positions); assertBuffer(geometry.normals.buffer, normals); assertBuffer(geometry.indices.buffer, indices);
    requireFact(geometry.positions.componentType === 5126 && geometry.positions.componentCount === 3 && geometry.positions.normalized === false && geometry.normals.componentType === 5126 && geometry.normals.componentCount === 3 && geometry.normals.normalized === false && geometry.indices.componentType === 5123 && geometry.indices.componentCount === 1 && geometry.indices.normalized === false && !geometry.uvs, 'Native target attribute format/no uploaded UV required');
    const count = geometry.positions.buffer.length / 3;
    for (const axis of [0, 1, 2]) { const values = Array.from({ length: count }, (_, index) => geometry.positions.buffer[index * 3 + axis]); requireFact(Object.is(geometry.positions.min[axis], Math.min(...values)) && Object.is(geometry.positions.max[axis], Math.max(...values)), 'Actual target bounds changed'); }
    requireFact(mesh.material.unlit && mesh.material.doubleSided, 'Existing unlit/double-sided material required'); mesh.material.camera = camera; mesh.material.lightingEnvironment = lighting;
  }
  function qualifyCandidate(asset, proof, results, state) {
    const [worldResult, ...parentResults] = results;
    assertNative(nativeFields(worldResult, proof.nativeWorld), proof.nativeWorld, 'complete-world-native');
    requireFact(worldResult.root.children.length === 1 && worldResult.root.children[0] === worldResult.mesh && worldResult.source === asset.worldSource, 'Original World root/source required');
    verifyMesh(worldResult.mesh, worldResult.root, proof.nativeWorld.positions, Float32Array.from({ length: 387 }, (_, index) => index % 3 === 2 ? 1 : 0), Uint16Array.from({ length: 129 }, (_, index) => index), worldResult.positions);
    requireFact(worldResult.mesh.geometry.positions.buffer.length === 387 && worldResult.mesh.material.drawMode === DRAW_MODES.LINE_STRIP, 'Actual World129 LINE_STRIP required');
    assertBuffer(worldResult.mesh.material.baseColor.rgba, Float32Array.from([40 / 255, 201 / 255, 235 / 255, 1]));
    for (const [index, result] of parentResults.entries()) {
      const native = proof.nativeParents[index]; assertNative(nativeFields(result, native), native, 'complete-parent-native');
      requireFact(result.renderedCurves.length === 0 && result.renderedSurfaces.length === native.surfaces.length && result.root.children.length === native.surfaces.length, 'Whole parent Surface-only root required');
      for (const [surfaceIndex, entry] of result.renderedSurfaces.entries()) {
        const surface = native.surfaces[surfaceIndex]; requireFact(entry.surfaceId === surface.surfaceId && result.root.children[surfaceIndex] === entry.mesh, 'Original renderedSurfaces identity changed');
        verifyMesh(entry.mesh, result.root, surface.mesh.positions, surface.mesh.normals, Uint16Array.from(surface.mesh.indices), result.surfaces[surfaceIndex].mesh.positions);
        requireFact(entry.mesh.geometry.positions.buffer.length === 459 && entry.mesh.geometry.indices.buffer.length === 768, 'Original Surface153/256triangle grid required');
        entry.mesh.material.alphaMode = StandardMaterialAlphaMode.blend; entry.mesh.material.baseColor = new Color(.3, .7, .9, .32); entry.mesh.material.depthMask = false;
      }
      requireFact(new Set(result.renderedSurfaces.map(entry => entry.mesh.material)).size === native.surfaces.length, 'Each original Surface has its own material, no Babylon sharing');
    }
    worldResult.mesh.material.state.depthTest = false; worldResult.mesh.material.depthMask = false; worldResult.mesh.material.renderSortType = MaterialRenderSortType.transparent; worldResult.mesh.renderSortOrder = 10;
    const resources = allResources.filter(row => results.includes(row.result)), roots = results.map(result => result.root);
    const readout = clone({ key: asset.key, request: asset.request, section: proof.section, report: proof.report, originalModels: proof.originalModels, worldSource: asset.worldSource, parentSources: asset.parentSources,
      dualUV: asset.dualUV, worldNative: proof.nativeWorld, parentNatives: proof.nativeParents, derivativeCounts: proof.derivativeCounts,
      display: { worldOptions: createWorldOptions(), parentOptions: createParentOptions(), worldQuality: proof.nativeWorld.quality, worldNormalIsCADNormal: false, nativeUVLocation: 'neutral Surface.mesh.parameters only', triangleNormalsAreApproximate: true, uniformChords: true } });
    return { key: asset.key, state, asset, proof, worldNative: proof.nativeWorld, parentNatives: proof.nativeParents, worldResult, parentResults, results, roots, resources, readout };
  }
  function admit(record) {
    const previous = accepted; for (const root of record.roots) stage.addChild(root); accepted = record; records.push(record); counters.acceptedResults++; events.push({ type: 'attached', key: record.key, state: record.state });
    if (previous) { release(previous.results); requireFact(previous.resources.every(row => row.meshDestroyCalls === 1 && row.geometryDestroyCalls === 1 && row.materialDestroyCalls === 1), 'Previous captured targets must release before callback/render'); events.push({ type: 'old-released', key: previous.key }); }
    counters.callbacks++; events.push({ type: 'change', key: record.key, state: record.state }); onChange(record); return record;
  }
  function capture() {
    available(); requireFact(accepted, 'Accepted complete original required');
    return { record: accepted, cpu: clone({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, world: nativeFields(accepted.worldResult, accepted.worldNative), parents: accepted.parentResults.map((result, index) => nativeFields(result, accepted.parentNatives[index])) }),
      stageChildren: [...stage.children], roots: accepted.roots.map(root => ({ root, parent: root.parent, children: [...root.children], pose: pose(root) })),
      rows: accepted.resources.map(row => ({ row, mesh: row.mesh, geometry: row.mesh.geometry, material: row.mesh.material, materialState: materialState(row.mesh.material), materialCamera: row.material.camera, materialLighting: row.material.lightingEnvironment, pose: pose(row.mesh),
        attributes: { positions: row.geometry.positions, normals: row.geometry.normals, indices: row.geometry.indices }, arrays: { positions: row.geometry.positions.buffer, normals: row.geometry.normals.buffer, indices: row.geometry.indices.buffer },
        data: clone({ positions: row.geometry.positions, normals: row.geometry.normals, indices: row.geometry.indices }), nativeUV: row.nativeUVArray ? Array.from(row.nativeUVArray) : null, nativeUVArray: row.nativeUVArray })),
      resourceLength: allResources.length, rootLength: allRoots.length, recordLength: records.length, callbacks: counters.callbacks,
      disposalCounts: allResources.map(row => [row.meshDestroyCalls, row.geometryDestroyCalls, row.materialDestroyCalls]), rootCounts: allRoots.map(row => row.rootDestroyCalls) };
  }
  function retained(before) {
    requireFact(accepted === before.record, 'Refusal replaced accepted original');
    assertNative({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, world: nativeFields(accepted.worldResult, accepted.worldNative), parents: accepted.parentResults.map((result, index) => nativeFields(result, accepted.parentNatives[index])) }, before.cpu, 'retained-original/native-data');
    requireFact(allResources.length === before.resourceLength && allRoots.length === before.rootLength && records.length === before.recordLength && counters.callbacks === before.callbacks && stage.children.length === before.stageChildren.length && before.stageChildren.every((child, index) => stage.children[index] === child), 'Refusal allocated/admitted or changed Stage');
    for (const item of before.roots) { requireFact(item.root.parent === item.parent && item.root.children.length === item.children.length && item.children.every((child, index) => item.root.children[index] === child), 'Refusal changed original root identity'); assertNative(pose(item.root), item.pose); }
    for (const item of before.rows) {
      requireFact(item.row.mesh === item.mesh && item.mesh.geometry === item.geometry && item.mesh.material === item.material && item.material.camera === item.materialCamera && item.material.lightingEnvironment === item.materialLighting, 'Refusal changed actual mesh/resources/material context');
      for (const name of ['positions', 'normals', 'indices']) requireFact(item.geometry[name] === item.attributes[name] && item.geometry[name].buffer === item.arrays[name], 'Refusal replaced actual attribute/buffer refs');
      assertNative({ positions: item.geometry.positions, normals: item.geometry.normals, indices: item.geometry.indices }, item.data); assertNative(materialState(item.material), item.materialState); assertNative(pose(item.mesh), item.pose);
      requireFact(item.row.nativeUVArray === item.nativeUVArray, 'Refusal changed neutral nativeUV reference'); if (item.nativeUV) assertBuffer(item.nativeUVArray, item.nativeUV);
    }
    assertNative(allResources.map(row => [row.meshDestroyCalls, row.geometryDestroyCalls, row.materialDestroyCalls]), before.disposalCounts); assertNative(allRoots.map(row => row.rootDestroyCalls), before.rootCounts);
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get allRoots() { return allRoots; }, get events() { return events; },
    get counts() { return { ...counters, meshes: allResources.length, geometries: new Set(allResources.map(row => row.geometry)).size, materials: new Set(allResources.map(row => row.material)).size, roots: allRoots.length,
      meshDestroyCalls: allResources.reduce((sum, row) => sum + row.meshDestroyCalls, 0), geometryDestroyCalls: allResources.reduce((sum, row) => sum + row.geometryDestroyCalls, 0), materialDestroyCalls: allResources.reduce((sum, row) => sum + row.materialDestroyCalls, 0), rootDestroyCalls: allRoots.reduce((sum, row) => sum + row.rootDestroyCalls, 0),
      liveMeshes: liveMeshes(), liveGeometry: liveGeometry(), liveMaterials: liveMaterials(), liveRoots: liveRoots(), peakLiveMeshes, peakLiveGeometry, peakLiveMaterials, peakLiveRoots,
      pairs: allResources.length, livePairs: liveGeometry(), peakLivePairs: peakLiveGeometry, disposed }; },
    load(asset) {
      available(); const proof = proveCase(asset), start = allocatedResults.length;
      try { return admit(qualifyCandidate(asset, proof, [parseWorld(asset.worldSource), parseParent(asset.parentSources[0], createParentOptions(), 'surface'), parseParent(asset.parentSources[1], createParentOptions(), 'plane')], 'original')); }
      catch (error) { if (!accepted || accepted.results[0] !== allocatedResults[start]) release(allocatedResults.slice(start)); throw error; }
    },
    async loadFromUrls(asset, urls, transport = {}) {
      available(); requireFact(accepted && asset.key === accepted.key, 'Cold original family mismatch'); assertNative(asset, accepted.asset, 'fresh-seven-original-files'); const proof = proveCase(asset), previous = accepted, start = allocatedResults.length;
      try { const world = await loadWorld(urls.world, transport), surface = await loadParent(urls.surface, 'surface', transport), plane = await loadParent(urls.plane, 'plane', transport);
        requireFact(!disposed && accepted === previous, 'Accepted original changed during cold sources'); return admit(qualifyCandidate(asset, proof, [world, surface, plane], 'cold-reopen'));
      } catch (error) { if (!accepted || accepted.results[0] !== allocatedResults[start]) release(allocatedResults.slice(start)); throw error; }
    },
    runRefusals(asset, after = () => {}) {
      const before = capture(), start = allocatedResults.length;
      try { const result = runSectionSourceRefusals(asset, { parseWorld, parseParent }, receipt => { retained(before); counters.synchronousRefusals++; events.push({ type: 'refused', ...receipt }); after({ ...receipt, pairsBefore: before.resourceLength, pairsAfter: allResources.length }); }); retained(before); return result; }
      catch (error) { release(allocatedResults.slice(start)); throw error; }
    },
    async runTransportRefusals(url, after = () => {}) {
      const before = capture(), start = allocatedResults.length;
      try { const result = await runSectionTransportRefusals(url, loadWorld, async receipt => { retained(before); counters.transportRefusals++; events.push({ type: 'transport-refused', ...receipt }); await after({ ...receipt, pairsBefore: before.resourceLength, pairsAfter: allResources.length }); }); retained(before); return result; }
      catch (error) { release(allocatedResults.slice(start)); throw error; }
    },
    dispose() { if (disposed) return; disposed = true; const previous = accepted; accepted = null; if (previous) release(previous.results); requireFact(liveMeshes() === 0 && liveGeometry() === 0 && liveMaterials() === 0 && liveRoots() === 0, 'All captured owned resources must release'); counters.callbacks++; events.push({ type: 'disposed' }); onChange(null); },
  };
  return host;
}
