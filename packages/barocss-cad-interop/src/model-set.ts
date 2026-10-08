import { validateAdaptiveCurveSamples, validateWideAdaptiveCurveSamples } from '@barocss/cad';
import type { AdaptiveCurveSamplingResult, WideAdaptiveCurveSamplingResult } from '@barocss/cad';
import { loadBaroCadSource, validateBaroCadParseOptions } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { BaroCadLoadAbortError, throwIfBaroCadAborted } from './transport.js';
import { copyCadPreviewPacket } from './packet.js';
import type { CadPreviewPacket } from './packet.js';

export interface BaroCadModelSetManifest {
  format: 'barocad-model-set';
  version: 0;
  entries: Array<{ aliasId: string; url: string; options: BaroCadParseOptions }>;
}

export interface BaroCadModelSetProgress {
  readonly aliasId: string;
  readonly url: string;
  readonly loadedBytes: number;
  readonly aggregateLoadedBytes: number;
  readonly declaredTotalBytes?: number;
}

export interface BaroCadModelSetLoadOptions {
  baseURL?: string;
  signal?: AbortSignal;
  onProgress?: (event: BaroCadModelSetProgress) => void | false;
}

export interface BaroCadModelSetEntry {
  readonly aliasId: string;
  readonly url: string;
  readonly result: BaroCadNativeResult;
}

export interface BaroCadModelSetResult {
  readonly format: 'barocad-model-set';
  readonly version: 0;
  readonly entries: ReadonlyArray<BaroCadModelSetEntry>;
  readonly totalLoadedBytes: number;
}

export interface BaroCadModelSetDisplayBinding {
  /** Derived packet label for one display scene, never a native CAD ID. */
  readonly displaySurfaceId: string;
  readonly aliasId: string;
  readonly modelId: string;
  readonly surfaceId: string;
  readonly sourceURL: string;
}

export interface BaroCadModelSetDisplayEntry {
  /** Owned PreviewPacket v0 copy with a qualified display surfaceId. */
  readonly packet: CadPreviewPacket;
  readonly binding: BaroCadModelSetDisplayBinding;
}

export interface BaroCadModelSetPrimitiveDisplayBinding {
  /** Unique label in this display projection, never a native CAD object ID. */
  readonly displayGeometryId: string;
  readonly aliasId: string;
  readonly modelId: string;
  readonly geometryId: string;
  readonly geometryKind: 'surface' | 'curve';
  readonly sourceURL: string;
}

export type BaroCadModelSetPrimitiveDisplayEntryV1 =
  | { readonly kind: 'surface'; readonly packet: CadPreviewPacket;
      readonly binding: BaroCadModelSetPrimitiveDisplayBinding }
  | { readonly kind: 'curve'; readonly sampleVersion: 0;
      readonly sample: AdaptiveCurveSamplingResult;
      readonly basis: 'authored-xyz-matches-rhyup';
      readonly binding: BaroCadModelSetPrimitiveDisplayBinding }
  | { readonly kind: 'curve'; readonly sampleVersion: 1;
      readonly sample: WideAdaptiveCurveSamplingResult;
      readonly basis: 'authored-xyz-matches-rhyup';
      readonly binding: BaroCadModelSetPrimitiveDisplayBinding };

export interface BaroCadModelSetPrimitiveNativeRefV2 {
  /** Caller-scoped alias with '-' encoded as '.', not the native Model name. */
  readonly modelId: string;
  /** Original native Surface or Curve ID. */
  readonly geometryId: string;
}

export type BaroCadModelSetPrimitiveNativeEntryV2 =
  | { readonly kind: 'surface'; readonly packet: CadPreviewPacket;
      readonly ref: BaroCadModelSetPrimitiveNativeRefV2;
      readonly binding: BaroCadModelSetPrimitiveDisplayBinding }
  | { readonly kind: 'curve'; readonly sampleVersion: 0;
      readonly sample: AdaptiveCurveSamplingResult;
      readonly basis: 'authored-xyz-matches-rhyup';
      readonly ref: BaroCadModelSetPrimitiveNativeRefV2;
      readonly binding: BaroCadModelSetPrimitiveDisplayBinding }
  | { readonly kind: 'curve'; readonly sampleVersion: 1;
      readonly sample: WideAdaptiveCurveSamplingResult;
      readonly basis: 'authored-xyz-matches-rhyup';
      readonly ref: BaroCadModelSetPrimitiveNativeRefV2;
      readonly binding: BaroCadModelSetPrimitiveDisplayBinding };

function record(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || !actual.every(key => typeof key === 'string' && keys.includes(key))) {
    throw new TypeError(`${label} requires ${keys.join(', ')} only`);
  }
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError(`${label} ${key} must be data`);
    output[key] = descriptor.value;
  }
  return output;
}

function loadOptions(input: unknown): Required<Pick<BaroCadModelSetLoadOptions, 'onProgress'>> &
  Pick<BaroCadModelSetLoadOptions, 'baseURL' | 'signal'> {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('BaroCAD model-set load options must be a plain object');
  }
  const keys = Reflect.ownKeys(input);
  if (!keys.every(key => typeof key === 'string' && ['baseURL', 'signal', 'onProgress'].includes(key))) {
    throw new TypeError('BaroCAD model-set load accepts baseURL, signal and onProgress only');
  }
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError(`BaroCAD model-set ${String(key)} must be data`);
    values[key as string] = descriptor.value;
  }
  if (values.baseURL !== undefined && typeof values.baseURL !== 'string') throw new TypeError('baseURL must be a URL string');
  if (values.signal !== undefined && !(values.signal instanceof AbortSignal)) throw new TypeError('signal must be an AbortSignal');
  if (values.onProgress !== undefined && typeof values.onProgress !== 'function') throw new TypeError('onProgress must be a function');
  return {
    baseURL: values.baseURL as string | undefined,
    signal: values.signal as AbortSignal | undefined,
    onProgress: (values.onProgress as BaroCadModelSetLoadOptions['onProgress']) ?? (() => {}),
  };
}

function httpURL(value: string, base?: string): string {
  const url = base === undefined ? new URL(value) : new URL(value, base);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new RangeError('BaroCAD model-set requires HTTP(S) source URLs');
  return url.href;
}

/** Load separate native sources atomically without renaming their authoritative Models. */
export async function loadBaroCadModelSet(
  manifest: BaroCadModelSetManifest,
  options: BaroCadModelSetLoadOptions = {},
): Promise<BaroCadModelSetResult> {
  const request = loadOptions(options);
  const input = record(manifest, ['format', 'version', 'entries'], 'BaroCAD model-set manifest');
  if (input.format !== 'barocad-model-set' || input.version !== 0) throw new RangeError('Only BaroCAD model-set version 0 is supported');
  const rawEntries = input.entries;
  if (!Array.isArray(rawEntries) || Object.getPrototypeOf(rawEntries) !== Array.prototype ||
      rawEntries.length < 1 || rawEntries.length > 4) {
    throw new RangeError('BaroCAD model-set requires 1..4 entries');
  }
  const baseURL = request.baseURL === undefined ? undefined : httpURL(request.baseURL);
  const aliases = new Set<string>();
  const entries = Array.from({ length: rawEntries.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(rawEntries, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError('BaroCAD model-set entry must be data');
    const entry = record(descriptor.value, ['aliasId', 'url', 'options'], 'BaroCAD model-set entry');
    if (typeof entry.aliasId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(entry.aliasId) || aliases.has(entry.aliasId)) {
      throw new RangeError('BaroCAD model-set aliasId must be unique ASCII identifier');
    }
    aliases.add(entry.aliasId);
    if (typeof entry.url !== 'string') throw new TypeError('BaroCAD model-set URL must be a string');
    return {
      aliasId: entry.aliasId,
      url: httpURL(entry.url, baseURL),
      options: validateBaroCadParseOptions(entry.options),
    };
  });
  throwIfBaroCadAborted(request.signal);

  const accepted: BaroCadModelSetEntry[] = [];
  let totalLoadedBytes = 0;
  for (const entry of entries) {
    throwIfBaroCadAborted(request.signal);
    const child = new AbortController();
    const forwardAbort = () => child.abort();
    request.signal?.addEventListener('abort', forwardAbort, { once: true });
    if (request.signal?.aborted) child.abort();
    let memberLoadedBytes = 0;
    try {
      const result = await loadBaroCadSource(entry.url, entry.options, {
        signal: child.signal,
        onProgress(progress) {
          memberLoadedBytes = progress.loadedBytes;
          const decision = request.onProgress(Object.freeze({
            aliasId: entry.aliasId, url: entry.url, loadedBytes: progress.loadedBytes,
            aggregateLoadedBytes: totalLoadedBytes + progress.loadedBytes,
            ...(progress.declaredTotalBytes === undefined ? {} : { declaredTotalBytes: progress.declaredTotalBytes }),
          }));
          if (decision === false) throw new BaroCadLoadAbortError();
        },
      });
      throwIfBaroCadAborted(request.signal);
      totalLoadedBytes += memberLoadedBytes;
      if (totalLoadedBytes > 1048576) throw new RangeError('BaroCAD model-set exceeds 1048576 bytes');
      accepted.push(Object.freeze({ aliasId: entry.aliasId, url: entry.url, result }));
    } catch (error) {
      child.abort();
      throw error;
    } finally {
      request.signal?.removeEventListener('abort', forwardAbort);
    }
  }
  await Promise.resolve();
  throwIfBaroCadAborted(request.signal);
  return Object.freeze({ format: 'barocad-model-set', version: 0, entries: Object.freeze(accepted), totalLoadedBytes });
}

function data(input: unknown, key: string, label: string): unknown {
  if (input === null || typeof input !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError(`${label} must be plain data`);
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError(`${label}.${key} must be data`);
  return descriptor.value;
}

function dense(input: unknown, min: number, max: number, label: string): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype ||
      input.length < min || input.length > max || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new RangeError(`${label} must be a dense array of ${min}..${max}`);
  }
  return Array.from({ length: input.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError(`${label}[${index}] must be data`);
    return descriptor.value;
  });
}

/** Copy native packets for one display scene, with explicit alias-to-native bindings. */
export function prepareBaroCadModelSetDisplay(set: BaroCadModelSetResult): ReadonlyArray<BaroCadModelSetDisplayEntry> {
  if (data(set, 'format', 'Model set') !== 'barocad-model-set' || data(set, 'version', 'Model set') !== 0) {
    throw new RangeError('Only BaroCAD model-set version 0 can be displayed');
  }
  const entries = dense(data(set, 'entries', 'Model set'), 1, 4, 'Model-set entries');
  const output: BaroCadModelSetDisplayEntry[] = [];
  const aliases = new Set<string>();
  const displayIds = new Set<string>();
  for (const entry of entries) {
    const aliasId = data(entry, 'aliasId', 'Model-set entry');
    const sourceURL = data(entry, 'url', 'Model-set entry');
    const result = data(entry, 'result', 'Model-set entry');
    if (typeof aliasId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(aliasId) || aliases.has(aliasId)) {
      throw new RangeError('Display alias must be a unique bounded ASCII identifier');
    }
    if (typeof sourceURL !== 'string' || !/^https?:\/\//.test(sourceURL)) throw new TypeError('Display source URL must be HTTP(S)');
    aliases.add(aliasId);
    const model = data(result, 'model', 'Native result');
    const modelId = data(model, 'name', 'Native Model');
    if (typeof modelId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(modelId)) {
      throw new RangeError('Native Model ID must be a bounded ASCII identifier');
    }
    const objects = dense(data(model, 'objects', 'Native Model'), 1, 64, 'Native objects');
    const surfaces = dense(data(result, 'surfaces', 'Native result'), 1, 4, 'Native Surfaces');
    for (const surface of surfaces) {
      const surfaceId = data(surface, 'surfaceId', 'Native Surface');
      const packet = copyCadPreviewPacket(data(surface, 'packet', 'Native Surface'));
      if (typeof surfaceId !== 'string' || packet.surfaceId !== surfaceId ||
          objects.filter(object => data(object, 'kind', 'Native object') === 'surface' &&
            data(object, 'id', 'Native object') === surfaceId).length !== 1) {
        throw new RangeError('Display Surface must bind exactly one original native Surface');
      }
      const displaySurfaceId = `bcms_${aliasId.length}_${aliasId}_${surfaceId}`;
      if (displaySurfaceId.length > 127 || displayIds.has(displaySurfaceId)) {
        throw new RangeError('Qualified display Surface ID is too long or duplicated');
      }
      displayIds.add(displaySurfaceId);
      packet.surfaceId = displaySurfaceId;
      output.push(Object.freeze({
        packet,
        binding: Object.freeze({ displaySurfaceId, aliasId, modelId, surfaceId, sourceURL }),
      }));
      if (output.length > 4) throw new RangeError('Own GPU display supports at most four total Surfaces');
    }
  }
  return Object.freeze(output);
}

function copyPlainCurve(input: unknown): unknown {
  let remaining = 2097152;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    if (--remaining < 0 || depth > 32) throw new RangeError('Native Curve own-data budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string' && value.length <= 262144) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('Native Curve requires acyclic plain data');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) {
      throw new TypeError('Native Curve requires plain own data');
    }
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.length > (array ? 8193 : 64) || keys.some(key => typeof key !== 'string' || key.length > 128 ||
        !('value' in descriptors[key]) || (key !== 'length' && !descriptors[key].enumerable))) {
      throw new TypeError('Native Curve getter, hidden or symbolic data is unsupported');
    }
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      if (!Number.isInteger(length) || length > 8192 || keys.length !== length + 1) {
        throw new RangeError('Native Curve array must be dense and bounded');
      }
      result = Array.from({ length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError('Native Curve array must contain data');
        return copy(descriptor.value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}

function samePlain(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => samePlain(value, right[index]));
  }
  if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = Object.keys(leftRecord);
    return keys.length === Object.keys(rightRecord).length &&
      keys.every(key => Object.hasOwn(rightRecord, key) && samePlain(leftRecord[key], rightRecord[key]));
  }
  return Object.is(left, right);
}

/** Copy a mixed model set for one display scene without renaming authoritative native Curves. */
export function prepareBaroCadModelSetPrimitiveDisplayV1(
  set: BaroCadModelSetResult,
): ReadonlyArray<BaroCadModelSetPrimitiveDisplayEntryV1> {
  if (data(set, 'format', 'Model set') !== 'barocad-model-set' || data(set, 'version', 'Model set') !== 0) {
    throw new RangeError('Only BaroCAD model-set version 0 can be displayed');
  }
  const entries = dense(data(set, 'entries', 'Model set'), 1, 4, 'Model-set entries');
  const output: BaroCadModelSetPrimitiveDisplayEntryV1[] = [];
  const aliases = new Set<string>();
  const displayIds = new Set<string>();
  for (const entry of entries) {
    const aliasId = data(entry, 'aliasId', 'Model-set entry');
    const sourceURL = data(entry, 'url', 'Model-set entry');
    const result = data(entry, 'result', 'Model-set entry');
    if (typeof aliasId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(aliasId) || aliases.has(aliasId)) {
      throw new RangeError('Display alias must be a unique bounded ASCII identifier');
    }
    if (typeof sourceURL !== 'string' || !/^https?:\/\//.test(sourceURL)) throw new TypeError('Display source URL must be HTTP(S)');
    aliases.add(aliasId);
    const model = data(result, 'model', 'Native result');
    const modelId = data(model, 'name', 'Native Model');
    if (typeof modelId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(modelId)) {
      throw new RangeError('Native Model ID must be a bounded ASCII identifier');
    }
    const objects = dense(data(model, 'objects', 'Native Model'), 1, 64, 'Native objects');
    if (objects.length > 4) throw new RangeError('Primitive display supports at most four total native objects');
    const surfaces = dense(data(result, 'surfaces', 'Native result'), 0, 4, 'Native Surfaces');
    const curves = dense(data(result, 'curves', 'Native result'), 0, 4, 'Native Curves');
    if (dense(data(result, 'unrenderedCurveIds', 'Native result'), 0, 64, 'Unrendered Curves').length ||
        surfaces.length + curves.length !== objects.length) {
      throw new RangeError('Primitive display requires one preview per native object');
    }
    for (const object of objects) {
      const geometryKind = data(object, 'kind', 'Native object');
      const geometryId = data(object, 'id', 'Native object');
      if ((geometryKind !== 'surface' && geometryKind !== 'curve') ||
          typeof geometryId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(geometryId)) {
        throw new RangeError('Primitive display requires native Surface or Curve ID');
      }
      const displayGeometryId = `bcms_${aliasId.length}_${aliasId}_${geometryId}`;
      if (displayGeometryId.length > 127 || displayIds.has(displayGeometryId)) {
        throw new RangeError('Qualified display geometry ID is too long or duplicated');
      }
      displayIds.add(displayGeometryId);
      const binding = Object.freeze({ displayGeometryId, aliasId, modelId, geometryId, geometryKind, sourceURL });
      if (geometryKind === 'surface') {
        const matches = surfaces.filter(surface => data(surface, 'surfaceId', 'Native Surface') === geometryId);
        if (matches.length !== 1) throw new RangeError('Display Surface must bind exactly one native Surface');
        const packet = copyCadPreviewPacket(data(matches[0], 'packet', 'Native Surface'));
        if (packet.surfaceId !== geometryId) throw new RangeError('Display Surface packet ID differs from native ID');
        packet.surfaceId = displayGeometryId;
        output.push(Object.freeze({ kind: 'surface', packet, binding }));
      } else {
        const matches = curves.filter(curve => data(curve, 'curveId', 'Native Curve') === geometryId);
        if (matches.length !== 1) throw new RangeError('Display Curve must bind exactly one native Curve');
        const sample = copyPlainCurve(data(matches[0], 'sample', 'Native Curve')) as
          AdaptiveCurveSamplingResult | WideAdaptiveCurveSamplingResult;
        const version = data(data(data(sample, 'report', 'Curve sample'), 'dto', 'Curve report'),
          'version', 'Curve DTO');
        if (version !== 0 && version !== 1) throw new RangeError('Unsupported native Curve sample version');
        if (version === 1) validateWideAdaptiveCurveSamples(sample as WideAdaptiveCurveSamplingResult);
        else validateAdaptiveCurveSamples(sample as AdaptiveCurveSamplingResult);
        if (!samePlain(copyPlainCurve(object), sample.curve)) {
          throw new RangeError('Display Curve sample differs from original native Curve');
        }
        if (version === 1) output.push(Object.freeze({ kind: 'curve', sampleVersion: 1,
          sample: sample as WideAdaptiveCurveSamplingResult, basis: 'authored-xyz-matches-rhyup', binding }));
        else output.push(Object.freeze({ kind: 'curve', sampleVersion: 0,
          sample: sample as AdaptiveCurveSamplingResult, basis: 'authored-xyz-matches-rhyup', binding }));
      }
      if (output.length > 4) throw new RangeError('Primitive display supports at most four total native objects');
    }
  }
  return Object.freeze(output);
}

/** Return original native IDs and qualified refs for a caller-supplied primitive renderer. */
export function prepareBaroCadModelSetPrimitiveNativeRefsV2(
  set: BaroCadModelSetResult,
): ReadonlyArray<BaroCadModelSetPrimitiveNativeEntryV2> {
  const display = prepareBaroCadModelSetPrimitiveDisplayV1(set);
  return Object.freeze(display.map(entry => {
    const ref = Object.freeze({ modelId: entry.binding.aliasId.replaceAll('-', '.'),
      geometryId: entry.binding.geometryId });
    if (entry.kind === 'surface') {
      const packet = copyCadPreviewPacket(entry.packet);
      packet.surfaceId = ref.geometryId;
      return Object.freeze({ kind: 'surface', packet, ref, binding: entry.binding });
    }
    if (entry.sampleVersion === 1) return Object.freeze({ kind: 'curve', sampleVersion: 1,
      sample: entry.sample, basis: entry.basis, ref, binding: entry.binding });
    return Object.freeze({ kind: 'curve', sampleVersion: 0,
      sample: entry.sample, basis: entry.basis, ref, binding: entry.binding });
  }));
}
