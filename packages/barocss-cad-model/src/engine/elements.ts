// R12c's machine elements as data (O142, S1): the kernel's report of each element body — a spring, a shaft, a key, a
// keyway, a retaining ring, a dowel pin, a bearing, an O-ring gland, an O-ring — kept on its BodyResult as plain data
// (`element`), with the user's row it was checked against, so the drawing's tables and callouts and the BOM read the
// numbers, not the notes' text. Its shape is kept stable: the GPU lane's overlays and later analyses read it too.
import type { BearingReport, CadPartSnapshot, GlandReport, HookedSpringReport, KeyReport, KeywayReport, PinReport, RingReport, ShaftReport, SpringReport } from '@barocss/cad';
import { featureLabel as featureLabelOf, type ModelNode, type StudioDoc } from './doc';

export type ElementReport =
  | { kind: 'spring'; report: SpringReport | HookedSpringReport }
  | { kind: 'shaft'; report: ShaftReport }
  | { kind: 'key'; report: KeyReport }
  | { kind: 'keyway'; report: KeywayReport }
  | { kind: 'retaining-ring'; report: RingReport }
  | { kind: 'pin'; report: PinReport }
  | { kind: 'bearing'; report: BearingReport }
  | { kind: 'oring-gland'; report: GlandReport }
  | { kind: 'oring'; report: { readonly ring: string; readonly overlapMM3: number; readonly stretchedCrossSectionMM: number } };
export type ElementKind = ElementReport['kind'];
/** The user's row an element was checked against: its id, and its source or that it is an estimate. */
export interface ElementRow { id: string; source?: string; estimate: boolean }
export type BodyElement = ElementReport & { row?: ElementRow };

type Output = CadPartSnapshot['outputs'][number];
/** An output's element, or null for a body that is none. */
export function elementOf(o: Output, node: ModelNode | undefined): BodyElement | null {
  if (o.spring) return { kind: 'spring', report: o.spring };
  if (o.shaft) return { kind: 'shaft', report: o.shaft };
  if (o.key) return { kind: 'key', report: o.key };
  if (o.keyway) return { kind: 'keyway', report: o.keyway };
  if (o.ring) {
    const id = node?.kind === 'retaining-ring' ? node.row : undefined;
    return { kind: 'retaining-ring', report: o.ring, ...(id ? { row: { id, ...(o.ring.source ? { source: o.ring.source } : {}), estimate: o.ring.estimate } } : {}) };
  }
  if (o.pin) return { kind: 'pin', report: o.pin };
  if (o.bearing) { const b = o.bearing; return { kind: 'bearing', report: b, row: { id: b.row, ...(b.source ? { source: b.source } : {}), estimate: b.estimate } }; }
  if (o.gland) { const g = o.gland; return { kind: 'oring-gland', report: g, row: { id: g.ring, ...(g.ringSource ? { source: g.ringSource } : {}), estimate: g.ringEstimate } }; }
  if (o.oring) return { kind: 'oring', report: o.oring };
  return null;
}

// ——— The element rows (O142, S1): what the BOM and the drawing's element list read.
/** Bought by default (the coordinator's list): a bearing, a retaining ring, a key, a dowel pin, an O-ring, a spring; any other node made. */
export const BOUGHT_BY_DEFAULT: ReadonlySet<string> = new Set(['bearing', 'retaining-ring', 'key', 'pin', 'oring', 'spring']);
/** Whether a node is bought, and what decided it: the person's override (`bought` on the node), or the default for its kind. */
export function boughtOf(node: ModelNode): { bought: boolean; by: 'override' | 'default' } {
  return node.bought !== undefined ? { bought: node.bought, by: 'override' } : { bought: BOUGHT_BY_DEFAULT.has(node.kind), by: 'default' };
}
export interface ElementLine {
  /** The feature (its id) and its label. */
  item: string; label: string;
  kind: string;
  /** Our own short text of its sizes, from the kernel's report (mm). */
  size: string;
  /** The user's row it was checked against, or null. */
  row: ElementRow | null;
  /** Whether a value of it is an estimate, and which. */
  estimate: boolean; why: string[];
  bought: boolean; boughtBy: 'override' | 'default';
  massG: number | null;
}
const n = (x: number) => `${+x.toFixed(3)}`;
/** A report's sizes as one short line (our own words; the values the kernel's). */
export function sizeOf(e: BodyElement, oringRow?: { insideDiameterMM: number; crossSectionMM: number }): string {
  switch (e.kind) {
    case 'spring': { const d = e.report.dimensions, type = e.report.type, L = 'freeLengthMM' in d ? `${n(d.freeLengthMM)} free` : `${n(d.bodyLengthMM)} body`; return `${type}, Ø${n(d.wireDiameterMM)} wire, Ø${n(d.meanDiameterMM)} mean × ${L}, ${n(d.activeCoils)} active`; }
    case 'shaft': { const ds = e.report.steps.map(s => s.diameterMM); return `${e.report.steps.length} steps Ø${n(Math.min(...ds))}–Ø${n(Math.max(...ds))} × ${n(e.report.lengthMM)}`; }
    case 'key': return `${n(e.report.widthMM)} × ${n(e.report.heightMM)} × ${n(e.report.lengthMM)}`;
    case 'keyway': return `${n(e.report.widthMM)} × ${n(e.report.depthMM)} in Ø${n(2 * e.report.boreRadiusMM)}`;
    case 'retaining-ring': return `Ø${n(e.report.innerDiameterMM)} / Ø${n(e.report.outerDiameterMM)} × ${n(e.report.thicknessMM)}`;
    case 'pin': return `Ø${n(e.report.diameterMM)} × ${n(e.report.lengthMM)}`;
    case 'bearing': return `${n(e.report.boreMM)} × ${n(e.report.outsideMM)} × ${n(e.report.widthMM)}`;
    case 'oring-gland': return `groove Ø${n(e.report.grooveDiameterMM)} × ${n(e.report.widthMM)} × ${n(e.report.depthMM)}`;
    case 'oring': return oringRow ? `${n(oringRow.insideDiameterMM)} × ${n(oringRow.crossSectionMM)}` : e.report.ring;
  }
}
/** Each machine element of a part (and each node the person marked bought), one line a body: what the BOM and the element list carry. */
export function elementLines(doc: Pick<StudioDoc, 'nodes' | 'orings'>, bodies: readonly { ref?: { node: number }; element?: BodyElement; massG: number | null }[]): ElementLine[] {
  const out: ElementLine[] = [], seen = new Set<number>();
  for (const b of bodies) {
    const k = b.ref?.node; if (k === undefined || seen.has(k)) continue;
    const node = doc.nodes[k]; if (!node) continue;
    const e = b.element, buy = boughtOf(node);
    if (!e && !(buy.by === 'override' && buy.bought)) continue;
    seen.add(k);
    const label = featureLabelOf(node, k, doc.nodes), why: string[] = [];
    let row: ElementRow | null = e?.row ?? null;
    const oring = e?.kind === 'oring' ? (doc.orings?.rows ?? []).find(r => r.id === e.report.ring) : undefined;
    if (e?.kind === 'oring') row = { id: e.report.ring, ...(oring?.source ? { source: oring.source } : {}), estimate: oring ? oring.estimate === true : true };
    if (row?.estimate) why.push(`its row ${row.id} is an estimate`);
    if (e?.kind === 'retaining-ring' && !row) why.push('no ring row: its sizes are an estimate');
    if (e?.kind === 'spring' && e.report.dimensions.shearModulusEstimate) why.push('its shear modulus G is an estimate');
    if (e?.kind === 'spring' && 'youngsModulusEstimate' in e.report.dimensions && e.report.dimensions.youngsModulusEstimate) why.push('its Young\'s modulus E is an estimate');
    if (e?.kind === 'oring-gland' && e.report.ranges.estimate) why.push('its squeeze and fill ranges are an estimate');
    out.push({ item: node.id ?? `n${k}`, label, kind: e?.kind ?? node.kind, size: e ? sizeOf(e, oring) : label, row, estimate: why.length > 0, why, bought: buy.bought, boughtBy: buy.by, massG: b.massG });
  }
  return out;
}
