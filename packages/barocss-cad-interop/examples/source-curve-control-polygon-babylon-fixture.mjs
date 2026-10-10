import { compileCadModel, editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit,
  curveDomain, evaluateCurve, evaluateCurveD1 } from '@barocss/cad';

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
export class SourceCurveEditBabylonHostError extends Error {
  constructor(code, message) { super(message); this.name = 'SourceCurveEditBabylonHostError'; this.code = code; }
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
