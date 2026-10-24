import { provenanceOfTree, type ShopTreeProvenance } from './shopRows';
import { resolveSkeletons } from '../frames/skeleton';
import { faceTableFrom, rememberFaceTable } from '../assembly/faces';
import { fitNotes } from './fits';
import { boughtOf, elementOf, type BodyElement } from './elements';
import type { FaceTable } from '../assembly/mates';
import { massPropertiesOf, reevaluate, exportStl, type CadPartOutput, brepSurfaceArea, cutPiece, evaluateCadPart, transformBrep, FACET_PREVIEW_TRIANGLES, type Brep, type CadPartFeatureProfile, type CadPartSnapshot, type FlatPattern, type GearPlacement, type RackPlacement, type SubdSummary, type CutPiece, exportStep } from '@barocss/cad';
import { bodyMesh, type DisplayEdge, type DisplayMesh } from './mesh';
import { lumpTouches } from './lumps';
import { friendlyCause, type FriendlyError } from './errors';
import { bodyKeyOf, partSnapshot } from './part';
import { placedBase, placedDoc, type PartInstance, type BodyRef, type ModelNode, type Side, type StudioDoc } from './doc';
import { placementOf } from './placement';
import { bodyKeyFor, bodyNodeOf } from './ids';
import { fastenerLinkNotes } from '../library/fastenerLinks';
import { fastenerSizesOf } from './fastenerSizeRows';
import { revisionOf } from '../util/revision';
import { beadNotes, bearingNotes, bevelGearNotes, bevelMeshNotes, camNotes, connectorNotes, decimateNotes, driveNotes, endCapNotes, gearNotes, glandNotes, gussetNotes, internalGearNotes, memberNotes, meshNotes, rackMeshNotes, rackNotes, shaftNotes, shaftPartNotes, sheetOf, springNotes, staleOf, subdNotes, wormMeshNotes, wormNotes, wormWheelNotes } from './bodyNotes';
import { refusal } from './refusal';

/** A kernel output's body key and the node and side it is now. */
/** A body's role, from the node that made it (O60: 'infill' on a print infill's mesh node). */
const roleOf = (n: ModelNode | undefined): 'infill' | undefined => n && (n as { role?: string }).role === 'infill' ? 'infill' : undefined;
function keyed(outputId: string, nodes: readonly ModelNode[]): { key: string; ref?: BodyRef } {
  const key = bodyKeyOf(outputId, nodes), at = bodyNodeOf(nodes, key);
  return at ? { key, ref: { node: at.node, side: at.side as Side } } : { key };
}

/** A volume found from the mesh, and how far it may be off (O179). */
export interface VolumeBasis { method: 'tessellated'; bound: number | null }
/** The volume basis of the kernel's mass properties: a tessellated one's, with its bound; none for an exact method. */
export function volumeBasisOf(m: { readonly method?: string; readonly volumeBound?: number }): VolumeBasis | undefined {
  return m.method === 'tessellated' ? { method: 'tessellated', bound: m.volumeBound ?? null } : undefined;
}
export interface BodyResult {
  /** `b<k>` by the stable id of the feature that made it (engine/ids.ts); `ref`: that feature's node and side now. */
  key: string;
  ref?: BodyRef;
  /** 'upright' (Z-prismatic: holes, fillets, curved Booleans), 'planar' or 'curved' (general B-rep). */
  family: string; mesh: DisplayMesh;
  /** 'infill' (O60): a print infill body (its node's role) — in the mass and 3MF, left out of STEP. */
  role?: 'infill';
  volume: number | null; mass: number | null;
  /**
   * O18: the mass properties were deferred (deferMasses on): volume and mass are null until they are worked out —
   * `massOfRef(massRef)` gives the fields this body would have carried. Absent: they are here (or the body has no volume).
   */
  massRef?: number;
  /** O18: the placements a deferred body was moved by (placeBody), applied to its mass fields when they are worked out. */
  massPlace?: { m: number[]; t: number[] }[];
  /**
   * Its surface area (mm²): the kernel's, over the exact surfaces as mass properties integrate them (`areaBasis`
   * 'exact'); the display mesh's triangles only where the kernel cannot (labelled 'display mesh', a little low on curves).
   */
  area?: number; areaBasis?: 'exact' | 'display mesh';
  /**
   * O179 (the kernel's D200): how its volume was found when not exactly — 'tessellated', a curved body the quadrature
   * could not integrate, from the mesh; `bound` the volume's change from a mesh of half the segments (about three
   * times the error). Absent: exact (quadrature, planar or closed form). Its mass and centroid are as good.
   */
  volumeBasis?: VolumeBasis;
  /** Centre of mass (mm), with the volume (uniform density). */
  centroid?: [number, number, number];
  /** Inertia about the centre of mass (g·mm², aluminium at 2.7 g/cm³; scale by density for another material). */
  inertia?: number[][];
  /** A body in several separate pieces (a cut right through it): how many. */
  pieces?: number;
  /**
   * O8 (the kernel's D204): the pieces that touch only along a line or at a point, as pairs of lump numbers (0 first,
   * the kernel's order) — one body to the model, a lump at a time to the exports and the print checks, and a warning on
   * the manufacturability result. Absent when no two touch (pieces apart, or one piece).
   */
  lumpTouch?: [number, number][];
  /** What a generator says of the body (a gear: its dimensions, its flank fit, its root). */
  notes?: { text: string; warning?: boolean }[];
  /** A machine element's kernel report as plain data, with the user's row it was checked against (O142; a stable shape). */
  element?: BodyElement;
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
  sheet?: { thickness: number; bendRadius: number; kFactor?: number; bendTable?: string };
}
export type EvalResult =
  // (`faceTable`: the part's flat and round faces from the B-rep just built — the face table the requirement checks,
  // print rules and mates read, kept so they do not evaluate the part again; PERF3 A1.)
  // (`rebuild`: the part's own evaluation as the kernel profiled it — evaluateDoc only; O10.)
  | { ok: true; revision: number; bodies: BodyResult[]; ms: number; faceTable?: FaceTable; shopRows?: readonly ShopTreeProvenance[]; rebuild?: RebuildData }
  | { ok: false; revision: number; error: FriendlyError; ms: number };

/** The main evaluation's rebuild (O10): the features built again and those reused, and each one's own cost (D228). */
export interface RebuildData { evaluated: readonly string[]; reused: readonly string[]; profile: Readonly<Record<string, CadPartFeatureProfile>> }

// Density in g/cm³, matching app/mass.ts and the kernel MMGS boundary.
const ALUMINIUM = 2.7;
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
const masses = new WeakMap<Brep, ReturnType<typeof massPropertiesOf> | null>();
// O18: deferred mass. With deferMasses on (the studio's worker) a body whose mass is not yet known carries a `massRef`
// in place of its mass fields; massOfRef works them out on request, from the same cache, so they are the eager ones
// byte for byte. A ref names its B-rep weakly: once nothing holds the B-rep (a later evaluation replaced it) it is gone.
let deferring = false;
/** Mass properties left out of each body until asked for (massOfRef); off: worked out with the body, as before. */
export function deferMasses(on: boolean): void { deferring = on; }
const massRefs = new Map<number, WeakRef<Brep>>(), refOfBrep = new WeakMap<Brep, number>();
let nextMassRef = 1;
type MassProps = NonNullable<ReturnType<typeof massPropertiesOf>>;
// Native file exports need the original Kernel result's private provenance. Body copies used for notes retain
// their inertia-array identity; worker clones and placed tensors intentionally do not acquire this provenance.
const nativeMasses = new WeakMap<object, MassProps>();
/** Internal native-export lookup only: no evaluation, integration, public body field or inferred provenance. */
export const nativeMassPropertiesOfBody = (body: Pick<BodyResult, 'inertia'>): MassProps | undefined => body.inertia ? nativeMasses.get(body.inertia) : undefined;
/** The body's mass fields from its mass properties (null: no positive volume). */
function massFields(m: MassProps | null): Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'> {
  const basis = m ? volumeBasisOf(m) : undefined;
  const fields: Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'> = m ? { volume: m.volume, mass: m.mass, centroid: [m.centroid[0], m.centroid[1], m.centroid[2]] as [number, number, number], inertia: m.inertia.map(r => [...r]), ...(basis ? { volumeBasis: basis } : {}) } : { volume: null, mass: null };
  if (m && fields.inertia) nativeMasses.set(fields.inertia, m);
  return fields;
}
/** A B-rep's mass properties, once (null: no positive volume). */
function massOfBrep(o: CadPartOutput): MassProps | null {
  let m = masses.get(o.brep);
  if (m === undefined) { try { m = massPropertiesOf(o, ALUMINIUM); } catch { m = null; /* no positive volume */ } masses.set(o.brep, m); }
  return m;
}
/** The pending kernel outputs by B-rep (the free mass function reads each output). */
const pendingOutputs = new WeakMap<Brep, CadPartOutput>();
function deferredRef(o: CadPartOutput): number {
  let r = refOfBrep.get(o.brep);
  if (r === undefined) { r = nextMassRef++; refOfBrep.set(o.brep, r); massRefs.set(r, new WeakRef(o.brep)); pendingOutputs.set(o.brep, o); }
  // (Refs whose B-rep is gone are dropped now and then, not on every body.)
  if ((r & 255) === 0) for (const [k, w] of massRefs) if (!w.deref()) massRefs.delete(k);
  return r;
}
/**
 * A deferred body's mass fields, as the evaluation would have given them (its placements applied, `massPlace`), or
 * undefined when its B-rep is gone.
 */
export function massOfRef(ref: number, place: readonly { m: readonly number[]; t: readonly number[] }[] = []): Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'> | undefined {
  const brep = massRefs.get(ref)?.deref(), o = brep && pendingOutputs.get(brep);
  return o ? placedMassFields(massFields(massOfBrep(o)), place) : undefined;
}
/** Mass fields worked out unplaced (massOfRef with no placements), moved by a deferred body's `massPlace` (the studio's patch). */
export function placedMassFields<T extends Pick<BodyResult, 'centroid' | 'inertia'>>(f: T, place: readonly { m: readonly number[]; t: readonly number[] }[]): T {
  let out = f;
  for (const p of place) out = { ...out, ...placedMass(out, p.m, p.t) };
  return out;
}
// (The surface area, once a B-rep: the kernel's over its exact surfaces, null where it cannot.)
const areas = new WeakMap<Brep, number | null>();
function meshOf(brep: Brep, revision: number, quality: number): DisplayMesh {
  let byQuality = meshes.get(brep); if (!byQuality) meshes.set(brep, byQuality = new Map());
  let m = byQuality.get(quality); if (!m) byQuality.set(quality, m = bodyMesh(brep, revision, quality));
  if (sharing) return m;
  return { ...m, positions: m.positions.slice(), normals: m.normals.slice(), faceOfVertex: m.faceOfVertex.slice(), indices: m.indices.slice(), edgeLines: m.edgeLines.slice(), edgeOfSegment: m.edgeOfSegment.slice() };
}
/** The body's area fields: the kernel's exact area, else the display mesh's triangles, labelled. */
function areaOf(A: number | null, brep: Brep, revision: number, quality: number): { area: number; areaBasis: 'exact' | 'display mesh' } {
  if (A !== null) return { area: A, areaBasis: 'exact' };
  return { area: meshOf(brep, revision, quality).faces.reduce((t, f) => t + f.area, 0), areaBasis: 'display mesh' };
}
/** A sheet body's fields but its notes (those go in the body's one list). */
function sheetFields(s: ReturnType<typeof sheetOf>): Omit<ReturnType<typeof sheetOf>, 'notes'> { const out = { ...s }; delete out.notes; return out; }
/** The lumps that touch, once a B-rep (O8), found on its display mesh: the field, or nothing when none do. */
const touches = new WeakMap<Brep, { lumpTouch?: [number, number][] }>();
function touchField(brep: Brep, mesh: DisplayMesh): { lumpTouch?: [number, number][] } {
  let t = touches.get(brep);
  if (!t) { const pairs = lumpTouches(mesh); t = pairs.length ? { lumpTouch: pairs } : {}; touches.set(brep, t); }
  return t;
}
/** A body's evaluated result: its mesh, and its volume, mass, centroid and inertia when it has a volume. */
function bodyOf(o: CadPartSnapshot['outputs'][number], doc: StudioDoc, revision: number, quality: number, counts?: Map<ModelNode, number>): BodyResult {
  // (O18: a member's cut piece needs its volume, so a member's mass is never deferred.)
  const known = masses.get(o.brep), defer = deferring && known === undefined && !o.member;
  const m = defer ? null : massOfBrep(o);
  let A = areas.get(o.brep);
  if (A === undefined) { try { A = brepSurfaceArea(o.brep); if (!Number.isFinite(A)) A = null; } catch { A = null; } areas.set(o.brep, A); }
  const mass = defer ? { volume: null, mass: null, massRef: deferredRef(o) } : massFields(m);
  const at = keyed(o.id, doc.nodes), lib = at.ref ? doc.nodes[at.ref.node] : undefined;
  // (A library part: where it comes from, and its estimates and caveats, on the body.)
  const libNotes = lib?.kind === 'library' ? [{ text: `From ${lib.library.library} ${lib.library.version}: ${lib.library.part}${lib.library.variant ? ` (${lib.library.variant})` : ''}` }, ...lib.warnings.map(text => ({ text, warning: true })), ...fastenerLinkNotes(lib.library, fastenerSizesOf(doc)).map(text => ({ text, warning: true }))] : null;
  const inner = o.brep.bodies.reduce((n, body) => n + (body.kind === 'solid' ? Math.max(0, body.shells.length - 1) : 0), 0);
  // (Every source's notes, in one list: a library part's and a member's, a gear's and its mesh's … — O142: before, a later
  // source's replaced an earlier one's.)
  const node = at.ref ? doc.nodes[at.ref.node] : undefined, sheet = o.sheet ? sheetOf(o) : null;
  const notes: NonNullable<BodyResult['notes']> = [
    ...(libNotes ?? []),
    ...(o.gear ? [...gearNotes(o.gear), ...meshNotes(o.gearPlacement)] : []),
    ...(o.internalGear ? internalGearNotes(o.internalGear, node) : []),
    ...(o.worm ? [...wormNotes(o.worm), ...wormMeshNotes(o.wormPlacement)] : []),
    ...(o.wormWheel ? wormWheelNotes(o.wormWheel) : []),
    ...(o.spring ? springNotes(o.spring) : []),
    ...(o.cam ? camNotes(o.cam) : []),
    ...(o.sprocket || o.pulley || o.belt || o.coupling ? driveNotes(o) : []),
    ...(o.connector ? connectorNotes(o.connector) : []),
    ...(o.gusset ? gussetNotes(o.gusset) : []),
    ...(o.endCap ? endCapNotes(o.endCap) : []),
    ...(o.bead ? beadNotes(o.bead) : []),
    ...(o.connectorBody ? [{ text: `Connector body for ${o.connectorBody.row}: seated in its opening, touching nothing of the panel (overlap ${+o.connectorBody.overlap.toFixed(6)} mm³, by the Boolean); an envelope only` }] : []),
    ...(o.shaft ? shaftNotes(o.shaft) : []),
    ...(o.key || o.keyway || o.ring || o.pin ? shaftPartNotes(o) : []),
    ...(o.bearing ? bearingNotes(o.bearing) : []),
    ...(o.gland ? glandNotes(o.gland) : []),
    ...(o.oring ? [{ text: `O-ring ${o.oring.ring}, its section ${+o.oring.stretchedCrossSection.toFixed(4)} stretched; the free ring overlaps what squeezes it by ${+o.oring.overlap.toFixed(4)} mm³ (the squeeze's displaced volume, by the Boolean); its squeezed shape is not modelled`, warning: false }] : []),
    ...(o.bevelGear ? [...bevelGearNotes(o.bevelGear, node), ...bevelMeshNotes(o.bevelGearPlacement)] : []),
    ...(o.rack ? [...rackNotes(o.rack), ...rackMeshNotes(o.rackPlacement)] : []),
    ...(o.subd && o.subd.caps ? subdNotes(o.subd) : []),
    ...(o.decimate ? decimateNotes(o.decimate) : []),
    ...(sheet?.notes ?? []),
    ...(o.member ? memberNotes(o.member, lib ?? node, doc.frames?.sections, doc.nodes, at.ref ? staleOf(doc).get(at.ref.node) : undefined, counts) : []),
  ];
  const element = elementOf(o, node);
  return { ...at, ...(notes.length ? { notes } : {}), ...(roleOf(lib) ? { role: roleOf(lib) } : {}), innerShells: inner, family: o.representation, mesh: meshOf(o.brep, revision, quality), ...mass, ...areaOf(A, o.brep, revision, quality), ...(o.bodyCount > 1 ? { pieces: o.bodyCount, ...touchField(o.brep, meshOf(o.brep, revision, quality)) } : {}),
    ...(o.gearPlacement ? { gear: o.gearPlacement } : {}), ...(o.bevelGear?.idealModel ? { idealModel: o.bevelGear.diagnostics.find(x => x.code === 'IDEAL_MODEL')?.message ?? 'an ideal model' } : {}), ...(o.rackPlacement ? { rack: o.rackPlacement } : {}),
    ...(o.subd && o.subd.caps ? { subd: o.subd } : {}), ...(sheet ? sheetFields(sheet) : {}), ...(o.member && m ? { cutPiece: cutPiece(o, { volume: m.volume }) } : {}), ...(element ? { element } : {}) };
}

/** The main part's evaluation profiles its features (O10; a reused snapshot keeps the option). */
const PROFILED = { profile: true } as const;
function snapshotOf(doc: StudioDoc): CadPartSnapshot {
  return partSnapshot(doc, part => last ? reevaluate(last, { document: part }) : evaluateCadPart(part, undefined, PROFILED));
}
const rebuildOf = (s: CadPartSnapshot): RebuildData | undefined => s.profile && { evaluated: s.recomputation.evaluated, reused: s.recomputation.reused, profile: s.profile };

/** A failed evaluation: its refusal in words, and the time it took (every evaluation's catch). */
function failed(revision: number, cause: unknown, t0: number): EvalResult {
  return { ok: false, revision, error: friendlyCause(cause), ms: performance.now() - t0 };
}
/** A part's bodies from its snapshot, its face table remembered (evaluateDoc's and evaluatePart's one path; R4 C3). */
function partResult(doc: StudioDoc, snapshot: CadPartSnapshot, revision: number, quality: number, shopRows: readonly ShopTreeProvenance[], t0: number): Extract<EvalResult, { ok: true }> {
  const counts = new Map<ModelNode, number>(); // (each frame's member count once this evaluation)
  const bodies: BodyResult[] = withFitNotes(snapshot.outputs.map(o => bodyOf(o, doc, revision, quality, counts)), doc, snapshot.outputs);
  const faceTable = faceTableFrom(snapshot.outputs); rememberFaceTable(doc, faceTable);
  return { ok: true, revision, bodies, ms: performance.now() - t0, faceTable, shopRows };
}
/** The document with its parameter-bound skeletons solved for its parameters now (O140; the same document when none moved); their refusal thrown. */
function skeletonsNow(doc: StudioDoc): StudioDoc { return resolveSkeletons(doc).doc; }
export function evaluateDoc(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const shopRows = provenanceOfTree(doc);
  const t0 = performance.now();
  try {
    doc = skeletonsNow(doc);
    const snapshot = snapshotOf(doc); last = snapshot;
    return { ...partResult(doc, snapshot, revision, quality, shopRows, t0), rebuild: rebuildOf(snapshot) };
  } catch (cause) {
    return failed(revision, cause, t0);
  }
}
/**
 * The part built from nothing with its features profiled (O10, query.rebuild): no snapshot reused, the main one left as
 * it is — each feature's whole cost. Only the rebuild comes back (no bodies are worked out).
 */
export function rebuildFromScratch(doc: StudioDoc, revision: number): EvalResult {
  const t0 = performance.now();
  try {
    const snapshot = partSnapshot(skeletonsNow(doc), part => evaluateCadPart(part, undefined, PROFILED));
    return { ok: true, revision, bodies: [], ms: performance.now() - t0, rebuild: rebuildOf(snapshot) };
  } catch (cause) {
    return failed(revision, cause, t0);
  }
}
/** The bodies with their fits' notes (R12c.2, D155; throws a fit's refusal). */
function withFitNotes(bodies: BodyResult[], doc: StudioDoc, outputs: CadPartSnapshot['outputs']): BodyResult[] {
  if (!doc.fits?.faces?.length) return bodies;
  const notes = fitNotes(doc, outputs);
  return bodies.map((b, i) => { const n = notes.get(outputs[i].id); return n ? { ...b, notes: [...(b.notes ?? []), ...n] } : b; });
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
    const last = lastPreview[slot], snapshot = partSnapshot(doc, part => last ? reevaluate(last, { document: part }) : evaluateCadPart(part, undefined, PREVIEW)); lastPreview[slot] = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => ({ ...keyed(o.id, doc.nodes), family: o.representation, mesh: meshOf(o.brep, revision, quality), volume: null, mass: null }));
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    lastPreview[slot] = null;
    return failed(revision, cause, t0);
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
  const shopRows = provenanceOfTree(doc);
  const t0 = performance.now();
  try {
    doc = skeletonsNow(doc);
    const last = lastParts.get(slot), snapshot = partSnapshot(doc, part => last ? reevaluate(last, { document: part }) : evaluateCadPart(part)); lastParts.set(slot, snapshot);
    return partResult(doc, snapshot, revision, quality, shopRows, t0);
  } catch (cause) {
    return failed(revision, cause, t0);
  }
}
/** A part's bodies' volumes only (a clash probe's intersection): no mesh worked out or sent (PERF3 B12). */
export function evaluateVolumes(doc: StudioDoc, slot: PartSlot = 'probe'): { ok: true; volumes: { key: string; volume: number | null }[] } | { ok: false; error: FriendlyError } {
  try {
    doc = skeletonsNow(doc);
    const last = lastParts.get(slot), snapshot = partSnapshot(doc, part => last ? reevaluate(last, { document: part }) : evaluateCadPart(part)); lastParts.set(slot, snapshot);
    return { ok: true, volumes: snapshot.outputs.map(o => {
      let m = masses.get(o.brep);
      if (m === undefined) { try { m = massPropertiesOf(o, ALUMINIUM); } catch { m = null; } masses.set(o.brep, m); }
      return { key: bodyKeyOf(o.id, doc.nodes), volume: m ? m.volume : null };
    }) };
  } catch (cause) { return { ok: false, error: friendlyCause(cause) }; }
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
    const snapshot = partSnapshot(placed, part => lastPlaced ? reevaluate(lastPlaced, { document: part }) : evaluateCadPart(part)); lastPlaced = snapshot;
    const origin = partSnapshot(base, part => lastBase ? reevaluate(lastBase, { document: part }) : evaluateCadPart(part)); lastBase = origin;
    const bodies = snapshot.outputs.map(o => {
      // Weld records make derived bodies after placedDoc's authored transform nodes. They still need the
      // instance placement; use the exact origin output by id, rather than treating it as a moved member.
      if (o.bead) {
        const bead = origin.outputs.find(x => x.id === o.id && x.bead);
        if (!bead) throw new Error(`placed bead ${o.id} has no origin body`);
        return placeBody(bodyOf(bead, base, revision, quality), place.m, place.t);
      }
      // (O10: a copy's body is keyed by its origin output — the instance's own document, unplaced — never by the
      // transform nodes placedDoc appends, so the key is the same for every producer and whatever the placement.)
      const at = originOutput(o.id, origin, placed, base);
      if (!at || origin.outputs.length !== snapshot.outputs.length || !samePlacedBody(o.brep, at.brep, place.m, place.t)) return { ...bodyOf(o, placed, revision, quality), ...(at ? keyed(at.id, base.nodes) : {}) };
      return placeBody(bodyOf(at, base, revision, quality), place.m, place.t);
    });
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return failed(revision, cause, t0);
  }
}
let lastBase: CadPartSnapshot | null = null, lastPlaced: CadPartSnapshot | null = null;
/**
 * The origin output a placed output is (O10): the one its chain of placement transforms (the nodes placedDoc appends past
 * the base's) leads back to — none appended, its own node; none when it leads to no origin output.
 */
function originOutput(id: string, origin: CadPartSnapshot, placed: StudioDoc, base: StudioDoc): CadPartSnapshot['outputs'][number] | undefined {
  const at = originNode(id, placed, base);
  return at === undefined ? undefined : origin.outputs.find(x => bodyNodeOf(base.nodes, bodyKeyOf(x.id, base.nodes))?.node === at);
}
/** The base node a placed output comes from: its top node, walked back through the placement transforms past the base's. */
function originNode(id: string, placed: StudioDoc, base: StudioDoc): number | undefined {
  let at = bodyNodeOf(placed.nodes, bodyKeyOf(id, placed.nodes))?.node;
  while (at !== undefined && at >= base.nodes.length) { const n = placed.nodes[at] as { parent?: { node: number } }; at = n.parent?.node; }
  return at;
}
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
  const element = b.element?.kind === 'weld-bead' ? { ...b.element, report: { ...b.element.report,
    sharedSeams: b.element.report.sharedSeams.map(s => ({ ...s, path: [move(m, t, s.path[0]), move(m, t, s.path[1])] as const })) } } : b.element;
  return { ...b, mesh, ...placedMass(b, m, t), ...(b.massRef !== undefined ? { massPlace: [...(b.massPlace ?? []), { m: [...m], t: [...t] }] } : {}), ...(element ? { element } : {}) };
}
/** A body's centre of mass moved and its inertia turned by a placement (what it has of them). */
function placedMass(b: Pick<BodyResult, 'centroid' | 'inertia'>, m: readonly number[], t: readonly number[]): Pick<BodyResult, 'centroid' | 'inertia'> {
  const R = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
  const inertia = b.inertia ? R.map((_, i) => R.map((__, j) => { let v = 0; for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += R[i][k] * b.inertia![k][l] * R[j][l]; return v; })) : undefined;
  return { ...(b.centroid ? { centroid: move(m, t, b.centroid) } : {}), ...(inertia ? { inertia } : {}) };
}

/** The part's bodies as B-reps, keyed as the studio keys them (for exact views: chat/views.ts). */
export function partBreps(doc: StudioDoc): { key: string; brep: Brep }[] {
  return snapshotOf(doc).outputs.map(o => ({ key: bodyKeyOf(o.id, doc.nodes), brep: o.brep }));
}

/** How a StudioDoc is written as STEP: the file's name; how mesh bodies are written (R3.5); the file's time. */
export interface StudioStepOptions {
  name: string;
  /** auto, tessellated or planar (STEP export option, R3.5). */
  meshes?: 'auto' | 'tessellated' | 'planar';
  /** The file's time (ISO 8601, seconds), so a test or a doc writes the same bytes each time; left out: now (R7 finding). */
  timestamp?: string;
}
/** A StudioDoc's STEP file: its text, the source revision it names (O9), and what was left out. */
export interface StudioStep { text: string; source: string; omitted?: string[] }
/**
 * The part (and its shown instances) as one STEP file (R7.3c: the model level's one STEP function; the kernel's is
 * exportStep(breps, options)). Bodies with the `infill` role (O60: a print lattice) are left out — STEP stays the exact
 * part — and `omitted` says so; 3MF and the mass keep them. No body to write is refused (NO_BODY); the kernel's own
 * refusal while writing is passed through.
 */
export function exportStudioStep(doc: StudioDoc, options: StudioStepOptions): StudioStep {
  const { name, meshes } = options;
  const breps: Brep[] = [], left: string[] = [];
  const take = (d: StudioDoc, outputs: CadPartSnapshot['outputs'], prefix: string) => {
    for (const o of outputs) { const r = keyed(o.id, d.nodes).ref; if (r && roleOf(d.nodes[r.node])) left.push(`${prefix}${bodyKeyOf(o.id, d.nodes)}`); else breps.push(o.brep); }
  };
  take(doc, snapshotOf(doc).outputs, '');
  // (O10: a copy's body by its origin node — its role and key the instance's own, not a placement transform's.)
  for (const inst of doc.instances ?? []) if (!inst.hidden) {
    const placed = placedDoc(inst, doc), base = placedBase(inst, doc);
    for (const o of placedOutputs(inst, placed, doc)) {
      const at = originNode(o.id, placed, base);
      if (at !== undefined && roleOf(base.nodes[at])) left.push(`${inst.id}/${bodyKeyFor(base.nodes, at)}`); else breps.push(o.brep);
    }
  }
  if (!breps.length) throw refusal('NO_BODY', left.length ? 'Only infill bodies: STEP carries the exact part, and there is none to export.' : 'There is no body to export.');
  // (O9: the header names the source revision the file was made from.)
  const source = revisionOf(doc), text = exportStep(breps, { name, description: ['BaroCSS CAD part', `source revision ${source}`], ...(meshes ? { meshes } : {}), ...(options.timestamp ? { timestamp: options.timestamp } : {}) });
  return left.length ? { text, source, omitted: [`lattice infill not included (${left.join(', ')}); 3MF carries it`] } : { text, source };
}

export function stlFor(doc: StudioDoc, key: string): Uint8Array | null {
  try {
    const output = snapshotOf(doc).outputs.find(o => bodyKeyOf(o.id, doc.nodes) === key);
    return output ? exportStl(output) : null;
  } catch { return null; }
}

/**
 * The part's visible bodies and its shown instances' as B-reps (for drawings), with a name prefix for
 * each (an instance's `<id>/`, so its edges are told apart), or the reason they cannot be evaluated.
 */
/** The part's machine elements, by node (O144 S3: what the drawing's callouts read without the bodies). */
export function partElements(doc: StudioDoc): { node: number; element: BodyElement }[] {
  try {
    const out: { node: number; element: BodyElement }[] = [];
    for (const o of snapshotOf(skeletonsNow(doc)).outputs) { const at = keyed(o.id, doc.nodes), e = elementOf(o, at.ref ? doc.nodes[at.ref.node] : undefined); if (e && at.ref) out.push({ node: at.ref.node, element: e }); }
    return out;
  } catch { return []; }
}
/** The part's outputs that are bought elements, by the BOM's rule (boughtOf): a key, a bearing, an O-ring… (O174). */
export function boughtOutputIds(doc: StudioDoc): Set<string> {
  const out = new Set<string>();
  for (const o of snapshotOf(doc).outputs) { const at = keyed(o.id, doc.nodes), node = at.ref ? doc.nodes[at.ref.node] : undefined; if (node && boughtOf(node, elementOf(o, node)).bought) out.add(o.id); }
  return out;
}
/** The part's own bodies' face names by body key (O177), from their B-reps: a balloon of a `base:<body>` BOM line finds its edges. */
export function baseBodyFaces(doc: StudioDoc): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const o of snapshotOf(doc).outputs) {
    const names = new Set<string>();
    for (const f of o.brep.faces) names.add((f.name ?? f.id).replace(/#\d+$/, ''));
    out[keyed(o.id, doc.nodes).key] = [...names];
  }
  return out;
}
/**
 * The B-reps a drawing projects. `made` (O174, a part's drawing): what the part makes — its bought elements left out, as
 * DFM, print and CAM leave them (O160), so no line, hole or hidden edge of a bearing or a key is the part's; all of
 * them when nothing else is left. An assembly's drawing keeps its bought parts.
 */
export function brepsFor(doc: StudioDoc, options: { made?: boolean } = {}): { breps: Brep[]; prefixes: string[] } | { error: string } {
  try {
    const all = snapshotOf(doc).outputs, bought = options.made ? boughtOutputIds(doc) : null, own = bought && all.some(x => !bought.has(x.id)) ? all.filter(x => !bought.has(x.id)) : all;
    const breps = own.map(x => x.brep), prefixes = breps.map(() => '');
    for (const inst of doc.instances ?? []) if (!inst.hidden) for (const o of placedOutputs(inst, placedDoc(inst, doc), doc)) { breps.push(o.brep); prefixes.push(`${inst.id}/`); }
    return { breps, prefixes };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}

/**
 * Each placed part's last snapshots (as placed, and at the origin for its beads), by instance id (R4 C4): exportStudioStep and
 * brepsFor build a copy again through the kernel's withDocument, which reuses only the features whose inputs are
 * unchanged — as the main evaluation does — so an unchanged copy is not evaluated from nothing on every export.
 */
const placedKept = new Map<string, { placed: CadPartSnapshot; origin?: CadPartSnapshot }>();
/** Forget the placed parts' snapshots (tests: an export from nothing to compare the reused one with). */
export function forgetPlacedOutputs(): void { placedKept.clear(); }
/** Forget every kept snapshot — the main part's, the previews', the other parts', the placed parts' (tests: an evaluation from nothing, O11's oracle). */
export function forgetSnapshots(): void { last = null; lastPreview.preview = null; lastPreview.section = null; lastParts.clear(); lastBase = null; lastPlaced = null; placedKept.clear(); }
/** Exact derived bead B-reps receive the same instance placement as the display path. No partition is recomputed. */
function placedOutputs(inst: PartInstance, placed = placedDoc(inst), parent?: StudioDoc): CadPartSnapshot['outputs'] {
  const kept = placedKept.get(inst.id);
  const snapshot = partSnapshot(placed, part => kept ? reevaluate(kept.placed, { document: part }) : evaluateCadPart(part)), outputs = snapshot.outputs;
  if (!outputs.some(o => o.bead)) { placedKept.set(inst.id, { placed: snapshot }); return outputs; }
  const base = placedBase(inst, parent), origin = partSnapshot(base, part => kept?.origin ? reevaluate(kept.origin, { document: part }) : evaluateCadPart(part)), { m, t } = placementOf(inst);
  placedKept.set(inst.id, { placed: snapshot, origin });
  return outputs.map(o => {
    if (!o.bead) return o;
    const bead = origin.outputs.find(x => x.id === o.id && x.bead);
    if (!bead) throw new Error(`placed bead ${o.id} has no origin body`);
    return { ...o, brep: transformBrep(bead.brep, { matrix: m as [number, number, number, number, number, number, number, number, number], offset: t }) };
  });
}
