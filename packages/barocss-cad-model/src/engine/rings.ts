// The user's retaining-ring rows (O139, the kernel lane's open studio item after D157): a ring's groove as its maker
// gives it — the shaft's diameter, the groove's diameter and width — each row citing its source or marked an estimate,
// none built in. A ring naming a row is checked against it by the kernel (ringSolid: the step's and the groove's sizes);
// a ring with no row stays an estimate, said so. A row a ring uses stays (remove the ring first).
import type { StudioDoc } from './doc';

export interface StudioRingRow { id: string; designation?: string; shaftDiameterMM: number; grooveDiameterMM: number; grooveWidthMM: number; source?: string; estimate?: true }
const FIELDS = new Set(['id', 'designation', 'shaftDiameterMM', 'grooveDiameterMM', 'grooveWidthMM', 'source', 'estimate']);
const size = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** What is wrong with a ring row, or null. */
export function ringRowProblem(r: unknown): string | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'a ring row is an object { id, shaftDiameterMM, grooveDiameterMM, grooveWidthMM, source | estimate: true }';
  const o = r as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `ring row ${o.id}` : 'a ring row';
  if (typeof o.id !== 'string' || !o.id.trim()) return 'a ring row needs an id';
  for (const k of Object.keys(o)) if (!FIELDS.has(k)) return `${at}: unknown field ${k}`;
  if (o.designation !== undefined && typeof o.designation !== 'string') return `${at}: designation is text`;
  for (const k of ['shaftDiameterMM', 'grooveDiameterMM', 'grooveWidthMM'] as const) if (!size(o[k])) return `${at}: ${k} must be a number of mm above 0`;
  if (!((o.grooveDiameterMM as number) < (o.shaftDiameterMM as number))) return `${at}: the groove's Ø${o.grooveDiameterMM} must be below the shaft's Ø${o.shaftDiameterMM}`;
  if (o.estimate !== undefined && o.estimate !== true) return `${at}: estimate is true or left out`;
  const src = typeof o.source === 'string' && o.source.trim() !== '', est = o.estimate === true;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source is text (where the row is from)`;
  if (src === est) return `${at}: cite its source or say estimate: true — ${src ? 'not both' : 'never neither'}`;
  return null;
}
/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editRingRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = ringRowProblem(r); if (p) return { error: p }; }
  const was = doc.rings?.rows ?? [], gone = remove.filter(id => !was.some(r => r.id === id));
  if (gone.length) return { error: `no ring row ${gone.join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'})` };
  const used = remove.filter(id => doc.nodes.some(n => n.kind === 'retaining-ring' && n.row === id));
  if (used.length) return { error: `ring row ${used.join(', ')} is used by a retaining ring: remove the ring first` };
  const incoming = add as StudioRingRow[], ids = new Set([...remove, ...incoming.map(r => r.id)]);
  return { doc: { ...doc, rings: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}
/** The rows for a groove: those of its shaft step's and groove's sizes, first (to 1e-6 mm). */
export function ringRowsFor(doc: Pick<StudioDoc, 'rings'>, shaftDiameterMM: number, grooveDiameterMM: number): StudioRingRow[] {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
  return (doc.rings?.rows ?? []).filter(r => near(r.shaftDiameterMM, shaftDiameterMM) && near(r.grooveDiameterMM, grooveDiameterMM));
}
