import {prepareBoxGeometry, preparePlaneGeometry, prepareSphereGeometry} from '@barocss/gpu';
import type {BoxGeometrySourceV0, PlaneGeometrySourceV0, SphereGeometrySourceV0,
  PreparedBoxGeometry, PreparedPlaneGeometry, PreparedSphereGeometry} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export type RenderParametricGeometrySourceV1 = BoxGeometrySourceV0 | PlaneGeometrySourceV0 | SphereGeometrySourceV0;
export type RenderPreparedParametricGeometryV1 = PreparedBoxGeometry | PreparedPlaneGeometry | PreparedSphereGeometry;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RenderEditorError('DOCUMENT_INPUT', message);
}

/** Existing providers retain original parameters and own separate generated execution buffers. */
export function prepareRenderParametricSourcesV1(input: unknown): readonly RenderPreparedParametricGeometryV1[] {
  try {
    check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, 'Parametric geometry sources require a plain dense array.');
    const length = Object.getOwnPropertyDescriptor(input, 'length');
    check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 1 && length.value <= 4,
      'Parametric scene requires 1..4 original geometry sources.');
    const keys = Reflect.ownKeys(input);
    check(keys.length === length.value + 1 && keys.every(key => key === 'length' || typeof key === 'string'
      && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value), 'Geometry sources have holes, extra fields, or symbols.');
    const sources: unknown[] = Array.from({length: length.value}, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      check(descriptor && 'value' in descriptor && descriptor.enumerable, 'Geometry source requires own enumerable data.');
      return descriptor.value;
    });
    const ids = new Set<string>(), prepared: RenderPreparedParametricGeometryV1[] = [];
    for (const source of sources) {
      check(source !== null && typeof source === 'object' && Object.getPrototypeOf(source) === Object.prototype,
        'Geometry source requires a plain own parameter record.');
      const format = Object.getOwnPropertyDescriptor(source, 'format');
      check(format && 'value' in format && format.enumerable, 'Geometry source requires an own enumerable format.');
      let result: RenderPreparedParametricGeometryV1;
      switch (format.value) {
        case 'barocss-gpu-box-geometry': result = prepareBoxGeometry(source); break;
        case 'barocss-gpu-plane-geometry': result = preparePlaneGeometry(source); break;
        case 'barocss-gpu-sphere-geometry': result = prepareSphereGeometry(source); break;
        default: throw new RenderEditorError('DOCUMENT_VERSION', 'Only original Box, Plane, and Sphere geometry source0 records are supported.');
      }
      check(!ids.has(result.source.id), 'Original parametric geometry source IDs must be unique.');
      ids.add(result.source.id); prepared.push(result);
    }
    return Object.freeze(prepared);
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
