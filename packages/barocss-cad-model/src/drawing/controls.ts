// DR-6a: authored geometric control frames. This is annotation data, not a tolerance solver.
import { problem, type Problem } from '../engine/refusal';
import type { Mark } from './sheet';
import type { XY } from './types';

export const CHARACTERISTICS = ['position', 'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface', 'parallelism', 'perpendicularity', 'angularity', 'concentricity', 'symmetry', 'circular-runout', 'total-runout'] as const;
export type Characteristic = typeof CHARACTERISTICS[number];
export type MaterialModifier = 'maximum' | 'least';
export interface DrawingFrame {
  id: string; dim: string; characteristic: Characteristic; value: number; datums: string[];
  /** Absent: diameter for position, linear for every other characteristic. */
  diameter?: boolean;
  material?: MaterialModifier;
  datumModifiers?: Record<string, MaterialModifier>;
  /** Projected zone height, model mm. */ projected?: number;
  freeState?: boolean;
  tangentPlane?: boolean;
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const label = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 120;
const material = (x: unknown): x is MaterialModifier => x === 'maximum' || x === 'least';
const keys = ['id', 'dim', 'characteristic', 'value', 'datums', 'diameter', 'material', 'datumModifiers', 'projected', 'freeState', 'tangentPlane'];
export function frameOk(x: unknown): x is DrawingFrame {
  if (!record(x) || !label(x.id) || !label(x.dim) || !CHARACTERISTICS.includes(x.characteristic as Characteristic) || typeof x.value !== 'number' || !Number.isFinite(x.value) || x.value <= 0 || x.value >= 100 || !Array.isArray(x.datums) || x.datums.length > 3 || !x.datums.every(d => typeof d === 'string' && /^[A-HJ-NPR-Z]$/.test(d)) || new Set(x.datums).size !== x.datums.length) return false;
  return (x.diameter === undefined || typeof x.diameter === 'boolean') && (x.material === undefined || material(x.material)) &&
    (x.datumModifiers === undefined || (record(x.datumModifiers) && Object.entries(x.datumModifiers).every(([d, m]) => (x.datums as string[]).includes(d) && material(m)))) &&
    (x.projected === undefined || (typeof x.projected === 'number' && Number.isFinite(x.projected) && x.projected > 0 && x.projected <= 1000)) &&
    ['freeState', 'tangentPlane'].every(k => x[k] === undefined || typeof x[k] === 'boolean');
}
export function readFrames(x: unknown): DrawingFrame[] {
  const out: DrawingFrame[] = [];
  if (Array.isArray(x)) for (const f of x) {
    if (!frameOk(f) || out.some(old => old.id === f.id || old.dim === f.dim)) continue;
    out.push({ id: f.id, dim: f.dim, characteristic: f.characteristic, value: f.value, datums: [...f.datums], ...(f.diameter !== undefined ? { diameter: f.diameter } : {}), ...(f.material ? { material: f.material } : {}), ...(f.datumModifiers ? { datumModifiers: { ...f.datumModifiers } } : {}), ...(f.projected !== undefined ? { projected: f.projected } : {}), ...(f.freeState ? { freeState: true } : {}), ...(f.tangentPlane ? { tangentPlane: true } : {}) });
  }
  return out;
}
export function checkDrawingFrames(args: Record<string, unknown>): Problem[] {
  if (!('frames' in args)) return [];
  const x = args.frames;
  if (!Array.isArray(x) || x.length > 200 || x.some(f => !frameOk(f) || Object.keys(f).some(k => !keys.includes(k))) || readFrames(x).length !== x.length) return [problem('DRAWING_OPTIONS', 'frames needs at most 200 unique ids and dimension references, a supported characteristic, finite value in (0, 100), up to three unique datum letters; optional diameter, material maximum|least, datumModifiers keyed by its datums, projected height in (0, 1000], freeState and tangentPlane. No other keys.')];
  return [];
}
export const framesProperty = { type: 'array', maxItems: 200, description: 'DR-6a: replaces dimension-attached geometric control frames; [] clears; omitted keeps. Symbols and modifiers are authored annotations. Missing dimensions/datums are drawing issues. One frame per dimension.', items: { type: 'object', properties: { id: { type: 'string' }, dim: { type: 'string' }, characteristic: { type: 'string', enum: [...CHARACTERISTICS] }, value: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 }, datums: { type: 'array', maxItems: 3, items: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' } }, diameter: { type: 'boolean' }, material: { type: 'string', enum: ['maximum', 'least'] }, datumModifiers: { type: 'object', additionalProperties: { type: 'string', enum: ['maximum', 'least'] } }, projected: { type: 'number', exclusiveMinimum: 0, maximum: 1000 }, freeState: { type: 'boolean' }, tangentPlane: { type: 'boolean' } }, required: ['id', 'dim', 'characteristic', 'value', 'datums'], additionalProperties: false } };

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
