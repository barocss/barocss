// DR-6a: authored geometric control frames. This is annotation data, not a tolerance solver.
import { problem, type Problem } from '../engine/refusal';
import type { Mark } from './sheet';
import { isDimView, type DimView, type XY } from './types';

export const CHARACTERISTICS = ['position', 'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface', 'parallelism', 'perpendicularity', 'angularity', 'concentricity', 'symmetry', 'circular-runout', 'total-runout'] as const;
export type Characteristic = typeof CHARACTERISTICS[number];
export type MaterialModifier = 'maximum' | 'least';
/** All around (a circle) or all over (a double circle): profile frames only. */
export type AroundModifier = 'all-around' | 'all-over';
/** One extra row of a frame: the second segment of a composite frame, or a separate stacked frame. */
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
  /** The second segment of an authored composite position or profile frame. */
  composite?: DrawingFrameComposite;
  /** A second, independent single-segment frame of the same characteristic, drawn as its own frame below this one. */
  stacked?: DrawingFrameComposite;
  /** Spherical zone (SØ); position only. */ sphere?: boolean;
  /** Statistical tolerance (ST in a hexagon after the value). */ statistical?: boolean;
  /** Unequally disposed profile: the amount of the zone that lies outward, model mm (0 up to the value); profile only. */ unequal?: number;
  around?: AroundModifier;
}
/** An attached frame follows its dimension; a standalone frame has an explicit view-mm position. */
export type DrawingFrame = DrawingFrameFields & (
  | { dim: string; view?: never; place?: never }
  | { dim?: never; view: DimView; place: XY }
);
/** A frame's number as authored: up to 4 decimals, trailing zeros trimmed, never the dimension rounding of 0.01. */
export const fmtTol = (v: number): string => String(Number(v.toFixed(4)));
/** The zone sign before a row's value: SØ for a spherical zone, Ø for a diameter zone (position's default), else none. */
export const zonePrefix = (f: { characteristic: Characteristic; sphere?: boolean }, row: { diameter?: boolean }): string => f.sphere ? 'SØ' : (row.diameter ?? f.characteristic === 'position') ? 'Ø' : '';
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const label = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 120;
const material = (x: unknown): x is MaterialModifier => x === 'maximum' || x === 'least';
const keys = ['id', 'dim', 'view', 'place', 'characteristic', 'value', 'datums', 'diameter', 'material', 'datumModifiers', 'projected', 'freeState', 'tangentPlane', 'composite', 'stacked', 'sphere', 'statistical', 'unequal', 'around'];
const aroundOk = (x: unknown): x is AroundModifier => x === 'all-around' || x === 'all-over';
const unequalOk = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 100;
const compositeKeys = ['value', 'datums', 'diameter', 'material', 'datumModifiers'];
const placeOk = (x: unknown): x is XY => Array.isArray(x) && x.length === 2 && Object.hasOwn(x, 0) && Object.hasOwn(x, 1) && x.every(v => typeof v === 'number' && Number.isFinite(v));
/** The first thing wrong with one row (the frame's own or its second segment), in a person's words; null when it is valid. */
function rowProblem(x: Record<string, unknown>): string | null {
  if (typeof x.value !== 'number' || !Number.isFinite(x.value) || x.value <= 0 || x.value >= 100) return 'tolerance must be more than 0 and less than 100 mm';
  if (!Array.isArray(x.datums)) return 'datums must be a list of letters';
  if (x.datums.length > 3) return 'use at most three datums';
  if (![...x.datums].every(d => typeof d === 'string' && /^[A-HJ-NPR-Z]$/.test(d))) return 'datums are single letters A to Z, except I, O and Q';
  if (new Set(x.datums).size !== x.datums.length) return 'each datum can appear only once';
  if (x.diameter !== undefined && typeof x.diameter !== 'boolean') return 'the diameter zone is on or off';
  if (x.material !== undefined && !material(x.material)) return 'the material modifier is maximum or least';
  if (x.datumModifiers !== undefined && !(record(x.datumModifiers) && Object.entries(x.datumModifiers).every(([d, m]) => (x.datums as string[]).includes(d) && material(m)))) return 'a datum modifier needs its datum in the list';
  return null;
}
/** Characteristics that may have a composite second segment. */
const compositeKinds: readonly Characteristic[] = ['position', 'profile-line', 'profile-surface'];
const rowOk = (x: Record<string, unknown>): boolean => rowProblem(x) === null;
/**
 * The first reason one frame is refused, short and in a person's words (for an editor's notice); null when it is valid.
 * checkDrawingFrames keeps the full contract message for tools and agents. List-level rules (count, unique ids, one frame
 * per dimension) are not checked here.
 */
export function frameProblem(x: unknown): string | null {
  if (!record(x)) return 'A frame must be an object.';
  if (!label(x.id)) return 'The frame needs an id of 1 to 120 characters.';
  if (!CHARACTERISTICS.includes(x.characteristic as Characteristic)) return 'Choose a supported characteristic.';
  const row = rowProblem(x);
  if (row) return `${row[0].toUpperCase()}${row.slice(1)}.`;
  if (!(label(x.dim) && !('view' in x) && !('place' in x)) && !(!('dim' in x) && isDimView(x.view) && placeOk(x.place))) return 'A frame is attached to one dimension or placed in one view, not both.';
  if (x.composite !== undefined) {
    if (!compositeKinds.includes(x.characteristic as Characteristic)) return 'Only a position or profile frame can have a second segment.';
    if (!record(x.composite) || !Object.keys(x.composite).every(k => compositeKeys.includes(k))) return 'The second segment has unsupported fields.';
    const second = rowProblem(x.composite);
    if (second) return `Second segment: ${second}.`;
  }
  if (x.stacked !== undefined) {
    if (!record(x.stacked) || !Object.keys(x.stacked).every(k => compositeKeys.includes(k))) return 'The stacked frame has unsupported fields.';
    const stacked = rowProblem(x.stacked);
    if (stacked) return `Stacked frame: ${stacked}.`;
  }
  if (!['sphere', 'statistical'].every(k => x[k] === undefined || typeof x[k] === 'boolean')) return 'Spherical zone and statistical tolerance are on or off.';
  if (x.unequal !== undefined && !unequalOk(x.unequal)) return 'The unequal amount must be 0 or more and less than 100 mm.';
  if (x.around !== undefined && !aroundOk(x.around)) return 'All around or all over.';
  if (x.projected !== undefined && !(typeof x.projected === 'number' && Number.isFinite(x.projected) && x.projected > 0 && x.projected <= 1000)) return 'Projected height must be more than 0 and at most 1000 mm.';
  if (!['freeState', 'tangentPlane'].every(k => x[k] === undefined || typeof x[k] === 'boolean')) return 'Free state and tangent plane are on or off.';
  if (Object.keys(x).some(k => !keys.includes(k))) return 'The frame has unsupported fields.';
  return null;
}
export function frameOk(x: unknown): x is DrawingFrame {
  if (!record(x) || !label(x.id) || !CHARACTERISTICS.includes(x.characteristic as Characteristic) || !rowOk(x)) return false;
  if (!(label(x.dim) && !('view' in x) && !('place' in x)) && !(!('dim' in x) && isDimView(x.view) && placeOk(x.place))) return false;
  return (x.composite === undefined || (compositeKinds.includes(x.characteristic as Characteristic) && record(x.composite) && Object.keys(x.composite).every(k => compositeKeys.includes(k)) && rowOk(x.composite))) &&
    (x.stacked === undefined || (record(x.stacked) && Object.keys(x.stacked).every(k => compositeKeys.includes(k)) && rowOk(x.stacked))) &&
    ['sphere', 'statistical'].every(k => x[k] === undefined || typeof x[k] === 'boolean') && (x.unequal === undefined || unequalOk(x.unequal)) && (x.around === undefined || aroundOk(x.around)) &&
    (x.projected === undefined || (typeof x.projected === 'number' && Number.isFinite(x.projected) && x.projected > 0 && x.projected <= 1000)) &&
    ['freeState', 'tangentPlane'].every(k => x[k] === undefined || typeof x[k] === 'boolean');
}
const copyRow = (r: DrawingFrameComposite): DrawingFrameComposite => ({ value: r.value, datums: [...r.datums], ...(r.diameter !== undefined ? { diameter: r.diameter } : {}), ...(r.material ? { material: r.material } : {}), ...(r.datumModifiers ? { datumModifiers: { ...r.datumModifiers } } : {}) });
const FORM: readonly Characteristic[] = ['straightness', 'flatness', 'circularity', 'cylindricity'];
const ORIENTATION: readonly Characteristic[] = ['parallelism', 'perpendicularity', 'angularity'];
const RUNOUT: readonly Characteristic[] = ['circular-runout', 'total-runout'];
const PROFILE: readonly Characteristic[] = ['profile-line', 'profile-surface'];
const NEEDS_DATUM: readonly Characteristic[] = [...ORIENTATION, 'concentricity', 'symmetry', ...RUNOUT];
const NO_MATERIAL: readonly Characteristic[] = ['circularity', 'cylindricity', ...PROFILE, ...RUNOUT];
const NO_DATUM_MATERIAL: readonly Characteristic[] = RUNOUT;
const DIAMETER_OK: readonly Characteristic[] = ['position', 'straightness', ...ORIENTATION, 'concentricity'];
const name = (c: Characteristic) => c.replaceAll('-', ' ');
/** The rules a row of one frame follows (its own first row, the second segment or a stacked frame); `at` names the row. */
function rowRules(c: Characteristic, r: { datums: string[]; diameter?: boolean; material?: MaterialModifier; datumModifiers?: Record<string, MaterialModifier> }, at: string): string[] {
  const out: string[] = [];
  if (FORM.includes(c) && r.datums.length) out.push(`${at}${name(c)} is a form tolerance and takes no datums.`);
  if (NEEDS_DATUM.includes(c) && !r.datums.length) out.push(`${at}${name(c)} needs at least one datum.`);
  if (r.material && NO_MATERIAL.includes(c)) out.push(`${at}${name(c)} takes no maximum or least material modifier${c === 'circularity' || c === 'cylindricity' ? ' (only straightness and flatness of a derived line or plane can)' : ''}.`);
  if (r.datumModifiers && Object.keys(r.datumModifiers).length && NO_DATUM_MATERIAL.includes(c)) out.push(`${at}${name(c)} takes no material modifier on its datums.`);
  if (r.diameter === true && !DIAMETER_OK.includes(c)) out.push(`${at}${name(c)} takes no diameter zone (only position, straightness, orientation and concentricity can).`);
  return out;
}
/**
 * What breaks the Y14.5 / ISO 1101 rules common to both, one plain sentence each; [] when the frame follows them.
 * These are authoring rules: new and edited frames are refused, a saved drawing that breaks one still opens and the
 * drawing check reports it.
 */
export function frameRules(f: DrawingFrame): string[] {
  const c = f.characteristic, out = rowRules(c, f, '');
  if (f.projected !== undefined && c !== 'position' && !ORIENTATION.includes(c)) out.push(`${name(c)} takes no projected zone (only position and orientation can).`);
  if (f.tangentPlane && !ORIENTATION.includes(c) && !PROFILE.includes(c)) out.push(`${name(c)} takes no tangent plane (only orientation and profile can).`);
  if (f.tangentPlane && (f.diameter === true || f.projected !== undefined)) out.push('A tangent plane is a surface: it is not combined with a diameter zone or a projected zone.');
  if (f.sphere && c !== 'position') out.push('A spherical zone (SØ) is for position only.');
  if (f.sphere && f.diameter === false) out.push('A spherical zone is a diameter zone: turn the diameter zone on.');
  if (f.unequal !== undefined) {
    if (!PROFILE.includes(c)) out.push('An unequally disposed zone is for profile only.');
    else if (f.unequal > f.value) out.push('The unequal amount cannot be more than the tolerance.');
  }
  if (f.around && !PROFILE.includes(c)) out.push('All around and all over are for profile only.');
  if (f.composite && f.stacked) out.push('A frame is composite or stacked, not both.');
  if (f.composite) {
    if (!compositeKinds.includes(c)) out.push('Only a position or profile frame can have a second segment.');
    out.push(...rowRules(c, f.composite, 'Second segment: '));
    if (f.composite.value >= f.value) out.push('Second segment: the tolerance must be smaller than the first segment\'s.');
    let at = 0;
    for (const d of f.composite.datums) { const k = f.datums.indexOf(d, at); if (k < 0) { out.push('Second segment: its datums must be some of the first segment\'s, in the same order.'); break; } at = k + 1; }
  }
  if (f.stacked) {
    if (!compositeKinds.includes(c)) out.push('Only a position or profile frame can be stacked.');
    out.push(...rowRules(c, f.stacked, 'Stacked frame: '));
  }
  return out;
}
export function readFrames(x: unknown): DrawingFrame[] {
  const out: DrawingFrame[] = [];
  if (Array.isArray(x)) for (const f of x) {
    if (!frameOk(f) || out.some(old => old.id === f.id || f.dim !== undefined && old.dim === f.dim)) continue;
    out.push({ id: f.id, ...(f.dim !== undefined ? { dim: f.dim } : { view: f.view, place: [f.place[0], f.place[1]] as XY }), characteristic: f.characteristic, value: f.value, datums: [...f.datums], ...(f.diameter !== undefined ? { diameter: f.diameter } : {}), ...(f.material ? { material: f.material } : {}), ...(f.datumModifiers ? { datumModifiers: { ...f.datumModifiers } } : {}), ...(f.projected !== undefined ? { projected: f.projected } : {}), ...(f.freeState !== undefined ? { freeState: f.freeState } : {}), ...(f.tangentPlane !== undefined ? { tangentPlane: f.tangentPlane } : {}), ...(f.composite ? { composite: copyRow(f.composite) } : {}), ...(f.stacked ? { stacked: copyRow(f.stacked) } : {}), ...(f.sphere !== undefined ? { sphere: f.sphere } : {}), ...(f.statistical !== undefined ? { statistical: f.statistical } : {}), ...(f.unequal !== undefined ? { unequal: f.unequal } : {}), ...(f.around ? { around: f.around } : {}) });
  }
  return out;
}
/**
 * `current` are the frames the drawing has now. A saved frame that already breaks a rule does not stop the others being
 * edited, moved or removed, and can itself be repaired step by step: only a rule break it did not have before is refused.
 */
export function checkDrawingFrames(args: Record<string, unknown>, current: readonly DrawingFrame[] = []): Problem[] {
  if (!('frames' in args)) return [];
  const x = args.frames;
  if (!Array.isArray(x) || x.length > 200 || Array.from(x.keys()).some(i => !Object.hasOwn(x, i) || !frameOk(x[i]) || Object.keys(x[i]).some(k => !keys.includes(k))) || readFrames(x).length !== x.length) return [problem('DRAWING_OPTIONS', 'frames needs at most 200 unique ids; each frame needs either a unique dim reference or view and finite dense place[2], not both. A supported characteristic, finite value in (0, 100), up to three unique datum letters; optional diameter, material maximum|least, datumModifiers keyed by its datums, projected height in (0, 1000], freeState and tangentPlane, sphere, statistical, unequal (profile) and around (profile). Composite (position or profile) is a second row, stacked is a separate second frame, each with its own value, datums and optional diameter, material and datumModifiers. No other keys.')];
  // A frame is refused for a rule break it did not already have: an old frame can be repaired one field at a time.
  const old = new Map(current.map(f => [f.id, frameRules(f)]));
  for (const f of readFrames(x)) {
    const had = old.get(f.id) ?? [], why = frameRules(f).find(r => !had.includes(r));
    if (why) return [problem('DRAWING_OPTIONS', `Frame ${f.id}: ${why}`)];
  }
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
  const marked = (f: unknown) => record(f) && ['view', 'place', 'composite', 'stacked', 'sphere', 'statistical', 'unequal', 'around'].some(k => Object.hasOwn(f, k));
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
const rowSchema = (description: string) => ({
  type: 'object', description,
  properties: {
    value: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 100 },
    datums: { type: 'array', maxItems: 3, items: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' } },
    diameter: { type: 'boolean' }, material: { type: 'string', enum: ['maximum', 'least'] },
    datumModifiers: { type: 'object', additionalProperties: { type: 'string', enum: ['maximum', 'least'] } },
  },
  required: ['value', 'datums'], additionalProperties: false,
});
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
      sphere: { type: 'boolean', description: 'Spherical zone SØ; position only.' }, statistical: { type: 'boolean', description: 'Statistical tolerance (ST).' },
      unequal: { type: 'number', minimum: 0, exclusiveMaximum: 100, description: 'Unequally disposed profile: the outward amount, 0 up to the value; profile only.' },
      around: { type: 'string', enum: ['all-around', 'all-over'], description: 'Profile only.' },
      composite: { ...rowSchema('Second segment of a composite position or profile frame; shares the frame ID and characteristic. Its datums are some of the first segment\'s in the same order and its value is smaller.') },
      stacked: { ...rowSchema('A second, independent frame of the same position or profile characteristic, drawn below the first; not with composite.') },
    },
    required: ['id', 'characteristic', 'value', 'datums'],
    allOf: [{ if: { anyOf: [{ required: ['composite'] }, { required: ['stacked'] }] }, then: { properties: { characteristic: { enum: ['position', 'profile-line', 'profile-surface'] } } } }],
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
