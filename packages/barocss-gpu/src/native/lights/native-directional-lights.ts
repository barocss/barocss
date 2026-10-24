import { BarocssError } from '../../core/barocss-error.js';
import { ownRecord, copyGpuData, freezeGpuData } from '../../mesh/gpu-data.js';
import type { RGB, Vec3 } from '../../scene/scene-types.js';

export const NativeDirectionalLightsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET',
  IDENTITY: 'IDENTITY', NUMERICAL: 'NUMERICAL',
} as const);
export type NativeDirectionalLightsDiagnosticCode =
  typeof NativeDirectionalLightsDiagnosticCode[keyof typeof NativeDirectionalLightsDiagnosticCode];

export class NativeDirectionalLightsError extends BarocssError {
  constructor(readonly code: NativeDirectionalLightsDiagnosticCode, detail: string, cause?: unknown) {
    super(code, 'Native directional lights: ' + detail,
      arguments.length > 2 ? { cause, maxLength: 1024 } : { maxLength: 1024 });
    this.name = 'NativeDirectionalLightsError';
  }
}

export interface NativeDirectionalLightV0 {
  nodeId: string;
  label: string;
  enabled: boolean;
  directionScene: Vec3;
  colorLinearRGB: RGB;
  intensity: number;
}
export interface NativeDirectionalLightsV0 {
  format: 'barocss-gpu-native-directional-lights';
  version: 0;
  profile: 'native-world-directional-linear-v0';
  sourceId: string;
  revision: number;
  ambientStrength: number;
  lights: NativeDirectionalLightV0[];
}
export interface NativeDirectionalLightExecution {
  nodeId: string;
  enabled: boolean;
  unitDirection: Vec3;
  colorLinearRGB: RGB;
  intensity: number;
}
export interface PreparedNativeDirectionalLights {
  readonly catalog: NativeDirectionalLightsV0;
  readonly execution: NativeDirectionalLightExecution[];
}

const CODE = NativeDirectionalLightsDiagnosticCode;
const ROOT_FIELDS = ['format', 'version', 'profile', 'sourceId', 'revision', 'ambientStrength', 'lights'];
const LIGHT_FIELDS = ['nodeId', 'label', 'enabled', 'directionScene', 'colorLinearRGB', 'intensity'];
function check(value: unknown, code: NativeDirectionalLightsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new NativeDirectionalLightsError(code, detail);
}
/** Catch raw reflective failures at their boundary, including caller-thrown public errors. */
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new NativeDirectionalLightsError(CODE.INPUT, 'Own data reflection refused', cause); }
}
function record(input: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object', CODE.INPUT, label + ' requires an own data record');
  const prototype = reflect(() => Object.getPrototypeOf(input));
  check(prototype === Object.prototype || prototype === null, CODE.INPUT, label + ' requires a plain data record');
  const keys = reflect(() => Reflect.ownKeys(input as object));
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)),
    CODE.INPUT, label + ' has missing or unsupported fields');
  const stable: Record<string, unknown> = {};
  for (const key of fields) {
    const descriptor = reflect(() => Object.getOwnPropertyDescriptor(input, key));
    check(descriptor && 'value' in descriptor && descriptor.enumerable,
      CODE.INPUT, label + ' fields must be own enumerable data');
    Object.defineProperty(stable, key, { value: descriptor.value, enumerable: true });
  }
  // Only trusted snapshots reach the shared utility; no caller reflection occurs here.
  return ownRecord(stable, fields);
}
function count(input: unknown, maximum: number, label: string, exact = false): number {
  check(reflect(() => Array.isArray(input)), CODE.INPUT, label + ' requires a plain array');
  check(reflect(() => Object.getPrototypeOf(input)) === Array.prototype,
    CODE.INPUT, label + ' requires a plain array');
  const descriptor = reflect(() => Object.getOwnPropertyDescriptor(input, 'length'));
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value) && descriptor.value >= 0,
    CODE.INPUT, label + ' requires an own array length');
  const length = descriptor.value as number;
  check(length <= maximum, CODE.BUDGET, label + ' exceeds its cardinality limit');
  check(!exact || length === maximum, CODE.INPUT, label + ' requires exactly three components');
  return length;
}
function dense(input: unknown, length: number, label: string): unknown[] {
  const keys = reflect(() => Reflect.ownKeys(input as object));
  check(keys.length === length + 1 && keys.includes('length') && keys.every(key => key === 'length' ||
    typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length),
  CODE.INPUT, label + ' requires dense own data without extra fields');
  const values: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = reflect(() => Object.getOwnPropertyDescriptor(input, String(index)));
    check(descriptor && 'value' in descriptor && descriptor.enumerable,
      CODE.INPUT, label + ' elements must be own enumerable data');
    values.push(descriptor.value);
  }
  return values;
}
function identifier(input: unknown, maximum: number, label: string): string {
  check(typeof input === 'string' && input.length <= maximum && /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(input),
    CODE.IDENTITY, label + ' requires a bounded ASCII identifier');
  return input;
}
function number(input: unknown, minimum: number, maximum: number, label: string): number {
  check(typeof input === 'number', CODE.INPUT, label + ' requires a Number');
  check(Number.isFinite(input) && input >= minimum && input <= maximum,
    CODE.NUMERICAL, label + ' is nonfinite or outside its range');
  return input;
}
function normalized(direction: Vec3): Vec3 {
  const scale = Math.max(...direction.map(Math.abs));
  check(Number.isFinite(scale) && scale > 0, CODE.NUMERICAL, 'Direction must be nonzero with a safe scale');
  const scaled = direction.map(value => value / scale);
  const length = Math.hypot(...scaled);
  check(Number.isFinite(length) && length > 0, CODE.NUMERICAL, 'Direction normalization length is unsafe');
  const result = scaled.map(value => value / length) as Vec3;
  check(result.every(Number.isFinite), CODE.NUMERICAL, 'Unit direction is nonfinite');
  return result;
}
/** Count the whole signed representation before final copies, without a large joined string. */
function boundedResult(value: PreparedNativeDirectionalLights): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(utf16 <= 16384 && utf8 <= 16384, CODE.BUDGET, 'Complete catalog and execution exceed16KiB');
  };
  const visit = (item: unknown): void => {
    if (typeof item === 'number') { append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return; }
    if (item === null || typeof item !== 'object') { append(JSON.stringify(item)); return; }
    if (Array.isArray(item)) {
      append('['); item.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return;
    }
    append('{'); Object.entries(item).forEach(([key, child], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child);
    }); append('}');
  };
  visit(value);
}

/** Prepare independent authored light source and execution directions; no frame or GL admission. */
export function prepareNativeDirectionalLights(input: unknown): PreparedNativeDirectionalLights {
  const root = record(input, ROOT_FIELDS, 'Catalog');
  check(root.format === 'barocss-gpu-native-directional-lights' && root.version === 0 &&
    root.profile === 'native-world-directional-linear-v0', CODE.VERSION, 'Unsupported catalog format, version or profile');
  const sourceId = identifier(root.sourceId, 64, 'sourceId');
  check(typeof root.revision === 'number' && Number.isSafeInteger(root.revision) && root.revision >= 0,
    CODE.NUMERICAL, 'revision requires a nonnegative safe integer tag');
  const revision = root.revision as number;
  const ambientStrength = number(root.ambientStrength, 0, 1, 'ambientStrength');
  const lightCount = count(root.lights, 4, 'Lights');
  const entries = dense(root.lights, lightCount, 'Lights');
  const seen = new Set<string>();
  const admitted = entries.map((entry, index) => {
    const label = 'Lights[' + index + ']';
    const data = record(entry, LIGHT_FIELDS, label);
    const nodeId = identifier(data.nodeId, 48, 'nodeId');
    check(!seen.has(nodeId), CODE.IDENTITY, 'Light nodeIds must be unique within the source');
    seen.add(nodeId);
    check(typeof data.label === 'string', CODE.INPUT, label + ' label requires text');
    check(data.label.length <= 128 && new TextEncoder().encode(data.label).length <= 128,
      CODE.BUDGET, label + ' label exceeds128 UTF16 or UTF8 units');
    check(typeof data.enabled === 'boolean', CODE.INPUT, label + ' enabled requires a boolean');
    const intensity = number(data.intensity, 0, 1, label + ' intensity');
    // Both vector cardinalities precede any vector key/element reflection or copy.
    count(data.directionScene, 3, label + ' directionScene', true);
    count(data.colorLinearRGB, 3, label + ' colorLinearRGB', true);
    return { data, nodeId, label: data.label, enabled: data.enabled, intensity };
  });
  const lights: NativeDirectionalLightV0[] = admitted.map(({ data, nodeId, label, enabled, intensity }) => {
    const directionScene = dense(data.directionScene, 3, 'directionScene')
      .map(value => number(value, -1000, 1000, 'directionScene component')) as Vec3;
    check(directionScene.some(value => value !== 0), CODE.NUMERICAL, 'directionScene must be nonzero');
    const colorLinearRGB = dense(data.colorLinearRGB, 3, 'colorLinearRGB')
      .map(value => number(value, 0, 1, 'colorLinearRGB component')) as RGB;
    return { nodeId, label, enabled, directionScene, colorLinearRGB, intensity };
  });
  const catalog: NativeDirectionalLightsV0 = {
    format: 'barocss-gpu-native-directional-lights', version: 0,
    profile: 'native-world-directional-linear-v0', sourceId, revision, ambientStrength, lights,
  };
  const execution: NativeDirectionalLightExecution[] = lights.map(light => ({
    nodeId: light.nodeId, enabled: light.enabled, unitDirection: normalized(light.directionScene),
    colorLinearRGB: [...light.colorLinearRGB] as RGB, intensity: light.intensity,
  }));
  const result: PreparedNativeDirectionalLights = { catalog, execution };
  boundedResult(result);
  return freezeGpuData(copyGpuData(result));
}
