import {prepareNativeDirectionalLights} from '@barocss/gpu';
import type {NativeDirectionalLightsV0} from '@barocss/gpu';
import {prepareRenderNativeSceneDocument, RENDER_NATIVE_SCENE_LIMITS} from './native-scene-document.js';
import type {RenderNativeSceneDocument, RenderNativeScenePreparation} from './native-scene-document.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export interface RenderNativeDirectionalLightDocumentV1 extends Omit<RenderNativeSceneDocument, 'version' | 'profile' | 'display'> {
  readonly version: 1;
  readonly profile: 'canonical-native-directional-lights-v1';
  readonly display: Omit<RenderNativeSceneDocument['display'], 'lighting'>;
  readonly lights: NativeDirectionalLightsV0;
}
export interface RenderNativeDirectionalLightPreparation extends Omit<RenderNativeScenePreparation, 'document'> {
  readonly document: RenderNativeDirectionalLightDocumentV1;
}
const ROOT = ['format', 'version', 'profile', 'documentId', 'title', 'revision', 'nativeDocument', 'nativeOptions', 'display', 'surfaceMaterials', 'lights'];
const DISPLAY = ['mmToSceneUnit', 'background', 'camera', 'visibleBodyIds', 'poses', 'basis'];
const LIMITED_ARRAYS = new Set(['surfaceMaterials', 'nativeOptions.bodyIds', 'display.visibleBodyIds', 'display.poses', 'lights.lights']);
const encoder = new TextEncoder();
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function budget(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RenderEditorError('DOCUMENT_BYTES', message);
}
function record(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' requires a record.');
  const keys = Object.keys(value);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), label + ' has unsupported or missing fields.');
  return value as Record<string, unknown>;
}
/** Untrusted reflection cannot choose an editor error code or trigger error-object inspection. */
function reflect<T>(operation: () => T): T {
  try {return operation();} catch (cause) {
    const error = new RenderEditorError('DOCUMENT_INPUT', 'Native light scene own-data reflection refused.');
    Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
/** Bound and snapshot own data before provider calls; never invokes getters or toJSON. */
function ownData(input: unknown, pretty = false): {value: unknown; text: string} {
  let visits = 0, units = 0, bytes = 0;
  const chunks: string[] = [], active = new Set<object>();
  const append = (text: string): void => {
    units += text.length; bytes += encoder.encode(text).length;
    budget(units <= RENDER_NATIVE_SCENE_LIMITS.fileBytes && bytes <= RENDER_NATIVE_SCENE_LIMITS.fileBytes,
      'Native light scene exceeds 2097152 signed JSON bytes or units.');
    chunks.push(text);
  };
  const string = (value: string): void => {
    budget(value.length <= RENDER_NATIVE_SCENE_LIMITS.fileBytes && encoder.encode(value).length <= RENDER_NATIVE_SCENE_LIMITS.fileBytes,
      'Native light scene string exceeds its byte limit.');
    append(JSON.stringify(value));
  };
  const visit = (value: unknown, depth: number, path: string): unknown => {
    check(++visits <= RENDER_NATIVE_SCENE_LIMITS.inputValues && depth <= RENDER_NATIVE_SCENE_LIMITS.inputDepth,
      'Native light scene exceeds its value or depth limit.');
    if (typeof value === 'number') {check(Number.isFinite(value), 'Native light scene requires finite Numbers.'); append(Object.is(value, -0) ? '-0' : String(value)); return value;}
    if (typeof value === 'string') {string(value); return value;}
    if (value === null || typeof value === 'boolean') {append(String(value)); return value;}
    check(typeof value === 'object', 'Native light scene requires ordinary own data.');
    const array = reflect(() => Array.isArray(value)), prototype = reflect(() => Object.getPrototypeOf(value));
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'Native light scene refuses foreign prototypes.');
    check(!active.has(value), 'Native light scene refuses cyclic data.');
    let length = 0;
    if (array) {
      const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, 'length'));
      check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value) && descriptor.value >= 0, 'Native light scene requires own array length.');
      length = descriptor.value as number;
      check(length <= (LIMITED_ARRAYS.has(path) ? 4 : RENDER_NATIVE_SCENE_LIMITS.inputArrayElements), 'Native light scene exceeds array cardinality.');
    }
    const keys = reflect(() => Reflect.ownKeys(value));
    if (array) check(keys.length === length + 1 && keys.every(key => key === 'length' || typeof key === 'string'
      && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length), 'Native light scene requires dense arrays without extra fields.');
    else check(keys.length <= RENDER_NATIVE_SCENE_LIMITS.inputRecordFields, 'Native light scene exceeds record fields.');
    const output: unknown[] | Record<string, unknown> = array ? [] : {};
    active.add(value); append(array ? '[' : '{');
    try {
      const names = array ? Array.from({length}, (_, index) => String(index)) : keys;
      names.forEach((name, index) => {
        check(typeof name === 'string', 'Native light scene refuses symbol fields.');
        const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, name));
        check(descriptor && 'value' in descriptor && descriptor.enumerable, 'Native light scene refuses accessors or hidden fields.');
        if (index) append(pretty ? ',\n' : ',');
        else if (pretty) append('\n');
        if (pretty) append('  '.repeat(depth + 1));
        if (!array) {string(name); append(pretty ? ': ' : ':');}
        Object.defineProperty(output, name, {value: visit(descriptor.value, depth + 1, path ? path + '.' + name : name),
          enumerable: true, configurable: true, writable: true});
      });
      if (pretty && names.length) append('\n' + '  '.repeat(depth));
      append(array ? ']' : '}'); return output;
    } finally {active.delete(value);}
  };
  const value = visit(input, 0, '');
  if (pretty) append('\n');
  return {value, text: chunks.join('')};
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {for (const child of Object.values(value)) freeze(child); Object.freeze(value);}
  return value;
}
function guarded<T>(operation: () => T): T {
  try {return operation();} catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
function textBudget(text: unknown): asserts text is string {
  check(typeof text === 'string', 'Native light scene file must be text.');
  budget(text.length <= RENDER_NATIVE_SCENE_LIMITS.fileBytes && encoder.encode(text).length <= RENDER_NATIVE_SCENE_LIMITS.fileBytes,
    'Native light scene file exceeds 2097152 bytes or units.');
}

/** Internal bridge, deliberately absent from the public barrel. Reconstruct the real native source once. */
export function prepareDirectionalDocument(input: unknown): {preparation: RenderNativeDirectionalLightPreparation; legacy: RenderNativeScenePreparation} {
  return guarded(() => {
    const owned = ownData(input).value;
    check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'Native light scene requires a record.');
    const envelope = owned as Record<string, unknown>;
    if (envelope.format !== 'barocss-render-editor-native-scene' || envelope.version !== 1 || envelope.profile !== 'canonical-native-directional-lights-v1')
      throw new RenderEditorError('DOCUMENT_VERSION', 'Unsupported native light scene version or profile.');
    const data = record(owned, ROOT, 'Native light scene');
    const display = record(data.display, DISPLAY, 'Native light display');
    const rawLights = record(data.lights, ['format', 'version', 'profile', 'sourceId', 'revision', 'ambientStrength', 'lights'], 'Native light catalog');
    if (rawLights.format !== 'barocss-gpu-native-directional-lights' || rawLights.version !== 0 || rawLights.profile !== 'native-world-directional-linear-v0')
      throw new RenderEditorError('DOCUMENT_VERSION', 'Unsupported native light catalog version or profile.');
    check(rawLights.sourceId === data.documentId && Object.is(rawLights.revision, data.revision), 'Light catalog and scene owner/revision differ.');
    const lights = prepareNativeDirectionalLights(rawLights).catalog;
    const rest = {...data}; delete rest.lights;
    const legacyInput = {...rest, version: 0, profile: 'canonical-native-opaque-scene-v0',
      display: {...display, lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}}};
    // Charge the legacy provider's pretty canonical representation before its encoder joins it.
    ownData(legacyInput, true);
    const legacy = prepareRenderNativeSceneDocument(legacyInput);
    check(legacy.entries.length >= 1 && legacy.entries.length <= 4 && legacy.entries.every(entry => entry.kind === 'surface'), 'Native light scene requires 1..4 selected Surfaces.');
    check(legacy.document.display.visibleBodyIds.length >= 1, 'Native light scene requires at least one visible Surface.');
    const {lighting: _lighting, ...authoredDisplay} = legacy.document.display; void _lighting;
    const document: RenderNativeDirectionalLightDocumentV1 = freeze({...legacy.document, version: 1,
      profile: 'canonical-native-directional-lights-v1', display: authoredDisplay, lights});
    textBudget(ownData(document).text + '\n');
    return {preparation: Object.freeze({...legacy, document}), legacy};
  });
}
/** CPU reconstruction only, never a renderer acceptance certificate. */
export function prepareRenderNativeDirectionalLightDocument(input: unknown): RenderNativeDirectionalLightPreparation {
  return prepareDirectionalDocument(input).preparation;
}
export function parseRenderNativeDirectionalLightDocument(text: string): RenderNativeDirectionalLightDocumentV1 {
  return guarded(() => {textBudget(text); return prepareRenderNativeDirectionalLightDocument(JSON.parse(text)).document;});
}
export function serializeRenderNativeDirectionalLightDocument(input: RenderNativeDirectionalLightDocumentV1): string {
  return guarded(() => {const text = ownData(prepareRenderNativeDirectionalLightDocument(input).document).text + '\n'; textBudget(text); return text;});
}
/** Explicit value-preserving conversion, not an assertion of cross-backend pixel equivalence. */
export function upgradeRenderNativeSceneToDirectionalLights(input: RenderNativeSceneDocument): RenderNativeDirectionalLightDocumentV1 {
  return guarded(() => {
    // Capture original own values BEFORE the legacy validator derives normalized execution lighting.
    const owned = ownData(input, true).value as RenderNativeSceneDocument;
    const legacy = prepareRenderNativeSceneDocument(owned).document;
    const {lighting: _lighting, ...display} = legacy.display; void _lighting;
    const original = owned.display.lighting;
    return prepareRenderNativeDirectionalLightDocument({...legacy, version: 1, profile: 'canonical-native-directional-lights-v1', display,
      lights: {format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0',
        sourceId: legacy.documentId, revision: legacy.revision, ambientStrength: original.ambientStrength,
        lights: [{nodeId: 'legacy-directional', label: 'Legacy directional', enabled: true, directionScene: original.direction,
          colorLinearRGB: [1, 1, 1], intensity: original.directionalStrength}]}}).document;
  });
}
