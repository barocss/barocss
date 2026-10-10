import { DoubleSide } from 'three';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { proveCase, createParentOptions, requireFact, assertNative, assertBuffer, runSourceRefusals, runTransportRefusals } from './multispan-trim-uv-three-fixture.mjs';
import { observeTrimUVThreeResult } from './multispan-trim-uv-three-observer.mjs';
function nativeFields(result, native) { return Object.fromEntries(Object.keys(native).map(key => [key, result[key]])); }
function pose(object) { return { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), visible: object.visible }; }
const clone = value => structuredClone(value);

/** Read-only native UV classification alongside the complete original untrimmed Support Surface. */
export function createMultiSpanTrimUVThreeHost({ scene, onChange = () => {} }) {
  requireFact(scene?.isScene === true, 'Actual caller Scene required');
  let accepted = null, disposed = false, peakLivePairs = 0;
  const records = [], allResources = [], allGroups = [], allocated = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseCalls: 0, loadCalls: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function available() { requireFact(!disposed, 'Classification host disposed'); }
  function remember(result) { allocated.push(result); allGroups.push(result.group); allResources.push(...observeTrimUVThreeResult(result)); peakLivePairs = Math.max(peakLivePairs, livePairs()); events.push({ type: 'prepared', livePairs: livePairs(), pairs: allResources.length }); return result; }
  function parseParent(source, options = createParentOptions()) { const loader = new BaroCADLoader(options); counters.parseCalls++; return remember(loader.parse(source)); }
  async function loadAsync(url, transport = {}) {
    const loader = new BaroCADLoader(createParentOptions()); counters.loadCalls++;
    const actualParse = loader.parse; loader.parse = function (source) { counters.parseCalls++; return remember(actualParse.call(this, source)); };
    try { return await loader.loadAbortable(url, transport); } finally { loader.parse = actualParse; }
  }
  function release(results) { for (const result of results) { result.dispose(); result.dispose(); } }
  function qualifyCandidate(asset, proof, result, state) {
    assertNative(nativeFields(result, proof.native), proof.native, 'complete-original-Support-native'); assertNative(result.model, proof.model);
    requireFact(result.model.objects.length === 8 && result.surfaces.length === 1 && result.curves.length === 0 && result.unrenderedCurveIds.length === 7 && result.group.parent === null && result.group.children.length === 1, 'Complete Model8/one Support/seven unrendered Curves required');
    assertNative(result.unrenderedCurveIds, result.model.objects.filter(object => object.kind === 'curve').map(object => object.id));
    const object = result.group.children[0], surface = proof.native.surfaces[0], geometry = object.geometry, material = object.material;
    requireFact(object.isMesh && object.name === surface.surfaceId && object.parent === result.group && material.isMeshNormalMaterial && material.side === DoubleSide && !material.transparent && material.opacity === 1, 'Original opaque untrimmed Support preview required');
    assertNative(Object.keys(geometry.attributes).sort(), ['_CAD_UV', 'normal', 'position']);
    for (const [name, values, itemSize] of [['position', surface.mesh.positions, 3], ['normal', surface.mesh.normals, 3], ['_CAD_UV', surface.mesh.parameters, 2]]) {
      const attribute = geometry.getAttribute(name); requireFact(attribute.array instanceof Float32Array && attribute.itemSize === itemSize && attribute.count === 153, 'Actual Surface17×9 Float32 attributes required'); assertBuffer(attribute.array, Float32Array.from(values));
    }
    requireFact(geometry.index?.count === 768, 'Original Support256 triangles required'); assertBuffer(geometry.index.array, surface.mesh.indices);
    for (const value of [result.group, object]) { assertNative(value.position.toArray(), [0, 0, 0]); assertNative(value.quaternion.toArray(), [0, 0, 0, 1]); assertNative(value.scale.toArray(), [1, 1, 1]); }
    const resources = allResources.filter(row => row.result === result);
    const readout = clone(proof.readout);
    return { key: asset.key, state, asset, proof, classification: proof.classification, trim: proof.trim, model: proof.model, native: proof.native, result, resources, readout };
  }
  function admit(record) {
    const previous = accepted; scene.add(record.result.group); accepted = record; records.push(record); counters.acceptedResults++; events.push({ type: 'attached', key: record.key, state: record.state });
    if (previous) { release([previous.result]); requireFact(previous.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1), 'Old owned resources must release before callback/render'); events.push({ type: 'old-released', key: previous.key }); }
    counters.callbacks++; events.push({ type: 'change', key: record.key, state: record.state }); onChange(record); return record;
  }
  function capture() {
    available(); requireFact(accepted, 'Accepted complete original classification required');
    return { record: accepted, asset: accepted.asset, proof: accepted.proof, result: accepted.result, readout: accepted.readout,
      cpu: clone({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, native: nativeFields(accepted.result, accepted.native) }), children: [...scene.children],
      targets: accepted.resources.map(row => ({ row, object: row.object, geometry: row.object.geometry, material: row.object.material, pose: pose(row.object),
        arrays: row.attributes.map(attribute => ({ name: attribute.name, attribute: row.geometry.getAttribute(attribute.name), array: row.geometry.getAttribute(attribute.name).array, values: Array.from(row.geometry.getAttribute(attribute.name).array) })),
        index: row.geometry.index, indexArray: row.geometry.index?.array, indices: row.geometry.index ? Array.from(row.geometry.index.array) : null })),
      pairs: allResources.length, groups: allGroups.length, recordCount: records.length, callbacks: counters.callbacks, disposalCounts: allResources.map(row => [row.geometryDisposals, row.materialDisposals]) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.proof === before.proof && accepted.result === before.result && accepted.readout === before.readout, 'Refusal replaced complete classification/native/source references');
    assertNative({ asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, native: nativeFields(accepted.result, accepted.native) }, before.cpu, 'retained-original-classification');
    requireFact(allResources.length === before.pairs && allGroups.length === before.groups && records.length === before.recordCount && counters.callbacks === before.callbacks && scene.children.length === before.children.length && before.children.every((child, index) => scene.children[index] === child), 'Refusal allocated/admitted or changed Scene children');
    for (const item of before.targets) {
      requireFact(item.row.object === item.object && item.object.geometry === item.geometry && item.object.material === item.material && item.geometry.index === item.index && item.geometry.index?.array === item.indexArray, 'Refusal changed actual resource references');
      for (const attribute of item.arrays) { requireFact(item.geometry.getAttribute(attribute.name) === attribute.attribute && attribute.attribute.array === attribute.array, 'Refusal changed actual attribute references'); assertBuffer(attribute.array, attribute.values); }
      if (item.indices) assertBuffer(item.indexArray, item.indices); assertNative(pose(item.object), item.pose);
    }
    assertNative(allResources.map(row => [row.geometryDisposals, row.materialDisposals]), before.disposalCounts);
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get allGroups() { return allGroups; }, get events() { return events; },
    get counts() { return { ...counters, pairs: allResources.length, groups: allGroups.length, livePairs: livePairs(), peakLivePairs, geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0), disposed }; },
    load(asset) { available(); const proof = proveCase(asset), start = allocated.length;
      try { return admit(qualifyCandidate(asset, proof, parseParent(asset.modelSource), 'original')); } catch (error) { if (!accepted || accepted.result !== allocated[start]) release(allocated.slice(start)); throw error; }
    },
    async loadFromUrl(asset, url, transport = {}) {
      available(); requireFact(accepted && accepted.key === asset.key, 'Cold classification family mismatch'); assertNative(asset, accepted.asset, 'fresh-twelve-original-files');
      const proof = proveCase(asset), previous = accepted, start = allocated.length;
      try { const result = await loadAsync(url, transport); requireFact(!disposed && accepted === previous, 'Accepted original changed during cold source load'); return admit(qualifyCandidate(asset, proof, result, 'cold-reopen')); }
      catch (error) { if (!accepted || accepted.result !== allocated[start]) release(allocated.slice(start)); throw error; }
    },
    runRefusals(asset, after = () => {}) { const before = capture(), start = allocated.length;
      try { const result = runSourceRefusals(asset, { parseParent }, receipt => { retained(before); counters.synchronousRefusals++; events.push({ type: 'refused', ...receipt }); after(receipt); }); retained(before); return result; }
      catch (error) { release(allocated.slice(start)); throw error; }
    },
    async runTransportRefusals(url, after = () => {}) { const before = capture(), start = allocated.length;
      try { const result = await runTransportRefusals(url, loadAsync, async receipt => { retained(before); counters.transportRefusals++; events.push({ type: 'transport-refused', ...receipt }); await after(receipt); }); retained(before); return result; }
      catch (error) { release(allocated.slice(start)); throw error; }
    },
    dispose() { if (disposed) return; disposed = true; const previous = accepted; accepted = null; if (previous) release([previous.result]); requireFact(livePairs() === 0, 'All captured Support resources must release'); counters.callbacks++; events.push({ type: 'disposed' }); onChange(null); },
  };
  return host;
}
