// R12c's machine elements as data (O142, S1): the kernel's report of each element body — a spring, a shaft, a key, a
// keyway, a retaining ring, a dowel pin, a bearing, an O-ring gland, an O-ring — kept on its BodyResult as plain data
// (`element`), with the user's row it was checked against, so the drawing's tables and callouts and the BOM read the
// numbers, not the notes' text. Its shape is kept stable: the GPU lane's overlays and later analyses read it too.
import type { BearingReport, BeltReport, CadPartSnapshot, CamReport, ConnectorReport, CouplingReport, GlandReport, HookedSpringReport, KeyReport, KeywayReport, PinReport, PulleyReport, RingReport, ShaftReport, SpringReport, SprocketReport } from '@barocss/cad';
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
  | { kind: 'oring'; report: { readonly ring: string; readonly overlapMM3: number; readonly stretchedCrossSectionMM: number } }
  // (D160, D161: a cam; a sprocket, a pulley, a belt or chain, a coupling.)
  | { kind: 'cam'; report: CamReport }
  | { kind: 'sprocket'; report: SprocketReport }
  | { kind: 'pulley'; report: PulleyReport }
  | { kind: 'belt'; report: BeltReport }
  | { kind: 'coupling'; report: CouplingReport }
  // (D162: a connector's opening cut in its panel, and the bought body seated in it.)
  | { kind: 'connector-opening'; report: ConnectorReport }
  | { kind: 'connector-body'; report: { readonly row: string; readonly overlapMM3: number } };
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
  if (o.cam) return { kind: 'cam', report: o.cam };
  if (o.sprocket) { const r = o.sprocket; return { kind: 'sprocket', report: r, row: { id: r.chain, ...(r.chainSource ? { source: r.chainSource } : {}), estimate: r.chainEstimate } }; }
  if (o.pulley) { const r = o.pulley; return { kind: 'pulley', report: r, row: { id: r.belt, ...(r.beltSource ? { source: r.beltSource } : {}), estimate: r.beltEstimate } }; }
  if (o.belt) { const r = o.belt; return { kind: 'belt', report: r, row: { id: r.row, ...(r.rowSource ? { source: r.rowSource } : {}), estimate: r.rowEstimate } }; }
  if (o.connector) { const r = o.connector; return { kind: 'connector-opening', report: r, row: { id: r.row, ...(r.source ? { source: r.source } : {}), estimate: r.estimate } }; }
  if (o.connectorBody) return { kind: 'connector-body', report: o.connectorBody };
  if (o.coupling) { const r = o.coupling; return { kind: 'coupling', report: r, row: { id: r.row, ...(r.source ? { source: r.source } : {}), estimate: r.estimate } }; }
  return null;
}

// ——— The element rows (O142, S1): what the BOM and the drawing's element list read.
/** Bought by default (the coordinator's list): a bearing, a retaining ring, a key, a dowel pin, an O-ring, a spring, a belt or chain, a connector's body; a coupling as its row says; any other node made (gears, racks, worms, cams, sprockets, pulleys). */
export const BOUGHT_BY_DEFAULT: ReadonlySet<string> = new Set(['bearing', 'retaining-ring', 'key', 'pin', 'oring', 'spring', 'belt', 'connector-body']);
/** Whether a node is bought, and what decided it: the person's override (`bought` on the node), or the default for its kind. */
export function boughtOf(node: ModelNode, e?: BodyElement | null): { bought: boolean; by: 'override' | 'default' } {
  if (node.bought !== undefined) return { bought: node.bought, by: 'override' };
  // (A coupling: bought as its kernel report's row says, D161.)
  return { bought: e?.kind === 'coupling' ? e.report.bought.bought : BOUGHT_BY_DEFAULT.has(node.kind), by: 'default' };
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
  /** A bought item's catalogue number and supplier, where its row gives them (a coupling's, D161). */
  catalogue?: string;
}
const n = (x: number) => `${+x.toFixed(3)}`;
/** A connector's name for its lines: the row's name less a trailing "opening" (the line says which), else its id. */
const connectorName = (name: string | undefined, id: string) => name ? name.replace(/\s*opening$/i, '') : id;
/** A connector row as far as its sizes go (engine/doc's `connectors`). */
type ConnectorRowLike = { name?: string; body?: { shape: string; widthMM: number; heightMM: number; lengthMM: number }; source?: string; estimate?: boolean };
/** A report's sizes as one short line (our own words; the values the kernel's). */
export function sizeOf(e: BodyElement, oringRow?: { insideDiameterMM: number; crossSectionMM: number }, connectorRow?: ConnectorRowLike): string {
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
    case 'cam': return `${e.report.motion} ${e.report.follower}, base R${n(e.report.baseRadiusMM)}, stroke ${n(e.report.stroke)} ${e.report.units}`;
    case 'sprocket': return `${e.report.teeth} teeth, p ${n(e.report.pitchMM)}, Ø${n(e.report.pitchDiameterMM)} pitch`;
    case 'pulley': return `${e.report.type}${e.report.teeth ? ` ${e.report.teeth} teeth` : ''}, Ø${n(e.report.pitchDiameterMM)} pitch × ${n(e.report.widthMM)}`;
    case 'belt': return `${e.report.kind}, L ${n(e.report.lengthMM)}${e.report.chain ? `, ${e.report.chain.links} links` : ''} at ${n(e.report.centerDistanceMM)}`;
    case 'connector-opening': { const o = e.report.opening, b = e.report.body; return `${connectorName(e.report.name, e.report.row)} opening, ${o.shape} ${n(o.widthMM)} × ${n(o.heightMM)} × ${n(o.depthMM)} deep${b ? `; its body ${n(b.gapWidthMM)} / ${n(b.gapHeightMM)} clear across` : ''}`; }
    case 'connector-body': { const b = connectorRow?.body; return `${connectorName(connectorRow?.name, e.report.row)} envelope${b ? ` ${b.shape} ${n(b.widthMM)} × ${n(b.heightMM)} × ${n(b.lengthMM)}` : ''}`; }
    case 'coupling': return `Ø${n(e.report.boreMM[0])} / Ø${n(e.report.boreMM[1])} bores, Ø${n(e.report.outsideMM)} × ${n(e.report.lengthMM)}`;
  }
}
/** Each machine element of a part (and each node the person marked bought), one line a body: what the BOM and the element list carry. */
export function elementLines(doc: Pick<StudioDoc, 'nodes' | 'orings' | 'connectors'>, bodies: readonly { ref?: { node: number }; element?: BodyElement; massG: number | null }[]): ElementLine[] {
  const out: ElementLine[] = [], seen = new Set<number>();
  for (const b of bodies) {
    const k = b.ref?.node; if (k === undefined || seen.has(k)) continue;
    const node = doc.nodes[k]; if (!node) continue;
    const e = b.element, buy = boughtOf(node, e);
    if (!e && !(buy.by === 'override' && buy.bought)) continue;
    seen.add(k);
    const label = featureLabelOf(node, k, doc.nodes), why: string[] = [];
    let row: ElementRow | null = e?.row ?? null;
    const oring = e?.kind === 'oring' ? (doc.orings?.rows ?? []).find(r => r.id === e.report.ring) : undefined;
    const connector = e?.kind === 'connector-body' ? (doc.connectors?.rows ?? []).find(r => r.id === e.report.row) : undefined;
    if (e?.kind === 'connector-body') row = { id: e.report.row, ...(connector?.source ? { source: connector.source } : {}), estimate: connector ? connector.estimate === true : true };
    if (e?.kind === 'oring') row = { id: e.report.ring, ...(oring?.source ? { source: oring.source } : {}), estimate: oring ? oring.estimate === true : true };
    if (row?.estimate) why.push(`its row ${row.id} is an estimate`);
    if (e?.kind === 'retaining-ring' && !row) why.push('no ring row: its sizes are an estimate');
    if (e?.kind === 'spring' && e.report.dimensions.shearModulusEstimate) why.push('its shear modulus G is an estimate');
    if (e?.kind === 'spring' && 'youngsModulusEstimate' in e.report.dimensions && e.report.dimensions.youngsModulusEstimate) why.push('its Young\'s modulus E is an estimate');
    if (e?.kind === 'oring-gland' && e.report.ranges.estimate) why.push('its squeeze and fill ranges are an estimate');
    if (e?.kind === 'cam' && e.report.pressureAngle.limitEstimate) why.push('its pressure-angle limit is an estimate');
    if (e?.kind === 'belt' && e.report.bandEstimate) why.push('its band\'s section is an estimate');
    const catalogue = e?.kind === 'coupling' && (e.report.bought.partNumber || e.report.bought.supplier) ? [e.report.bought.partNumber, e.report.bought.supplier].filter(Boolean).join(', ') : undefined;
    out.push({ item: node.id ?? `n${k}`, label, kind: e?.kind ?? node.kind, size: e ? sizeOf(e, oring, connector) : label, row, estimate: why.length > 0, why, bought: buy.bought, boughtBy: buy.by, massG: b.massG, ...(catalogue ? { catalogue } : {}) });
  }
  return out;
}
