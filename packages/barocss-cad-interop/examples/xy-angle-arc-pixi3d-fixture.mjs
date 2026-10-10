import { buildXYAngleArc, validateXYAngleArc, verifyXYAngleArcArtifact, validateXYAngleArcArtifactVerification, sampleCurve } from '@barocss/cad';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';

export const CASE_KEYS = Object.freeze([
  "positive_multispan_native_c0",
  "noncardinal_positive_single_span",
  "noncardinal_clockwise_single_span",
  "negative_multispan_native_c0",
  "arbitrary_start_full_turn_copied_seam",
  "clockwise_full_turn_copied_seam",
  "exact_authored_cardinal_quarter",
  "authored_minus_zero_cardinal_start",
  "center_radius_angle_changed_request_rebuild",
  "same_request_deterministic_rebuild"
]);
export const PINS = Object.freeze([
  {
    "file": "xy-angle-arc-pixi3d-data/arbitrary_start_full_turn_copied_seam.actual-curve-source.source0.css",
    "bytes": 570,
    "sha256": "b88f1baa83d37dfbc2b13590fc9c94e84cf60feea198cccc9c029410ec721067"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/arbitrary_start_full_turn_copied_seam.authored-request.json",
    "bytes": 157,
    "sha256": "a6d4358655a55ed9e8d4489c1c8713cb961e3047134a0e2c2baed79b6e896c03"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/arbitrary_start_full_turn_copied_seam.owned-result.json",
    "bytes": 12830,
    "sha256": "10c044dcffcd27fcdf2c437b895ee82079ce18b10500baafb48d9e32a9f561a2"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/arbitrary_start_full_turn_copied_seam.independent-rational-angle-witness.json",
    "bytes": 7908,
    "sha256": "dfec274cb561af693ada7cd4d9ed658a5c7569cb9c35cc991c0f3d8608ccb39f"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/authored_minus_zero_cardinal_start.actual-curve-source.source0.css",
    "bytes": 211,
    "sha256": "c021f08f0d2cffd5d151abeaa9e1417bded0c0a194d085e9dea0d6cfa6aabe8e"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/authored_minus_zero_cardinal_start.authored-request.json",
    "bytes": 147,
    "sha256": "ad17139d3a656e776ae6cf160eb07f434b4333af6fa7aba050ebce26617a917a"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/authored_minus_zero_cardinal_start.owned-result.json",
    "bytes": 4832,
    "sha256": "a1d5cd5e7d40a65e7549497486f65cbf4c54987ff8dc4854e552367267ee41f7"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/authored_minus_zero_cardinal_start.independent-rational-angle-witness.json",
    "bytes": 2115,
    "sha256": "ad6e01e9f9d697462fc9f3f4f8ff148af73705dd86c59c3c873adf9762a4e6a0"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/center_radius_angle_changed_request_rebuild.actual-curve-source.source0.css",
    "bytes": 287,
    "sha256": "28ee77c440f5fb4a87dd6a5ce6e97cec838c954be3f64258b444afa20f31c534"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/center_radius_angle_changed_request_rebuild.authored-request.json",
    "bytes": 157,
    "sha256": "1461b85c7d8c5e13d7d3f81ef353d693b2affcd2ab8b88fd6afe4e0d60644b8d"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/center_radius_angle_changed_request_rebuild.owned-result.json",
    "bytes": 5494,
    "sha256": "561ecceb139a959bc4a91e570e1975215c5142ccf7ee97516ff0f0698b5334e1"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/center_radius_angle_changed_request_rebuild.independent-rational-angle-witness.json",
    "bytes": 2395,
    "sha256": "2d02d8a4248f3cad26a520f05a696b8946172ea029b2ed888619bde3dde11c63"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/clockwise_full_turn_copied_seam.actual-curve-source.source0.css",
    "bytes": 586,
    "sha256": "7445a56e3758a850df43baa752203c7cb1237c4c018ae0bd9c235ecd008c5533"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/clockwise_full_turn_copied_seam.authored-request.json",
    "bytes": 162,
    "sha256": "eb8023728abe03540ee265471b1b6701a1490df283c1097c9bf47660a650c7ed"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/clockwise_full_turn_copied_seam.owned-result.json",
    "bytes": 12863,
    "sha256": "cb082fdfe3013466a81fe3e0ab0fe2f22a5414df53b785dfc44610c5ab903547"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/clockwise_full_turn_copied_seam.independent-rational-angle-witness.json",
    "bytes": 7992,
    "sha256": "db950304c438ce54674f1e8834cd7a915dc427b632806e4655eb0f9048560c4e"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/exact_authored_cardinal_quarter.actual-curve-source.source0.css",
    "bytes": 211,
    "sha256": "70a05f9653c9a1cffa5137e249a61f818c9a2f4197c096a93a64e0b3842f26d5"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/exact_authored_cardinal_quarter.authored-request.json",
    "bytes": 145,
    "sha256": "a071b5c4518ba52e735d256f414037486136f9059bb63f0c55ee5789b722fa4f"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/exact_authored_cardinal_quarter.owned-result.json",
    "bytes": 4829,
    "sha256": "50ce43b8fb3bebc6b9f9e613c8901a816f7f7e7265fb848e3b102661ab799fe8"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/exact_authored_cardinal_quarter.independent-rational-angle-witness.json",
    "bytes": 2115,
    "sha256": "ad6e01e9f9d697462fc9f3f4f8ff148af73705dd86c59c3c873adf9762a4e6a0"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/negative_multispan_native_c0.actual-curve-source.source0.css",
    "bytes": 450,
    "sha256": "feee04c65516db40dfe3c50bddbf49d9e31c8cfbf44457b06b650611007a9704"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/negative_multispan_native_c0.authored-request.json",
    "bytes": 166,
    "sha256": "df5e783a146e71209e7912d59ea2b882d84e889dd014a9e359855d742305ecc7"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/negative_multispan_native_c0.owned-result.json",
    "bytes": 10167,
    "sha256": "afc335088e628b4743cd3020961a09e898d95a1b8bdee97c10eb4c6996fc8083"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/negative_multispan_native_c0.independent-rational-angle-witness.json",
    "bytes": 6071,
    "sha256": "3f02512d70694207da91131940355f478f962cffce8eed4453774c9b6b173b01"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_clockwise_single_span.actual-curve-source.source0.css",
    "bytes": 275,
    "sha256": "d87bdb5987851eac51d8c52218ae696d1287e752824cd593a6adddad85f16005"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_clockwise_single_span.authored-request.json",
    "bytes": 161,
    "sha256": "ef421046c4b425a23b5c888ee9aa29678fde7254541a68929feb5adcc1ce8224"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_clockwise_single_span.owned-result.json",
    "bytes": 5366,
    "sha256": "cfbeb54ee0ccb95763fac62f790bfefb6e2dda3c5f88f9f364c5308857cf2641"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_clockwise_single_span.independent-rational-angle-witness.json",
    "bytes": 2328,
    "sha256": "581f9e58aa32b3e419acb5d04558a5435e60ae1278db708948261f574c9f4d24"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_positive_single_span.actual-curve-source.source0.css",
    "bytes": 272,
    "sha256": "2ef9d1fb2c9bc37cc09fd2126b5feb7553b95d2dee6e9243dd70932ee536f375"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_positive_single_span.authored-request.json",
    "bytes": 156,
    "sha256": "67b4e89823ee35526f5e3326f684d27c63b7659780f7a857b9da4938694239c6"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_positive_single_span.owned-result.json",
    "bytes": 5368,
    "sha256": "f7a6403f908c9ab6ee5d5c6fb573c471d98e841f8e113cc39dd9fe63e035510f"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/noncardinal_positive_single_span.independent-rational-angle-witness.json",
    "bytes": 2349,
    "sha256": "ef1df30c21eaf61a3e60cfcbcf6c619a3dab365d313f00d477908969684f7ca6"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/positive_multispan_native_c0.actual-curve-source.source0.css",
    "bytes": 480,
    "sha256": "51e43cf0bf88c7bfd1d9c8793df392c5975370325440b76caf8385ce48c7acdf"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/positive_multispan_native_c0.authored-request.json",
    "bytes": 160,
    "sha256": "3b7c637cc3b57105c15c782f4172eab2a15e4a6ec6f081f692728d710017b30b"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/positive_multispan_native_c0.owned-result.json",
    "bytes": 10346,
    "sha256": "1994be521e0fcdcb96d53367e4986ae83a425e358384f2a28c59d501989fe59f"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/positive_multispan_native_c0.independent-rational-angle-witness.json",
    "bytes": 6091,
    "sha256": "fb1394b824b2042e4bb9d32649b8d1fccdf02de85b2ed59e8f9173483f3176d6"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/same_request_deterministic_rebuild.actual-curve-source.source0.css",
    "bytes": 272,
    "sha256": "2ef9d1fb2c9bc37cc09fd2126b5feb7553b95d2dee6e9243dd70932ee536f375"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/same_request_deterministic_rebuild.authored-request.json",
    "bytes": 156,
    "sha256": "67b4e89823ee35526f5e3326f684d27c63b7659780f7a857b9da4938694239c6"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/same_request_deterministic_rebuild.owned-result.json",
    "bytes": 5368,
    "sha256": "f7a6403f908c9ab6ee5d5c6fb573c471d98e841f8e113cc39dd9fe63e035510f"
  },
  {
    "file": "xy-angle-arc-pixi3d-data/same_request_deterministic_rebuild.independent-rational-angle-witness.json",
    "bytes": 2349,
    "sha256": "ef1df30c21eaf61a3e60cfcbcf6c619a3dab365d313f00d477908969684f7ca6"
  }
].map(pin => Object.freeze(pin)));

export function createNativeOptions() {
  return { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } };
}
export function requireFact(condition, message) {
  if (!condition) throw new Error(message);
}
/** Whole original native data equality, including literal negative zero. */
export function assertNative(actual, expected, path = 'native') {
  if (Object.is(actual, expected)) return;
  requireFact(actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object', `Native bit mismatch at ${path}`);
  if (ArrayBuffer.isView(actual) || ArrayBuffer.isView(expected)) {
    requireFact(ArrayBuffer.isView(actual) && ArrayBuffer.isView(expected) && actual.constructor === expected.constructor && actual.length === expected.length, `Native typed array mismatch at ${path}`);
    for (let index = 0; index < expected.length; index++) assertNative(actual[index], expected[index], `${path}[${index}]`);
    return;
  }
  requireFact(Array.isArray(actual) === Array.isArray(expected), `Native array kind mismatch at ${path}`);
  const a = Reflect.ownKeys(actual), b = Reflect.ownKeys(expected);
  requireFact(a.length === b.length && b.every(key => Object.hasOwn(actual, key)), `Native fields differ at ${path}`);
  for (const key of b) assertNative(actual[key], expected[key], `${path}.${String(key)}`);
}
export function assertBuffer(actual, expected, label = 'buffer') {
  requireFact(actual?.length === expected.length, `${label} length differs`);
  for (let index = 0; index < expected.length; index++) requireFact(Object.is(actual[index], expected[index]), `${label} bits differ at ${index}`);
}
const SUFFIXES = Object.freeze({ source: '.actual-curve-source.source0.css', request: '.authored-request.json', owned: '.owned-result.json', witness: '.independent-rational-angle-witness.json' });
/** readText receives the exact pinned example-relative file name; no file is extracted or rewritten. */
export async function loadCase(key, readText) {
  requireFact(CASE_KEYS.includes(key), 'Unknown authored XY angle arc case');
  const text = {}, pins = [];
  for (const [role, suffix] of Object.entries(SUFFIXES)) {
    const file = `xy-angle-arc-pixi3d-data/${key}${suffix}`, pin = PINS.find(item => item.file === file);
    requireFact(pin, 'Missing original file pin');
    text[role] = await readText(file); requireFact(typeof text[role] === 'string', 'Complete UTF-8 original text required'); pins.push(pin);
  }
  // JSON.parse on the original text preserves its literal -0. Do not normalize native ownership data.
  return { key, source: text.source, request: JSON.parse(text.request), owned: JSON.parse(text.owned), witness: JSON.parse(text.witness), pins };
}
export function requireOriginalSourceBinding(source, owned) {
  if (source !== owned.source) throw new TypeError('Original source differs from its whole owned XY angle arc');
}

/** Original artifact portability and same-runtime strict controls are distinct authorities. */
export function proveCase(asset) {
  requireFact(CASE_KEYS.includes(asset.key), 'Unknown authored XY angle arc case');
  const inputs=structuredClone(asset);
  const verification=verifyXYAngleArcArtifact(asset.owned),artifact=verification.artifact;
  const verificationReport=validateXYAngleArcArtifactVerification(verification);
  assertNative(artifact,asset.owned,'whole-original-artifact-retained');assertNative(verificationReport,verification.report,'whole-portable-verification-report');
  requireOriginalSourceBinding(asset.source,artifact);assertNative(asset.request,artifact.request,'original-request');
  requireFact(artifact.sourceVersion===0,'Complete original Source0 authority differs');
  const sameRuntimeRebuilt=buildXYAngleArc(asset.request),sameRuntimeRebuiltReport=validateXYAngleArc(sameRuntimeRebuilt);
  assertNative(sameRuntimeRebuiltReport,sameRuntimeRebuilt.report,'fresh-same-runtime-strict-control');
  let legacySavedControl;
  try { const report=validateXYAngleArc(asset.owned);assertNative(report,asset.owned.report,'legacy-accepted-original-report');legacySavedControl={status:'accepted',report}; }
  catch(error) {
    requireFact(error instanceof Error&&error.name==='XYAngleArcError'&&error.code==='OWNED','Only genuine legacy original strict OWNED refusal is an observed portability control');
    const cause=error.cause instanceof Error?{kind:'error',name:error.cause.name,code:error.cause.code??null,message:error.cause.message}:Array.isArray(error.cause)?{kind:'diagnostics',count:error.cause.length,diagnostics:structuredClone(error.cause)}:null;
    legacySavedControl={status:'refused',errorName:error.name,code:error.code,message:error.message,cause};
  }
  const native = parseBaroCadUniformCurveSource(asset.source, createNativeOptions()), model = native.model;
  assertNative(model, artifact.model, 'complete-original-model');
  requireFact(model.version === 0 && model.objects.length === 1 && model.objects[0].kind === 'curve' && model.objects[0].degree === 2, 'One original quadratic Curve Model required');
  assertNative(model.objects[0], artifact.curve, 'original-curve');
  assertNative(native.domain, artifact.report.nativeDomain, 'original-native-domain');
  const samples = sampleCurve(model.objects[0], 129);
  assertNative(native.parameters, samples.map(sample => sample.parameter)); assertNative(native.pointsMM, samples.map(sample => sample.point));
  requireFact(native.parameters.length === 129 && native.intervals.length === 128 && native.positions.length === 387, 'Uniform original 129-sample preview required');
  for (let index = 0; index < 129; index++) {
    for (let axis = 0; axis < 3; axis++) requireFact(Object.is(native.positions[index * 3 + axis], Math.fround(native.pointsMM[index][axis] * 0.001)), 'Millimetres must convert to Float32 once');
    if (index > 0) {
      requireFact(native.parameters[index] > native.parameters[index - 1], 'Original native parameters must strictly increase');
      assertNative(native.intervals[index - 1], [native.parameters[index - 1], native.parameters[index]]);
      requireFact([0, 1, 2].some(axis => native.positions[index * 3 + axis] !== native.positions[(index - 1) * 3 + axis]), 'Display segment collapsed');
    }
  }
  requireFact(Object.is(native.parameters[0], native.domain[0]) && Object.is(native.parameters.at(-1), native.domain[1]), 'Original endpoint parameters changed');
  const equalPoint = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  requireFact(equalPoint(native.pointsMM[0], native.pointsMM.at(-1)) === artifact.report.endpointClosed && equalPoint(native.positions.slice(0, 3), native.positions.slice(-3)) === artifact.report.endpointClosed, 'Copied full-turn native endpoint bits changed');
  requireFact(artifact.report.periodic === false && artifact.report.quality.nativeParameterIsAngle === false, 'Native parameter/periodic authority changed');
  requireFact(asset.witness.length === artifact.report.observations.length, 'Whole independent angular witness required');
  const witnessSummary = { maximumPointDifferenceMM: 0, maximumAngleDifferenceRad: 0, maximumDerivativeDifferenceMM: 0, evaluated: 0, refused: 0, tolerance: 1e-7 };
  asset.witness.forEach((item, index) => {
    const observation = artifact.report.observations[index];
    requireFact(Object.is(item.parameter, observation.parameter) && item.spanIndex === observation.spanIndex, 'Independent witness original parameter/span mismatch');
    witnessSummary.maximumPointDifferenceMM = Math.max(witnessSummary.maximumPointDifferenceMM, Math.hypot(...item.independentPointMM.map((value, axis) => value - observation.pointMM[axis])));
    witnessSummary.maximumAngleDifferenceRad = Math.max(witnessSummary.maximumAngleDifferenceRad, Math.abs(item.rationalAngleRad - observation.analyticAngleRad));
    if (observation.d1.status === 'evaluated') {
      witnessSummary.evaluated++;
      witnessSummary.maximumDerivativeDifferenceMM = Math.max(witnessSummary.maximumDerivativeDifferenceMM, Math.hypot(...item.independentDerivativeMM.map((value, axis) => value - observation.d1.value.derivative[axis])));
    } else {
      requireFact(observation.d1.status === 'native-refused' && observation.d1.reason === 'First derivative is not defined at an exact C0 interior knot' && observation.d1.nativeErrorName === 'Error', 'Actual native C0 derivative refusal changed'); witnessSummary.refused++;
    }
  });
  requireFact(witnessSummary.maximumPointDifferenceMM <= 1e-7 && witnessSummary.maximumAngleDifferenceRad <= 1e-7 && witnessSummary.maximumDerivativeDifferenceMM <= 1e-7, 'Saved independent witness exceeds existing sampled tolerance');
  requireFact(witnessSummary.evaluated === artifact.report.derivativeEvaluationCount && witnessSummary.refused === artifact.report.derivativeRefusalCount, 'Whole D1 evaluated/refused union count changed');
  assertNative(asset,inputs,'immutable-original-files');
  return {artifact,verification,verificationReport,sameRuntimeRebuilt,sameRuntimeRebuiltReport,legacySavedControl,model,native,witnessSummary};
}

const clone=value=>structuredClone(value);
function errorReceipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message, diagnostics: error.diagnostics ?? [],
    cause: error.cause instanceof Error ? { kind:'error', name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : Array.isArray(error.cause) ? {kind:'diagnostics',count:error.cause.length,diagnostics:clone(error.cause)} : null };
}


/** Identical genuine public recipes. Node uses neutral CPU; browser passes actual SDK methods. */
export function runXYAngleArcSourceRefusals(assets,parse,afterRefusal=()=>{},sourceScope='public-neutral-source',optionsScope='public-neutral-options') {
 const find=key=>assets instanceof Map?assets.get(key):Array.isArray(assets)?assets.find(asset=>asset.key===key):assets[key];
 const base=find('positive_multispan_native_c0'),seam=find('arbitrary_start_full_turn_copied_seam');requireFact(base&&seam,'Authentic refusal inputs required');
 const originals=clone({base,seam}),refusals=[];let getterCalls=0;
 function refuse(name,scope,action,expectedName,expectedCode){let error;try{action();}catch(caught){error=caught;}
  requireFact(error instanceof Error&&error.name===expectedName&&(error.code??null)===expectedCode,'Actual refusal differs: '+name);
  if(name==='owned-source')requireFact(Array.isArray(error.cause)&&error.cause.length===1&&error.cause[0].code==='SYNTAX','Actual compiler SYNTAX diagnostic-array cause required');
  requireFact(getterCalls===0,'Public accessors must not be invoked');assertNative({base,seam},originals,'immutable-original-refusal-inputs');
  const row={...errorReceipt(name,error),scope,getterCalls,acceptedRetained:true};refusals.push(row);afterRefusal(row);
 }
      refuse('request-unit', 'public-native', () => buildXYAngleArc({ ...base.request, angleUnit: 'deg' }), 'XYAngleArcError', 'UNIT');
      refuse('request-zero-sweep', 'public-native', () => buildXYAngleArc({ ...base.request, sweepAngleRad: 0 }), 'XYAngleArcError', 'RANGE');
      const getter = { ...base.request }; Object.defineProperty(getter, 'radiusMM', { enumerable: true, get() { getterCalls++; return 2; } });
      refuse('request-getter', 'public-native', () => buildXYAngleArc(getter), 'XYAngleArcError', 'INPUT');
      for (const [name, asset, edit] of [
        ['owned-source', base, owned => { owned.source = '@model {invalid'; }], ['owned-curve', base, owned => { owned.curve.controlPoints[0][0] += 1; }],
        ['owned-report-angle', base, owned => { owned.report.angleBreaksRad[1] += 0.1; }],
        ['owned-native-c0-reason', base, owned => { owned.report.observations.find(item => item.d1.status === 'native-refused').d1.reason = 'repaired'; }],
        ['owned-native-parameter-is-angle', base, owned => { owned.report.quality.nativeParameterIsAngle = true; }], ['owned-periodic-seam', seam, owned => { owned.report.periodic = true; }],
      ]) {
        refuse(name, 'public-whole-owned', () => { const owned = clone(asset.owned); edit(owned); return verifyXYAngleArcArtifact(owned); }, 'XYAngleArcArtifactError', name==='owned-source'?'SOURCE':name==='owned-curve'?'BINDING':'STRUCTURE');
      }
      refuse('source-owned-binding', 'example-exact-source-guard', () => requireOriginalSourceBinding(base.source, seam.owned), 'TypeError', null);
      refuse('malformed-source', sourceScope, () => parse('@model {invalid'), 'BaroCadUniformCurveSourceError', 'SOURCE');
      refuse('count-one', optionsScope, () => parse(base.source, { ...createNativeOptions(), uniformCurveDisplay: { version: 1, count: 1 } }), 'BaroCadUniformCurveSourceError', 'OPTIONS');
      refuse('unsafe-float32-scale', sourceScope, () => parse(base.source, { ...createNativeOptions(), unitsPerMillimeter: 1e-50 }), 'BaroCadUniformCurveSourceError', 'POSITIONS');
      refuse('portable-angle-association','public-portable-artifact',()=>{const owned=clone(base.owned);owned.report.observations[0].analyticAngleRad+=.001;return verifyXYAngleArcArtifact(owned);},'XYAngleArcArtifactError','ASSOCIATION');
      refuse('portable-owned-report','public-whole-portable-verification',()=>{const verification=verifyXYAngleArcArtifact(base.owned);verification.report.numericalAssociationAccepted=false;return validateXYAngleArcArtifactVerification(verification);},'XYAngleArcArtifactError','OWNED');
      const artifactGetter=clone(base.owned);Object.defineProperty(artifactGetter,'source',{enumerable:true,get(){getterCalls++;return base.source;}});
      refuse('portable-artifact-getter','public-portable-artifact',()=>verifyXYAngleArcArtifact(artifactGetter),'XYAngleArcArtifactError','INPUT');
 requireFact(refusals.length===16&&getterCalls===0,'Exactly16 genuine refusals/getter0 required');return{refusals,getterCalls,acceptedRetained:true};
}
/** Actual shared transport authority, without executing any target constructor in Node. */
export async function runXYAngleArcTransportRefusals(url,loadAsync,afterRefusal=()=>{}){
 const refusals=[];let getterCalls=0;
 async function refuse(name,transport,expectedName,expectedCode,expectedRequestDelta,callerError){const progress=[];let error;try{await loadAsync(url,transport(progress));}catch(caught){error=caught;}
  requireFact(error instanceof Error&&error.name===expectedName&&(error.code??null)===expectedCode,'Actual transport refusal differs: '+name);if(callerError)requireFact(error===callerError,'Actual caller Error identity changed');
  requireFact(getterCalls===0,'Transport accessor invoked');const row={...errorReceipt(name,error),scope:'public-shared-transport',expectedRequestDelta,progress,callerErrorIdentityRetained:callerError?error===callerError:null,getterCalls,acceptedRetained:true};
  refusals.push(row);await afterRefusal(row);
 }
 const event=(progress,value)=>{requireFact(value.loadedBytes>0,'Actual shared progress required');progress.push({...value});};
 await refuse('preabort',()=>{const c=new AbortController();c.abort();return{signal:c.signal};},'AbortError','ABORT_ERR',0);
 await refuse('progressfalse',progress=>({onProgress(value){event(progress,value);return false;}}),'AbortError','ABORT_ERR',1);
 await refuse('callbackabort',progress=>{const c=new AbortController();return{signal:c.signal,onProgress(value){event(progress,value);c.abort();}};},'AbortError','ABORT_ERR',1);
 const callerError=new Error('standing XY angle arc caller progress error');await refuse('standingcallerError',progress=>({onProgress(value){event(progress,value);throw callerError;}}),'Error',null,1,callerError);
 await refuse('onProgressgetter',()=>{const transport={};Object.defineProperty(transport,'onProgress',{enumerable:true,get(){getterCalls++;return()=>{};}});return transport;},'TypeError',null,0);
 requireFact(refusals.length===5&&getterCalls===0&&refusals.slice(1,4).every(row=>row.progress.length>0),'Five actual transport refusals/getter0 required');return{refusals,getterCalls,acceptedRetained:true};
}
