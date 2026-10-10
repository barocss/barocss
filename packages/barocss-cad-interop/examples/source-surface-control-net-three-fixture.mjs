import { compileCadModel, editSourceSurfaceControlNet, validateSourceSurfaceControlNetEdit, evaluateSurface, evaluateSurfaceD1, surfaceDomain } from '@barocss/cad';

export const CASE_KEYS = Object.freeze(['mixed_weighted', 'signed_zero_only', 'no_op_original_spelling', 'maximum_64_scalar_patches', 'cold_candidate_reedit']);
export const PINS = Object.freeze([
  {
    "file": "mixed_weighted.complete-original.source0.css",
    "bytes": 1108,
    "sha256": "e7397377b5cfa86bf073ea92d280b0a36998923f99814954e04123507f860efe"
  },
  {
    "file": "mixed_weighted.complete-candidate.source0.css",
    "bytes": 1109,
    "sha256": "e4b5057b8227e4e374ae9372b9baeb2a853b86627e9794130751090531e6a658"
  },
  {
    "file": "mixed_weighted.authored-request.json",
    "bytes": 1350,
    "sha256": "61ca11e5afd4cb6ffe6520f3049bc9ba4f4a6d0cd9c16e485e00afddc829119d"
  },
  {
    "file": "mixed_weighted.owned-edit.json",
    "bytes": 9787,
    "sha256": "1049036672cbf5fda02a3eef3307cdc9478c2edb59a3a12e488f5122e74b585e"
  },
  {
    "file": "mixed_weighted.independent-native-observations.json",
    "bytes": 4788,
    "sha256": "48f8db7f23939ea78fa89b7a1d45cb480dedd7f2fe29693cf032268bfe7aee5d"
  },
  {
    "file": "signed_zero_only.complete-original.source0.css",
    "bytes": 1108,
    "sha256": "e7397377b5cfa86bf073ea92d280b0a36998923f99814954e04123507f860efe"
  },
  {
    "file": "signed_zero_only.complete-candidate.source0.css",
    "bytes": 1105,
    "sha256": "6cb47248da280005ce21da498d900add84d468ab4bcd7d975c0796950925f5fe"
  },
  {
    "file": "signed_zero_only.authored-request.json",
    "bytes": 1242,
    "sha256": "b11e904ef1dedf61a023ad8f8839add34f0cad1e6430f8ac9099b1cfb51b484e"
  },
  {
    "file": "signed_zero_only.owned-edit.json",
    "bytes": 8538,
    "sha256": "5b77c2d485faa433b6d2844f2721164d32b0ed7936093721f73cc2ff499144fe"
  },
  {
    "file": "signed_zero_only.independent-native-observations.json",
    "bytes": 4597,
    "sha256": "cec73a596ffb7e8ef3102613e7909465216cf7d5c6a081d41a16347e94938903"
  },
  {
    "file": "no_op_original_spelling.complete-original.source0.css",
    "bytes": 1108,
    "sha256": "e7397377b5cfa86bf073ea92d280b0a36998923f99814954e04123507f860efe"
  },
  {
    "file": "no_op_original_spelling.complete-candidate.source0.css",
    "bytes": 1108,
    "sha256": "e7397377b5cfa86bf073ea92d280b0a36998923f99814954e04123507f860efe"
  },
  {
    "file": "no_op_original_spelling.authored-request.json",
    "bytes": 1252,
    "sha256": "a8b3ac91e6e6d70d3a5dedd30787d7b2a56d1de7ea5971d4d62daecd06e845dd"
  },
  {
    "file": "no_op_original_spelling.owned-edit.json",
    "bytes": 8434,
    "sha256": "a00d224d018cd61e92a7f962f768b678e3557b766e8ed6cc2564ff4a0098af5e"
  },
  {
    "file": "no_op_original_spelling.independent-native-observations.json",
    "bytes": 4597,
    "sha256": "cec73a596ffb7e8ef3102613e7909465216cf7d5c6a081d41a16347e94938903"
  },
  {
    "file": "maximum_64_scalar_patches.complete-original.source0.css",
    "bytes": 368,
    "sha256": "a218f017213e097ede09e93f95ec3ce5ab14a31064726b69c107f05befd9f0d0"
  },
  {
    "file": "maximum_64_scalar_patches.complete-candidate.source0.css",
    "bytes": 528,
    "sha256": "ddf55998aca33a934c461d223ed957fcced2fc1f0087a4125b376a078395a08a"
  },
  {
    "file": "maximum_64_scalar_patches.authored-request.json",
    "bytes": 1557,
    "sha256": "9450694b53df2309f88cc58e7375beb3d89d8fe529948f124e0413f15f589957"
  },
  {
    "file": "maximum_64_scalar_patches.owned-edit.json",
    "bytes": 18750,
    "sha256": "7d2c76018abe951eedfeec628dcc230ff4f14fcd11cc1bcedc1a755868b9bd39"
  },
  {
    "file": "maximum_64_scalar_patches.independent-native-observations.json",
    "bytes": 2747,
    "sha256": "8d081e45f026aa98e10dd7e30a9d774637ad17fe81183973afbdcb31fca16c32"
  },
  {
    "file": "cold_candidate_reedit.complete-original.source0.css",
    "bytes": 1109,
    "sha256": "e4b5057b8227e4e374ae9372b9baeb2a853b86627e9794130751090531e6a658"
  },
  {
    "file": "cold_candidate_reedit.complete-candidate.source0.css",
    "bytes": 1110,
    "sha256": "fea2afc09f770b88242344da90df46e4bbf0097f60e23c39669d3b6ca518ac90"
  },
  {
    "file": "cold_candidate_reedit.authored-request.json",
    "bytes": 1243,
    "sha256": "191c000c41cbf9188ca255ff5e745e2418ab4e7ce22c69d36ed84936dbb7bd43"
  },
  {
    "file": "cold_candidate_reedit.owned-edit.json",
    "bytes": 8636,
    "sha256": "e32de4b6203e9a1103cc225e765036549500b92404aaa708f1fab0ad0dc86dc5"
  },
  {
    "file": "cold_candidate_reedit.independent-native-observations.json",
    "bytes": 4961,
    "sha256": "bf2e9c018585917a4f92e084d677d33e68bae2cf2aeea9d881a38335fc52a2c9"
  }
]);
const DEGREE4_SOURCE = "@model degree4_original {version:0;length-unit:mm;@surface #degree4_selected {type:nurbs;degree-u:4;degree-v:4;knots-u:[0,0,0,0,0,1,1,1,1,1];knots-v:[0,0,0,0,0,1,1,1,1,1];control-points:[[[0,0,0],[0,1,1],[0,2,2],[0,3,3],[0,4,4]],[[1,0,1],[1,1,2],[1,2,3],[1,3,4],[1,4,5]],[[2,0,2],[2,1,3],[2,2,4],[2,3,5],[2,4,6]],[[3,0,3],[3,1,4],[3,2,5],[3,3,6],[3,4,7]],[[4,0,4],[4,1,5],[4,2,6],[4,3,7],[4,4,8]]];weights:[[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]];}}\n";

export function requireFact(condition, message) {
  if (!condition) throw new Error(message);
}
export function sameNative(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((value, index) => sameNative(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameNative(a[key], b[key]));
  }
  return Object.is(a, b);
}
export function assertNative(a, b, label) { requireFact(sameNative(a, b), label); }
export function assertBuffer(a, b, label) {
  requireFact(a?.length === b?.length && Array.from(a).every((value, index) => Object.is(value, b[index])), label);
}
export function createNativeOptions() {
  return { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    nativeCapacity: { version: 1, maximumObjects: 16 } };
}
async function pinText(text, pin) {
  requireFact(typeof text === 'string', 'Expected unchanged text for ' + pin.file);
  const bytes = new TextEncoder().encode(text);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    value => value.toString(16).padStart(2, '0')).join('');
  requireFact(bytes.length === pin.bytes && hash === pin.sha256, 'Bytes/hash changed: ' + pin.file);
}
export async function loadCase(key, readText) {
  requireFact(CASE_KEYS.includes(key), 'Unknown source edit family');
  const pins = PINS.filter(pin => pin.file.startsWith(key + '.'));
  requireFact(pins.length === 5, 'Expected five authentic files');
  const text = new Map(await Promise.all(pins.map(async pin => {
    const value = await readText(pin.file); await pinText(value, pin); return [pin.file, value];
  })));
  const get = suffix => text.get(key + '.' + suffix);
  const asset = { key, pins, originalSource: get('complete-original.source0.css'),
    candidateSource: get('complete-candidate.source0.css'), request: JSON.parse(get('authored-request.json')),
    owned: JSON.parse(get('owned-edit.json')), nativeObservations: JSON.parse(get('independent-native-observations.json')) };
  requireFact(asset.request.source === asset.originalSource, 'Original request is not complete file text');
  requireFact(asset.owned.source === asset.candidateSource, 'Owned result is not complete candidate file text');
  if (key === 'mixed_weighted') {
    await pinText(DEGREE4_SOURCE, { file: 'authentic inline degree4 negative', bytes: 471,
      sha256: '7f233e169cf307b6674b50e4bf235e2efb09ce764d32f6a333894a7b357b0ce2' });
    const growth = growthRequest(asset.request);
    await pinText(growth.source, { file: 'authentic generated growth source', bytes: 262120,
      sha256: '8968f384bef493988789274031adeb51e3866c2a166dea7fa539acb2e9ac3bae' });
    await pinText(JSON.stringify(growth) + '\n', { file: 'authentic generated growth request', bytes: 262258,
      sha256: '5e47a5d88974e39e6459b69e57ea18a725a75f1b89271061686cc8eeb999dde0' });
  }
  return asset;
}
function cold(source) {
  const result = compileCadModel(source, { sourceVersion: 0 });
  requireFact(result.ok, 'Actual complete-source compiler refused: ' + JSON.stringify(result.diagnostics));
  return result.model;
}
export function nativeCenters(model, selectedId) {
  return model.objects.filter(object => object.kind === 'surface').map(surface => {
    const domain = surfaceDomain(surface), u = (domain.u[0] + domain.u[1]) / 2, v = (domain.v[0] + domain.v[1]) / 2;
    return { surfaceId: surface.id, selected: surface.id === selectedId, u, v,
      pointMM: evaluateSurface(surface, u, v) };
  });
}
function independentDifference(actual, expected, label) {
  if (typeof actual === 'number') {
    requireFact(Number.isFinite(actual) && Number.isFinite(expected), label + ': nonfinite oracle');
    const difference = Math.abs(actual - expected);
    requireFact(difference <= 1e-11 * Math.max(1, Math.abs(expected)), label + ': independent binary64 observation differs');
    return difference;
  }
  return Math.max(0, ...Object.keys(expected).map(key => independentDifference(actual[key], expected[key], label)));
}
export function proveCase(asset) {
  const originalRequest = structuredClone(asset.request), savedOwned = structuredClone(asset.owned);
  const edit = editSourceSurfaceControlNet(asset.request);
  assertNative(edit, asset.owned, 'Whole actual source edit differs from saved result');
  assertNative(validateSourceSurfaceControlNetEdit(asset.owned), asset.owned.report, 'Whole owned validator differs');
  assertNative(asset.request, originalRequest, 'Caller request changed');
  assertNative(asset.owned, savedOwned, 'Caller whole result changed');
  requireFact(edit.source === asset.candidateSource, 'Candidate complete source changed');
  const originalModel = cold(asset.originalSource), model = cold(asset.candidateSource);
  assertNative(originalModel, edit.originalModel, 'Original cold Model differs');
  assertNative(model, edit.model, 'Candidate cold Model differs');
  requireFact(edit.edit.model.objects.length === 1 && edit.edit.source !== edit.source, 'Child proof became whole asset');
  assertNative(edit.edit.original, originalModel.objects[edit.report.selectedObjectIndex], 'Child original binding differs');
  assertNative(edit.edit.surface, model.objects[edit.report.selectedObjectIndex], 'Selected candidate differs from child');
  let rebuilt = asset.originalSource;
  for (const patch of [...edit.patches].reverse()) {
    requireFact(asset.originalSource.slice(patch.startUTF16, patch.endUTF16) === patch.originalText, 'Original patch range changed');
    rebuilt = rebuilt.slice(0, patch.startUTF16) + patch.replacementText + rebuilt.slice(patch.endUTF16);
  }
  requireFact(rebuilt === asset.candidateSource, 'Actual literal patches do not reproduce complete file');
  let originalAt = 0, candidateAt = 0;
  for (const patch of edit.patches) {
    const length = patch.startUTF16 - originalAt;
    requireFact(asset.originalSource.slice(originalAt, patch.startUTF16) === asset.candidateSource.slice(candidateAt, candidateAt + length), 'Untouched source span changed');
    candidateAt += length + patch.replacementText.length; originalAt = patch.endUTF16;
  }
  requireFact(asset.originalSource.slice(originalAt) === asset.candidateSource.slice(candidateAt), 'Untouched suffix changed');
  for (let index = 0; index < model.objects.length; index++) if (index !== edit.report.selectedObjectIndex) {
    assertNative(model.objects[index], originalModel.objects[index], 'Unselected original native object changed');
  }
  const before = originalModel.objects[edit.report.selectedObjectIndex], after = model.objects[edit.report.selectedObjectIndex];
  let maximumIndependentDifference = 0;
  const observations = asset.nativeObservations.map(item => {
    const native = { u: item.u, v: item.v,
      before: { d0: evaluateSurface(before, item.u, item.v), d1: evaluateSurfaceD1(before, item.u, item.v) },
      after: { d0: evaluateSurface(after, item.u, item.v), d1: evaluateSurfaceD1(after, item.u, item.v) } };
    for (const state of ['before', 'after']) {
      assertNative(native[state].d0, item[state].d0, 'Actual native D0 changed');
      assertNative(native[state].d1, item[state].d1, 'Actual native D1 changed');
      maximumIndependentDifference = Math.max(maximumIndependentDifference,
        independentDifference(native[state].d0, item[state].independent.point, 'Independent point observation'),
        independentDifference(native[state].d1, item[state].independent, 'Independent native observation'));
    }
    return native;
  });
  requireFact(observations.length === 9, 'Expected original nine observation sites');
  const expectedPatches = { mixed_weighted: 7, signed_zero_only: 1, no_op_original_spelling: 0,
    maximum_64_scalar_patches: 64, cold_candidate_reedit: 1 };
  requireFact(edit.patches.length === expectedPatches[asset.key], 'Original patch count changed');
  return { edit, originalModel, model, observations, patchCount: edit.patches.length,
    centers: { original: nativeCenters(originalModel, asset.request.surfaceId), candidate: nativeCenters(model, asset.request.surfaceId) },
    unrenderedCurveIds: model.objects.filter(object => object.kind === 'curve').map(object => object.id),
    independentTolerance: '1e-11*max(1,abs(expected))', maximumIndependentDifference };
}
function growthRequest(request) {
  return { ...structuredClone(request), source: request.source + '/*' + 'x'.repeat(261008) + '*/',
    edits: { poleEdits: [{ uIndex: 0, vIndex: 0, xMM: Number.MIN_VALUE }] } };
}
export function createRefusalActions(asset, host) {
  requireFact(asset.key === 'mixed_weighted', 'Frozen refusal recipes use authentic mixed family');
  const request = asset.request, owned = asset.owned;
  let getterCalls = 0;
  const changed = mutate => { const input = structuredClone(request); mutate(input); return () => editSourceSurfaceControlNet(input); };
  const actions = [
    { name: 'invalid-mixed-batch', scope: 'public-CAD', code: 'NATIVE', causeMessage: 'in-range integer U/V pole indices required',
      run: changed(input => input.edits = { poleEdits: [{ uIndex: 0, vIndex: 0, zMM: 1 }, { uIndex: 99, vIndex: 0, zMM: 2 }] }) },
    { name: 'native-index', scope: 'public-CAD', code: 'NATIVE', causeMessage: 'in-range integer U/V pole indices required',
      run: changed(input => input.edits = { poleEdits: [{ uIndex: 99, vIndex: 0, zMM: 2 }] }) },
    { name: 'native-zero-weight', scope: 'public-CAD', code: 'NATIVE', causeMessage: 'Weights must be in [1e-6, 1e6]',
      run: changed(input => input.edits = { poleEdits: [{ uIndex: 0, vIndex: 0, weight: 0 }] }) },
    { name: 'valid-source-unsupported-selected-degree4', scope: 'public-CAD', code: 'NATIVE', causeMessage: 'original U/V degree1..3 required', run() {
      const compiled = cold(DEGREE4_SOURCE); requireFact(compiled.objects[0].degreeU === 4, 'Authentic degree4 compiler input changed');
      return editSourceSurfaceControlNet({ source: DEGREE4_SOURCE, sourceVersion: 0, surfaceId: 'degree4_selected', edits: { poleEdits: [{ uIndex: 0, vIndex: 0, zMM: 1 }] } });
    } },
    { name: 'actual-producer-candidate-growth-budget', scope: 'public-CAD', code: 'BUDGET', run() {
      const input = growthRequest(request); requireFact(input.source.length === 262110, 'Authentic growth source length differs');
      return editSourceSurfaceControlNet(input);
    } },
    { name: 'original-UTF8-byte-budget', scope: 'public-CAD', code: 'BUDGET', run: changed(input => input.source = '/*' + '한'.repeat(88000) + '*/' + input.source) },
  ];
  for (const [name, mutate] of [
    ['owned-source', input => input.source += ' '],
    ['owned-model', input => input.model.objects[input.report.selectedObjectIndex].controlPoints[1][1][2] += 1],
    ['owned-patch', input => input.patches[0].replacementText += '0'],
    ['owned-report', input => input.report.patchCount += 1],
  ]) {
    const input = structuredClone(owned); mutate(input);
    actions.push({ name, scope: 'public-CAD', code: 'OWNED', run: () => validateSourceSurfaceControlNetEdit(input) });
  }
  const sourceGetter = structuredClone(request);
  Object.defineProperty(sourceGetter, 'source', { enumerable: true, get() { getterCalls++; return request.source; } });
  const editGetter = structuredClone(request);
  Object.defineProperty(editGetter.edits.poleEdits[0], 'zMM', { enumerable: true, get() { getterCalls++; return 8; } });
  actions.push({ name: 'input-source-accessor', scope: 'public-CAD', code: 'INPUT', run: () => editSourceSurfaceControlNet(sourceGetter) },
    { name: 'input-native-edit-accessor', scope: 'public-CAD', code: 'INPUT', run: () => editSourceSurfaceControlNet(editGetter) },
    { name: 'stale-accepted-request-source', scope: 'private-host-only', code: 'STALE_REQUEST_SOURCE', run() {
      return host.guardRequest({ ...structuredClone(request), source: asset.candidateSource });
    } },
    { name: 'valid-child-only-candidate-source', scope: 'private-host-only', code: 'INCOMPLETE_CANDIDATE_SOURCE', run() {
      const child = cold(owned.edit.source); requireFact(child.objects.length === 1, 'Valid child proof compiler input changed');
      return host.guardCandidate(owned.edit.source, owned);
    } },
    { name: 'target-invalid-grid', scope: 'public-Three-options', code: null, run: () => host.probeTarget(request.source, { ...createNativeOptions(), countU: 18 }) },
    { name: 'target-actual-Float32-preview-refusal', scope: 'public-Three-preview', code: null,
      run: () => host.probeTarget(request.source, { ...createNativeOptions(), unitsPerMillimeter: 1e-50 }) });
  return { actions, getterCalls: () => getterCalls };
}
