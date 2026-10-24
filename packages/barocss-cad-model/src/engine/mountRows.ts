// The person's mount rows (O14): how a motor, a servo or a bearing unit fixes to a flat face — its bolt pattern and
// clearance holes, its pilot (register) and shaft, where its output axis stands, a servo's body cut-out and the
// clearance cut round them — one row per model, from a datasheet file the person supplied (rows rule b), none built in.
// samples/rows/mounts.json is an example, each value with the page it was read from. A bearing unit's insert is a
// rolling bearing: it may name a bearings row (R12c.4's envelope), whose bore must be the unit's shaft. The mount
// command (app/mounts.ts) cuts what a row says into the face. A row says how a part is mounted, not what it can do
// (ratings stay the actuator catalogue's). (Unreleased: a document without these rows has none — owner, 2026-10-23.)
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';
import { firstProblem, problem, type Problem } from './refusal';

export type MountType = 'motor' | 'servo' | 'bearing-unit';
export type MountHoles =
  /** Four holes on a square, `spacingMM` apart (a NEMA flange). */
  | { pattern: 'square'; spacingMM: number; diameterMM: number }
  /** Four holes on a rectangle, [along, across] apart (a servo's tabs, a pillow block's base). */
  | { pattern: 'rect'; spacingMM: [number, number]; diameterMM: number }
  /** `count` holes on a circle of diameter `pcdMM`, the first at `startDeg` from the face's first axis. */
  | { pattern: 'circle'; pcdMM: number; count: number; diameterMM: number; startDeg?: number };
export const MOUNT_FIELDS = ['holes', 'pilotMM', 'pilotDepthMM', 'shaftMM', 'shaftOffsetMM', 'shaftHeightMM', 'bodyMM', 'clearanceMM', 'bearing'] as const;
type MountField = typeof MOUNT_FIELDS[number];
export interface StudioMountRow {
  id: string; type: MountType; designation?: string;
  holes: MountHoles;
  /** The register (spigot) on the mounting face, and how far it stands out (mm). */
  pilotMM?: number; pilotDepthMM?: number;
  /** The shaft's diameter, where it stands from the pattern's centre ([along, across], mm), and its axis above the face. */
  shaftMM: number; shaftOffsetMM?: [number, number]; shaftHeightMM: number;
  /** A servo's body ([along, across], mm), centred on the pattern: cut through the face. */
  bodyMM?: [number, number];
  /** Added all round to the pilot, shaft and body cut-outs (mm). */
  clearanceMM: number;
  /** A bearing unit's insert: a bearings row id (its bore must be shaftMM). */
  bearing?: string;
  source?: string; estimate?: true;
  fieldSources?: Partial<Record<MountField, string>>;
  unchecked?: MountField[];
}
/** The limits a row is checked against (mm; a count of holes). */
export const MOUNT_LIMITS = { holeMM: [1, 30], clearanceMM: [0, 5], circleCount: [2, 12], lengthMM: 2000 } as const;
const FIELDS: ReadonlySet<string> = new Set(['id', 'type', 'designation', ...MOUNT_FIELDS, 'source', 'estimate', 'fieldSources', 'unchecked']);
const ALL_FIELDS: ReadonlySet<string> = new Set(MOUNT_FIELDS);
const len = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MOUNT_LIMITS.lengthMM;
const pair = (v: unknown, test: (x: unknown) => boolean): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(test);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MOUNT_LIMITS.lengthMM;

/** The refusal where mounts are needed and none are loaded. */
export const NO_MOUNTS = '[MOUNT_ROW] no mount rows loaded — load your datasheet\'s mount rows (samples/rows/mounts.json is an example)';
/** The refusal where a mount names a row the document does not have. */
export const noMountRow = (id: string, have: readonly string[]) => `[MOUNT_ROW] no mount row ${id} (rows: ${have.join(', ') || 'none'}) — load it from your datasheet's rows`;

/** The holes' centres about the pattern's centre ([along, across], mm), in order. */
export function patternPoints(h: MountHoles): [number, number][] {
  if (h.pattern === 'circle') {
    const r = h.pcdMM / 2, a0 = ((h.startDeg ?? 0) * Math.PI) / 180;
    return Array.from({ length: h.count }, (_, i) => { const a = a0 + (2 * Math.PI * i) / h.count; return [r * Math.cos(a), r * Math.sin(a)]; });
  }
  const [sx, sy] = h.pattern === 'square' ? [h.spacingMM, h.spacingMM] : h.spacingMM;
  return [[-sx / 2, -sy / 2], [sx / 2, -sy / 2], [sx / 2, sy / 2], [-sx / 2, sy / 2]];
}

/** What is wrong with a mount row: none, or its one problem (every one [MOUNT_RANGE], naming the row and the field). */
export function checkMountRow(r: unknown): Problem[] {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [problem('MOUNT_RANGE', 'a mount row is an object { id, type (motor | servo | bearing-unit), holes, pilotMM?, pilotDepthMM?, shaftMM, shaftOffsetMM?, shaftHeightMM, bodyMM?, clearanceMM, bearing?, source | estimate }')];
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) return [problem('MOUNT_RANGE', 'a mount row needs an id')];
  const at = `mount row ${o.id}`;
  for (const k of Object.keys(o)) if (!FIELDS.has(k)) return [problem('MOUNT_RANGE', `${at}: unknown field ${k}`)];
  if (o.type !== 'motor' && o.type !== 'servo' && o.type !== 'bearing-unit') return [problem('MOUNT_RANGE', `${at}: type is motor, servo or bearing-unit`)];
  if (o.designation !== undefined && typeof o.designation !== 'string') return [problem('MOUNT_RANGE', `${at}: designation is text`)];
  const h = o.holes as Record<string, unknown> | undefined;
  if (!h || typeof h !== 'object' || Array.isArray(h)) return [problem('MOUNT_RANGE', `${at}: holes is {pattern: square | rect | circle, …, diameterMM}`)];
  const [dLo, dHi] = MOUNT_LIMITS.holeMM;
  if (!(typeof h.diameterMM === 'number' && h.diameterMM >= dLo && h.diameterMM <= dHi)) return [problem('MOUNT_RANGE', `${at}: holes.diameterMM is ${dLo}–${dHi} mm`)];
  const hd = h.diameterMM;
  let least: number;
  if (h.pattern === 'square') { if (!len(h.spacingMM) || Object.keys(h).some(k => !['pattern', 'spacingMM', 'diameterMM'].includes(k))) return [problem('MOUNT_RANGE', `${at}: a square pattern is {spacingMM, diameterMM}`)]; least = h.spacingMM; }
  else if (h.pattern === 'rect') { if (!pair(h.spacingMM, len) || Object.keys(h).some(k => !['pattern', 'spacingMM', 'diameterMM'].includes(k))) return [problem('MOUNT_RANGE', `${at}: a rect pattern is {spacingMM: [along, across], diameterMM}`)]; least = Math.min(...h.spacingMM); }
  else if (h.pattern === 'circle') {
    const [cLo, cHi] = MOUNT_LIMITS.circleCount;
    if (!len(h.pcdMM) || !(Number.isInteger(h.count) && (h.count as number) >= cLo && (h.count as number) <= cHi) || (h.startDeg !== undefined && !finite(h.startDeg)) || Object.keys(h).some(k => !['pattern', 'pcdMM', 'count', 'diameterMM', 'startDeg'].includes(k)))
      return [problem('MOUNT_RANGE', `${at}: a circle pattern is {pcdMM, count (${cLo}–${cHi}), diameterMM, startDeg?}`)];
    least = h.pcdMM * Math.sin(Math.PI / (h.count as number));
  } else return [problem('MOUNT_RANGE', `${at}: holes.pattern is square, rect or circle`)];
  if (!(least > hd)) return [problem('MOUNT_RANGE', `${at}: the holes (Ø${hd}) are closer than their diameter (${+least.toFixed(3)} mm apart)`)];
  const [kLo, kHi] = MOUNT_LIMITS.clearanceMM;
  if (!(typeof o.clearanceMM === 'number' && o.clearanceMM >= kLo && o.clearanceMM <= kHi)) return [problem('MOUNT_RANGE', `${at}: clearanceMM is ${kLo}–${kHi} mm`)];
  const c = o.clearanceMM;
  if (!len(o.shaftMM)) return [problem('MOUNT_RANGE', `${at}: shaftMM is the shaft's diameter, mm above 0`)];
  if (!(typeof o.shaftHeightMM === 'number' && o.shaftHeightMM >= 0 && o.shaftHeightMM <= MOUNT_LIMITS.lengthMM)) return [problem('MOUNT_RANGE', `${at}: shaftHeightMM is the axis above the mounting face, mm, 0 or more`)];
  if (o.shaftOffsetMM !== undefined && !pair(o.shaftOffsetMM, finite)) return [problem('MOUNT_RANGE', `${at}: shaftOffsetMM is [along, across], mm`)];
  for (const k of ['pilotMM', 'pilotDepthMM'] as const) if (o[k] !== undefined && !len(o[k])) return [problem('MOUNT_RANGE', `${at}: ${k} is mm above 0`)];
  if (o.pilotDepthMM !== undefined && o.pilotMM === undefined) return [problem('MOUNT_RANGE', `${at}: pilotDepthMM needs pilotMM`)];
  if (o.pilotMM !== undefined && !((o.pilotMM as number) > (o.shaftMM as number))) return [problem('MOUNT_RANGE', `${at}: the pilot Ø${o.pilotMM} must be wider than the shaft Ø${o.shaftMM}`)];
  if (o.bodyMM !== undefined && !pair(o.bodyMM, len)) return [problem('MOUNT_RANGE', `${at}: bodyMM is [along, across], mm`)];
  if (o.type === 'servo' && o.bodyMM === undefined) return [problem('MOUNT_RANGE', `${at}: a servo row gives its body (bodyMM)`)];
  if (o.type !== 'servo' && o.bodyMM !== undefined) return [problem('MOUNT_RANGE', `${at}: bodyMM is a servo's`)];
  if (o.bearing !== undefined && (o.type !== 'bearing-unit' || typeof o.bearing !== 'string')) return [problem('MOUNT_RANGE', `${at}: bearing names a bearings row, for a bearing unit`)];
  // (The pilot's cut, with its clearance, must stay clear of the holes' inner edges; the shaft's, for a flange.)
  const off = (o.shaftOffsetMM as [number, number] | undefined) ?? [0, 0], pts = patternPoints(h as unknown as MountHoles);
  const cut = o.pilotMM !== undefined ? (o.pilotMM as number) : o.type !== 'servo' && o.shaftHeightMM === 0 ? (o.shaftMM as number) : 0;
  if (cut) {
    const gap = Math.min(...pts.map(p => Math.hypot(p[0] - off[0], p[1] - off[1]))) - hd / 2 - (cut / 2 + c);
    if (!(gap > 0)) return [problem('MOUNT_RANGE', `${at}: the ${o.pilotMM !== undefined ? 'pilot' : 'shaft'} cut (Ø${cut} + ${c} clearance) runs into the holes`)];
  }
  if (o.type === 'servo') {
    const [bw, bh] = o.bodyMM as [number, number];
    if (pts.some(p => Math.abs(p[0]) - hd / 2 < bw / 2 + c && Math.abs(p[1]) - hd / 2 < bh / 2 + c)) return [problem('MOUNT_RANGE', `${at}: the body's cut-out (${bw} × ${bh} + ${c} clearance) runs into the holes`)];
    if (Math.abs(off[0]) + (o.shaftMM as number) / 2 > bw / 2 || Math.abs(off[1]) + (o.shaftMM as number) / 2 > bh / 2) return [problem('MOUNT_RANGE', `${at}: the shaft (offset ${off.join(', ')}) is outside the body`)];
  }
  if (o.estimate !== undefined && o.estimate !== true) return [problem('MOUNT_RANGE', `${at}: estimate is true or left out`)];
  if (o.source !== undefined && typeof o.source !== 'string') return [problem('MOUNT_RANGE', `${at}: source is text (where the row is from)`)];
  const src = typeof o.source === 'string' && o.source.trim() !== '', est = o.estimate === true;
  if (src === est) return [problem('MOUNT_RANGE', `${at}: cite its source or say estimate: true — ${src ? 'not both' : 'never neither'}`)];
  if (o.fieldSources !== undefined && (!o.fieldSources || typeof o.fieldSources !== 'object' || Array.isArray(o.fieldSources) || Object.entries(o.fieldSources).some(([k, v]) => !ALL_FIELDS.has(k) || typeof v !== 'string'))) return [problem('MOUNT_RANGE', `${at}: fieldSources maps fields to text`)];
  if (o.unchecked !== undefined && (!Array.isArray(o.unchecked) || o.unchecked.some(k => typeof k !== 'string' || !ALL_FIELDS.has(k)))) return [problem('MOUNT_RANGE', `${at}: unchecked lists fields`)];
  return [];
}

/** Rows added (each checked; one with an id held already replaces it); a row a mount uses stays. */
export function editMountRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<StudioMountRow>(doc.mounts?.rows ?? [], add, remove, { problem: r => firstProblem(checkMountRow(r)), noun: 'mount row',
    used: { by: id => doc.nodes.some(n => 'made' in n && n.made?.command === 'mount' && n.made.values.row === id), text: 'is used by a mount: remove it first' } });
  return 'error' in r ? r : { doc: { ...doc, mounts: { version: 1, rows: r.rows } } };
}
/** The document's mount rows by id (none loaded: none). */
export function mountRowsOf(doc: Pick<StudioDoc, 'mounts'>): ReadonlyMap<string, StudioMountRow> {
  return new Map((doc.mounts?.rows ?? []).map(r => [r.id, r]));
}
