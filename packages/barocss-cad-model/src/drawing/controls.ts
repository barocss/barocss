// DR-6a: authored geometric control frames. This is annotation data, not a tolerance solver.
import { problem, type Problem } from '../engine/refusal';
import type { Mark } from './sheet';
import { isDimView, type DimView, type XY } from './types';

export const CHARACTERISTICS = ['position', 'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface', 'parallelism', 'perpendicularity', 'angularity', 'concentricity', 'symmetry', 'circular-runout', 'total-runout'] as const;
export type Characteristic = typeof CHARACTERISTICS[number];
export type MaterialModifier = 'maximum' | 'least';
export interface DrawingFrameComposite {
  value: number; datums: string[]; diameter?: boolean; material?: MaterialModifier;
  datumModifiers?: Record<string, MaterialModifier>;
}
interface DrawingFrameFields {
  id: string; characteristic: Characteristic; value: number; datums: string[];
  /** Absent: diameter for position, linear for every other characteristic. */
  diameter?: boolean;
  material?: MaterialModifier;
  datumModifiers?: Record<string, MaterialModifier>;
  /** Projected zone height, model mm. */ projected?: number;
  freeState?: boolean;
  tangentPlane?: boolean;
  /** The second row of an authored composite position frame. */
  composite?: DrawingFrameComposite;
}
/** An attached frame follows its dimension; a standalone frame has an explicit view-mm position. */
export type DrawingFrame = DrawingFrameFields & (
  | { dim: string; view?: never; place?: never }
  | { dim?: never; view: DimView; place: XY }
);
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const label = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 120;
const material = (x: unknown): x is MaterialModifier => x === 'maximum' || x === 'least';
const keys = ['id', 'dim', 'view', 'place', 'characteristic', 'value', 'datums', 'diameter', 'material', 'datumModifiers', 'projected', 'freeState', 'tangentPlane', 'composite'];
const compositeKeys = ['value', 'datums', 'diameter', 'material', 'datumModifiers'];
const placeOk = (x: unknown): x is XY => Array.isArray(x) && x.length === 2 && Object.hasOwn(x, 0) && Object.hasOwn(x, 1) && x.every(v => typeof v === 'number' && Number.isFinite(v));
const rowOk = (x: Record<string, unknown>): boolean => typeof x.value === 'number' && Number.isFinite(x.value) && x.value > 0 && x.value < 100 &&
  Array.isArray(x.datums) && x.datums.length <= 3 && [...x.datums].every(d => typeof d === 'string' && /^[A-HJ-NPR-Z]$/.test(d)) && new Set(x.datums).size === x.datums.length &&
  (x.diameter === undefined || typeof x.diameter === 'boolean') && (x.material === undefined || material(x.material)) &&
  (x.datumModifiers === undefined || (record(x.datumModifiers) && Object.entries(x.datumModifiers).every(([d, m]) => (x.datums as string[]).includes(d) && material(m))));
export function frameOk(x: unknown): x is DrawingFrame {
  if (!record(x) || !label(x.id) || !CHARACTERISTICS.includes(x.characteristic as Characteristic) || !rowOk(x)) return false;
  if (!(label(x.dim) && !('view' in x) && !('place' in x)) && !(!('dim' in x) && isDimView(x.view) && placeOk(x.place))) return false;
  return (x.composite === undefined || (x.characteristic === 'position' && record(x.composite) && Object.keys(x.composite).every(k => compositeKeys.includes(k)) && rowOk(x.composite))) &&
    (x.projected === undefined || (typeof x.projected === 'number' && Number.isFinite(x.projected) && x.projected > 0 && x.projected <= 1000)) &&
    ['freeState', 'tangentPlane'].every(k => x[k] === undefined || typeof x[k] === 'boolean');
}
export function readFrames(x: unknown): DrawingFrame[] {
  const out: DrawingFrame[] = [];
  if (Array.isArray(x)) for (const f of x) {
    if (!frameOk(f) || out.some(old => old.id === f.id || f.dim !== undefined && old.dim === f.dim)) continue;
    out.push({ id: f.id, ...(f.dim !== undefined ? { dim: f.dim } : { view: f.view, place: [f.place[0], f.place[1]] as XY }), characteristic: f.characteristic, value: f.value, datums: [...f.datums], ...(f.diameter !== undefined ? { diameter: f.diameter } : {}), ...(f.material ? { material: f.material } : {}), ...(f.datumModifiers ? { datumModifiers: { ...f.datumModifiers } } : {}), ...(f.projected !== undefined ? { projected: f.projected } : {}), ...(f.freeState !== undefined ? { freeState: f.freeState } : {}), ...(f.tangentPlane !== undefined ? { tangentPlane: f.tangentPlane } : {}), ...(f.composite ? { composite: { value: f.composite.value, datums: [...f.composite.datums], ...(f.composite.diameter !== undefined ? { diameter: f.composite.diameter } : {}), ...(f.composite.material ? { material: f.composite.material } : {}), ...(f.composite.datumModifiers ? { datumModifiers: { ...f.composite.datumModifiers } } : {}) } } : {}) });
  }
  return out;
}
export function checkDrawingFrames(args: Record<string, unknown>): Problem[] {
  if (!('frames' in args)) return [];
  const x = args.frames;
  if (!Array.isArray(x) || x.length > 200 || Array.from(x.keys()).some(i => !Object.hasOwn(x, i) || !frameOk(x[i]) || Object.keys(x[i]).some(k => !keys.includes(k))) || readFrames(x).length !== x.length) return [problem('DRAWING_OPTIONS', 'frames needs at most 200 unique ids; each frame needs either a unique dim reference or view and finite dense place[2], not both. A supported characteristic, finite value in (0, 100), up to three unique datum letters; optional diameter, material maximum|least, datumModifiers keyed by its datums, projected height in (0, 1000], freeState and tangentPlane. Composite is a second row for position only, with its own value, datums and optional diameter, material and datumModifiers. No other keys.')];
  return [];
}
/** Refuse saved composite data that the drawing reader would otherwise discard. Legacy-only files stay permissive. */
export function checkSavedCompositeFrames(rawDrawing: unknown): Problem[] {
  if (!record(rawDrawing) || !Array.isArray(rawDrawing.frames)) return [];
  const frames: unknown[] = rawDrawing.frames;
  const ids = new Map<string, number>(), dims = new Map<string, number>();
  for (const f of frames) if (record(f)) {
    if (typeof f.id === 'string') ids.set(f.id, (ids.get(f.id) ?? 0) + 1);
    if (typeof f.dim === 'string') dims.set(f.dim, (dims.get(f.dim) ?? 0) + 1);
  }
  for (const [index, f] of frames.entries()) {
    if (!record(f) || !Object.hasOwn(f, 'composite')) continue;
    if (!record(f.composite) || !frameOk(f) || Object.keys(f).some(k => !keys.includes(k)))
      return [problem('DRAWING_OPTIONS', `Saved composite frame ${index + 1} is invalid or contains unsupported fields. The file cannot be opened without losing data. Keep the original file.`)];
    if ((ids.get(f.id) ?? 0) > 1 || (f.dim !== undefined && (dims.get(f.dim) ?? 0) > 1))
      return [problem('DRAWING_OPTIONS', `Saved composite frame ${index + 1} has a duplicate id or dimension reference. The file cannot be opened without losing data. Keep the original file.`)];
  }
  return [];
}
/** Refuse marked saved frames that normalization would otherwise discard, regardless of document schema. */
export function checkSavedDrawingFrames(rawDrawing: unknown): Problem[] {
  if (!record(rawDrawing)) return [];
  const marked = (f: unknown) => record(f) && ['view', 'place', 'composite'].some(k => Object.hasOwn(f, k));
  if (!Array.isArray(rawDrawing.frames)) return marked(rawDrawing.frames)
    ? [problem('DRAWING_OPTIONS', 'Saved standalone or composite frames must be in an array. Keep the original file.')]
    : [];
  const compositeProblems = checkSavedCompositeFrames(rawDrawing);
  if (compositeProblems.length) return compositeProblems;
  const ids = new Map<string, number>(), dims = new Map<string, number>();
  for (const f of rawDrawing.frames) if (record(f)) {
    if (typeof f.id === 'string') ids.set(f.id, (ids.get(f.id) ?? 0) + 1);
    if (typeof f.dim === 'string') dims.set(f.dim, (dims.get(f.dim) ?? 0) + 1);
  }
  for (const [index, f] of rawDrawing.frames.entries()) {
    if (!marked(f)) continue;
    if (!frameOk(f) || Object.keys(f).some(k => !keys.includes(k)))
      return [problem('DRAWING_OPTIONS', `Saved frame ${index + 1} is invalid or contains unsupported fields. Keep the original file.`)];
    if ((ids.get(f.id) ?? 0) > 1 || (f.dim !== undefined && (dims.get(f.dim) ?? 0) > 1))
      return [problem('DRAWING_OPTIONS', `Saved frame ${index + 1} has a duplicate id or dimension reference. Keep the original file.`)];
  }
  return [];
}
export const framesProperty = {
  type: 'array', maxItems: 200,
  description: "Replaces geometric control frames; [] clears; omitted keeps. A frame has either dim, or an explicit view and place in that view's model mm. Missing dimensions, views and datums are drawing issues. IDs are unique; one attached frame per dimension. Symbols and modifiers are authored annotations.",
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' }, dim: { type: 'string' },
      view: { type: 'string', anyOf: [{ enum: ['front', 'top', 'right', 'iso'] }, { pattern: '^section:[A-Z]{1,2}$' }, { pattern: '^detail:[A-Z]{1,2}$' }] },
      place: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      characteristic: { type: 'string', enum: [...CHARACTERISTICS] },
      value: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 },
      datums: { type: 'array', maxItems: 3, items: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' } },
      diameter: { type: 'boolean' }, material: { type: 'string', enum: ['maximum', 'least'] },
      datumModifiers: { type: 'object', additionalProperties: { type: 'string', enum: ['maximum', 'least'] } },
      projected: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
      freeState: { type: 'boolean' }, tangentPlane: { type: 'boolean' },
      composite: {
        type: 'object', description: 'Second row of a composite position frame; shares the frame ID and characteristic.',
        properties: {
          value: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 },
          datums: { type: 'array', maxItems: 3, items: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' } },
          diameter: { type: 'boolean' }, material: { type: 'string', enum: ['maximum', 'least'] },
          datumModifiers: { type: 'object', additionalProperties: { type: 'string', enum: ['maximum', 'least'] } },
        },
        required: ['value', 'datums'], additionalProperties: false,
      },
    },
    required: ['id', 'characteristic', 'value', 'datums'],
    allOf: [{ if: { required: ['composite'] }, then: { properties: { characteristic: { const: 'position' } } } }],
    oneOf: [{ required: ['dim'], not: { anyOf: [{ required: ['view'] }, { required: ['place'] }] } }, { required: ['view', 'place'], not: { required: ['dim'] } }],
    additionalProperties: false,
  },
};

/** Small vector symbols keep the PDF/DXF writers independent of a special symbol font. */
export function characteristicMarks(kind: Characteristic, c: XY): Mark[] {
  const [x, y] = c, r = 1.7, arm = 2.3;
  const line = (a: XY, b: XY): Mark => ({ kind: 'line', a: [x + a[0], y + a[1]], b: [x + b[0], y + b[1]], pen: 'thin', role: 'frame' });
  const circle = (radius = r): Mark => ({ kind: 'arc', center: c, u: [radius, 0], v: [0, radius], t0: 0, t1: 2 * Math.PI, pen: 'thin', role: 'frame' });
  const profile: Mark = { kind: 'arc', center: [x, y + 1], u: [2.2, 0], v: [0, 2.2], t0: Math.PI, t1: 2 * Math.PI, pen: 'thin', role: 'frame' };
  const arrow = (dx: number): Mark[] => [line([dx - 1, 1.8], [dx + 1, -1.8]), line([dx + 1, -1.8], [dx - 0.3, -1.2]), line([dx + 1, -1.8], [dx + 1.2, -0.4])];
  switch (kind) {
    case 'position': return [circle(), line([-arm, 0], [arm, 0]), line([0, -arm], [0, arm])];
    case 'straightness': return [line([-arm, 0], [arm, 0])];
    case 'flatness': return [{ kind: 'polyline', points: [[x - 2.3, y + 1.3], [x + 1.3, y + 1.3], [x + 2.3, y - 1.3], [x - 1.3, y - 1.3], [x - 2.3, y + 1.3]], pen: 'thin', role: 'frame' }];
    case 'circularity': return [circle()];
    case 'cylindricity': return [circle(1.4), line([-2.3, 2], [-1.5, -2]), line([1.5, 2], [2.3, -2])];
    case 'profile-line': return [profile];
    case 'profile-surface': return [profile, line([-2.2, 1], [2.2, 1])];
    case 'parallelism': return [line([-2, 1.8], [-0.3, -1.8]), line([0.3, 1.8], [2, -1.8])];
    case 'perpendicularity': return [line([-arm, 1.7], [arm, 1.7]), line([0, 1.7], [0, -1.7])];
    case 'angularity': return [line([-arm, 1.7], [arm, 1.7]), line([-arm, 1.7], [1.2, -1.7])];
    case 'concentricity': return [circle(), circle(0.8)];
    case 'symmetry': return [line([-arm, 0], [arm, 0]), line([-1.7, -1.3], [1.7, -1.3]), line([-1.7, 1.3], [1.7, 1.3])];
    case 'circular-runout': return arrow(0);
    case 'total-runout': return [...arrow(-0.9), ...arrow(0.9), line([-1.9, 1.8], [-0.1, 1.8])];
  }
}

export function modifierMarks(letter: string, c: XY): Mark[] {
  return [{ kind: 'arc', center: c, u: [1.5, 0], v: [0, 1.5], t0: 0, t1: 2 * Math.PI, pen: 'thin', role: 'frame' }, { kind: 'text', at: [c[0], c[1] + 0.65], text: letter, size: 1.8, anchor: 'middle' }];
}
