import { createSnapshot } from './snapshot.mjs';
import { geometryKey } from './groups.mjs';
import { createSnapshot as createOriginalSnapshot } from '../physics-capsule-sweep-reference/snapshot.mjs';
import { sweepBox } from '../physics-capsule-sweep-reference/sweep.mjs';
import { CASES } from '../physics-capsule-sweep-reference/fixture.mjs';
import { packInputs, packOutputs } from '../physics-capsule-sweep-reference/campaign.mjs';
import { encodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';

function assert(condition, message) { if (!condition) throw new Error(message); }
function sameBits(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Reflect.ownKeys(a), keysB = Reflect.ownKeys(b);
  return keysA.length === keysB.length && keysA.every(key => keysB.includes(key) && sameBits(a[key], b[key]));
}
function outcome(snapshot, query, callback) {
  try { return { hit: snapshot.query(query, callback), error: null }; }
  catch (error) { return { hit: null, error: { code: error.code ?? 'UNEXPECTED', name: error.name,
    message: error.message, string: String(error) } }; }
}
function bytesEqual(a, b) { return a.length === b.length && a.every((value, i) => value === b[i]); }

/** Synchronous plain ESM controls, also runnable in the browser. No timers or Node modules. */
export function runControls() {
  const records = [], workCounts = [], originalObservations = [], groupedObservations = [];
  let getterCount = 0;
  function refuses(name, action, code) {
    let caught; try { action(); } catch (error) { caught = error; }
    assert(caught?.code === code, `${name} expected ${code}`);
    records.push({ name, code: caught.code, message: caught.message });
  }
  function compareScene(name, scene, query) {
    const original = createOriginalSnapshot(scene), grouped = createSnapshot(scene);
    const before = grouped.getSnapshot();
    const first = outcome(grouped, query), expected = outcome(original, query);
    assert(sameBits(first, expected), `${name} must match original result/error bits`);
    assert(sameBits(outcome(grouped, query), first), `${name} must exactly repeat`);
    assert(sameBits(grouped.getSnapshot(), before), `${name} scene retained`);
    original.dispose(); grouped.dispose();
    return first;
  }
  for (const fixture of CASES) {
    const scene = structuredClone(fixture.scene), query = structuredClone(fixture.query);
    const sceneBefore = structuredClone(scene), queryBefore = structuredClone(query);
    const original = createOriginalSnapshot(scene), grouped = createSnapshot(scene), before = grouped.getSnapshot();
    const expected = outcome(original, query), first = outcome(grouped, query);
    assert(sameBits(first, expected), `${fixture.name} original complete output/error bits`);
    assert(sameBits(outcome(grouped, query), first), `${fixture.name} repeat output/error bits`);
    assert(sameBits(grouped.getSnapshot(), before) && sameBits(scene, sceneBefore) && sameBits(query, queryBefore), `${fixture.name} input/state retention`);
    originalObservations.push({ ...fixture, ...expected }); groupedObservations.push({ ...fixture, ...first });
    original.dispose(); grouped.dispose();
  }
  const originalInputs = encodeF64(packInputs(originalObservations)), groupedInputs = encodeF64(packInputs(groupedObservations));
  const originalOutputs = encodeF64(packOutputs(originalObservations)), groupedOutputs = encodeF64(packOutputs(groupedObservations));
  assert(bytesEqual(originalInputs, groupedInputs) && bytesEqual(originalOutputs, groupedOutputs), 'Original explicitLE input/output bytes must match');
  assert(groupedInputs.byteLength === 5552 && groupedOutputs.byteLength === 1496, 'Immutable baseline payload lengths5552/1496');

  const wallFixture = CASES.find(fixture => fixture.name === 'WALL'), source = structuredClone(wallFixture.scene);
  const snapshot = createSnapshot(source), before = snapshot.getSnapshot(), diagnosticsBefore = snapshot.getDiagnostics();
  source.boxes[0].centerM[0] = 4; source.revision = 'mutated';
  assert(sameBits(snapshot.getSnapshot(), before), 'Source data must be copied');
  const copy = snapshot.getSnapshot(); copy.boxes[0].halfExtentsM[0] = 3; copy.boxes[0].id = 'changed';
  assert(sameBits(snapshot.getSnapshot(), before), 'getSnapshot must return original independent data');
  const diagnostics = snapshot.getDiagnostics(); diagnostics.memberIDs[0].fill('changed'); diagnostics.sourceCount = -1;
  assert(sameBits(snapshot.getDiagnostics(), diagnosticsBefore), 'Diagnostics must be copied');
  const hit = snapshot.query(wallFixture.query); hit.normalM.fill(9); hit.pointM.fill(9); hit.segmentM.fill(9);
  assert(snapshot.query(wallFixture.query).normalM[0] === -1, 'Output witness tuples must be copied');
  for (const [name, query, code] of [
    ['stale', { ...wallFixture.query, revision: 'stale' }, 'STALE_SCENE'],
    ['unknown-exclude', { ...wallFixture.query, excludeId: 'missing' }, 'INVALID_INPUT'],
    ['nan', { ...wallFixture.query, centerM: [Number.NaN, 0, 0] }, 'INVALID_INPUT'],
    ['extra-query', { ...wallFixture.query, dt: 1 }, 'INVALID_INPUT'],
    ['tuple-count', { ...wallFixture.query, centerM: [0, 0] }, 'INVALID_INPUT'],
    ['displacement-bound', { ...wallFixture.query, displacementM: [2, 1, 0] }, 'INVALID_INPUT'],
  ]) {
    refuses(name, () => snapshot.query(query), code);
    assert(sameBits(snapshot.getSnapshot(), before), `${name} complete scene retention`);
  }
  const accessor = { ...wallFixture.query };
  Object.defineProperty(accessor, 'centerM', { enumerable: true, get() { getterCount++; return [0, 0, 0]; } });
  refuses('query-accessor', () => snapshot.query(accessor), 'INVALID_INPUT');
  assert(getterCount === 0, 'Admission must not invoke the accessor');
  const originalBox = wallFixture.scene.boxes[0];
  const badScenes = [
    ['cap33', { revision: 'sweepRef1', boxes: Array.from({ length: 33 }, (_, i) => ({ ...structuredClone(originalBox), id: `box${i}` })) }],
    ['duplicate-id', { revision: 'sweepRef1', boxes: [originalBox, originalBox] }],
    ['bad-extent', { revision: 'sweepRef1', boxes: [{ ...originalBox, halfExtentsM: [0, 1, 1] }] }],
    ['bad-quaternion', { revision: 'sweepRef1', boxes: [{ ...originalBox, orientationXYZW: [0, 0, 0, 2] }] }],
    ['extra-scene', { ...wallFixture.scene, gravity: 0 }],
    ['sparse-scene', { revision: 'sweepRef1', boxes: new Array(1) }],
  ];
  for (const [name, scene] of badScenes) refuses(name, () => createSnapshot(scene), 'INVALID_INPUT');
  const accessorBoxes = [originalBox];
  Object.defineProperty(accessorBoxes, '0', { enumerable: true, get() { getterCount++; return originalBox; } });
  refuses('box-list-accessor', () => createSnapshot({ revision: 'sweepRef1', boxes: accessorBoxes }), 'INVALID_INPUT');
  assert(getterCount === 0, 'Box-list accessor must not run');

  const grazing = CASES.find(fixture => fixture.name === 'STEP_GRAZE');
  const duplicates = CASES.find(fixture => fixture.name === 'CAP32_GRAZE');
  const duplicateWorld = createSnapshot(duplicates.scene);
  assert(duplicateWorld.getDiagnostics().sourceCount === 32 && duplicateWorld.getDiagnostics().groupCount === 1, 'All32 original IDs remain in one exact geometry group');
  let calls = 0;
  duplicateWorld.query(duplicates.query, diagnostic => { calls++; diagnostic.memberIDs.fill('changed'); });
  assert(calls === 1 && duplicateWorld.getDiagnostics().memberIDs[0].length === 32, '32identical shapes require exactly one actual scalar sweep');
  workCounts.push({ name: '32-identical', sourceCount: 32, groupCount: 1, actualSweeps: calls }); duplicateWorld.dispose();
  const distinctBoxes = duplicates.scene.boxes.map((box, i) => ({ ...structuredClone(box), halfExtentsM: [0.25 + i * 0.0001, 0.05, 0.75] }));
  const distinctScene = { revision: 'sweepRef1', boxes: distinctBoxes }, distinct = createSnapshot(distinctScene);
  calls = 0; const distinctResult = outcome(distinct, duplicates.query, () => { calls++; });
  const distinctOriginal = createOriginalSnapshot(distinctScene);
  assert(sameBits(distinctResult, outcome(distinctOriginal, duplicates.query)), 'Distinct geometry preserves original results');
  assert(calls === 32 && distinct.getDiagnostics().groupCount === 32, '32distinct shapes require32actual sweeps');
  workCounts.push({ name: '32-distinct', sourceCount: 32, groupCount: 32, actualSweeps: calls }); distinct.dispose(); distinctOriginal.dispose();
  calls = 0;
  assert(snapshot.query({ ...wallFixture.query, excludeId: originalBox.id }, () => { calls++; }) === null && calls === 0, 'Excluded singleton must perform no scalar sweep');
  workCounts.push({ name: 'excluded-singleton', sourceCount: 1, groupCount: 1, actualSweeps: calls });
  refuses('diagnostic-cap1', () => sweepBox(grazing.query.centerM, grazing.query.displacementM, grazing.scene.boxes[0], 1), 'ITERATION_LIMIT');

  const identical = [ { ...structuredClone(originalBox), id: 'wall-a' }, { ...structuredClone(originalBox), id: 'wall-z' } ];
  const excluded = compareScene('excluded-representative', { revision: 'sweepRef1', boxes: identical }, { ...wallFixture.query, excludeId: 'wall-a' });
  assert(excluded.hit.bodyId === 'wall-z', 'Excluded representative must never be returned');
  assert(compareScene('excluded-tied-id', { revision: 'sweepRef1', boxes: identical.toReversed() },
    { ...wallFixture.query, excludeId: 'wall-z' }).hit.bodyId === 'wall-a', 'Eligible tied ID must remain');
  const tied = [['z-first', 0.5], ['m-tied', 0.5 + 1.6e-9], ['a-too-late', 0.5 + 3.2e-9]]
    .map(([id, x]) => ({ ...structuredClone(originalBox), id, centerM: [x, 0.6, 0] }));
  for (const boxes of [tied, tied.toReversed(), [tied[1], tied[2], tied[0]]]) {
    assert(compareScene('global-minimum-near-tie', { revision: 'sweepRef1', boxes }, wallFixture.query).hit.bodyId === 'm-tied', 'Tie window must use global minimum');
  }
  const touching = CASES.find(fixture => fixture.name === 'TOUCH_ZERO');
  const overlapBoxes = [{ ...structuredClone(originalBox), id: 'touch' },
    { ...structuredClone(originalBox), id: 'inside', centerM: [0.3, 0.6, 0] }];
  assert(compareScene('hit0-plus-overlap', { revision: 'sweepRef1', boxes: overlapBoxes }, touching.query).error.code === 'INITIAL_OVERLAP', 'Hit0 must not skip a later overlap');
  for (const boxes of [
    [{ ...structuredClone(originalBox), id: 'one', centerM: [0.3, 0.6, 0] }, { ...structuredClone(originalBox), id: 'two', centerM: [0.31, 0.6, 0] }],
    [{ ...structuredClone(originalBox), id: 'one', centerM: [0.3, 0.6, 0] }, { ...structuredClone(originalBox), id: 'two', centerM: [0.3, 0.6, 0] }],
  ]) assert(compareScene('all-overlap', { revision: 'sweepRef1', boxes }, touching.query).error.code === 'INITIAL_OVERLAP', 'Unique and duplicate overlap match original');

  const plusZero = { ...structuredClone(originalBox), id: 'positive-zero' }, minusZero = { ...structuredClone(originalBox), id: 'negative-zero' };
  minusZero.centerM[2] = -0;
  assert(geometryKey(plusZero).length === 160 && geometryKey(plusZero) !== geometryKey(minusZero), 'Signed-zero original bits must yield different80-byte keys');
  const zeroWorld = createSnapshot({ revision: 'sweepRef1', boxes: [plusZero, minusZero] });
  assert(zeroWorld.getDiagnostics().groupCount === 2 && Object.is(zeroWorld.getSnapshot().boxes[1].centerM[2], -0), 'Signed-zero groups and source bits retained');
  zeroWorld.dispose();
  const angle = Math.PI / 7, scale = 1 + 5e-13;
  const unit = { ...structuredClone(originalBox), id: 'unit', orientationXYZW: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] };
  const nearUnit = { ...structuredClone(originalBox), id: 'near-unit', orientationXYZW: unit.orientationXYZW.map(value => value * scale) };
  assert(geometryKey(unit) !== geometryKey(nearUnit), 'Different original near-unit quaternion keys must not normalize together');
  const nearWorld = createSnapshot({ revision: 'sweepRef1', boxes: [unit, nearUnit] });
  assert(nearWorld.getDiagnostics().groupCount === 2 && sameBits(nearWorld.getSnapshot().boxes[1].orientationXYZW, nearUnit.orientationXYZW), 'Near-unit original bits/groups preserved'); nearWorld.dispose();
  const nextScene = { revision: 'sweepRef2', boxes: [{ ...structuredClone(originalBox), centerM: [0.8, 0.6, 0] }] };
  compareScene('new-revision-independent-geometry', nextScene, { ...wallFixture.query, revision: 'sweepRef2' });
  refuses('old-revision-not-reused', () => snapshot.query({ ...wallFixture.query, revision: 'sweepRef2' }), 'STALE_SCENE');
  assert(sameBits(snapshot.getSnapshot(), before) && sameBits(snapshot.getDiagnostics(), diagnosticsBefore), 'Complete original scene/diagnostics retained');
  snapshot.dispose(); snapshot.dispose();
  refuses('disposed-query', () => snapshot.query(wallFixture.query), 'DISPOSED');
  refuses('disposed-snapshot', () => snapshot.getSnapshot(), 'DISPOSED');
  refuses('disposed-diagnostics', () => snapshot.getDiagnostics(), 'DISPOSED');
  return { passed: true, originalCaseCount: CASES.length, acceptedCases: groupedObservations.filter(value => !value.error).length,
    refusedCases: groupedObservations.filter(value => value.error).length, completeOriginalOutputErrorBits: true,
    inputByteCount: groupedInputs.byteLength, outputByteCount: groupedOutputs.byteLength,
    combinedByteCount: groupedInputs.byteLength + groupedOutputs.byteLength, explicitLEInputOutputBytesEqual: true,
    originalInputsSnapshotsOutputsDiagnosticsCopied: true, allSourceIDsRetained: true, exactKeysIncludeSignedZeroAndOriginalQuaternion: true,
    completeSceneRetention: true, globalMinimumTiePermutations: true, getterCount, records, refusals: records.length,
    workCounts, serializedGeometryKeyBytesPerGroup: 80, timingMeasured: false };
}
