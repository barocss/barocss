import { classifyVLinearSurfacePlaneTrimUV, validateVLinearSurfacePlaneTrimUVClassification, compileCadModel } from '@barocss/cad';

export const CASE_KEYS = Object.freeze(['dyadic_exact', 'primary_cap_sixteen', 'edited_source_rebuild']);
export const PINS = Object.freeze([
  {
    "file": "dyadic_exact.authored-classification-request.json",
    "bytes": 90701,
    "sha256": "f19676a4341bb9905f0dc6b621cd905327e2051eb22b4fbcca86d9bfa91c73e2"
  },
  {
    "file": "dyadic_exact.owned-classification.json",
    "bytes": 100143,
    "sha256": "c2eef0e1232a6a897fd5565b4a6eea8c26f70db327aa5d47aa5b2eb9c6214a95"
  },
  {
    "file": "dyadic.actual-trim-model8.source0.css",
    "bytes": 1078,
    "sha256": "c9ff1774362b447d764afc922aec3043229f064ff48f707124d13a90af4c2e70"
  },
  {
    "file": "dyadic.bottom.dimensionless-uv.json",
    "bytes": 192,
    "sha256": "b51156e07b6f385043e7bd45b00bd8c6aff6b595d3283d4e1e8e86c09952314a"
  },
  {
    "file": "dyadic.rightLow.dimensionless-uv.json",
    "bytes": 201,
    "sha256": "0936282441de2371600761c7c6853da5c9ec6ce9d79dc81184fde885a7bea869"
  },
  {
    "file": "dyadic.rightHigh.dimensionless-uv.json",
    "bytes": 201,
    "sha256": "a0ebea85265209648106a85003a09f8afa25bf229fea839ad31ca5e77730e8f4"
  },
  {
    "file": "dyadic.top.dimensionless-uv.json",
    "bytes": 192,
    "sha256": "974dd8d2dd691aca08334151a9e9b3d536fed7b8eb5b69890f59ef675af604b8"
  },
  {
    "file": "dyadic.leftLow.dimensionless-uv.json",
    "bytes": 201,
    "sha256": "57fc01fd9936752f66d6c0705b4984934851d3980b78fa56374e87079b7d1a43"
  },
  {
    "file": "dyadic.leftHigh.dimensionless-uv.json",
    "bytes": 201,
    "sha256": "754fb8ada8b6c338b13f6fb63e27217d2120d832d07b6516e4d5348b5cdc13d8"
  },
  {
    "file": "dyadic.sharedCut.dimensionless-uv.json",
    "bytes": 236,
    "sha256": "ebe950c09687667fcf3c986057753cfa3499db237c2e01752b5bd41f84d0bffd"
  },
  {
    "file": "dyadic.original-support-whole.source0.css",
    "bytes": 437,
    "sha256": "240468164d12e9793247a87f1c0539ee2f395223069ae8d03f4d70bf89ac7ba3"
  },
  {
    "file": "dyadic.original-plane-whole.source0.css",
    "bytes": 227,
    "sha256": "ec2fb0e6e8e28a733ac7d820c49824aa640e2333a427576f691ab89c0d46ed3d"
  },
  {
    "file": "primary_cap_sixteen.authored-classification-request.json",
    "bytes": 105935,
    "sha256": "2f8ebfdaf6c8a33bee6a0b5d31489df1eb51ea2d1c59e7135b21f5c4261c8392"
  },
  {
    "file": "primary_cap_sixteen.owned-classification.json",
    "bytes": 121641,
    "sha256": "52d14096d99e1e25039d4de7e5028967dcd17605e0b863829ba3f84709371d6e"
  },
  {
    "file": "primary.actual-trim-model8.source0.css",
    "bytes": 1281,
    "sha256": "620c92af37f7566c0e12748e750276fdd372f0f19409fe7be6553c567608a7de"
  },
  {
    "file": "primary.bottom.dimensionless-uv.json",
    "bytes": 193,
    "sha256": "fea14e242e674eeea76dfb252b50dbbbac7325ac6814a47c69139c69a1b242b9"
  },
  {
    "file": "primary.rightLow.dimensionless-uv.json",
    "bytes": 199,
    "sha256": "5a4dbde13e7258ec74c857676f53eb43c226ba33db5d3e5c6b3a1ca04794305e"
  },
  {
    "file": "primary.rightHigh.dimensionless-uv.json",
    "bytes": 199,
    "sha256": "6d71ab4b48ec35d19c762ff8472513c9caffc60cb0e1253302c622296e11427a"
  },
  {
    "file": "primary.top.dimensionless-uv.json",
    "bytes": 193,
    "sha256": "651280c49959a6846078493dffb5a6159520f2d70dfdd60a1721781b125df13c"
  },
  {
    "file": "primary.leftLow.dimensionless-uv.json",
    "bytes": 199,
    "sha256": "816edf34437041eb7505a7aad7b35c30355bf041c97741edad15cd98451252ff"
  },
  {
    "file": "primary.leftHigh.dimensionless-uv.json",
    "bytes": 199,
    "sha256": "cd0304fa577ff08097307b391e34d70d74e15825f51dab230a8c1326c7ed5634"
  },
  {
    "file": "primary.sharedCut.dimensionless-uv.json",
    "bytes": 317,
    "sha256": "e6d331bce8a1f3c3f8b54ebe646dbd611d660c3a08ef309fb571d056cd19f9b2"
  },
  {
    "file": "primary.original-support-whole.source0.css",
    "bytes": 511,
    "sha256": "ab61f8ba3074f69807868b428c53486ec1ca451bf593ab4c7a81121344ffa31c"
  },
  {
    "file": "primary.original-plane-whole.source0.css",
    "bytes": 231,
    "sha256": "e70f44cf151ec1d319ad897b3d60a7b427d23b8de3164877847f627b45285292"
  },
  {
    "file": "edited_source_rebuild.authored-classification-request.json",
    "bytes": 103813,
    "sha256": "be1fe3d4447f7dbff7baf84e48ff4b2bd251a8d4d8d48c6d709a96b438c94332"
  },
  {
    "file": "edited_source_rebuild.owned-classification.json",
    "bytes": 111889,
    "sha256": "219b2909293459d67a066883911b2a62d5ca80674530581f72532d47fed86109"
  },
  {
    "file": "edited.actual-trim-model8.source0.css",
    "bytes": 1245,
    "sha256": "994b3e632ec2490bcfe171e0900be10ac0ef812364db715477de297329230602"
  },
  {
    "file": "edited.bottom.dimensionless-uv.json",
    "bytes": 192,
    "sha256": "beb8f618ce1f2f8196e609893ac07ea31cbc1065c646ea217c3c6c2140d4be3e"
  },
  {
    "file": "edited.rightLow.dimensionless-uv.json",
    "bytes": 198,
    "sha256": "ea3635f3066145c88ce1f5602bb02748af712ff61c0637563a2540fcdf779574"
  },
  {
    "file": "edited.rightHigh.dimensionless-uv.json",
    "bytes": 198,
    "sha256": "5f6721ee58051709234ebd207d337e526462807f46f977fc9d5c18946e35e907"
  },
  {
    "file": "edited.top.dimensionless-uv.json",
    "bytes": 192,
    "sha256": "8fc5c0d23f0e798a37b84f3f4b74ac2d117113f0b8c510c8126db3bf01eab896"
  },
  {
    "file": "edited.leftLow.dimensionless-uv.json",
    "bytes": 198,
    "sha256": "4c170bf6d53a45c1b4bdfe05ccddadfc4fb939a359310bf89e91e4a422e55340"
  },
  {
    "file": "edited.leftHigh.dimensionless-uv.json",
    "bytes": 198,
    "sha256": "6f0fe6147235e19f268f569628ddb1e84392e6dc8110c81ade28982ae2b6e838"
  },
  {
    "file": "edited.sharedCut.dimensionless-uv.json",
    "bytes": 316,
    "sha256": "dc33e3e11277cd14f0a23959b7fd64d2e3a6c82dfd1d8d01e4d475535390ceb0"
  },
  {
    "file": "edited.original-support-whole.source0.css",
    "bytes": 511,
    "sha256": "38c9ceee0ffbba81c991ec029424d5471dcfed4481e575e8ad92fac86eb0e656"
  },
  {
    "file": "edited.original-plane-whole.source0.css",
    "bytes": 231,
    "sha256": "e70f44cf151ec1d319ad897b3d60a7b427d23b8de3164877847f627b45285292"
  }
]);

const PREFIXES = { dyadic_exact: 'dyadic', primary_cap_sixteen: 'primary', edited_source_rebuild: 'edited' };
const ROLES = ['bottom', 'rightLow', 'rightHigh', 'top', 'leftLow', 'leftHigh', 'sharedCut'];
export function requireFact(value, message) { if (!value) throw new Error(message); }
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
export async function loadCase(key, readText) {
  requireFact(CASE_KEYS.includes(key), 'Unknown trim classification family');
  const prefix = PREFIXES[key];
  const pins = PINS.filter(pin => pin.file.startsWith(prefix + '.') || pin.file.startsWith(key + '.'));
  requireFact(pins.length === 12, 'Expected exact twelve authentic inputs per family');
  const texts = new Map(await Promise.all(pins.map(async pin => {
    const text = await readText(pin.file);
    requireFact(typeof text === 'string', 'Expected original input text');
    const bytes = new TextEncoder().encode(text);
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      value => value.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.length === pin.bytes && sha256 === pin.sha256, 'Original input bytes/hash changed: ' + pin.file);
    return [pin.file, text];
  })));
  return { key, prefix, source: texts.get(prefix + '.actual-trim-model8.source0.css'),
    request: JSON.parse(texts.get(key + '.authored-classification-request.json')),
    owned: JSON.parse(texts.get(key + '.owned-classification.json')),
    sidecars: new Map(ROLES.map(role => [role, JSON.parse(texts.get(prefix + '.' + role + '.dimensionless-uv.json'))])),
    parentSources: [texts.get(prefix + '.original-support-whole.source0.css'), texts.get(prefix + '.original-plane-whole.source0.css')] };
}
function cold(source) {
  const result = compileCadModel(source, { sourceVersion: 0 });
  requireFact(result.ok, 'Actual source compiler refused: ' + JSON.stringify(result.diagnostics));
  return result.model;
}
export function proveCase(asset) {
  const requestBefore = structuredClone(asset.request), ownedBefore = structuredClone(asset.owned);
  const request = asset.request;
  const classification = classifyVLinearSurfacePlaneTrimUV(request.trim, request.queries, request.options);
  assertNative(classification, asset.owned, 'Whole actual classification differs from saved original');
  assertNative(validateVLinearSurfacePlaneTrimUVClassification(asset.owned), asset.owned.report, 'Whole classifier validator differs');
  requireFact(asset.source === request.trim.world.source, 'Complete world source differs from original trim');
  const model = cold(asset.source), trim = classification.trim;
  assertNative(model, trim.world.model, 'Cold complete world Model differs');
  requireFact(model.version === 0 && model.lengthUnit === 'mm' && model.objects.length === 8, 'Expected version0/mm/eight native objects');
  requireFact(model.objects.filter(object => object.kind === 'surface').length === 1 &&
    model.objects.filter(object => object.kind === 'curve').length === 7, 'Expected original Support and seven native Curves');
  requireFact(trim.vertices.length === 6 && trim.edges.length === 7 && trim.loops.length === 2 && trim.faces.length === 2, 'Original trim graph counts changed');
  requireFact(asset.sidecars.size === 7, 'Expected seven original dimensionless sidecars');
  for (const edge of trim.edges) {
    assertNative(asset.sidecars.get(edge.role), edge.pcurve, 'Original dimensionless UV sidecar differs');
    requireFact(edge.pcurve.lengthUnit === 'dimensionless' && edge.pcurve.coordinateSystem === 'native-surface-uv', 'UV must remain dimensionless original chart data');
  }
  requireFact(asset.parentSources[0] === trim.section.surfaceAsset.source &&
    asset.parentSources[1] === trim.section.planeAsset.source, 'Complete original parent source changed');
  for (const [index, source] of asset.parentSources.entries()) {
    assertNative(cold(source), trim.section.originalModels[index], 'Original parent cold Model differs');
  }
  requireFact(trim.section.originalModels[0].objects.length === 3 && trim.section.originalModels[1].objects.length === 1, 'Original separate parent Model counts changed');
  requireFact(classification.report.lengthUnit === 'dimensionless' && classification.report.quality.worldProjectionPerformed === false &&
    classification.report.quality.idealPlaneSideCertified === false && classification.report.quality.solid === false &&
    classification.report.quality.insideOutsideCertified === false, 'Native classification authority changed');
  const controls = [];
  if (asset.key === 'dyadic_exact') {
    const result = classifyVLinearSurfacePlaneTrimUV(trim,
      [{ queryId: 'loader_outside_query', u: -0.5, v: 0.5 }],
      { evaluationId: 'loader_outside_control', maxQueries: 1, maxSubdivisions: 16 });
    assertNative(validateVLinearSurfacePlaneTrimUVClassification(result), result.report, 'Outside-chart success validator differs');
    requireFact(result.classifications[0].chart === 'outside' && result.classifications[0].cutRelation === 'not-applicable' &&
      result.classifications[0].faces.every(face => face.classification === 'outside'), 'Finite outside-chart must succeed');
    controls.push({ name: 'outside-chart', result });
  }
  if (asset.key === 'primary_cap_sixteen') {
    requireFact(classification.classifications.length === 1 && classification.classifications[0].cutRelation === 'uncertain' &&
      classification.classifications[0].faces.every(face => face.classification === 'uncertain'), 'Original cap16 uncertainty changed');
    const result = classifyVLinearSurfacePlaneTrimUV(trim, request.queries,
      { evaluationId: 'loader_zero_control', maxQueries: 4, maxSubdivisions: 0 });
    assertNative(validateVLinearSurfacePlaneTrimUVClassification(result), result.report, 'Zero-cap success validator differs');
    requireFact(result.classifications[0].cutRelation === 'uncertain' && result.classifications[0].faces.every(face => face.classification === 'uncertain'), 'Iteration limit is uncertain success');
    controls.push({ name: 'zero-subdivision', result });
  }
  assertNative(asset.request, requestBefore, 'Original request changed');
  assertNative(asset.owned, ownedBefore, 'Original whole saved result changed');
  return { model, classification, trim, controls };
}
