// The user's retaining-ring rows (O139, the kernel lane's open studio item after D157): a ring's groove as its maker
// gives it — the shaft's diameter, the groove's diameter and width — each row citing its source or marked an estimate,
// none built in. A ring naming a row is checked against it by the kernel (ringSolid: the step's and the groove's sizes);
// a ring with no row stays an estimate, said so. A row a ring uses stays (remove the ring first).
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';
import { firstProblem, problem, type Problem } from './refusal';

export interface StudioRingRow { id: string; designation?: string; shaftDiameter: number; grooveDiameter: number; grooveWidth: number; source?: string; estimate?: true }
const FIELDS = new Set(['id', 'designation', 'shaftDiameter', 'grooveDiameter', 'grooveWidth', 'source', 'estimate']);
const size = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** What is wrong with a ring row: none, or its one problem (RING_ROW). */
export function checkRingRow(r: unknown): Problem[] {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [problem('RING_ROW', 'a ring row is an object { id, shaftDiameterMM, grooveDiameterMM, grooveWidthMM, source | estimate: true }')];
  const o = r as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `ring row ${o.id}` : 'a ring row';
  if (typeof o.id !== 'string' || !o.id.trim()) return [problem('RING_ROW', 'a ring row needs an id')];
  for (const k of Object.keys(o)) if (!FIELDS.has(k)) return [problem('RING_ROW', `${at}: unknown field ${k}`)];
  if (o.designation !== undefined && typeof o.designation !== 'string') return [problem('RING_ROW', `${at}: designation is text`)];
  for (const k of ['shaftDiameter', 'grooveDiameter', 'grooveWidth'] as const) if (!size(o[k])) return [problem('RING_ROW', `${at}: ${k} must be a number of mm above 0`)];
  if (!((o.grooveDiameter as number) < (o.shaftDiameter as number))) return [problem('RING_ROW', `${at}: the groove's Ø${o.grooveDiameter} must be below the shaft's Ø${o.shaftDiameter}`)];
  if (o.estimate !== undefined && o.estimate !== true) return [problem('RING_ROW', `${at}: estimate is true or left out`)];
  const src = typeof o.source === 'string' && o.source.trim() !== '', est = o.estimate === true;
  if (o.source !== undefined && typeof o.source !== 'string') return [problem('RING_ROW', `${at}: source is text (where the row is from)`)];
  if (src === est) return [problem('RING_ROW', `${at}: cite its source or say estimate: true — ${src ? 'not both' : 'never neither'}`)];
  return [];
}
/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editRingRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<StudioRingRow>(doc.rings?.rows ?? [], add, remove, { problem: r => firstProblem(checkRingRow(r)), noun: 'ring row',
    used: { by: id => doc.nodes.some(n => n.kind === 'retaining-ring' && n.row === id), text: 'is used by a retaining ring: remove the ring first' } });
  return 'error' in r ? r : { doc: { ...doc, rings: { version: 1, rows: r.rows } } };
}
/** The rows for a groove: those of its shaft step's and groove's sizes, first (to 1e-6 mm). */
export function ringRowsFor(doc: Pick<StudioDoc, 'rings'>, shaftDiameter: number, grooveDiameter: number): StudioRingRow[] {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
  return (doc.rings?.rows ?? []).filter(r => near(r.shaftDiameter, shaftDiameter) && near(r.grooveDiameter, grooveDiameter));
}
