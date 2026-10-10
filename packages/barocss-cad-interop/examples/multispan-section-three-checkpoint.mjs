import { DoubleSide } from 'three';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { BaroCADUniformCurveLoader } from '@barocss/cad-interop/three-uniform-curve';
import { proveCase, createWorldOptions, createParentOptions, assertNative, assertBuffer, requireFact,
  runSectionSourceRefusals, runSectionTransportRefusals } from './multispan-section-three-fixture.mjs';
import { observeMultiSpanSectionThreeResult } from './multispan-section-three-observer.mjs';

function pose(object) { return { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(),
  matrix: object.matrix.toArray(), matrixWorld: object.matrixWorld.toArray(), visible: object.visible, renderOrder: object.renderOrder,
  projection: object.projectionMatrix?.toArray() ?? null, inverseProjection: object.projectionMatrixInverse?.toArray() ?? null }; }
const clone = value => structuredClone(value);
const materialState = material => ({ type: material.type, side: material.side, transparent: material.transparent, opacity: material.opacity, depthTest: material.depthTest, depthWrite: material.depthWrite, color: material.color?.getHex() ?? null });

/** Complete original source transaction; the Scene and its existing caller objects stay caller-owned. */
export function createMultiSpanSectionThreeHost({ scene, onChange = () => {} }) {
  requireFact(scene?.isScene === true, 'An actual caller Three Scene is required');
  let accepted = null, disposed = false, peakLivePairs = 0;
  const records = [], allResources = [], allGroups = [], allocatedResults = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseWorldCalls: 0, parseParentCalls: 0, loadWorldCalls: 0, loadParentCalls: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function available() { requireFact(!disposed, 'The original section host was disposed'); }
  function remember(result, role) {
    allocatedResults.push(result); allGroups.push(result.group);
    const resources = observeMultiSpanSectionThreeResult(result, role); allResources.push(...resources);
    peakLivePairs = Math.max(peakLivePairs, livePairs()); events.push({ type: 'prepared', role, groupUuid: result.group.uuid, pairs: resources.length, livePairs: livePairs() });
    return result;
  }
  function parseWorld(source, options = createWorldOptions()) {
    const loader = new BaroCADUniformCurveLoader(options); counters.parseWorldCalls++; return remember(loader.parse(source), 'world');
  }
  function parseParent(source, options = createParentOptions(), role = 'parent') {
    const loader = new BaroCADLoader(options); counters.parseParentCalls++; return remember(loader.parse(source), role);
  }
  async function loadWorld(url, transport = {}) {
    const loader = new BaroCADUniformCurveLoader(createWorldOptions()); counters.loadWorldCalls++;
    return remember(await loader.loadAsync(url, transport), 'world');
  }
  async function loadParent(url, role, transport = {}) {
    const loader = new BaroCADLoader(createParentOptions()); counters.loadParentCalls++;
    return remember(await loader.loadAbortable(url, transport), role);
  }
  function release(results) { for (const result of results) { result.dispose(); result.dispose(); } }
  function identity(object) { assertNative(object.position.toArray(), [0, 0, 0]); assertNative(object.quaternion.toArray(), [0, 0, 0, 1]); assertNative(object.scale.toArray(), [1, 1, 1]); }
  function verifyWorld(result, native) {
    for (const key of Object.keys(native)) assertNative(result[key], native[key], 'complete-world-native.' + key);
    requireFact(result.group.parent === null && result.group.children.length === 1 && result.group.children[0] === result.line && result.line.parent === result.group && result.line.isLine, 'Detached actual original World Line required');
    const geometry = result.line.geometry, attribute = geometry.getAttribute('position');
    requireFact(Object.keys(geometry.attributes).length === 1 && attribute.count === 129 && attribute.itemSize === 3 && attribute.array instanceof Float32Array && attribute.array === result.positions && attribute.array !== native.positions && geometry.index === null, 'World attribute must share only its own actual result F32 positions');
    assertBuffer(attribute.array, native.positions); requireFact(result.line.material.isLineBasicMaterial && result.line.material.color.getHex() === 0x28c9eb, 'Existing cyan World material required');
    identity(result.group); identity(result.line);
  }
  function verifyParent(result, native) {
    for (const key of Object.keys(native)) assertNative(result[key], native[key], 'complete-parent-native.' + key);
    requireFact(result.group.parent === null && result.group.children.length === native.surfaces.length && native.curves.length === 0, 'Complete parent Surface-only group required');
    assertNative(result.unrenderedCurveIds, native.model.objects.filter(object => object.kind === 'curve').map(object => object.id)); identity(result.group);
    for (const [index, object] of result.group.children.entries()) {
      const surface = native.surfaces[index], actualSurface = result.surfaces[index], geometry = object.geometry;
      requireFact(object.isMesh && object.name === surface.surfaceId && object.parent === result.group && object.material.isMeshNormalMaterial && object.material.side === DoubleSide, 'Original qualified Surface Mesh/normal material required');
      assertNative(Object.keys(geometry.attributes).sort(), ['_CAD_UV', 'normal', 'position']);
      for (const [name, values, itemSize] of [['position', surface.mesh.positions, 3], ['normal', surface.mesh.normals, 3], ['_CAD_UV', surface.mesh.parameters, 2]]) {
        const attribute = geometry.getAttribute(name);
        requireFact(attribute.array instanceof Float32Array && attribute.itemSize === itemSize && attribute.count === 153 && attribute.array !== actualSurface.mesh[name === 'position' ? 'positions' : name === 'normal' ? 'normals' : 'parameters'], 'Actual Surface Float32BufferAttribute copy required');
        assertBuffer(attribute.array, Float32Array.from(values));
      }
      requireFact(geometry.index && geometry.index.count === 768, 'Original 256-triangle Surface grid required'); assertBuffer(geometry.index.array, surface.mesh.indices); identity(object);
    }
  }
  function stage(asset, proof, results, state) {
    const [worldResult, ...parentResults] = results;
    verifyWorld(worldResult, proof.nativeWorld); parentResults.forEach((result, index) => verifyParent(result, proof.nativeParents[index]));
    requireFact(worldResult.source === asset.worldSource, 'World target must retain the complete original source');
    // Frozen caller display policy changes only renderer materials, never native source or coefficients.
    worldResult.line.material.depthTest = false; worldResult.line.renderOrder = 10;
    for (const result of parentResults) for (const mesh of result.group.children) { mesh.material.transparent = true; mesh.material.opacity = 0.32; mesh.material.depthWrite = false; }
    const resources = allResources.filter(row => results.includes(row.result)), groups = results.map(result => result.group);
    const readout = clone({ assetKey: asset.key, request: asset.request, section: proof.section, report: proof.report, originalModels: proof.originalModels,
      worldSource: asset.worldSource, parentSources: asset.parentSources, dualUV: asset.dualUV, worldNative: proof.nativeWorld, parentNatives: proof.nativeParents,
      derivativeCounts: proof.derivativeCounts, display: { worldOptions: createWorldOptions(), parentOptions: createParentOptions(), worldQuality: proof.nativeWorld.quality,
        parentQualities: proof.nativeParents.map(result => result.quality ?? null), uniformChords: true, nativeUVIsTextureUV: false, triangleNormalsAreApproximate: true, adaptiveCertificate: false } });
    return { assetKey: asset.key, state, asset, proof, worldNative: proof.nativeWorld, parentNatives: proof.nativeParents, worldResult, parentResults, results, resources, groups, readout };
  }
  function admit(record) {
    const previous = accepted;
    for (const group of record.groups) scene.add(group);
    accepted = record; records.push(record); counters.acceptedResults++;
    events.push({ type: 'mounted', assetKey: record.assetKey, state: record.state, groups: record.groups.map(group => group.uuid) });
    if (previous) {
      release(previous.results); requireFact(previous.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1), 'Previous geometry/material must be released before caller render');
      events.push({ type: 'old-released', assetKey: previous.assetKey });
    }
    counters.callbacks++; events.push({ type: 'change', assetKey: record.assetKey, state: record.state, livePairs: livePairs() }); onChange(record); return record;
  }
  function capture() {
    available(); requireFact(accepted, 'Accepted original complete section required');
    const objects = []; scene.traverse(object => objects.push({ object, parent: object.parent, children: [...object.children], pose: pose(object) }));
    return { record: accepted, asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, results: accepted.results, groups: accepted.groups, resources: accepted.resources,
      cpu: clone({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout }), callbacks: counters.callbacks, records: records.length, pairs: allResources.length, groupCount: allGroups.length,
      rows: accepted.resources.map(row => ({ row, object: row.object, geometry: row.object.geometry, material: row.object.material, materialState: materialState(row.object.material),
        attributes: row.attributes.map(attribute => ({ name: attribute.name, attribute: row.geometry.getAttribute(attribute.name), array: row.geometry.getAttribute(attribute.name).array, values: Array.from(row.geometry.getAttribute(attribute.name).array) })),
        index: row.geometry.index, indexArray: row.geometry.index?.array ?? null, indices: row.geometry.index ? Array.from(row.geometry.index.array) : null })),
      disposalCounts: allResources.map(row => [row.geometryDisposals, row.materialDisposals]), objects };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.proof === before.proof && accepted.readout === before.readout && accepted.results === before.results && accepted.groups === before.groups && accepted.resources === before.resources,
      'Refusal changed complete original section/native/readout/result identity');
    assertNative({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout }, before.cpu, 'retained-complete-original-data');
    requireFact(counters.callbacks === before.callbacks && records.length === before.records && allResources.length === before.pairs && allGroups.length === before.groupCount, 'Refusal allocated or admitted a target');
    assertNative(allResources.map(row => [row.geometryDisposals, row.materialDisposals]), before.disposalCounts, 'retained-resource-events');
    for (const item of before.rows) {
      requireFact(item.object === item.row.object && item.object.geometry === item.geometry && item.object.material === item.material && item.geometry.index === item.index && (item.geometry.index?.array ?? null) === item.indexArray, 'Refusal changed actual child resource references');
      assertNative(materialState(item.material), item.materialState, 'retained-display-material');
      for (const attribute of item.attributes) { requireFact(item.geometry.getAttribute(attribute.name) === attribute.attribute && attribute.attribute.array === attribute.array, 'Refusal changed actual attribute references'); assertBuffer(attribute.array, attribute.values); }
      if (item.indices) assertBuffer(item.indexArray, item.indices);
    }
    const objects = []; scene.traverse(object => objects.push(object)); requireFact(objects.length === before.objects.length, 'Refusal changed caller Scene descendants');
    for (const [index, item] of before.objects.entries()) {
      requireFact(objects[index] === item.object && item.object.parent === item.parent && item.object.children.length === item.children.length && item.children.every((child, i) => item.object.children[i] === child), 'Refusal changed Scene child order'); assertNative(pose(item.object), item.pose, 'retained-caller-pose');
    }
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get allGroups() { return allGroups; }, get events() { return events; },
    get counts() { return { ...counters, pairs: allResources.length, groups: allGroups.length, livePairs: livePairs(), peakLivePairs, disposed,
      geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0) }; },
    load(asset) {
      available(); const proof = proveCase(asset), start = allocatedResults.length;
      try { return admit(stage(asset, proof, [parseWorld(asset.worldSource), parseParent(asset.parentSources[0], createParentOptions(), 'surface'), parseParent(asset.parentSources[1], createParentOptions(), 'plane')], 'original')); }
      catch (error) { if (!accepted || accepted.results[0] !== allocatedResults[start]) release(allocatedResults.slice(start)); throw error; }
    },
    async coldReopen(asset, urls, transport = {}) {
      available(); requireFact(accepted && asset.key === accepted.assetKey, 'Cold reopen must retain the accepted original family'); assertNative(asset, accepted.asset, 'fresh-seven-original-files');
      const proof = proveCase(asset), previous = accepted, start = allocatedResults.length;
      try {
        // Each call uses the actual public bounded loader. These are three source requests, not one compilation claim.
        const world = await loadWorld(urls.world, transport), surface = await loadParent(urls.surface, 'surface', transport), plane = await loadParent(urls.plane, 'plane', transport);
        requireFact(!disposed && accepted === previous, 'Accepted original changed during cold reopen');
        return admit(stage(asset, proof, [world, surface, plane], 'cold-reopen'));
      } catch (error) { if (!accepted || accepted.results[0] !== allocatedResults[start]) release(allocatedResults.slice(start)); throw error; }
    },
    runRefusals(asset, afterRefusal = () => {}) {
      const before = capture(), start = allocatedResults.length;
      try {
        const result = runSectionSourceRefusals(asset, { parseWorld, parseParent }, receipt => {
          retained(before); counters.synchronousRefusals++; events.push({ type: 'refused', ...receipt }); afterRefusal({ ...receipt, pairsBefore: before.pairs, pairsAfter: allResources.length });
        }); retained(before); return result;
      } catch (error) { release(allocatedResults.slice(start)); throw error; }
    },
    async runTransportRefusals(url, afterRefusal = () => {}) {
      const before = capture(), start = allocatedResults.length;
      try {
        const result = await runSectionTransportRefusals(url, loadWorld, async receipt => {
          retained(before); counters.transportRefusals++; events.push({ type: 'transport-refused', ...receipt }); await afterRefusal({ ...receipt, pairsBefore: before.pairs, pairsAfter: allResources.length });
        }); retained(before); return result;
      } catch (error) { release(allocatedResults.slice(start)); throw error; }
    },
    dispose() {
      if (disposed) return; disposed = true; const previous = accepted; accepted = null;
      if (previous) release(previous.results);
      requireFact(livePairs() === 0, 'All captured geometry/material pairs must be released'); counters.callbacks++; events.push({ type: 'disposed', livePairs: livePairs() }); onChange(null);
    },
  };
  return host;
}
