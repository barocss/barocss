import { buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection, compileCadModel,
  evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, sampleCurve } from '@barocss/cad';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';

export const PINS = [
  { file: 'polynomial.actual-world.source0.css', bytes: 253, sha256: 'e81ab0a741e21c7e67fef91474fbc8af6e00bbdad55601d3637c943b58bfc0aa' },
  { file: 'polynomial.authored-request.json', bytes: 1425, sha256: 'e03e88358163c3b9dbf10644af97fd61cd3fbbb5f97be17b4dbfdbb44356332c' },
  { file: 'polynomial.owned-section.json', bytes: 29713, sha256: 'fed476d35708334073dfe85d564af4813dad144b42f212bf974201c9315cd2c0' },
  { file: 'polynomial.surface-uv.dimensionless-sidecar.json', bytes: 310, sha256: 'd303318d3f1d8597afc61891e7bfc72c92af4f28e3deb892c47d2dd1ad37d676' },
  { file: 'polynomial.plane-uv.dimensionless-sidecar.json', bytes: 290, sha256: 'cb271feaa6557dc8136e7753f1e4e9770662a6486ac6a0ad5f637dd6e98b22fc' },
];
export const createNativeOptions = () => ({ sourceVersion: 0, unitsPerMillimeter: 0.001,
  uniformCurveDisplay: { version: 1, count: 129 } });
export const options = createNativeOptions;
export const camera = { eye: [0.005, 0.040, 0.025], target: [0.005, 0.003, 0.0108], up: [0, 1, 0],
  left: -0.0065, right: 0.0065, top: 0.004622222222222222, bottom: -0.004622222222222222,
  near: 0.0001, far: 1, width: 900, height: 640 };
export function requireFact(condition, message) { if (!condition) throw new Error(message); }
export function assertNative(actual, expected, path = 'native') {
  if (typeof expected === 'number') return requireFact(Object.is(actual, expected), `${path}: numeric bits changed`);
  if (expected === null || typeof expected !== 'object') return requireFact(actual === expected, `${path}: value changed`);
  requireFact(actual !== null && typeof actual === 'object', `${path}: missing object`);
  requireFact(Array.isArray(actual) === Array.isArray(expected), `${path}: array shape changed`);
  const keys = Object.keys(expected), actualKeys = Object.keys(actual);
  requireFact(keys.length === actualKeys.length && keys.every(key => Object.hasOwn(actual, key)), `${path}: fields changed`);
  for (const key of keys) assertNative(actual[key], expected[key], `${path}.${key}`);
}
export function assertBuffer(actual, expected, label = 'buffer') {
  requireFact(actual.length === expected.length, `${label}: length changed`);
  for (let index = 0; index < expected.length; index++) requireFact(Object.is(actual[index], expected[index]), `${label}[${index}]: bits changed`);
}
export class SectionUniformThreeHostError extends Error {
  constructor(code, message) { super(message); this.name = 'SectionUniformThreeHostError'; this.code = code; }
}
export function coldModel(source) {
  const result = compileCadModel(source, { sourceVersion: 0 });
  requireFact(result.ok, 'Whole original source failed cold compilation');
  return result.model;
}
export async function loadSectionAsset(readText) {
  const originalTexts = {};
  for (const pin of PINS) {
    const text = await readText(pin.file, pin);
    requireFact(typeof text === 'string' && new TextEncoder().encode(text).length === pin.bytes, `Pinned bytes changed: ${pin.file}`);
    originalTexts[pin.file] = text;
  }
  return { worldSource: originalTexts[PINS[0].file], request: JSON.parse(originalTexts[PINS[1].file]),
    owned: JSON.parse(originalTexts[PINS[2].file]), surfaceUV: JSON.parse(originalTexts[PINS[3].file]),
    planeUV: JSON.parse(originalTexts[PINS[4].file]), originalTexts };
}
export function assertSectionBindings(asset, section) {
  if (asset.worldSource !== section.world.source) throw new SectionUniformThreeHostError('SOURCE_BINDING', 'Original world file does not match the whole section world source');
  try { assertNative(coldModel(asset.worldSource), section.world.model); }
  catch (cause) { if (cause instanceof SectionUniformThreeHostError) throw cause; throw new SectionUniformThreeHostError('SOURCE_BINDING', 'World Model does not match complete section context'); }
  try {
    assertNative(asset.surfaceUV, section.pcurves.surface); assertNative(asset.planeUV, section.pcurves.plane);
    requireFact(asset.surfaceUV.coordinateSystem === 'native-surface-uv' && asset.planeUV.coordinateSystem === 'native-plane-uv', 'UV chart roles changed');
    for (const sidecar of [asset.surfaceUV, asset.planeUV]) {
      requireFact(sidecar.lengthUnit === 'dimensionless', 'UV units changed');
      requireFact(sidecar.curve.controlPoints.every(point => point[2] === 0), 'UV third component changed');
    }
  } catch { throw new SectionUniformThreeHostError('UV_BINDING', 'Dimensionless sidecars do not match their original native chart roles'); }
}
export function proveSection(asset) {
  const before = structuredClone(asset);
  const { request } = asset;
  const section = buildVLinearSurfacePlaneSection(request.surfaceAsset, request.planeAsset, request.options);
  assertNative(validateVLinearSurfacePlaneSection(section), section.report);
  assertNative(section, asset.owned);
  assertNative(validateVLinearSurfacePlaneSection(asset.owned), asset.owned.report);
  assertSectionBindings(asset, section);
  assertNative(coldModel(request.surfaceAsset.source), section.originalModels[0]);
  assertNative(coldModel(request.planeAsset.source), section.originalModels[1]);
  assertNative(section.originalModels[0].objects.map(value => value.id), ['section_first', 'section_second', 'ruled_patch']);
  assertNative(section.originalModels[1].objects.map(value => value.id), ['section_plane']);
  requireFact(section.world.curve.degree === 4 && section.world.curve.weights.every(weight => weight === 24000), 'Original world degree/weights changed');
  requireFact(section.pcurves.surface.curve.degree === 3 && section.pcurves.plane.curve.degree === 4, 'Original UV degrees changed');
  const neutral = parseBaroCadUniformCurveSource(asset.worldSource, createNativeOptions());
  assertNative(neutral.model, section.world.model);
  const samples = sampleCurve(section.world.curve, 129);
  assertNative(neutral.parameters, samples.map(value => value.parameter));
  assertNative(neutral.pointsMM, samples.map(value => value.point));
  for (const [index, observation] of section.observations.entries()) {
    requireFact(observation.parameter === [0, 0.25, 0.5, 0.75, 1][index], 'Original observation parameter changed');
    const parameter = observation.parameter;
    for (const [field, curve] of [['world', section.world.curve], ['surfacePcurve', section.pcurves.surface.curve], ['planePcurve', section.pcurves.plane.curve]]) {
      assertNative(evaluateCurve(curve, parameter), observation[field].d0);
      assertNative(evaluateCurveD1(curve, parameter), observation[field].d1);
    }
    for (const [field, surface, uvField] of [['surface', request.surfaceAsset.surface, 'surfacePcurve'], ['plane', request.planeAsset.surface, 'planePcurve']]) {
      const uv = observation[uvField];
      assertNative(evaluateSurface(surface, uv.d0[0], uv.d0[1]), observation[field].d0);
      const d1 = evaluateSurfaceD1(surface, uv.d0[0], uv.d0[1]);
      assertNative(d1, observation[field].d1);
      assertNative(d1.du.map((value, axis) => value * uv.d1.derivative[0] + d1.dv[axis] * uv.d1.derivative[1]), observation[field + 'Chain']);
    }
    assertNative(neutral.pointsMM[index * 32], observation.world.d0);
    requireFact(observation.residuals.worldToSurfaceMM <= 1e-7 && observation.residuals.worldToPlaneMM <= 1e-7 &&
      observation.residuals.surfaceChainRelative <= 1e-7 && observation.residuals.planeChainRelative <= 1e-7 &&
      observation.residuals.d0ToD1Point.every(value => value <= 1e-7), 'Original native observation bounds changed');
  }
  assertNative(asset, before, 'unchanged-inputs');
  return section;
}
