import { compileCadModel, editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit,
  curveDomain, evaluateCurve, evaluateCurveD1, sampleCurve } from '@barocss/cad';

export const FAMILY_NAMES = [
  "quartic_rational_nonzero_domain",
  "quintic_actual_native_profile",
  "exact_noop_unusual_decimal_minus_zero",
  "real_minus_zero_coordinate_edit",
  "cold_candidate_reedit",
  "actual_64_poles_all_256_fields_changed"
];
export const PINS = [
  {
    "file": "quartic_rational_nonzero_domain.complete-original.source0.css",
    "bytes": 687,
    "sha256": "4f0a57faa921de97ca40882f341139bd99eb44fb00691b47a8b153120c4415f3"
  },
  {
    "file": "quartic_rational_nonzero_domain.complete-candidate.source0.css",
    "bytes": 692,
    "sha256": "52ba53b42ffc41562b8d872b6cd4a78ae2507cc2930a79b42152b147a2c48c74"
  },
  {
    "file": "quartic_rational_nonzero_domain.authored-request.json",
    "bytes": 850,
    "sha256": "bc192a98ed84365aad618210c6382e1e09a7c61dc49a7bbaefea4eb034db8219"
  },
  {
    "file": "quartic_rational_nonzero_domain.owned-result.json",
    "bytes": 6887,
    "sha256": "2b402d192a0a8a0c0efdcc9404cc5e69890108dc712effc929294e15012b517b"
  },
  {
    "file": "quintic_actual_native_profile.complete-original.source0.css",
    "bytes": 697,
    "sha256": "c1c3ab1b99a9dee3bb7f28dd59b3f011f05c5e0997255c23e355b52e9755ef4d"
  },
  {
    "file": "quintic_actual_native_profile.complete-candidate.source0.css",
    "bytes": 703,
    "sha256": "a9d27dac769292649144da2033b809f7de396fd9705aa1a335d513db4d869272"
  },
  {
    "file": "quintic_actual_native_profile.authored-request.json",
    "bytes": 851,
    "sha256": "a88de9cd7ca2e75a86b5a0aac1104dff7062eafa690f104bf75a4cb8dd7a2ec0"
  },
  {
    "file": "quintic_actual_native_profile.owned-result.json",
    "bytes": 6684,
    "sha256": "db6cff53ff3df04036f7d71dc3b7e6e5a99714cb10cd44886b8e02660ba94a47"
  },
  {
    "file": "exact_noop_unusual_decimal_minus_zero.complete-original.source0.css",
    "bytes": 697,
    "sha256": "570034a384fb0bbc80c44d0d650e882a92937f1069de1be279c364fc14510f2a"
  },
  {
    "file": "exact_noop_unusual_decimal_minus_zero.complete-candidate.source0.css",
    "bytes": 697,
    "sha256": "570034a384fb0bbc80c44d0d650e882a92937f1069de1be279c364fc14510f2a"
  },
  {
    "file": "exact_noop_unusual_decimal_minus_zero.authored-request.json",
    "bytes": 834,
    "sha256": "026895642ccb593b2c4288d2d883db8af309ab8374ec0ec1d0e0cc266f0c03aa"
  },
  {
    "file": "exact_noop_unusual_decimal_minus_zero.owned-result.json",
    "bytes": 6352,
    "sha256": "f66c4de8fa9aa01c0a72a3ffa9ba14ebde78b5ee3e02861bf99e1653079fb45f"
  },
  {
    "file": "real_minus_zero_coordinate_edit.complete-original.source0.css",
    "bytes": 697,
    "sha256": "570034a384fb0bbc80c44d0d650e882a92937f1069de1be279c364fc14510f2a"
  },
  {
    "file": "real_minus_zero_coordinate_edit.complete-candidate.source0.css",
    "bytes": 693,
    "sha256": "d10f3a858b466fc8665aac0eae1c39119f2afdf78667289495673417db891566"
  },
  {
    "file": "real_minus_zero_coordinate_edit.authored-request.json",
    "bytes": 816,
    "sha256": "49bd969ee886b09800dceea41c9ed92827e38a2be0780588d0f45e2948ff253e"
  },
  {
    "file": "real_minus_zero_coordinate_edit.owned-result.json",
    "bytes": 6430,
    "sha256": "7e4c1f0878bddce9f6b5184f0c8c3fb4c90dcf857c10c375a93b38ea94e34494"
  },
  {
    "file": "cold_candidate_reedit.complete-original.source0.css",
    "bytes": 692,
    "sha256": "52ba53b42ffc41562b8d872b6cd4a78ae2507cc2930a79b42152b147a2c48c74"
  },
  {
    "file": "cold_candidate_reedit.complete-candidate.source0.css",
    "bytes": 697,
    "sha256": "e95eb64115d99cf03f58b449937422e482673d2b8ef3ef75fe847f955ffcd278"
  },
  {
    "file": "cold_candidate_reedit.authored-request.json",
    "bytes": 825,
    "sha256": "d8db420a534d65e7361b90607d85415d8b8a676db6f2576da108b88e8f09500d"
  },
  {
    "file": "cold_candidate_reedit.owned-result.json",
    "bytes": 6525,
    "sha256": "949d5d3c714b8902eefc03eadec940d45961f497fa2feff6445b903a2ac54309"
  },
  {
    "file": "actual_64_poles_all_256_fields_changed.complete-original.source0.css",
    "bytes": 2517,
    "sha256": "8017a05c0d828ff4b4ed49c2edd58249546cbec752f7acb8a11b78d119635451"
  },
  {
    "file": "actual_64_poles_all_256_fields_changed.complete-candidate.source0.css",
    "bytes": 3027,
    "sha256": "f84efd137c16d939c369717c1a28cad24ae683960a4a644f0b613ed51f61e86e"
  },
  {
    "file": "actual_64_poles_all_256_fields_changed.authored-request.json",
    "bytes": 6358,
    "sha256": "e67003868bd810cbfe59de9ab87a8b72b0f9e9fbe2e9d684f94def4a4a7a74fd"
  },
  {
    "file": "actual_64_poles_all_256_fields_changed.owned-result.json",
    "bytes": 60324,
    "sha256": "b4febd3b19d780d31cb0ae7b58887a9ff08c4dca248795ec4600b654c8cad637"
  }
];
export const createNativeOptions = (curveId = 'target_curve') => ({ sourceVersion: 0, unitsPerMillimeter: 0.001,
  uniformCurveDisplay: { version: 1, count: 129 }, curveId });
export function requireFact(condition, message) { if (!condition) throw new Error(message); }
export function assertNative(actual, expected, path = 'native') {
  if (typeof expected === 'number') return requireFact(Object.is(actual, expected), `${path}: numeric bits changed`);
  if (expected === null || typeof expected !== 'object') return requireFact(actual === expected, `${path}: value changed`);
  requireFact(actual !== null && typeof actual === 'object', `${path}: object missing`);
  requireFact(Array.isArray(actual) === Array.isArray(expected), `${path}: array kind changed`);
  if (ArrayBuffer.isView(expected)) requireFact(actual.constructor === expected.constructor, `${path}: typed array kind changed`);
  const keys = Object.keys(expected), actualKeys = Object.keys(actual);
  requireFact(keys.length === actualKeys.length && keys.every(key => Object.hasOwn(actual, key)), `${path}: fields changed`);
  for (const key of keys) assertNative(actual[key], expected[key], `${path}.${key}`);
}
export function assertBuffer(actual, expected, label = 'buffer') {
  requireFact(actual.length === expected.length, `${label}: length changed`);
  for (let index = 0; index < expected.length; index++) requireFact(Object.is(actual[index], expected[index]), `${label}[${index}]: bits changed`);
}
export class SourceCurveEditPixi3DHostError extends Error {
  constructor(code, message) { super(message); this.name = 'SourceCurveEditPixi3DHostError'; this.code = code; }
}
export async function loadCurveEditAssets(readText) {
  const texts = new Map();
  for (const pin of PINS) {
    const text = await readText(pin.file, pin);
    requireFact(typeof text === 'string' && new TextEncoder().encode(text).length === pin.bytes, `Original file bytes changed: ${pin.file}`);
    texts.set(pin.file, text);
  }
  return new Map(FAMILY_NAMES.map(family => [family, { family,
    originalSource: texts.get(family + '.complete-original.source0.css'), candidateSource: texts.get(family + '.complete-candidate.source0.css'),
    request: JSON.parse(texts.get(family + '.authored-request.json')), owned: JSON.parse(texts.get(family + '.owned-result.json')) }]));
}
function coldModel(source) {
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  requireFact(compiled.ok, 'Original whole Source0 failed cold compilation'); return compiled;
}
function selected(model, curveId) {
  const index = model.objects.findIndex(object => object.id === curveId);
  requireFact(index === 1 && model.objects[index].kind === 'curve', 'The selected original Curve must retain ordinal 1');
  requireFact(model.name === 'complete_original_curve_file' && model.version === 0 && model.lengthUnit === 'mm', 'Original whole Model metadata changed');
  assertNative(model.objects.map(object => [object.kind, object.id]), [['curve', 'context_curve'], ['curve', 'target_curve'], ['surface', 'context_plane']]);
  return model.objects[index];
}
function scalarNode(compiled, curveId, patch) {
  const declaration = compiled.ast.declarations.find(value => value.id === curveId);
  const name = patch.field === 'weight' ? 'weights' : 'control-points';
  const field = declaration.fields.find(value => value.name === name);
  requireFact(field.value.kind === 'array', 'Actual scalar AST field must be an array');
  const pole = field.value.items[patch.index];
  const node = patch.field === 'weight' ? pole : pole.items[['xMM', 'yMM', 'zMM'].indexOf(patch.field)];
  requireFact(node.kind === 'number', 'Actual scalar must be a literal number'); return node;
}
function derivative(curve, parameter) {
  try { return { kind: 'evaluated', result: evaluateCurveD1(curve, parameter) }; }
  catch (error) { requireFact(error instanceof Error, 'Native derivative must return a genuine Error'); return { kind: 'refused', message: error.message.slice(0, 512) }; }
}
export function proveCurveEditAsset(asset) {
  requireFact(asset !== null && typeof asset === 'object' && !Array.isArray(asset) && [Object.prototype, null].includes(Object.getPrototypeOf(asset)), 'Producer asset must be plain own data');
  const fields = ['family', 'originalSource', 'candidateSource', 'request', 'owned'], keys = Reflect.ownKeys(asset);
  requireFact(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)), 'Exact producer asset fields required');
  for (const field of fields) { const descriptor = Object.getOwnPropertyDescriptor(asset, field); requireFact(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'Producer asset accessors are refused without invocation'); }
  // The actual public descriptor-safe editor and owned validator admit nested data
  // before any caller-data structuredClone or request.source read.
  const edited = editSourceCurveControlPolygon(asset.request);
  assertNative(validateSourceCurveControlPolygonEdit(asset.owned), asset.owned.report, 'saved-whole-validator');
  const before = structuredClone(asset);
  requireFact(FAMILY_NAMES.includes(asset.family), 'Unknown producer family');
  requireFact(asset.request.source === asset.originalSource, 'The complete original file must equal the authored request');
  assertNative(validateSourceCurveControlPolygonEdit(edited), edited.report, 'actual-whole-validator');
  assertNative(edited, asset.owned, 'all-eight-owned-fields');
  requireFact(edited.source === asset.candidateSource, 'The complete candidate file must equal the actual editor result');
  const original = coldModel(asset.originalSource), candidate = coldModel(asset.candidateSource);
  assertNative(original.model, edited.originalModel); assertNative(candidate.model, edited.model);
  const beforeCurve = selected(original.model, asset.request.curveId), afterCurve = selected(candidate.model, asset.request.curveId);
  assertNative(afterCurve, edited.curve); assertNative(beforeCurve.knots, afterCurve.knots);
  assertNative(curveDomain(beforeCurve), curveDomain(afterCurve));
  requireFact(beforeCurve.degree === afterCurve.degree && beforeCurve.controlPoints.length === afterCurve.controlPoints.length, 'Original degree and pole count changed');
  assertNative(original.model.objects[0], candidate.model.objects[0], 'unselected-original-Curve');
  assertNative(original.model.objects[2], candidate.model.objects[2], 'unselected-original-Surface');
  const requested = new Map();
  for (const edit of asset.request.edits.poleEdits) {
    const fields = ['xMM', 'yMM', 'zMM', 'weight'].filter(field => Object.hasOwn(edit, field));
    requested.set(edit.index, fields);
    for (const field of fields) {
      const node = scalarNode(original, asset.request.curveId, { index: edit.index, field });
      const beforeScalar = field === 'weight' ? beforeCurve.weights[edit.index] : beforeCurve.controlPoints[edit.index][['xMM', 'yMM', 'zMM'].indexOf(field)];
      requireFact(Object.is(Number(asset.originalSource.slice(node.range.start, node.range.end)), node.value) && Object.is(node.value, beforeScalar), 'Every requested scalar, including no-op, must bind original source/AST/native bits');
      const actual = field === 'weight' ? afterCurve.weights[edit.index] : afterCurve.controlPoints[edit.index][['xMM', 'yMM', 'zMM'].indexOf(field)];
      requireFact(Object.is(actual, edit[field]), 'Requested absolute scalar does not equal the genuine native edit');
    }
  }
  for (let index = 0; index < beforeCurve.controlPoints.length; index++) for (const field of ['xMM', 'yMM', 'zMM', 'weight']) {
    if (requested.get(index)?.includes(field)) continue;
    const scalar = value => field === 'weight' ? value.weights[index] : value.controlPoints[index][['xMM', 'yMM', 'zMM'].indexOf(field)];
    requireFact(Object.is(scalar(beforeCurve), scalar(afterCurve)), 'An unrequested native scalar changed');
  }
  assertNative(edited.provenance, asset.request.edits.poleEdits.map(edit => {
    const requestedFields = ['xMM', 'yMM', 'zMM', 'weight'].filter(field => Object.hasOwn(edit, field));
    const scalar = (curve, field) => field === 'weight' ? curve.weights[edit.index] : curve.controlPoints[edit.index][['xMM', 'yMM', 'zMM'].indexOf(field)];
    return { index: edit.index, requestedFields, changedFields: requestedFields.filter(field => !Object.is(scalar(beforeCurve, field), scalar(afterCurve, field))),
      before: { pointMM: beforeCurve.controlPoints[edit.index], weight: beforeCurve.weights[edit.index] },
      after: { pointMM: afterCurve.controlPoints[edit.index], weight: afterCurve.weights[edit.index] } };
  }), 'independent-native-edit-provenance');
  let originalOffset = 0, candidateOffset = 0;
  for (const [index, patch] of edited.patches.entries()) {
    const node = scalarNode(original, asset.request.curveId, patch);
    requireFact(node.range.start === patch.startUTF16 && node.range.end === patch.endUTF16, 'Patch must bind the actual exclusive original AST scalar range');
    requireFact(asset.originalSource.slice(patch.startUTF16, patch.endUTF16) === patch.originalText && Object.is(Number(patch.originalText), node.value), 'Original patch lexeme/native bits changed');
    requireFact(index === 0 || edited.patches[index - 1].endUTF16 <= patch.startUTF16, 'Patch ranges overlap');
    const untouchedLength = patch.startUTF16 - originalOffset;
    requireFact(asset.originalSource.slice(originalOffset, patch.startUTF16) === asset.candidateSource.slice(candidateOffset, candidateOffset + untouchedLength), 'Untouched source span changed');
    candidateOffset += untouchedLength;
    requireFact(asset.candidateSource.slice(candidateOffset, candidateOffset + patch.replacementText.length) === patch.replacementText, 'Actual candidate replacement literal changed');
    candidateOffset += patch.replacementText.length; originalOffset = patch.endUTF16;
    const replacement = patch.field === 'weight' ? afterCurve.weights[patch.index] : afterCurve.controlPoints[patch.index][['xMM', 'yMM', 'zMM'].indexOf(patch.field)];
    requireFact(Object.is(Number(patch.replacementText), replacement), 'Replacement literal must retain accepted native bits');
  }
  requireFact(asset.originalSource.slice(originalOffset) === asset.candidateSource.slice(candidateOffset), 'Untouched source suffix changed');
  requireFact(edited.report.patchCount === edited.patches.length && edited.report.selectedObjectIndex === 1 && edited.report.objectCount === 3, 'Whole source direct counts/qualification changed');
  if (edited.report.noOp) requireFact(asset.originalSource === asset.candidateSource && edited.patches.length === 0, 'No-op must retain exact source spelling');
  const domain = curveDomain(beforeCurve), parameters = [domain[0], domain[0] / 2 + domain[1] / 2, domain[1]];
  requireFact(edited.report.observations.length === 3 && edited.report.derivativeObservations.length === 3, 'Exactly three original native observation sites required');
  for (const [index, parameter] of parameters.entries()) {
    const observation = edited.report.observations[index], d1 = edited.report.derivativeObservations[index];
    requireFact(Object.is(observation.parameter, parameter) && Object.is(d1.parameter, parameter), 'Native observations must retain original domain parameter bits');
    const beforePointMM = evaluateCurve(beforeCurve, parameter), afterPointMM = evaluateCurve(afterCurve, parameter);
    assertNative(beforePointMM, observation.beforePointMM); assertNative(afterPointMM, observation.afterPointMM);
    requireFact(Object.is(Math.hypot(...afterPointMM.map((value, axis) => value - beforePointMM[axis])), observation.observedChangeMM), 'Native observed change differs');
    assertNative(derivative(beforeCurve, parameter), d1.before); assertNative(derivative(afterCurve, parameter), d1.after);
  }
  requireFact(Object.is(edited.report.maximumObservedChangeMM, Math.max(...edited.report.observations.map(value => value.observedChangeMM))), 'Maximum observed local change differs');
  requireFact(edited.report.originalSourceUTF16 === asset.originalSource.length && edited.report.candidateSourceUTF16 === asset.candidateSource.length &&
    edited.report.originalSourceUTF8 === new TextEncoder().encode(asset.originalSource).length && edited.report.candidateSourceUTF8 === new TextEncoder().encode(asset.candidateSource).length, 'Full source byte/UTF16 counts differ');
  requireFact(edited.report.directCounts.originalCompileCount === 1 && edited.report.directCounts.candidateCompileCount === 1 &&
    edited.report.directCounts.nativeCurveValidationCount === 1 && edited.report.directCounts.domainQueryCount === 1 && edited.report.directCounts.curvePointEvaluationCount === 6 &&
    edited.report.directCounts.curveDerivativeEvaluationCount === 6 && edited.report.directCounts.derivativeSuccessCount + edited.report.directCounts.derivativeRefusalCount === 6,
    'Provider direct work counters changed');
  assertNative(asset, before, 'immutable-original-inputs');
  return { edited, originalModel: original.model, candidateModel: candidate.model };
}

/** Real public CPU refusal recipes shared by the browser host and engine-free Node consumer. */
export function runCurveEditSourceRefusals(asset, parse, apply, afterRefusal = () => {}, staleRequest) {
  const inputs = structuredClone(asset), staleInput = structuredClone(staleRequest), refusals = [];
  let getterCalls = 0;
  const clone = value => structuredClone(value);
  function compiled(source) { const value = compileCadModel(source, { sourceVersion: 0 }); requireFact(value.ok, 'Original compiler AST required'); return value; }
  function refuse(name, action, errorName, code, diagnostic = null) {
    let error; try { action(); } catch (caught) { error = caught; }
    requireFact(error instanceof Error && error.name === errorName && error.code === code, `${name}: actual error changed (${error?.name}/${error?.code})`);
    if (diagnostic) requireFact(error.diagnostics?.some(value => value.code === diagnostic), 'Actual compiler diagnostic required: ' + diagnostic);
    if (name === 'editorweight0') requireFact(error.cause?.message === 'Weights must be in [1e-6, 1e6]', 'Actual native weight cause required');
    assertNative(asset, inputs); assertNative(staleRequest, staleInput); requireFact(getterCalls === 0, 'Input accessor was invoked');
    const row = { name, errorName: error.name, code: error.code, message: error.message, diagnostics: error.diagnostics ?? [], causeName: error.cause?.name ?? null,
      causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null, getterCalls, acceptedRetained: true };
    refusals.push(row); afterRefusal(row);
  }
      const sdkName = 'BaroCadUniformCurveSourceError', editorName = 'SourceCurveControlPolygonError';
      for (const count of [1, 130]) refuse('count' + count, () => parse(asset.originalSource, { ...createNativeOptions(), uniformCurveDisplay: { version: 1, count } }), sdkName, 'OPTIONS');
      refuse('curveId-getter', () => { const options = createNativeOptions(); Object.defineProperty(options, 'curveId', { enumerable: true, get() { getterCalls++; return 'target_curve'; } }); return parse(asset.originalSource, options); }, sdkName, 'OPTIONS');
      refuse('count-getter', () => { const options = createNativeOptions(); Object.defineProperty(options.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } }); return parse(asset.originalSource, options); }, sdkName, 'OPTIONS');
      refuse('unknownID', () => parse(asset.originalSource, createNativeOptions('missing_curve')), sdkName, 'PROFILE');
      refuse('selectedSurface', () => parse(asset.originalSource, createNativeOptions('context_plane')), sdkName, 'PROFILE');
      refuse('syntax', () => parse('@model {'), sdkName, 'SOURCE', 'SYNTAX');
      const original = compiled(asset.originalSource), target = original.ast.declarations.find(value => value.id === asset.request.curveId);
      const insideModel = text => asset.originalSource.slice(0, original.ast.range.end - 1) + '\n' + text + '\n' + asset.originalSource.slice(original.ast.range.end - 1);
      const duplicate = insideModel(asset.originalSource.slice(target.range.start, target.range.end));
      refuse('duplicateID', () => parse(duplicate), sdkName, 'SOURCE', 'DUPLICATE');
      const sibling = original.ast.declarations.find(value => value.id === 'context_curve'), siblingText = asset.originalSource.slice(sibling.range.start, sibling.range.end);
      const extra = Array.from({ length: 14 }, (_, index) => siblingText.slice(0, sibling.idRange.start - sibling.range.start) + '#context_extra_' + index + siblingText.slice(sibling.idRange.end - sibling.range.start)).join('\n');
      refuse('17decl', () => parse(insideModel(extra)), sdkName, 'SOURCE', 'LIMIT');
      for (const [name, unitsPerMillimeter] of [['F32underflow', 1e-50], ['F64underflow', Number.MIN_VALUE], ['overflow', Number.MAX_VALUE]]) {
        refuse(name, () => parse(asset.originalSource, { ...createNativeOptions(), unitsPerMillimeter }), sdkName, 'POSITIONS');
      }
      const knotNodes = target.fields.find(value => value.name === 'knots').value.items;
      let narrowSource = asset.originalSource;
      for (const [index, node] of knotNodes.entries().toArray().toSorted((a, b) => b[1].range.start - a[1].range.start)) {
        const text = index < 5 ? '1' : '1.0000000000000002'; narrowSource = narrowSource.slice(0, node.range.start) + text + narrowSource.slice(node.range.end);
      }
      const narrowCurve = compiled(narrowSource).model.objects[1], narrowSamples = sampleCurve(narrowCurve, 129);
      requireFact(narrowSamples.slice(1).filter((sample, index) => !(sample.parameter > narrowSamples[index].parameter)).length === 127, 'Genuine tiny-domain parameter duplicate witness changed');
      refuse('tiny-domain', () => parse(narrowSource), sdkName, 'PARAMETERS');
      function negativeEdit(poleEdits) {
        const edited = editSourceCurveControlPolygon({ ...asset.request, edits: { poleEdits } });
        assertNative(validateSourceCurveControlPolygonEdit(edited), edited.report); return edited;
      }
      const constant = negativeEdit(original.model.objects[1].controlPoints.map((_point, index) => ({ index, xMM: 1, yMM: 0, zMM: 0, weight: 1 })));
      const constantSamples = sampleCurve(constant.curve, 129);
      requireFact(constantSamples.every(sample => sample.point[0] === 1 && sample.point[1] === 0 && sample.point[2] === 0), 'Genuine constant Curve witness changed');
      refuse('constant', () => parse(constant.source), sdkName, 'SEGMENTS');
      const collapse = negativeEdit(original.model.objects[1].controlPoints.map((_point, index) => ({ index, xMM: 1 + index * 1e-8 / 4, yMM: 0, zMM: 0, weight: 1 })));
      const collapseSamples = sampleCurve(collapse.curve, 129);
      requireFact(collapseSamples.slice(1).filter((sample, index) => !Object.is(sample.point[0], collapseSamples[index].point[0])).length === 128 &&
        collapseSamples.every(sample => Math.fround(sample.point[0]) === 1), 'Distinct native / collapsed F32 witness changed');
      refuse('distinct-F32collapse', () => parse(collapse.source, { ...createNativeOptions(), unitsPerMillimeter: 1 }), sdkName, 'SEGMENTS');
      refuse('editorweight0', () => editSourceCurveControlPolygon({ ...asset.request, edits: { poleEdits: [{ index: 0, weight: 0 }] } }), editorName, 'NATIVE');
      refuse('editorindex64', () => editSourceCurveControlPolygon({ ...asset.request, edits: { poleEdits: [{ index: 64, xMM: 1 }] } }), editorName, 'INPUT');
      requireFact(staleRequest.source === asset.candidateSource && staleRequest.source !== asset.originalSource, 'The actual saved reedit DTO must bind the authentic quartic candidate');
      const stale = { ...asset, request: staleRequest };
      refuse('stale-reedit-source', () => apply(stale), 'SourceCurveEditPixi3DHostError', 'SOURCE_BINDING');
      refuse('ownedSibling', () => { const owned = clone(asset.owned); owned.model.objects[2].controlPoints[0][0][0] = 1; return validateSourceCurveControlPolygonEdit(owned); }, editorName, 'OWNED');
      refuse('ownedPatch', () => { const owned = clone(asset.owned); owned.patches[0].startUTF16++; return validateSourceCurveControlPolygonEdit(owned); }, editorName, 'OWNED');
  requireFact(refusals.length === 20, 'Exactly20 real source refusals required'); return refusals;
}
/** Same actual bounded public transport authority, without a Pixi initializer in Node. */
export async function runCurveEditTransportRefusals(loadAsync, afterRefusal = () => {}) {
 const refusals = []; let getterCalls = 0;
 async function refuse(name, transport, errorName, code, callerError = null, progressCount = () => 0) {
  let error; try { await loadAsync(transport); } catch (caught) { error = caught; }
  requireFact(error instanceof Error && error.name === errorName && (error.code ?? null) === code, name + ': actual transport error changed');
  if (callerError) requireFact(error === callerError, 'Actual caller Error identity changed');
  const progressEvents = progressCount(); if (name.startsWith('progress-')) requireFact(progressEvents > 0, 'Actual progress required');
  requireFact(getterCalls === 0, 'Transport accessor invoked');
  const row={name,errorName:error.name,code:error.code??null,message:error.message,getterCalls,progressEvents,sameCallerError:callerError?error===callerError:null,acceptedRetained:true};
  refusals.push(row); await afterRefusal(row);
 }
 const aborted=new AbortController();aborted.abort();await refuse('pre-aborted',{signal:aborted.signal},'AbortError','ABORT_ERR');
 let stopped=0;await refuse('progress-stop',{onProgress(){stopped++;return false;}},'AbortError','ABORT_ERR',null,()=>stopped);
 const controller=new AbortController();let progress=0;await refuse('progress-abort',{signal:controller.signal,onProgress(){progress++;controller.abort();}},'AbortError','ABORT_ERR',null,()=>progress);
 const callerError=new Error('Actual caller progress refusal');let thrown=0;await refuse('progress-throw',{onProgress(){thrown++;throw callerError;}},'Error',null,callerError,()=>thrown);
 const transport={};Object.defineProperty(transport,'onProgress',{enumerable:true,get(){getterCalls++;return()=>{};}});await refuse('transport-progress-accessor',transport,'TypeError',null);
 return refusals;
}
