import { BaroCADLoader } from '@barocss/cad-interop/three';
import { proveCase, createParentOptions, assertParentTarget, requireFact, assertNative, assertBuffer, runSourceRefusals, runTransportRefusals } from './exact-lower-strip-face-three-fixture.mjs';
import { observeExactLowerStripFaceThreeResult } from './exact-lower-strip-face-three-observer.mjs';
const clone = value => structuredClone(value);
const nativeFields = (result, native) => Object.fromEntries(Object.keys(native).map(key => [key, result[key]]));
const pose = object => ({ position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), visible: object.visible });

/** Retain the exact native Face; display only its complete untrimmed Support. */
export function createExactLowerStripFaceThreeHost({ scene, onChange = () => {} }) {
  requireFact(scene?.isScene === true, 'Actual caller Scene required');
  let accepted = null, disposed = false, peakLivePairs = 0;
  const records = [], allResources = [], allGroups = [], allocated = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseCalls: 0, loadCalls: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function available() { requireFact(!disposed, 'Exact Face host disposed'); }
  function remember(result) {
    allocated.push(result); allGroups.push(result.group); allResources.push(...observeExactLowerStripFaceThreeResult(result));
    peakLivePairs = Math.max(peakLivePairs, livePairs()); events.push({ type: 'prepared', pairs: allResources.length, livePairs: livePairs() }); return result;
  }
  function parseParent(source, options = createParentOptions()) { const loader = new BaroCADLoader(options); counters.parseCalls++; return remember(loader.parse(source)); }
  async function loadAsync(url, transport = {}) {
    const loader = new BaroCADLoader(createParentOptions()), originalParse = loader.parse; counters.loadCalls++;
    loader.parse = function (source) { counters.parseCalls++; return remember(originalParse.call(this, source)); };
    try { return await loader.loadAbortable(url, transport); } finally { loader.parse = originalParse; }
  }
  function release(results) { for (const result of results) { result.dispose(); result.dispose(); } }
  function qualify(asset, proof, result, state) {
    assertParentTarget(proof.native, result);
    const resources = allResources.filter(row => row.result === result);
    requireFact(resources.length === 1 && result.model.objects.length === 5 && result.unrenderedCurveIds.length === 4, 'Whole Model5/Support1/four unrendered boundary Curves required');
    return { key: asset.key, state, asset, proof, wall: proof.wall, model: proof.model, native: proof.native, result, resources, readout: clone(proof.readout) };
  }
  function admit(record) {
    const previous = accepted; scene.add(record.result.group); accepted = record; records.push(record); counters.acceptedResults++;
    events.push({ type: 'attached', key: record.key, state: record.state });
    if (previous) {
      release([previous.result]);
      requireFact(previous.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1) && previous.result.group.parent === null && previous.result.group.children.length === 0, 'Old owned Support must release before callback/render');
      events.push({ type: 'old-released', key: previous.key });
    }
    counters.callbacks++; events.push({ type: 'change', key: record.key, state: record.state }); onChange(record); return record;
  }
  function capture() {
    available(); requireFact(accepted, 'Accepted complete original Face required');
    return { record: accepted, asset: accepted.asset, proof: accepted.proof, result: accepted.result, native: accepted.native, readout: accepted.readout,
      cpu: clone({ asset: accepted.asset, proof: accepted.proof, native: nativeFields(accepted.result, accepted.native), readout: accepted.readout }), children: [...scene.children],
      group: accepted.result.group, groupChildren: [...accepted.result.group.children], groupPose: pose(accepted.result.group),
      resources: accepted.resources.map(row => ({ row, object: row.object, geometry: row.geometry, material: row.material, pose: pose(row.object),
        attributes: row.attributes.map(value => ({ name: value.name, attribute: value.attribute, array: value.array, values: Array.from(value.array) })),
        index: row.indexAttribute, indexArray: row.indexArray, indices: Array.from(row.indexArray) })),
      pairs: allResources.length, groups: allGroups.length, records: records.length, callbacks: counters.callbacks, disposals: allResources.map(row => [row.geometryDisposals, row.materialDisposals]) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.proof === before.proof && accepted.result === before.result && accepted.native === before.native && accepted.readout === before.readout, 'Refusal changed accepted source/Face/native references');
    assertNative({ asset: accepted.asset, proof: accepted.proof, native: nativeFields(accepted.result, accepted.native), readout: accepted.readout }, before.cpu);
    requireFact(scene.children.length === before.children.length && before.children.every((child, index) => scene.children[index] === child) && accepted.result.group === before.group && before.group.children.length === before.groupChildren.length && before.groupChildren.every((object, index) => before.group.children[index] === object), 'Refusal changed Scene/group children');
    assertNative(pose(before.group), before.groupPose);
    requireFact(allResources.length === before.pairs && allGroups.length === before.groups && records.length === before.records && counters.callbacks === before.callbacks, 'Refusal allocated/admitted or invoked callback');
    for (const item of before.resources) {
      requireFact(item.row.object === item.object && item.object.geometry === item.geometry && item.object.material === item.material && item.geometry.index === item.index && item.geometry.index.array === item.indexArray, 'Refusal changed actual resource references');
      for (const value of item.attributes) { requireFact(item.geometry.getAttribute(value.name) === value.attribute && value.attribute.array === value.array, 'Refusal changed attribute references'); assertBuffer(value.array, value.values); }
      assertBuffer(item.indexArray, item.indices); assertNative(pose(item.object), item.pose);
    }
    assertNative(allResources.map(row => [row.geometryDisposals, row.materialDisposals]), before.disposals);
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get allGroups() { return allGroups; }, get events() { return events; },
    get counts() { return { ...counters, pairs: allResources.length, groups: allGroups.length, livePairs: livePairs(), peakLivePairs, geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0), disposed }; },
    load(asset) { available(); const proof = proveCase(asset), start = allocated.length;
      try { return admit(qualify(asset, proof, parseParent(asset.modelSource), 'original')); } catch (error) { if (!accepted || accepted.result !== allocated[start]) release(allocated.slice(start)); throw error; }
    },
    async loadFromUrl(asset, url, transport = {}) {
      available(); requireFact(accepted && accepted.key === asset.key, 'Cold Face family mismatch'); assertNative(asset, accepted.asset, 'fresh-eleven-original-files');
      const proof = proveCase(asset), previous = accepted, start = allocated.length;
      try { const result = await loadAsync(url, transport); requireFact(!disposed && accepted === previous, 'Accepted original changed during cold source load'); return admit(qualify(asset, proof, result, 'cold-reopen')); }
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
