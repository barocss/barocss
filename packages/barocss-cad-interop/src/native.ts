import { compileCadModel, tessellateSurface } from '@barocss/cad';
import type { ApproximationReport, CadDiagnostic, Model } from '@barocss/cad';
import { prepareCadPreviewMesh } from './packet.js';
import type { CadPreviewPacket, PreparedCadMesh } from './packet.js';

export interface BaroCadParseOptions {
  sourceVersion: 0;
  countU: number;
  countV: number;
  /** Renderer units per native millimetre. Use 0.001 for metres. */
  unitsPerMillimeter: number;
}

export interface BaroCadSurfacePreview {
  surfaceId: string;
  packet: CadPreviewPacket;
  report: ApproximationReport;
  mesh: PreparedCadMesh;
}

export interface BaroCadNativeResult {
  /** Exact input text, including whitespace and signed zero spelling. */
  source: string;
  /** Authoritative native NURBS model from the CAD compiler. */
  model: Model;
  diagnostics: [];
  surfaces: BaroCadSurfacePreview[];
  /** Native curves remain in model.objects, but have no display object yet. */
  unrenderedCurveIds: string[];
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

function parseOptions(input: unknown): BaroCadParseOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('BaroCAD options must be a plain object');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('BaroCAD options must be a plain object');
  const expected = ['sourceVersion', 'countU', 'countV', 'unitsPerMillimeter'];
  const keys = Reflect.ownKeys(input);
  if (keys.length !== expected.length || !keys.every(key => typeof key === 'string' && expected.includes(key))) {
    throw new TypeError('BaroCAD options require sourceVersion, countU, countV and unitsPerMillimeter only');
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
  return values as unknown as BaroCadParseOptions;
}

/** Compile native source and make bounded display meshes without changing the native model. */
export function parseBaroCadSource(source: string, options: BaroCadParseOptions): BaroCadNativeResult {
  const parsedOptions = parseOptions(options);
  const compiled = compileCadModel(source, { sourceVersion: parsedOptions.sourceVersion });
  if (!compiled.ok) throw new BaroCadSourceError(compiled.diagnostics);
  const surfaces = compiled.model.objects.filter(object => object.kind === 'surface');
  if (surfaces.length < 1 || surfaces.length > 4) throw new RangeError('BaroCAD display requires 1..4 native surfaces');
  const previews: BaroCadSurfacePreview[] = surfaces.map(surface => {
    const { packet, report } = tessellateSurface(surface, {
      countU: parsedOptions.countU, countV: parsedOptions.countV, revision: 0,
    });
    const mesh = prepareCadPreviewMesh(packet, parsedOptions.unitsPerMillimeter);
    return { surfaceId: surface.id, packet, report, mesh };
  });
  return {
    source, model: compiled.model, diagnostics: [], surfaces: previews,
    unrenderedCurveIds: compiled.model.objects.filter(object => object.kind === 'curve').map(curve => curve.id),
  };
}
