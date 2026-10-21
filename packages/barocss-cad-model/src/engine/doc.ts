// The studio document: plain data, one node per feature. Every command appends or edits nodes; the
// worker evaluates it on the kernel's B-rep part model (a node is feature `id`, see part.ts and ids.ts).

import type { Constraint3D } from '../frames/sketch3d';
import type { RobotSettings } from '../robot/joints';
import type { BendTable } from '@barocss/cad';
import type { Brief } from '../chat/brief';
import type { QuestionLog } from '../chat/questions';
import type { ReferenceSet } from '../chat/references';
import type { DraftSet } from '../chat/drafts';
import type { Interfaces } from '../team/parts';
import type { EcrLog } from '../team/ecr';
import type { BaselineLog } from '../team/baseline';

export type Axis = 'x' | 'y' | 'z';
export type Dim = number | { parameter: string };
/**
 * What a frame follows (FRf, O121; FRf2, O125): a skeleton or a sketch of this document by index, or a placed part's
 * sketch by its stable feature id — `revision` the part's A7 revision when the person linked it (its staleness).
 */
export type FrameFollows = { skeleton: number } | { sketch: number } | { part: string; sketch: string; revision?: string };
/** The local feature a frame follows (a skeleton or sketch of this document), or null for a placed part's sketch. */
export const followsIndex = (f: FrameFollows): number | null => 'part' in f ? null : 'skeleton' in f ? f.skeleton : f.sketch;
/** A member's section (FR1, D123): the kernel's kinds with their dimensions, or a closed sketch by its node. */
export type MemberSection =
  | { kind: 'rect-tube'; width: Dim; height: Dim; wall: Dim; outerRadius: Dim; innerRadius?: Dim }
  | { kind: 'round-tube'; diameter: Dim; wall: Dim }
  | { kind: 'angle'; legX: Dim; legY: Dim; thickness: Dim; rootRadius: Dim; toeRadius: Dim }
  | { kind: 'channel'; height: Dim; width: Dim; web: Dim; flange: Dim; rootRadius: Dim }
  | { kind: 'tslot'; size: Dim; cells: 1 | 2; openSlots?: number; opening: Dim; lip: Dim; undercut: Dim; depth: Dim; bore: Dim }
  | { kind: 'sketch'; sketch: number }
  /** FRc (O117): a row of the document's section library (`frames.sections`) by its id — resolved before the kernel. */
  | { kind: 'library'; id: string };
/** A section given by its dimensions: what a library row holds (FRc). */
export type InlineSection = Exclude<MemberSection, { kind: 'sketch' } | { kind: 'library' }>;
/** A row of the user's section library (FRc, O117): an id, a name, the section, and where its sizes come from — a source, or flagged as an estimate. */
export interface FrameSectionRow { id: string; name?: string; section: InlineSection; source?: string; estimate?: true }
/**
 * A frame's corners (FR3a, D125; the kernel's `corners`): where exactly two members end at a point, `default` (mitre when
 * left out) finishes them — mitre, butt or none — and `at` sets a point apart (`through`: the member running on at a butt).
 */
export interface FrameCorners {
  default?: 'mitre' | 'butt' | 'none';
  /** Three or more members ending at a point (FR3b, D126): an ordered trim (`order`) or left square (`none`, the default). */
  multi?: 'order' | 'none';
  /** Members ending on another's length (T-joints, FR3b): butted on its face, coped to its envelope, or left (`none`, the default). */
  tee?: 'butt' | 'cope' | 'none';
  at?: { point: number; kind: 'mitre' | 'butt' | 'cope' | 'order' | 'none'; through?: number; trim?: 'face' | 'envelope'; order?: number[] }[];
}
/** A member's end trimmed to a plane or an earlier body (FR3b, D126; the kernel's `trims`). */
export type FrameTrim = { member: number; end: 'start' | 'end' } & ({ plane: { origin: [number, number, number]; normal: [number, number, number] } } | { body: BodyRef });
/** One member of a frame set apart (FR2, D124): its own section, anchor, offset, roll or mirror. */
export interface FrameOverride { member: number; section?: MemberSection; anchor?: FrameAnchor; offset?: [Dim, Dim]; roll?: number; mirror?: boolean }
export type FrameAnchor = 'centroid' | 'origin' | 'bottom-left' | 'bottom' | 'bottom-right' | 'left' | 'center' | 'right' | 'top-left' | 'top' | 'top-right';
/** `part<k>`: solid k of an imported STEP file that holds several (see the import node's `solids`). */
export type Side = 'solid' | 'negative' | 'positive' | 'instance1' | 'instance2' | 'instance3' | `part${number}`;
export interface BodyRef { node: number; side: Side }

/** Where a sketch lies (see sketch/plane.ts); none: the XY plane at Z 0. */
/** A stock row (CNC7b): a block's three sides, or a bar's diameter (and the longest length it comes in), with its source (the shop's own, a page …). */
export type StockRow = { id: string; kind: 'block'; size: [number, number, number]; source: string } | { id: string; kind: 'bar'; diameter: number; maxLength?: number; source: string };
/** A frame stock row (FRb, O116): a length bars come in, how many if limited, the section it is (a cut list's section text; unset: any), with its source. */
export interface FrameStockRow { id: string; lengthMM: number; count?: number; section?: string; source: string }
export interface DocPlane { origin: [number, number, number]; normal: [number, number, number]; xAxis: [number, number, number] }
/** A sheet's K (R12.4, D120): one K-factor, or a bend table (the shop's, loaded from a file) giving each bend's. */
export type SheetK = { kFactor: number; bendTable?: undefined } | { bendTable: BendTable; kFactor?: undefined };
export type LoopSegment = { kind: 'line'; start: [Dim, Dim] } | { kind: 'arc'; start: [Dim, Dim]; center: [Dim, Dim]; direction: 'ccw' | 'cw' };
/**
 * The closed outline a polygon / loop profile was drawn from, with its constraints and driving dimensions
 * (see sketch/rules.ts): lengths and radii by segment, tangent joints, arc pairs, kept H/V edges, rules.
 */
export interface SketchOutline {
  points: [number, number][]; bulges?: number[]; lengths?: Record<number, number>; radii?: Record<number, number>; tangents?: number[];
  equalRadii?: [number, number][]; concentric?: [number, number][]; hv?: { h: number[]; v: number[] }; rules?: SketchRule[];
  /** Circles dimensioned from the outline (they are also the profile's holes or regions). */
  circles?: { c: [number, number]; r: number }[];
}
/** `regions`: more loops of material; `holes`: loops cut from them (straight extrudes only); `outline`: the main loop as drawn and constrained. */
/** `on`: the body the sketch was drawn on (a feature from it joins or cuts that body by default). */
/** A body's own look in the modelling view (see StudioDoc.bodies). */
/** `material`: a material id (the studio's list); without one, the studio's default material. */
/** `faces`: colours of single faces by their persistent names (`n1.top`), over the body's own. */
/** `faces`: per-face colours by face name, with their faces' signatures (`faceSigs`) and re-matched names (`facesWas`, new → old), see engine/references.ts. */
export interface BodyLook { name?: string; color?: string; hidden?: boolean; material?: string; faces?: Record<string, string>; faceSigs?: Record<string, Sig>; facesWas?: Record<string, string> }
/** A solid made by a shape command (Box, Sphere …) with these values: picking it again edits those values. */
/** `nodes`: how many nodes the command added (a sketch and its solid when absent). */
export interface Made { command: string; values: Record<string, number | string>; nodes?: number }
/** `construction`: reference shapes drawn in the sketch (the sketcher's own form), not part of the profile. */
/**
 * `sideTags` (R10a, D86): the sketch's own side ids, one a side of its outer loop, of each region and of each hole (the
 * kernel's `sideTags`): the walls a body makes of it are named `side[<id>]` and keep their names as it is edited.
 * Left out (sketches written before), the walls are named by position (`side<k>`), as they were (D16).
 */
type OnPlane = { plane?: DocPlane; regions?: LoopSegment[][]; holes?: LoopSegment[][]; outline?: SketchOutline; on?: BodyRef; construction?: unknown[]; sideTags?: { outer: string[]; regions?: string[][]; holes?: string[][] } };
export type SketchNode =
  | ({ kind: 'sketch'; profile: 'rectangle'; min: [Dim, Dim]; max: [Dim, Dim] } & OnPlane)
  | ({ kind: 'sketch'; profile: 'circle'; center: [Dim, Dim]; radius: Dim } & OnPlane)
  | ({ kind: 'sketch'; profile: 'polygon'; points: [Dim, Dim][] } & OnPlane)
  | ({ kind: 'sketch'; profile: 'loop'; segments: LoopSegment[] } & OnPlane);

/**
 * A feature of the part; `suppressed`: left out of the model for now (see engine/part.ts), kept in its history.
 * `id`: its stable feature id (`n<k>`, see engine/ids.ts): the prefix of its faces' and edges' names.
 * `rematched`: names it stores that an edit renumbered and were matched again by their geometry (new → old,
 * engine/rematch.ts), until the user confirms them. `sigs`: the geometry of the names it stores, by name
 * (engine/references.ts). `held`: why it is suppressed until the user picks a reference it stores again
 * (one opened that could not be told; references.ts).
 */
export type ModelNode = ModelNodeBase & NodeExtras;
/** What the studio keeps on any node besides the feature itself (see the fields above). */
export type NodeExtras = { suppressed?: true; id?: string; rematched?: Record<string, string>; sigs?: Record<string, Sig>; held?: string };
/**
 * Every NodeExtras field, checked at compile time to be all of them: a test sets each and runs every path that
 * rebuilds nodes, so a new field is either carried or fails it (test/fields.test.ts).
 */
export const NODE_EXTRA_FIELDS = ['suppressed', 'id', 'rematched', 'sigs', 'held'] as const satisfies readonly (keyof NodeExtras)[];
export const _nodeFieldsComplete: [Exclude<keyof NodeExtras, typeof NODE_EXTRA_FIELDS[number]>] extends [never] ? true : never = true;
type ModelNodeBase = SketchNode
  /** `draft` (degrees) leans the walls into the material away from the sketch plane. */
  | { kind: 'extrude'; sketch: number; height: Dim; from?: Dim; draft?: number; made?: Made }
  /** The sketch turned about its X or Y axis (through `origin`, default the sketch origin) towards +Z. */
  | { kind: 'revolve'; sketch: number; axis: 'x' | 'y'; origin?: [Dim, Dim]; angleDegrees: number; /** Any direction in the sketch plane (a picked edge), instead of its X or Y. */ dir?: [number, number]; made?: Made }
  | { kind: 'translate'; parent: BodyRef; offset: [Dim, Dim, Dim] }
  /** About the axis through `pivot` (none: the origin, as parts placed by rotation steps). */
  | { kind: 'rotate'; parent: BodyRef; axis: Axis; angleDegrees: number; pivot?: [Dim, Dim, Dim]; made?: Made }
  | { kind: 'mirror'; parent: BodyRef; plane: 'xy' | 'xz' | 'yz' }
  /** About `pivot` (none: the origin). */
  | { kind: 'scale'; parent: BodyRef; factor: number; pivot?: [Dim, Dim, Dim] }
  | { kind: 'linear-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: number }
  /** About `axis` through `pivot` (default the origin). */
  | { kind: 'circular-pattern'; parent: BodyRef; axis: Axis; angleDegrees: number; count: number; pivot?: [Dim, Dim, Dim] }
  | { kind: 'union'; left: BodyRef; right: BodyRef; made?: Made }
  | { kind: 'intersect'; left: BodyRef; right: BodyRef }
  | { kind: 'difference'; parent: BodyRef; tool: BodyRef }
  /** Across `axis` = at, or with `normal` across the plane normal·p = at (an oblique cut: x + y = at for [1, 1, 0]). */
  | { kind: 'split'; parent: BodyRef; at: Dim; axis: Axis; normal?: [number, number, number] }
  /** The sketch swept along straight runs and bends (from the sketch plane up +Z). */
  | { kind: 'sweep'; sketch: number; path: ({ kind: 'straight'; length: Dim } | { kind: 'bend'; radius: Dim; angleDegrees: number; toward: 'x' | '-x' | 'y' | '-y' })[] }
  /** The sketch's profile swept along a curve (a NURBS path in mm, copied from a direct curve `name`): faceted. */
  | { kind: 'sweep-curve'; sketch: number; name: string; path: { degree: number; knots: number[]; controlPoints: [number, number, number][]; weights: number[] } }
  /** A ruled loft through sketches at increasing heights (each section's edges to the next one's). */
  /** `from`: the sketches the sections were carried over from, when they lay on offset planes (used by the loft). */
  | { kind: 'loft'; sections: { sketch: number; z: Dim }[]; smooth?: boolean; from?: number[] }
  /** A body read from a STEP file (the file's text is kept in the document). */
  /** `solids`: how many solids the file holds when more than one; each is then its own body (side `part<k>`). */
  | { kind: 'import'; name: string; step: string; solids?: number }
  /** A closed triangle mesh (an STL or OBJ file's, scaled to mm from `unit`): welded vertices, three indices a triangle. */
  /**
   * A mesh: its arrays inline (`positions`, `indices`: files from before M1, and small tests), or named by blob
   * (`blob`: the SHA-256 of each array, kept in the blob store and the file's container; engine/blobs.ts).
   */
  | { kind: 'mesh'; name: string; unit: string; positions?: number[]; indices?: number[]; blob?: { positions: string; indices: string }; /** 'facets' (imports from F0 on): mesh regions; absent: one planar face per flat group, as before. */ representation?: 'facets'; /** A mesh in several closed pieces (facets only): each its own body, `b<k>_part<j>`. */ pieces?: number; /** Its repair (M3, D47): a recorded step over the original arrays, which stay. */ repair?: MeshRepairRecord; /** Where it crosses itself (not repaired; Booleans refuse it): how often, and up to 64 places. */ crossings?: { count: number; at: [number, number, number][] }; /** 'infill' (AM7b, O60): a print infill inside an exact body — in the mass and 3MF, left out of STEP. */ role?: 'infill' }
  /**
   * A modelled ISO metric thread: a rod below `seat`, a hex head bolt (`hex`) or a hex nut (`hex.internal`).
   * `form`: helical B-spline faces (`.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5`), written on every new node;
   * left out (nodes saved before 2026-10-18), a faceted helix whose `.facetK` names keep resolving.
   */
  | { kind: 'thread'; diameter: number; pitch: number; center: [number, number]; seat: number; length?: number; hex?: { across: number; height: number; internal?: true }; form?: 'helical' | 'faceted'; made?: Made }
  /** Hollowed to walls `thickness` thick, the named faces removed (none: a closed hollow). */
  | { kind: 'shell'; parent: BodyRef; thickness: Dim; open: string[] }
  /** Edges by their persistent B-rep names (they follow the features, so edits keep the selection). */
  | { kind: 'chamfer'; parent: BodyRef; edges: string[]; distance: Dim }
  /**
   * Sheet metal (R12.1, D116; the kernel's `sheet-base` / `sheet-contour`): each carries the sheet's rules — `thickness`,
   * `bendRadius` (the bends' inner radius) and `kFactor` (the neutral layer at R + K·T). A plate from a sketch, T thick
   * (`reverse`: below its plane); or an open `path` in a plane (one skin of the sheet, the material to its `side`) bent
   * at each corner and extruded `width` along the plane's normal.
   */
  | ({ kind: 'sheet-base'; sketch: number; thickness: Dim; bendRadius: Dim; reverse?: boolean } & SheetK)
  | ({ kind: 'sheet-contour'; path: [Dim, Dim][]; plane?: DocPlane; side: 'left' | 'right'; width: Dim; thickness: Dim; bendRadius: Dim } & SheetK)
  /**
   * An edge flange (R12.3, D118; the kernel's `sheet-flange`) on a sheet's straight edge, kept by its persistent name in
   * `edges` (one: the fillet's references, signatures and re-matching serve it as they do a fillet's edges).
   */
  /** A corner relief (R12.3b, D119; the kernel's `sheet-corner-relief`): the corner kept by its edge's name, as a flange's. */
  | { kind: 'sheet-corner-relief'; parent: BodyRef; edges: [string]; shape: 'square' | 'round'; size: Dim }
  | { kind: 'sheet-flange'; parent: BodyRef; edges: [string]; length: Dim; angleDegrees?: number; bendRadius?: Dim; measure?: 'outer' | 'inner' | 'tangent'; position?: 'material-inside' | 'material-outside' | 'bend-outside'; offsets?: [Dim, Dim]; relief?: { kind: 'rectangular' | 'obround'; width: Dim; depth: Dim } | { kind: 'none' } }
  /**
   * A structural member (FR1, D123; the kernel's `frame-member`): a `section` square to the line `start` → `end`, extruded
   * its length. Its `anchor` (default the centroid) on the line, the section moved by `offset`, its y along `up` (default
   * +Z) made square to the line, turned `roll` degrees. Sections by kind and their dimensions (none defaulted in the kernel)
   * or a closed sketch (node `sketch`). `estimates`: the section's fields still at a first-try value the studio filled in
   * (a radius, the T-slot's slot sizes) — the body's panel flags them; editing one drops it (D123).
   */
  /**
   * A frame (FR2, D124; the kernel's `frame`): a skeleton of `points` and `segments` (pairs of point indices, from → to),
   * one member along each, each its own body (side `part<k>`; one segment: `solid`). The frame's section and placement hold
   * for every member unless `overrides` sets one apart. `estimates` as a member's.
   */
  /** FRf (O121): a skeleton — points and straight segments several frames follow (`follows`); it makes no body. */
  | { kind: 'skeleton'; points: [Dim, Dim, Dim][]; segments: [number, number][]; name?: string; /** FRg (O122): its 3D constraints (frames/sketch3d.ts); its points stored solved. */ constraints?: Constraint3D[] }
  /**
   * `follows` (FRf, O121): the frame's points and segments are a skeleton's, or a sketch's straight edges lifted by its
   * plane, read at every evaluation (its own `points`/`segments` then a copy, not read for geometry).
   */
  | { kind: 'frame'; follows?: FrameFollows; points: [Dim, Dim, Dim][]; segments: [number, number][]; section: MemberSection; anchor?: FrameAnchor; offset?: [Dim, Dim]; roll?: number; mirror?: boolean; up?: [number, number, number]; overrides?: FrameOverride[]; corners?: FrameCorners; trims?: FrameTrim[]; estimates?: string[] }
  | { kind: 'frame-member'; section: MemberSection; start: [Dim, Dim, Dim]; end: [Dim, Dim, Dim]; anchor?: FrameAnchor; offset?: [Dim, Dim]; roll?: number; up?: [number, number, number]; estimates?: string[] }
  /** An open surface (copied from a direct surface `name`) thickened into a solid along its normal: faceted. */
  | { kind: 'thicken'; name: string; surface: { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; controlPoints: [number, number, number][][]; weights: number[][] }; thickness: Dim; side?: 'normal' | 'reverse' | 'both' }
  /**
   * An involute spur gear (R6a, issue #2167, D53–D54): module, teeth and face width, standing on z `from` about
   * `center`, turned `rotation` degrees; 20°, profile shift x from −0.5 to 1 (R6a.5a, D57). `generator` the version that made it
   * (kept with the document). With `mesh` (R6a.4b, D56) it meshes with an earlier gear (node `mesh.gear`): beside it
   * along `direction` (degrees from +X) at `centerDistance` (default the nominal m(z1 + z2)/2), turned to mesh (plus
   * `phase` degrees) and following its turn by −z1/z2 — its own centre, `from` and rotation then unused. The gear it
   * meshes with is referenced, not consumed (both stay bodies): `usesOf`, not `parentsOf`. `spur-gear@1` (R12b.1a, D130):
   * the root the basic rack generates, its tip radius `toolTipRadius` (default 0.38 m) — spur gears; `@0` the schematic root.
   */
  /**
   * A rack (R6a.5b, D58): its pitch line from `origin` along `angle` degrees, teeth to its left, the back `height`
   * below the line, standing on z `from`; with `mesh` under an earlier spur gear (node `mesh.gear`), its pitch line at
   * `centerDistance` (default r + x m) across `direction` (default −90°: below), slid to mesh (plus `phase` mm) and
   * travelling with the gear's turn. Referenced, not consumed, as a meshing gear's other gear.
   */
  /**
   * A library part (LIB3, D63): ordinary part-model features as the library made them, kept with the document (it
   * opens and evaluates without the library), and where they came from — `library` (id, version, part, variant,
   * values) — to regenerate them when the library is there. `prefix` keeps their ids apart from other library parts';
   * `outputs` are the features whose bodies are the part; `interfaces` its mating frames and faces (LIB2); `warnings`
   * its estimates and caveats, said on the body.
   */
  | { kind: 'library'; name: string; library: CadLibraryOrigin; prefix: string; features: CadPartFeature[]; outputs: string[]; interfaces: CadLibraryInterface[]; warnings: string[];
      /**
       * Added to a body (R6b, D65): turned (degrees about X, then Y, then Z) and moved into place, then united with
       * `addTo` — one step; `on` the face it was put on (its name for re-matching, the point picked) and the
       * context its checks were given (the wall there).
       */
      placement?: { rotation: [number, number, number]; position: [number, number, number] }; addTo?: BodyRef; on?: { face: string; point: [number, number, number] }; context?: Record<string, number>;
      /** Taken from `addTo` instead of united with it (an insert's hole, R6b.2). */
      cut?: boolean }
  | { kind: 'rack'; module: Dim; teeth: number; faceWidth: Dim; height: Dim; thicknessReduction?: Dim; origin: [number, number]; angle?: number; from?: number; mesh?: RackMesh; generator: 'spur-rack@0' | 'spur-rack@1'; rootFillet?: Dim }
  /**
   * An internal (ring) gear (R12b.2a, D132): module (a helical one's normal module, `helixAngle` and `hand` — its
   * pinion's hand), teeth, face width and the rim's outer diameter `rim`; profile shift x2, thickness reduction; standing
   * on z `from` about `center`, turned `rotation` degrees (tooth 1 on +X at 0). A gear meshes inside it by its `mesh`.
   */
  | { kind: 'internal-gear'; module: Dim; helixAngle?: number; hand?: 'right' | 'left'; teeth: number; faceWidth: Dim; rim: Dim; profileShift?: number; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; generator: 'internal-gear@0' | 'internal-gear@1';
    /** x2 left at the Internal gear command's default 0.5 (D132): its notes say so, as an estimate's would. */
    shiftDefault?: boolean;
    /** `internal-gear@1` (R12b.2b, D133): the pinion-type cutter that cuts its root — teeth, shift, tip radius (the default an estimate). */
    cutter?: { teeth: number; shift?: number; tipRadius?: Dim } }
  /**
   * A straight bevel gear (R12b.3, D134): the spherical involute, standard proportions, spherical ends. Module at the
   * heel, teeth, its mate's teeth and the shaft angle (90° by default) fix its pitch cone; face width along the cone;
   * a bore, a thickness reduction. Its apex at (`center`, `from`), its axis +Z (the teeth above the apex), turned
   * `rotation` degrees; or meshing with another bevel gear by `mesh` — the same apex, its axis at the shaft angle toward
   * `direction`, a space facing the other's tooth plus `phase` degrees. A meshing gear's module, teeth, mate and shaft
   * angle are its driver's (kept in step: the driver's mate is this one).
   */
  | { kind: 'bevel-gear'; module: Dim; teeth: number; mateTeeth: number; shaftAngle?: number; faceWidth: Dim; bore?: Dim; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; mesh?: BevelMesh; generator: 'bevel-gear@0';
    /**
     * A spiral bevel gear (R12b.4, D135), the ideal conjugate (flagged as an ideal model): mean spiral angle, hand, the
     * circular trace's cutter radius (`cutterEstimate`: the command's default, the mean cone distance — an estimate). A
     * meshing gear's is its driver's, the other hand.
     */
    spiral?: { angle: number; hand: 'right' | 'left'; cutterRadius: Dim; cutterEstimate?: boolean } }
  /**
   * A cylindrical worm (R12b.5, D136), ZI or ZA, meshing with a helical gear (its wheel, at β = the worm's lead angle):
   * starts, length, bore, axial thickness reduction; its axial module, diameter and hand are the wheel's (m_x = m_n /
   * cos β, d1 = z1 m_x / tan β), so it stays in step as the wheel is edited.
   */
  /**
   * A throated (single-enveloping) worm wheel (R12b.6, D137): cut by a hob of its ZA worm's thread — the worm's axial
   * module, starts, reference diameter and hand — its teeth, face width (centred on its mid-plane), bore, the spaces
   * widened by `thicknessReduction`; its axis +Z through `center` from `from`, turned `rotation`.
   */
  | { kind: 'worm-wheel'; module: Dim; starts: number; diameter: Dim; hand: 'right' | 'left'; teeth: number; faceWidth: Dim; bore?: Dim; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; generator: 'worm-wheel@0' }
  /**
   * A compression spring (R12c.1a, D153): round wire `wire` (d) on a mean coil diameter `diameter`, its active coils,
   * the body's `pitch` or the `freeLength`, its hand and ends (closed and ground by default; a dead coil each end); the
   * shear modulus G (MPa) for the rate — the command prefills steel's, flagged `shearModulusEstimate` until edited —
   * and a working `load` (N). Its axis +Z through `center` from `from`, the wire starting `rotation` degrees from +X.
   * R12c.1b (D154): `type` extension — close-wound unless `pitch`, `hooks` machine-loop or crossover, the user's
   * `initialTension` (N); torsion — `legLengths` along the coil's tangent, E (`youngsModulus`, MPa; steel's prefilled and
   * flagged an estimate) and a working `moment` (N·mm). `ends` is a compression spring's.
   */
  | { kind: 'spring'; type?: 'extension' | 'torsion'; wire: Dim; diameter: Dim; activeCoils: number; pitch?: Dim; freeLength?: Dim; hand: 'right' | 'left'; ends?: 'open' | 'closed' | 'closed-ground'; shearModulus?: number; shearModulusEstimate?: boolean; load?: number;
    hooks?: 'machine-loop' | 'crossover'; initialTension?: number; legLengths?: [number, number]; youngsModulus?: number; youngsModulusEstimate?: boolean; moment?: number; center: [number, number]; from?: number; rotation?: number; generator: 'spring@0' }
  /**
   * A shaft (R12c.3a, D156): steps along +Z from `from` through `center` — each a diameter and a length, a fillet at the
   * shoulder after it, an undercut, ring grooves and keyseats — end chamfers and cross holes. Every size is the user's
   * (the command's prefills are estimates, said so in its labels).
   */
  | { kind: 'shaft'; steps: { diameter: Dim; length: Dim; fillet?: number; undercut?: { width: number; depth: number }; grooves?: { diameter: number; width: number; at: number }[]; keyseats?: { width: number; depth: number; length: number; offset: number; ends?: 'square' | 'end-mill' | 'disc'; cutterRadius?: number; angle?: number }[] }[];
      chamfers?: [number, number]; holes?: { diameter: number; at: number; angle?: number }[]; center: [number, number]; from?: number; rotation?: number; generator: 'shaft@0' }
  /**
   * What goes on a shaft (R12c.3b, D157): a parallel key in keyseat `keyseat` of the shaft node `shaft` (its height, the
   * seat's width and length by default), checked against the hub keyway node `hub`; a keyway cut into a body's bore
   * `face`; a retaining ring's envelope in groove `groove`; a pin in cross hole `hole`. Sizes are the user's (the
   * commands' prefills are labelled estimates); they refer to the shaft and the keyway, not built on them.
   */
  /**
   * A rolling bearing (R12c.4, D158): the envelope of the user's catalogue row `row` (an id in `bearings`; none built in)
   * on step `step` of the shaft node `shaft` against the shoulder at the step's `against` end; `housing` a body node whose
   * bore takes it; the seats' fit classes from the document's fit tables. It refers to them, not built on them.
   */
  | { kind: 'bearing'; row: string; shaft: number; step: number; against: 'start' | 'end'; housing?: number; shaftClass?: string; housingClass?: string }
  | { kind: 'key'; shaft: number; keyseat: number; height: number; width?: number; length?: number; ends?: 'round' | 'square'; hub?: number }
  | { kind: 'keyway'; parent: BodyRef; face: string; width: number; depth: number; angle?: number }
  | { kind: 'retaining-ring'; shaft: number; groove: number; thickness: number; outerDiameter: number }
  | { kind: 'pin'; shaft: number; hole: number; diameter?: number; length?: number; fit?: boolean }
  | { kind: 'worm'; starts: number; form: 'ZI' | 'ZA'; length: Dim; bore?: Dim; thicknessReduction?: Dim; mesh: BevelMesh; generator: 'worm@0' }
  | { kind: 'gear';
    /** The module; a helical gear's normal module m_n (R6a.5c: `helixAngle` degrees and `hand`; a meshing gear takes the other's angle, opposite hand). */
    module: Dim; helixAngle?: number; hand?: 'right' | 'left'; teeth: number; faceWidth: Dim; profileShift?: number; bore?: Dim; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; mesh?: GearMesh; generator: 'spur-gear@0' | 'spur-gear@1'; toolTipRadius?: Dim }
  /**
   * A SubD cage (SD1, D51): quads counter-clockwise from outside, optional infinitely sharp creases (pairs of vertex
   * numbers); the body is its exact limit surface, bicubic B-spline faces `<id>.patch<k>` (a sheet when the cage has a boundary).
   */
  // (`mirror`: the cage is one half, mirrored across that plane through the origin for the body, R8.2, D81.)
  | { kind: 'subd'; name: string; cage: { positions: number[]; faces: number[][]; creases?: [number, number][] }; mirror?: 'x' | 'y' | 'z' }
  /** Direct surfaces (copied, by their names) sewn along their edges into one closed solid; edges `tolerance` mm apart still meet. */
  | { kind: 'sew'; names: string[]; surfaces: { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; controlPoints: [number, number, number][][]; weights: number[][] }[]; tolerance?: number }
  /** Draft on chosen side faces (by name) for a pull along +Z: each turned about its line on the body's bottom (positive: its top leans in). */
  | { kind: 'draft'; parent: BodyRef; faces: string[]; angleDegrees: number }
  /** IM7b (O113): a face split along its isocline n·d = 0 for the pull (the kernel's split-face, D149): its pieces `<face>#1` (the + side), `<face>#2` …, or `names`. */
  | { kind: 'split-face'; parent: BodyRef; face: string; pull: [number, number, number]; names?: string[] }
  /** `radii` (R10.5, D100): a varying radius, given at points of the edges; `radius` then the first point's. `section` (R10.5b, D103): a conic or G2 section (default a circle). */
  | { kind: 'fillet'; parent: BodyRef; edges: string[]; radius: Dim; radii?: { at: [number, number, number]; radius: Dim }[]; section?: FilletSection }
  /** Along `axis` (default z) through the body; `side` is the face it was picked on (default max). */
  /** A body in several pieces made bodies of their own (`b<i>_part<k>`). */
  | { kind: 'separate'; parent: BodyRef }
  /**
   * A mesh body simplified (R9, D85): to `ratio` of its triangles (or `triangles`), no collapse past `maxError` mm; its
   * faces keep their regions and names, its regions' boundaries and open edges kept as lines (and, with `featureAngle`,
   * edges sharper than it). The kernel's `decimate` feature; its report in the body's notes.
   */
  | { kind: 'decimate'; parent: BodyRef; ratio?: number; triangles?: number; maxError?: number; featureAngle?: number }
  /** `thread`: a tapped hole's cosmetic thread (the hole is its tap drill), e.g. "M6×1"; studio-only. */
  | { kind: 'hole'; parent: BodyRef; center: [Dim, Dim]; radius: Dim; axis?: Axis; side?: 'min' | 'max'; depth?: Dim; thread?: string; pattern?: HolePattern;
    /** The face it goes into, by name (D148): its depth and countersink from that face's plane, not the body's extreme. */ face?: string;
    /** A 90° countersink: its diameter at the face (the kernel cuts it with the hole). */ countersink?: number;
    /** (Older documents: a countersink's diameter for the callout only, its cone the three steps after the hole.) */ csk?: number };

/**
 * Copies of a hole on its face, the first at its centre: `count` in a row `step` apart (in the face's two
 * coordinates), or `count` evenly round `about` (a bolt circle). The kernel gets one hole per copy.
 */
/** A fillet's section between its contacts (R10.5b, D103): a conic of rho in (0, 1), or G2 (tension in (0, 1), default 0.5). */
export type FilletSection = { kind: 'conic'; rho: number } | { kind: 'g2'; tension?: number };
export type HolePattern = { count: number; step: [number, number] } | { count: number; about: [number, number] };
/** The centres of a hole's copies (just its centre without a pattern). */
export function holeCentres(center: readonly number[], p?: HolePattern): [number, number][] {
  const c: [number, number] = [Number(center[0]), Number(center[1])], r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  if (!p || p.count <= 1) return [c];
  if ('step' in p) return Array.from({ length: p.count }, (_, j) => [r6(c[0] + p.step[0] * j), r6(c[1] + p.step[1] * j)]);
  const dx = c[0] - p.about[0], dy = c[1] - p.about[1];
  return Array.from({ length: p.count }, (_, j) => { const a = 2 * Math.PI * j / p.count, cs = Math.cos(a), sn = Math.sin(a); return [r6(p.about[0] + dx * cs - dy * sn), r6(p.about[1] + dx * sn + dy * cs)]; });
}

import type { RenderSettings } from './render';
import type { SketchRule } from '../sketch/terms';
import type { DirectGeometry } from './direct';
import type { DrawingSettings } from '../drawing/types';
import { rotationMatrix, rotationSteps, type Mate } from '../assembly/mates';
import { flattenAssembly } from '../assembly/flatten';
import { bodyKeyFor, nextSerial, nodeIndexOf as nodeIndexOfLocal, withIds } from './ids';
import type { Sig } from './references';
import type { Requirement } from '../chat/spec';
import type { CadLibraryInterface, CadLibraryManifest, CadLibraryOrigin, CadPartFeature, MeshRepairReport, MeshRepairSteps } from '@barocss/cad';
import type { HistoryEntry, Proposal } from '../chat/proposals';

/**
 * A mesh's repair as a recorded, reversible step (M3, D47): the steps asked, the arrays they gave (their own blobs:
 * positions, indices, and each triangle's fill patch or −1) and the report. The node's own `blob` stays the import:
 * changed steps are run again from it, and removing the record is the mesh as imported.
 */
export interface MeshRepairRecord { steps: MeshRepairSteps; result: { positions: string; indices: string; fill: string }; report: MeshRepairReport }

/** A drawing's reference underlay (O68): polylines and texts in its plane's coordinates (mm). */
export interface DocUnderlay { id: string; name: string; plane?: DocPlane; draft?: string; hidden?: boolean; polylines: [number, number][][]; texts: { at: [number, number]; text: string; height: number; angle: number }[]; counts: Record<string, number> }
export interface StudioDoc {
  format: 'barocss-cad-model';
  /** 3: bodies keyed by stable ids; 2: nodes carry stable ids (`id`, `nextId`); 1: a node was named by its index. */
  schema: 1 | 2 | 3;
  /** The next feature serial to hand out (`n<nextId>`): ids are never used twice, see engine/ids.ts. */
  nextId?: number;
  units: 'mm';
  parameters: Record<string, number>;
  /**
   * Libraries written for this document (LIB4, D64), by an agent or a person: data, checked on load like any other;
   * an agent's stays marked until a person confirms it (and only then may it be shared with the team).
   */
  libraries?: { library: CadLibraryManifest; authoredBy: 'agent' | 'person'; confirmed?: boolean }[];
  /** The process the part is made by (R6b.7, D67): a process profile's id (injection, fdm, sla, sls, mjf) — its rules' thresholds. */
  process?: string;
  /** The printer it is printed on (AM1, D72): a printer profile's id — its build volume; its process the part's. */
  printer?: string;
  /** How it lies in the printer (AM3–AM4): the build direction in the part's coordinates (up from the bed), chosen or given. */
  print?: { direction: [number, number, number] };
  /** How it is moulded (IM1, O77; versioned): the pull direction (the mould opens along it), the surface finish (an injection profile's finish id: its least draft) and the halves the person set (IM5). */
  mould?: { version: 1; pull?: [number, number, number]; finish?: string; /** IM5 (O81): the person's halves, by face name — they decide a wall along the pull or a straddling face. */ sides?: Record<string, '+' | '-'> };
  /**
   * How it is machined (CNC7b, O102; versioned): the shop's stock list — loaded by the user, none built in (D121's
   * pattern) — and the allowance per face (mm; unset, an estimate of 1 mm is taken and said).
   */
  machining?: { version: 1; stock?: StockRow[]; allowanceMM?: number };
  /** IM8b (O108): casting's pattern — the faces machined after casting (by name), and the user's own machining allowance (mm a face) and shrinkage (a ratio, mm/mm); unset, the table's. */
  casting?: { version: 1; machined?: string[]; machiningAllowanceMM?: number; shrink?: number; /** IM8c (O109): where the metal comes in (a point on the part, mm), the person's: hot spots are fed from it. */ gate?: [number, number, number] };
  /** FRb (O116): how frames are cut — the shop's stock lengths (loaded by the user, none built in) and the saw's kerf (mm; unset, an estimate is taken and said). */
  /** R12c.2 (D155): fit tables the user loads (none built in), cylindrical faces' classes by face name, declared hole–shaft pairs (engine/fits.ts). */
  fits?: import('./fits').StudioFits;
  /** R12c.4 (D158): the user's bearing catalogue rows (none built in), each citing its source or flagged an estimate. */
  bearings?: { version: 1; rows: import('@barocss/cad').BearingRow[] };
  frames?: { version: 1; stock?: FrameStockRow[]; kerfMM?: number; /** FRc (O117): the user's section library — none built in (D122); a frame's section may name a row. */ sections?: FrameSectionRow[]; /** FRd1 (O118): the person's welds, by joint id (frames/welds.ts) — kind, size (mm), all round, the bore welded or not (theirs alone), notes; unset, the rule's. */ welds?: { joint: string; kind?: 'fillet' | 'butt'; sizeMM?: number; allRound?: boolean; inner?: boolean; notes?: string }[] };
  /** Saved sets of parameter values by name (a configuration applies its set). */
  configurations?: Record<string, Record<string, number>>;
  /**
   * New revisions of placed parts waiting to be accepted, by part definition (PartInstance.part.id):
   * loaded on purpose, they change no instance until accepted.
   */
  pendingParts?: Record<string, { doc: StudioDoc; rev: string; name: string }>;
  nodes: ModelNode[];
  outputs: Record<string, BodyRef>;
  /** How the part is rendered (the Render workspace); absent until first rendered. */
  render?: RenderSettings;
  /** NURBS curves and surfaces beside the model (imported CAD sources and what tools made of them). */
  direct?: DirectGeometry;
  /** Other parts placed beside this one (a simple assembly). */
  instances?: PartInstance[];
  /** The 2D drawing of the part (the Drawing workspace); absent until first drawn. */
  drawing?: DrawingSettings;
  /**
   * Bodies' own names, colours and visibility, by the feature each body was first made by (`b<k>` for its
   * stable id `n<k>`, with `_<side>` for a split's or an import's parts): they stay with a body as features are
   * added to it, and as features before it are deleted or moved.
   */
  bodies?: Record<string, BodyLook>;
  /** Mates placing instances by their faces (see assembly/mates.ts). */
  mates?: Mate[];
  /** The assembly read as a robot: its base link, joint limits and ratings (robot/joints.ts, RM1; versioned). */
  robot?: RobotSettings;
  /**
   * Reference underlays from imported drawings (A6.4, O68): a DXF's splines, ellipses, blocks and text as polylines and
   * texts in mm on their plane, to trace over — never geometry; `draft`: the drawing's draft, whose confirmed width scales it.
   */
  underlays?: DocUnderlay[];
  /** The brief (A6.1, O24): purpose, process, material and the rest, each with its basis and the user's words (chat/brief.ts). */
  brief?: Brief;
  /** The clarifying questions asked and their answers (A6.2, O25; chat/questions.ts): at most two batches a brief. */
  questions?: QuestionLog;
  /** Locked reference bodies, datums and keep-outs (A6.3, O26; chat/references.ts): not nodes of the part's tree. */
  references?: ReferenceSet;
  /** Features made from an image or a drawing and their dimensions to confirm (A6.4, O28; chat/drafts.ts). */
  drafts?: DraftSet;
  /** The assembly's contract, the Architect's (A8.2, O34; team/parts.ts): datums, keep-outs, hole patterns, envelopes, budgets. */
  interfaces?: Interfaces;
  /** Engineering change requests to the interfaces, decided by the user (A8.3, O35; team/ecr.ts). */
  ecrs?: EcrLog;
  /** Approval baselines: the BOM and interfaces pinned by content digest, draft → review → approved | rejected by the user, immutable once decided (A8.4b, O39; team/baseline.ts). */
  baselines?: BaselineLog;
  /** The brief as requirements with executable checks (chat/spec.ts). */
  requirements?: Requirement[];
  /** Changes agents proposed without making them, accepted or rejected ones kept (chat/proposals.ts). */
  proposals?: Proposal[];
  /** The design history: prompts, changes, proposals and decisions, compact and under a budget (chat/proposals.ts). */
  history?: HistoryEntry[];
}

/** A copy of another part placed by a rotation (degrees about X, then Y, then Z, through the origin) and a move. */
export interface PartInstance {
  id: string; name: string;
  /** The part as inserted (a sub-assembly keeps its own instances, placed as saved). */
  doc: StudioDoc;
  position: [number, number, number];
  rotation: [number, number, number];
  hidden?: boolean;
  /** Fixed in place: mates never move it. */
  grounded?: boolean;
  /**
   * The part definition it places: instances with the same id share it (a new revision accepted for one
   * is the others' too) at revision `rev`; `source` is the file it came from. Absent: a part of its own.
   */
  part?: { id: string; rev: string; source?: string };
}

/** An instance's part with its placement applied: every body rotated and moved by the part's own features. */
/** An instance's part as placed at the origin (a sub-assembly's own instances folded in as features). */
export function placedBase(inst: PartInstance): StudioDoc {
  const flat = flattenAssembly(inst.doc);
  return prefixDoc(flat, flat.nodes.length);
}
/**
 * An instance's placement as the kernel applies it to every body: the turns of `rotationSteps` in order
 * (quarter turns exactly), then the move — x' = m·x + t, m row-major.
 */
export function placementOf(inst: PartInstance): { m: number[]; t: [number, number, number] } {
  let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (const { axis, angleDegrees } of rotationSteps(inst.rotation)) m = mul3(turnMatrix(axis, angleDegrees), m);
  return { m, t: [inst.position[0], inst.position[1], inst.position[2]] };
}
/** A turn about an axis through the origin, as the kernel's rotate feature makes it. */
function turnMatrix(axis: 'x' | 'y' | 'z', deg: number): number[] {
  const k = Math.round(deg / 90);
  if (k * 90 === deg) {
    const turns = ((k % 4) + 4) % 4, c = [1, 0, -1, 0][turns], s = [0, 1, 0, -1][turns];
    return axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
  }
  const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  return axis === 'z' ? [c, -sn, 0, sn, c, 0, 0, 0, 1] : axis === 'x' ? [1, 0, 0, 0, c, -sn, 0, sn, c] : [c, 0, sn, 0, 1, 0, -sn, 0, c];
}
function mul3(a: readonly number[], b: readonly number[]): number[] {
  const out = Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return out;
}

export function placedDoc(inst: PartInstance): StudioDoc {
  // (A sub-assembly: its own instances folded in as features, see assembly/flatten.ts.)
  const base = placedBase(inst);
  let doc = base;
  for (const ref of Object.values(base.outputs)) {
    let at: BodyRef = ref;
    // (Any rotation: the kernel turns about X and Y by quarter turns only, see rotationSteps.)
    rotationSteps(inst.rotation).forEach(({ axis, angleDegrees }) => {
      doc = { ...doc, nodes: [...doc.nodes, { kind: 'rotate', parent: at, axis, angleDegrees }] };
      at = { node: doc.nodes.length - 1, side: 'solid' };
    });
    if (inst.position.some(v => v !== 0)) {
      doc = { ...doc, nodes: [...doc.nodes, { kind: 'translate', parent: at, offset: [...inst.position] }] };
    }
  }
  return prefixDoc(doc, doc.nodes.length);
}

/**
 * Every StudioDoc field, checked at compile time to be all of them (as NODE_EXTRA_FIELDS for nodes): `carryOver`
 * and the field test go by this list, so a new field is carried through commits or fails the test.
 */
export const STUDIO_DOC_FIELDS = ['format', 'schema', 'nextId', 'units', 'parameters', 'configurations', 'pendingParts', 'nodes', 'outputs', 'render', 'direct', 'instances', 'drawing', 'bodies', 'mates', 'robot', 'underlays', 'brief', 'questions', 'references', 'drafts', 'interfaces', 'ecrs', 'baselines', 'requirements', 'proposals', 'history', 'libraries', 'process', 'printer', 'print', 'mould', 'machining', 'casting', 'frames', 'fits', 'bearings'] as const satisfies readonly (keyof StudioDoc)[];
export const _docFieldsComplete: [Exclude<keyof StudioDoc, typeof STUDIO_DOC_FIELDS[number]>] extends [never] ? true : never = true;
/** The fields a command makes from the model (the rest are the document's own: looks, render, requirements …). */
const MODEL_FIELDS: ReadonlySet<string> = new Set(['nodes', 'outputs']);
/**
 * A command's result `next`, built on the evaluated document `was`, with every field it left as it found there
 * taken from the document `doc` as it is now (the evaluated one follows model edits only): nothing the document
 * holds is dropped because a command rebuilt it from a copy.
 */
export function carryOver(next: StudioDoc, was: StudioDoc, doc: StudioDoc): StudioDoc {
  // A change built on the document itself is its own newest: what it cleared stays cleared. (Told by its model
  // being the document's very nodes, or by a field it holds that only the document has.)
  if (next.nodes === doc.nodes || STUDIO_DOC_FIELDS.some(k => !MODEL_FIELDS.has(k) && doc[k] !== undefined && doc[k] !== was[k] && next[k] === doc[k])) return next;
  const out: Record<string, unknown> = { ...next };
  for (const k of STUDIO_DOC_FIELDS) if (!MODEL_FIELDS.has(k) && next[k] === was[k] && doc[k] !== was[k]) { if (doc[k] === undefined) delete out[k]; else out[k] = doc[k]; }
  return out as unknown as StudioDoc;
}

export const emptyDoc = (): StudioDoc => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 });

export const isSolidNode = (node: ModelNode) => node.kind !== 'sketch' && node.kind !== 'skeleton';

/** A gear meshing with an earlier one (node `gear`). */
export interface GearMesh { gear: number; direction?: number; centerDistance?: Dim; phase?: number }
/** A bevel gear meshing with another (R12b.3): the gear, the direction about its axis (degrees), the phase. */
export interface BevelMesh { gear: number; direction?: number; phase?: number }
/** A rack meshing with an earlier spur gear (node `gear`); `phase` in mm along the rack. */
export interface RackMesh { gear: number; direction?: number; centerDistance?: Dim; phase?: number }

/**
 * What a node depends on: what it is built on (`parentsOf`), and what it only refers to — a meshing gear's other
 * gear. Deleting and moving features keep to these; a body's own line (its look, its steps) follows `parentsOf`.
 */
export const usesOf = (node: ModelNode): number[] => node.kind === 'bearing' ? [node.shaft, ...(node.housing !== undefined ? [node.housing] : [])] : node.kind === 'key' ? [node.shaft, ...(node.hub !== undefined ? [node.hub] : [])] : node.kind === 'retaining-ring' || node.kind === 'pin' ? [node.shaft]
  : (node.kind === 'gear' || node.kind === 'rack' || node.kind === 'bevel-gear' || node.kind === 'worm') && node.mesh ? [node.mesh.gear]
  // (A frame refers to the bodies its members are trimmed to, FR3b: not built on them.)
  : node.kind === 'frame' && node.trims?.some(t => 'body' in t) ? [...parentsOf(node), ...node.trims.flatMap(t => 'body' in t ? [t.body.node] : [])] : parentsOf(node);

export function parentsOf(node: ModelNode): number[] {
  switch (node.kind) {
    case 'sketch': return [];
    case 'extrude': case 'revolve': case 'sweep': case 'sweep-curve': case 'sheet-base': return [node.sketch];
    case 'loft': return [...node.sections.map(s => s.sketch), ...(node.from ?? [])];
    case 'library': return node.addTo ? [node.addTo.node] : [];
    case 'import': case 'mesh': case 'thread': case 'thicken': case 'sew': case 'subd': case 'gear': case 'internal-gear': case 'bevel-gear': case 'worm': case 'worm-wheel': case 'spring': case 'shaft': case 'key': case 'retaining-ring': case 'pin': case 'bearing': case 'rack': case 'sheet-contour': case 'skeleton': return [];
    case 'frame-member': return node.section.kind === 'sketch' ? [node.section.sketch] : [];
    case 'frame': return [...(node.follows && followsIndex(node.follows) !== null ? [followsIndex(node.follows)!] : []), ...[node.section, ...(node.overrides ?? []).map(o => o.section)].flatMap(sec => sec?.kind === 'sketch' ? [sec.sketch] : [])];
    case 'union': case 'intersect': return [node.left.node, node.right.node];
    case 'difference': return [node.parent.node, node.tool.node];
    default: return [node.parent.node];
  }
}

/** Solid nodes that no later solid node consumes: the visible bodies of a model prefix. */
export function leafBodies(nodes: readonly ModelNode[]): BodyRef[] {
  // Every operation consumes what it acts on (patterns and kept mirrors include the original); a split
  // side is consumed on its own.
  const consumed = new Set<string>();
  nodes.forEach(node => {
    // (A library part added to a body consumes it, as a Boolean's first body.)
    if (node.kind === 'library' && node.addTo) { consumed.add(node.addTo.side === 'solid' ? String(node.addTo.node) : `${node.addTo.node}_${node.addTo.side}`); return; }
    if (node.kind === 'sketch' || node.kind === 'skeleton' || node.kind === 'extrude' || node.kind === 'revolve' || node.kind === 'sweep' || node.kind === 'loft' || node.kind === 'import' || node.kind === 'mesh' || node.kind === 'subd' || node.kind === 'gear' || node.kind === 'internal-gear' || node.kind === 'bevel-gear' || node.kind === 'worm' || node.kind === 'worm-wheel' || node.kind === 'spring' || node.kind === 'shaft' || node.kind === 'key' || node.kind === 'retaining-ring' || node.kind === 'pin' || node.kind === 'bearing' || node.kind === 'rack' || node.kind === 'library' || node.kind === 'thread' || node.kind === 'sweep-curve' || node.kind === 'thicken' || node.kind === 'sew' || node.kind === 'sheet-base' || node.kind === 'sheet-contour' || node.kind === 'frame-member' || node.kind === 'frame') return;
    const refs = node.kind === 'union' || node.kind === 'intersect' ? [node.left, node.right] : node.kind === 'difference' ? [node.parent, node.tool] : [node.parent];
    refs.forEach(r => consumed.add(r.side === 'solid' ? String(r.node) : `${r.node}_${r.side}`));
  });
  const refs: BodyRef[] = [];
  nodes.forEach((node, index) => {
    if (!isSolidNode(node) || consumed.has(String(index))) return;
    if (node.kind === 'split') (['negative', 'positive'] as const).forEach(side => { if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
    else if (node.kind === 'import' && (node.solids ?? 1) > 1) Array.from({ length: node.solids! }, (_, k) => `part${k}` as const).forEach(side => { if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
    else if (node.kind === 'frame' && frameSegmentCount(nodes, node) > 1) Array.from({ length: frameSegmentCount(nodes, node) }, (_, k) => k).forEach(k => { const side = `part${k}` as const; if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
    else if (node.kind === 'mesh' && (node.pieces ?? 1) > 1) Array.from({ length: node.pieces! }, (_, k) => `part${k}` as const).forEach(side => { if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
    else refs.push({ node: index, side: 'solid' });
  });
  return refs;
}

/** The document evaluated at a rollback marker: nodes before it, outputs = its leaf bodies. */
export function prefixDoc(doc: StudioDoc, marker: number): StudioDoc {
  // (Every node with its stable id first: a document built or read without them gets them here.)
  doc = withIds(doc);
  const nodes = doc.nodes.slice(0, marker);
  const outputs: Record<string, BodyRef> = {};
  leafBodies(nodes).forEach(ref => { outputs[bodyKey(ref, nodes)] = ref; });
  return { ...doc, nodes, outputs };
}

/** A body's key: by the stable id of the node that makes it (engine/ids.ts); without the nodes, by its index. */
export const bodyKey = (ref: BodyRef, nodes?: readonly ModelNode[]) => nodes ? bodyKeyFor(nodes, ref.node, ref.side) : ref.side === 'solid' ? `b${ref.node}` : `b${ref.node}_${ref.side}`;

export function withNode(doc: StudioDoc, node: ModelNode): StudioDoc {
  // (A new feature: the next serial id, unless it brings its own, as an edit's replacement does.)
  const k = nextSerial(doc), fresh = node.id === undefined;
  const next = { ...doc, nodes: [...doc.nodes, fresh ? { ...node, id: `n${k}` } : node], nextId: fresh ? k + 1 : doc.nextId };
  return prefixDoc(next, next.nodes.length);
}

/**
 * A loft's top section from a drawn (numeric) sketch: the same shape, a circle or a rectangle, sized
 * `scale` times the sketch about the centre of its outline's box.
 */
export function loftTop(sketch: SketchNode, shape: 'scaled' | 'circle' | 'rectangle', scale: number): SketchNode {
  const pts: [number, number][] = sketch.profile === 'rectangle' ? [sketch.min, sketch.max].map(p => p.map(Number) as [number, number])
    : sketch.profile === 'circle' ? [[Number(sketch.center[0]) - Number(sketch.radius), Number(sketch.center[1]) - Number(sketch.radius)], [Number(sketch.center[0]) + Number(sketch.radius), Number(sketch.center[1]) + Number(sketch.radius)]]
      : sketch.profile === 'polygon' ? sketch.points.map(p => p.map(Number) as [number, number]) : sketch.segments.map(g => g.start.map(Number) as [number, number]);
  const lo = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], hi = [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  const c: [number, number] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], at = (p: readonly Dim[]): [number, number] => [c[0] + (Number(p[0]) - c[0]) * scale, c[1] + (Number(p[1]) - c[1]) * scale];
  // Loft sections share their plane.
  const on = sketch.plane ? { plane: sketch.plane } : {};
  if (shape === 'circle') return { kind: 'sketch', profile: 'circle', center: c, radius: Math.min(hi[0] - lo[0], hi[1] - lo[1]) / 2 * scale, ...on };
  if (shape === 'rectangle') return { kind: 'sketch', profile: 'rectangle', min: at(lo), max: at(hi), ...on };
  switch (sketch.profile) {
    case 'rectangle': return { ...sketch, min: at(sketch.min), max: at(sketch.max) };
    case 'circle': return { ...sketch, center: at(sketch.center), radius: Number(sketch.radius) * scale };
    case 'polygon': return { ...sketch, points: sketch.points.map(at) };
    case 'loop': return { ...sketch, segments: sketch.segments.map(g => g.kind === 'line' ? { ...g, start: at(g.start) } : { ...g, start: at(g.start), center: at(g.center) }) };
  }
}

/**
 * Nodes edited by hand (the feature editor, a feature's own fields): a shape's solid whose sketch or
 * itself changed is no longer what its shape values make, so it stops remembering them.
 */
export function dropStaleMade(before: readonly ModelNode[], after: ModelNode[]): ModelNode[] {
  const same = (i: number) => JSON.stringify(before[i]) === JSON.stringify(after[i]);
  // (A shape of several steps — a bolt's head, shank and their union — is stale when any of them changed.)
  const stale = (n: ModelNode, i: number) => {
    if (!('made' in n) || !n.made) return false;
    const from = i - (n.made.nodes ?? 2) + 1;
    for (let k = Math.max(0, from); k <= i; k++) if (!same(k)) return true;
    return n.kind !== 'union' && 'sketch' in n && !same(n.sketch);
  };
  return after.map((n, i) => 'made' in n && stale(n, i) ? (({ made: _made, ...rest }) => rest as ModelNode)(n as ModelNode & { made?: Made }) : n);
}
/** A shape command's solid by its shape and main sizes: Box 32×32×16, Cylinder Ø16×24, Sphere Ø20 … */
export function shapeLabel(made: Made): string {
  const v = (k: string) => fmt(Number(made.values[k])), d = (k: string) => fmt(Number(made.values[k]) * 2);
  switch (made.command) {
    case 'box': return `Box ${v('w')}×${v('d')}×${v('h')}`;
    case 'cylinder': return `Cylinder Ø${d('r')}×${v('h')}`;
    case 'sphere': return `Sphere Ø${d('r')}`;
    case 'cone': return Number(made.values.rt) > 0 ? `Frustum Ø${d('r')}–Ø${d('rt')}×${v('h')}` : `Cone Ø${d('r')}×${v('h')}`;
    case 'torus': return `Torus Ø${d('R')}×Ø${d('r')}`;
    case 'tube': return `Tube Ø${d('r')}/Ø${d('ri')}×${v('h')}`;
    case 'wedge': return `Wedge ${v('w')}×${v('d')}×${v('h')}`;
    case 'prism': return `Prism ${v('n')}-sided ${v('s')}×${v('h')}`;
    case 'fastener': {
      const size = String(made.values.size), kind = String(made.values.kind);
      return kind === 'hex-nut' ? `Nut ${size}` : kind === 'washer' ? `Washer ${size}` : `${kind === 'socket-screw' ? 'Cap screw' : kind === 'csk-screw' ? 'Csk screw' : 'Bolt'} ${size}×${String(made.values.length)}`;
    }
    default: return made.command;
  }
}
/** A plane's left side as written: [1, 1, 0] → "X+Y", [1, 0, -0.5] → "X−0.5Z". */
export function planeText(n: readonly number[]): string {
  const out = n.map((c, k) => ({ c: Math.round(c * 1000) / 1000, a: 'XYZ'[k] })).filter(t => t.c !== 0)
    .map((t, j) => `${t.c < 0 ? '−' : j ? '+' : ''}${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}${t.a}`).join('');
  return out || '0';
}
export function featureLabel(node: ModelNode, index: number, nodes: readonly ModelNode[]): string {
  const n = (v: Dim) => typeof v === 'number' ? fmt(v) : v.parameter;
  if ('made' in node && node.made) return shapeLabel(node.made);
  switch (node.kind) {
    case 'sketch': return `Sketch · ${node.profile === 'loop' ? 'outline' : node.profile}`;
    case 'extrude': {
      const s = nodes[node.sketch];
      const kind = s && s.kind === 'sketch' && s.profile === 'circle' ? 'Cylinder' : 'Extrude';
      return `${kind} ${n(node.height)}${node.draft ? ` · ${node.draft}°` : ''}`;
    }
    case 'revolve': return `Revolve ${node.angleDegrees}°`;
    case 'hole': return (node.thread ? `Tapped ${node.thread}` : `${node.countersink ? 'Countersunk' : 'Hole'} Ø${typeof node.radius === 'number' ? fmt(node.radius * 2) : node.radius.parameter}`) + (node.pattern && node.pattern.count > 1 ? ` × ${node.pattern.count}` : '');
    case 'chamfer': return `Chamfer ${n(node.distance)}`;
    case 'draft': return `Draft ${fmt(node.angleDegrees)}° × ${node.faces.length}`;
    case 'thicken': return `Thicken ${node.name} ${n(node.thickness)}`;
    case 'sheet-base': return `Sheet plate T${n(node.thickness)}`;
    case 'sheet-flange': return `Flange ${n(node.length)} · ${fmt(node.angleDegrees ?? 90)}°`;
    case 'frame-member': return `Member ${sectionLabel(node.section, n)} · ${memberLength(node)}`;
    case 'frame': { const k = frameSegmentCount(nodes, node); return `Frame ${sectionLabel(node.section, n)} · ${k} member${k === 1 ? '' : 's'}${node.follows ? ` · on ${'part' in node.follows ? `${node.follows.part}'s sketch ${node.follows.sketch}` : 'skeleton' in node.follows ? `skeleton ${node.follows.skeleton + 1}` : `sketch ${node.follows.sketch + 1}`}` : ''}`; }
    case 'skeleton': return `Skeleton${node.name ? ` ${node.name}` : ''} · ${node.points.length} points, ${node.segments.length} segments`;
    case 'sheet-corner-relief': return `Corner relief ${node.shape} ${n(node.size)}`;
    case 'sheet-contour': return `Sheet profile T${n(node.thickness)}${node.path.length > 2 ? ` · ${node.path.length - 2} bend${node.path.length > 3 ? 's' : ''}` : ''}`;
    case 'sew': return `Sew ${node.names.length} surfaces`;
    case 'fillet': return (node.radii ? `Fillet R${n(node.radii[0].radius)}→${n(node.radii[node.radii.length - 1].radius)}` : `Fillet R${n(node.radius)}`) + (node.section?.kind === 'conic' ? ` conic ρ${fmt(node.section.rho)}` : node.section?.kind === 'g2' ? ' G2' : '');
    case 'union': return 'Union';
    case 'intersect': return 'Intersect';
    case 'difference': return 'Subtract';
    case 'translate': return 'Move';
    case 'rotate': return `Rotate ${node.angleDegrees}°`;
    case 'mirror': return `Mirror ${node.plane.toUpperCase()}`;
    case 'scale': return `Scale ×${node.factor}`;
    case 'linear-pattern': return `Pattern ×${node.count}`;
    case 'circular-pattern': return `Circular ×${node.count}`;
    case 'split': return node.normal ? `Split ${planeText(node.normal)} = ${n(node.at)}` : `Split ${node.axis.toUpperCase()}=${n(node.at)}`;
    case 'separate': return 'Separate pieces';
    case 'decimate': return `Simplify mesh ${node.triangles !== undefined ? `to ${node.triangles.toLocaleString('en-US')} triangles` : node.ratio !== undefined ? `to ${+(100 * node.ratio).toPrecision(3)}%` : `within ${fmt(node.maxError ?? 0)} mm`}`;
    case 'shell': return `Shell ${n(node.thickness)}`;
    case 'import': return `Import ${node.name}`;
    case 'mesh': return `Mesh ${node.name}`;
    case 'subd': return `SubD ${node.name} (${node.cage.faces.length} ${node.cage.faces.every(f => f.length === 4) ? 'quads' : 'faces'})`;
    case 'library': return node.name;
    case 'rack': return `Rack m${typeof node.module === 'number' ? fmt(node.module) : node.module.parameter} × ${node.teeth}`;
    case 'bearing': return `Bearing ${node.row} on step ${node.step}`;
    case 'key': return `Key ${node.width !== undefined ? `${fmt(node.width)} wide, ` : ''}${fmt(node.height)} high${node.length !== undefined ? `, ${fmt(node.length)} long` : ''} in keyseat ${node.keyseat}`;
    case 'keyway': return `Keyway ${fmt(node.width)} × ${fmt(node.depth)}`;
    case 'retaining-ring': return `Retaining ring ${fmt(node.thickness)} to Ø${fmt(node.outerDiameter)} in groove ${node.groove}`;
    case 'pin': return `Pin${node.diameter !== undefined ? ` Ø${fmt(node.diameter)}` : ''} in hole ${node.hole}`;
    case 'shaft': { const L = node.steps.reduce((s, x) => s + (typeof x.length === 'number' ? x.length : NaN), 0), d = node.steps.map(x => typeof x.diameter === 'number' ? x.diameter : NaN); return `Shaft ${node.steps.length} step${node.steps.length === 1 ? '' : 's'} Ø${fmt(Math.min(...d))}–Ø${fmt(Math.max(...d))} × ${fmt(L)}${node.steps.some(x => x.keyseats?.length) ? ', keyed' : ''}`; }
    case 'spring': return node.type === 'extension' ? `Extension spring d${n(node.wire)} × Ø${n(node.diameter)}, ${fmt(node.activeCoils)} coils (${node.hooks === 'crossover' ? 'crossover hooks' : 'machine loops'})`
      : node.type === 'torsion' ? `Torsion spring d${n(node.wire)} × Ø${n(node.diameter)}, ${fmt(node.activeCoils)} coils`
      : `${node.ends === 'open' ? 'Open' : node.ends === 'closed' ? 'Closed' : 'Ground'} spring d${n(node.wire)} × Ø${n(node.diameter)}, ${fmt(node.activeCoils)} coils`;
    case 'worm-wheel': return `Throated worm wheel m_x${typeof node.module === 'number' ? fmt(node.module) : node.module.parameter} z${node.teeth}`;
    case 'worm': { const w = wormOf(node, nodes); return `Worm ${node.form} m_x${w ? fmt(+w.mx.toFixed(4)) : '?'} ×${node.starts}${w ? ` Ø${fmt(+w.d1.toFixed(3))}` : ''}`; }
    case 'bevel-gear': { const t = bevelTeeth(node, nodes), spiral = bevelSpiral(node, nodes); return `${spiral ? 'Spiral bevel gear' : 'Bevel gear'} m${typeof node.module === 'number' ? fmt(node.module) : node.module.parameter} z${t.teeth}/${t.mateTeeth}${spiral ? ' (ideal model)' : ''}`; }
    case 'internal-gear': return `${node.helixAngle ? 'Helical internal gear mn' : 'Internal gear m'}${typeof node.module === 'number' ? fmt(node.module) : node.module.parameter} z${node.teeth}`;
    case 'gear': return `${node.helixAngle || (node.mesh && nodes && helical(nodes, node.mesh.gear)) ? 'Helical gear mn' : 'Spur gear m'}${typeof node.module === 'number' ? fmt(node.module) : node.module.parameter} z${node.teeth}`;
    case 'thread': return node.hex?.internal ? `Nut M${fmt(node.diameter)}×${fmt(node.pitch)}` : `${node.hex ? 'Bolt' : 'Threaded rod'} M${fmt(node.diameter)}×${fmt(node.pitch)} × ${fmt(node.length ?? 0)}`;
    case 'loft': return `Loft ${node.sections.length} sections${node.smooth ? ' · smooth' : ''}`;
    case 'sweep': return `Pipe ${node.path.length === 1 ? '1 step' : `${node.path.length} steps`}`;
    case 'sweep-curve': return `Sweep along ${node.name}`;
  }
  return `Feature ${index + 1}`;
}

export const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

export function rectanglePart(width: number, depth: number, thickness: number): StudioDoc {
  const doc = emptyDoc();
  doc.nodes = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, depth] }, { kind: 'extrude', sketch: 0, height: thickness }];
  return prefixDoc(doc, 2);
}

export function cylinderPart(radius: number, height: number): StudioDoc {
  const doc = emptyDoc();
  doc.nodes = [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius }, { kind: 'extrude', sketch: 0, height }];
  return prefixDoc(doc, 2);
}

/** A starter part: a 64 × 32 × 8 mm plate with one hole — values the kernel admits today. */
export function starterDoc(): StudioDoc {
  const doc = rectanglePart(64, 32, 8);
  return withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [32, 16], radius: 4 });
}

/** A bevel gear's teeth and its mate's: its own, or — meshing — its driver's the other way round (R12b.3). */
export function bevelTeeth(node: Extract<ModelNode, { kind: 'bevel-gear' }>, nodes?: readonly ModelNode[]): { teeth: number; mateTeeth: number } {
  const d = node.mesh && nodes ? nodes[node.mesh.gear] : undefined;
  return d?.kind === 'bevel-gear' && d !== node ? { teeth: d.mateTeeth, mateTeeth: d.teeth } : { teeth: node.teeth, mateTeeth: node.mateTeeth };
}

/** A worm's axial module, diameter and hand from its wheel (R12b.5): m_x = m_n / cos β, d1 = z1 m_x / tan β; null when the wheel is not a helical gear. */
export function wormOf(node: Extract<ModelNode, { kind: 'worm' }>, nodes?: readonly ModelNode[]): { mx: number; d1: number; hand: 'right' | 'left' } | null {
  const g = nodes?.[node.mesh.gear];
  // (A throated wheel's worm is its hob's, R12b.6.)
  if (g?.kind === 'worm-wheel') return typeof g.module === 'number' && typeof g.diameter === 'number' ? { mx: g.module, d1: g.diameter, hand: g.hand } : null;
  if (g?.kind !== 'gear' || !g.helixAngle || typeof g.module !== 'number') return null;
  const b = g.helixAngle * Math.PI / 180, mx = g.module / Math.cos(b);
  return { mx, d1: node.starts * mx / Math.tan(b), hand: g.hand ?? 'right' };
}

/** A bevel gear's spiral (R12b.4): its own, or — meshing — its driver's of the other hand. None: straight. */
export function bevelSpiral(node: Extract<ModelNode, { kind: 'bevel-gear' }>, nodes?: readonly ModelNode[]): Extract<ModelNode, { kind: 'bevel-gear' }>['spiral'] {
  const d = node.mesh && nodes ? nodes[node.mesh.gear] : undefined;
  if (d?.kind === 'bevel-gear' && d !== node) return d.spiral ? { ...d.spiral, hand: d.spiral.hand === 'right' ? 'left' : 'right' } : undefined;
  return node.spiral;
}

/** Whether gear node `i` is helical: its own helix angle, or that of the gear it meshes with (a ring's own, R12b.2a). */
function helical(nodes: readonly ModelNode[], i: number, guard = 0): boolean {
  const n = nodes[i];
  if (n?.kind === 'internal-gear') return !!n.helixAngle;
  return n?.kind === 'gear' && guard < 64 && (!!n.helixAngle || (!!n.mesh && helical(nodes, n.mesh.gear, guard + 1)));
}

/** A member's section in a feature's label (FR1, D123): `RHS 40×40×3`, `Tube Ø33.7×2.6`, `L 50×30×5`, `C 80×40`, `T-slot 20×40`. */
export function sectionLabel(s: MemberSection, n: (v: Dim) => string): string {
  switch (s.kind) {
    case 'rect-tube': return `RHS ${n(s.width)}×${n(s.height)}×${n(s.wall)}`;
    case 'round-tube': return `Tube Ø${n(s.diameter)}×${n(s.wall)}`;
    case 'angle': return `L ${n(s.legX)}×${n(s.legY)}×${n(s.thickness)}`;
    case 'channel': return `C ${n(s.height)}×${n(s.width)}`;
    case 'tslot': return `T-slot ${n(s.size)}${s.cells === 2 ? `×${typeof s.size === 'number' ? fmt(2 * s.size) : '2a'}` : ''}`;
    case 'sketch': return `sketch ${s.sketch + 1}`;
    case 'library': return s.id;
  }
}
/** A member's length, its line's (numbers only; a parametric end reads as such). */
function memberLength(node: Extract<ModelNode, { kind: 'frame-member' }>): string {
  const p = [...node.start, ...node.end];
  if (!p.every(v => typeof v === 'number')) return 'parametric';
  const [a, b, c, d, e, f] = p as number[];
  return `${fmt(Math.hypot(d - a, e - b, f - c))} mm`;
}

type FrameNode = Extract<ModelNode, { kind: 'frame' }>;
/**
 * FRf (O121): a frame's points and segments — its own, or those it follows: a skeleton's, or a sketch's straight edges
 * (a rectangle's four, a polygon's, an outline of lines) lifted by the sketch's plane, its parameters' values read now.
 * A source that is not there, not a skeleton or sketch, curved, or a segment naming no point: refused, typed.
 */
export function frameGeometry(nodes: readonly ModelNode[], node: FrameNode, parameters: Readonly<Record<string, number>> = {}, parts?: readonly PartInstance[] | null): { points: [Dim, Dim, Dim][]; segments: [number, number][] } | { code: string; error: string } {
  if (!node.follows) return { points: node.points, segments: node.segments };
  if ('part' in node.follows) return partSketchGeometry(node.follows, parts);
  const at = followsIndex(node.follows)!, src = nodes[at];
  if ('skeleton' in node.follows) {
    if (src?.kind !== 'skeleton') return { code: 'FRAME_SKELETON_UNKNOWN', error: `the frame follows feature ${at}, which is ${src ? `a ${src.kind}` : 'not there'}, not a skeleton` };
    const bad = src.segments.findIndex(g => !(g[0] >= 0 && g[0] < src.points.length && g[1] >= 0 && g[1] < src.points.length));
    if (bad >= 0) return { code: 'FRAME_SKELETON_POINT', error: `skeleton ${at}'s segment ${bad} names point ${src.segments[bad].find(p => !(p >= 0 && p < src.points.length))}, which it does not have (${src.points.length} points)` };
    return { points: src.points, segments: src.segments };
  }
  if (src?.kind !== 'sketch') return { code: 'FRAME_SKETCH_UNKNOWN', error: `the frame follows feature ${at}, which is ${src ? `a ${src.kind}` : 'not there'}, not a sketch` };
  return sketchEdges(src, at, parameters);
}
/**
 * FRf2 (O125): a placed part's sketch by its stable id — its straight edges lifted by its plane (the part's parameters)
 * and placed by the instance's rotation and position now. `parts` null: the frame is inside a placed part, which follows
 * its own part's features only (a sibling's would need each part evaluated with its siblings: not built).
 */
function partSketchGeometry(f: { part: string; sketch: string }, parts: readonly PartInstance[] | null | undefined): { points: [Dim, Dim, Dim][]; segments: [number, number][] } | { code: string; error: string } {
  if (parts === null) return { code: 'FRAME_PART_SCOPE', error: `a placed part's frame follows only its own part's features, not ${f.part}'s sketch (that needs each part evaluated with its siblings)` };
  const inst = (parts ?? []).find(i => i.id === f.part);
  if (!inst) return { code: 'FRAME_PART_UNKNOWN', error: `the frame follows a sketch of part ${f.part}, which the assembly does not hold (parts: ${(parts ?? []).map(i => i.id).join(', ') || 'none'})` };
  const k = nodeIndexOfLocal(inst.doc.nodes, f.sketch), src = inst.doc.nodes[k];
  if (k < 0) return { code: 'FRAME_PART_FEATURE_GONE', error: `part ${f.part} has no feature ${f.sketch} now (the frame's sketch was deleted or renamed)` };
  if (src.kind !== 'sketch') return { code: 'FRAME_SKETCH_UNKNOWN', error: `part ${f.part}'s feature ${f.sketch} is a ${src.kind}, not a sketch` };
  const g = sketchEdges(src, k, inst.doc.parameters ?? {}); if ('code' in g) return g;
  const R = rotationMatrix(inst.rotation), t = inst.position;
  const points = g.points.map(p => { const q = p as [number, number, number]; return [0, 1, 2].map(r => R[3 * r] * q[0] + R[3 * r + 1] * q[1] + R[3 * r + 2] * q[2] + t[r]) as [number, number, number]; });
  return { points, segments: g.segments };
}
/** A sketch's straight edges lifted by its plane: a rectangle's four, a polygon's, an outline of lines (FRf). */
function sketchEdges(src: Extract<ModelNode, { kind: 'sketch' }>, at: number, parameters: Readonly<Record<string, number>>): { points: [Dim, Dim, Dim][]; segments: [number, number][] } | { code: string; error: string } {
  const v = (d: Dim) => typeof d === 'number' ? d : parameters[d.parameter] ?? NaN;
  let uv: [number, number][];
  if (src.profile === 'rectangle') { const [a, b] = [src.min.map(v), src.max.map(v)]; uv = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]; }
  else if (src.profile === 'polygon') uv = src.points.map(p => [v(p[0]), v(p[1])]);
  else if (src.profile === 'loop' && src.segments.every(g => g.kind === 'line')) uv = src.segments.map(g => [v(g.start[0]), v(g.start[1])]);
  else return { code: 'FRAME_SKETCH_CURVED', error: `sketch ${at} (${src.profile}) has curved edges: a frame follows straight ones only (a rectangle, a polygon, an outline of lines)` };
  if (uv.some(p => !p.every(Number.isFinite))) return { code: 'FRAME_SKETCH_UNKNOWN', error: `sketch ${at} names a parameter that is not set` };
  const pl = src.plane ?? { origin: [0, 0, 0] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] };
  const n = pl.normal, x = pl.xAxis, y: [number, number, number] = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
  const points = uv.map(([a, b]) => [0, 1, 2].map(k => pl.origin[k] + a * x[k] + b * y[k]) as [number, number, number]);
  return { points, segments: points.map((_, k) => [k, (k + 1) % points.length] as [number, number]) };
}
/** How many members a frame has (its geometry's segments; refused, its own copy's). */
export function frameSegmentCount(nodes: readonly ModelNode[], node: FrameNode): number { const g = frameGeometry(nodes, node); return 'segments' in g ? g.segments.length : node.segments.length; }
