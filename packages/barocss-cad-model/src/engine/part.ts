import { resolveShopTree } from './shopRows';
// The studio document as a kernel part document: a node is the feature of its stable id (`n<k>`, see ids.ts),
// so persistent face and edge names read `n1.side0`, `n1.top`, `n2.side0|n1.top` and keep their names as other
// features come and go; a kernel output `n5` / `n5/0` / `n5/1` is the studio body `b5` / `b5_negative` /
// `b5_positive` (keyed by the id too); the solids of a STEP file holding several are `n5/k`, `b5_part<k>`.
import type { BearingRow, ChainRow, ConnectorRow, DriveRow, FitTable, ORingRow } from '@barocss/cad';
import { getBlob } from './blobs';
import { CadPartError, evaluateCadPart, type CadPartSnapshot, type BearingReport } from '@barocss/cad';
import { bearingContextOf, bearingDependencyKey, bearingHousingRef, bearingHousingTarget, withBearingContext } from './bearingContext';
import { bearingInExternalHousing } from './bearingHousing';
import { mirrorCage, sprocketPitchDiameter, timingPitchDiameter } from '@barocss/cad';
import type { BendTable, BeadSharedComponent, CadPartDocument, CadPartFeature, CadPartFrameOverride, CadPartNameSignature, CadPartSection } from '@barocss/cad';
import type { Sig } from './references';
import { frameGeometry, holeCentres, bevelSpiral, prefixDoc, type SketchNode, type BodyRef, type FrameOverride, type InlineSection, type MemberSection, type ModelNode, type PartInstance, type StudioDoc } from './doc';
import { bodyNodeOf, featureId, nodeIndexOf, serialOf, withIds } from './ids';
import { keyClasses } from './fits';
import type { StudioRingRow } from './rings';
import { rotationSteps } from './placement';
import { documentBeadOwnershipError } from '../frames/beadOwnership';
import { canonical, modelContent } from '../util/revision';
import { resolveSkeletons, SKELETON_CODES } from '../frames/skeleton';
import { isRefusal, refusal } from './refusal';
import { assertRouteBundleDocument } from './routeBundle';
import { bodyMesh } from './mesh';
import { faceProfile } from '../app/faceProfile';
import { sketchShapes } from '../sketch/reopen';
import { offsetShape } from '../sketch/offset';
import { profileOf } from '../sketch/loops';

// (The nodes being converted: a feature's id and its references' ids are read from them.)
let current: readonly ModelNode[] = [];
// (FRc, O117: the document's section library, by id, that a frame's library section resolves from.)
let library: ReadonlyMap<string, InlineSection> = new Map();
/**
 * A belt's or chain's feature from its two wheels (R12c.6b, D161): each a sprocket or a pulley of the belt's row, their
 * pitch radii (a sprocket p/(2 sin(π/z)); a timing pulley pz/(2π); a V pulley its datum; a flat one its face plus half the
 * belt's thickness, the belt's centre line), the first's centre the band's, turned toward the second; the band across the
 * wheel's width where the belt runs (centred on a sprocket's or a flat face, in a V pulley's first groove).
 */
export function beltFeature(node: Extract<ModelNode, { kind: 'belt' }>, row: DriveRow): Record<string, unknown> {
  const wheel = (i: number) => {
    const w = current[i];
    if (!w || (w.kind !== 'sprocket' && w.kind !== 'pulley')) throw refusal('DRIVE_WHEELS', `a belt runs on two sprockets or pulleys: feature ${i + 1} is ${w ? `a ${w.kind}` : 'missing'}`);
    if (w.row !== row.id) throw refusal('DRIVE_WHEELS', `the ${row.kind} ${row.id} runs on wheels of its row: feature ${i + 1} is for ${w.row}`);
    return w;
  };
  const a = wheel(node.wheels[0]), b = wheel(node.wheels[1]);
  if ((a.from ?? 0) !== (b.from ?? 0)) throw refusal('DRIVE_WHEELS', `the wheels stand at Z ${a.from ?? 0} and ${b.from ?? 0}: a belt runs on wheels in one plane`);
  const R = (w: typeof a): number => w.kind === 'sprocket' ? sprocketPitchDiameter((row as ChainRow).pitch, w.teeth) / 2
    : row.kind === 'timing-belt' ? timingPitchDiameter(row.pitch, w.teeth ?? 0) / 2 : row.kind === 'flat-belt' ? (w.diameter ?? 0) / 2 + row.thickness / 2 : (w.diameter ?? 0) / 2;
  const dx = b.center[0] - a.center[0], dy = b.center[1] - a.center[1], C = Math.hypot(dx, dy);
  const across = a.kind === 'sprocket' ? a.width : a.width ?? 0;
  const width = row.kind === 'chain' ? row.innerWidth ?? Math.min(5, across) : row.kind === 'flat-belt' ? row.width : row.kind === 'v-belt' ? row.datumWidth : across;
  const z = (a.from ?? 0) + (row.kind === 'v-belt' ? row.edge - width / 2 : Math.max(0, (across - width) / 2));
  return { kind: 'belt', row, pitchRadii: [R(a), R(b)], centerDistance: C, ...(node.rounding ? { rounding: node.rounding } : {}), width, center: a.center, ...(z ? { from: z } : {}), ...(dx || dy ? { rotation: Math.atan2(dy, dx) * 180 / Math.PI } : {}), generator: node.generator };
}
/** The document's bearing rows and fit tables (R12c.4: a bearing's row and its seats' classes inline in its feature). */
let bearingRows: ReadonlyMap<string, BearingRow> = new Map(), fitTables: readonly FitTable[] = [], fitFaces: readonly { face: string; class: string }[] = [], ringRows: ReadonlyMap<string, StudioRingRow> = new Map(), oringRows: ReadonlyMap<string, ORingRow> = new Map(), driveRows: ReadonlyMap<string, DriveRow> = new Map(), connectorRows: ReadonlyMap<string, ConnectorRow> = new Map();
// (FRf, O121: the parameters' values, for a frame following a sketch — its points lifted as numbers.)
let params: Readonly<Record<string, number>> = {};
// (FRf2, O125: the assembly's placed parts, for a base frame following a part's sketch.)
let partsNow: readonly PartInstance[] = [];
const id = (index: number) => featureId(current, index);
const ref = (r: BodyRef) => r.side === 'negative' ? `${id(r.node)}/0` : r.side === 'positive' ? `${id(r.node)}/1` : r.side.startsWith('part') ? `${id(r.node)}/${r.side.slice(4)}` : id(r.node);

/** A sheet node's K, as the kernel takes it: its K-factor or its bend table (R12.4). */
const sheetK = (n: { kFactor?: number; bendTable?: BendTable }) => (n.bendTable ? { bendTable: n.bendTable } : { kFactor: n.kFactor! }) as { kFactor: number } | { bendTable: BendTable };
/** One node as a kernel feature (`nodes`: the document's, for its ids; without them node i is `n<i>`). */
/** A member section for the kernel: a sketch section's node index as its feature id (FR2, D124). */
/** A library section is its row's (FRc): a row the library does not hold (deleted, renamed) is refused, typed — never a fallback. */
const kernelSection = (s: MemberSection, toId: (i: number) => string): CadPartSection => s.kind === 'sketch' ? { kind: 'sketch', sketch: toId(s.sketch) } : s.kind === 'library' ? libraryRow(s.id) : s;
function libraryRow(rowId: string): CadPartSection {
  const row = library.get(rowId);
  if (row) return row;
  throw refusal('FRAME_SECTION_UNKNOWN', `a frame's section names the library row "${rowId}", which the document's section library does not hold (rows: ${[...library.keys()].join(', ') || 'none'})`);
}
/** A frame's override for the kernel: its sketch section by feature id. */
function kernelOverride(o: FrameOverride): CadPartFrameOverride { const { section, ...rest } = o; return { ...rest, ...(section ? { section: kernelSection(section, id) } : {}) }; }

/**
 * O19 (the kernel's D277): what each stored name of a fillet, chamfer, shell or draft looked like when it was picked
 * (`node.sigs`, engine/references.ts), for the kernel to check what the name builds on now: a name that moved to other
 * geometry is refused (REFERENCE_MOVED), never built on another edge or face. Only the names the feature uses go, and
 * only those whose signature is their own: one taken from a display edge or face that carried several of the kernel's
 * names (`n`: a closed rim of several edges, merged faces) describes them together — the kernel's piece is elsewhere
 * on it — so it goes unchecked rather than refuse a good fillet (R10.2a's tee).
 */
function expectOf(node: { sigs?: Record<string, Sig> }, names: readonly string[]): { expect?: Record<string, CadPartNameSignature> } {
  const sigs = node.sigs; if (!sigs) return {};
  let out: Record<string, CadPartNameSignature> | undefined;
  for (const name of names) {
    const s = sigs[name]; if (!s || (s.n ?? 1) > 1) continue;
    (out ??= {})[name] = { kind: s.k as CadPartNameSignature['kind'], at: s.p, dir: s.d ?? null, size: s.s, ...(s.r !== undefined ? { radius: s.r } : {}) };
  }
  return out ? { expect: out } : {};
}
export function featureOf(node: ModelNode, index: number, nodes?: readonly ModelNode[]): CadPartFeature {
  if (Object.prototype.hasOwnProperty.call(node, 'routeBundleMember')) throw refusal('BAD_REFERENCE', 'Route bundle: linked sweep nodes require document validation before kernel conversion.');
  if (nodes) current = nodes;
  const at = { id: id(index) };
  switch (node.kind) {
    // (FRf: a skeleton makes no feature — toPartDocument leaves it out; frames on it take its points.)
    case 'skeleton': throw new Error('a skeleton makes no kernel feature');
    // The drawn outline and its constraints are the studio's own (the kernel takes the solved profile).
    case 'sketch': {
      if (node.association !== undefined) throw associationError('linked sketches require document-prefix resolution before kernel conversion.');
      const profile = { ...node }; delete profile.outline; delete profile.on; delete profile.construction; delete profile.association;
      return { ...at, ...profile } as CadPartFeature;
    }
    case 'extrude': return { ...at, kind: 'extrude', sketch: id(node.sketch), height: node.height, ...(node.from === undefined ? {} : { from: node.from }), ...(node.draft ? { draft: node.draft } : {}) };
    case 'revolve': return { ...at, kind: 'revolve', sketch: id(node.sketch), axis: { origin: node.origin ?? [0, 0], direction: node.dir ?? node.axis }, angle: node.angle };
    case 'union': case 'intersect': return { ...at, kind: node.kind, target: ref(node.left), tool: ref(node.right) };
    case 'difference': return { ...at, kind: 'difference', target: ref(node.parent), tool: ref(node.tool) };
    case 'rib': return { ...at, kind: 'rib', target: ref(node.parent), min: structuredClone(node.min), max: structuredClone(node.max) };
    case 'rectangular-relief': return { ...at, kind: 'rectangular-relief', target: ref(node.parent), min: structuredClone(node.min), max: structuredClone(node.max), depth: structuredClone(node.depth), mode: node.mode };
    case 'hole': return { ...at, kind: 'hole', target: ref(node.parent), center: node.center, radius: node.radius,
      ...(node.axis ? { axis: node.axis } : {}), ...(node.side ? { side: node.side } : {}), ...(node.depth === undefined ? {} : { depth: node.depth }), ...(node.countersink ? { countersink: node.countersink } : {}), ...(node.face ? { face: node.face } : {}) };
    case 'translate': return { ...at, kind: 'translate', target: ref(node.parent), offset: node.offset };
    case 'rotate': return { ...at, kind: 'rotate', target: ref(node.parent), axis: node.axis, angle: node.angle, ...(node.pivot ? { pivot: node.pivot } : {}) };
    // Studio mirrors keep the original, as a mirror copy beside it.
    case 'mirror': return { ...at, kind: 'mirror', target: ref(node.parent), plane: node.plane, keep: true };
    case 'scale': return { ...at, kind: 'scale', target: ref(node.parent), factor: node.factor, ...(node.pivot ? { pivot: node.pivot } : {}) };
    case 'linear-pattern': return { ...at, kind: 'linear-pattern', target: ref(node.parent), axis: node.axis, spacing: node.spacing, count: node.count };
    case 'linear-feature-pattern': return { ...at, kind: 'linear-feature-pattern', target: ref(node.parent), axis: node.axis, spacing: node.spacing, count: node.count };
    case 'circular-pattern': return { ...at, kind: 'circular-pattern', target: ref(node.parent), axis: node.axis, angle: node.angle, count: node.count, ...(node.pivot ? { pivot: node.pivot } : {}) };
    case 'split': return { ...at, kind: 'split', target: ref(node.parent), ...(node.normal ? { normal: node.normal } : { axis: node.axis }), at: node.at };
    case 'separate': return { ...at, kind: 'separate', target: ref(node.parent) };
    case 'decimate': return { ...at, kind: 'decimate', target: ref(node.parent), ...(node.ratio !== undefined ? { ratio: node.ratio } : {}), ...(node.triangles !== undefined ? { triangles: node.triangles } : {}), ...(node.maxError !== undefined ? { maxError: node.maxError } : {}), ...(node.featureAngle !== undefined ? { featureAngle: node.featureAngle } : {}) };
    case 'sweep': return { ...at, kind: 'sweep', sketch: id(node.sketch), path: node.path };
    case 'sweep-curve': return { ...at, kind: 'sweep-curve', sketch: id(node.sketch), path: node.path };
    case 'loft': {
      const framed = Object.hasOwn(node, 'guide') || node.sections.some(s => Object.hasOwn(s, 'frame'));
      return { ...at, kind: 'loft',
        // Keep own presence and malformed values for kernel admission on the framed path.
        sections: node.sections.map(s => ({ ...structuredClone(s), sketch: id(s.sketch) })),
        ...(framed ? (Object.hasOwn(node, 'smooth') ? { smooth: structuredClone(node.smooth) } : {}) : (node.smooth ? { smooth: true } : {})),
        ...(Object.hasOwn(node, 'guide') ? { guide: structuredClone(node.guide) } : {}),
      };
    }
    case 'import': return { ...at, kind: 'import', step: node.step, ...((node.solids ?? 1) > 1 ? { each: true } : {}) };
    case 'mesh': return { ...at, kind: 'mesh', ...meshArrays(node.repair ? { blob: node.repair.result } : node), ...(node.repair ? repaired(node.repair) : {}), ...(node.representation ? { representation: node.representation } : {}), ...((node.pieces ?? 1) > 1 ? { each: true } : {}) };
    case 'thread': return { ...at, kind: 'thread', diameter: node.diameter, pitch: node.pitch, center: node.center, seat: node.seat, ...(node.length !== undefined ? { length: node.length } : {}), ...(node.hex ? { hex: node.hex } : {}), ...(node.form ? { form: node.form } : {}) };
    case 'shell': return { ...at, kind: 'shell', target: ref(node.parent), thickness: node.thickness, open: node.open, ...expectOf(node, node.open) };
    case 'chamfer': return { ...at, kind: 'chamfer', target: ref(node.parent), edges: node.edges, distance: node.distance, ...expectOf(node, node.edges) };
    case 'sheet-base': return { ...at, kind: 'sheet-base', sketch: id(node.sketch), thickness: node.thickness, bendRadius: node.bendRadius, ...sheetK(node), ...(node.reverse ? { reverse: true } : {}) };
    case 'sheet-corner-relief': return { ...at, kind: 'sheet-corner-relief', target: ref(node.parent), corner: node.edges[0], shape: node.shape, size: node.size };
    case 'sheet-flange': return { ...at, kind: 'sheet-flange', target: ref(node.parent), edge: node.edges[0], length: node.length, ...(node.angle !== undefined ? { angle: node.angle } : {}), ...(node.bendRadius !== undefined ? { bendRadius: node.bendRadius } : {}), ...(node.measure ? { measure: node.measure } : {}), ...(node.position ? { position: node.position } : {}), ...(node.offsets ? { offsets: node.offsets } : {}), ...(node.relief ? { relief: node.relief } : {}) };
    case 'frame': {
      const follows = node.follows, followed = follows && !('part' in follows) && 'sketch' in follows ? current[follows.sketch] : undefined;
      if (followed?.kind === 'sketch' && followed.association !== undefined) throw associationError('frames following linked sketches are not supported.');
      const g = frameGeometry(current, node, params, partsNow); if ('code' in g) throw refusal(g.code, g.error);
      return { ...at, kind: 'frame', points: g.points, segments: g.segments, ...(node.bends !== undefined ? { bends: node.bends } : {}), section: kernelSection(node.section, id),
      ...(node.anchor ? { anchor: node.anchor } : {}), ...(node.offset ? { offset: node.offset } : {}), ...(node.roll ? { roll: node.roll } : {}), ...(node.mirror ? { mirror: true } : {}), ...(node.up ? { up: node.up } : {}),
      ...(node.overrides?.length ? { overrides: node.overrides.map(kernelOverride) } : {}), ...(node.corners ? { corners: node.corners } : {}), ...(node.trims?.length ? { trims: node.trims.map(t => 'body' in t ? { member: t.member, end: t.end, body: ref(t.body) } : t) } : {}) }; }
    case 'frame-member': return { ...at, kind: 'frame-member', section: kernelSection(node.section, id), start: node.start, end: node.end,
      ...(node.anchor ? { anchor: node.anchor } : {}), ...(node.offset ? { offset: node.offset } : {}), ...(node.roll ? { roll: node.roll } : {}), ...(node.up ? { up: node.up } : {}) };
    case 'sheet-contour': return { ...at, kind: 'sheet-contour', path: node.path, ...(node.plane ? { plane: node.plane } : {}), side: node.side, width: node.width, thickness: node.thickness, bendRadius: node.bendRadius, ...sheetK(node) };
    case 'thicken': return { ...at, kind: 'thicken', surface: node.surface, thickness: node.thickness, ...(node.side ? { side: node.side } : {}) };
    case 'subd': return { ...at, kind: 'subd', cage: node.mirror ? mirrorCage(node.cage, node.mirror) as typeof node.cage : node.cage };
    // (A library part's own feature: its output passed on under the node's id; its features come before it, featuresOf.)
    case 'library': {
      // (Placed: its output turned and moved, `<prefix>_placed`; added to a body: united with it, as one step.)
      const out = node.placement ? `${node.prefix}_placed` : node.outputs[0];
      return node.addTo ? { ...at, kind: node.cut ? 'difference' : 'union', target: ref(node.addTo), tool: out } : { ...at, kind: 'translate', target: out, offset: [0, 0, 0] };
    }
    case 'rack': {
      const own = node.mesh ? { mesh: { gear: id(node.mesh.gear), ...(node.mesh.direction !== undefined ? { direction: node.mesh.direction } : {}), ...(node.mesh.centerDistance !== undefined ? { centerDistance: node.mesh.centerDistance } : {}), ...(node.mesh.phase ? { phase: node.mesh.phase } : {}) } }
        : { origin: node.origin, ...(node.from ? { from: node.from } : {}), ...(node.angle ? { angle: node.angle } : {}) };
      // (Meshing: the module, helix angle and hand from the gear — the opposite hand; the kernel derives them.)
      return { ...at, kind: 'spur-rack', ...(node.mesh ? {} : { module: node.module }), teeth: node.teeth, faceWidth: node.faceWidth, height: node.height, generator: node.generator, ...own, ...(node.rootFillet !== undefined ? { rootFillet: node.rootFillet } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'internal-gear': {
      // (R12b.2a, D132: an internal gear; a helical one's `module` the normal module.)
      const own = { center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}) };
      const modules = node.helixAngle ? { normalModule: node.module, helixAngle: node.helixAngle, hand: node.hand ?? 'right' } : { module: node.module };
      return { ...at, kind: 'internal-gear', ...modules, teeth: node.teeth, faceWidth: node.faceWidth, rim: node.rim, generator: node.generator, ...(node.cutter ? { cutter: node.cutter } : {}), ...own, ...(node.profileShift ? { profileShift: node.profileShift } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'worm-wheel': {
      // (R12b.6, D137: the throated wheel; its worm by the worm's mesh.)
      return { ...at, kind: 'worm-wheel', worm: { axialModule: node.module, starts: node.starts, diameter: node.diameter, hand: node.hand }, teeth: node.teeth, faceWidth: node.faceWidth, generator: node.generator, center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}),
        ...(node.bore !== undefined ? { bore: node.bore } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'oring-gland': {
      const row = oringRows.get(node.ring);
      if (!row) throw refusal('ORING_ROW_UNKNOWN', `a gland names the O-ring row "${node.ring}", which the document's O-ring rows do not hold (rows: ${[...oringRows.keys()].join(', ') || 'none'})`);
      const fit = node.sealClass || node.grooveClass ? { fit: { tables: fitTables, ...(node.sealClass ? { seal: node.sealClass } : {}), ...(node.grooveClass ? { groove: node.grooveClass } : {}) } } : {};
      return { ...at, kind: 'oring-gland', target: ref(node.parent), face: node.face, gland: node.gland, ring: { id: row.id, ...(row.dash ? { dash: row.dash } : {}), insideDiameter: row.insideDiameter, crossSection: row.crossSection, ...(row.source ? { source: row.source } : {}), ...(row.estimate ? { estimate: true } : {}) },
        groove: { diameter: node.diameter, width: node.width, ...(node.at !== undefined ? { at: node.at } : {}), ...(node.depth !== undefined ? { depth: node.depth } : {}), ...(node.center ? { center: node.center } : {}) }, ...(node.seal !== undefined ? { seal: node.seal } : {}), ...fit };
    }
    case 'oring': return { ...at, kind: 'oring', gland: id(node.gland) };
    case 'connector-opening': {
      // (R12c.7, D162: the connector row inline.)
      const row = connectorRows.get(node.row);
      if (!row) throw refusal('CONNECTOR_ROW_UNKNOWN', `an opening names the connector row "${node.row}", which the document's connector rows do not hold (rows: ${[...connectorRows.keys()].join(', ') || 'none'})`);
      return { ...at, kind: 'connector-opening', target: ref(node.parent), face: node.face, row, center: node.center, ...(node.rotation ? { rotation: node.rotation } : {}) };
    }
    case 'connector-body': return { ...at, kind: 'connector-body', opening: id(node.opening) };
    // (FRk1, D165: plates on a frame's members.)
    case 'gusset': return { ...at, kind: 'gusset', frame: id(node.frame), point: node.point, ...(node.members ? { members: node.members } : {}), ...(node.along !== undefined ? { along: node.along } : {}), legs: node.legs, thickness: node.thickness, ...(node.clip ? { clip: node.clip } : {}), ...(node.offset ? { offset: node.offset } : {}) };
    case 'end-cap': return { ...at, kind: 'end-cap', frame: id(node.frame), member: node.member, end: node.end, fit: node.fit, thickness: node.thickness };
    case 'bearing': {
      // (A row the document does not hold is refused, typed — never a fallback.)
      const row = bearingRows.get(node.row);
      if (!row) throw refusal('BEARING_ROW_UNKNOWN', `a bearing names the row "${node.row}", which the document's bearing rows do not hold (rows: ${[...bearingRows.keys()].join(', ') || 'none'})`);
      const fit = node.shaftClass || node.housingClass ? { fit: { tables: fitTables, ...(node.shaftClass ? { shaft: node.shaftClass } : {}), ...(node.housingClass ? { housing: node.housingClass } : {}) } } : {};
      return { ...at, kind: 'bearing', row, shaft: id(node.shaft), step: node.step, against: node.against, ...(node.housing !== undefined ? { housing: id(node.housing) } : {}), ...fit };
    }
    case 'key': {
      // (O138: the key's width fit from the classes on its sides, its keyseat's and its hub keyway's — the user's tables.)
      const c = keyClasses(fitFaces, { key: id(index), shaft: id(node.shaft), keyseat: node.keyseat, ...(node.hub !== undefined ? { hub: id(node.hub) } : {}) });
      if (!c.key && (c.seat || c.hub)) throw refusal('FIT_FACE', `the ${c.seat ? `keyseat (${c.seat})` : `hub's keyway (${c.hub})`} carries a class but the key does not: give one of the key's sides a shaft's class (h9)`);
      const fit = c.key ? { fit: { tables: fitTables, key: c.key, ...(c.seat ? { seat: c.seat } : {}), ...(c.hub ? { hub: c.hub } : {}) } } : {};
      return { ...at, kind: 'key', shaft: id(node.shaft), keyseat: node.keyseat, height: node.height, ...(node.width !== undefined ? { width: node.width } : {}), ...(node.length !== undefined ? { length: node.length } : {}), ...(node.ends ? { ends: node.ends } : {}), ...(node.hub !== undefined ? { hub: id(node.hub) } : {}), ...fit };
    }
    case 'keyway': return { ...at, kind: 'keyway', target: ref(node.parent), face: node.face, width: node.width, depth: node.depth, ...(node.angle ? { angle: node.angle } : {}) };
    case 'retaining-ring': {
      // (O139: the user's row it names, checked by the kernel — never a fallback; none named: an estimate.)
      const r = node.row === undefined ? null : ringRows.get(node.row);
      if (node.row !== undefined && !r) throw refusal('RING_ROW_UNKNOWN', `a retaining ring names the row "${node.row}", which the document's ring rows do not hold (rows: ${[...ringRows.keys()].join(', ') || 'none'})`);
      const row = r ? { shaftDiameter: r.shaftDiameter, grooveDiameter: r.grooveDiameter, grooveWidth: r.grooveWidth, ...(r.source ? { source: r.source } : { estimate: true }) } : { estimate: true };
      return { ...at, kind: 'retaining-ring', shaft: id(node.shaft), groove: node.groove, thickness: node.thickness, outerDiameter: node.outerDiameter, row };
    }
    case 'pin': return { ...at, kind: 'pin', shaft: id(node.shaft), hole: node.hole, ...(node.diameter !== undefined ? { diameter: node.diameter } : {}), ...(node.length !== undefined ? { length: node.length } : {}), ...(node.fit ? { fit: true } : {}) };
    case 'shaft': {
      // (R12c.3a, D156: a shaft on its own axis.)
      return { ...at, kind: 'shaft', steps: node.steps.map(s => ({ diameter: s.diameter, length: s.length, ...(s.fillet ? { fillet: s.fillet } : {}), ...(s.undercut ? { undercut: s.undercut } : {}), ...(s.grooves?.length ? { grooves: s.grooves } : {}), ...(s.keyseats?.length ? { keyseats: s.keyseats } : {}) })),
        ...(node.chamfers ? { chamfers: node.chamfers } : {}), ...(node.holes?.length ? { holes: node.holes } : {}), center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}), generator: node.generator };
    }
    case 'sprocket': case 'pulley': case 'coupling': case 'belt': {
      // (R12c.6b, D161: the drive row inline; a belt's path from its wheels' pitch circles and centres.)
      const row = driveRows.get(node.row);
      if (!row) throw refusal('DRIVE_ROW_UNKNOWN', `a ${node.kind} names the drive row "${node.row}", which the document's drive rows do not hold (rows: ${[...driveRows.keys()].join(', ') || 'none'})`);
      if (node.kind === 'belt') return { ...at, ...beltFeature(node, row) } as unknown as CadPartFeature;
      const place = { center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}) };
      if (node.kind === 'coupling') return { ...at, kind: 'coupling', row, ...place, generator: node.generator };
      if (node.kind === 'sprocket') return { ...at, kind: 'sprocket', row, teeth: node.teeth, tip: node.tip, width: node.width, ...(node.seat ? { seat: node.seat } : {}), ...(node.bore ? { bore: node.bore } : {}), ...place, generator: node.generator };
      return { ...at, kind: 'pulley', row, ...(node.teeth !== undefined ? { teeth: node.teeth } : {}), ...(node.diameter !== undefined ? { diameter: node.diameter } : {}), ...(node.grooves !== undefined ? { grooves: node.grooves } : {}), ...(node.width !== undefined ? { width: node.width } : {}), ...(node.crown ? { crown: node.crown } : {}), ...(node.bore ? { bore: node.bore } : {}), ...place, generator: node.generator };
    }
    case 'cam': {
      // (R12c.6a, D160: a disc cam on its own axis.)
      return { ...at, kind: 'cam', follower: node.follower, ...(node.motion ? { motion: node.motion } : {}), base: node.base, ...(node.roller !== undefined ? { roller: node.roller } : {}), ...(node.offset ? { offset: node.offset } : {}),
        ...(node.pivotDistance !== undefined ? { pivotDistance: node.pivotDistance } : {}), ...(node.armLength !== undefined ? { armLength: node.armLength } : {}), ...(node.faceOffset !== undefined ? { faceOffset: node.faceOffset } : {}),
        segments: node.segments, thickness: node.thickness, ...(node.bore ? { bore: node.bore } : {}), ...(node.pressureAngleLimit !== undefined ? { pressureAngleLimit: node.pressureAngleLimit } : {}),
        center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}), generator: node.generator };
    }
    case 'spring': {
      // (R12c.1a, D153: a compression spring on its own axis.)
      return { ...at, kind: 'spring', wire: node.wire, diameter: node.diameter, activeCoils: node.activeCoils, ...(node.pitch !== undefined ? { pitch: node.pitch } : {}), ...(node.freeLength !== undefined ? { freeLength: node.freeLength } : {}), hand: node.hand, ...(node.type ? { type: node.type } : { ends: node.ends ?? 'closed-ground' }),
        ...(node.hooks ? { hooks: node.hooks } : {}), ...(node.initialTension ? { initialTension: node.initialTension } : {}), ...(node.legLengths ? { legLengths: node.legLengths } : {}), ...(node.moment ? { moment: node.moment } : {}),
        ...(node.youngsModulus !== undefined ? { youngsModulus: node.youngsModulus, ...(node.youngsModulusEstimate ? { youngsModulusEstimate: true } : {}) } : {}),
        ...(node.shearModulus !== undefined ? { shearModulus: node.shearModulus, ...(node.shearModulusEstimate ? { shearModulusEstimate: true } : {}) } : {}), ...(node.load ? { load: node.load } : {}), center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}), generator: node.generator };
    }
    case 'worm': {
      // (R12b.5, D136: its axial module, diameter and hand the kernel takes from the wheel it meshes with.)
      return { ...at, kind: 'worm', starts: node.starts, length: node.length, form: node.form, generator: node.generator, mesh: { gear: id(node.mesh.gear), ...(node.mesh.direction ? { direction: node.mesh.direction } : {}), ...(node.mesh.phase ? { phase: node.mesh.phase } : {}) },
        ...(node.bore !== undefined ? { bore: node.bore } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'bevel-gear': {
      // (R12b.3, D134: a meshing bevel gear's module, teeth, mate and shaft angle are its driver's — kept in step.)
      const d = node.mesh ? (nodes ?? current)[node.mesh.gear] : undefined, drv = d?.kind === 'bevel-gear' ? d : undefined;
      const own = node.mesh ? { mesh: { gear: id(node.mesh.gear), ...(node.mesh.direction ? { direction: node.mesh.direction } : {}), ...(node.mesh.phase ? { phase: node.mesh.phase } : {}) } }
        : { center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}) };
      const shaft = drv ? drv.shaftAngle : node.shaftAngle, spiral = bevelSpiral(node, nodes ?? current);
      return { ...at, kind: 'bevel-gear', ...(spiral ? { spiral: { angle: spiral.angle, hand: spiral.hand, cutterRadius: spiral.cutterRadius } } : {}), module: drv ? drv.module : node.module, teeth: drv ? drv.mateTeeth : node.teeth, mateTeeth: drv ? drv.teeth : node.mateTeeth, ...(shaft !== undefined ? { shaftAngle: shaft } : {}), faceWidth: node.faceWidth, generator: node.generator, ...own,
        ...(node.bore !== undefined ? { bore: node.bore } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'gear': {
      const own = node.mesh ? { mesh: { gear: id(node.mesh.gear), ...(node.mesh.direction ? { direction: node.mesh.direction } : {}), ...(node.mesh.centerDistance !== undefined ? { centerDistance: node.mesh.centerDistance } : {}), ...(node.mesh.phase ? { phase: node.mesh.phase } : {}) } }
        : { center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}) };
      // (Helical: `module` is the normal module; a meshing gear takes the other's helix angle, of the opposite hand.)
      const helix = helixOf(node, nodes ?? current);
      const modules = helix ? { normalModule: node.module, helixAngle: helix.angle, hand: helix.hand } : { module: node.module };
      return { ...at, kind: 'spur-gear', ...modules, teeth: node.teeth, faceWidth: node.faceWidth, generator: node.generator, ...own, ...(node.toolTipRadius !== undefined ? { toolTipRadius: node.toolTipRadius } : {}), ...(node.profileShift ? { profileShift: node.profileShift } : {}), ...(node.bore !== undefined ? { bore: node.bore } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'sew': return { ...at, kind: 'sew', surfaces: node.surfaces, ...(node.tolerance !== undefined ? { tolerance: node.tolerance } : {}) };
    case 'draft': return { ...at, kind: 'draft', target: ref(node.parent), faces: node.faces, angle: node.angle,
      ...(Object.hasOwn(node, 'pull') ? { pull: structuredClone(node.pull) } : {}),
      ...(Object.hasOwn(node, 'neutral') ? { neutral: structuredClone(node.neutral) } : {}), ...expectOf(node, node.faces) };
    case 'face-thread': return { ...at, kind: 'face-thread', target: ref(node.parent), face: node.face, pitch: node.pitch, ...(node.diameter !== undefined ? { diameter: node.diameter } : {}),
      ...(node.length !== undefined ? { length: node.length } : {}), ...(node.end ? { end: node.end } : {}), ...(node.relief !== undefined ? { relief: node.relief } : {}), ...(node.clearance !== undefined ? { clearance: node.clearance } : {}), ...(node.hand ? { hand: node.hand } : {}) };
    case 'full-round': return { ...at, kind: 'full-round', target: ref(node.parent), faces: node.faces, ...(node.along ? { along: node.along } : {}), ...expectOf(node, node.faces) };
    case 'split-face': return { ...at, kind: 'split-face', target: ref(node.parent), face: node.face, pull: node.pull, ...(node.names ? { names: node.names } : {}) } as CadPartFeature;
    case 'fillet': return { ...at, kind: 'fillet', target: ref(node.parent), edges: node.edges, ...(node.radii ? { radii: node.radii.map(p => ({ at: p.at, radius: p.radius, ...(p.atEnd ? { atEnd: true as const } : {}) })) } : { radius: node.radius }), ...(node.section ? { section: node.section } : {}), ...expectOf(node, node.edges) };
  }
}

/** A node's kernel features: one, or a patterned hole's copies one after another (the last named `n<i>`). */
function featuresOf(node: ModelNode, index: number): CadPartFeature[] {
  if (node.kind === 'library') return [...node.features, ...placementOf(node), featureOf(node, index, current)];
  if (node.kind !== 'hole' || !node.pattern || node.pattern.count <= 1) return [featureOf(node, index, current)];
  const centres = holeCentres(node.center.map(Number), node.pattern), base = featureOf(node, index, current) as CadPartFeature & { target: string };
  // (A hole's copies: `base` is a hole; the cast keeps the spread from widening over other kinds with a target and a centre.)
  return centres.map((center, j) => ({ ...base, id: j === centres.length - 1 ? id(index) : `${id(index)}_p${j}`, center, target: j === 0 ? base.target : `${id(index)}_p${j - 1}` }) as CadPartFeature);
}

/**
 * The kernel's features, suppressed ones left out: a suppressed feature that changes a body passes it on
 * unchanged (an identity move under its id, so what follows still finds it); one that makes a body takes
 * that body away, and with it what is built on it alone (a Boolean with one side gone keeps the other;
 * an intersection or a subtraction from nothing is gone too).
 */
const associationError = (message: string) => refusal('BAD_REFERENCE', `Associative sketch: ${message}`);

/** Validate the persisted binding before any native prefix evaluation. */
function associationSource(doc: StudioDoc, index: number): number {
  const node = doc.nodes[index];
  if (node?.kind !== 'sketch' || !node.association) throw associationError('no linked sketch at this index.');
  const a = node.association, source = a.source;
  if (a.kind !== 'planar-face-outline-inset' || a.version !== 1) throw associationError('unsupported recipe kind or version.');
  if (doc.instances?.length) throw associationError('assembly recipes are not supported.');
  if (!source || !Number.isInteger(source.node) || source.node < 0 || source.node >= index || source.side !== 'solid' || Object.keys(source).some(k => k !== 'node' && k !== 'side')) throw associationError('the source must be an earlier same-document solid; forward and cyclic references are not supported.');
  const parent = doc.nodes[source.node];
  if (!parent || parent.kind === 'sketch' || parent.kind === 'skeleton' || parent.suppressed) throw associationError('the source solid is missing or suppressed.');
  if (typeof a.sourceFeature !== 'string' || featureId(doc.nodes, source.node) !== a.sourceFeature || doc.nodes.filter((_, i) => featureId(doc.nodes, i) === a.sourceFeature).length !== 1) throw associationError('the source feature binding is missing, changed or ambiguous.');
  if (typeof a.face !== 'string' || !a.face || a.face.includes('+')) throw associationError('one persistent named face is required.');
  if (!Number.isFinite(a.insetMM) || a.insetMM <= 0) throw associationError('the inset must be finite and positive.');
  return source.node;
}

/** Resolve only from features that have already been built; never recurse through toPartDocument. */
function associativeProfile(doc: StudioDoc, index: number, prefix: readonly CadPartFeature[]): SketchNode {
  const source = associationSource(doc, index), node = doc.nodes[index] as Extract<ModelNode, { kind: 'sketch' }>, a = node.association!;
  let snapshot: CadPartSnapshot;
  try { snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: [...prefix] }); }
  catch (cause) { throw associationError(`the source prefix could not be evaluated: ${cause instanceof Error ? cause.message : String(cause)}`); }
  const outputs = snapshot.outputs.filter(o => o.id === featureId(doc.nodes, source));
  if (outputs.length !== 1 || outputs[0].representation === 'faceted' || outputs[0].brep.bodies.length !== 1) throw associationError('the source must resolve to one exact solid.');
  const brep = outputs[0].brep;
  if (brep.bodies[0].kind !== 'solid') throw associationError('the source is not a solid.');
  const named = brep.faces.filter(f => f.name === a.face);
  if (named.length !== 1) throw associationError('the named source face is missing or ambiguous.');
  const loops = named[0].loops.map(id => brep.loops.find(l => l.id === id));
  if (loops.length !== 1 || !loops[0] || loops[0].kind !== 'outer' || loops[0].coedges.length < 3) throw associationError('the source face must have one closed outer loop without holes.');
  // Check native edge curves before display fitting: a short curved edge must not become a line by fitting.
  for (const id of loops[0].coedges) {
    const coedge = brep.coedges.find(c => c.id === id), edge = coedge && brep.edges.find(e => e.id === coedge.edge), curve = edge?.curve;
    if (!curve || curve.degree !== 1 || curve.controlPoints.length !== 2 || !curve.controlPoints.every(p => p.every(Number.isFinite)) || curve.weights.length !== 2 || !curve.weights.every(w => Number.isFinite(w) && w > 0)) throw associationError('only native straight boundary edges are supported.');
  }
  const mesh = bodyMesh(brep, 0), faces = mesh.faces.filter(f => f.name === a.face);
  if (faces.length !== 1 || faces[0].kind !== 'plane') throw associationError('the named source face must be one planar face.');
  const fp = faceProfile(mesh, faces[0].index);
  if (!fp || fp.profile !== 'loop' || fp.holes?.length || fp.regions?.length || fp.segments.length < 3 || fp.segments.some(g => g.kind !== 'line' || !g.start.every(v => typeof v === 'number' && Number.isFinite(v))) || !fp.plane || ![...fp.plane.origin, ...fp.plane.normal, ...fp.plane.xAxis].every(Number.isFinite)) throw associationError('only one finite straight closed outer loop without holes is supported.');
  const reopened = sketchShapes(fp);
  if (!reopened.shape || reopened.done.length) throw associationError('the source face does not have one outer shape.');
  const inset = offsetShape(reopened.shape, -a.insetMM);
  if ('error' in inset) throw associationError(inset.error);
  const profile = profileOf([reopened.shape, inset.shape]);
  if ('error' in profile) throw associationError(profile.error);
  if (profile.node.regions?.length || profile.node.holes?.length !== 1) throw associationError('the inset must produce one enclosed hole.');
  const extras = { ...(node.id === undefined ? {} : { id: node.id }), ...(node.suppressed ? { suppressed: node.suppressed } : {}), ...(node.sigs ? { sigs: node.sigs } : {}), ...(node.rematched ? { rematched: node.rematched } : {}), ...(node.held ? { held: node.held } : {}), ...(node.bought === undefined ? {} : { bought: node.bought }) };
  return { ...profile.node, ...extras, plane: fp.plane, on: { ...(node.on ?? a.source) }, association: a };
}

/** Current linked geometry for reopening. Legacy coordinate sketches are returned unchanged. */
export function resolveAssociativeSketch(doc: StudioDoc, index: number): SketchNode {
  assertRouteBundleDocument(doc);
  const node = doc.nodes[index];
  if (node?.kind !== 'sketch') throw associationError('no sketch at this index.');
  if (node.association === undefined) return node;
  const source = associationSource(doc, index);
  // This builds only earlier nodes. The builder resolves its recipes from its own accumulated features.
  const prefix = buildPartDocument(doc, source + 1);
  return associativeProfile(doc, index, prefix.features);
}

export function toPartDocument(doc: StudioDoc): CadPartDocument { return buildPartDocument(doc); }

function buildPartDocument(doc: StudioDoc, before?: number): CadPartDocument {
  assertRouteBundleDocument(doc);
  doc = resolveShopTree(doc);
  assertRouteBundleDocument(doc);
  const limit = before ?? doc.nodes.length;
  bearingDependencyKey(doc);
  const ownershipError = documentBeadOwnershipError(doc);
  if (ownershipError) throw new CadPartError('PARAMETER', null, ownershipError);
  doc = withIds(doc); current = doc.nodes; library = new Map((doc.frames?.sections ?? []).map(r => [r.id, r.section])); bearingRows = new Map((doc.bearings?.rows ?? []).map(r => [r.id, r])); oringRows = new Map((doc.orings?.rows ?? []).map(r => [r.id, r])); driveRows = new Map((doc.drives?.rows ?? []).map(r => [r.id, r])); connectorRows = new Map((doc.connectors?.rows ?? []).map(r => [r.id, r])); fitTables = doc.fits?.tables ?? []; fitFaces = doc.fits?.faces ?? []; ringRows = new Map((doc.rings?.rows ?? []).map(r => [r.id, r])); params = doc.parameters ?? {}; partsNow = doc.instances ?? [];
  const gone = new Set<number>(), features: CadPartFeature[] = [], prefixEnds = new Map<number, number>();
  // Only this validated document path may remove a linked sweep's marker for kernel conversion.
  const convert = (node: ModelNode, index: number): CadPartFeature[] => {
    if (node.kind !== 'sweep-curve' || !Object.prototype.hasOwnProperty.call(node, 'routeBundleMember')) return featuresOf(node, index);
    const snapshot = { ...node };
    delete snapshot.routeBundleMember;
    return featuresOf(snapshot, index);
  };
  const pass = (i: number, r: BodyRef) => features.push({ id: id(i), kind: 'translate', target: ref(r), offset: [0, 0, 0] } as CadPartFeature);
  doc.nodes.forEach((node, i) => {
    if (i >= limit) return;
    prefixEnds.set(i, features.length);
    if (node.kind === 'skeleton') return;
    if (node.kind === 'sketch') {
      if (node.association !== undefined) {
        const source = associationSource(doc, i), end = prefixEnds.get(source + 1);
        if (gone.has(source) || end === undefined) throw associationError('the source solid is unavailable in the evaluated prefix.');
        const resolved = associativeProfile(doc, i, features.slice(0, end));
        delete resolved.association;
        features.push(...featuresOf(resolved, i));
      } else features.push(...featuresOf(node, i));
      return;
    }
    const makes = node.kind === 'extrude' || node.kind === 'revolve' || node.kind === 'sweep' || node.kind === 'loft' || node.kind === 'import' || node.kind === 'mesh' || node.kind === 'subd' || node.kind === 'gear' || node.kind === 'internal-gear' || node.kind === 'bevel-gear' || node.kind === 'worm' || node.kind === 'worm-wheel' || node.kind === 'spring' || node.kind === 'cam' || node.kind === 'sprocket' || node.kind === 'pulley' || node.kind === 'belt' || node.kind === 'coupling' || node.kind === 'connector-body' || node.kind === 'gusset' || node.kind === 'end-cap' || node.kind === 'shaft' || node.kind === 'key' || node.kind === 'retaining-ring' || node.kind === 'pin' || node.kind === 'bearing' || node.kind === 'oring' || node.kind === 'rack' || node.kind === 'library' || node.kind === 'thread' || node.kind === 'sweep-curve' || node.kind === 'thicken' || node.kind === 'sew' || node.kind === 'sheet-base' || node.kind === 'sheet-contour' || node.kind === 'frame-member' || node.kind === 'frame';
    const two = node.kind === 'union' || node.kind === 'intersect' ? [node.left, node.right] : node.kind === 'difference' ? [node.parent, node.tool] : null;
    if (two) {
      const [a, b] = two, ga = gone.has(a.node), gb = gone.has(b.node);
      // (Suppressed, a Boolean keeps its first body as it was.)
      if (node.suppressed) { if (ga) gone.add(i); else pass(i, a); return; }
      if (ga && gb) { gone.add(i); return; }
      if (node.kind === 'difference') { if (ga) { gone.add(i); return; } if (gb) { pass(i, a); return; } }
      else if (node.kind === 'intersect') { if (ga || gb) { gone.add(i); return; } }
      else if (ga || gb) { pass(i, ga ? b : a); return; }
      features.push(...featuresOf(node, i)); return;
    }
    if (makes) {
      // (A library part added to a body, suppressed or its body gone: the body passes on as it was, or is gone.)
      if (node.kind === 'library' && node.addTo) { if (gone.has(node.addTo.node)) { gone.add(i); return; } if (node.suppressed) { pass(i, node.addTo); return; } features.push(...featuresOf(node, i)); return; }
      if (node.suppressed || ('from' in node && Array.isArray(node.from) && node.from.some(p => gone.has(p))) || ((node.kind === 'gear' || node.kind === 'rack' || node.kind === 'bevel-gear' || node.kind === 'worm') && node.mesh && gone.has(node.mesh.gear))) { gone.add(i); return; }
      features.push(...convert(node, i)); return;
    }
    // Active cut patterns, ribs and reliefs must reach kernel source admission even when their parent is gone.
    // Suppressing the pattern itself keeps the ordinary parent pass-through below.
    if ((node.kind === 'linear-feature-pattern' || node.kind === 'rib' || node.kind === 'rectangular-relief') && !node.suppressed) { features.push(...featuresOf(node, i)); return; }
    const parent = (node as { parent: BodyRef }).parent;
    if (gone.has(parent.node)) { gone.add(i); return; }
    if (node.suppressed) { pass(i, parent); return; }
    features.push(...featuresOf(node, i));
  });
  // Derived weld bodies follow authored nodes. Each retry sends the complete remaining per-frame manifest.
  const active = beadsOf(limit < doc.nodes.length ? prefixDoc(doc, limit) : doc, gone).filter(b => !refusedBeads.has(b.key));
  for (const b of active) {
    const f = b.feature;
    if (doc.frames?.beadOwnership && 'member' in f.on) {
      const joints = active.flatMap(x => x.feature.frame === f.frame && 'member' in x.feature.on ? [{ ...x.feature.on, leg: x.feature.leg }] : [])
        .sort((a, b) => a.member - b.member || (a.end === b.end ? 0 : a.end === 'start' ? -1 : 1));
      features.push({ ...f, sharing: { ...doc.frames.beadOwnership, joints } });
    } else features.push(f);
  }
  return { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features };
}

// ——— FRk2 (D166), the outer lane's side: an O118 weld record → the kernel's `weld-bead` feature. A record whose kind is
// a fillet (set, or unset: a butt's or a face's default) and whose size is set makes a bead of that leg:
//   - `<member>.<end>` (a butt, an on-face end, a mitre set to fillet): `on: { member: k, end }` on its frame (the body
//     key's side part<k>, or 'solid' for a frame of one member: k = 0); `inner` as the record says;
//   - `<gusset>.<member>`: `on: { gusset }` (its frame the gusset's); `<cap>.<member>`: `on: { cap }`.
// A local refusal removes that bead; a structured shared refusal removes its complete Kernel-proved component.
// An unbounded shared failure propagates. Reasons remain on the authored joints (`beadRefusal`).
// A record with no kind set on a mitre or a cap (a groove or a corner weld by default) is no bead:
// the kernel's BEAD_KIND there is kept quiet.
type WeldRecordLike = { joint: string; kind?: 'fillet' | 'butt'; size?: number; inner?: boolean };
export interface BeadFeature { key: string; joint: string; quiet: boolean; feature: Extract<CadPartFeature, { kind: 'weld-bead' }> }
/**
 * A joint's bead feature id: `bead_` and, for a member's end, the joint id; for a plate's seam, the plate's key — the
 * kernel welds all of a gusset's (or a cap's) seams in one bead, so its joints share it.
 */
export function beadIdOf(joint: string): string {
  const plate = /\.(start|end)$/.test(joint) ? joint : joint.slice(0, Math.max(0, joint.indexOf('.'))) || joint;
  return `bead_${plate.replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 64);
}
/** The bead each fillet record with a size makes (`gone`: nodes whose bodies are gone or suppressed). */
export function beadsOf(doc: StudioDoc, gone: ReadonlySet<number> = new Set()): BeadFeature[] {
  assertRouteBundleDocument(doc);
  const out: BeadFeature[] = [], nodes = doc.nodes, records = (doc.frames?.welds ?? []) as readonly WeldRecordLike[], input = canonical(modelContent(doc));
  for (const r of records) {
    if (r.kind === 'butt' || r.size === undefined) continue;
    let feature: Record<string, unknown> | null = null, owner = -1, plate = -1;
    const end = /^(.+)\.(start|end)$/.exec(r.joint);
    if (end) {
      const at = bodyNodeOf(nodes, end[1]), k = at?.side === 'solid' ? 0 : Number(/^part(\d+)$/.exec(at?.side ?? '')?.[1] ?? NaN);
      if (!at || nodes[at.node]?.kind !== 'frame' || !Number.isInteger(k)) continue;
      owner = at.node;
      feature = { frame: featureId(nodes, at.node), on: { member: k, end: end[2] }, ...(r.inner ? { inner: true } : {}) };
    } else {
      const dot = r.joint.indexOf('.'), at = dot > 0 ? bodyNodeOf(nodes, r.joint.slice(0, dot)) : null, n = at ? nodes[at.node] : undefined;
      if (!at || (n?.kind !== 'gusset' && n?.kind !== 'end-cap')) continue;
      plate = at.node; owner = n.frame;
      feature = { frame: featureId(nodes, n.frame), on: n.kind === 'gusset' ? { gusset: featureId(nodes, at.node) } : { cap: featureId(nodes, at.node) } };
    }
    if (owner < 0 || gone.has(owner) || (plate >= 0 && gone.has(plate)) || nodes[owner]?.suppressed) continue;
    const f = { id: beadIdOf(r.joint), kind: 'weld-bead', ...feature, leg: r.size } as BeadFeature['feature'];
    // (A plate's seams share one bead: its first record's.)
    if (out.some(x => x.feature.id === f.id)) continue;
    // Keep the full authored evaluation context even when retry removes failed Kernel features.
    const key = `${canonical(f)}\u0000${input}`;
    out.push({ key, joint: r.joint, quiet: r.kind === undefined, feature: f });
  }
  return out;
}
/** Beads the kernel refused, by key: the reason, and whether it is kept quiet (a mitre's or a cap's default). */
const refusedBeads = new Map<string, { reason: string; component?: BeadSharedComponent }>();
/** A refusal kept quiet: BEAD_KIND on a record with no kind set — a mitre's groove weld or a cap's corner weld by default. */
const quietOf = (b: BeadFeature, reason: string) => b.quiet && /\[BEAD_KIND\][^\n]*(is mitred|sits flush)/.test(reason);
/** A joint's bead refusal in this document (null: none, or none refused). */
/** The document as the evaluation keys its beads: shop rows resolved into the parts, skeletons solved (O168). */
const evaluatedViews = new WeakMap<StudioDoc, StudioDoc>();
/** The tree with its skeletons solved; one that is refused, the tree as it is (its refusal is the evaluation's). */
function solvedView(tree: StudioDoc): StudioDoc {
  try { return resolveSkeletons(tree).doc; } catch (e) { if (isRefusal(e, ...SKELETON_CODES)) return tree; throw e; }
}
function evaluatedView(doc: StudioDoc): StudioDoc {
  const had = evaluatedViews.get(doc); if (had) return had;
  const tree = resolveShopTree(doc), view = solvedView(tree);
  evaluatedViews.set(doc, view);
  return view;
}
function refusalIn(doc: StudioDoc, id: string): { reason: string; quiet: boolean; component?: BeadSharedComponent } | null {
  for (const b of beadsOf(withIds(doc))) if (b.feature.id === id) { const refusal = refusedBeads.get(b.key); return refusal === undefined ? null : { ...refusal, quiet: quietOf(b, refusal.reason) }; }
  return null;
}
export function beadRefusal(doc: StudioDoc, joint: string): { reason: string; quiet: boolean; component?: BeadSharedComponent } | null {
  // (O168, F7: the evaluation keys a refusal by the resolved document — with placed parts, their inherited rows make it
  // differ from the authored one — so it is looked up there first, then as authored (the section and face readers).)
  const id = beadIdOf(joint);
  return refusalIn(evaluatedView(doc), id) ?? refusalIn(doc, id);
}
/**
 * Retry only a proved local refusal. Shared components are removed atomically; unbounded shared errors propagate.
 */
export function withBeadRetry<T>(doc: StudioDoc, build: (part: CadPartDocument) => T): T {
  for (let tries = 0; ; tries++) {
    const part = toPartDocument(doc);
    try { return build(part); } catch (cause) {
      const all = beadsOf(withIds(doc)), f = cause instanceof CadPartError ? cause.feature : null, b = f && f.startsWith('bead_') ? all.find(x => x.feature.id === f) : undefined;
      if (!b || refusedBeads.has(b.key) || tries > 64) throw cause;
      const reason = String((cause as Error).message).replace(/^[^:]*: /, ''), component = cause instanceof CadPartError ? cause.sharedComponent : undefined;
      if (component) {
        const refs = Array.from(component.joints ?? []);
        if (refs.length < 2 || refs.some(r => !r || !Number.isInteger(r.member) || r.member < 0 || (r.end !== 'start' && r.end !== 'end'))) throw cause;
        const ids = new Set(refs.map(r => `${r.member}.${r.end}`));
        const group = all.filter(x => x.feature.frame === component.frame && 'member' in x.feature.on && ids.has(`${x.feature.on.member}.${x.feature.on.end}`));
        if (ids.size !== refs.length || group.length !== refs.length || !group.includes(b) || group.some(x => refusedBeads.has(x.key))) throw cause;
        for (const peer of group) refusedBeads.set(peer.key, { reason, component });
      } else {
        // Global sharing failures do not establish a safe subset. Never invent a component from the manifest.
        if (/\[BEAD_SHARED_(CONTEXT|UNSUPPORTED)\]/.test(reason)) throw cause;
        refusedBeads.set(b.key, { reason });
      }
    }
  }
}

/** The existing native snapshot plus current cross-part housing checks, without changing authored geometry. */
export function partSnapshot(doc: StudioDoc, build: (part: CadPartDocument) => CadPartSnapshot = p => evaluateCadPart(p)): CadPartSnapshot {
  const taken = new Map<string, CadPartSnapshot>();
  const read = (source: StudioDoc, make: (part: CadPartDocument) => CadPartSnapshot): CadPartSnapshot => {
    assertRouteBundleDocument(source);
    source = resolveShopTree(source);
    // (Geometry is always built from the solved skeletons, here, whoever calls; provenance — exportStudioStep's source revision —
    // is always the authored document's, the one a saved file hashes to. Both on purpose: see test/r4-skeletons.test.ts.)
    source = resolveSkeletons(source).doc;
    bearingDependencyKey(source);
    const context = bearingContextOf(source), snapshot = withBeadRetry(source, make), reports = new Map<number, BearingReport>();
    for (const [i, n] of source.nodes.entries()) {
      const ref = bearingHousingRef(n); if (!ref || n.kind !== 'bearing' || n.suppressed) continue;
      if (!context) throw refusal('BEARING_HOUSING_REFERENCE', 'missing current assembly context');
      const target = bearingHousingTarget(source, ref);
      let targetSnapshot = taken.get(target.part);
      if (!targetSnapshot) {
        targetSnapshot = read(withBearingContext(target.doc, { ...context, owner: target.part, ownerPose: target.pose }), p => evaluateCadPart(p));
        taken.set(target.part, targetSnapshot);
      }
      const output = targetSnapshot.outputs.find(o => bodyKeyOf(o.id, target.doc.nodes) === ref.body);
      if (!output || output.representation === 'faceted') throw refusal('BEARING_HOUSING_REFERENCE', `${ref.part}/${ref.body} is not a current exact housing body`);
      const shaftNode = source.nodes[n.shaft];
      if (shaftNode?.kind !== 'shaft') throw refusal('BEARING_HOUSING_REFERENCE', 'the linked bearing needs its actual shaft feature');
      const shaft = withBeadRetry(prefixDoc(source, n.shaft + 1), p => evaluateCadPart(p)).outputs.find(o => o.id === featureId(source.nodes, n.shaft));
      if (!shaft?.shaft) throw refusal('BEARING_HOUSING_REFERENCE', 'the current shaft body is missing');
      const row = source.bearings?.rows.find(r => r.id === n.row);
      if (!row) throw refusal('BEARING_ROW_UNKNOWN', `no current row ${n.row}`);
      const angle = (shaftNode.rotation ?? 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const made = bearingInExternalHousing({ row, shaft: { report: shaft.shaft, brep: shaft.brep, place: { matrix: [c, -s, 0, s, c, 0, 0, 0, 1], offset: [shaftNode.center[0], shaftNode.center[1], shaftNode.from ?? 0] } }, ownerPose: context.ownerPose, target: { brep: output.brep, pose: target.pose }, step: n.step, against: n.against, id: featureId(source.nodes, i), ...(n.shaftClass || n.housingClass ? { fit: { tables: source.fits?.tables ?? [], ...(n.shaftClass ? { shaft: n.shaftClass } : {}), ...(n.housingClass ? { housing: n.housingClass } : {}) } } : {}) });
      reports.set(i, made.report);
    }
    if (!reports.size) return snapshot;
    const outputs = snapshot.outputs.map(o => {
      if (!o.bearing) return o;
      let i = nodeIndexOf(source.nodes, o.id.split('/')[0]);
      const seen = new Set<number>();
      while (i >= 0 && !seen.has(i)) {
        seen.add(i); const report = reports.get(i); if (report) return { ...o, bearing: report };
        const node = source.nodes[i]; if (!node || !('parent' in node)) break;
        i = node.parent.node;
      }
      return o;
    });
    return { ...snapshot, outputs };
  };
  return read(doc, build);
}

/** Studio body key of a kernel output id (`nodes`: to tell an imported file's solids from a split's halves). */
export const bodyKeyOf = (outputId: string, nodes?: readonly ModelNode[]) => {
  const m = /^([^/]+)(?:\/(\d+))?$/.exec(outputId);
  if (!m) return outputId;
  // (The node whose id the output carries; without the nodes, an id `n<i>` reads as node i.)
  // (Keyed by the id's serial, `b<k>` for `n<k>`, see ids.ts; the node only tells a file's solids from a split's halves.)
  const k = serialOf(m[1]), i = nodes ? nodeIndexOf(nodes, m[1]) : k;
  if (!(k >= 0)) return outputId;
  if (m[2] !== undefined && (nodes?.[i]?.kind === 'import' || nodes?.[i]?.kind === 'separate' || nodes?.[i]?.kind === 'mesh' || nodes?.[i]?.kind === 'frame')) return `b${k}_part${m[2]}`;
  return m[2] === undefined ? `b${k}` : `b${k}_${m[2] === '0' ? 'negative' : 'positive'}`;
};

/**
 * A mesh node's arrays as typed arrays: from the blob store when the node names blobs (M1), else made once per
 * inline node array (R3.2). The kernel takes them without copying, freezing or writing them into its reuse key (it
 * hashes each array object once); a blob or a node's arrays never change.
 */
const typedMeshes = new WeakMap<readonly number[], { positions: Float64Array; indices: Uint32Array }>();
function meshArrays(node: { positions?: number[]; indices?: number[]; blob?: { positions: string; indices: string } }): { positions: Float64Array | Float32Array; indices: Uint32Array } {
  if (node.blob) {
    // (Single-precision positions as stored: the kernel widens them when it reads them, D45.)
    const p = getBlob(node.blob.positions), i = getBlob(node.blob.indices);
    if (!(p instanceof Float64Array || p instanceof Float32Array) || !(i instanceof Uint32Array)) throw refusal('MESH_NOT_LOADED', `The mesh's data (${(p ? node.blob.indices : node.blob.positions).slice(0, 12)}…) is not loaded: open the file it was saved in again`);
    return { positions: p, indices: i };
  }
  const P = node.positions ?? [], I = node.indices ?? [];
  let t = typedMeshes.get(P);
  if (!t || t.indices.length !== I.length) { t = { positions: Float64Array.from(P), indices: Uint32Array.from(I) }; typedMeshes.set(P, t); }
  return t;
}
/** A repair's fill patches (its faces of their own) and, when it could not close the mesh, a sheet said so (D47). */
function repaired(r: { result: { fill: string }; report: { closed: boolean } }): { groups?: Int32Array; open?: true } {
  const fill = getBlob(r.result.fill);
  return { ...(fill instanceof Int32Array ? { groups: fill } : {}), ...(r.report.closed ? {} : { open: true as const }) };
}

/** A gear node's helix: its own, or — meshing — the other gear's angle with the opposite hand; inside a ring, the ring's own (one hand, R12b.2a). None: spur. */
export function helixOf(node: Extract<ModelNode, { kind: 'gear' }>, nodes: readonly ModelNode[]): { angle: number; hand: 'right' | 'left' } | null {
  if (node.mesh) {
    const other = nodes[node.mesh.gear];
    if (other?.kind === 'internal-gear') return other.helixAngle ? { angle: other.helixAngle, hand: other.hand ?? 'right' } : null;
    const h = other?.kind === 'gear' && other !== node ? helixOf(other, nodes) : null;
    return h ? { angle: h.angle, hand: h.hand === 'right' ? 'left' : 'right' } : null;
  }
  return node.helixAngle ? { angle: node.helixAngle, hand: node.hand ?? 'right' } : null;
}

/** A placed library part's turns (about X, then Y, then Z, through the origin) and move, ending at `<prefix>_placed`. */
function placementOf(node: Extract<ModelNode, { kind: 'library' }>): CadPartFeature[] {
  if (!node.placement) return [];
  const steps = rotationSteps(node.placement.rotation), out: CadPartFeature[] = [];
  let target = node.outputs[0];
  steps.forEach((s, k) => { const id = `${node.prefix}_turn${k}`; out.push({ id, kind: 'rotate', target, axis: s.axis, angle: s.angle } as CadPartFeature); target = id; });
  out.push({ id: `${node.prefix}_placed`, kind: 'translate', target, offset: node.placement.position } as CadPartFeature);
  return out;
}

