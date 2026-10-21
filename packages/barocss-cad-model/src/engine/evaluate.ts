import { faceTableFrom, rememberFaceTable } from '../assembly/faces';
import type { FaceTable } from '../assembly/mates';
import { cutPiece, evaluateCadPart, checkPlacedSpurGears, checkPlacedSpurRack, checkPlacedInternalGears, checkPlacedBevelGears, checkPlacedWormPair, checkPlacedThroatedPair, spurGearDimensions, FACET_PREVIEW_TRIANGLES, type Brep, type CadPartSnapshot, type FlatPattern, type GearPlacement, type RackPlacement, type SubdSummary, type CutPiece, exportStep } from '@barocss/cad';
import { bodyMesh, type DisplayEdge, type DisplayMesh } from './mesh';
import { friendly, type FriendlyError } from './errors';
import { bodyKeyOf, toPartDocument } from './part';
import { placedDoc, type BodyRef, type FrameSectionRow, type ModelNode, type Side, type StudioDoc } from './doc';
import { bodyNodeOf } from './ids';

/** A kernel output's body key and the node and side it is now. */
/** A body's role, from the node that made it (O60: 'infill' on a print infill's mesh node). */
const roleOf = (n: ModelNode | undefined): 'infill' | undefined => n && (n as { role?: string }).role === 'infill' ? 'infill' : undefined;
function keyed(outputId: string, nodes: readonly ModelNode[]): { key: string; ref?: BodyRef } {
  const key = bodyKeyOf(outputId, nodes), at = bodyNodeOf(nodes, key);
  return at ? { key, ref: { node: at.node, side: at.side as Side } } : { key };
}

export interface BodyResult {
  /** `b<k>` by the stable id of the feature that made it (engine/ids.ts); `ref`: that feature's node and side now. */
  key: string;
  ref?: BodyRef;
  /** 'upright' (Z-prismatic: holes, fillets, curved Booleans), 'planar' or 'curved' (general B-rep). */
  family: string; mesh: DisplayMesh;
  /** 'infill' (O60): a print infill body (its node's role) — in the mass and 3MF, left out of STEP. */
  role?: 'infill';
  volumeMM3: number | null; massG: number | null;
  /** Centre of mass (mm), with the volume (uniform density). */
  centroid?: [number, number, number];
  /** Inertia about the centre of mass (kg·m², aluminium at 2700 kg/m³; scale by density for another material). */
  inertia?: number[][];
  /** A body in several separate pieces (a cut right through it): how many. */
  pieces?: number;
  /** What a generator says of the body (a gear: its dimensions, its flank fit, its root). */
  notes?: { text: string; warning?: boolean }[];
  /** Enclosed voids, exactly: the B-rep's inner shells (a solid's shells past its first; AM3 cavities). */
  innerShells?: number;
  /** A spur gear as made: its spec and where it stands (the gear queries, A3; a meshing gear's other gear with it). */
  gear?: GearPlacement;
  /** An ideal model's flag (R12b.4: a spiral bevel gear, the ideal conjugate): what it is not, in words — the panel, the agent's results. */
  idealModel?: string;
  /** A rack as made: its spec and where it stands (and the gear it meshes with). */
  rack?: RackPlacement;
  /** A SubD body with caps: their distance from the limit surface (the subd_deviation query, A3; D79). */
  subd?: SubdSummary;
  /** A sheet-metal body's flat pattern (R12.2, D117), or why it has none (its refusal). */
  flat?: FlatPattern; flatRefused?: string;
  /** A frame member as a piece to cut (FR4a, D127): its axis length, long point, end cuts, volume. */
  cutPiece?: CutPiece;
  /** A sheet-metal body's rules (R12.3, D119: the studio writes them into a flange's relief, the kernel defaulting none). */
  sheet?: { thicknessMM: number; bendRadiusMM: number; kFactor?: number; bendTable?: string };
}
export type EvalResult =
  // (`faceTable`: the part's flat and round faces from the B-rep just built — the face table the requirement checks,
  // print rules and mates read, kept so they do not evaluate the part again; PERF3 A1.)
  | { ok: true; revision: number; bodies: BodyResult[]; ms: number; faceTable?: FaceTable }
  | { ok: false; revision: number; error: FriendlyError; ms: number };

const ALUMINIUM = 2700;
// The last successful evaluation: unchanged features are reused by the next one.
let last: CadPartSnapshot | null = null;

// Unchanged features keep their B-rep objects from one evaluation to the next: their tessellation (per
// quality) and mass properties are worked out once. The meshes handed out are copies (the worker
// transfers their buffers away) — unless the worker shares them (PERF3 B12): it then copies only the meshes
// it has not sent in that slot's last reply, and names the others by a token.
const meshes = new WeakMap<Brep, Map<number, DisplayMesh>>();
let sharing = false;
/** The kept meshes handed out as they are (the worker's MeshSender copies what it sends); off: a copy each time. */
export function shareMeshes(on: boolean): void { sharing = on; }
const flats = new WeakMap<Brep, { flat: FlatPattern } | { refused: string }>();
const masses = new WeakMap<Brep, ReturnType<CadPartSnapshot['outputs'][number]['massProperties']> | null>();
function meshOf(brep: Brep, revision: number, quality: number): DisplayMesh {
  let byQuality = meshes.get(brep); if (!byQuality) meshes.set(brep, byQuality = new Map());
  let m = byQuality.get(quality); if (!m) byQuality.set(quality, m = bodyMesh(brep, revision, quality));
  if (sharing) return m;
  return { ...m, positions: m.positions.slice(), normals: m.normals.slice(), faceOfVertex: m.faceOfVertex.slice(), indices: m.indices.slice(), edgeLines: m.edgeLines.slice(), edgeOfSegment: m.edgeOfSegment.slice() };
}
/** A body's evaluated result: its mesh, and its volume, mass, centroid and inertia when it has a volume. */
function bodyOf(o: CadPartSnapshot['outputs'][number], doc: StudioDoc, revision: number, quality: number): BodyResult {
  let m = masses.get(o.brep);
  if (m === undefined) { try { m = o.massProperties(ALUMINIUM); } catch { m = null; /* no positive volume */ } masses.set(o.brep, m); }
  const mass = m ? { volumeMM3: m.volumeMM3, massG: m.massKG * 1000, centroid: [m.centroidMM[0], m.centroidMM[1], m.centroidMM[2]] as [number, number, number], inertia: m.inertiaCentroidKgM2.map(r => [...r]) } : { volumeMM3: null, massG: null };
  const at = keyed(o.id, doc.nodes), lib = at.ref ? doc.nodes[at.ref.node] : undefined;
  // (A library part: where it comes from, and its estimates and caveats, on the body.)
  const libNotes = lib?.kind === 'library' ? [{ text: `From ${lib.library.library} ${lib.library.version}: ${lib.library.part}${lib.library.variant ? ` (${lib.library.variant})` : ''}` }, ...lib.warnings.map(text => ({ text, warning: true }))] : null;
  const inner = o.brep.bodies.reduce((n, body) => n + (body.kind === 'solid' ? Math.max(0, body.shells.length - 1) : 0), 0);
  return { ...at, ...(libNotes ? { notes: libNotes } : {}), ...(roleOf(lib) ? { role: roleOf(lib) } : {}), innerShells: inner, family: o.representation, mesh: meshOf(o.brep, revision, quality), ...mass, ...(o.bodyCount > 1 ? { pieces: o.bodyCount } : {}), ...(o.gear ? { notes: [...gearNotes(o.gear), ...meshNotes(o.gearPlacement)] } : {}), ...(o.gearPlacement ? { gear: o.gearPlacement } : {}), ...(o.internalGear ? { notes: internalGearNotes(o.internalGear, at.ref ? doc.nodes[at.ref.node] : undefined) } : {}), ...(o.worm ? { notes: [...wormNotes(o.worm), ...wormMeshNotes(o.wormPlacement)] } : {}), ...(o.wormWheel ? { notes: wormWheelNotes(o.wormWheel) } : {}), ...(o.spring ? { notes: springNotes(o.spring) } : {}), ...(o.bevelGear ? { notes: [...bevelGearNotes(o.bevelGear, at.ref ? doc.nodes[at.ref.node] : undefined), ...bevelMeshNotes(o.bevelGearPlacement)], ...(o.bevelGear.idealModel ? { idealModel: o.bevelGear.diagnostics.find(x => x.code === 'IDEAL_MODEL')?.message ?? 'an ideal model' } : {}) } : {}), ...(o.rack ? { notes: [...rackNotes(o.rack), ...rackMeshNotes(o.rackPlacement)] } : {}), ...(o.rackPlacement ? { rack: o.rackPlacement } : {}), ...(o.subd && o.subd.caps ? { notes: subdNotes(o.subd), subd: o.subd } : {}), ...(o.decimate ? { notes: decimateNotes(o.decimate) } : {}), ...(o.sheet ? sheetOf(o) : {}), ...(o.member ? { notes: memberNotes(o.member, lib ?? (at.ref ? doc.nodes[at.ref.node] : undefined), doc.frames?.sections), ...(m ? { cutPiece: cutPiece(o, { volumeMM3: m.volumeMM3 }) } : {}) } : {}) };
}

const AXES: [string, number[]][] = [['+X', [1, 0, 0]], ['−X', [-1, 0, 0]], ['+Y', [0, 1, 0]], ['−Y', [0, -1, 0]], ['+Z', [0, 0, 1]], ['−Z', [0, 0, -1]]];
/** A direction as an axis (`+Z`) when it is one, else its components. */
const direction = (v: readonly number[]): string => AXES.find(([, a]) => a.every((x, k) => Math.abs(x - v[k]) < 1e-12))?.[0] ?? `(${v.map(x => +x.toFixed(4)).join(', ')})`;
/**
 * A structural member's section, length and frame as lines for its panel (FR1, D123); the section fields still at the
 * palette's first-try values flagged as estimates (D122: no section data is built in).
 */
function memberNotes(m: NonNullable<CadPartSnapshot['outputs'][number]['member']>, node: ModelNode | undefined, rows: readonly FrameSectionRow[] = []): { text: string; warning?: boolean }[] {
  const mm = (x: number) => `${+x.toFixed(3)} mm`;
  // (A frame's member: its own section when an override gives one — no estimates then — else the frame's, FR2.)
  const own = node?.kind === 'frame' && m.frame ? node.overrides?.find(o => o.member === m.frame!.member)?.section : undefined;
  const section = own ?? (node?.kind === 'frame-member' || node?.kind === 'frame' ? node.section : undefined);
  const est = own ? [] : node?.kind === 'frame-member' || node?.kind === 'frame' ? node.estimates ?? [] : [], sec = (section ?? {}) as unknown as Record<string, unknown>;
  return [
    ...(m.frame && node?.kind === 'frame' ? [{ text: `Frame member ${m.frame.member + 1} of ${node.segments.length}: point ${m.frame.from + 1} → point ${m.frame.to + 1}${m.mirrored ? ', mirrored' : ''}` }] : []),
    { text: `Member: ${m.section} · section ${+m.areaMM2.toFixed(3)} mm² · length ${mm(m.lengthMM)}` },
    { text: `Line through its ${m.anchor}${m.offset[0] || m.offset[1] ? `, moved (${m.offset.map(x => +x.toFixed(3)).join(', ')})` : ''}; section x ${direction(m.xAxis)}, y ${direction(m.yAxis)}${m.rollDegrees ? ` (rolled ${+m.rollDegrees.toFixed(3)}°)` : ''}${m.upFallback ? `; the line runs along up, so y follows ${direction(m.upFallback)}` : ''}` },
    // (FRc, O117: a section from the library — its row, and where its sizes come from; an estimate row said as one.)
    ...(section?.kind === 'library' ? [libraryNote(section.id, rows)] : []),
    ...(m.ends && node?.kind === 'frame' ? endNotes(m.ends, node) : []),
    ...(est.length ? [{ text: `Estimates, not your stock's: ${est.map(k => `${k} ${typeof sec[k] === 'number' ? mm(sec[k] as number) : '(parameter)'}`).join(', ')} — the palette's first try${section?.kind === 'tslot' ? ' (the tslot-20 library\u2019s slot sizes)' : ''}. Use your supplier's.`, warning: true }] : []),
  ];
}

/** A library section's row in words: its name and source, or a warning when its sizes are estimates. */
function libraryNote(id: string, rows: readonly FrameSectionRow[]): { text: string; warning?: boolean } {
  const r = rows.find(x => x.id === id);
  if (!r) return { text: `Section library row ${id}: not in the document's library`, warning: true };
  return r.source ? { text: `From your section library: ${r.name ?? r.id} (${r.source})` } : { text: `From your section library: ${r.name ?? r.id} — its sizes are estimates, not your stock's`, warning: true };
}

/**
 * A frame member's ends at its corners (FR3a, D125): each end's finish; an end left square where three or more members
 * meet (overlapping until an ordered trim, FR3b) said so as a warning.
 */
function endNotes(ends: NonNullable<NonNullable<CadPartSnapshot['outputs'][number]['member']>['ends']>, node: Extract<ModelNode, { kind: 'frame' }>): { text: string; warning?: boolean }[] {
  const meeting = (p: number) => node.segments.reduce((n, g) => n + (g[0] === p ? 1 : 0) + (g[1] === p ? 1 : 0), 0);
  const what = (e: (typeof ends)[number]) => e.kind === 'mitre' ? `mitre ${+e.angleDegrees!.toFixed(3)}° with member ${e.with! + 1}`
    : e.kind === 'butt' ? `butt on member ${e.with! + 1}${e.angleDegrees ? ` (${+e.angleDegrees.toFixed(3)}° from square)` : ''}`
    : e.kind === 'through' ? `through, ${+e.extendedMM!.toFixed(3)} mm past point ${e.point + 1} over member ${e.with! + 1}`
    : e.kind === 'cope' ? `coped to member ${e.with! + 1}`
    : e.kind === 'trim' ? (e.against ? `trimmed to member${e.against.length > 1 ? 's' : ''} ${e.against.map(m => m + 1).join(', ')} (${e.rank! + 1} in order)` : e.plane ? `trimmed to a plane${e.angleDegrees ? ` (${+e.angleDegrees.toFixed(3)}° from square)` : ''}` : 'trimmed to a body')
    : 'square';
  const out: { text: string; warning?: boolean }[] = [{ text: `Ends: ${ends.map(e => `${e.end} ${what(e)}`).join('; ')}` }];
  for (const e of ends) if (e.kind === 'square' && meeting(e.point) >= 3) out.push({ text: `Point ${e.point + 1}: ${meeting(e.point)} members meet, left square and overlapping (set "Three or more members" to an ordered trim)`, warning: true });
  return out;
}

/** A sheet's notes and its flat pattern (worked out once a B-rep), or the flat's refusal as a warning. */
function sheetOf(o: CadPartSnapshot['outputs'][number]): Pick<BodyResult, 'notes' | 'flat' | 'flatRefused' | 'sheet'> {
  let f = flats.get(o.brep);
  if (!f) { try { f = { flat: o.flatPattern() }; } catch (e) { f = { refused: e instanceof Error ? e.message.replace(/^[^:]*: /, '') : String(e) }; } flats.set(o.brep, f); }
  const notes = sheetNotes(o.sheet!), sheet = { thicknessMM: o.sheet!.thicknessMM, bendRadiusMM: o.sheet!.bendRadiusMM, ...(o.sheet!.bendTable ? { bendTable: o.sheet!.bendTable.id } : { kFactor: o.sheet!.kFactor }) };
  if ('flat' in f) {
    const b = f.flat.box.max, n = f.flat.bends.length;
    return { notes: [...notes, { text: `Flat pattern ${+b[0].toFixed(3)} × ${+b[1].toFixed(3)} mm, ${n} bend${n === 1 ? '' : 's'}` }], flat: f.flat, sheet };
  }
  return { notes: [...notes, { text: `No flat pattern: ${f.refused}`, warning: true }], flatRefused: f.refused, sheet };
}

/**
 * A sheet-metal body's rules and bends as lines for its panel (R12.1, D116). A K-factor of 0.5 (the studio's prefill)
 * is the sheet's middle, no material data: said so, as an estimate.
 */
function sheetNotes(s: NonNullable<CadPartSnapshot['outputs'][number]['sheet']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => `${+x.toFixed(3)} mm`;
  // (A bend table: each bend says the rows its K came from, and an estimate among them as a warning; R12.4, D120.)
  const t = s.bendTable, short = oneFeature(s.bends);
  return [
    { text: `Sheet metal: ${mm(s.thicknessMM)} thick, bends of inner radius ${mm(s.bendRadiusMM)}, ${t ? `K from bend table ${t.id} (${t.rows.length} rows)` : `K-factor ${s.kFactor}`}` },
    ...(s.kFactor === 0.5 ? [{ text: 'K 0.5 is an estimate (the sheet\u2019s middle, no material data): real air bends lie lower, so the flat is long. Use your shop\u2019s value.', warning: true }] : []),
    ...s.bends.map(b => ({ text: `${bendLabel(b.name, short)}: ${+b.angleDegrees.toFixed(3)}°, allowance ${mm(b.allowanceMM)}, setback ${mm(b.setbackMM)}, deduction ${mm(b.deductionMM)}${b.table ? `; K ${+b.kFactor.toFixed(4)} from ${b.table.how === 'exact' ? 'row' : 'rows'} ${b.table.rows.join(', ')}${b.table.how === 'interpolated' ? ' (interpolated)' : ''}${b.table.estimate ? ', an estimate among them' : ''}` : ''}`, ...(b.table?.estimate ? { warning: true } : {}) })),
  ];
}

/** A bend's feature: its name before the last `.` (`n4` of `n4.bend`, of a contour's `n0.bend1`). */
const bendFeature = (name: string): string => name.slice(0, Math.max(0, name.lastIndexOf('.')));
/** Whether every bend comes from one feature (a contour's bends, or one flange): then each reads by its last part. */
function oneFeature(bends: readonly { name: string }[]): boolean {
  for (let i = 1; i < bends.length; i++) if (bendFeature(bends[i].name) !== bendFeature(bends[0].name)) return false;
  return true;
}
/**
 * A bend's label in the notes: its last part (`bend1`) when the sheet's bends are all one feature's; otherwise its
 * whole name (`n4.bend`), the feature its faces carry when picked, so several flanges' bends are told apart.
 */
const bendLabel = (name: string, short: boolean): string => short ? name.slice(name.lastIndexOf('.') + 1) : name;

function snapshotOf(doc: StudioDoc): CadPartSnapshot {
  const part = toPartDocument(doc);
  return last ? last.withDocument(part) : evaluateCadPart(part);
}

export function evaluateDoc(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const snapshot = snapshotOf(doc); last = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => bodyOf(o, doc, revision, quality));
    const faceTable = faceTableFrom(snapshot.outputs); rememberFaceTable(doc, faceTable);
    return { ok: true, revision, bodies, ms: performance.now() - t0, faceTable };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/** A preview's planar-path limit for meshes (F0, D42): about a second, so it stays live; applying runs up to the committed limit. */
const PREVIEW = { facetExplodeTriangles: FACET_PREVIEW_TRIANGLES };
/** The previews' caches: a command's, and the section view's (each reuses its own last snapshot). */
const lastPreview: Record<'preview' | 'section', CadPartSnapshot | null> = { preview: null, section: null };
/**
 * A command's preview: through its own cache (the features it leaves alone are not built again while
 * it is dragged) and without mass properties (worked out when the part is evaluated).
 */
export function evaluatePreview(doc: StudioDoc, revision: number, quality = 8, slot: 'preview' | 'section' = 'preview'): EvalResult {
  const t0 = performance.now();
  try {
    const part = toPartDocument(doc), last = lastPreview[slot], snapshot = last ? last.withDocument(part) : evaluateCadPart(part, undefined, PREVIEW); lastPreview[slot] = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => ({ ...keyed(o.id, doc.nodes), family: o.representation, mesh: meshOf(o.brep, revision, quality), volumeMM3: null, massG: null }));
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    lastPreview[slot] = null;
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/**
 * What another part's evaluation is for: each purpose keeps its own last snapshot (PERF3 B12), so a requirement
 * check, a reference check, an agent's proposal or a file read in between does not throw away what the others reuse.
 */
export type PartSlot = 'part' | 'check' | 'refs' | 'agent' | 'read' | 'probe';
/** Another part's bodies on their own (instances: not through the main part's cache). */
const lastParts = new Map<PartSlot, CadPartSnapshot>();
export function evaluatePart(doc: StudioDoc, revision: number, quality = 8, slot: PartSlot = 'part'): EvalResult {
  const t0 = performance.now();
  try {
    const part = toPartDocument(doc), last = lastParts.get(slot), snapshot = last ? last.withDocument(part) : evaluateCadPart(part); lastParts.set(slot, snapshot);
    const bodies: BodyResult[] = snapshot.outputs.map(o => bodyOf(o, doc, revision, quality));
    const faceTable = faceTableFrom(snapshot.outputs); rememberFaceTable(doc, faceTable);
    return { ok: true, revision, bodies, ms: performance.now() - t0, faceTable };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}
/** A part's bodies' volumes only (a clash probe's intersection): no mesh worked out or sent (PERF3 B12). */
export function evaluateVolumes(doc: StudioDoc, slot: PartSlot = 'probe'): { ok: true; volumes: { key: string; volumeMM3: number | null }[] } | { ok: false; error: FriendlyError } {
  try {
    const part = toPartDocument(doc), last = lastParts.get(slot), snapshot = last ? last.withDocument(part) : evaluateCadPart(part); lastParts.set(slot, snapshot);
    return { ok: true, volumes: snapshot.outputs.map(o => {
      let m = masses.get(o.brep);
      if (m === undefined) { try { m = o.massProperties(ALUMINIUM); } catch { m = null; } masses.set(o.brep, m); }
      return { key: bodyKeyOf(o.id, doc.nodes), volumeMM3: m ? m.volumeMM3 : null };
    }) };
  } catch (cause) { return { ok: false, error: friendly(cause instanceof Error ? cause.message : String(cause)) }; }
}

/**
 * A placed part's bodies for display. The placed part is evaluated as before (its features reused from
 * the copy before it), but a body whose faces and edges come out as the part's own at the origin — the
 * same names in the same order — shows the origin body's mesh moved by the placement (its tessellation
 * and mass worked out once for every copy): the mesh, its faces' and edges' points and directions, the
 * bounds, the centre of mass and the inertia. Other bodies are tessellated as placed.
 */
export function evaluatePlaced(placed: StudioDoc, base: StudioDoc, place: { m: number[]; t: [number, number, number] }, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const part = toPartDocument(placed), snapshot = lastPlaced ? lastPlaced.withDocument(part) : evaluateCadPart(part); lastPlaced = snapshot;
    const basePart = toPartDocument(base), origin = lastBase ? lastBase.withDocument(basePart) : evaluateCadPart(basePart); lastBase = origin;
    const bodies = snapshot.outputs.map((o, i) => {
      const at = origin.outputs[i];
      if (!at || origin.outputs.length !== snapshot.outputs.length || !samePlacedBody(o.brep, at.brep, place.m, place.t)) return bodyOf(o, placed, revision, quality);
      return { ...placeBody(bodyOf(at, base, revision, quality), place.m, place.t), ...keyed(o.id, placed.nodes) };
    });
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}
let lastBase: CadPartSnapshot | null = null, lastPlaced: CadPartSnapshot | null = null;
/**
 * Whether a placed body is the part's body at the origin moved by the placement: the same faces and edges
 * by name, in order — but for the numbers of repeated names (`x#2`), which an upright body's turn about Z
 * renumbers by position (they are display names here: mates read faces by name without the number) — and
 * its corners where the origin body's go under the placement (their box, to 1e-6 of its size).
 */
function samePlacedBody(placed: Brep, origin: Brep, m: readonly number[], t: readonly number[]): boolean {
  if (placed.faces.length !== origin.faces.length || placed.edges.length !== origin.edges.length || placed.vertices.length !== origin.vertices.length) return false;
  if (!sameNames(placed.faces, origin.faces) || !sameNames(placed.edges, origin.edges)) return false;
  const a = boxOf(placed.vertices, null, null), b = boxOf(origin.vertices, m, t), size = Math.max(1, ...a.map(Math.abs));
  for (let k = 0; k < 6; k++) if (Math.abs(a[k] - b[k]) > 1e-6 * size) return false;
  return true;
}
const unnumbered = (name: string | undefined) => (name ?? '').replace(/#\d+/g, '');
/** The same names in order, or the same names (unnumbered) as sorted lists. */
function sameNames(a: readonly { name?: string }[], b: readonly { name?: string }[]): boolean {
  let same = true;
  for (let i = 0; i < a.length && same; i++) same = a[i].name === b[i].name;
  if (same) return true;
  const x = a.map(f => unnumbered(f.name)).sort(), y = b.map(f => unnumbered(f.name)).sort();
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
/** The box of points (moved by m, t when given): [min x, y, z, max x, y, z]. */
function boxOf(vs: readonly { point: readonly number[] }[], m: readonly number[] | null, t: readonly number[] | null): number[] {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const v of vs) {
    const p = m && t ? move(m, t, v.point) : v.point;
    for (let k = 0; k < 3; k++) { out[k] = Math.min(out[k], p[k]); out[k + 3] = Math.max(out[k + 3], p[k]); }
  }
  return out;
}
const move = (m: readonly number[], t: readonly number[], p: readonly number[]): [number, number, number] => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]];
const turn = (m: readonly number[], p: readonly number[]): [number, number, number] => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
/** In place: each xyz triple of a ← m·xyz (+ t). */
function moveAll(a: Float32Array, m: readonly number[], t: readonly number[] | null): void {
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2];
    a[i] = m[0] * x + m[1] * y + m[2] * z + (t ? t[0] : 0); a[i + 1] = m[3] * x + m[4] * y + m[5] * z + (t ? t[1] : 0); a[i + 2] = m[6] * x + m[7] * y + m[8] * z + (t ? t[2] : 0);
  }
}
/** A body moved rigidly (x ↦ m x + t: its mesh, faces, edges, centroid and inertia), as an instance is placed; RM2's pose preview too. */
export function placeBody(b: BodyResult, m: readonly number[], t: readonly number[]): BodyResult {
  // (Moved in place: a copy first when the kept mesh itself was handed out.)
  const src = b.mesh, positions = sharing ? src.positions.slice() : src.positions, normals = sharing ? src.normals.slice() : src.normals, edgeLines = sharing ? src.edgeLines.slice() : src.edgeLines;
  moveAll(positions, m, t); moveAll(normals, m, null); moveAll(edgeLines, m, t);
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { const v = positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  const faces = src.faces.map(f => ({ ...f, normal: turn(m, f.normal), centroid: move(m, t, f.centroid), ...(f.exact ? { exact: f.exact.kind === 'plane' ? { kind: 'plane' as const, o: move(m, t, f.exact.o), n: turn(m, f.exact.n) } : { kind: 'cylinder' as const, c: move(m, t, f.exact.c), a: turn(m, f.exact.a), r: f.exact.r } } : {}) }));
  const edges = src.edges.map(e => {
    const a = move(m, t, e.a), z = move(m, t, e.b), d = [z[0] - a[0], z[1] - a[1], z[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
    // (The axis an edge runs along, as the mesh reads it: a unit direction within 1e-9 of one.)
    const axis: DisplayEdge['axis'] = e.straight ? (Math.abs(Math.abs(d[0] / l) - 1) < 1e-9 ? 'x' : Math.abs(Math.abs(d[1] / l) - 1) < 1e-9 ? 'y' : Math.abs(Math.abs(d[2] / l) - 1) < 1e-9 ? 'z' : null) : null;
    return { ...e, a, b: z, axis };
  });
  const mesh = { ...src, positions, normals, edgeLines, faces, edges, bounds: { min, max } };
  const R = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
  const inertia = b.inertia ? R.map((_, i) => R.map((__, j) => { let v = 0; for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += R[i][k] * b.inertia![k][l] * R[j][l]; return v; })) : undefined;
  return { ...b, mesh, ...(b.centroid ? { centroid: move(m, t, b.centroid) } : {}), ...(inertia ? { inertia } : {}) };
}

/** The part's bodies as B-reps, keyed as the studio keys them (for exact views: chat/views.ts). */
export function partBreps(doc: StudioDoc): { key: string; brep: Brep }[] {
  return snapshotOf(doc).outputs.map(o => ({ key: bodyKeyOf(o.id, doc.nodes), brep: o.brep }));
}

/** The whole part (every visible body, and its placed instances) as one STEP file, or the reason it cannot be written. */
/** `meshes`: how mesh bodies are written (STEP export option, R3.5: auto, tessellated or planar). */
/**
 * The part (and its shown instances) as one STEP file. Bodies with the `infill` role (O60: a print lattice) are left out —
 * STEP stays the exact part — and `omitted` says so; 3MF and the mass keep them.
 */
export function stepFor(doc: StudioDoc, name: string, meshes?: 'auto' | 'tessellated' | 'planar'): { text: string; omitted?: string[] } | { error: string } {
  try {
    const breps: Brep[] = [], left: string[] = [];
    const take = (d: StudioDoc, outputs: CadPartSnapshot['outputs'], prefix: string) => {
      for (const o of outputs) { const r = keyed(o.id, d.nodes).ref; if (r && roleOf(d.nodes[r.node])) left.push(`${prefix}${bodyKeyOf(o.id, d.nodes)}`); else breps.push(o.brep); }
    };
    take(doc, snapshotOf(doc).outputs, '');
    for (const inst of doc.instances ?? []) if (!inst.hidden) { const placed = placedDoc(inst); take(placed, evaluateCadPart(toPartDocument(placed)).outputs, `${inst.id}/`); }
    if (!breps.length) return { error: left.length ? 'Only infill bodies: STEP carries the exact part, and there is none to export.' : 'There is no body to export.' };
    const text = exportStep(breps, { name, ...(meshes ? { meshes } : {}) });
    return left.length ? { text, omitted: [`lattice infill not included (${left.join(', ')}); 3MF carries it`] } : { text };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}

export function stlFor(doc: StudioDoc, key: string): Uint8Array | null {
  try {
    const output = snapshotOf(doc).outputs.find(o => bodyKeyOf(o.id, doc.nodes) === key);
    return output ? output.exportStl() : null;
  } catch { return null; }
}

/**
 * The part's visible bodies and its shown instances' as B-reps (for drawings), with a name prefix for
 * each (an instance's `<id>/`, so its edges are told apart), or the reason they cannot be evaluated.
 */
export function brepsFor(doc: StudioDoc): { breps: Brep[]; prefixes: string[] } | { error: string } {
  try {
    const breps = snapshotOf(doc).outputs.map(o => o.brep), prefixes = breps.map(() => '');
    for (const inst of doc.instances ?? []) if (!inst.hidden) for (const o of evaluateCadPart(toPartDocument(placedDoc(inst))).outputs) { breps.push(o.brep); prefixes.push(`${inst.id}/`); }
    return { breps, prefixes };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}

/**
 * A SubD body's caps as lines for its panel (R7, D79): how near the limit surface they are, and a warning where the
 * caps at crease, corner or boundary vertices are past 0.2% of the body's size (their limit's edges are not evenly
 * spread there; the caps use even angles — the limit's own characteristic map is to do).
 */
export const SUBD_CREASE_WARN = 0.002;
function subdNotes(s: NonNullable<CadPartSnapshot['outputs'][number]['subd']>): { text: string; warning?: boolean }[] {
  const pct = (x: number) => `${+(100 * x / s.sizeMM).toPrecision(2)}% of its size`;
  const out: { text: string; warning?: boolean }[] = [{ text: `Caps: G1 at ${s.irregularVertices} irregular ${s.irregularVertices === 1 ? 'vertex' : 'vertices'} (${s.caps} caps, ${s.steps} Catmull–Clark step${s.steps === 1 ? '' : 's'}); max deviation from the limit surface ${+s.maxDeviationMM.toPrecision(2)} mm (${pct(s.maxDeviationMM)})` }];
  if (s.creaseDeviationMM > SUBD_CREASE_WARN * s.sizeMM) out.push({ text: `At crease, corner or boundary vertices the caps are ${+s.creaseDeviationMM.toPrecision(2)} mm from the limit (${pct(s.creaseDeviationMM)}, past 0.2%): the limit's edges there are not evenly spread and the caps use even angles (to do: the limit's own characteristic map)`, warning: true });
  return out;
}
/**
 * A simplified mesh's report as lines for its panel (R9, D85): the triangles before and after and why it stopped, and
 * the distance measured both ways — a measurement over the meshes' vertices and triangle centres, not a bound.
 */
function decimateNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['decimate']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => `${+x.toPrecision(2)} mm`, count = (x: number) => x.toLocaleString('en-US'), d = r.distance;
  const why = r.stoppedBy === 'target' ? 'the asked count' : r.stoppedBy === 'error' ? 'the error bound' : 'as far as its regions’ boundaries and open edges let it';
  return [
    { text: `Simplified: ${count(r.trianglesBefore)} → ${count(r.trianglesAfter)} triangles (stopped at ${why})` },
    ...(d ? [{ text: `Measured distance from the original: at most ${mm(d.hausdorffMM)} (${mm(d.toResultMaxMM)} to it, ${mm(d.toOriginalMaxMM)} back; RMS ${mm(d.rmsMM)}, over ${count(d.samples)} points)` }] : []),
    ...(r.refused.flip + r.refused.topology ? [{ text: `${count(r.refused.flip + r.refused.topology)} collapses refused: they would fold a triangle or break the surface` }] : []),
  ];
}
/** A gear's report as lines for the body's panel (R6a, D54). */
function gearNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['gear']>): { text: string; warning?: boolean }[] {
  const d = g.dimensions, mm = (x: number) => +x.toFixed(4);
  return [
    { text: `${g.profileShift ? `Profile shift x ${g.profileShift}: ` : ''}Reference Ø${mm(d.referenceDiameterMM)}, tip Ø${mm(d.tipDiameterMM)}, root Ø${mm(d.rootDiameterMM)}, base Ø${mm(d.baseDiameterMM)} mm; tooth ${mm(d.toothThicknessMM)} mm at the reference circle` },
    ...(g.helix ? [{ text: `Helical β ${g.helix.helixAngleDeg}° ${g.helix.hand} hand: normal module ${mm(g.helix.normalModuleMM)}, transverse ${mm(g.helix.transverseModuleMM)} mm at α_t ${g.helix.transversePressureAngleDeg.toFixed(3)}°; lead ${mm(g.helix.leadMM)} mm, ${mm(g.helix.twistDegrees)}° over the face, the twist within ${g.helix.twistDeviationMM.toExponential(1)} mm${g.helix.axialSegments > 1 ? ` (${g.helix.axialSegments} axial segments)` : ''}` }] : []),
    { text: `Flanks within ${g.profileDeviationMM.toExponential(1)} mm of the involute (${g.flankPieces} cubic piece${g.flankPieces > 1 ? 's' : ''}; asked ${g.profileToleranceMM.toExponential(1)})` },
    // (R12b.1a, D130: the root the basic rack cuts.)
    ...(g.generatedRoot ? [{ text: `Root cut by the basic rack (tip radius ${mm(g.generatedRoot.toolTipRadiusMM)} mm): the involute from Ø${mm(g.generatedRoot.formDiameterMM)}${g.generatedRoot.undercut ? ' (undercut)' : ' (the form circle)'}; fillets within ${g.generatedRoot.filletDeviationMM.toExponential(1)} mm of the tool's envelope (${g.generatedRoot.filletPieces} cubic pieces). Not validated for manufacturing` }] : []),
    ...g.diagnostics.map(x => ({ text: x.code === 'ROOT_TRANSITION_UNVALIDATED' ? 'Schematic root: not the cutting tool\'s, not validated for manufacturing' : x.message, warning: x.severity === 'warning' })),
  ];
}

/**
 * A meshing gear's pair check against the gear it meshes with, for the body's panel (R6a.4b, D56): the verdict mode
 * (stopping at the first crossing; the kernel caches it by both gears, the centre distance and the phase), its time.
 */
function meshNotes(g: GearPlacement | undefined): { text: string; warning?: boolean }[] {
  if (g?.ring) return insideNotes(g);
  if (!g?.driver) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedSpurGears>;
  try { c = checkPlacedSpurGears(g.driver, g, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${g.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  const head = `Meshes with ${g.meshesWith}: centre distance ${mm(c.centerDistanceMM)} mm, ratio −${g.driver.spec.teeth}:${g.spec.teeth}, backlash ${mm(c.backlashMM)} mm, contact ratio ${c.usableContactRatio.toFixed(3)}${c.axialContactRatio ? ` + overlap ${c.axialContactRatio.toFixed(3)} = ${c.totalContactRatio.toFixed(3)}` : ''}`;
  return [{ text: head },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.atDegrees.toFixed(2)}° of ${g.meshesWith} (phase ${c.relativePhaseDeg.toFixed(2)}°): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period (checked in ${ms.toFixed(0)} ms)` },
    ...(c.axialThrust ? [{ text: `Axial thrust: ${c.axialThrust.replace(/^gear 1/, g.meshesWith ?? 'gear 1').replace('gear 2', 'this gear')}` }] : []),
    ...c.diagnostics.filter(x => x.code !== 'SELF_INTERSECTION' && x.code !== 'ROOT_TRANSITION_UNVALIDATED').map(x => ({ text: x.message, warning: x.severity === 'warning' }))];
}

/** An internal gear's report as lines for the body's panel (R12b.2a, D132). */
function internalGearNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['internalGear']>, node?: ModelNode): { text: string; warning?: boolean }[] {
  const d = g.dimensions, mm = (x: number) => +x.toFixed(4);
  // (The command's default shift said as one, D132: not a standard.)
  const shift = node?.kind === 'internal-gear' && node.shiftDefault ? `Profile shift ${g.profileShift} (default: clears rack-cut pinions; see D132): ` : g.profileShift ? `Profile shift x ${g.profileShift}: ` : '';
  return [
    { text: `${shift}Internal: reference Ø${mm(d.referenceDiameterMM)}, tip Ø${mm(d.tipDiameterMM)} (inside), root Ø${mm(d.rootDiameterMM)}, base Ø${mm(d.baseDiameterMM)}, rim Ø${mm(d.rimDiameterMM)} mm; space ${mm(d.spaceWidthMM)} mm at the reference circle` },
    ...(g.helix ? [{ text: `Helical β ${g.helix.helixAngleDeg}° ${g.helix.hand} hand: normal module ${mm(g.helix.normalModuleMM)}, transverse ${mm(g.helix.transverseModuleMM)} mm; its pinion takes the same hand` }] : []),
    { text: `Flanks within ${g.profileDeviationMM.toExponential(1)} mm of the involute (${g.flankPieces} cubic piece${g.flankPieces > 1 ? 's' : ''}; asked ${g.profileToleranceMM.toExponential(1)})` },
    // (R12b.2b, D133: the root a pinion-type cutter cuts, or the schematic one.)
    ...(g.shaperRoot ? [{ text: `Root cut by a ${g.shaperRoot.cutterTeeth}-tooth pinion-type cutter${g.shaperRoot.cutterShift ? ` (x0 ${g.shaperRoot.cutterShift})` : ''}, tip radius ${mm(g.shaperRoot.cutterTipRadiusMM)} mm, at ${mm(g.shaperRoot.cuttingCenterDistanceMM)} mm: the involute to Ø${mm(g.shaperRoot.formDiameterMM)}; fillets within ${g.shaperRoot.filletDeviationMM.toExponential(1)} mm of its envelope (${g.shaperRoot.filletPieces} cubic pieces). Not validated for manufacturing` },
      ...g.diagnostics.map(x => ({ text: x.message, warning: x.severity === 'warning' }))]
      : [{ text: 'Schematic root: not the cutting tool\'s (a pinion-type cutter), not validated for manufacturing', warning: true }]),
  ];
}
/**
 * A pinion inside a ring: the pair's check in verdict mode (R12b.2a, D132) — the centre distance, ratio +z1:z2,
 * backlash, contact ratio, the verdict, and the interference conditions and the radial assembly as warnings.
 */
function insideNotes(g: GearPlacement): { text: string; warning?: boolean }[] {
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedInternalGears>;
  try { c = checkPlacedInternalGears(g.ring!, g, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh inside ${g.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes inside ${g.meshesWith}: centre distance ${mm(c.centerDistanceMM)} mm, ratio +${g.spec.teeth}:${g.ring!.spec.teeth} (the same way), backlash ${mm(c.backlashMM)} mm, contact ratio ${c.usableContactRatio.toFixed(3)}${c.axialContactRatio ? ` + overlap ${c.axialContactRatio.toFixed(3)} = ${c.totalContactRatio.toFixed(3)}` : ''}` },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.atDegrees.toFixed(2)}° of this gear (phase ${c.relativePhaseDeg.toFixed(2)}°): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period (checked in ${ms.toFixed(0)} ms)` },
    c.interference.trimming.interference ? { text: c.interference.trimming.possible ? `Radial assembly: the teeth cross moving in ${mm(c.interference.trimming.atOffsetMM)} mm from the ring's centre — assemble it axially` : 'Radial assembly impossible: its tip circle does not fit inside the ring\'s — assemble it axially', warning: true }
      : { text: 'Radial assembly clear: it can be moved in from the ring\'s centre' },
    ...c.diagnostics.filter(x => x.code === 'INVOLUTE_INTERFERENCE' || x.code === 'TROCHOID_INTERFERENCE').map(x => ({ text: x.message, warning: true }))];
}

/** A worm's report as lines for the body's panel (R12b.5, D136). */
function wormNotes(w: NonNullable<CadPartSnapshot['outputs'][number]['worm']>): { text: string; warning?: boolean }[] {
  const d = w.dimensions, mm = (x: number) => +x.toFixed(4);
  return [
    { text: `Worm ${w.form}${w.form === 'ZI' ? ' (involute helicoid)' : ' (straight axial sides)'}: reference Ø${mm(d.referenceDiameterMM)}, tip Ø${mm(d.tipDiameterMM)}, root Ø${mm(d.rootDiameterMM)} (q ${mm(d.diameterQuotient)}); lead angle γ ${mm(d.leadAngleDeg)}°, lead ${mm(d.leadMM)} mm, axial pitch ${mm(d.axialPitchMM)} mm; ${w.form === 'ZI' ? `base Ø${mm(d.baseDiameterMM!)}, α_t ${mm(d.transversePressureAngleDeg!)}°` : `axial sides at α_x ${mm(d.axialPressureAngleDeg!)}°`}` },
    { text: `Flanks within ${w.profileDeviationMM.toExponential(1)} mm (${w.flankPieces} cubic piece${w.flankPieces > 1 ? 's' : ''}${w.flankFaces > 1 ? ` on ${w.flankFaces} faces` : ''}), the thread's twist ${mm(w.twist.turns)} turns within ${w.twist.deviationMM.toExponential(1)} mm (${w.twist.pieces} pieces in ${w.twist.axialSegments} axial segments). Not validated for manufacturing` },
    ...w.diagnostics.map(x => ({ text: x.code === 'ROOT_TRANSITION_UNVALIDATED' ? 'Schematic root: not the thread tool\'s, not validated for manufacturing' : x.message, warning: x.severity === 'warning' })),
  ];
}
/** A compression spring's report as lines for the body's panel (R12c.1a, D153): its sizes, solid heights, rate and load. */
function springNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['spring']>): { text: string; warning?: boolean }[] {
  if (r.type !== 'compression') return hookedSpringNotes(r);
  const s = r, d = s.dimensions, mm = (x: number) => +x.toFixed(4), ends = s.ends === 'open' ? 'open' : s.ends === 'closed' ? 'closed' : 'closed and ground';
  return [
    { text: `Compression spring, ${s.hand} hand, ends ${ends}: wire Ø${mm(d.wireDiameterMM)}, mean Ø${mm(d.meanDiameterMM)} (outer ${mm(d.outerDiameterMM)}, inner ${mm(d.innerDiameterMM)}), index C ${mm(d.springIndex)}; ${mm(d.activeCoils)} active of ${mm(d.totalCoils)} coils, pitch ${mm(d.pitchMM)} mm (helix angle ${mm(d.helixAngleDeg)}°), free length ${mm(d.freeLengthMM)} mm (L0/D ${mm(d.slenderness)})` },
    { text: `Solid height ${mm(d.solidHeightMM)} mm (turns a wire Ø apart at pitch ${mm(d.solidPitchMM)}); ${mm(d.supplierSolidHeightMM)} mm by the supplier's rule ${d.supplierSolidHeightRule}; travel to solid ${mm(d.travelToSolidMM)} mm` },
    ...(d.rateNPerMM !== undefined ? [{ text: `Rate ${mm(d.rateNPerMM)} N/mm (Gd⁴/8D³n, G ${d.shearModulusMPa} MPa${d.shearModulusEstimate ? ', an estimate for steel: the rate is one too' : ''})`, ...(d.shearModulusEstimate ? { warning: true } : {}) }] : [{ text: 'No rate: give the shear modulus G' }]),
    ...(d.load ? [{ text: `At ${mm(d.load.forceN)} N: ${d.load.deflectionMM !== undefined ? `deflection ${mm(d.load.deflectionMM)} mm, length ${mm(d.load.lengthMM!)} mm, ` : ''}shear stress ${mm(d.load.shearStressMPa)} MPa (Wahl K_W ${mm(d.wahlFactor)}; uncorrected ${mm(d.load.uncorrectedShearStressMPa)})` }] : []),
    { text: `Wire within ${s.sweep.profileDeviationMM.toExponential(1)} mm of the exact pipe (${s.sweep.pieces} cubic pieces on ${s.sweep.segments} segments); wire length ${mm(s.sweep.wireLengthMM)} mm` },
    { text: 'Not validated for manufacturing: no buckling, fatigue or relaxation check', warning: true },
    ...s.diagnostics.map(x => ({ text: x.message.replace(/^spring: /, ''), warning: x.severity === 'warning' })),
  ];
}
/** An extension or torsion spring's report as lines (R12c.1b, D154). */
function hookedSpringNotes(s: Extract<NonNullable<CadPartSnapshot['outputs'][number]['spring']>, { type: 'extension' | 'torsion' }>): { text: string; warning?: boolean }[] {
  const d = s.dimensions, mm = (x: number) => +x.toFixed(4), close = s.dimensions.pitchMM < s.dimensions.wireDiameterMM * 1.01;
  const head = `${s.type === 'extension' ? 'Extension' : 'Torsion'} spring, ${s.hand} hand${s.hooks ? `, ${s.hooks === 'crossover' ? 'crossover hooks' : 'machine loops'}` : ''}: wire Ø${mm(d.wireDiameterMM)}, mean Ø${mm(d.meanDiameterMM)} (outer ${mm(d.outerDiameterMM)}, inner ${mm(d.innerDiameterMM)}), index C ${mm(d.springIndex)}; ${mm(d.activeCoils)} coils${close ? ' close-wound' : ''} at pitch ${mm(d.pitchMM)} mm, coil length ${mm(d.bodyLengthMM)} mm`;
  const lines: { text: string; warning?: boolean }[] = [{ text: head }];
  if (s.type === 'extension') {
    lines.push({ text: `Length inside the hooks ${mm(d.lengthInsideHooksMM!)} mm; initial tension ${mm(d.initialTensionN ?? 0)} N (your figure: no data behind it)` });
    lines.push(d.rateNPerMM !== undefined ? { text: `Rate ${mm(d.rateNPerMM)} N/mm (Gd⁴/8D³n, G ${d.shearModulusMPa} MPa${d.shearModulusEstimate ? ', an estimate for steel: the rate is one too' : ''})`, ...(d.shearModulusEstimate ? { warning: true } : {}) } : { text: 'No rate: give the shear modulus G' });
    if (d.load) lines.push({ text: `At ${mm(d.load.forceN)} N: ${d.load.extensionMM !== undefined ? `extension ${mm(d.load.extensionMM)} mm past the initial tension, ` : ''}shear stress ${mm(d.load.shearStressMPa)} MPa in the coil (Wahl K_W ${mm(d.wahlFactor!)}); the hooks' stresses not computed` });
  } else {
    lines.push({ text: `Legs ${mm(d.legLengthsMM![0])} and ${mm(d.legLengthsMM![1])} mm along the coil's tangent, ${mm(d.legAngleDeg!)}° apart seen along the axis` });
    lines.push(d.torsionalRateNmmPerRad !== undefined ? { text: `Rate ${mm(d.torsionalRateNmmPerDeg!)} N·mm/° (Ed⁴/64Dn, ${mm(d.torsionalRateNmmPerRad)} N·mm/rad; E ${d.youngsModulusMPa} MPa${d.youngsModulusEstimate ? ', an estimate for steel: the rate is one too' : ''})`, ...(d.youngsModulusEstimate ? { warning: true } : {}) } : { text: 'No rate: give Young\'s modulus E' });
    if (d.moment) lines.push({ text: `At ${mm(d.moment.momentNmm)} N·mm: ${d.moment.turnDeg !== undefined ? `turn ${mm(d.moment.turnDeg)}°, ` : ''}bending stress ${mm(d.moment.bendingStressMPa)} MPa (K_b ${mm(d.bendingFactor!)})` });
  }
  lines.push({ text: `Wire within ${s.sweep.profileDeviationMM.toExponential(1)} mm of the exact pipe (${s.sweep.pieces} cubic pieces on the coil; ends exact); wire length ${mm(d.wireLengthMM)} mm; the ${s.type === 'extension' ? 'hooks' : 'legs'} clear the wire by ${mm(d.leastClearanceMM - d.wireDiameterMM)} mm` });
  lines.push({ text: 'Not validated for manufacturing: no fatigue, relaxation or hook-stress check', warning: true });
  return lines;
}
/** A throated worm wheel's report as lines for the body's panel (R12b.6, D137). */
function wormWheelNotes(w: NonNullable<CadPartSnapshot['outputs'][number]['wormWheel']>): { text: string; warning?: boolean }[] {
  const d = w.dimensions, mm = (x: number) => +x.toFixed(4);
  return [
    { text: `Throated worm wheel, cut by a hob of its ZA worm's thread: reference Ø${mm(d.referenceDiameterMM)}, throat Ø${mm(d.throatDiameterMM)} (its surface radius ${mm(d.throatRadiusMM)}), root Ø${mm(d.rootDiameterMM)}, centre distance ${mm(d.centerDistanceMM)} mm; at its faces tip Ø${mm(d.tipDiameterAtFacesMM)}, root Ø${mm(d.rootDiameterAtFacesMM)}` },
    { text: `Flanks within ${w.flank.deviationMM.toExponential(1)} mm of the generated surface in every plane (${w.flank.piecesAcross} × ${w.flank.piecesAlong} bicubic pieces), root fillets within ${w.fillet.deviationMM.toExponential(1)} (asked ${w.profileToleranceMM.toExponential(1)}); tips and roots on their tori exactly. Not validated for manufacturing` },
    ...w.diagnostics.map(x => ({ text: x.message, warning: x.severity === 'warning' })),
  ];
}
/** A worm meshing with its wheel: the pair's check in verdict mode (R12b.5, D136) — the sections square to the wheel's axis. */
function wormMeshNotes(p: CadPartSnapshot['outputs'][number]['wormPlacement']): { text: string; warning?: boolean }[] {
  if (p?.throatedWheel) return throatedMeshNotes(p);
  if (!p?.wheel) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedWormPair>;
  try { c = checkPlacedWormPair(p.wheel, p, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${p.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4), side = mm(p.wheel.spec.faceWidthMM / 3);
  return [{ text: `Meshes with ${p.meshesWith}: crossed at 90°, centre distance ${mm(c.centerDistanceMM)} mm, ratio ${p.wheel.spec.teeth}:${p.spec.starts} (${mm(c.speedRatio)}:1), backlash ${mm(c.backlashMM)} mm along the worm's axis, mid-plane contact ratio ${c.midPlaneContactRatio.toFixed(3)}` },
    c.interference ? { text: `The thread and the wheel's teeth cross (${c.planes.filter(x => x.interference).map(x => `${mm(x.offsetMM)} mm`).join(', ')} from the wheel's mid-plane): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over an axial pitch in the wheel's mid-plane and ±${side} mm (checked in ${ms.toFixed(0)} ms)` },
    ...c.diagnostics.filter(x => x.code !== 'SELF_INTERSECTION').map(x => ({ text: x.message, warning: x.severity === 'warning' }))];
}

/** A worm meshing with its throated wheel (R12b.6, D137): the sections square to the wheel's axis, verdict mode. */
function throatedMeshNotes(p: NonNullable<CadPartSnapshot['outputs'][number]['wormPlacement']>): { text: string; warning?: boolean }[] {
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedThroatedPair>;
  try { c = checkPlacedThroatedPair(p.throatedWheel!, p, { mode: 'verdict', samples: 16 }); }
  catch (cause) { return [{ text: `Does not mesh with ${p.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes with ${p.meshesWith}, enveloping it: crossed at 90°, centre distance ${mm(c.centerDistanceMM)} mm, ratio ${p.throatedWheel!.spec.teeth}:${p.spec.starts} (${mm(c.speedRatio)}:1), backlash ${mm(c.backlashMM)} mm along the worm's axis` },
    c.interference ? { text: `The thread and the wheel's teeth cross (${c.planes.filter(x => x.interference).map(x => `${mm(x.offsetMM)} mm`).join(', ')} from its mid-plane): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `In contact along lines across the face — touching or clear in the mid-plane and ${c.planes.length - 1} sections either side (checked in ${ms.toFixed(0)} ms)` }];
}

/** A bevel gear's report as lines for the body's panel (R12b.3, D134). */
function bevelGearNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['bevelGear']>, node?: ModelNode): { text: string; warning?: boolean }[] {
  const d = g.dimensions, mm = (x: number) => +x.toFixed(4), dg = (x: number) => +x.toFixed(4), sp = g.spiral;
  // (R12b.4, D135: a spiral one is an ideal model — said first, as a warning; its cutter radius an estimate when the command's default.)
  const estimate = node?.kind === 'bevel-gear' && node.spiral?.cutterEstimate;
  return [
    ...(sp ? [{ text: 'Ideal model: a spiral bevel gear in line contact — the conjugate of its mate on every sphere about the apex, not a face-milled or face-hobbed tooth (no crowning, no machine settings)', warning: true },
      { text: `Spiral β_m ${dg(sp.meanSpiralAngleDeg)}° ${sp.hand} hand on a ${mm(sp.cutterRadiusMM)} mm cutter radius${estimate ? ' (an estimate: the mean cone distance; give the shop\'s)' : ''}: β ${dg(sp.spiralAngleAtToeDeg)}° at the toe to ${dg(sp.spiralAngleAtHeelDeg)}° at the heel; transverse α_t ${dg(sp.transversePressureAngleDeg)}° (normal ${dg(sp.normalPressureAngleAtToeDeg)}° to ${dg(sp.normalPressureAngleAtHeelDeg)}°); the section turns ${dg(sp.twistDeg)}° from the toe to the heel, within ${sp.twistDeviationMM.toExponential(1)} mm (${sp.twistPieces} cubic piece${sp.twistPieces > 1 ? 's' : ''})`, ...(estimate ? { warning: true } : {}) }] : []),
    { text: `${sp ? 'Spiral' : 'Straight'} bevel, spherical involute: reference Ø${mm(d.referenceDiameterMM)} at the heel, pitch cone ${dg(d.pitchAngleDeg)}° (shaft angle ${dg(d.shaftAngleDeg)}°), cone distance ${mm(d.coneDistanceMM)} mm (toe ${mm(d.innerConeDistanceMM)}); tip Ø${mm(d.tipDiameterAtHeelMM)}, root Ø${mm(d.rootDiameterAtHeelMM)} at the heel; addendum and dedendum angles ${dg(d.addendumAngleDeg)}° and ${dg(d.dedendumAngleDeg)}°, the cones through the apex` },
    { text: `Flanks within ${g.profileDeviationMM.toExponential(1)} mm of the spherical involute, exactly on the spheres about the apex (${g.flankPieces} conic piece${g.flankPieces > 1 ? 's' : ''}; asked ${g.profileToleranceMM.toExponential(1)}); heel and toe are spheres about the apex` },
    { text: `Tredgold's virtual spur gear: ${g.virtualTeeth.toFixed(2)} teeth (an estimate; the gear is the exact spherical involute)` },
    ...g.diagnostics.filter(x => x.code !== 'IDEAL_MODEL').map(x => ({ text: x.code === 'ROOT_TRANSITION_UNVALIDATED' ? 'Schematic root: not the generating tool\'s, not validated for manufacturing' : x.message, warning: x.severity === 'warning' })),
  ];
}
/** A bevel gear meshing with another: the pair's check in verdict mode (R12b.3, D134) — ratio, backlash, contact ratio, the verdict. */
function bevelMeshNotes(g: CadPartSnapshot['outputs'][number]['bevelGearPlacement']): { text: string; warning?: boolean }[] {
  if (!g?.driver) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedBevelGears>;
  try { c = checkPlacedBevelGears(g.driver, g, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${g.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes with ${g.meshesWith}: the same apex, shaft angle ${+c.shaftAngleDeg.toFixed(4)}°, ratio ${g.driver.spec.teeth}:${g.spec.teeth}, backlash ${mm(c.backlashMM)} mm at the heel, contact ratio ${c.usableContactRatio.toFixed(3)} (spherical; Tredgold's estimate ${c.tredgoldContactRatio.toFixed(3)})${c.faceContactRatio !== undefined ? ` + face ${c.faceContactRatio.toFixed(3)} = ${c.totalContactRatio!.toFixed(3)}` : ''}` },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.atDegrees.toFixed(2)}° of ${g.meshesWith} (phase ${c.relativePhaseDeg.toFixed(2)}°): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period ${c.spheres ? `on ${c.spheres.length} spheres from the toe to the heel` : 'on the heel sphere'} (checked in ${ms.toFixed(0)} ms)` },
    ...(c.spheres ? [{ text: `Axial thrust: ${c.axialThrust.replace(/gear 1/g, g.meshesWith ?? 'gear 1').replace(/gear 2/g, 'this gear')}` }] : [])];
}

/** A rack's report as lines for the body's panel (R6a.5b, D58). */
function rackNotes(k: NonNullable<CadPartSnapshot['outputs'][number]['rack']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4);
  return [...(k.helix ? [{ text: `Helical rack β ${k.helix.helixAngleDeg}° ${k.helix.hand} hand (normal module ${mm(k.helix.normalModuleMM)}): its teeth slide ${mm(k.helix.shear)} mm along per mm up the face` }] : []),
    { text: `Length ${mm(k.lengthMM)} mm, pitch ${mm(k.pitchMM)} mm; tooth ${mm(k.toothThicknessMM)} mm on the pitch line, tip ${mm(k.tipWidthMM)}, root gap ${mm(k.rootWidthMM)} mm` },
    // (R12b.1b, D131: the basic rack's root fillet, or the schematic corner.)
    k.rootFillet ? { text: `Root fillets ${mm(k.rootFillet.radiusMM)} mm (the basic rack's): the straight flank ends ${mm(k.rootFillet.flankEndDepthMM)} mm below the pitch line. Not validated for manufacturing` }
      : { text: 'Schematic root: not the cutting tool\'s, not validated for manufacturing', warning: true }];
}
/** A rack meshing with a gear: the pair's check in verdict mode, its time (as meshNotes). */
function rackMeshNotes(k: RackPlacement | undefined): { text: string; warning?: boolean }[] {
  if (!k?.driver) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedSpurRack>;
  try { c = checkPlacedSpurRack(k.driver, k, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${k.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes with ${k.meshesWith}: pitch line ${mm(c.centerDistanceMM)} mm from its axis, ${mm(Math.PI * spurGearDimensions(k.driver.spec).referenceDiameterMM)} mm a turn, backlash ${mm(c.backlashMM)} mm, contact ratio ${c.usableContactRatio.toFixed(3)}${c.axialContactRatio ? ` + overlap ${c.axialContactRatio.toFixed(3)} = ${c.totalContactRatio.toFixed(3)}` : ''}` },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.atDegrees.toFixed(2)}° of ${k.meshesWith} (slid ${c.rackPhaseMM.toFixed(3)} mm): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period (checked in ${ms.toFixed(0)} ms)` }];
}

