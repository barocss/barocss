// Drafts (A6.4, O28): what an image or a drawing gives is a draft, never a finished part. Features built from a traced
// image (extrude_image_layer, inflate_image_layer) or from a DXF drawing (import_drawing) are recorded in the document
// (`drafts`, version 1) with the dimensions they were made at — scaled from an image, or read from a drawing — each
// unconfirmed until the user confirms it, in the studio's Drafts list or by answering a question about it (A6.2).
// Confirming a dimension at another value re-drives the features: the sketches scaled (about the image's corner, or a
// hole about its centre), the extrusions' height, the lofts' depth. Unconfirmed dimensions are unknowns in check_spec,
// and an export says the part is a draft.
import type { Dim, DocPlane, DocUnderlay, LoopSegment, ModelNode, StudioDoc } from '../engine/doc';
import { withNode } from '../engine/doc';
import { featureId, nodeIndexOf } from '../engine/ids';
import { DXF_READ_CODES, readDxfSketch, type DxfLoop } from '../sketch/dxfRead';
import type { Underlay } from '../sketch/dxfUnderlay';
import { r6 } from '../util/round';
import { nextFreeId } from '../util/ids';
import type { DraftDim, Draft, DraftSet } from '../engine/schema/drafts';
import { isRefusal, refusal } from '../engine/refusal';

export type DraftCode = 'NO_DRAFT' | 'BAD_VALUE' | 'BOUND' | 'GONE';
/** The codes a draft's confirmation refuses with. */
export const DRAFT_CODES: readonly DraftCode[] = ['NO_DRAFT', 'BAD_VALUE', 'BOUND', 'GONE'];

export const readDrafts = (raw: unknown): DraftSet => { const r = raw as DraftSet | undefined; return r && r.version === 1 && Array.isArray(r.drafts) ? r : { version: 1, drafts: [] }; };
const nextDraftId = (set: DraftSet) => nextFreeId('F', new Set(set.drafts.map(d => d.id)));
/** The drafts whose features are all still in the part (a deleted feature takes its draft with it). */
export function liveDrafts(doc: StudioDoc): Draft[] {
  return readDrafts(doc.drafts).drafts.filter(d => d.nodes.every(id => nodeIndexOf(doc.nodes, id) >= 0));
}
/** Every dimension not yet confirmed, as `F<k>.<name>`. */
export function unconfirmed(doc: StudioDoc): { key: string; draft: Draft; dim: DraftDim }[] {
  return liveDrafts(doc).flatMap(d => d.dims.filter(x => !x.confirmed).map(x => ({ key: `${d.id}.${x.name}`, draft: d, dim: x })));
}
/** The draft that features the agent just added from an image make. */
export function withImageDraft(doc: StudioDoc, from: number, image: string, dims: { width: number; thickness?: number; depth?: number; at: [number, number] }): StudioDoc {
  const ids = doc.nodes.slice(from).map((_, k) => featureId(doc.nodes, from + k)), set = readDrafts(doc.drafts);
  const sketches = ids.filter((_, k) => doc.nodes[from + k].kind === 'sketch'), extrudes = ids.filter((_, k) => doc.nodes[from + k].kind === 'extrude'), lofts = ids.filter((_, k) => doc.nodes[from + k].kind === 'loft');
  const out: DraftDim[] = [{ name: 'width', label: 'the silhouette\'s width', value: dims.width, basis: 'scaled', drive: { kind: 'scale', nodes: sketches, about: dims.at } }];
  if (dims.thickness !== undefined && extrudes.length) out.push({ name: 'thickness', label: 'the layer\'s thickness', value: dims.thickness, basis: 'scaled', drive: { kind: 'height', nodes: extrudes } });
  if (dims.depth !== undefined && lofts.length) out.push({ name: 'depth', label: 'the inflated depth', value: dims.depth, basis: 'scaled', drive: { kind: 'depth', nodes: lofts } });
  const draft: Draft = { id: nextDraftId(set), from: { image }, nodes: ids, dims: out, note: 'scaled from a traced image at the width given: every size follows from it' };
  return { ...doc, drafts: { version: 1, drafts: [...set.drafts, draft] } };
}

// ——— a drawing as a sketch draft
const segs = (l: DxfLoop): LoopSegment[] => l.segments.map(s => (s.kind === 'arc' ? { ...s, start: [r6(s.start[0] as number), r6(s.start[1] as number)], center: [r6(s.center[0] as number), r6(s.center[1] as number)] } : { ...s, start: [r6(s.start[0] as number), r6(s.start[1] as number)] }));
/** A DXF drawing added to the part as a sketch draft (its regions and holes, in mm, at the sketch plane), with its dimensions from the drawing. */
export function withDrawingDraft(doc: StudioDoc, text: string, name: string, plane?: DocPlane): { doc: StudioDoc; draft: Draft | null; ignored: Record<string, number>; unit: string; underlay: Underlay } {
  const s = readDxfSketch(text), [outer, ...more] = s.regions;
  // (No profile: the drawing is an underlay alone, to trace over — no sketch, no draft dimensions, O68.)
  if (!outer) return { doc: withUnderlay(doc, s.underlay, name, plane, undefined), draft: null, ignored: s.ignored, unit: s.unit.name, underlay: s.underlay };
  const node = { kind: 'sketch', profile: 'loop', segments: segs(outer), ...(more.length ? { regions: more.map(segs) } : {}), ...(s.holes.length ? { holes: s.holes.map(segs) } : {}), ...(plane ? { plane } : {}) } as ModelNode;
  const next = withNode(doc, node as never), at = next.nodes.length - 1, id = featureId(next.nodes, at), set = readDrafts(doc.drafts);
  const box = s.regions.reduce((b, l) => [Math.min(b[0], l.box[0]), Math.min(b[1], l.box[1]), Math.max(b[2], l.box[2]), Math.max(b[3], l.box[3])] as [number, number, number, number], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]);
  const dims: DraftDim[] = [
    { name: 'width', label: 'the overall width (X)', value: r6(box[2] - box[0]), basis: 'from-drawing', drive: { kind: 'scale', nodes: [id], about: [r6(box[0]), r6(box[1])] } },
    { name: 'height', label: 'the overall height (Y)', value: r6(box[3] - box[1]), basis: 'from-drawing', drive: { kind: 'scale', nodes: [id], about: [r6(box[0]), r6(box[1])] } },
    ...s.holes.flatMap((h, i) => (h.circle ? [{ name: `d${i + 1}`, label: `hole ${i + 1}'s diameter`, value: r6(2 * h.circle.radius), basis: 'from-drawing' as const, drive: { kind: 'hole' as const, node: id, hole: i, center: [r6(h.circle.center[0]), r6(h.circle.center[1])] as [number, number] } }] : [])),
  ];
  const draft: Draft = { id: nextDraftId(set), from: { drawing: name }, nodes: [id], dims, note: `read from ${name} in ${s.unit.name}${s.unit.declared ? '' : ' (the file declares no unit)'}`, ...(s.unit.declared ? {} : { unitAssumed: true as const }) };
  return { doc: withUnderlay({ ...next, drafts: { version: 1, drafts: [...set.drafts, draft] } }, s.underlay, name, plane, draft.id), draft, ignored: s.ignored, unit: s.unit.name, underlay: s.underlay };
}
/** The document with a drawing's underlay added beside it (O68), when it has anything to show. */
function withUnderlay(doc: StudioDoc, u: Underlay, name: string, plane: DocPlane | undefined, draft: string | undefined): StudioDoc {
  if (!u.polylines.length && !u.texts.length) return doc;
  const have = doc.underlays ?? [];
  const entry: DocUnderlay = { id: nextFreeId('U', new Set(have.map(x => x.id)), have.length + 1), name, ...(plane ? { plane } : {}), ...(draft ? { draft } : {}), polylines: u.polylines.map(l => l.map(p => [r6(p[0]), r6(p[1])] as [number, number])), texts: u.texts.map(t => ({ ...t, at: [r6(t.at[0]), r6(t.at[1])] as [number, number] })), counts: u.counts };
  return { ...doc, underlays: [...have, entry] };
}
/** A draft's underlays scaled by k about o with its sketch (O68: the drawing traced over stays the drawing). */
function scaleUnderlays(doc: StudioDoc, draft: string, k: number, o: [number, number]): DocUnderlay[] | undefined {
  if (!doc.underlays) return undefined;
  const at = (p: [number, number]): [number, number] => [r6(o[0] + (p[0] - o[0]) * k), r6(o[1] + (p[1] - o[1]) * k)];
  return doc.underlays.map(u => u.draft !== draft ? u : { ...u, polylines: u.polylines.map(l => l.map(at)), texts: u.texts.map(t => ({ ...t, at: at(t.at), height: r6(t.height * k) })) });
}

// ——— confirming a dimension: re-driving its features
const isNum = (d: Dim): d is number => typeof d === 'number';
function scaleXY(p: [Dim, Dim], k: number, o: [number, number]): [Dim, Dim] {
  if (!isNum(p[0]) || !isNum(p[1])) throw refusal('BOUND', 'a sketch point is bound to a parameter: change the parameter instead');
  return [r6(o[0] + (p[0] - o[0]) * k), r6(o[1] + (p[1] - o[1]) * k)];
}
const scaleLoop = (l: LoopSegment[], k: number, o: [number, number]): LoopSegment[] => l.map(s => (s.kind === 'arc' ? { ...s, start: scaleXY(s.start, k, o), center: scaleXY(s.center, k, o) } : { ...s, start: scaleXY(s.start, k, o) }));
/** A sketch's profile scaled by k about o (in its own plane); the outline as drawn is dropped (it would no longer match). */
function scaleSketch(n: ModelNode, k: number, o: [number, number]): ModelNode {
  if (n.kind !== 'sketch') return n;
  const s = { ...n } as Record<string, unknown>;
  if (n.profile === 'rectangle') { s.min = scaleXY(n.min, k, o); s.max = scaleXY(n.max, k, o); }
  else if (n.profile === 'circle') { if (!isNum(n.radius)) throw refusal('BOUND', 'a radius bound to a parameter'); s.center = scaleXY(n.center, k, o); s.radius = r6(n.radius * k); }
  else if (n.profile === 'polygon') s.points = n.points.map(p => scaleXY(p, k, o));
  else s.segments = scaleLoop(n.segments, k, o);
  if (n.regions) s.regions = n.regions.map(l => scaleLoop(l, k, o));
  if (n.holes) s.holes = n.holes.map(l => scaleLoop(l, k, o));
  delete s.outline;
  return s as ModelNode;
}
/**
 * The user confirms a dimension, at its value or another (in mm, above 0): at another, its features re-driven — and
 * the draft's other dimensions that the change moves updated (and unconfirmed again, had they been confirmed).
 */
export function confirmDimension(doc: StudioDoc, key: string, value: number | undefined, at: string): StudioDoc {
  const [draftId, name] = key.split('.'), set = readDrafts(doc.drafts), draft = set.drafts.find(d => d.id === draftId), dim = draft?.dims.find(x => x.name === name);
  if (!draft || !dim) throw refusal('NO_DRAFT', `no draft dimension ${key}; ${unconfirmed(doc).map(u => u.key).join(', ') || 'none is open'}`);
  if (!draft.nodes.every(id => nodeIndexOf(doc.nodes, id) >= 0)) throw refusal('GONE', `${key}'s features are no longer in the part`);
  const v = value ?? dim.value;
  if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) throw refusal('BAD_VALUE', `${key} is a size above 0 mm`);
  const k = v / dim.value, nodes = doc.nodes.slice(), idx = (id: string) => nodeIndexOf(nodes, id);
  if (Math.abs(k - 1) > 1e-12) {
    const d = dim.drive;
    if (d.kind === 'scale') for (const id of d.nodes) nodes[idx(id)] = scaleSketch(nodes[idx(id)], k, d.about);
    else if (d.kind === 'height') for (const id of d.nodes) { const n = nodes[idx(id)] as ModelNode & { height: Dim }; if (!isNum(n.height)) throw refusal('BOUND', 'the height is bound to a parameter'); nodes[idx(id)] = { ...n, height: r6(v) } as ModelNode; }
    else if (d.kind === 'depth') for (const id of d.nodes) { const n = nodes[idx(id)] as ModelNode & { sections: { sketch: number; z: number }[] }; nodes[idx(id)] = { ...n, sections: n.sections.map(sc => ({ ...sc, z: r6(sc.z * k) })) } as ModelNode; }
    else { const n = nodes[idx(d.node)] as ModelNode & { holes?: LoopSegment[][] }; if (!n.holes?.[d.hole]) throw refusal('GONE', `${key}'s hole is gone`); nodes[idx(d.node)] = { ...n, holes: n.holes.map((h, i) => (i === d.hole ? scaleLoop(h, k, d.center) : h)) } as ModelNode; }
  }
  // (What the change moves: a scale moves every size of its sketches; a hole's diameter, only itself.)
  const moved = (x: DraftDim) => x !== dim && Math.abs(k - 1) > 1e-12 && dim.drive.kind === 'scale' && (x.drive.kind === 'scale' || x.drive.kind === 'hole') && (x.drive.kind === 'scale' ? x.drive.nodes.some(id => (dim.drive as { nodes: string[] }).nodes.includes(id)) : (dim.drive as { nodes: string[] }).nodes.includes(x.drive.node));
  const dims = draft.dims.map(x => (x === dim ? { ...x, value: r6(v), confirmed: { by: 'user' as const, at } } : moved(x) ? { ...x, value: r6(x.value * k), confirmed: undefined, ...(x.drive.kind === 'hole' ? { drive: { ...x.drive, center: scaleXY(x.drive.center, k, (dim.drive as { about: [number, number] }).about) as [number, number] } } : {}) } : x)).map(x => { if (x.confirmed === undefined) { const { confirmed: _c, ...rest } = x; void _c; return rest as DraftDim; } return x; });
  const underlays = Math.abs(k - 1) > 1e-12 && dim.drive.kind === 'scale' ? scaleUnderlays(doc, draft.id, k, dim.drive.about) : undefined;
  return { ...doc, nodes, drafts: { version: 1, drafts: set.drafts.map(d => (d === draft ? { ...d, dims } : d)) }, ...(underlays ? { underlays } : {}) };
}

/** The drafts as the tools report them. */
export function draftsReport(doc: StudioDoc) {
  const open = unconfirmed(doc);
  return {
    drafts: liveDrafts(doc).map(d => ({ id: d.id, from: d.from, features: d.nodes, ...(d.note ? { note: d.note } : {}), dims: d.dims.map(x => ({ key: `${d.id}.${x.name}`, label: x.label, value_mm: x.value, basis: x.basis, confirmed: !!x.confirmed })) })),
    unconfirmed: open.map(u => u.key),
    assumptions: unitAssumptions(doc),
    note: open.length ? `a draft: ${open.length} dimension${open.length === 1 ? '' : 's'} not confirmed by the user — ask about the ones that matter (ask_user, blocks {dimension}), or say they are assumed` : 'every draft dimension is confirmed',
  };
}
/** The drawings read as mm because they declare no unit, while any of their dimensions is unconfirmed (A6.4). */
export function unitAssumptions(doc: StudioDoc): string[] {
  return liveDrafts(doc).filter(d => d.unitAssumed && d.dims.some(x => !x.confirmed)).map(d => `${d.id}: units assumed mm — the drawing declares none (were it inches, every size would be 25.4 times this)`);
}
/** The export warning, or null. */
export function draftWarning(doc: StudioDoc): string | null {
  const open = unconfirmed(doc);
  return open.length ? `This part is a draft: ${open.length} dimension${open.length === 1 ? '' : 's'} from an image or drawing ${open.length === 1 ? 'is' : 'are'} not confirmed (${open.map(u => u.key).join(', ')}).` : null;
}

// ——— the tools
export const DRAFT_TOOL_NAMES = new Set(['get_drafts', 'import_drawing']);
export const DRAFT_TOOLS = [
  {
    name: 'get_drafts',
    description: 'The part\'s drafts: features made from an image (scaled) or a drawing (read), each with the dimensions they were made at and whether the user confirmed them. Only the user confirms one (the studio\'s Drafts list, or answering ask_user with blocks {dimension: key}); confirming another value re-drives the features. Changes nothing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'import_drawing',
    description: 'Adds a DXF drawing\'s profile as a sketch draft (LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE at the top level; $INSUNITS to mm): its closed loops as regions and holes, on the XY plane or "plane" ({datum: id} or {origin, normal, xAxis}). Its overall width, height and hole diameters are draft dimensions, unconfirmed. The drawing\'s SPLINE, ELLIPSE, INSERT/BLOCK (with everything inside blocks), TEXT and MTEXT come in as a reference underlay to trace over ("underlay": counts by type), never regions or dimensions; a file with no closed profile but curves is an underlay alone ("draft": null). Dimensions, hatches and fit-point-only splines are "left_out". Refused, typed: DXF_MALFORMED, DXF_UNSUPPORTED (3D), DXF_OPEN (a gap), DXF_NESTED, DXF_EMPTY, DWG_NOT_READ',
    input_schema: { type: 'object', properties: { dxf: { type: 'string' }, name: { type: 'string' }, plane: { type: 'object' } }, required: ['dxf'], additionalProperties: false },
  },
];
export function runDraftTool(doc: StudioDoc, name: string, args: Record<string, unknown>, plane?: DocPlane): { doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string } {
  if (name === 'get_drafts') { const r = draftsReport(doc); return { doc, content: r, changed: false, summary: `${r.drafts.length} drafts, ${r.unconfirmed.length} unconfirmed` }; }
  if (typeof args.dxf !== 'string' || !args.dxf) return { error: '"dxf" is the drawing\'s text.' };
  try {
    const r = withDrawingDraft(doc, args.dxf, typeof args.name === 'string' && args.name ? args.name : 'drawing', plane);
    const shown = Object.keys(r.underlay.counts).length ? { underlay: r.underlay.counts } : {}, left = { ...r.ignored, ...Object.fromEntries(Object.entries(r.underlay.left).map(([t, x]) => [t, x.count])) };
    if (!r.draft) return { doc: r.doc, content: { ok: true, draft: null, unit: r.unit, ...shown, note: 'no closed profile: the drawing is an underlay to trace over (its splines, ellipses, blocks and text), not geometry', ...(Object.keys(left).length ? { left_out: left } : {}) }, changed: true, summary: `drawing as an underlay (${Object.entries(r.underlay.counts).map(([t, n]) => `${n} ${t}`).join(', ')})` };
    return { doc: r.doc, content: { ok: true, draft: r.draft.id, feature: r.draft.nodes[0], unit: r.unit, dims: r.draft.dims.map(x => ({ key: `${r.draft!.id}.${x.name}`, value_mm: x.value })), ...shown, ...(Object.keys(left).length ? { left_out: left } : {}) }, changed: true, summary: `drawing ${r.draft.id}: ${r.draft.dims.length} dimensions to confirm` };
  } catch (e) { if (isRefusal(e, ...DXF_READ_CODES)) return { error: e.message }; throw e; }
}
