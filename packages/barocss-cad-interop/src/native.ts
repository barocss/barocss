import {
  compileCadModel, sampleCurveAdaptive, sampleCurveWideAdaptive, tessellateSurface,
  validateAdaptiveCurveSamples, validateWideAdaptiveCurveSamples,
} from '@barocss/cad';
import type {
  AdaptiveCurveSamplingResult, ApproximationReport, CadDiagnostic, Model, WideAdaptiveCurveSamplingResult,
} from '@barocss/cad';
import { prepareCadPreviewMesh } from './packet.js';
import type { CadPreviewPacket, PreparedCadMesh } from './packet.js';
import { encodeNativePreviewGlb } from './glb.js';
import type { NativeGlbCurve } from './glb.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export { BaroCadLoadAbortError } from './transport.js';
export type { BaroCadLoadProgress, BaroCadLoadTransportOptions } from './transport.js';

export interface BaroCadCurveDisplayV0 {
  chordToleranceMM: number;
  maxSegments: number;
  maxDepth: number;
}

export interface BaroCadCurveDisplayV1 extends BaroCadCurveDisplayV0 {
  version: 1;
}

export interface BaroCadParseOptions {
  sourceVersion: 0;
  countU: number;
  countV: number;
  /** Renderer units per native millimetre. Use 0.001 for metres. */
  unitsPerMillimeter: number;
  /** Explicit opt-in. Curve parameters retain the authored knot domain. */
  curveDisplay?: BaroCadCurveDisplayV0 | BaroCadCurveDisplayV1;
}

export interface BaroCadSurfacePreview {
  surfaceId: string;
  packet: CadPreviewPacket;
  report: ApproximationReport;
  mesh: PreparedCadMesh;
}

export interface BaroCadCurvePreview {
  curveId: string;
  /** Owned CAD sample record with original native parameters and intervals. V1 is explicit. */
  sample: AdaptiveCurveSamplingResult | WideAdaptiveCurveSamplingResult;
  /** Renderer-unit XYZ positions only; no surface normals or texture UV. */
  positions: Float32Array;
}

export interface BaroCadNativeResult {
  /** Exact input text, including whitespace and signed zero spelling. */
  source: string;
  /** Authoritative native NURBS model from the CAD compiler. */
  model: Model;
  diagnostics: [];
  surfaces: BaroCadSurfacePreview[];
  curves: BaroCadCurvePreview[];
  /** Curves without display objects. With curveDisplay enabled, this is empty. */
  unrenderedCurveIds: string[];
}

export interface BaroCadGlbExportOptions {
  /** Embed exact source0 text as an untrusted reference in asset metadata. */
  includeSourceText: boolean;
}

export class BaroCadSourceError extends SyntaxError {
  readonly diagnostics: CadDiagnostic[];

  constructor(diagnostics: CadDiagnostic[]) {
    const first = diagnostics[0];
    super(first ? `${first.code} at ${first.range.line}:${first.range.column}: ${first.message}` : 'Invalid BaroCAD source');
    this.name = 'BaroCadSourceError';
    this.diagnostics = diagnostics;
  }
}

/** Validate and snapshot native parse options before asynchronous work. */
export function validateBaroCadParseOptions(input: unknown): BaroCadParseOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('BaroCAD options must be a plain object');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('BaroCAD options must be a plain object');
  const expected = ['sourceVersion', 'countU', 'countV', 'unitsPerMillimeter'];
  const keys = Reflect.ownKeys(input);
  if (keys.length < expected.length || keys.length > expected.length + 1 ||
      !keys.every(key => typeof key === 'string' && (expected.includes(key) || key === 'curveDisplay'))) {
    throw new TypeError('BaroCAD options require sourceVersion, countU, countV, unitsPerMillimeter and optional curveDisplay only');
  }
  const values: Record<string, unknown> = {};
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError(`BaroCAD option ${key} must be data`);
    values[key] = descriptor.value;
  }
  if (values.sourceVersion !== 0) throw new RangeError('Only BaroCAD sourceVersion 0 is supported');
  for (const key of ['countU', 'countV']) {
    const value = values[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 2 || value > 17) {
      throw new RangeError(`BaroCAD ${key} must be an integer in 2..17`);
    }
  }
  if (typeof values.unitsPerMillimeter !== 'number' || !Number.isFinite(values.unitsPerMillimeter) || values.unitsPerMillimeter <= 0) {
    throw new RangeError('BaroCAD unitsPerMillimeter must be finite and positive');
  }
  if (keys.includes('curveDisplay')) {
    const descriptor = Object.getOwnPropertyDescriptor(input, 'curveDisplay');
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('BaroCAD curveDisplay must be data');
    const display = descriptor.value;
    if (display === null || typeof display !== 'object' || Array.isArray(display) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(display))) throw new TypeError('BaroCAD curveDisplay must be a plain object');
    const displayKeys = Reflect.ownKeys(display);
    const wide = displayKeys.includes('version');
    const fields = wide ? ['version', 'chordToleranceMM', 'maxSegments', 'maxDepth'] :
      ['chordToleranceMM', 'maxSegments', 'maxDepth'];
    if (displayKeys.length !== fields.length || !displayKeys.every(key => typeof key === 'string' && fields.includes(key))) {
      throw new TypeError(wide ? 'BaroCAD curveDisplay version 1 requires version, chordToleranceMM, maxSegments and maxDepth only' :
        'BaroCAD curveDisplay requires chordToleranceMM, maxSegments and maxDepth only');
    }
    const curveDisplay: Record<string, number> = {};
    for (const key of fields) {
      const field = Object.getOwnPropertyDescriptor(display, key);
      if (!field || !field.enumerable || !('value' in field)) throw new TypeError(`BaroCAD curveDisplay ${key} must be data`);
      curveDisplay[key] = field.value;
    }
    if (wide && curveDisplay.version !== 1) throw new RangeError('Only BaroCAD curveDisplay version 1 is supported');
    const maximumSegments = wide ? 4092 : 1024;
    if (!Number.isFinite(curveDisplay.chordToleranceMM) || curveDisplay.chordToleranceMM < 1e-7 || curveDisplay.chordToleranceMM > 1000 ||
        !Number.isInteger(curveDisplay.maxSegments) || curveDisplay.maxSegments < 1 || curveDisplay.maxSegments > maximumSegments ||
        !Number.isInteger(curveDisplay.maxDepth) || curveDisplay.maxDepth < 0 || curveDisplay.maxDepth > 16) {
      throw new RangeError(`BaroCAD curveDisplay exceeds ${wide ? 'v1' : 'CAD661'} tolerance, segment or depth bounds`);
    }
    values.curveDisplay = curveDisplay;
  }
  return values as unknown as BaroCadParseOptions;
}

function curvePositions(
  pointsMM: AdaptiveCurveSamplingResult['pointsMM'] | WideAdaptiveCurveSamplingResult['pointsMM'],
  unitsPerMillimeter: number,
): Float32Array {
  const positions = new Float32Array(pointsMM.length * 3);
  for (let index = 0; index < pointsMM.length; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const scaled = pointsMM[index][axis] * unitsPerMillimeter;
      const converted = Math.fround(scaled);
      if (!Number.isFinite(scaled) || !Number.isFinite(converted) || (scaled !== 0 && converted === 0)) {
        throw new RangeError('BaroCAD Curve position is unsafe in renderer Float32 units');
      }
      positions[index * 3 + axis] = converted;
    }
    if (index > 0 && positions[index * 3] === positions[(index - 1) * 3] &&
        positions[index * 3 + 1] === positions[(index - 1) * 3 + 1] &&
        positions[index * 3 + 2] === positions[(index - 1) * 3 + 2]) {
      throw new RangeError('BaroCAD Curve has a collapsed Float32 display segment');
    }
  }
  return positions;
}

/** Compile native source and make bounded display meshes without changing the native model. */
export function parseBaroCadSource(source: string, options: BaroCadParseOptions): BaroCadNativeResult {
  const parsedOptions = validateBaroCadParseOptions(options);
  const compiled = compileCadModel(source, { sourceVersion: parsedOptions.sourceVersion });
  if (!compiled.ok) throw new BaroCadSourceError(compiled.diagnostics);
  const surfaces = compiled.model.objects.filter(object => object.kind === 'surface');
  const nativeCurves = compiled.model.objects.filter(object => object.kind === 'curve');
  if (parsedOptions.curveDisplay) {
    if (surfaces.length + nativeCurves.length < 1 || surfaces.length + nativeCurves.length > 4) {
      throw new RangeError('BaroCAD Curve display requires 1..4 total native objects');
    }
  } else if (surfaces.length < 1 || surfaces.length > 4) {
    throw new RangeError('BaroCAD display requires 1..4 native surfaces');
  }
  const previews: BaroCadSurfacePreview[] = surfaces.map(surface => {
    const { packet, report } = tessellateSurface(surface, {
      countU: parsedOptions.countU, countV: parsedOptions.countV, revision: 0,
    });
    const mesh = prepareCadPreviewMesh(packet, parsedOptions.unitsPerMillimeter);
    return { surfaceId: surface.id, packet, report, mesh };
  });
  const curvePreviews: BaroCadCurvePreview[] = [];
  if (parsedOptions.curveDisplay) {
    const wide = 'version' in parsedOptions.curveDisplay;
    const sourceIds = [compiled.model.name, ...compiled.model.objects.map(object => object.id)];
    let totalPoints = 0;
    let totalSegments = 0;
    for (const [index, object] of compiled.model.objects.entries()) {
      if (object.kind !== 'curve') continue;
      const resultIdPrefix = `bcv${wide ? 1 : 0}c${index}`;
      if (sourceIds.some(id => id === resultIdPrefix || id.startsWith(`${resultIdPrefix}_`))) {
        throw new RangeError(`BaroCAD Curve generated ID prefix ${resultIdPrefix} conflicts with source IDs`);
      }
      let sample: AdaptiveCurveSamplingResult | WideAdaptiveCurveSamplingResult;
      if (wide) {
        sample = sampleCurveWideAdaptive(object, {
          chordToleranceMM: parsedOptions.curveDisplay.chordToleranceMM,
          maxSegments: parsedOptions.curveDisplay.maxSegments,
          maxDepth: parsedOptions.curveDisplay.maxDepth, resultIdPrefix,
        });
        validateWideAdaptiveCurveSamples(sample);
      } else {
        sample = sampleCurveAdaptive(object, { ...parsedOptions.curveDisplay, resultIdPrefix });
        validateAdaptiveCurveSamples(sample);
      }
      totalPoints += sample.pointsMM.length;
      totalSegments += sample.segments.length;
      if (totalPoints > 4096 || totalSegments > 4092) throw new RangeError('BaroCAD Curve display exceeds total sample capacity');
      curvePreviews.push({ curveId: object.id, sample, positions: curvePositions(sample.pointsMM, parsedOptions.unitsPerMillimeter) });
    }
  }
  return {
    source, model: compiled.model, diagnostics: [], surfaces: previews, curves: curvePreviews,
    unrenderedCurveIds: parsedOptions.curveDisplay ? [] : nativeCurves.map(curve => curve.id),
  };
}

/** Export a bounded, metre-scale display GLB from native source0. */
export function baroCadSourceToGLB(
  source: string, nativeOptions: BaroCadParseOptions, exportOptions: BaroCadGlbExportOptions,
): ArrayBuffer {
  const options = validateBaroCadParseOptions(nativeOptions);
  const wide = options.curveDisplay !== undefined && 'version' in options.curveDisplay;
  if (options.unitsPerMillimeter !== 0.001) throw new RangeError('BaroCAD GLB requires unitsPerMillimeter 0.001');
  if (exportOptions === null || typeof exportOptions !== 'object' || Array.isArray(exportOptions) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(exportOptions))) {
    throw new TypeError('BaroCAD GLB export options must be a plain object');
  }
  const keys = Reflect.ownKeys(exportOptions);
  const descriptor = Object.getOwnPropertyDescriptor(exportOptions, 'includeSourceText');
  if (keys.length !== 1 || keys[0] !== 'includeSourceText' || !descriptor?.enumerable ||
      !('value' in descriptor) || typeof descriptor.value !== 'boolean') {
    throw new TypeError('BaroCAD GLB export requires includeSourceText boolean data only');
  }
  const includeSourceText = descriptor.value;
  const result = parseBaroCadSource(source, options);
  if (result.model.objects.length < 1 || result.model.objects.length > 4) {
    throw new RangeError('BaroCAD GLB requires 1..4 total native objects');
  }
  const metadata = result.surfaces.map(surface => ({
    kind: 'surface', surfaceId: surface.surfaceId, previewPacketVersion: 0,
    sourceLengthUnit: 'mm', displayLengthUnit: 'm', approximate: true,
    nativeFrame: 'authored-xyz-y-up', parameterAttribute: '_CAD_UV',
    parameterMeaning: 'original-native-u-v-not-texture-uv',
  }));
  const curves: NativeGlbCurve[] = result.curves.map(curve => ({
    curveId: curve.curveId, positions: curve.positions,
    parameters: [...curve.sample.parameters],
    intervals: curve.sample.segments.map(segment => [...segment.domain] as [number, number]),
    ...(wide ? { sampleVersion: 1 as const } : {}),
  }));
  const assetMetadata: Record<string, unknown> = {
    format: 'barocad-display-glb', sourceVersion: 0, modelName: result.model.name,
    modelVersion: result.model.version, sourceLengthUnit: 'mm', displayLengthUnit: 'm',
    nativeFrame: 'authored-xyz-y-up', representation: 'sampled-display-not-native-nurbs',
    objectOrder: result.model.objects.map(object => ({ kind: object.kind, id: object.id })),
    unrenderedCurveIds: [...result.unrenderedCurveIds],
    ...(wide ? { curveSampleVersion: 1 } : {}),
  };
  if (includeSourceText) assetMetadata.source = {
    format: 'barocad-source0', role: 'untrusted-native-reference', text: source,
  };
  return encodeNativePreviewGlb(result.surfaces.map(surface => surface.mesh), metadata, curves, assetMetadata);
}

/** Load bounded native source without creating a renderer object. */
export async function loadBaroCadSource(
  url: string,
  options: BaroCadParseOptions,
  transport: BaroCadLoadTransportOptions = {},
): Promise<BaroCadNativeResult> {
  const parsedOptions = validateBaroCadParseOptions(options);
  const request = validateBaroCadTransport(url, transport);
  const source = await readAbortableBaroCadSource(request);
  throwIfBaroCadAborted(request.signal);
  const result = parseBaroCadSource(source, parsedOptions);
  await Promise.resolve();
  throwIfBaroCadAborted(request.signal);
  return result;
}
