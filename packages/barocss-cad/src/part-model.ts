// The B-rep part model (brep-core step 6): an authored feature list evaluated entirely on the shared
// B-rep. Every output is one B-rep with persistent face and edge names; there are no per-family body
// types and no fixed node, Boolean or finishing-operation counts.
//
//   representation   a body stays a Z-prismatic solid (lines, arcs; Booleans slab-wise, curved walls)
//                    while every operation keeps it upright; otherwise it is a general B-rep. Its
//                    Booleans are the exact planar-polyhedron Booleans for planar bodies, and the
//                    analytic Booleans otherwise: planes and cylinders of any axis exactly, and any
//                    other surface (revolved tori and cones) by intersection curves traced onto both
//                    surfaces; configurations they cannot represent (inputs touching along an edge or
//                    at a point, profiles touching the revolve axis) are refused with the reason
//   names            features have stable ids; faces are named `<feature>.<role>` (`e1.side0`,
//                    `e1.top`, `h2.side0`, `c3.face`), kept through every later feature, `#k` when one
//                    name is split; copies are `@k` (patterns) and `@m` (kept mirrors); an edge is named
//                    by its two faces. Chamfers and fillets select edges by these names, so a selection
//                    survives parameter edits that keep the topology.
//   references       `id` (all parts of a feature) or `id/k` (part k: the sides of a split)
import { BrepError, buildBrep, checkBrep, isFacetFace, lineCurve, mergeBreps, nurbsOf, type Brep, type BrepCheckReport } from './brep-core.js';
import { brepFromPrismatic, booleanPrismatic, prismaticExtrude, prismaticFromProfile, prismaticVolume, transformPrismatic, PrismaticSolidError, type PrismaticSolid } from './prismatic-solid.js';
import { erodeSection } from './section-offset.js';
import { booleanCurveRegions, curveTolerance, regionMoments, sampleRing, segEnd, segReverse, CurvedArrangementError, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import { booleanPolyhedra } from './polyhedral-boolean.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { faceReach, finishBrepEdges } from './edge-finish.js';
import { draftedExtrusion } from './drafted-extrusion.js';
import { exportStep, importStep, stepTessellatedChars } from './step.js';
import { brepFromTriangles, MeshBrepError } from './mesh-brep.js';
import { facetBrepFromTriangles, facetBrepsFromTriangles, weldVertices } from './facet-brep.js';
import { splitFacetBrep, type FacetSplitResult } from './facet-split.js';
import { facetBoolean, FacetBooleanError, splitMixedBrep } from './facet-boolean.js';
import { selfIntersections } from './mesh-repair.js';
import { threadSolid } from './thread-solid.js';
import { sweepSolid } from './sweep-solid.js';
import { validateCurve, validateSurface } from './math.js';
import { thickenSolid } from './thicken-solid.js';
import { sewSolid, SewError } from './sew-solid.js';
import { buildSubd, subdSummary, SubdError, type SubdSummary } from './subd.js';
import { decimateMesh, type DecimateReport } from './mesh-decimate.js';
import type { FilletReport } from './rolling-ball.js';
import { SIDE_TAG, type SideTags } from './side-names.js';
import { spurRack, type SpurRackReport, type SpurRackSpec } from './gear-rack.js';
import { spurGear, spurGearCenterDistance, spurGearDimensions, GearError, type GearDiagnosticCode, type SpurGearReport, type SpurGearSpec } from './gear.js';
import { revolveProfile, revolveMassProperties, type RevolveInput } from './revolve.js';
import { transformBrep, quarterTurn, type BrepAffine } from './brep-transform.js';
import { tessellateBrep } from './brep-tessellate.js';
import { combineMassProperties, prismaticMassProperties, brepMassProperties, brepSurfaceArea, SolidMassError, type SolidMassProperties } from './solid-mass.js';
import { glueAtSharedFace, withCavities } from './brep-glue.js';
import { loftSolid } from './loft.js';
import { generalShell } from './general-shell.js';
import { offsetCavity, offsetShell, smoothOffsetBody } from './offset-cavity.js';
import { regionShell } from './region-shell.js';
import { meshInnerOffset, type MeshShellReport } from './mesh-offset.js';
import { bendAllowance, bendDeduction, bendTableProblem, contourFlangeSection, flangeSection, lookupBend, outsideSetback, SheetMetalError, type BendTable, type BendTableUse, type SheetReport } from './sheet-metal.js';
import { flatPattern as flatPatternOf, FlatPatternError, type FlatPattern } from './sheet-flat.js';
import { ExtrudedProfileError, buildProfileLoop, type ProfileSegmentInput } from './extruded-profile-solid.js';
import type { FacetPatch, Point } from './types.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import { encodeBinaryStl } from './stl.js';

export type CadPartDim = number | { readonly parameter: string };
export type CadPartAxis = 'x' | 'y' | 'z';
export type CadPartPoint2 = readonly [CadPartDim, CadPartDim];
export type CadPartPoint3 = readonly [CadPartDim, CadPartDim, CadPartDim];
export type CadPartLoopSegment = { readonly kind: 'line'; readonly start: CadPartPoint2 } | { readonly kind: 'arc'; readonly start: CadPartPoint2; readonly center: CadPartPoint2; readonly direction: 'ccw' | 'cw' };
type Base = { readonly id: string };
/**
 * Where a sketch lies: its X runs along `xAxis` and its Y along normal × xAxis from `origin`, and its
 * solids grow along `normal` (both directions are unit vectors after normalising); any plane, tilted
 * ones included. A body built on a plane with a vertical axis stays upright (exact, prismatic); on any
 * other it is a general B-rep. Without a plane a sketch lies on XY at Z 0.
 */
export interface CadPartSketchPlane { readonly origin: CadPartPoint3; readonly normal: readonly [number, number, number]; readonly xAxis: readonly [number, number, number] }
/**
 * `regions`: more closed loops of material beside the profile; `holes`: closed loops cut from them (a
 * plate with windows, two bosses at once). Only straight extrudes take them.
 */
/**
 * `sideTags` (R10a, D86): a stable id for each side of the outer loop (a rectangle's 4, a circle's 1, a polygon's points,
 * a loop's segments), of each region loop and of each hole loop — letters, digits, `_`, `-`, unique in the sketch.
 * With them every wall a body makes of the sketch is named `<id>.side[<tag>]` (a vertex inserted or a segment removed
 * leaves the others' names); without, by position as before (`side<i>`, `region<r>.side<i>`, `hole<h>.side<i>`).
 */
type Placed = { readonly plane?: CadPartSketchPlane; readonly regions?: readonly (readonly CadPartLoopSegment[])[]; readonly holes?: readonly (readonly CadPartLoopSegment[])[]; readonly sideTags?: CadPartSideTags };
export type CadPartSideTags = SideTags;
export type CadPartFeature = Base & (
  | ({ readonly kind: 'sketch'; readonly profile: 'rectangle'; readonly min: CadPartPoint2; readonly max: CadPartPoint2 } & Placed)
  | ({ readonly kind: 'sketch'; readonly profile: 'circle'; readonly center: CadPartPoint2; readonly radius: CadPartDim } & Placed)
  | ({ readonly kind: 'sketch'; readonly profile: 'polygon'; readonly points: readonly CadPartPoint2[] } & Placed)
  | ({ readonly kind: 'sketch'; readonly profile: 'loop'; readonly segments: readonly CadPartLoopSegment[] } & Placed)
  /** Along the sketch normal (+Z) from `from` (default 0); a negative height extrudes the other way. */
  /** `draft` (degrees, |θ| < 89) leans every wall into the material away from the sketch plane. */
  | { readonly kind: 'extrude'; readonly sketch: string; readonly height: CadPartDim; readonly from?: CadPartDim; readonly draft?: number }
  /** About an axis in the sketch plane (through `origin`, along X or Y), by angleDegrees (default 360). */
  | { readonly kind: 'revolve'; readonly sketch: string; readonly axis: { readonly origin: CadPartPoint2; readonly direction: 'x' | 'y' | readonly [number, number] }; readonly angleDegrees?: number }
  | { readonly kind: 'union' | 'difference' | 'intersect'; readonly target: string; readonly tool: string }
  /**
   * A hole along `axis` (default z) through the target, or `depth` deep from its `side` (default max:
   * the top for z). `center` is in the other two coordinates in order: z → [x, y], x → [y, z], y → [x, z].
   */
  | { readonly kind: 'hole'; readonly target: string; readonly center: CadPartPoint2; readonly radius: CadPartDim; readonly depth?: CadPartDim; readonly axis?: CadPartAxis; readonly side?: 'min' | 'max'; /** A 90° countersink: its diameter at the face (wider than the hole). */ readonly countersink?: CadPartDim }
  | { readonly kind: 'translate'; readonly target: string; readonly offset: CadPartPoint3 }
  /** About an axis through `pivot` (default the origin) by any angle; off quarter turns about X or Y the body leaves the upright family. */
  | { readonly kind: 'rotate'; readonly target: string; readonly axis: CadPartAxis; readonly angleDegrees: number; readonly pivot?: CadPartPoint3 }
  /** Mirror in a coordinate plane through the origin; `keep` also keeps the original (one body). */
  | { readonly kind: 'mirror'; readonly target: string; readonly plane: 'xy' | 'xz' | 'yz'; readonly keep?: boolean }
  | { readonly kind: 'scale'; readonly target: string; readonly factor: number; readonly pivot?: CadPartPoint3 }
  /** `count` copies (the original included) joined into one body. */
  | { readonly kind: 'linear-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly spacing: CadPartDim; readonly count: number }
  /** Copies k·angleDegrees about the axis through `pivot` (about X or Y: multiples of 90°). */
  | { readonly kind: 'circular-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly angleDegrees: number; readonly count: number; readonly pivot?: CadPartPoint3 }
  /**
   * Parts /0 (below `at`) and /1 (above): across the plane `axis` = at, or with `normal` (any direction,
   * not necessarily unit) across the plane normal·p = at — x + y = at for [1, 1, 0], a mitre.
   */
  | { readonly kind: 'split'; readonly target: string; readonly axis?: CadPartAxis; readonly normal?: CadPartPoint3; readonly at: CadPartDim }
  /**
   * The sketch's profile swept along a path through its centroid, from the sketch plane up +Z: straight
   * runs and bends of a radius (to the path) towards ±X or ±Y (as a pipe is bent), each from where the
   * last ended.
   */
  | { readonly kind: 'sweep'; readonly sketch: string; readonly path: readonly CadPartSweepStep[] }
  /**
   * A ruled loft through sketches placed at increasing heights: each section's edges joined by straight
   * rulings to the next one's (edge counts are evened out by halving the longest edges). Faces
   * `${id}.bottom`, `.top`, `.side${i}` (two sections) or `.s${k}.side${i}`. `smooth` (three or more
   * sections): one smooth side per edge through them all (C1), named `.side${i}`.
   */
  | { readonly kind: 'loft'; readonly sections: readonly CadPartLoftSection[]; readonly smooth?: boolean }
  /**
   * A body read from a STEP file (its text); its faces keep their names, prefixed `${id}.`. `each`: every
   * solid of the file is its own part (`id/k`, in file order) instead of one body holding them all.
   */
  | { readonly kind: 'import'; readonly step: string; readonly each?: boolean }
  /**
   * A closed triangle mesh (an STL or OBJ file's, in mm): `positions` x, y, z per vertex, `indices` three a
   * triangle. `representation: 'facets'` (new imports, F0): facet faces, the mesh grouped into regions named
   * `${id}.region${k}`. Absent (or 'planar', documents made before F0): a planar solid, triangles flat against
   * each other one face, named `${id}.facet${k}` — kept so old documents' names resolve.
   */
  /**
   * `each` (with facets): every closed piece of the mesh a part of its own (`id/j`), its faces `${id}.part${j}.region${k}`.
   * `positions` and `indices` may be typed arrays (Float64Array or Float32Array; Uint32Array): taken as they are —
   * not copied, frozen or written into the reuse key (hashed once per array); never changed after they are passed.
   */
  /**
   * `open` (facets): an open mesh taken as a sheet body (what repair could not close: no volume, no Booleans), never
   * assumed. `groups`: per triangle, the repair fill patch it belongs to (≥ 0, its own faces `….fill<k>.region<f>`) or −1.
   */
  | { readonly kind: 'mesh'; readonly positions: readonly number[] | Float64Array | Float32Array; readonly indices: readonly number[] | Uint32Array; readonly representation?: 'facets' | 'planar'; readonly each?: boolean; readonly open?: boolean; readonly groups?: readonly number[] | Int32Array }
  /**
   * A modelled ISO metric thread (faceted helix, one solid with no Boolean): a rod of `length` below
   * `seat` on the axis through `center`; with `hex`, a hex head bolt (head above the seat), or with
   * `hex.internal` a hex nut above the seat threaded through.
   */
  /**
   * The sketch's profile swept along a curve (any NURBS path in mm): its middle starts on the path's
   * start, square to it, carried along without twisting; the ends capped; holes run through. Faceted.
   */
  | { readonly kind: 'sweep-curve'; readonly sketch: string; readonly path: { readonly degree: number; readonly knots: readonly number[]; readonly controlPoints: readonly (readonly [number, number, number])[]; readonly weights: readonly number[] } }
  /**
   * Draft (taper) on chosen side faces for a pull along +Z: each planar face square to Z turns about its
   * line on the neutral plane (default: the body's bottom) by `angleDegrees` — positive leans its top
   * in (material taken off), negative out (material added). The faces by name.
   */
  | { readonly kind: 'draft'; readonly target: string; readonly faces: readonly string[]; readonly angleDegrees: number; readonly neutral?: CadPartDim }
  /** An open NURBS surface thickened into a solid: `thickness` along its normal (or against it, or half each way). Faceted. */
  | { readonly kind: 'thicken'; readonly surface: { readonly degreeU: number; readonly degreeV: number; readonly knotsU: readonly number[]; readonly knotsV: readonly number[]; readonly controlPoints: readonly (readonly (readonly [number, number, number])[])[]; readonly weights: readonly (readonly number[])[] }; readonly thickness: CadPartDim; readonly side?: 'normal' | 'reverse' | 'both' }
  /**
   * Open NURBS surfaces sewn into one closed solid along their natural edges (each edge shared by exactly
   * two of them within `tolerance` mm); the faces keep their exact surfaces.
   */
  /**
   * SD1 (R5): a SubD cage — faces counter-clockwise from outside, optional infinitely sharp creases — as its limit
   * surface (OpenSubdiv rules; boundary edges and corners interpolated): bicubic B-spline faces `${id}.patch<k>`, a
   * solid when the cage is closed, a sheet when it has a boundary. SD2 (R7): with extraordinary vertices, n-gons or
   * darts, one or two Catmull–Clark steps, exact faces `${id}.patch<label>` away from them and G1 caps
   * `${id}.cap<label>` at them.
   */
  | { readonly kind: 'subd'; readonly cage: { readonly positions: readonly number[] | Float64Array; readonly faces: readonly (readonly number[])[]; readonly creases?: readonly (readonly [number, number])[] } }
  | { readonly kind: 'sew'; readonly surfaces: readonly { readonly degreeU: number; readonly degreeV: number; readonly knotsU: readonly number[]; readonly knotsV: readonly number[]; readonly controlPoints: readonly (readonly (readonly [number, number, number])[])[]; readonly weights: readonly (readonly number[])[] }[]; readonly tolerance?: number }
  /**
   * R6a (issue #2167, D53–D54): an involute spur gear on the XY plane, about `center`, from z `from` through
   * `faceWidth` — 20°, no profile shift in this stage (other input refused with its code). Faces `<id>.flankL#k`,
   * `.flankR#k`, `.tip#k`, `.root#k`, `.rootL#k`/`.rootR#k`, `.face0`/`.face1`, `.bore#1/2`; its report (dimensions,
   * the measured flank deviation, the schematic root's warning) is the output's `gear`. `generator` records the
   * version that made it.
   */
  | { readonly kind: 'spur-gear';
    /** A spur gear's module; a helical gear (`helixAngle` and `hand`, R6a.5c) gives `normalModule` instead. */
    readonly module?: CadPartDim; readonly normalModule?: CadPartDim; readonly helixAngle?: number; readonly hand?: 'right' | 'left'; readonly teeth: number; readonly faceWidth: CadPartDim; readonly pressureAngle?: number; readonly profileShift?: number; readonly bore?: CadPartDim; readonly thicknessReduction?: CadPartDim; readonly profileTolerance?: number; readonly center?: CadPartPoint2; readonly from?: CadPartDim;
    /** Turned about its axis (degrees; tooth 1 on +X at 0). */
    readonly rotation?: number;
    /**
     * Meshing with another spur gear (R6a.4, D56): placed beside it — on its face plane, at `centerDistance` (default
     * the one without backlash: m(z1 + z2)/2, or the working one for shifted gears) along `direction` (degrees from +X) — and turned so its teeth mesh (a space facing the
     * other's tooth on the line of centres, plus `phase` degrees), following the other's turn by −z1/z2. Its own
     * `center`, `from` and `rotation` are then not used.
     */
    readonly mesh?: { readonly gear: string; readonly direction?: number; readonly centerDistance?: CadPartDim; readonly phase?: number };
    readonly generator?: 'spur-gear@0' }
  /**
   * A rack (R6a.5b, D58): its pitch line from `origin` along `angle` degrees (teeth to its left, the back `height` below
   * the line), standing on z `from`; or, with `mesh`, under a spur gear — its pitch line `centerDistance` from the gear's
   * axis (default r + x m) across `direction` (degrees from +X, the axis to the pitch point), on the gear's face plane,
   * slid so its middle gap meets a tooth (plus `phase` mm) and travelling r per radian of the gear's turn.
   */
  | { readonly kind: 'spur-rack';
    /** A straight rack's module; a helical rack's `normalModule`, `helixAngle` and `hand` (meshing: taken from the gear, the opposite hand). */
    readonly module?: CadPartDim; readonly normalModule?: CadPartDim; readonly helixAngle?: number; readonly hand?: 'right' | 'left'; readonly teeth: number; readonly faceWidth: CadPartDim; readonly height: CadPartDim; readonly pressureAngle?: number; readonly thicknessReduction?: CadPartDim;
    readonly origin?: CadPartPoint2; readonly angle?: number; readonly from?: CadPartDim;
    readonly mesh?: { readonly gear: string; readonly direction?: number; readonly centerDistance?: CadPartDim; readonly phase?: CadPartDim };
    readonly generator?: 'spur-rack@0' }
  | { readonly kind: 'thread'; readonly diameter: CadPartDim; readonly pitch: CadPartDim; readonly center?: CadPartPoint2; readonly seat?: CadPartDim; readonly length?: CadPartDim; readonly hex?: { readonly across: CadPartDim; readonly height: CadPartDim; readonly internal?: boolean };
    /** `helical` (B-spline faces `.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5`…) or `faceted` (`.facet${k}`). Left out: faceted, the form documents written before helical became the default keep (their names keep resolving). New documents write `helical`. */
    readonly form?: 'faceted' | 'helical' }
  /**
   * A body in several pieces (a cut right through it) as one part per piece, `id/0`, `id/1` … in the
   * order of its B-rep's bodies; refused for a body in one piece.
   */
  | { readonly kind: 'separate'; readonly target: string }
  /**
   * R9 (M4, D85): a mesh body (facet faces) simplified by edge collapse under the quadric error metric — to
   * `triangles`, or a `ratio` of its triangles, no collapse past `maxError` mm (its quadric bound). Its faces keep
   * their regions and names: the regions' boundaries (where the mesh's creases are) and open edges are kept as lines,
   * and with `featureAngle` (degrees) any edge sharper than it too — left out, none (a scan's noise is no crease). The
   * output's `decimate` reports the counts and the measured distance both ways.
   */
  | { readonly kind: 'decimate'; readonly target: string; readonly triangles?: number; readonly ratio?: number; readonly maxError?: CadPartDim; readonly featureAngle?: number }
  /**
   * Sheet metal (R12.1, D116). Each sheet feature gives its rules, none defaulted: `thickness` T, `bendRadius` R (its
   * bends' inner radius) and `kFactor` K from 0 to 1 (the neutral layer at R + K·T: a bend's developed length is
   * θ(R + K·T)). The output reports them and its bends (`sheet`).
   * `sheet-base`: a plate from a closed sketch (one loop, holes allowed), T thick from its plane along its normal
   * (`reverse`: the other way); its faces an extrude's (`top`, `bottom`, the sides).
   * `sheet-contour`: an open `path` of 2–64 points in a plane (`plane`, default XY) is one skin of the sheet, the material
   * T thick to its `side` (looking along it), a bend of inner radius R at each corner, extruded `width` along the plane's
   * normal. Faces: `.leg<i>.a` (on the path) and `.leg<i>.b`, `.bend<k>.inner` / `.outer` (k the corner's point),
   * `.start` / `.end` (the path's ends), `.front` (in the plane) and `.back`.
   */
  | ({ readonly kind: 'sheet-base'; readonly sketch: string; readonly thickness: CadPartDim; readonly bendRadius: CadPartDim; readonly reverse?: boolean } & CadPartSheetK)
  | ({ readonly kind: 'sheet-contour'; readonly path: readonly CadPartPoint2[]; readonly plane?: CadPartSketchPlane; readonly side: 'left' | 'right'; readonly width: CadPartDim; readonly thickness: CadPartDim; readonly bendRadius: CadPartDim } & CadPartSheetK)
  /**
   * An edge flange (R12.3, D118) on a sheet (its rules from its report): on a straight `edge` between a planar skin face
   * and a thickness face, bent `angleDegrees` (default 90, in (0, 180)) towards that skin's outside, inner radius
   * `bendRadius` (default the sheet's). `length` to the outer virtual sharp (`measure` 'outer', the default), the inner
   * one ('inner'), or from the bend's tangent ('tangent'). `position`: 'material-inside' (the default: the outer virtual
   * sharp on the edge, the plate trimmed back by (R + T)·tan(θ/2)), 'material-outside' (the inner one on the edge,
   * trimmed R·tan(θ/2)) or 'bend-outside' (the bend from the edge). `offsets` [from the edge's start, from its end] (mm,
   * default 0) narrow it; at an end inside the edge a `relief` is cut into the plate — 'rectangular' or 'obround', its
   * `width` and `depth` past the bend given (no defaults, D119), or 'none'; left out there, refused `RELIEF_REQUIRED`. Faces `<id>.bend.inner/outer`,
   * `.leg.inner/outer`, `.tip`, `.start`, `.end`, the plate's cut `<id>.trim.*` and `<id>.relief<k>.*`. Refused by name:
   * `NOT_A_SHEET`, `EDGE_NOT_SHEET`, `BEND_ANGLE`, `BEND_DOES_NOT_FIT`, `FLANGES_COLLIDE`, `SHEET_IN_PIECES`, `RELIEF_REQUIRED`.
   */
  /**
   * A corner relief (R12.3b, D119) on a sheet's plate, before the flanges of the corner's two edges: at the square convex
   * corner whose thickness `corner` names (the edge between two thickness faces, T long), the plate's corner cut away — a
   * `square` of side `size` along both edges, or a `round` quarter of radius `size` about the corner — through the sheet.
   * Flanges then on both edges, full length, stop `size` from the corner: past their setback they meet nowhere. Refused
   * by name: `NOT_A_SHEET`, `EDGE_NOT_SHEET`, `CORNER_NOT_SQUARE` (CAPABILITY), `CORNER_NOT_CLEAR` (the cut would take more
   * or other than the plate's corner: a flange or a cut already there, a size past the plate).
   */
  | { readonly kind: 'sheet-corner-relief'; readonly target: string; readonly corner: string; readonly shape: 'square' | 'round'; readonly size: CadPartDim }
  | { readonly kind: 'sheet-flange'; readonly target: string; readonly edge: string; readonly length: CadPartDim; readonly angleDegrees?: number; readonly bendRadius?: CadPartDim; readonly measure?: 'outer' | 'inner' | 'tangent'; readonly position?: 'material-inside' | 'material-outside' | 'bend-outside'; readonly offsets?: readonly [CadPartDim, CadPartDim]; readonly relief?: { readonly kind: 'rectangular' | 'obround'; readonly width: CadPartDim; readonly depth: CadPartDim } | { readonly kind: 'none' } }
  /** Hollowed to walls `thickness` thick; `open` names the faces removed (the top of a box, a side). */
  | { readonly kind: 'shell'; readonly target: string; readonly thickness: CadPartDim; readonly open?: readonly string[] }
  | { readonly kind: 'chamfer'; readonly target: string; readonly edges: readonly string[]; readonly distance: CadPartDim }
  /** Vertical edges of upright bodies. */
  /**
   * `radius` rounds the edges with one radius. `radii` instead gives the radius at points of the edges (2–16, each on
   * one of them; R10.5, D100): between them it varies smoothly by arc length along each chain (shape-preserving cubic,
   * two points: linear), carried on at its end slopes past the outer points of an open chain (it must stay positive
   * to the chain's ends), periodic round a closed one. Give one of them.
   */
  /**
   * `section` (R10.5b, D103): the fillet's shape across — `circular` (the default, the rolling ball's arc); `conic` with
   * `rho` in (0, 1) (0.5 a parabola, less flatter, more fuller); `g2`, curvature-continuous with the faces, `tension` in
   * (0, 1) (0.5 when left out). Not circular: the rolling ball's chains, not where it rolls round or onto an edge.
   */
  | { readonly kind: 'fillet'; readonly target: string; readonly edges: readonly string[]; readonly radius?: CadPartDim; readonly radii?: readonly { readonly at: CadPartPoint3; readonly radius: CadPartDim }[]; readonly section?: { readonly kind: 'circular' } | { readonly kind: 'conic'; readonly rho: number } | { readonly kind: 'g2'; readonly tension?: number } }
);
/**
 * A sheet's K (R12.4, D120): one `kFactor` for every bend, or a `bendTable` (rows of T, R, angle → K, BA or BD, each
 * citing a source or saying it is an estimate) giving each bend's — one of them, no default.
 */
export type CadPartSheetK = { readonly kFactor: number; readonly bendTable?: undefined } | { readonly bendTable: BendTable; readonly kFactor?: undefined };
export interface CadPartDocument {
  readonly format: 'barocss-cad-part'; readonly version: 1; readonly units: 'mm';
  readonly parameters: Readonly<Record<string, number>>;
  readonly features: readonly CadPartFeature[];
}
export interface CadPartLoftSection { readonly sketch: string; readonly z: CadPartDim }
export type CadPartSweepStep = { readonly kind: 'straight'; readonly length: CadPartDim } | { readonly kind: 'bend'; readonly radius: CadPartDim; readonly angleDegrees: number; readonly toward: 'x' | '-x' | 'y' | '-y' };
export type CadPartErrorCode = 'FORMAT' | 'INPUT' | 'PARAMETER' | 'REFERENCE' | 'SELECTION' | 'CAPABILITY' | 'GEOMETRY';
export class CadPartError extends Error {
  constructor(readonly code: CadPartErrorCode, readonly feature: string | null, detail: string) { super(`${feature ? feature + ': ' : ''}${detail}`.slice(0, 1024)); this.name = 'CadPartError'; }
}
export interface CadPartOutput {
  /** The feature id, or `id/k` for one part of a multi-part feature. */
  readonly id: string; readonly feature: string;
  /** 'upright': a Z-prismatic solid (closed-form mass, curved Booleans); otherwise a general B-rep. */
  readonly representation: 'upright' | 'planar' | 'curved' | 'faceted';
  readonly brep: Brep;
  readonly bodyCount: number;
  massProperties(densityKgPerM3: number): SolidMassProperties;
  /** Binary STL (little-endian, 80-byte header) of the display tessellation. */
  exportStl(options?: { readonly segmentsPerQuarter?: number }): Uint8Array;
  /** STEP AP214 (exact B-rep: planes, B-spline surfaces and curves) of this output. */
  exportStep(options?: { readonly name?: string }): string;
  /**
   * The L0 validation of this output (checkBrep with `strict`): topology, and edges on their surfaces, loops
   * that do not cross, no slivers, tolerances under the cap. Worked out on first call; an imported STEP body
   * is reported here rather than refused.
   */
  validate(): BrepCheckReport;
  /** The surface area (mm²) over the exact surfaces (brepSurfaceArea). */
  surfaceArea(): number;
  /** A generated gear's report: its dimensions, the measured flank deviation, its diagnostics (R6a). */
  readonly gear?: SpurGearReport;
  /** A gear's placement (spec, centre, face plane, turn; the gear it meshes with). */
  readonly gearPlacement?: GearPlacement;
  /** A rack's report and placement (R6a.5b). */
  readonly rack?: SpurRackReport;
  readonly rackPlacement?: RackPlacement;
  /** A SubD body's make-up: steps, caps and their distance from the limit surface (R7, D79). */
  readonly subd?: SubdSummary;
  /** A decimated mesh's report: triangles before and after, why it stopped, the measured distance both ways (R9, D85). */
  readonly decimate?: DecimateReport;
  /** A general fillet's reports (R10.2, D89), one a rolling-ball tool: its stations, patches and measured deviations. */
  readonly fillet?: readonly FilletReport[];
  /** A mesh body's shell (R11.3, D114): the wall asked for and the wall its offset achieves, measured. */
  readonly shell?: MeshShellReport;
  /** A sheet-metal body's rules and bends (R12.1, D116); carried through holes and cuts (R12.2). */
  readonly sheet?: SheetReport;
  /**
   * A sheet's flat pattern (R12.2, D117): its skin developed from `fixedFace` (default the sheet's own: a plate's top, a
   * profile's first leg on its path), bends at R + K·T (`kFactor`, default the sheet's). Refused (GEOMETRY, its code in
   * the message: NOT_A_SHEET, NON_NORMAL_CUT, BEND_NOT_CYLINDRICAL, FLAT_OVERLAPS; CAPABILITY: CUT_ACROSS_BEND) where it
   * is no sheet, or for a body made without the sheet's rules (`flatPattern` of the kernel takes T and K for those).
   */
  flatPattern(options?: { readonly fixedFace?: string; readonly kFactor?: number }): FlatPattern;
}
export interface CadPartSnapshot {
  readonly document: CadPartDocument;
  /** Parts no later feature consumes, in feature order. */
  readonly outputs: readonly CadPartOutput[];
  readonly features: readonly { readonly id: string; readonly kind: CadPartFeature['kind']; readonly dependencies: readonly string[] }[];
  /** Features computed in this evaluation, and features reused unchanged from the previous one. */
  readonly recomputation: { readonly evaluated: readonly string[]; readonly reused: readonly string[] };
  output(id: string): CadPartOutput;
  /** Re-evaluates with new parameter values; unchanged features are reused. */
  withParameters(edits: Readonly<Record<string, number>>): CadPartSnapshot;
  /** Evaluates another document, reusing every feature whose resolved definition is unchanged. */
  withDocument(document: CadPartDocument): CadPartSnapshot;
  save(): string;
}
/**
 * `stepBytes`: an imported STEP file's text. A STEP file is read whole, and a solid of many faces holds
 * about 17 times its text in memory while it is built (a 19 MB faceted M8 bolt: about 320 MB): 32 MiB keeps
 * that near half a gigabyte, within a browser worker, and holds the studio's own exports of modelled
 * threads. The part document's own text stays at `fileBytes`. `stepTessellatedBytes`: a file whose excess over
 * `stepBytes` is tessellated meshes (AP242: the studio's own mesh exports, scans) — see `stepSizeProblem`.
 */
export const CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, stepBytes: 32 << 20, stepTessellatedBytes: 128 << 20, lengthMM: 10000, meshTriangles: 2_000_000, planarMeshTriangles: 100_000, subdVertices: 100_000 });
/**
 * Why a STEP file is too large to read, or null: its text past `stepTessellatedBytes`, or what is not tessellated in
 * it (B-rep records and the rest) past `stepBytes` (D49). Tessellated records take about 13 times their text while
 * read into a part (a 50 MB file of a million triangles: 680 MB; the owner's 128 MiB, D49, holds a 2M-triangle file) and a
 * mesh that size is held as arrays after; a mesh larger still opens from a .bcad file. A scan, no parse: checked before a file is read (the studio's worker too).
 */
export function stepSizeProblem(text: string): string | null {
  const MiB = (n: number) => `${n / 2 ** 20} MiB`;
  if (text.length > CadPartLimits.stepTessellatedBytes) return `the STEP file is larger than ${MiB(CadPartLimits.stepTessellatedBytes)}; a mesh that large opens from a .bcad file (its arrays kept as binary)`;
  if (text.length <= CadPartLimits.stepBytes) return null;
  const other = text.length - stepTessellatedChars(text);
  return other > CadPartLimits.stepBytes ? `the STEP file is larger than ${MiB(CadPartLimits.stepBytes)} outside its meshes (${(other / 2 ** 20).toFixed(1)} MiB); only tessellated meshes may take it up to ${MiB(CadPartLimits.stepTessellatedBytes)}` : null;
}

// ---- representation ------------------------------------------------------------------------------
type Solid = { readonly kind: 'upright'; readonly solid: PrismaticSolid } | { readonly kind: 'brep'; readonly brep: Brep };
/** `history`: an upright body of one section and the edge finishes applied to it since (for shell). */
interface Finish { readonly kind: 'chamfer' | 'fillet'; readonly edges: readonly string[]; readonly size: number; readonly id: string; /** A variable radius (D100), the radius at points of the edges. */ readonly radii?: readonly { readonly at: Point; readonly radius: number }[] }
/** `moved`: the part this one is a moved (turned, mirrored, uniformly scaled) copy of, for shell. */
interface Part {
  readonly solid: Solid; brep?: Brep; readonly mass?: (density: number) => SolidMassProperties;
  readonly history?: { readonly base: PrismaticSolid; readonly finishes: readonly Finish[] };
  readonly moved?: { readonly from: Part; readonly m: BrepAffine['matrix']; readonly o: Point };
  /** How a revolved or swept body was made (shell erodes its section and makes it again). */
  readonly revolved?: RevolveInput;
  readonly swept?: { readonly profile: readonly ProfileSegmentInput[]; readonly steps: readonly SweepStep[]; readonly sideTags?: readonly string[] };
  /** A generated gear's report (R6a), and where it stands (its spec, centre, face plane, turn). */
  readonly gear?: SpurGearReport;
  readonly gearPlace?: GearPlacement;
  /** A generated rack's report and placement (R6a.5b). */
  readonly rack?: SpurRackReport;
  readonly rackPlace?: RackPlacement;
  readonly subd?: SubdSummary;
  readonly decimate?: DecimateReport;
  readonly fillet?: readonly FilletReport[];
  readonly shell?: MeshShellReport;
  readonly sheet?: SheetReport;
}
/** A rack as placed: its pitch line from `origin` along `angle` (radians); the gear it meshes with, if any. */
export interface RackPlacement { readonly spec: SpurRackSpec; readonly origin: XY; readonly angle: number; readonly from: number; readonly meshesWith?: string; readonly driver?: GearPlacement }
/** A spur gear as placed: its spec, axis through `center` along +Z from `from`, turned by `rotation` (radians). */
export interface GearPlacement {
  readonly spec: SpurGearSpec; readonly center: XY; readonly from: number; readonly rotation: number;
  /** A meshing gear: the feature it meshes with, and that gear's placement (for the pair checks, checkPlacedSpurGears). */
  readonly meshesWith?: string; readonly driver?: GearPlacement;
}
/** Gear diagnostics as the part model's codes (the gear's own code kept in the message). */
const GEAR_CODES: Record<GearDiagnosticCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', UNSUPPORTED_PROFILE_SHIFT: 'CAPABILITY', UNSUPPORTED_GEAR_KIND: 'CAPABILITY', PROFILE_BUDGET_EXCEEDED: 'CAPABILITY', SELF_INTERSECTION: 'GEOMETRY', ROOT_TRANSITION_UNVALIDATED: 'GEOMETRY', BORE_INTERSECTION: 'GEOMETRY', MATE_INCOMPATIBLE: 'INPUT' };
type SweepStep = { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' };
/** x ↦ m·x + o from a sketch's own XY (Z along its normal) into the part. */
type Frame = { readonly m: BrepAffine['matrix']; readonly o: Point };
type Result = { readonly kind: 'sketch'; readonly outer: readonly ProfileSegmentInput[]; readonly frame?: Frame; readonly regions?: readonly (readonly ProfileSegmentInput[])[]; readonly holes?: readonly (readonly ProfileSegmentInput[])[]; readonly tags?: SideTags } | { readonly kind: 'solid'; readonly parts: readonly Part[] };

/** A B-rep of several bodies as one B-rep per body (each with its own shells, faces, loops, edges and vertices). */
function splitBodies(b: Brep): Brep[] {
  if (b.bodies.length <= 1) return [b];
  return b.bodies.map(body => {
    const shells = b.shells.filter(x => x.body === body.id), faceIds = new Set(shells.flatMap(x => x.faces)), faces = b.faces.filter(f => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap(f => f.loops)), loops = b.loops.filter(l => loopIds.has(l.id)), coIds = new Set(loops.flatMap(l => l.coedges));
    const coedges = b.coedges.filter(c => coIds.has(c.id)), edgeIds = new Set(coedges.map(c => c.edge)), edges = b.edges.filter(e => edgeIds.has(e.id)), vIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter(v => vIds.has(v.id)) };
  });
}
const empty = (s: Solid) => s.kind === 'upright' ? !s.solid.slabs.length : !s.brep.bodies.length;
const lineOnly = (s: PrismaticSolid) => s.slabs.every(x => x.regions.every(r => [r.outer, ...r.holes].every(ring => ring.every(g => g.kind === 'line'))));
const planarBrep = (b: Brep) => b.faces.every(f => f.surface.kind === 'surface' && f.surface.degreeU === 1 && f.surface.degreeV === 1 && f.surface.controlPoints.length === 2 && f.surface.controlPoints[0].length === 2) && b.edges.every(e => e.curve.degree === 1 && e.curve.controlPoints.length === 2);
const representation = (s: Solid): CadPartOutput['representation'] => s.kind === 'upright' ? 'upright' : s.brep.faces.some(isFacetFace) ? 'faceted' : planarBrep(s.brep) ? 'planar' : 'curved';
/**
 * F0 fallback (owner, 2026-10-18; D3, D42): a facet body (a mesh imported as facet faces) meets a Boolean,
 * split, hole or draft only through the planar path until F1/F2 give facets their own — exploded back to the
 * planar per-triangle B-rep when it has at most this many triangles, refused with CAPABILITY above it. Committed
 * evaluations take up to this many: about 5 s at the worst, a hole (its cylinder takes the analytic path) through
 * a 16k-triangle mesh in the studio's whole evaluation (4.8 s; 18k 5.1–5.4 s, 20k 6.1 s; a polyhedral union with a
 * box is faster, 3.2 s at 20k in R2). Since F1 (D50) and F2 (D52) only a Boolean of two meshes takes it (F3); F2
 * holds the same number for the mesh near an exact tool, the share its exact Boolean takes.
 */
export const FACET_EXPLODE_TRIANGLES = 16000;
/** A preview's limit (CadPartEvaluationOptions.facetExplodeTriangles): about a second, so a preview stays live. */
export const FACET_PREVIEW_TRIANGLES = 5000;
/** The limit of the evaluation running now (evaluateCadPart is synchronous: set for its run, restored after). */
let facetLimit = FACET_EXPLODE_TRIANGLES;
function explodeFacets(b: Brep, at: string, what: string): Brep {
  if (!b.faces.some(isFacetFace)) return b;
  if (!b.faces.every(isFacetFace)) throw new CadPartError('CAPABILITY', at, `${what} on a body mixing mesh and other faces is not supported yet`);
  if (b.bodies.some(x => x.kind === 'sheet')) throw new CadPartError('GEOMETRY', at, `${what} need a closed solid: this mesh is open (a sheet)`);
  let count = 0; for (const f of b.faces) count += (f.surface as FacetPatch).indices.length / 3;
  if (count > facetLimit) throw new CadPartError('CAPABILITY', at, count <= FACET_EXPLODE_TRIANGLES
    ? `${what} on meshes over ${facetLimit} triangles are not previewed (this mesh has ${count}): apply to run it (up to ${FACET_EXPLODE_TRIANGLES})`
    : `${what} of two large meshes arrive with F3 (this mesh has ${count} triangles; up to ${FACET_EXPLODE_TRIANGLES} go through the planar path)`);
  // Every face's triangles, wound outward, into one planar mesh solid.
  const positions: number[] = [], indices: number[] = [];
  for (const f of b.faces) {
    const F = f.surface as FacetPatch, base = positions.length / 3, X = F.indices, fw = f.sense === 'forward';
    for (let i = 0; i < F.positions.length; i++) positions.push(F.positions[i]);
    for (let t = 0; t < X.length; t += 3) indices.push(base + X[t], base + (fw ? X[t + 1] : X[t + 2]), base + (fw ? X[t + 2] : X[t + 1]));
  }
  // (A mesh crossing itself has no inside to cut: refused with where, D46. Its faces' vertices are welded first.)
  const welded = weldVertices(positions, positions.length / 3, 1e-9 * Math.max(1, ...positions.map(Math.abs))), wi = Uint32Array.from(indices, v => welded.remap[v]);
  const crossing = selfIntersections(welded.P, wi);
  if (crossing.count) throw new CadPartError('GEOMETRY', at, `${what} need a mesh that does not cross itself: this one does in ${crossing.count} place${crossing.count > 1 ? 's' : ''} (near ${crossing.at[0].map(x => +x.toFixed(2)).join(', ')}); repair does not fix that yet`);
  try { return brepFromTriangles(positions, indices, { id: b.bodies[0]?.id ?? at, maximumTriangles: count }); }
  catch (cause) { if (cause instanceof MeshBrepError) throw new CadPartError('GEOMETRY', at, cause.message); throw cause; }
}
const brepOf = (part: Part, id: string): Brep => part.brep ??= part.solid.kind === 'upright' ? brepFromPrismatic(part.solid.solid, { id }) : part.solid.brep;

function bounds(s: Solid): { min: Point; max: Point } {
  const min: Point = [Infinity, Infinity, Infinity], max: Point = [-Infinity, -Infinity, -Infinity];
  const take = (p: readonly number[]) => { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); } };
  if (s.kind === 'upright') for (const slab of s.solid.slabs) for (const r of slab.regions) for (const p of sampleRing(r.outer, Math.PI / 64)) { take([p[0], p[1], slab.z0]); take([p[0], p[1], slab.z1]); }
  else {
    for (const v of s.brep.vertices) take(v.point); for (const e of s.brep.edges) for (const p of e.curve.controlPoints) take(p);
    // (A facet face can reach past its boundary's points: its patch's box.)
    for (const f of s.brep.faces) if (f.surface.kind === 'facets') { const b = f.surface.bounds; take([b[0], b[1], b[2]]); take([b[3], b[4], b[5]]); }
  }
  return { min, max };
}

// ---- document admission ----------------------------------------------------------------------------
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function admit(input: unknown): CadPartDocument {
  const fail = (detail: string, feature: string | null = null): never => { throw new CadPartError('FORMAT', feature, detail); };
  if (!isRecord(input) || input.format !== 'barocss-cad-part' || input.version !== 1 || input.units !== 'mm') fail('a barocss-cad-part version 1 document in mm is required');
  const doc = input as unknown as CadPartDocument;
  if (!isRecord(doc.parameters) || Object.keys(doc.parameters).length > CadPartLimits.parameters) fail('parameters must be an object of at most 256 entries');
  for (const [k, v] of Object.entries(doc.parameters)) if (!ID.test(k) || typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > CadPartLimits.lengthMM) fail(`parameter ${k} must be a finite number within ±10000`);
  if (!Array.isArray(doc.features) || doc.features.length > CadPartLimits.features) fail('features must be an array of at most 512 features');
  const seen = new Set<string>();
  for (const f of doc.features) {
    if (!isRecord(f) || typeof f.id !== 'string' || !ID.test(f.id)) fail('every feature needs an id (a letter, then letters, digits, _ or -)');
    if (seen.has(f.id)) fail('duplicate feature id', f.id);
    seen.add(f.id);
  }
  return copyDocument(doc) as CadPartDocument;
}
const isMeshArray = (v: unknown): v is Float64Array | Float32Array | Uint32Array | Int32Array => v instanceof Float64Array || v instanceof Float32Array || v instanceof Uint32Array || v instanceof Int32Array;
/** A deep copy of the document's JSON values; a mesh's typed arrays shared as they are (they are never changed). */
function copyDocument(v: unknown): unknown {
  if (isMeshArray(v)) return v;
  if (Array.isArray(v)) return v.map(copyDocument);
  if (v && typeof v === 'object') { const out: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = copyDocument(x); return out; }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}
/** Checked once per array object: x, y, z numbers within the length limit, or vertex numbers below `nv` (three a triangle, at most the limit). */
const checkedArrays = new WeakMap<object, string>();
function meshArrayOk(v: unknown, what: 'positions' | 'indices', nv = 0): boolean {
  if (!Array.isArray(v) && !isMeshArray(v)) return false;
  const a = v as ArrayLike<number>, key = `${what}:${nv}`;
  if (checkedArrays.get(a as object) === key) return true;
  if (a.length % 3) return false;
  if (what === 'positions') { for (let i = 0; i < a.length; i++) { const x = a[i]; if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.lengthMM) return false; } }
  else { if (a.length / 3 > CadPartLimits.meshTriangles) return false; for (let i = 0; i < a.length; i++) { const x = a[i]; if (!Number.isInteger(x) || x < 0 || x >= nv) return false; } }
  checkedArrays.set(a as object, key);
  return true;
}
/** A typed array's reuse key: its kind, length and an FNV-1a hash of its bytes, worked out once per array. */
const arrayHashes = new WeakMap<object, string>();
function hashOfArray(a: Float64Array | Float32Array | Uint32Array | Int32Array): string {
  let h = arrayHashes.get(a);
  if (h === undefined) {
    const bytes = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2);
    let x = 0x811c9dc5, y = 0x01000193;
    for (let i = 0; i < bytes.length; i++) { x = Math.imul(x ^ bytes[i], 0x01000193); y = Math.imul(y ^ (bytes[i] >>> 7), 0x85ebca6b); }
    h = `${a.constructor.name}:${a.length}:${(x >>> 0).toString(16)}${(y >>> 0).toString(16)}`;
    arrayHashes.set(a, h);
  }
  return h;
}

// ---- evaluation --------------------------------------------------------------------------------------
/**
 * Results by their feature's resolved definition, each with the inputs it was made from: a feature is
 * reused when its definition is the same and every input is the very result (===) it was made from —
 * reused inputs stay the same objects, so a key never has to spell out what is upstream of it.
 */
type Cache = Map<string, { deps: readonly Result[]; result: Result }[]>;

/** `facetExplodeTriangles`: the F0 planar-path limit for this evaluation (FACET_PREVIEW_TRIANGLES for a preview; default FACET_EXPLODE_TRIANGLES). */
export interface CadPartEvaluationOptions { readonly facetExplodeTriangles?: number }
export function evaluateCadPart(input: CadPartDocument, previous?: Cache, options: CadPartEvaluationOptions = {}): CadPartSnapshot {
  const was = facetLimit;
  facetLimit = Math.min(FACET_EXPLODE_TRIANGLES, options.facetExplodeTriangles ?? FACET_EXPLODE_TRIANGLES);
  try { return evaluateWith(input, previous, options); }
  finally { facetLimit = was; }
}
function evaluateWith(input: CadPartDocument, previous: Cache | undefined, options: CadPartEvaluationOptions): CadPartSnapshot {
  const doc = admit(input), cache: Cache = new Map(), results = new Map<string, Result>();
  const lookup = (key: string, deps: readonly Result[]) => previous?.get(key)?.find(e => e.deps.length === deps.length && e.deps.every((d, i) => d === deps[i]))?.result;
  const remember = (key: string, deps: readonly Result[], result: Result) => { const list = cache.get(key); if (list) list.push({ deps, result }); else cache.set(key, [{ deps, result }]); };
  const consumed = new Map<string, Set<number> | 'all'>(), features: { id: string; kind: CadPartFeature['kind']; dependencies: string[] }[] = [];
  const evaluated: string[] = [], reusedIds: string[] = [];
  for (const feature of doc.features) {
    const at = feature.id, deps: string[] = [];
    const fail = (code: CadPartErrorCode, detail: string): never => { throw new CadPartError(code, at, detail); };
    const dim = (v: CadPartDim | undefined, what: string, positive = false): number => {
      let x: unknown = v;
      if (isRecord(v)) { const name = (v as { parameter: unknown }).parameter; if (typeof name !== 'string' || !Object.hasOwn(doc.parameters, name)) fail('PARAMETER', `${what}: unknown parameter ${String(name)}`); x = doc.parameters[name as string]; }
      if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.lengthMM) fail('PARAMETER', `${what} must be a finite length within ±10000 mm`);
      if (positive && !((x as number) > 0)) fail('PARAMETER', `${what} must be positive`);
      return x as number;
    };
    const xy = (p: CadPartPoint2 | undefined, what: string): XY => { if (!Array.isArray(p) || p.length !== 2) fail('INPUT', `${what} must be [x, y]`); return [dim(p![0], what), dim(p![1], what)]; };
    const xyz = (p: CadPartPoint3 | undefined, what: string): Point => { if (!Array.isArray(p) || p.length !== 3) fail('INPUT', `${what} must be [x, y, z]`); return [dim(p![0], what), dim(p![1], what), dim(p![2], what)]; };
    const integer = (v: unknown, what: string, lo: number, hi: number): number => { if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi) fail('INPUT', `${what} must be an integer from ${lo} to ${hi}`); return v as number; };
    const axisOf = (v: unknown): CadPartAxis => { if (v !== 'x' && v !== 'y' && v !== 'z') fail('INPUT', 'axis must be x, y or z'); return v as CadPartAxis; };
    const ref = (r: unknown, what: string): { id: string; part: number | null; result: Result } => {
      if (typeof r !== 'string') fail('REFERENCE', `${what} must name an earlier feature`);
      const [id, k, extra] = (r as string).split('/');
      const result = results.get(id); if (!result || extra !== undefined) fail('REFERENCE', `${what}: no earlier feature ${r}`);
      deps.push(id);
      const part = k === undefined ? null : Number(k);
      if (part !== null && !(Number.isInteger(part) && part >= 0 && result!.kind === 'solid' && part < result!.parts.length)) fail('REFERENCE', `${what}: ${r} is not a part`);
      return { id, part, result: result! };
    };
    const solids = (r: unknown, what: string): Part[] => {
      const { id, part, result } = ref(r, what);
      if (result.kind !== 'solid') fail('REFERENCE', `${what}: ${id} is a sketch, not a solid`);
      const parts = (result as Extract<Result, { kind: 'solid' }>).parts, picked = part === null ? parts : [parts[part]];
      if (picked.every(p => empty(p.solid))) fail('SELECTION', `${what}: ${r} is empty`);
      const used = consumed.get(id); if (part === null) consumed.set(id, 'all'); else if (used !== 'all') consumed.set(id, (used ?? new Set()).add(part));
      return picked.filter(p => !empty(p.solid));
    };

    let result: Result;
    const f = feature as CadPartFeature & Record<string, unknown>;
    // A feature whose resolved definition and inputs are unchanged is reused.
    try {
      if (f.kind === 'sketch') {
        const frame = f.plane === undefined ? undefined : frameOf(f.plane as CadPartSketchPlane, xyz, fail);
        const loops = (key: 'regions' | 'holes') => {
          const list = f[key] as unknown;
          if (list === undefined) return {};
          if (!Array.isArray(list) || list.length > CadPartLimits.edges) fail('INPUT', `${key} must list up to 64 loops`);
          return { [key]: (list as unknown[]).map((segments, i) => sketchOuter({ profile: 'loop', segments }, xy, dim, (code, detail) => fail(code, `${key}[${i}]: ${detail}`))) };
        };
        const drawn = { outer: sketchOuter(f, xy, dim, fail), ...loops('regions'), ...loops('holes') } as { outer: ProfileSegmentInput[]; regions?: ProfileSegmentInput[][]; holes?: ProfileSegmentInput[][] };
        const tags = f.sideTags === undefined ? undefined : sideTagsOf(f.sideTags, drawn, fail);
        const sketch: Result = { kind: 'sketch', ...drawn, ...(frame ? { frame } : {}), ...(tags ? { tags } : {}) };
        // (The same sketch as before is the same object, so what is built on it can be reused.)
        const key = 'sketch:' + JSON.stringify(sketch);
        result = lookup(key, []) ?? sketch;
        remember(key, [], result);
      } else {
        const compute = operation(f, { dim, xy, xyz, integer, axisOf, solids, ref, fail, at });
        const key = JSON.stringify([f.kind, resolvedDefinition(f, doc.parameters)]), inputs = deps.map(d => results.get(d)!);
        const reused = lookup(key, inputs);
        result = reused ?? compute();
        (reused ? reusedIds : evaluated).push(at);
        remember(key, inputs, result);
      }
    } catch (cause) {
      if (cause instanceof CadPartError) throw cause;
      // Kernel refusals keep their own reason; anything else is reported, never swallowed.
      const known = cause instanceof BrepError || cause instanceof PrismaticSolidError || cause instanceof CurvedArrangementError || cause instanceof ExtrudedProfileError || cause instanceof SolidMassError;
      throw new CadPartError('GEOMETRY', at, known ? (cause as Error).message : `unexpected kernel failure: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    results.set(at, result); features.push({ id: at, kind: f.kind, dependencies: [...new Set(deps)] });
  }
  // Outputs: parts not consumed by a later feature.
  const outputs: CadPartOutput[] = [];
  for (const feature of doc.features) {
    const result = results.get(feature.id)!, used = consumed.get(feature.id);
    if (result.kind !== 'solid' || used === 'all') continue;
    result.parts.forEach((part, k) => {
      if (used?.has(k) || empty(part.solid)) return;
      outputs.push(makeOutput(result.parts.length === 1 ? feature.id : `${feature.id}/${k}`, feature.id, part));
    });
  }
  const snapshot: CadPartSnapshot = {
    document: deepFreeze(doc), outputs: Object.freeze(outputs), features: deepFreeze(features), recomputation: deepFreeze({ evaluated, reused: reusedIds }),
    output(id: string) { const o = outputs.find(x => x.id === id); if (!o) throw new CadPartError('REFERENCE', null, `no output ${id}`); return o; },
    withParameters(edits) {
      const parameters = { ...doc.parameters };
      for (const [k, v] of Object.entries(edits)) { if (!Object.hasOwn(parameters, k)) throw new CadPartError('PARAMETER', null, `unknown parameter ${k}`); parameters[k] = v; }
      return evaluateCadPart({ ...doc, parameters }, cache, options);
    },
    withDocument(next) { return evaluateCadPart(next, cache, options); },
    // (A mesh's typed arrays written as plain arrays.)
    save: () => JSON.stringify(doc, (_, v) => isMeshArray(v) ? Array.from(v) : v) + '\n',
  };
  return Object.freeze(snapshot);
}

/** Parses and evaluates a saved part document. */
export function loadCadPart(text: string): CadPartSnapshot {
  if (typeof text !== 'string' || text.length > CadPartLimits.fileBytes) throw new CadPartError('FORMAT', null, 'a part document of at most 4 MiB is required');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new CadPartError('FORMAT', null, 'malformed JSON'); }
  return evaluateCadPart(parsed as CadPartDocument);
}
export const emptyCadPart = (): CadPartDocument => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [] });

function deepFreeze<T>(v: T): T { if (v && typeof v === 'object' && !ArrayBuffer.isView(v) && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; }
/** The feature with parameters replaced by their values (the reuse key). */
/**
 * Long texts (an imported STEP file) stand in the reuse keys as an exact id from a map of the last few, compared by
 * content — not written out again into every key (a 30 MB file was 70–90 ms an evaluation; PERF3 C16). An id is never
 * given to another text; a text fallen out of the map gets a new one (a miss, not a wrong reuse).
 */
const LONG_TEXT = 1 << 16, TEXTS_KEPT = 8, textIds = new Map<string, number>();
let nextTextId = 1;
function textKey(t: string): string {
  let id = textIds.get(t);
  if (id === undefined) { id = nextTextId++; if (textIds.size >= TEXTS_KEPT) textIds.delete(textIds.keys().next().value!); }
  else textIds.delete(t);
  textIds.set(t, id);
  return `\u0000text#${id}:${t.length}`;
}
function resolvedDefinition(f: unknown, parameters: Readonly<Record<string, number>>): unknown {
  if (isMeshArray(f)) return hashOfArray(f);
  if (typeof f === 'string' && f.length > LONG_TEXT) return textKey(f);
  if (Array.isArray(f)) return f.map(x => resolvedDefinition(x, parameters));
  if (isRecord(f)) { if (typeof f.parameter === 'string' && Object.keys(f).length === 1) return parameters[f.parameter]; return Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'id').map(([k, v]) => [k, resolvedDefinition(v, parameters)])); }
  return f;
}

type Tools = {
  dim: (v: CadPartDim | undefined, what: string, positive?: boolean) => number; xy: (p: CadPartPoint2 | undefined, what: string) => XY; xyz: (p: CadPartPoint3 | undefined, what: string) => Point;
  integer: (v: unknown, what: string, lo: number, hi: number) => number; axisOf: (v: unknown) => CadPartAxis; solids: (r: unknown, what: string) => Part[];
  ref: (r: unknown, what: string) => { id: string; part: number | null; result: Result };
  fail: (code: CadPartErrorCode, detail: string) => never; at: string;
};

function frameOf(plane: CadPartSketchPlane, xyz: Tools['xyz'], fail: Tools['fail']): Frame {
  if (!isRecord(plane)) fail('INPUT', 'plane must be { origin, normal, xAxis }');
  const direction = (v: unknown, what: string): Point => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(c => typeof c === 'number' && Number.isFinite(c))) fail('INPUT', `plane ${what} must be [x, y, z]`);
    const l = Math.hypot(...(v as number[]));
    if (!(l > 1e-12)) fail('INPUT', `plane ${what} must not be zero`);
    return (v as number[]).map(c => c / l) as unknown as Point;
  };
  // Components within rounding of 0 or ±1 are exactly that, so axis-aligned planes stay exact.
  const snap = (v: Point): Point => v.map(c => Math.abs(c) < 1e-12 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-12 ? Math.sign(c) : c) as unknown as Point;
  const n = snap(direction(plane.normal, 'normal')), x0 = direction(plane.xAxis, 'xAxis');
  if (Math.abs(dot(x0, n)) > 1e-9) fail('INPUT', 'plane xAxis must be perpendicular to its normal');
  const x = snap(unit(sub(x0, scale(n, dot(x0, n))))), y = snap(cross(n, x));
  return { m: [x[0], y[0], n[0], x[1], y[1], n[1], x[2], y[2], n[2]], o: xyz(plane.origin, 'plane origin') };
}
/** A point of a sketch's own XYZ in the part. */
const framed = (frame: Frame | undefined, p: Point): Point => !frame ? p : [frame.m[0] * p[0] + frame.m[1] * p[1] + frame.m[2] * p[2] + frame.o[0], frame.m[3] * p[0] + frame.m[4] * p[1] + frame.m[5] * p[2] + frame.o[1], frame.m[6] * p[0] + frame.m[7] * p[1] + frame.m[8] * p[2] + frame.o[2]];
/** A bend's K: the sheet's, or its table's for T, R and the angle (R12.4, D120); a bend outside the table refused by name. */
function bendK(rules: { readonly kFactor?: number; readonly bendTable?: BendTable }, T: number, R: number, angle: number, what: string, fail: Tools['fail']): { kFactor: number; use?: BendTableUse } {
  if (rules.kFactor !== undefined) return { kFactor: rules.kFactor };
  const r = lookupBend(rules.bendTable!, T, R, angle);
  if ('miss' in r) return fail('PARAMETER', `[BEND_TABLE_MISS] ${what}: ${r.miss}`);
  return r;
}
/** A solid's volume by its exact surfaces (quadrature where curved): the flange's collision test. */
const exactVolume = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : brepMassProperties(s.brep, 1).volumeMM3;
/**
 * An edge flange on a sheet (R12.3, D118; see the feature): its edge's frame (x out across the edge, y up from the picked
 * skin, z along the edge), the plate trimmed and relieved, the flange's section extruded and united; refused where it
 * meets the sheet anywhere but its root.
 */
function sheetFlange(o: { part: Part; sheet: SheetReport; at: string; edge: string; T: number; K: { kFactor: number; use?: BendTableUse }; R: number; th: number; trim: number; straight: number; off: [number, number]; relief: { kind: 'rectangular' | 'obround'; width: number; depth: number } | null | undefined; fail: Tools['fail'] }): Result {
  const { part, sheet, at, T, K, R, th, trim, straight, off, relief, fail } = o, brep = brepOf(part, 'target');
  const e = edgeNamed(brep, o.edge, fail);
  const ends = e.curve.controlPoints, A = ends[0], B = ends[ends.length - 1], Le = len(sub(B, A));
  const tol = 1e-9 * Math.max(1, ...A.map(Math.abs), ...B.map(Math.abs));
  if (!(e.curve.degree === 1 && ends.length === 2 && Le > tol)) fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not straight: a flange goes on a straight edge`);
  const u = scale(sub(B, A), 1 / Le), loopFace = new Map(brep.loops.map(l => [l.id, l.face])), faceIds = brep.coedges.filter(c => c.edge === e!.id).map(c => loopFace.get(c.loop)!);
  const faces = faceIds.map(id => brep.faces.find(x => x.id === id)!), geos = faces.map(x => faceGeometry(x));
  // The picked skin S and the thickness face E: both planes, square to each other and the edge; E with an edge along this
  // one T below S over some of its length (the sheet T thick there; E may run on, merged with a flange's end beside it),
  // the plate behind E.
  let frame: { n: Point; m: Point; S: number } | null = null;
  for (const [s, k] of [[0, 1], [1, 0]] as const) {
    const gs = geos[s], ge = geos[k];
    if (faces.length !== 2 || gs.kind !== 'plane' || ge.kind !== 'plane' || Math.abs(dot(gs.n, ge.n)) > 1e-9 || Math.abs(dot(gs.n, u)) > 1e-9 || Math.abs(dot(ge.n, u)) > 1e-9) continue;
    const behind = faceVertices(brep, faces[s].id).map(q => dot(sub(q, A), ge.n));
    if (Math.max(...behind) <= tol && hasEdgeBelow(brep, faces[k].id, A, u, Le, gs.n, T)) { frame = { n: gs.n, m: ge.n, S: s }; break; }
  }
  if (!frame) return fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not an edge between the sheet's skin and its ${T} mm thickness`);
  const { n, m } = frame, w = cross(m, n), zB = dot(sub(B, A), w), zlo = Math.min(0, zB), zhi = Math.max(0, zB);
  // (Offsets from the edge's start (A) and end (B).)
  const z0 = zlo + (zB > 0 ? off[0] : off[1]), z1 = zhi - (zB > 0 ? off[1] : off[0]);
  if (!(z1 - z0 > 1e-6)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] offsets ${off[0]} and ${off[1]} leave nothing of the ${+Le.toFixed(6)} mm edge`);
  // The plate behind the edge must reach past the trim.
  const depth = -Math.min(...faceVertices(brep, faces[frame.S].id).map(q => dot(sub(q, A), m)));
  if (trim > 0 && !(depth > trim + tol)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] the sheet is ${+depth.toFixed(6)} mm deep behind ${e.name}; the bend takes ${+trim.toFixed(6)} mm of it`);
  const F: BrepAffine['matrix'] = [m[0], n[0], w[0], m[1], n[1], w[1], m[2], n[2], w[2]];
  const local = (outer: ProfileSegmentInput[], from: number, h: number, tag: string, names?: { outer: string[]; bottom: string; top: string }) => affine({ kind: 'upright', solid: prismaticFromProfile({ outer, heightMM: h, fromMM: from, tag, ...(names ? { names } : {}) }) }, F, A);
  // The cut into the plate, one tool (no two cuts with faces on one plane): the trim [−trim, 1] × [z0, z1] and a relief at
  // each end inside the edge, `depth` past the bend's start, as one loop across the edge (x) and along it (z), taken down
  // through the plate. (Bend outside: no trim, each relief its own loop.)
  // An end inside the edge needs a relief said (kind, width and depth, or 'none'); 'none' cuts nothing there.
  const inside0 = z0 > zlo + tol, inside1 = z1 < zhi - tol;
  if ((inside0 || inside1) && relief === undefined) fail('PARAMETER', `[RELIEF_REQUIRED] the flange on ${e.name} ends inside the edge: give its relief — { kind: 'rectangular' | 'obround', width, depth } or { kind: 'none' }`);
  const cut = relief ?? null, at0 = cut !== null && inside0, at1 = cut !== null && inside1;
  const xd = cut ? -(trim + cut.depth) : -trim, r = cut ? cut.width / 2 : 0;
  if ((at0 && z0 - 2 * r < zlo - tol) || (at1 && z1 + 2 * r > zhi + tol)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] a relief ${cut!.width} mm wide does not fit beside the flange on ${e.name} (offset it at least that far)`);
  if (cut?.kind === 'obround' && cut.depth < r) fail('PARAMETER', `[BEND_DOES_NOT_FIT] an obround relief needs a depth of at least half its width (${r} mm)`);
  const loops: ProfileSegmentInput[][] = [];
  const tail = (y: number, out: ProfileSegmentInput[], up: boolean) => {
    // A relief from the edge (x = 1) across to its deep end and back, between y and y ± width (up: towards +z).
    const y1 = up ? y + 2 * r : y - 2 * r;
    if (cut!.kind === 'rectangular') { out.push({ kind: 'line', start: [xd, up ? y1 : y] }, { kind: 'line', start: [xd, up ? y : y1] }); return; }
    out.push({ kind: 'arc', start: [xd + r, up ? y1 : y], center: [xd + r, (y + y1) / 2], direction: 'ccw' }, { kind: 'line', start: [xd + r, up ? y : y1] });
  };
  if (trim > 0) {
    const ya = at0 ? z0 - 2 * r : z0, yb = at1 ? z1 + 2 * r : z1, loop: ProfileSegmentInput[] = [{ kind: 'line', start: [1, ya] }, { kind: 'line', start: [1, yb] }];
    if (at1) tail(z1, loop, true);
    loop.push({ kind: 'line', start: [-trim, z1] }, { kind: 'line', start: [-trim, z0] });
    if (at0) tail(z0, loop, false);
    loops.push(loop);
  } else {
    if (at0) { const l: ProfileSegmentInput[] = [{ kind: 'line', start: [1, z0 - 2 * r] }, { kind: 'line', start: [1, z0] }]; tail(z0 - 2 * r, l, true); loops.push(l); }
    if (at1) { const l: ProfileSegmentInput[] = [{ kind: 'line', start: [1, z1] }, { kind: 'line', start: [1, z1 + 2 * r] }]; tail(z1, l, true); loops.push(l); }
  }
  const G: BrepAffine['matrix'] = [m[0], w[0], -n[0], m[1], w[1], -n[1], m[2], w[2], -n[2]], top = add(A, n);
  let plate = part.solid;
  // (Where the cut or the flange reaches another bend of the sheet the Boolean meets it along an edge: said so by name.)
  const collide = (cause: unknown): never => {
    if (cause instanceof Error && /not a manifold solid|touch along an edge/.test(cause.message)) fail('GEOMETRY', `[FLANGES_COLLIDE] the flange on ${e!.name} or its cut into the plate meets the sheet's other bends or flanges: keep it at least its setback (${+Math.max(trim, (R + T) * Math.tan(th / 2)).toFixed(6)} mm) from them`);
    throw cause;
  };
  try { loops.forEach((outer, k) => { plate = boolean(plate, affine({ kind: 'upright', solid: prismaticFromProfile({ outer, heightMM: T + 2, fromMM: 0, tag: k ? `${at}.relief${k}` : trim > 0 ? `${at}.trim` : `${at}.relief0` }) }, G, top), 'difference', at); }); }
  catch (cause) { collide(cause); }
  const sec = flangeSection(at, T, R, th, trim, straight), piece = local([...sec.segments], z0, z1 - z0, at, { outer: [...sec.names], bottom: `${at}.start`, top: `${at}.end` });
  // Joined at its root only: anything more is the flange running into the sheet (or another flange).
  let out: Solid;
  try { out = boolean(plate, piece, 'union', at); }
  catch (cause) { collide(cause); }
  // (Reliefs of neighbouring flanges may meet and cut a corner off: the sheet must stay one piece.)
  const pieces = out!.kind === 'brep' ? out!.brep.bodies.length : 1;
  if (pieces > 1) fail('GEOMETRY', `[SHEET_IN_PIECES] the flange on ${e.name} and its reliefs leave the sheet in ${pieces} pieces: move it, or its neighbour, further from the corner`);
  const vp = exactVolume(plate), vf = exactVolume(piece), vu = exactVolume(out!);
  if (vp + vf - vu > 1e-8 * (vp + vf)) fail('GEOMETRY', `[FLANGES_COLLIDE] the flange on ${e.name} runs into the sheet: ${+(vp + vf - vu).toPrecision(6)} mm³ of it overlaps`);
  const c = add(A, add(scale(m, sec.center[0]), scale(n, sec.center[1])));
  const bend = { name: `${at}.bend`, inner: `${at}.bend.inner`, outer: `${at}.bend.outer`, radiusMM: R, angleDegrees: th * 180 / Math.PI, axis: { origin: c, direction: w }, allowanceMM: bendAllowance(th, R, T, K.kFactor), setbackMM: outsideSetback(th, R, T), deductionMM: bendDeduction(th, R, T, K.kFactor), kFactor: K.kFactor, ...(K.use ? { table: K.use } : {}) };
  return { kind: 'solid', parts: [{ solid: out!, sheet: { ...sheet, bends: [...sheet.bends, bend] } }] };
}
/** An edge of a B-rep by its name, else by its faces' names without their piece numbers (one such edge). */
function edgeNamed(brep: Brep, name: string, fail: Tools['fail']): Brep['edges'][number] {
  let e = brep.edges.find(x => x.name === name);
  if (!e) {
    const want = name.split('|').map(n => n.replace(/#\d+$/, '')).sort().join('|');
    const like = brep.edges.filter(x => x.name && x.name.split('|').map(n => n.replace(/#\d+$/, '')).sort().join('|') === want);
    if (like.length > 1) fail('SELECTION', `${name} names ${like.length} edges: ${like.map(x => x.name).join(', ')}`);
    e = like[0];
  }
  if (!e) return fail('SELECTION', `no edge named ${name}; edges: ${brep.edges.slice(0, 12).map(x => x.name).join(', ')}${brep.edges.length > 12 ? ', …' : ''}`);
  return e;
}
/**
 * A corner relief on a sheet (R12.3b, D119; see the feature): the corner's frame (x and y into the plate along its two
 * edges, z along the thickness), the square or the quarter disc cut through it; refused unless exactly the plate's corner
 * goes (s² T or π s² T / 4) and the sheet stays one piece.
 */
function sheetCornerRelief(part: Part, sheet: SheetReport, at: string, corner: string, shape: 'square' | 'round', s: number, fail: Tools['fail']): Result {
  const T = sheet.thicknessMM, brep = brepOf(part, 'target'), e = edgeNamed(brep, corner, fail);
  const ends = e.curve.controlPoints, A = ends[0], B = ends[ends.length - 1], tol = 1e-9 * Math.max(1, ...A.map(Math.abs), ...B.map(Math.abs));
  if (!(e.curve.degree === 1 && ends.length === 2 && Math.abs(len(sub(B, A)) - T) <= 1e-7 * Math.max(1, T))) fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not a corner of the sheet: the straight edge, ${T} mm long, between two thickness faces`);
  const d = scale(sub(B, A), 1 / len(sub(B, A))), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const faces = brep.coedges.filter(c => c.edge === e.id).map(c => brep.faces.find(x => x.id === loopFace.get(c.loop))!), geos = faces.map(x => faceGeometry(x));
  if (faces.length !== 2 || geos.some(g => g.kind !== 'plane') || geos.some(g => Math.abs(dot((g as { n: Point }).n, d)) > 1e-9)) fail('PARAMETER', `[EDGE_NOT_SHEET] ${e.name} is not between two thickness faces of the sheet`);
  const m1 = (geos[0] as { n: Point }).n, m2 = (geos[1] as { n: Point }).n;
  if (Math.abs(dot(m1, m2)) > 1e-9) fail('CAPABILITY', `[CORNER_NOT_SQUARE] the corner ${e.name} is ${+(Math.acos(Math.max(-1, Math.min(1, -dot(m1, m2)))) * 180 / Math.PI).toFixed(6)}°: corner reliefs are made at square corners yet`);
  // Convex: each face behind the other's plane.
  const behind = (face: string, n: Point) => faceVertices(brep, face).every(q => dot(sub(q, A), n) <= tol);
  if (!behind(faces[1].id, m1) || !behind(faces[0].id, m2)) fail('CAPABILITY', `[CORNER_NOT_SQUARE] the corner ${e.name} is not convex`);
  const X = scale(m1, -1), Y = scale(m2, -1), Z = cross(X, Y), zB = dot(sub(B, A), Z), z0 = Math.min(0, zB) - 1, z1 = Math.max(0, zB) + 1;
  const outer: ProfileSegmentInput[] = shape === 'square' ? [{ kind: 'line', start: [-1, -1] }, { kind: 'line', start: [s, -1] }, { kind: 'line', start: [s, s] }, { kind: 'line', start: [-1, s] }] : [{ kind: 'arc', start: [s, 0], center: [0, 0], direction: 'ccw' }];
  const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, heightMM: z1 - z0, fromMM: z0, tag: at }) }, [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], A);
  let out: Solid;
  try { out = boolean(part.solid, tool, 'difference', at); }
  catch (cause) { if (cause instanceof Error && /not a manifold solid|touch along an edge/.test(cause.message)) fail('GEOMETRY', `[CORNER_NOT_CLEAR] the relief at ${e.name} meets more than the plate's corner`); throw cause; }
  const want = (shape === 'square' ? s * s : Math.PI * s * s / 4) * T, took = exactVolume(part.solid) - exactVolume(out!), pieces = out!.kind === 'brep' ? out!.brep.bodies.length : 1;
  if (pieces > 1 || Math.abs(took - want) > 1e-8 * Math.max(want, exactVolume(part.solid))) fail('GEOMETRY', `[CORNER_NOT_CLEAR] the relief at ${e.name} would take ${+took.toPrecision(9)} mm³ (the plate's corner is ${+want.toPrecision(9)}): a flange or a cut is there already, or the size reaches past the plate`);
  return { kind: 'solid', parts: [{ solid: out!, sheet }] };
}
/** Whether a face has a straight edge along u at T below the plane through A (normal n), overlapping [A, A + Le·u]. */
function hasEdgeBelow(brep: Brep, face: string, A: Point, u: Point, Le: number, n: Point, T: number): boolean {
  const loops = new Set(brep.loops.filter(l => l.face === face).map(l => l.id)), edges = new Map(brep.edges.map(x => [x.id, x])), tol = 1e-7 * Math.max(1, T);
  for (const c of brep.coedges) {
    if (!loops.has(c.loop)) continue;
    const p = edges.get(c.edge)!.curve.controlPoints, a = p[0], b = p[p.length - 1], d = sub(b, a), l = len(d);
    if (!(l > 0) || Math.abs(Math.abs(dot(d, u)) / l - 1) > 1e-9 || Math.abs(dot(sub(a, A), n) + T) > tol || Math.abs(dot(sub(b, A), n) + T) > tol) continue;
    const s0 = Math.min(dot(sub(a, A), u), dot(sub(b, A), u)), s1 = Math.max(dot(sub(a, A), u), dot(sub(b, A), u));
    if (Math.min(s1, Le) - Math.max(s0, 0) > tol) return true;
  }
  return false;
}
/** The points of a face's loops' vertices (its edges' ends). */
function faceVertices(brep: Brep, face: string): Point[] {
  const loops = new Set(brep.loops.filter(l => l.face === face).map(l => l.id)), edges = new Map(brep.edges.map(x => [x.id, x])), out: Point[] = [];
  for (const c of brep.coedges) if (loops.has(c.loop)) { const p = edges.get(c.edge)!.curve.controlPoints; out.push(p[0], p[p.length - 1]); }
  return out;
}
/** Parts made from sheets (holes, cuts) carrying their sheet's report, part for part (R12.2, D117). */
const carrySheet = (r: Result, from: readonly Part[]): Result => r.kind === 'solid' && from.some(p => p.sheet) ? { kind: 'solid', parts: r.parts.map((q, i) => from[i]?.sheet ? { ...q, sheet: from[i].sheet } : q) } : r;
/** A sheet feature's result: its one part carrying the sheet's report. */
const withSheet = (r: Result, sheet: SheetReport): Result => r.kind === 'solid' ? { kind: 'solid', parts: r.parts.map(p => ({ ...p, sheet })) } : r;
/** A result built on a sketch's own XY, moved onto its plane. */
const placed = (frame: Frame | undefined, compute: () => Result): (() => Result) =>
  !frame ? compute : () => { const r = compute(); return r.kind === 'solid' ? moveAll(r.parts, frame.m, frame.o) : r; };

/** A profile loop's points: its lines' starts and its arcs sampled (eight steps a quarter turn). */
function loopPoints(loop: readonly ProfileSegmentInput[]): [number, number][] {
  const out: [number, number][] = [];
  loop.forEach((s, i) => {
    out.push([s.start[0], s.start[1]]);
    if (s.kind !== 'arc') return;
    const end = loop[(i + 1) % loop.length].start, c = s.center, r = Math.hypot(s.start[0] - c[0], s.start[1] - c[1]);
    const a0 = Math.atan2(s.start[1] - c[1], s.start[0] - c[0]), a1 = Math.atan2(end[1] - c[1], end[0] - c[0]);
    let sweep = s.direction === 'ccw' ? a1 - a0 : a0 - a1; if (sweep <= 1e-12) sweep += 2 * Math.PI;
    const n = Math.max(2, Math.ceil(sweep / (Math.PI / 16)));
    for (let k = 1; k < n; k++) { const a = a0 + (s.direction === 'ccw' ? 1 : -1) * sweep * k / n; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  });
  return out;
}

function sketchOuter(f: Record<string, unknown>, xy: Tools['xy'], dim: Tools['dim'], fail: Tools['fail']): ProfileSegmentInput[] {
  if (f.profile === 'rectangle') {
    const a = xy(f.min as CadPartPoint2, 'min'), b = xy(f.max as CadPartPoint2, 'max');
    if (!(a[0] < b[0] && a[1] < b[1])) fail('PARAMETER', 'rectangle min must be below max on both axes');
    return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]].map(start => ({ kind: 'line', start: start as XY }));
  }
  if (f.profile === 'circle') { const c = xy(f.center as CadPartPoint2, 'center'), r = dim(f.radius as CadPartDim, 'radius', true); return [{ kind: 'arc', start: [c[0] + r, c[1]], center: c, direction: 'ccw' }]; }
  if (f.profile === 'polygon') {
    if (!Array.isArray(f.points) || f.points.length < 3 || f.points.length > CadPartLimits.points) fail('INPUT', 'a polygon needs 3 to 1024 points');
    return (f.points as CadPartPoint2[]).map((p, i) => ({ kind: 'line', start: xy(p, `point ${i}`) }));
  }
  if (f.profile === 'loop') {
    if (!Array.isArray(f.segments) || !f.segments.length || f.segments.length > CadPartLimits.points) fail('INPUT', 'a loop needs 1 to 1024 segments');
    return (f.segments as CadPartLoopSegment[]).map((s, i): ProfileSegmentInput => {
      if (!isRecord(s)) fail('INPUT', `segment ${i} must be an object`);
      if (s.kind === 'line') return { kind: 'line', start: xy(s.start, `segment ${i} start`) };
      if (s.kind === 'arc' && (s.direction === 'ccw' || s.direction === 'cw')) return { kind: 'arc', start: xy(s.start, `segment ${i} start`), center: xy(s.center, `segment ${i} center`), direction: s.direction };
      return fail('INPUT', `segment ${i} must be a line or an arc with direction ccw or cw`);
    });
  }
  return fail('INPUT', 'sketch profile must be rectangle, circle, polygon or loop');
}

/** A sketch's `sideTags` checked against its loops: one tag a side, each a name, none twice (R10a, D86). */
function sideTagsOf(v: unknown, drawn: { outer: readonly unknown[]; regions?: readonly (readonly unknown[])[]; holes?: readonly (readonly unknown[])[] }, fail: Tools['fail']): SideTags {
  if (!isRecord(v)) return fail('INPUT', 'sideTags must be { outer, regions?, holes? }');
  const seen = new Set<string>();
  const list = (x: unknown, n: number, what: string): string[] => {
    if (!Array.isArray(x) || x.length !== n) fail('INPUT', `sideTags.${what} must give ${n} tag${n === 1 ? '' : 's'}, one a side`);
    for (const t of x as unknown[]) {
      if (typeof t !== 'string' || !SIDE_TAG.test(t)) fail('INPUT', `sideTags.${what}: ${JSON.stringify(t)} is not a tag (letters, digits, _ or -, 1 to 32)`);
      if (seen.has(t as string)) fail('INPUT', `sideTags: ${t as string} is given twice`);
      seen.add(t as string);
    }
    return [...x as string[]];
  };
  const lists = (key: 'regions' | 'holes') => {
    const loops = drawn[key] ?? [], x = v[key];
    if (x === undefined) { if (loops.length) fail('INPUT', `sideTags.${key} must tag the ${loops.length} ${key === 'regions' ? 'region' : 'hole'} loop${loops.length === 1 ? '' : 's'}`); return {}; }
    if (!Array.isArray(x) || x.length !== loops.length) fail('INPUT', `sideTags.${key} must give one list a loop (${loops.length})`);
    return { [key]: loops.map((l, i) => list((x as unknown[])[i], l.length, `${key}[${i}]`)) };
  };
  return { outer: list(v.outer, drawn.outer.length, 'outer'), ...lists('regions'), ...lists('holes') };
}

// ---- operations ---------------------------------------------------------------------------------------
function operation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result {
  const { dim, xy, xyz, integer, axisOf, solids, ref, fail, at } = t;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  const many = (parts: Solid[]): Result => ({ kind: 'solid', parts: parts.map(solid => ({ solid })) });
  switch (f.kind) {
    case 'extrude': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      const h = dim(f.height as CadPartDim, 'height'), from = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from');
      if (h === 0) fail('PARAMETER', 'height must not be zero');
      const { outer, frame, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
      const draft = f.draft === undefined ? 0 : f.draft as unknown;
      if (typeof draft !== 'number' || !Number.isFinite(draft) || !(Math.abs(draft) < 89)) fail('INPUT', 'draft must be a number of degrees below 89 in size');
      if (draft === 0) return placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(regions ? { regions } : {}), ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), heightMM: Math.abs(h), fromMM: h > 0 ? from : from + h, tag: at }) }));
      if (regions?.length || holes?.length) fail('CAPABILITY', 'a drafted extrude takes one loop (no regions or holes) yet');
      // Built upwards from the sketch plane, then turned over for a downward extrude (the walls lean
      // away from the sketch plane either way).
      return placed(frame, () => {
        let brep: Brep;
        try { brep = draftedExtrusion({ profile: outer, z0: 0, z1: Math.abs(h), draftDegrees: draft as number, tag: at, id: at, ...(tags ? { sideTags: tags.outer } : {}) }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : 'PARAMETER', cause.message.replace(/^B-rep: drafted extrusion: /, '')); throw cause; }
        return one({ kind: 'brep', brep: transformBrep(brep!, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, h > 0 ? 1 : -1], offset: [0, 0, from] }) });
      });
    }
    case 'revolve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', `${f.kind} takes a sketch of one loop (no regions or holes) yet`);
      const ax = f.axis as { origin?: CadPartPoint2; direction?: unknown } | undefined;
      // The axis lies in the sketch plane: along its X or Y, or any direction [dx, dy] there.
      const free = Array.isArray(ax?.direction) && ax!.direction.length === 2 && ax!.direction.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.hypot(...(ax!.direction as number[])) > 1e-12;
      if (!isRecord(ax) || (ax.direction !== 'x' && ax.direction !== 'y' && !free)) fail('INPUT', 'axis must be { origin: [x, y], direction: "x" | "y" | [dx, dy] }');
      const origin = xy(ax!.origin, 'axis origin'), deg = f.angleDegrees === undefined ? 360 : f.angleDegrees as number;
      if (typeof deg !== 'number' || !(deg > 0 && deg <= 360)) fail('INPUT', 'angleDegrees must be in (0, 360]');
      const rtags = (sketch as Extract<Result, { kind: 'sketch' }>).tags;
      const input = { id: at, profile: (sketch as Extract<Result, { kind: 'sketch' }>).outer, axis: { origin, direction: (free ? ax!.direction : ax!.direction === 'x' ? [1, 0] : [0, 1]) as XY }, angleDegrees: deg, ...(rtags ? { sideTags: rtags.outer } : {}) };
      return placed((sketch as Extract<Result, { kind: 'sketch' }>).frame, () => ({ kind: 'solid', parts: [{ solid: { kind: 'brep', brep: revolveProfile(input) }, mass: (density: number) => revolveMassProperties(input, density), revolved: input }] }));
    }
    case 'union': case 'difference': case 'intersect': {
      const target = solids(f.target, 'target'), tool = solids(f.tool, 'tool'), op = f.kind === 'intersect' ? 'intersection' : f.kind;
      return () => {
        const joined = tool.reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), tool[0].solid);
        // Unions merge every target part into one; difference and intersection act on each part.
        if (op === 'union') return one(target.reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), joined));
        // (A sheet's holes and cuts: still the sheet, its rules carried on; R12.2, D117.)
        const out = many(target.map(p => boolean(p.solid, joined, op, at)));
        return op === 'difference' ? carrySheet(out, target) : out;
      };
    }
    case 'hole': {
      const target = solids(f.target, 'target'), c = xy(f.center as CadPartPoint2, 'center'), r = dim(f.radius as CadPartDim, 'radius', true);
      const depth = f.depth === undefined ? null : dim(f.depth as CadPartDim, 'depth', true), axis = f.axis === undefined ? 'z' : axisOf(f.axis);
      const side = f.side === undefined ? 'max' : f.side;
      if (side !== 'min' && side !== 'max') fail('INPUT', 'side must be min or max');
      const csk = f.countersink === undefined ? null : dim(f.countersink as CadPartDim, 'countersink', true);
      if (csk !== null && !(csk / 2 > r)) fail('INPUT', 'a countersink must be wider than the hole');
      return () => carrySheet(many(target.map(p => {
        // The tool: a cylinder along local z over [h0, h1], centred at local (c1, c2), turned onto the axis
        // by a cyclic permutation (x: local x, y, z → world y, z, x; y: → world z, x, y).
        const box = bounds(p.solid), k = 'xyz'.indexOf(axis), hi = box.max[k], lo = box.min[k];
        const [h0, h1] = depth === null ? [lo - 1, hi + 1] : side === 'max' ? [hi - depth, hi + 1] : [lo - 1, lo + depth];
        const local: XY = axis === 'y' ? [c[1], c[0]] : c;
        const cylinder = prismaticFromProfile({ outer: [{ kind: 'arc', start: [local[0] + r, local[1]], center: local, direction: 'ccw' }], heightMM: h1 - h0, fromMM: h0, tag: at });
        const tool: Solid = axis === 'z' ? { kind: 'upright', solid: cylinder }
          : { kind: 'brep', brep: transformBrep(brepFromPrismatic(cylinder, { id: at + '_tool' }), { matrix: axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0] }) };
        const out = boolean(p.solid, tool, 'difference', at);
        // A miss: no volume taken. A B-rep result with some of the tool's faces took some (measuring the
        // volumes tessellates the whole body twice per hole); without them (off the body, or inside a hole
        // already there) the volumes decide, as before.
        const missed = out.kind === 'brep' && out.brep.faces.some(x => x.name?.startsWith(`${at}.`)) ? false : volumeOfSolid(p.solid) - volumeOfSolid(out) <= 1e-6 * volumeOfSolid(p.solid);
        if (missed) fail('SELECTION', `the hole at (${c[0]}, ${c[1]}) along ${axis} misses the target`);
        if (csk === null) return out;
        // The countersink: a 90° cone from Ø csk at the face down to the hole, its rim a little above the
        // face (so no face of it lies on the face). Revolved about its profile's Y (depth into the
        // material), then carried to the hole: s along local x, depth down local z from the face, the
        // revolve's z along ±local y (the map turning, not mirroring), then the hole's axis permutation.
        const R = csk / 2, e = Math.min(0.5, R), t = R - r, face = side === 'max' ? hi : lo, down = side === 'max' ? -1 : 1;
        const cone = revolveProfile({ id: `${at}_csk`, profile: [{ kind: 'line', start: [0, -e] }, { kind: 'line', start: [R + e, -e] }, { kind: 'line', start: [r, t] }, { kind: 'line', start: [0, t] }], axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: 360 });
        const M = [1, 0, 0, 0, 0, -down, 0, down, 0], P = axis === 'z' ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0];
        const mul = (A: number[], B: number[]) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]));
        const o: Point = [local[0], local[1], face], offset = [0, 1, 2].map(i => P[3 * i] * o[0] + P[3 * i + 1] * o[1] + P[3 * i + 2] * o[2]) as Point;
        const placedCone = transformBrep(cone, { matrix: mul(P, M) as unknown as BrepAffine['matrix'], offset }, n => n.split('|').map(q => q.replace(`${at}_csk.`, `${at}.countersink-`)).join('|'));
        return boolean(out, { kind: 'brep', brep: placedCone }, 'difference', at);
      })), target);
    }
    case 'translate': {
      const target = solids(f.target, 'target'), o = xyz(f.offset as CadPartPoint3, 'offset');
      return () => moveAll(target, [1, 0, 0, 0, 1, 0, 0, 0, 1], o);
    }
    case 'rotate': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angleDegrees as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > 3600) fail('INPUT', 'angleDegrees must be a finite number of degrees');
      return () => { const { m, o } = rotation(axis, deg, pivot); return moveAll(target, m, o); };
    }
    case 'mirror': {
      const target = solids(f.target, 'target'), plane = f.plane;
      if (plane !== 'xy' && plane !== 'xz' && plane !== 'yz') fail('INPUT', 'plane must be xy, xz or yz');
      const m: BrepAffine['matrix'] = plane === 'xy' ? [1, 0, 0, 0, 1, 0, 0, 0, -1] : plane === 'xz' ? [1, 0, 0, 0, -1, 0, 0, 0, 1] : [-1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (!f.keep) return () => moveAll(target, m, [0, 0, 0]);
      return () => many(target.map(p => boolean(p.solid, affine(p.solid, m, [0, 0, 0], n => n + '@m'), 'union', at)));
    }
    case 'scale': {
      const target = solids(f.target, 'target'), k = f.factor as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof k !== 'number' || !(k > 0 && k <= 1000 && Number.isFinite(k))) fail('INPUT', 'factor must be a positive number at most 1000');
      return () => moveAll(target, [k, 0, 0, 0, k, 0, 0, 0, k], [pivot[0] * (1 - k), pivot[1] * (1 - k), pivot[2] * (1 - k)]);
    }
    case 'linear-pattern': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), spacing = dim(f.spacing as CadPartDim, 'spacing'), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      if (spacing === 0) fail('PARAMETER', 'spacing must not be zero');
      return () => many(target.map(p => {
        const copies = Array.from({ length: count }, (_, k) => { if (!k) return p.solid; const o: Point = [0, 0, 0]; o['xyz'.indexOf(axis)] = spacing * k; return affine(p.solid, [1, 0, 0, 0, 1, 0, 0, 0, 1], o, n => `${n}@${k}`); });
        return unionAll(copies, at);
      }));
    }
    case 'circular-pattern': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angleDegrees as number, count = integer(f.count, 'count', 1, CadPartLimits.copies);
      const pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || deg === 0 || Math.abs(deg) > 360) fail('INPUT', 'angleDegrees must be a nonzero step of at most 360°');
      if (axis !== 'z' && Math.round(deg / 90) * 90 !== deg) fail('CAPABILITY', 'patterns about X or Y must step by multiples of 90°');
      return () => many(target.map(p => {
        return unionAll(Array.from({ length: count }, (_, k) => k ? rotate(p.solid, axis, deg * k, pivot, n => `${n}@${k}`) : p.solid), at);
      }));
    }
    case 'sheet-base': case 'sheet-contour': {
      const T = dim(f.thickness as CadPartDim, 'thickness', true), R = dim(f.bendRadius as CadPartDim, 'bendRadius', true), K = f.kFactor, table = f.bendTable as BendTable | undefined;
      if ((K === undefined) === (table === undefined)) fail('PARAMETER', 'give the sheet a kFactor or a bendTable (one of them)');
      if (K !== undefined && (typeof K !== 'number' || !Number.isFinite(K) || K < 0 || K > 1)) fail('PARAMETER', 'kFactor must be a number from 0 to 1 (the neutral layer lies within the sheet)');
      const problem = table === undefined ? null : bendTableProblem(table);
      if (problem) fail('PARAMETER', `[BEND_TABLE] ${problem}`);
      const rules = K !== undefined ? { kFactor: K as number } : { bendTable: table! };
      if (f.kind === 'sheet-base') {
        const sketch = ref(f.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
        const { outer, frame, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
        if (regions?.length) fail('CAPABILITY', 'a sheet\'s base takes one outer loop (holes allowed) yet');
        if (f.reverse !== undefined && typeof f.reverse !== 'boolean') fail('INPUT', 'reverse must be true or false');
        const report: SheetReport = { thicknessMM: T, bendRadiusMM: R, ...rules, fixedFace: `${at}.top`, bends: [] };
        return () => withSheet(placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), heightMM: T, fromMM: f.reverse ? -T : 0, tag: at }) }))(), report);
      }
      const list = f.path as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'path must list 2 to 64 points');
      const path = (list as CadPartPoint2[]).map((p, i) => xy(p, `path[${i}]`));
      if (f.side !== 'left' && f.side !== 'right') fail('INPUT', 'side must be left or right (where the material lies, looking along the path)');
      const width = dim(f.width as CadPartDim, 'width', true), frame = f.plane === undefined ? undefined : frameOf(f.plane as CadPartSketchPlane, xyz, fail);
      let section: ReturnType<typeof contourFlangeSection>;
      try { section = contourFlangeSection(path, f.side as 'left' | 'right', T, R, at); }
      catch (cause) { if (cause instanceof SheetMetalError) fail(cause.code, cause.message); throw cause; }
      const report: SheetReport = { thicknessMM: T, bendRadiusMM: R, ...rules, fixedFace: `${at}.leg0.a`, bends: section!.bends.map(b => {
        const angle = Math.abs(b.angle), k = bendK(rules, T, R, angle, `bend${b.vertex}`, fail);
        return { name: `${at}.bend${b.vertex}`, inner: b.inner, outer: b.outer, radiusMM: R, angleDegrees: angle * 180 / Math.PI, axis: { origin: framed(frame, [b.center[0], b.center[1], 0]), direction: frame ? [frame.m[2], frame.m[5], frame.m[8]] as Point : [0, 0, 1] as Point },
          allowanceMM: bendAllowance(angle, R, T, k.kFactor), setbackMM: outsideSetback(angle, R, T), deductionMM: bendDeduction(angle, R, T, k.kFactor), kFactor: k.kFactor, ...(k.use ? { table: k.use } : {}) };
      }) };
      return () => withSheet(placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer: section!.segments, heightMM: width, fromMM: 0, tag: at, names: { outer: section!.names, bottom: `${at}.front`, top: `${at}.back` } }) }))(), report);
    }
    case 'sheet-corner-relief': {
      const parts = solids(f.target, 'target');
      if (parts.length !== 1) fail('SELECTION', 'a corner relief takes one sheet body');
      const p = parts[0];
      if (!p.sheet) return fail('CAPABILITY', '[NOT_A_SHEET] the target is not sheet metal: made by a sheet feature (its holes and cuts carry it; moves, patterns and unions do not)');
      if (f.shape !== 'square' && f.shape !== 'round') fail('INPUT', 'shape must be square or round');
      if (typeof f.corner !== 'string') fail('INPUT', 'corner must name the edge of the corner (between its two thickness faces)');
      const size = dim(f.size as CadPartDim, 'size', true);
      return () => sheetCornerRelief(p, p.sheet!, at, f.corner as string, f.shape as 'square' | 'round', size, fail);
    }
    case 'sheet-flange': {
      const parts = solids(f.target, 'target');
      if (parts.length !== 1) fail('SELECTION', 'a flange takes one sheet body');
      const p = parts[0], sheet = p.sheet;
      if (!sheet) return fail('CAPABILITY', '[NOT_A_SHEET] the target is not sheet metal: made by a sheet feature (its holes and cuts carry it; moves, patterns and unions do not)');
      const T = sheet.thicknessMM, R = f.bendRadius === undefined ? sheet.bendRadiusMM : dim(f.bendRadius as CadPartDim, 'bendRadius', true), L = dim(f.length as CadPartDim, 'length', true);
      const deg = f.angleDegrees === undefined ? 90 : f.angleDegrees;
      if (typeof deg !== 'number' || !Number.isFinite(deg)) fail('INPUT', 'angleDegrees must be a number');
      if (!((deg as number) > 1e-6 && (deg as number) < 180 - 1e-6)) fail('PARAMETER', `[BEND_ANGLE] a flange bends between 0 and 180° (not ${deg}°: 180° is a hem, not supported yet)`);
      const measure = f.measure ?? 'outer', position = f.position ?? 'material-inside';
      if (measure !== 'outer' && measure !== 'inner' && measure !== 'tangent') fail('INPUT', 'measure must be outer, inner or tangent');
      if (position !== 'material-inside' && position !== 'material-outside' && position !== 'bend-outside') fail('INPUT', 'position must be material-inside, material-outside or bend-outside');
      const offs = f.offsets === undefined ? [0, 0] : f.offsets as unknown;
      if (!Array.isArray(offs) || offs.length !== 2) fail('INPUT', 'offsets must be [from the start, from the end]');
      const off = (offs as CadPartDim[]).map((v, i) => { const x = dim(v, `offsets[${i}]`); if (x < 0) fail('PARAMETER', 'offsets must not be negative'); return x; }) as [number, number];
      // (The relief has no defaults in the kernel (D119): its kind, and for a cut its width and depth, are given — or it
      // is refused where an end lies inside the edge. Absent: undefined; 'none': null.)
      const rl = f.relief as Record<string, unknown> | undefined;
      if (rl !== undefined && !isRecord(rl)) fail('INPUT', 'relief must be { kind, width, depth }');
      if (rl !== undefined && rl.kind !== 'rectangular' && rl.kind !== 'obround' && rl.kind !== 'none') fail('INPUT', 'relief.kind must be rectangular, obround or none');
      for (const k of ['width', 'depth'] as const) if (rl !== undefined && rl.kind !== 'none' && rl[k] === undefined) fail('PARAMETER', `[RELIEF_REQUIRED] a ${String(rl.kind)} relief needs its ${k} (mm): the kernel takes no default`);
      const relief = rl === undefined ? undefined : rl.kind === 'none' ? null : { kind: rl.kind as 'rectangular' | 'obround', width: dim(rl.width as CadPartDim, 'relief width', true), depth: dim(rl.depth as CadPartDim, 'relief depth', true) };
      if (typeof f.edge !== 'string') fail('INPUT', 'edge must name an edge of the sheet');
      const th = (deg as number) * Math.PI / 180, ossb = outsideSetback(th, R, T), issb = R * Math.tan(th / 2);
      const straight = measure === 'outer' ? L - ossb : measure === 'inner' ? L - issb : L;
      if (!(straight > 1e-6)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] a flange ${L} mm long (${measure}) is within its bend's setback of ${+(measure === 'inner' ? issb : ossb).toFixed(6)} mm`);
      const trim = position === 'material-inside' ? ossb : position === 'material-outside' ? issb : 0, k = bendK(sheet, T, R, th, 'the flange', fail);
      return () => sheetFlange({ part: p, sheet, at, edge: f.edge as string, T, K: k, R, th, trim, straight, off, relief, fail });
    }
    case 'sweep': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', `${f.kind} takes a sketch of one loop (no regions or holes) yet`);
      const path = f.path as unknown;
      if (!Array.isArray(path) || !path.length || path.length > CadPartLimits.copies) fail('INPUT', 'path must list 1 to 64 steps');
      const steps = (path as unknown[]).map((st, i): { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' } => {
        if (!isRecord(st)) return fail('INPUT', `path[${i}] must be a step`);
        if (st.kind === 'straight') return { kind: 'straight', length: dim(st.length as CadPartDim, `path[${i}].length`, true) };
        if (st.kind === 'bend') {
          const a = st.angleDegrees, toward = st.toward;
          if (typeof a !== 'number' || !(a > 0 && a <= 180)) fail('INPUT', `path[${i}].angleDegrees must be in (0, 180]`);
          if (toward !== 'x' && toward !== '-x' && toward !== 'y' && toward !== '-y') fail('INPUT', `path[${i}].toward must be x, -x, y or -y`);
          return { kind: 'bend', radius: dim(st.radius as CadPartDim, `path[${i}].radius`, true), angle: a as number, toward: toward as 'x' | '-x' | 'y' | '-y' };
        }
        return fail('INPUT', `path[${i}].kind must be straight or bend`);
      });
      const { outer, frame, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
      return placed(frame, () => { const { brep, mass } = sweepBrep(outer, steps, at, fail, undefined, tags?.outer); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass, swept: { profile: outer, steps, ...(tags ? { sideTags: tags.outer } : {}) } }] }; });
    }
    case 'loft': {
      const list = f.sections as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'sections must list 2 to 64 sections');
      const sections = (list as unknown[]).map((sec, i) => {
        if (!isRecord(sec) || typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch`);
        const sketch = ref(sec.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${sec.sketch} is not a sketch`);
        if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'loft sections are sketches of one loop (no regions or holes) yet');
        const { outer, frame, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
        return { profile: outer, z: dim(sec.z as CadPartDim, `sections[${i}].z`), frame, tags };
      });
      // The sections stack along one sketch plane's normal.
      const frame = sections[0].frame;
      if (sections.some(x => JSON.stringify(x.frame) !== JSON.stringify(frame))) fail('INPUT', 'loft sections must be sketched on the same plane');
      sections.forEach((s, i) => { if (i && !(s.z > sections[i - 1].z)) fail('PARAMETER', `sections[${i}] must lie above sections[${i - 1}] (z ${s.z} ≤ ${sections[i - 1].z})`); });
      if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
      return placed(frame, () => { const { brep, mass } = loftSolid({ id: at, name: at, sections: sections.map(({ profile, z }) => ({ profile, z })), smooth: f.smooth === true, ...(sections[0].tags ? { sideTags: sections[0].tags.outer } : {}) }); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] }; });
    }
    case 'import': {
      if (typeof f.step !== 'string' || !f.step.length) fail('INPUT', 'step must be the text of a STEP file');
      const tooLarge = stepSizeProblem(f.step as string); if (tooLarge) fail('INPUT', tooLarge);
      return () => {
        let brep: Brep;
        try { brep = importStep(f.step as string, { id: at }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported/.test(cause.message) ? 'CAPABILITY' : 'INPUT', cause.message.replace(/^B-rep: STEP: /, '')); throw cause; }
        let triangles = 0;
        for (const x of brep!.faces) if (isFacetFace(x)) triangles += (x.surface as FacetPatch).indices.length / 3;
        if (triangles > CadPartLimits.meshTriangles) fail('INPUT', `the STEP file's meshes hold ${triangles.toLocaleString('en-US')} triangles, more than ${CadPartLimits.meshTriangles.toLocaleString('en-US')}`);
        // Names in this part: the feature id before each face name (an edge's two names alike).
        const named = { ...brep!, faces: brep!.faces.map((x, i) => x.name ? x : { ...x, name: `face${i}` }) };
        const prefixed = transformBrep(named, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split('|').map(p => `${at}.${p}`).join('|'));
        if (f.each !== undefined && typeof f.each !== 'boolean') fail('INPUT', 'each must be true or false');
        return f.each ? many(brepBodies(prefixed).map(b => ({ kind: 'brep' as const, brep: b }))) : one({ kind: 'brep', brep: prefixed });
      };
    }
    case 'draft': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, angle = f.angleDegrees as unknown;
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges || !names.every(x => typeof x === 'string')) fail('INPUT', 'faces must list 1 to 64 face names');
      if (typeof angle !== 'number' || !Number.isFinite(angle) || angle === 0 || Math.abs(angle) >= 45) fail('INPUT', 'angleDegrees must be a number of degrees, not 0, below 45 in size');
      if (target.length !== 1) fail('REFERENCE', 'draft one part at a time (name it as id/k)');
      const neutral = f.neutral === undefined ? undefined : dim(f.neutral as CadPartDim, 'neutral');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'draft on mesh faces is not supported yet (general draft and offset arrive with R11)');
        const brep = brepOf(target[0], at), box = bounds(target[0].solid), zN = neutral ?? box.min[2], R = len(sub(box.max, box.min)) + 2, a = (angle as number) * Math.PI / 180;
        // (The turn's line a hair below the neutral plane, so a wedge does not touch the body's bottom along a line.)
        const lift = 1e-6 * R;
        const coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e])), points = new Map(brep.vertices.map(v => [v.id, v.point]));
        // Each face's wedge, from the body as it was: the face pushed in (or out) as deep as the turn takes
        // its top, met with the half-space beyond its turned plane (through its line on the neutral plane).
        const wedges = (names as string[]).map(name => {
          const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!face) return fail('REFERENCE', `no face ${name} on the target`);
          const loop = brep.loops.find(l => l.id === face.loops[0])!;
          const ring = loop.coedges.map(id => { const c = coedges.get(id)!, e = edges.get(c.edge)!; return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; });
          let nrm: Point = [0, 0, 0];
          ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; nrm = add(nrm, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]); });
          const n = unit(nrm);
          if (Math.abs(n[2]) > 1e-9 || face.loops.length > 1) fail('CAPABILITY', `${name}: a draft takes side faces square to the pull (Z) without holes`);
          const zs = ring.map(p => p[2]), top = Math.max(...zs), height = top - zN;
          if (!(height > 0) || Math.min(...zs) < zN - 1e-6) fail('SELECTION', `${name}: the neutral plane z = ${zN} must be at or below the face`);
          // A frame on the face: X along it (level), Y up, Z into the body (draft in) or out of it (draft out).
          const along: Point = a > 0 ? [-n[0], -n[1], -n[2]] : n, x = unit(cross([0, 0, 1], along)), y = cross(along, x);
          const m: BrepAffine['matrix'] = [x[0], y[0], along[0], x[1], y[1], along[1], x[2], y[2], along[2]], o = ring[0];
          const uv = ring.map(p => { const d = sub(p, o); return [dot(d, x), dot(d, y)]; });
          // (A little wider and taller than the face, so the wedge's ends do not lie on its neighbours' planes.)
          const e = 1e-3 * R, wide = a > 0 ? e : 0, u0 = Math.min(...uv.map(q => q[0])) - wide, u1 = Math.max(...uv.map(q => q[0])) + wide, v0 = Math.min(...uv.map(q => q[1])) - 2 * lift, v1 = Math.max(...uv.map(q => q[1])) + wide;
          const depth = height * Math.tan(Math.abs(a)) + 1;
          const outline: ProfileSegmentInput[] = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(start => ({ kind: 'line', start: start as XY }));
          const prism = affine({ kind: 'upright', solid: prismaticFromProfile({ outer: outline, heightMM: depth, fromMM: a > 0 ? 0 : -1e-3, tag: `${at}.draft` }) }, m, o);
          const n2: Point = [n[0] * Math.cos(a), n[1] * Math.cos(a), Math.sin(a)], side: Point = a > 0 ? n2 : [-n2[0], -n2[1], -n2[2]];
          const hz = unit(cross(side, Math.abs(side[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), hy = cross(side, hz), q0: Point = [ring[0][0], ring[0][1], zN - lift];
          const half = affine(boxSolid([-R, -R, 0], [R, R, R], `${at}.draft`), [hz[0], hy[0], side[0], hz[1], hy[1], side[1], hz[2], hy[2], side[2]], q0);
          return boolean(prism, half, 'intersection', at);
        });
        // Faces that meet would need their wedges mitred where they join: not yet.
        const edgesOf = (name: string) => { const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name)!; return new Set(face.loops.flatMap(l => brep.loops.find(x => x.id === l)!.coedges.map(c => coedges.get(c)!.edge))); };
        const sets = (names as string[]).map(edgesOf);
        sets.forEach((x, i) => sets.forEach((y, j) => { if (j > i && [...x].some(e => y.has(e))) fail('CAPABILITY', `${(names as string[])[i]} and ${(names as string[])[j]} meet along an edge: draft faces that do not touch (or every side of an extrusion with its draft)`); }));
        // The wedges together, then off the body (or onto it) at once.
        const all = wedges.filter(w => !empty(w)).reduce<Solid | null>((u, w) => u ? boolean(u, w, 'union', at) : w, null);
        return one(all ? boolean(target[0].solid, all, a > 0 ? 'difference' : 'union', at) : target[0].solid);
      };
    }
    case 'thicken': {
      const g = f.surface as Record<string, unknown>, t = dim(f.thickness as CadPartDim, 'thickness', true), side = f.side ?? 'normal';
      if (!isRecord(g)) fail('INPUT', 'surface must be a NURBS surface { degreeU, degreeV, knotsU, knotsV, controlPoints, weights }');
      if (side !== 'normal' && side !== 'reverse' && side !== 'both') fail('INPUT', 'side must be normal, reverse or both');
      const surface = { kind: 'surface' as const, id: 'surface', degreeU: g.degreeU as number, degreeV: g.degreeV as number, knotsU: g.knotsU as number[], knotsV: g.knotsV as number[], controlPoints: g.controlPoints as Point[][], weights: g.weights as number[][] };
      try { validateSurface(surface); } catch (cause) { fail('INPUT', `surface: ${cause instanceof Error ? cause.message : String(cause)}`); }
      return () => {
        try { return one({ kind: 'brep', brep: thickenSolid({ id: at, surface, thickness: t, side: side as 'normal' }) }); }
        catch (cause) {
          const m = cause instanceof BrepError ? /CAPABILITY: shell: (.*)$/s.exec(cause.message) : null;
          if (m) fail('CAPABILITY', m[1]);
          if (cause instanceof RangeError || cause instanceof MeshBrepError) fail('GEOMETRY', cause.message);
          throw cause;
        }
      };
    }
    case 'subd': {
      const cage = f.cage as Record<string, unknown> | undefined;
      if (!isRecord(cage) || !(Array.isArray(cage.positions) || cage.positions instanceof Float64Array) || !Array.isArray(cage.faces)) fail('INPUT', 'cage must be { positions, faces, creases? }');
      const { positions, faces, creases } = cage as { positions: ArrayLike<number>; faces: unknown[]; creases?: unknown };
      if (positions.length > 3 * CadPartLimits.subdVertices || faces.length > CadPartLimits.subdVertices) fail('INPUT', `a cage has at most ${CadPartLimits.subdVertices} vertices and faces`);
      if (!faces.every(x => Array.isArray(x) && x.every(v => Number.isInteger(v)))) fail('INPUT', 'cage faces must list vertex numbers');
      if (creases !== undefined && !(Array.isArray(creases) && creases.every(c => Array.isArray(c) && c.length === 2 && c.every(v => Number.isInteger(v))))) fail('INPUT', 'cage creases must be pairs of vertex numbers');
      return () => {
        try {
          const built = buildSubd({ positions, faces: faces as number[][], ...(creases ? { creases: creases as [number, number][] } : {}) }, { id: at });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: built.brep }, subd: subdSummary(built) }] };
        }
        catch (cause) { if (cause instanceof SubdError) fail(cause.code, cause.message.replace(/^SubD: /, '')); if (cause instanceof BrepError) fail('GEOMETRY', cause.message.replace(/^B-rep: /, '')); throw cause; }
      };
    }
    case 'sew': {
      const list = f.surfaces as unknown, tol = f.tolerance as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.edges) fail('INPUT', 'surfaces must list 2 to 64 NURBS surfaces');
      if (tol !== undefined && !(typeof tol === 'number' && Number.isFinite(tol) && tol > 0 && tol <= 1)) fail('INPUT', 'tolerance must be a number of mm above 0, at most 1');
      const surfaces = (list as unknown[]).map((g, k) => {
        if (!isRecord(g)) fail('INPUT', `surfaces[${k}] must be a NURBS surface { degreeU, degreeV, knotsU, knotsV, controlPoints, weights }`);
        const r = g as Record<string, unknown>, s = { kind: 'surface' as const, id: `surface${k}`, degreeU: r.degreeU as number, degreeV: r.degreeV as number, knotsU: r.knotsU as number[], knotsV: r.knotsV as number[], controlPoints: r.controlPoints as Point[][], weights: r.weights as number[][] };
        try { validateSurface(s); } catch (cause) { fail('INPUT', `surfaces[${k}]: ${cause instanceof Error ? cause.message : String(cause)}`); }
        return s;
      });
      return () => {
        try { return one({ kind: 'brep', brep: sewSolid({ id: at, surfaces, ...(tol === undefined ? {} : { toleranceMM: tol as number }) }) }); }
        catch (cause) { if (cause instanceof SewError) fail('GEOMETRY', cause.message); if (cause instanceof BrepError) fail('GEOMETRY', cause.message.replace(/^B-rep: /, '')); throw cause; }
      };
    }
    case 'sweep-curve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      const sk = sketch as Extract<Result, { kind: 'sketch' }>, path = f.path as Record<string, unknown>;
      if (!isRecord(path)) fail('INPUT', 'path must be a NURBS curve { degree, knots, controlPoints, weights }');
      const curve = { kind: 'curve' as const, id: 'path', degree: path.degree as number, knots: path.knots as number[], controlPoints: path.controlPoints as Point[], weights: path.weights as number[] };
      try { validateCurve(curve); } catch (cause) { fail('INPUT', `path: ${cause instanceof Error ? cause.message : String(cause)}`); }
      if (sk.regions?.length) fail('CAPABILITY', 'a sweep takes one shape (holes allowed, no separate regions) yet');
      const m = sk.frame?.m ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        try {
          return one({ kind: 'brep', brep: sweepSolid({ id: at, outer: loopPoints(sk.outer), holes: (sk.holes ?? []).map(loopPoints), xAxis: [m[0], m[3], m[6]], yAxis: [m[1], m[4], m[7]], path: curve }) });
        } catch (cause) { if (cause instanceof RangeError || cause instanceof MeshBrepError) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'spur-gear': {
      if (f.generator !== undefined && f.generator !== 'spur-gear@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      // (Helical: the normal module, named so; the kernel refuses a module with a helix angle.)
      const helical = f.helixAngle !== undefined && f.helixAngle !== 0;
      if (helical && f.module !== undefined) fail('INPUT', 'a helical gear takes normalModule (the normal module), not module');
      if (!helical && (f.normalModule !== undefined || f.hand !== undefined)) fail('INPUT', 'normalModule and hand belong to a helical gear: give helixAngle too (a spur gear takes module)');
      const m = helical ? dim(f.normalModule as CadPartDim, 'normalModule', true) : dim(f.module as CadPartDim, 'module', true), b = dim(f.faceWidth as CadPartDim, 'faceWidth', true);
      const bore = f.bore === undefined ? 0 : dim(f.bore as CadPartDim, 'bore'), red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.rotation !== undefined && !(typeof f.rotation === 'number' && Number.isFinite(f.rotation))) fail('INPUT', 'rotation must be a number of degrees');
      const spec: SpurGearSpec = { ...(helical ? { normalModuleMM: m, helixAngleDeg: f.helixAngle as number, hand: f.hand as 'right' | 'left' } : { moduleMM: m }), teeth: f.teeth as number, faceWidthMM: b, boreDiameterMM: bore, toothThicknessReductionMM: red,
        ...(f.pressureAngle === undefined ? {} : { pressureAngleDeg: f.pressureAngle as number }), ...(f.profileShift === undefined ? {} : { profileShiftCoefficient: f.profileShift as number }), ...(f.profileTolerance === undefined ? {} : { profileToleranceMM: f.profileTolerance as number }) };
      // Where it stands: its own centre, plane and turn, or beside the gear it meshes with.
      let place: GearPlacement;
      const mesh = f.mesh as Record<string, unknown> | undefined;
      if (mesh !== undefined) {
        if (!isRecord(mesh) || typeof mesh.gear !== 'string') fail('INPUT', 'mesh must be { gear, direction?, centerDistance?, phase? }');
        // (Referenced, not consumed: the gear it meshes with stays an output of its own.)
        const other = ref(mesh!.gear, 'mesh.gear').result;
        const driver = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].gearPlace : undefined;
        if (!driver) fail('REFERENCE', `${String(mesh!.gear)} is not a spur gear`);
        const dirDeg = mesh!.direction ?? 0, phaseDeg = mesh!.phase ?? 0;
        if (!(typeof dirDeg === 'number' && Number.isFinite(dirDeg)) || !(typeof phaseDeg === 'number' && Number.isFinite(phaseDeg))) fail('INPUT', 'mesh.direction and mesh.phase must be numbers of degrees');
        const z1 = driver!.spec.teeth, z2 = f.teeth as number;
        // (Whether they mesh at all — module, pressure angle, helix angle and hands — before where.)
        let a = 0;
        try { a = spurGearCenterDistance(driver!.spec, spec); } catch (cause) { if (cause instanceof GearError) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}${cause.code === 'MATE_INCOMPATIBLE' ? ` (meshing with ${String(mesh!.gear)})` : ''}`); throw cause; }
        if (mesh!.centerDistance !== undefined) a = dim(mesh!.centerDistance as CadPartDim, 'mesh.centerDistance', true);
        const phi = (dirDeg as number) * Math.PI / 180;
        place = { spec, center: [driver!.center[0] + a * Math.cos(phi), driver!.center[1] + a * Math.sin(phi)], from: driver!.from,
          rotation: phi + Math.PI - Math.PI / z2 - (driver!.rotation - phi) * z1 / z2 + (phaseDeg as number) * Math.PI / 180, meshesWith: String(mesh!.gear), driver: driver! };
      } else {
        place = { spec, center: f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), from: f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), rotation: ((f.rotation as number | undefined) ?? 0) * Math.PI / 180 };
      }
      return () => {
        let made: ReturnType<typeof spurGear>;
        try { made = spurGear(spec, { id: at }); }
        catch (cause) { if (cause instanceof GearError) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const c = Math.cos(place.rotation), sn = Math.sin(place.rotation);
        const brep = place.rotation || place.center[0] || place.center[1] || place.from ? transformBrep(made!.brep, { matrix: [c, -sn, 0, sn, c, 0, 0, 0, 1], offset: [place.center[0], place.center[1], place.from] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, gear: made!.report, gearPlace: place }] };
      };
    }
    case 'spur-rack': {
      if (f.generator !== undefined && f.generator !== 'spur-rack@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const b = dim(f.faceWidth as CadPartDim, 'faceWidth', true), H = dim(f.height as CadPartDim, 'height', true);
      const red = f.thicknessReduction === undefined ? 0 : dim(f.thicknessReduction as CadPartDim, 'thicknessReduction');
      if (f.angle !== undefined && !(typeof f.angle === 'number' && Number.isFinite(f.angle))) fail('INPUT', 'angle must be a number of degrees');
      const mesh = f.mesh as Record<string, unknown> | undefined;
      if (mesh !== undefined && (!isRecord(mesh) || typeof mesh.gear !== 'string')) fail('INPUT', 'mesh must be { gear, direction?, centerDistance?, phase? }');
      const other = mesh === undefined ? undefined : ref(mesh.gear, 'mesh.gear').result;
      const g = other && other.kind === 'solid' && other.parts.length === 1 ? other.parts[0].gearPlace : undefined;
      if (mesh !== undefined && !g) fail('REFERENCE', `${String(mesh.gear)} is not a spur gear`);
      // Its helix: its own (normalModule, helixAngle, hand); meshing, the gear's angle with the opposite hand (the rack
      // as the z → ∞ gear of an external pair), a contrary one given refused.
      const gHelix = g?.spec.helixAngleDeg ? { angle: g.spec.helixAngleDeg, hand: g.spec.hand === 'right' ? 'left' as const : 'right' as const } : null;
      const ownAngle = f.helixAngle as number | undefined, ownHand = f.hand as 'right' | 'left' | undefined;
      if (g && ((ownAngle ?? 0) !== 0 || ownHand !== undefined) && (!gHelix || ownAngle !== gHelix.angle || (ownHand ?? gHelix.hand) !== gHelix.hand))
        fail('INPUT', `[MATE_INCOMPATIBLE] the rack's helix must be ${gHelix ? `${gHelix.angle}° ${gHelix.hand}-hand (the gear's angle, the opposite hand)` : 'none (the gear is straight)'} to mesh with ${String(mesh!.gear)}`);
      const helix = g ? gHelix : ownAngle ? { angle: ownAngle, hand: ownHand as 'right' | 'left' } : null;
      if (helix && f.module !== undefined) fail('INPUT', 'a helical rack takes normalModule (the normal module), not module');
      const mGiven = helix ? f.normalModule : f.module;
      const m = mGiven !== undefined ? dim(mGiven as CadPartDim, helix ? 'normalModule' : 'module', true) : g ? spurGearDimensions(g.spec).mn : dim(undefined as unknown as CadPartDim, 'module', true);
      const spec: SpurRackSpec = { ...(helix ? { normalModuleMM: m, helixAngleDeg: helix.angle, hand: helix.hand } : { moduleMM: m }), teeth: f.teeth as number, faceWidthMM: b, heightMM: H, toothThicknessReductionMM: red, ...(f.pressureAngle === undefined ? {} : { pressureAngleDeg: f.pressureAngle as number }) };
      let place: RackPlacement;
      if (mesh !== undefined) {
        const gd = spurGearDimensions(g!.spec);
        if (gd.mn !== m) fail('INPUT', `[MATE_INCOMPATIBLE] module ${m} does not mesh with ${String(mesh.gear)}'s ${gd.mn}`);
        const dirDeg = mesh.direction ?? -90;
        if (!(typeof dirDeg === 'number' && Number.isFinite(dirDeg))) fail('INPUT', 'mesh.direction must be a number of degrees');
        const r = gd.r, D = mesh.centerDistance === undefined ? r + (g!.spec.profileShiftCoefficient ?? 0) * m : dim(mesh.centerDistance as CadPartDim, 'mesh.centerDistance', true);
        const phase = mesh.phase === undefined ? 0 : dim(mesh.phase as CadPartDim, 'mesh.phase');
        // The rack's frame: +x along the pitch line (β = φ + 90°), +y toward the gear; a gap at r θ + phase from the
        // gear's foot, θ the gear's turn from the direction, and the rack's middle gap there. (The direction counted
        // from the nearest whole tooth angle: the same mesh, whole pitches along, the rack's middle at the gear.)
        // Both at the gear's face plane, where the rack starts: the helices agree there.
        const phi = (dirDeg as number) * Math.PI / 180, beta = phi + Math.PI / 2, tooth = 2 * Math.PI / g!.spec.teeth;
        const x0 = r * (g!.rotation - (phi - tooth * Math.round(phi / tooth))) + phase - Math.PI * gd.mt * Math.round((f.teeth as number) / 2);
        const cb = Math.cos(beta), sb = Math.sin(beta);
        place = { spec, origin: [g!.center[0] + cb * x0 + sb * D, g!.center[1] + sb * x0 - cb * D], angle: beta, from: g!.from, meshesWith: String(mesh.gear), driver: g! };
      } else {
        place = { spec, origin: f.origin === undefined ? [0, 0] : xy(f.origin as CadPartPoint2, 'origin'), angle: ((f.angle as number | undefined) ?? 0) * Math.PI / 180, from: f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from') };
      }
      return () => {
        let made: ReturnType<typeof spurRack>;
        try { made = spurRack(spec, { id: at }); }
        catch (cause) { if (cause instanceof GearError) fail(GEAR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gear: /, '')}`); throw cause; }
        const c = Math.cos(place.angle), sn = Math.sin(place.angle);
        const brep = place.angle || place.origin[0] || place.origin[1] || place.from ? transformBrep(made!.brep, { matrix: [c, -sn, 0, sn, c, 0, 0, 0, 1], offset: [place.origin[0], place.origin[1], place.from] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, rack: made!.report, rackPlace: place }] };
      };
    }
    case 'thread': {
      const d = dim(f.diameter as CadPartDim, 'diameter', true), p = dim(f.pitch as CadPartDim, 'pitch', true), c = f.center === undefined ? [0, 0] as XY : xy(f.center as CadPartPoint2, 'center');
      const seat = f.seat === undefined ? 0 : dim(f.seat as CadPartDim, 'seat'), length = f.length === undefined ? undefined : dim(f.length as CadPartDim, 'length', true);
      const h = f.hex as Record<string, unknown> | undefined;
      if (h !== undefined && !isRecord(h)) fail('INPUT', 'hex must be { across, height, internal? }');
      const hex = h ? { across: dim(h.across as CadPartDim, 'hex.across', true), height: dim(h.height as CadPartDim, 'hex.height', true), internal: h.internal === true } : undefined;
      if (f.form !== undefined && f.form !== 'faceted' && f.form !== 'helical') fail('INPUT', "form must be 'helical' or 'faceted'");
      // (Left out: the faceted form, as such documents were built before helical became the default.)
      const form = (f.form as 'faceted' | 'helical' | undefined) ?? 'faceted';
      return () => {
        try { return one({ kind: 'brep', brep: threadSolid({ id: at, diameter: d, pitch: p, center: c, seat, form, ...(length === undefined ? {} : { length }), ...(hex ? { hex } : {}) }) }); }
        catch (cause) { if (cause instanceof RangeError || cause instanceof MeshBrepError) fail('PARAMETER', cause.message); throw cause; }
      };
    }
    case 'mesh': {
      const P = f.positions as unknown, I = f.indices as unknown;
      if (!meshArrayOk(P, 'positions')) fail('INPUT', 'positions must be x, y, z numbers within ±10000 mm');
      const nv = (P as ArrayLike<number>).length / 3;
      if (!meshArrayOk(I, 'indices', nv)) fail('INPUT', `indices must be three vertex numbers a triangle, at most ${CadPartLimits.meshTriangles} triangles`);
      if (f.each !== undefined && typeof f.each !== 'boolean') fail('INPUT', 'each must be true or false');
      if (f.open !== undefined && typeof f.open !== 'boolean') fail('INPUT', 'open must be true or false');
      const G = f.groups as unknown;
      if (G !== undefined && (!(Array.isArray(G) || G instanceof Int32Array) || (G as ArrayLike<number>).length * 3 !== (I as ArrayLike<number>).length)) fail('INPUT', 'groups must give one number a triangle');
      // (A planar mesh solid — a face per flat group — stays under its own, lower limit: its faces are B-rep faces.)
      if (f.representation !== 'facets' && (I as ArrayLike<number>).length / 3 > CadPartLimits.planarMeshTriangles) fail('INPUT', `a planar mesh solid takes at most ${CadPartLimits.planarMeshTriangles} triangles (import it as facets)`);
      return () => {
        const facets = f.representation === 'facets', opts = { id: at, maximumTriangles: CadPartLimits.meshTriangles, ...(f.open ? { open: true } : {}), ...(G !== undefined ? { groups: G as ArrayLike<number> } : {}) };
        try {
          if (facets && f.each) return many(facetBrepsFromTriangles(P as ArrayLike<number>, I as ArrayLike<number>, opts).map(brep => ({ kind: 'brep' as const, brep })));
          return one({ kind: 'brep', brep: (facets ? facetBrepFromTriangles : brepFromTriangles)(P as ArrayLike<number>, I as ArrayLike<number>, opts) });
        }
        catch (cause) { if (cause instanceof MeshBrepError) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'shell': {
      const target = solids(f.target, 'target'), t = dim(f.thickness as CadPartDim, 'thickness', true);
      const open = f.open === undefined ? [] : f.open as unknown;
      if (!Array.isArray(open) || open.length > CadPartLimits.edges || !open.every(x => typeof x === 'string')) fail('INPUT', 'open must list up to 64 face names');
      if (target.length !== 1) fail('REFERENCE', 'shell one part at a time (name it as id/k)');
      return () => ({ kind: 'solid', parts: [shellOf(target[0], t, open as string[], at, fail)] });
    }
    case 'decimate': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('REFERENCE', 'decimate one part at a time (name it as id/k)');
      const ratio = f.ratio === undefined ? undefined : f.ratio as unknown, triangles = f.triangles === undefined ? undefined : f.triangles as unknown;
      if (ratio !== undefined && !(typeof ratio === 'number' && ratio > 0 && ratio < 1)) fail('INPUT', 'ratio must be a share of the triangles between 0 and 1');
      if (triangles !== undefined && !(Number.isInteger(triangles) && (triangles as number) >= 4)) fail('INPUT', 'triangles must be a whole number, 4 or more');
      const maxError = f.maxError === undefined ? undefined : dim(f.maxError as CadPartDim, 'maxError', true);
      if (ratio === undefined && triangles === undefined && maxError === undefined) fail('INPUT', 'say how far: triangles, ratio or maxError');
      const angle = f.featureAngle === undefined ? 180 : f.featureAngle as unknown;
      if (!(typeof angle === 'number' && angle > 0 && angle <= 180)) fail('INPUT', 'featureAngle must be degrees between 0 and 180');
      return () => {
        const s = target[0].solid;
        if (!facetBody(s) || s.kind !== 'brep' || !s.brep.faces.every(isFacetFace)) fail('CAPABILITY', 'decimate takes a mesh body (facet faces); a body of exact faces is not a mesh');
        const brep = (s as { brep: Brep }).brep, mesh = facetTriangles(brep), sheet = brep.bodies.some(b => b.kind === 'sheet');
        const r = decimateMesh(mesh.positions, mesh.indices, { ...(triangles !== undefined ? { targetTriangles: triangles as number } : {}), ...(ratio !== undefined ? { ratio: ratio as number } : {}), ...(maxError !== undefined ? { maxErrorMM: maxError } : {}), featureDegrees: angle as number, groups: mesh.groups });
        try {
          // (Each source face's triangles a group of its own, named as that face: its references keep resolving.)
          const out = facetBrepFromTriangles(r.positions, r.indices, { id: at, maximumTriangles: CadPartLimits.meshTriangles, groups: r.groups!, groupName: g => mesh.names[g], creaseDegrees: 180, ...(sheet ? { open: true } : {}) });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: out }, decimate: r.report }] };
        } catch (cause) { if (cause instanceof MeshBrepError) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'separate': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('REFERENCE', 'separate one part at a time (name it as id/k)');
      return () => {
        const pieces = splitBodies(brepOf(target[0], at));
        if (pieces.length < 2) fail('SELECTION', 'the body is in one piece: there is nothing to separate');
        return { kind: 'solid', parts: pieces.map(brep => ({ solid: { kind: 'brep', brep } as Solid })) };
      };
    }
    case 'split': {
      const target = solids(f.target, 'target'), level = dim(f.at as CadPartDim, 'at');
      if (target.length !== 1) fail('REFERENCE', 'split one part at a time (name it as id/k)');
      const normal = f.normal === undefined ? null : xyz(f.normal as CadPartPoint3, 'normal');
      if (normal && !(len(normal) > 1e-12)) fail('INPUT', 'the split normal must not be zero');
      const along = normal ? [0, 1, 2].filter(k => normal[k] !== 0) : [];
      if (!normal || along.length === 1) {
        // Across a coordinate plane (a normal along one axis is that axis, below and above as its sign says).
        const a = normal ? along[0] : 'xyz'.indexOf(axisOf(f.axis)), axis = 'xyz'[a], cut = normal ? level / normal[a] : level, flip = !!normal && normal[a] < 0;
        return () => {
          const s = target[0].solid, box = bounds(s);
          if (!(cut > box.min[a] && cut < box.max[a])) fail('SELECTION', `the split plane ${axis} = ${cut} does not cross the target (${box.min[a]} to ${box.max[a]})`);
          if (facetBody(s)) { const e: Point = [0, 0, 0]; e[a] = 1; const pieces = splitFacets(s, e, cut, at); return many(flip ? pieces.reverse() : pieces); }
          const half = (lo: boolean) => { const min = box.min.map(v => v - 1) as Point, max = box.max.map(v => v + 1) as Point; if (lo) max[a] = cut; else min[a] = cut; return boxSolid(min, max, `${at}.cut`); };
          const pieces = [boolean(s, half(true), 'intersection', at), boolean(s, half(false), 'intersection', at)];
          return many(flip ? pieces.reverse() : pieces);
        };
      }
      return () => {
        // An oblique plane: each side a box standing on the plane (its frame turned to the normal) round the target.
        const s = target[0].solid, box = bounds(s), n = unit(normal), d = level / len(normal);
        if (facetBody(s)) return many(splitFacets(s, n, d, at));
        const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]] as Point).map(c => dot(n, c));
        if (!(d > Math.min(...corners) && d < Math.max(...corners))) fail('SELECTION', 'the split plane does not cross the target');
        const c = scale(add(box.min, box.max), 0.5), o = sub(c, scale(n, dot(n, c) - d)), R = len(sub(box.max, box.min)) + 2;
        const x = unit(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), y = cross(n, x);
        const pieces = [boolean(s, obliqueHalf(o, n, x, y, R, true, at), 'intersection', at), boolean(s, obliqueHalf(o, n, x, y, R, false, at), 'intersection', at)];
        if (pieces.some(empty)) fail('SELECTION', 'the split plane does not cross the target');
        return many(pieces);
      };
    }
    case 'chamfer': case 'fillet': {
      const target = solids(f.target, 'target'), varying = f.kind === 'fillet' && f.radii !== undefined;
      if (varying && f.radius !== undefined) fail('INPUT', 'give radius or radii, not both');
      if (varying && (!Array.isArray(f.radii) || f.radii.length < 2 || f.radii.length > 16)) fail('INPUT', 'radii must list 2 to 16 points, each { at: [x, y, z], radius }');
      const radii = varying ? (f.radii as { at: CadPartPoint3; radius: CadPartDim }[]).map((p, k) => ({ at: xyz(p?.at, `radii[${k}].at`), radius: dim(p?.radius as CadPartDim, `radii[${k}].radius`, true) })) : undefined;
      const sec = f.kind === 'fillet' ? f.section : undefined;
      if (sec !== undefined && (typeof sec !== 'object' || !['circular', 'conic', 'g2'].includes((sec as { kind?: string }).kind ?? ''))) fail('INPUT', 'section must be { kind: circular | conic (rho) | g2 (tension?) }');
      if (sec?.kind === 'conic' && !(typeof sec.rho === 'number' && sec.rho > 0 && sec.rho < 1)) fail('INPUT', 'a conic section needs rho between 0 and 1');
      if (sec?.kind === 'g2' && sec.tension !== undefined && !(typeof sec.tension === 'number' && sec.tension > 0 && sec.tension < 1)) fail('INPUT', 'a G2 section\'s tension lies between 0 and 1');
      const shape = sec?.kind === 'conic' ? { kind: 'conic' as const, rho: sec.rho } : sec?.kind === 'g2' ? { kind: 'g2' as const, tension: sec.tension ?? 0.5 } : undefined;
      const size = radii ? Math.max(...radii.map(p => p.radius)) : dim((f.kind === 'chamfer' ? f.distance : f.radius) as CadPartDim, f.kind === 'chamfer' ? 'distance' : 'radius', true);
      if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > CadPartLimits.edges || !f.edges.every(e => typeof e === 'string')) fail('INPUT', 'edges must list 1 to 64 edge names');
      if (target.length !== 1) fail('REFERENCE', 'finish one part at a time (name it as id/k)');
      return () => {
        const t = target[0], kind = f.kind as 'chamfer' | 'fillet', reports: FilletReport[] = [], solid = finishEdges(t, f.edges as string[], size, kind, at, fail, reports, radii, shape);
        // A body that left the upright family keeps how it was made, so that it can still be shelled — past a
        // variable-radius fillet too (its hollow's radius is the outer one less the wall, D108), not past a conic or G2 one.
        const base = t.solid.kind === 'upright' ? t.solid.solid : t.history?.base, before = t.solid.kind === 'upright' ? [] : t.history?.finishes ?? [];
        const history = solid.kind === 'brep' && base && !shape ? { base, finishes: [...before, { kind, edges: f.edges as string[], size, id: at, ...(radii ? { radii } : {}) }] } : undefined;
        return { kind: 'solid', parts: [{ solid, ...(history ? { history } : {}), ...(reports.length ? { fillet: reports } : {}) }] };
      };
    }
  }
  return fail('INPUT', `unknown feature kind ${String((f as { kind?: unknown }).kind)}`);
}

/**
 * One side of an oblique split plane round a target within R of o: a tetrahedron, its base a triangle on the plane
 * (inradius 2R about o) and its apex 4R off it, so that it holds everything within R of o on its side. Triangles
 * only: a rotated box's quads are not exactly planar in binary64 and the exact polyhedral Boolean refused them
 * (D50). Both sides take the same three base corners, so they share one exact plane. Its base is `<at>.cut.top`
 * below and `<at>.cut.bottom` above, as the axis split's box names it.
 */
function obliqueHalf(o: Point, n: Point, x: Point, y: Point, R: number, below: boolean, at: string): Solid {
  const corner = (deg: number) => add(o, add(scale(x, 4 * R * Math.cos(deg * Math.PI / 180)), scale(y, 4 * R * Math.sin(deg * Math.PI / 180))));
  const apex = add(o, scale(n, below ? -4 * R : 4 * R));
  const positions = [...corner(90), ...corner(210), ...corner(330), ...apex];
  // The base first (wound about +n below, −n above), then the sides against its edges.
  const indices = below ? [0, 1, 2, 1, 0, 3, 2, 1, 3, 0, 2, 3] : [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3];
  const tool = brepFromTriangles(positions, indices, { id: `${at}_cut`, maximumTriangles: 4 });
  const base = `${at}_cut.facet0`, cap = `${at}.cut.${below ? 'top' : 'bottom'}`;
  return { kind: 'brep', brep: transformBrep(tool, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, name => name.split('|').map(q => q === base ? cap : q.replace(`${at}_cut.facet`, `${at}.cut.side`)).join('|')) };
}
/** F2: a body with mesh faces and an exact body, `op`; refusals typed. */
function facetWith(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string): Solid {
  const B = b.kind === 'upright' ? brepFromPrismatic(b.solid, { id: at + '_tool' }) : b.brep;
  try { return { kind: 'brep', brep: facetBoolean((a as Extract<Solid, { kind: 'brep' }>).brep, B, op, { id: at, nearTriangles: facetLimit }) }; }
  catch (cause) { if (cause instanceof FacetBooleanError) throw new CadPartError(cause.code, at, cause.message); if (cause instanceof BrepError) throw new CadPartError('GEOMETRY', at, cause.message.replace(/^B-rep: /, '')); throw cause; }
}
/** A body of mesh faces only (F0): split on its own triangles (F1), any size. */
const facetBody = (s: Solid) => s.kind === 'brep' && s.brep.faces.length > 0 && s.brep.faces.some(isFacetFace);
/**
 * A facet body's triangles as one welded mesh (its faces share their boundary points exactly), each triangle's group
 * its face, and the faces' names (without a `#k`: a face split again keeps its source's name, numbered).
 */
function facetTriangles(brep: Brep): { positions: Float64Array; indices: Uint32Array; groups: Int32Array; names: string[] } {
  let nv = 0, nt = 0;
  for (const f of brep.faces) { const p = f.surface as FacetPatch; nv += p.positions.length / 3; nt += p.indices.length / 3; }
  const P = new Float64Array(3 * nv), I = new Uint32Array(3 * nt), G = new Int32Array(nt), names: string[] = [];
  let ov = 0, ot = 0;
  brep.faces.forEach((f, g) => {
    const p = f.surface as FacetPatch, fw = f.sense === 'forward', X = p.indices;
    P.set(p.positions, 3 * ov);
    // (Wound outward: a reversed face's triangles turned.)
    for (let k = 0; k < X.length; k += 3) { I[3 * ot + k] = X[k] + ov; I[3 * ot + k + 1] = (fw ? X[k + 1] : X[k + 2]) + ov; I[3 * ot + k + 2] = (fw ? X[k + 2] : X[k + 1]) + ov; }
    G.fill(g, ot, ot + p.indices.length / 3);
    names.push((f.name ?? f.id).replace(/#\d+$/, ''));
    ov += p.positions.length / 3; ot += p.indices.length / 3;
  });
  let size = 1; for (let k = 0; k < P.length; k++) size = Math.max(size, Math.abs(P[k]));
  const { P: welded, remap } = weldVertices(P, nv, 1e-9 * size);
  for (let k = 0; k < I.length; k++) I[k] = remap[I[k]];
  return { positions: welded, indices: I, groups: G, names };
}
/** F1 (R4, D50): a facet body cut by n·p = d, below then above, each closed by an exact planar cap. */
function splitFacets(s: Solid, n: Point, d: number, at: string): Solid[] {
  let r: FacetSplitResult;
  const brep = (s as Extract<Solid, { kind: 'brep' }>).brep;
  try { r = brep.faces.every(isFacetFace) ? splitFacetBrep(brep, { normal: n, offset: d, at }) : { ...splitMixedBrep(brep, n, d, at), loops: [] }; }
  catch (cause) { if (cause instanceof BrepError || cause instanceof FacetBooleanError) throw new CadPartError('GEOMETRY', at, cause.message.replace(/^B-rep: /, '')); throw cause; }
  if (!r.below || !r.above) throw new CadPartError('SELECTION', at, 'the split plane does not cross the target');
  return [{ kind: 'brep', brep: r.below }, { kind: 'brep', brep: r.above }];
}

function boxSolid(min: Point, max: Point, tag: string): Solid {
  const ring: ProfileSegmentInput[] = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(start => ({ kind: 'line', start: start as XY }));
  return { kind: 'upright', solid: prismaticFromProfile({ outer: ring, heightMM: max[2] - min[2], fromMM: min[2], tag }) };
}

/** Upright Booleans stay upright; otherwise both bodies must be planar for the exact polyhedral Boolean. */
function boolean(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, check = true): Solid {
  if (empty(b)) return op === 'intersection' ? b : a;
  if (empty(a)) return op === 'union' ? b : a;
  if (a.kind === 'upright' && b.kind === 'upright') {
    const solid = booleanPrismatic(a.solid, b.solid, op);
    if (check) checkLumps({ kind: 'upright', solid }, at);
    return { kind: 'upright', solid };
  }
  // F2 (R6, D52): a mesh body with an exact one — the mesh near the tool through the exact Boolean, any size; union
  // and intersection either way round. (Mesh with mesh, F3, still through F0's planar path, D3.)
  const meshy = (s: Solid) => s.kind === 'brep' && s.brep.faces.some(isFacetFace);
  if (meshy(a) && !meshy(b)) return facetWith(a, b, op, at);
  if (meshy(b) && !meshy(a) && op !== 'difference') return facetWith(b, a, op, at);
  // (F0: a facet body, small enough, goes through the planar path; else refused, see FACET_EXPLODE_TRIANGLES.)
  if (a.kind === 'brep' && a.brep.faces.some(isFacetFace)) a = { kind: 'brep', brep: explodeFacets(a.brep, at, 'Booleans') };
  if (b.kind === 'brep' && b.brep.faces.some(isFacetFace)) b = { kind: 'brep', brep: explodeFacets(b.brep, at, 'Booleans') };
  const A = a.kind === 'upright' ? (lineOnly(a.solid) ? brepFromPrismatic(a.solid, { id: at + '_a' }) : null) : a.brep;
  const B = b.kind === 'upright' ? (lineOnly(b.solid) ? brepFromPrismatic(b.solid, { id: at + '_b' }) : null) : b.brep;
  if (A && B && planarBrep(A) && planarBrep(B)) return { kind: 'brep', brep: booleanPolyhedra(A, B, op, { id: at }) };
  // Planes and cylinders of any axis.
  const toBrep = (s: Solid) => s.kind === 'upright' ? brepFromPrismatic(s.solid, { id: at + '_in' }) : s.brep;
  try { return { kind: 'brep', brep: booleanAnalytic(toBrep(a), toBrep(b), op, { id: at }) }; }
  catch (cause) {
    if (cause instanceof BrepError && /not supported yet/.test(cause.message)) throw new CadPartError('CAPABILITY', at, cause.message.replace(/^B-rep: (analytic Boolean: )?/, ''));
    throw cause;
  }
}
/**
 * Copies united in a balanced tree (neighbours first, so each Boolean joins two bodies of like size, not
 * one growing body and a copy); upright ones checked for lumps that only touch once, at the end.
 */
function unionAll(list: Solid[], at: string): Solid {
  let level = list;
  while (level.length > 1) { const next: Solid[] = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? boolean(level[i], level[i + 1], 'union', at, false) : level[i]); level = next; }
  return checkLumps(level[0], at);
}
/** Refuses an upright result whose lumps meet only along an edge or at a point. */
function checkLumps(s: Solid, at: string): Solid {
  if (s.kind === 'upright' && touchingLumps(s.solid)) throw new CadPartError('GEOMETRY', at, 'the bodies touch along an edge or at a vertex only; the result is not a manifold solid');
  return s;
}
/**
 * Whether separate lumps of an upright solid meet only along an edge or at a point (the analytic and
 * polyhedral Booleans refuse such results; the upright section Boolean would keep them as one body).
 */
function touchingLumps(solid: PrismaticSolid): boolean {
  if (solid.slabs.length < 2 && solid.slabs.every(s => s.regions.length < 2)) return false;
  const brep = brepFromPrismatic(solid, { id: 'touch' });
  if (brep.bodies.length < 2) return false;
  const shellBody = new Map(brep.shells.map(s => [s.id, s.body])), faceBody = new Map(brep.faces.map(f => [f.id, shellBody.get(f.shell)!]));
  const loopBody = new Map(brep.loops.map(l => [l.id, faceBody.get(l.face)!])), edgeBody = new Map<string, string>();
  for (const c of brep.coedges) edgeBody.set(c.edge, loopBody.get(c.loop)!);
  const point = new Map(brep.vertices.map(v => [v.id, v.point])), vertexBody = new Map<string, string>();
  for (const e of brep.edges) for (const v of e.vertices) vertexBody.set(v, edgeBody.get(e.id)!);
  let size = 1; for (const v of brep.vertices) for (const x of v.point) size = Math.max(size, Math.abs(x));
  const tol = 1e-9 * size;
  // A vertex of one lump on a vertex or a straight edge of another.
  const onSegment = (p: Point, a: Point, b: Point) => {
    const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(dot(ab, ab), 1e-300)));
    return len(sub(p, add(a, scale(ab, t)))) <= tol;
  };
  // (Each lump's box: a vertex outside another lump's box meets none of its edges.)
  const boxes = new Map<string, { lo: Point; hi: Point }>();
  for (const v of brep.vertices) { const b = vertexBody.get(v.id)!, x = boxes.get(b) ?? { lo: [Infinity, Infinity, Infinity] as Point, hi: [-Infinity, -Infinity, -Infinity] as Point }; for (let k = 0; k < 3; k++) { x.lo[k] = Math.min(x.lo[k], v.point[k]); x.hi[k] = Math.max(x.hi[k], v.point[k]); } boxes.set(b, x); }
  const near = (p: Point, b: string) => { const x = boxes.get(b); return !!x && [0, 1, 2].every(k => p[k] >= x.lo[k] - tol && p[k] <= x.hi[k] + tol); };
  for (const v of brep.vertices) for (const e of brep.edges) {
    if (edgeBody.get(e.id) === vertexBody.get(v.id) || !near(v.point, edgeBody.get(e.id)!)) continue;
    const q = e.curve.controlPoints;
    if (e.curve.degree === 1 && q.length === 2 ? onSegment(v.point, q[0], q[1]) : e.vertices.some(w => len(sub(point.get(w)!, v.point)) <= tol)) return true;
  }
  return false;
}
const volumeOfSolid = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : s.brep.bodies.length ? brepMassProperties(s.brep, 1, { segmentsPerQuarter: 8, quadratureSegments: 0 }).volumeMM3 : 0;

function affine(s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: (n: string) => string): Solid {
  // Upright solids stay upright when XY maps by a similarity and Z only scales and shifts.
  if (s.kind === 'upright' && m[2] === 0 && m[5] === 0 && m[6] === 0 && m[7] === 0)
    return { kind: 'upright', solid: transformPrismatic(s.solid, { matrix: [m[0], m[1], m[3], m[4]], offset: [o[0], o[1]], zScale: m[8], zOffset: o[2], ...(rename ? { retag: rename } : {}) }) };
  const brep = s.kind === 'upright' ? brepFromPrismatic(s.solid) : s.brep;
  return { kind: 'brep', brep: transformBrep(brep, { matrix: m, offset: [o[0], o[1], o[2]] }, rename) };
}
/**
 * Parts moved by x ↦ m·x + o (m a rotation or reflection times a uniform scale): each remembers what it
 * was moved from, and its mass moves with it (exact when the original's was).
 */
function moveAll(parts: readonly Part[], m: BrepAffine['matrix'], o: Point): Result {
  return { kind: 'solid', parts: parts.map((p): Part => {
    const exact = p.mass ?? (p.solid.kind === 'upright' ? ((s: PrismaticSolid) => (d: number) => prismaticMassProperties(s, d))(p.solid.solid) : undefined);
    return { solid: affine(p.solid, m, o), moved: { from: p, m, o }, ...(exact ? { mass: (d: number) => movedMass(exact(d), m, o) } : {}) };
  }) };
}
function movedMass(p: SolidMassProperties, m: BrepAffine['matrix'], o: Point): SolidMassProperties {
  const k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]))), R = m.map(x => x / k);
  const c = p.centroidMM, I = p.inertiaCentroidKgM2, k5 = k ** 5;
  const RIRt = [0, 1, 2].map(i => [0, 1, 2].map(j => { let sum = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum += R[3 * i + a] * I[a][b] * R[3 * j + b]; return sum * k5; })) as [[number, number, number], [number, number, number], [number, number, number]];
  return { volumeMM3: p.volumeMM3 * k ** 3, massKG: p.massKG * k ** 3, method: p.method, inertiaCentroidKgM2: RIRt,
    centroidMM: [0, 1, 2].map(i => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i]) as Point };
}
function rotation(axis: CadPartAxis, deg: number, pivot: Point): { m: BrepAffine['matrix']; o: Point } {
  let m: BrepAffine['matrix'];
  // Quarter turns exactly; any other angle by its sine and cosine.
  if (Math.round(deg / 90) * 90 === deg) m = quarterTurn(axis, deg);
  else {
    const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    m = axis === 'z' ? [c, -sn, 0, sn, c, 0, 0, 0, 1] : axis === 'x' ? [1, 0, 0, 0, c, -sn, 0, sn, c] : [c, 0, sn, 0, 1, 0, -sn, 0, c];
  }
  const mp = [m[0] * pivot[0] + m[1] * pivot[1] + m[2] * pivot[2], m[3] * pivot[0] + m[4] * pivot[1] + m[5] * pivot[2], m[6] * pivot[0] + m[7] * pivot[1] + m[8] * pivot[2]];
  return { m, o: [pivot[0] - mp[0], pivot[1] - mp[1], pivot[2] - mp[2]] };
}
function rotate(s: Solid, axis: CadPartAxis, deg: number, pivot: Point, rename?: (n: string) => string): Solid {
  const { m, o } = rotation(axis, deg, pivot);
  return affine(s, m, o, rename);
}

// ---- sweep -----------------------------------------------------------------------------------------------
/**
 * A profile swept along straight runs (extrusions) and bends (revolutions about an axis in the profile's
 * plane, a radius to its side), each placed where the last one ended; the pieces meet in whole
 * cross-sections and are joined.
 */
function sweepBrep(profile: readonly ProfileSegmentInput[], steps: readonly SweepStep[], at: string, fail: Tools['fail'], through?: XY, sideTags?: readonly string[]): { brep: Brep; mass: (density: number) => SolidMassProperties } {
  // The path runs through the profile's centroid (or a given point): the profile is moved there, the body back.
  const centre = through ?? buildProfileLoop(profile, { maximumSegments: 1024 }).centroidMM;
  const outer: ProfileSegmentInput[] = profile.map(g => g.kind === 'line' ? { kind: 'line', start: [g.start[0] - centre[0], g.start[1] - centre[1]] } : { ...g, start: [g.start[0] - centre[0], g.start[1] - centre[1]], center: [g.center[0] - centre[0], g.center[1] - centre[1]] });
  let o: Point = [centre[0], centre[1], 0], x: Point = [1, 0, 0], y: Point = [0, 1, 0], z: Point = [0, 0, 1];
  // (Ids are identifiers; the pieces' faces are named `${at}.s${k}.…`.)
  const place = (b: Brep, k: number): Brep => transformBrep(b, { matrix: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], offset: [o[0], o[1], o[2]] }, n => n.split(`${at}_s${k}`).join(`${at}.s${k}`));
  const rot = (v: Point, d: Point, t: number): Point => add(add(scale(v, Math.cos(t)), scale(cross(d, v), Math.sin(t))), scale(d, dot(d, v) * (1 - Math.cos(t))));
  // Each piece's mass in closed form, in its own frame (the pieces meet only in cross-sections).
  const pieces: Brep[] = [], masses: { local: (density: number) => SolidMassProperties; axes: [Point, Point, Point]; offset: Point }[] = [];
  steps.forEach((st, k) => {
    const tag = `${at}_s${k}`;
    if (st.kind === 'straight') {
      const prism = prismaticFromProfile({ outer, heightMM: st.length, tag, ...(sideTags ? { sideTags: { outer: sideTags } } : {}) });
      masses.push({ local: d => prismaticMassProperties(prism, d), axes: [x, y, z], offset: o });
      pieces.push(place(brepFromPrismatic(prism, { id: tag }), k));
      o = add(o, scale(z, st.length));
      return;
    }
    // The bend axis lies in the profile's plane, `radius` towards the side, square to that side.
    const side = st.toward, sx = side === 'x' ? 1 : side === '-x' ? -1 : 0, sy = side === 'y' ? 1 : side === '-y' ? -1 : 0;
    const origin: XY = [sx * st.radius, sy * st.radius], direction: XY = sx ? [0, 1] : [1, 0];
    let turned: Brep;
    try { turned = revolveProfile({ id: tag, profile: outer, axis: { origin, direction }, angleDegrees: st.angle, ...(sideTags ? { sideTags } : {}) }); }
    catch (cause) { if (cause instanceof BrepError && /axis/.test(cause.message)) fail('PARAMETER', `bend ${k}: the profile reaches the bend's axis (use a radius larger than the profile's reach towards ${side})`); throw cause; }
    pieces.push(place(turned!, k));
    const input = { id: tag, profile: outer, axis: { origin, direction }, angleDegrees: st.angle };
    masses.push({ local: d => revolveMassProperties(input, d), axes: [x, y, z], offset: o });
    // The frame turns about the axis by the bend's angle (z towards the side).
    const sideDir = sx ? scale(x, sx) : scale(y, sy), d = unit(cross(z, sideDir)), A = add(o, scale(sideDir, st.radius)), t = st.angle * Math.PI / 180;
    o = add(A, rot(sub(o, A), d, t)); x = rot(x, d, t); y = rot(y, d, t); z = rot(z, d, t);
  });
  // Consecutive pieces meet in a cross-section, each on its side of its plane: they are glued there,
  // exactly, unless pieces further apart may touch (then they are united by a Boolean).
  const box = (b: Brep) => { const lo: Point = [Infinity, Infinity, Infinity], hi: Point = [-Infinity, -Infinity, -Infinity]; for (const f of b.faces) for (const row of nurbsOf(f).controlPoints) for (const p of row) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } return { lo, hi }; };
  const boxes = pieces.map(box), apart = (i: number, j: number) => [0, 1, 2].some(k => boxes[i].hi[k] < boxes[j].lo[k] - 1e-6 || boxes[j].hi[k] < boxes[i].lo[k] - 1e-6);
  const separate = pieces.every((_, i) => pieces.every((__, j) => j <= i + 1 || apart(i, j)));
  let body = pieces[0];
  for (const p of pieces.slice(1)) body = (separate ? glueAtSharedFace(body, p, { family: 'sweep', id: at }) : null) ?? booleanAnalytic(body, p, 'union', { id: at });
  return { brep: body, mass: d => combineMassProperties(masses.map(m => ({ props: m.local(d), axes: m.axes, offset: m.offset }))) };
}

// ---- shell -----------------------------------------------------------------------------------------------
/**
 * An upright body of one section, hollowed: the section eroded by the thickness (exact for lines and
 * arcs), extruded from the thickness above the bottom to below the top (or through an open top or
 * bottom), and taken away; open side walls let the hollow run through them.
 */
/** The shell of a part, by how it was made (its mass exact when that can be). */
function shellOf(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  // A mesh body (facet faces): its cavity its triangles offset in, the wall it achieves measured (R11.3, D114).
  const s = part.solid;
  if (s.kind === 'brep' && s.brep.faces.length && s.brep.faces.every(isFacetFace)) {
    if (open.length) fail('CAPABILITY', `opening a face of a mesh body (${open.join(', ')}) is not supported yet: shell it closed`);
    if (s.brep.bodies.some(b => b.kind === 'sheet')) fail('CAPABILITY', 'a mesh sheet encloses nothing to shell: thicken it instead');
    const mesh = facetTriangles(s.brep);
    try {
      const r = meshInnerOffset(mesh.positions, mesh.indices, t);
      const cavity = facetBrepFromTriangles(r.positions, mesh.indices, { id: `${at}_in`, maximumTriangles: CadPartLimits.meshTriangles, groups: mesh.groups, groupName: g => `${at}.in.${mesh.names[g]}`, creaseDegrees: 180 });
      return { solid: { kind: 'brep', brep: withCavities(s.brep, cavity, { family: 'shell', id: at }) }, shell: r.report };
    } catch (cause) {
      const m = cause instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(cause.message) : null;
      if (m) fail('CAPABILITY', m[1]);
      if (cause instanceof MeshBrepError) fail('GEOMETRY', cause.message);
      throw cause;
    }
  }
  if (part.solid.kind !== 'upright') {
    if (part.revolved) return shellRevolved(part, part.revolved, t, open, at, fail);
    if (part.swept) return shellSwept(part, part.swept, t, open, at, fail);
    // A moved copy: the original's shell, moved (a scaled copy's with the wall scaled back).
    if (!part.history && part.moved) {
      const { from, m, o } = part.moved, k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])));
      const inner = shellOf(from, t / k, open, at, fail);
      return { solid: affine(inner.solid, m, o), ...(inner.mass ? { mass: (d: number) => movedMass(inner.mass!(d), m, o) } : {}) };
    }
  }
  return { solid: shellPart(part, t, open, at, fail) };
}

/** The slab route's refusals of a face's kind or trim, which the offset route may take instead (other refusals stand). */
const OFFSET_ROUTE = /freeform faces joined to others|trimmed by a curve other than its rulings and circles|bounded by a curve that is not a line or an arc/;
function shellPart(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Solid {
  if (part.solid.kind === 'upright') { const h = hollowOf(part.solid.solid, t, open, at, fail); return { kind: 'upright', solid: booleanPrismatic(part.solid.solid, h.hollow, 'difference') }; }
  if (!part.history) {
    // Any other body of planes and cylinders: its wall as the union of a slab per face.
    const body = brepOf(part, 'target'), names = new Set(body.faces.map(f => f.name ?? ''));
    for (const n of open) if (!names.has(n)) fail('SELECTION', `no face named ${n} to open; faces: ${[...names].slice(0, 12).join(', ')}`);
    try { return { kind: 'brep', brep: generalShell(body, t, new Set(open), at) }; }
    catch (cause) {
      // A closed body of freeform faces meeting smoothly (a SubD body): its cavity, its faces offset (R11.2a, D110); kept
      // faces trimmed planes and cylinders too, offset exactly, where the opening leaves no sharp edge (R11.2c-1, D112).
      if (cause instanceof BrepError && OFFSET_ROUTE.test(cause.message) && smoothOffsetBody(body, new Set(open))) {
        // Opened faces (R11.2b, D111): the kept faces, their offset and the wall's end at the opening's edges.
        try { return { kind: 'brep', brep: open.length ? offsetShell(body, t, new Set(open), at, at).shell : withCavities(body, offsetCavity(body, t, `${at}_in`, at).cavity, { family: 'shell', id: at }) }; }
        catch (inner) { const m = inner instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(inner.message) : null; if (m) fail('CAPABILITY', m[1]); throw inner; }
      }
      // Sharp edges between such faces' smooth regions and the planes that bound the body: bands and regions' slabs (R11.2c-2, D113).
      if (cause instanceof BrepError && OFFSET_ROUTE.test(cause.message)) {
        try { return { kind: 'brep', brep: regionShell(body, t, new Set(open), at) }; }
        catch (inner) { const m = inner instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(inner.message) : null; if (m) fail('CAPABILITY', m[1]); throw inner; }
      }
      const m = cause instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(cause.message) : null;
      if (m) fail('CAPABILITY', m[1]);
      if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', cause.message.replace(/^B-rep: (analytic Boolean: )?/, ''));
      throw cause;
    }
  }
  // A finished body: its hollow is the base's hollow with the same finishes, offset by the wall — a
  // rolling ball of radius r less the wall rounds the offset of a convex edge rounded r (sharp when r
  // is not more than the wall); an equal chamfer d on a corner of angle α becomes d + t(1 − 1/sin(α/2))/cos(α/2).
  const { base, finishes } = part.history!;
  if (base.slabs.length !== 1) fail('CAPABILITY', 'shell after finishing edges works on bodies extruded from one section yet');
  const h = hollowOf(base, t, open, at, fail);
  // Walls split in parts (a full circle's halves) keep their `#k` inside.
  const face = (n: string) => { const w = n.replace(/#\d+$/, ''); return h.sides.has(w) ? `${at}.in.${n}` : h.tops.has(n) ? `${at}.ceiling` : h.bottoms.has(n) ? `${at}.floor` : null; };
  const outer = brepOf(part, 'target'), faces = new Map(outer.faces.map(f => [f.name, f]));
  let hollow: Part = { solid: { kind: 'upright', solid: h.hollow } };
  for (const fin of finishes) {
    if (fin.radii) { hollow = varyingHollow(hollow, fin, base, face, t, open, at, fail); continue; }
    // Edges by their offset size (a chamfer's depends on each corner's angle).
    const jobs = new Map<number, string[]>();
    for (const name of fin.edges) {
      let size = fin.size - t;
      const parts = name.split('|');
      if (parts.some(n => open.includes(n))) fail('CAPABILITY', `${name} borders an open face: finish the opening's edges after the shell`);
      const mapped = parts.map(face);
      if (mapped.some(n => n === null)) fail('CAPABILITY', `${fin.id} finishes ${name}, an edge made by an earlier finish: shell before that finish`);
      if (fin.kind === 'chamfer') {
        // The corner's angle from the faces' normals there (a cap meets a wall square).
        const g = parts.map(n => { try { return faces.has(n) ? faceGeometry(faces.get(n)!) : { kind: 'other' as const }; } catch { return { kind: 'other' as const }; } });
        const alpha = g[0].kind === 'plane' && g[1].kind === 'plane' ? Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(g[0].n, g[1].n)))) : Math.PI / 2;
        size = fin.size + t * (1 - 1 / Math.sin(alpha / 2)) / Math.cos(alpha / 2);
      }
      if (!(size > 1e-9)) continue;
      const key = Math.round(size * 1e9) / 1e9;
      jobs.set(key, [...(jobs.get(key) ?? []), (mapped as string[]).sort().join('|')]);
    }
    [...jobs].forEach(([size, edges], k) => {
      const known = new Set(brepOf(hollow, `${at}_hollow`).edges.map(e => e.name)), missing = edges.find(e => !known.has(e));
      if (missing) fail('CAPABILITY', `the wall rounds the inside corner of ${missing} already: shell inside corners finished by ${fin.id} is not supported yet`);
      hollow = { solid: finishEdges(hollow, edges, size, fin.kind, `${at}_in_${fin.id}${k ? `_${k}` : ''}`, fail) };
    });
  }
  // (Ids are identifiers; the hollow's finished faces are named `${at}.in.${finish}.…`.)
  const inner = hollow.solid.kind === 'brep' ? { kind: 'brep' as const, brep: transformBrep(hollow.solid.brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0] }, n => n.split(`${at}_in_`).join(`${at}.in.`)) } : hollow.solid;
  return boolean(part.solid, inner, 'difference', at);
}

/**
 * The hollow rounded after a variable-radius fillet (D108): the ball's spine is the outer fillet's, its radius the outer
 * one less the wall — exact for a straight chain with its radius linear along it (two points): the radius at the hollow
 * chain's ends from the outer law. Sharp where the wall reaches the radius all along; refused where it does partway, and
 * for a curved chain or more points (their law along the hollow's chain is not the outer one's).
 */
function varyingHollow(hollow: Part, fin: Finish, base: PrismaticSolid, face: (n: string) => string | null, t: number, open: readonly string[], at: string, fail: Tools['fail']): Part {
  const radii = fin.radii!, outer = brepOf({ solid: { kind: 'upright', solid: base } }, 'base');
  const lines = fin.edges.map(name => {
    if (name.split('|').some(n => open.includes(n))) fail('CAPABILITY', `${name} borders an open face: finish the opening's edges after the shell`);
    const e = outer.edges.find(x => x.name === name || x.name === name.split('|').reverse().join('|'));
    if (!e) return fail('CAPABILITY', `${fin.id} rounds ${name}, an edge made by an earlier finish: shell before that finish`);
    if (!(e.curve.degree === 1 && e.curve.controlPoints.length === 2)) return fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id} varies its radius along a curved edge (${name}): its hollow's radius along the chain is not the outer one's less the wall; not supported yet`);
    return e.curve.controlPoints as Point[];
  });
  if (radii.length !== 2) fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id} gives ${radii.length} radii: shell after a variable radius takes two (linear along a straight chain) yet`);
  const p0 = radii[0].at, u = unit(sub(lines[0][1], lines[0][0]));
  for (const [a, b] of lines) if (len(cross(sub(b, a), u)) > 1e-9 * Math.max(1, len(b)) || len(cross(sub(a, p0), u)) > 1e-6 * Math.max(1, len(a))) fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id}'s edges do not lie on one line: shell after a variable radius takes a straight chain yet`);
  const s1 = dot(sub(radii[1].at, p0), u), r = (p: Point) => radii[0].radius + (radii[1].radius - radii[0].radius) * dot(sub(p, p0), u) / s1;
  const names = fin.edges.map(name => { const m = name.split('|').map(face); if (m.some(n => n === null)) fail('CAPABILITY', `${fin.id} rounds ${name}, an edge made by an earlier finish: shell before that finish`); return (m as string[]).sort().join('|'); });
  const inner = brepOf(hollow, `${at}_hollow`), ends = names.flatMap(n => { const e = inner.edges.find(x => x.name === n); if (!e) return fail('CAPABILITY', `the wall rounds the inside corner of ${n} already: shell inside corners finished by ${fin.id} is not supported yet`); return e.curve.controlPoints as Point[]; });
  const along = ends.map(p => dot(sub(p, p0), u)), lo = ends[along.indexOf(Math.min(...along))], hi = ends[along.indexOf(Math.max(...along))];
  const rLo = r(lo) - t, rHi = r(hi) - t;
  if (!(rLo > 1e-9) && !(rHi > 1e-9)) return hollow;
  if (!(rLo > 1e-9) || !(rHi > 1e-9)) fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id}'s radius falls to the wall (${t} mm) partway along: the hollow's round would run out there; not supported yet`);
  return { solid: finishEdges(hollow, names, Math.max(rLo, rHi), 'fillet', `${at}_in_${fin.id}`, fail, undefined, [{ at: lo, radius: rLo }, { at: hi, radius: rHi }]) };
}

/** A body less hollows inside it: masses and moments subtracted (inertia via the origin). */
function massLess(outer: SolidMassProperties, inner: readonly SolidMassProperties[]): SolidMassProperties {
  const about = (p: SolidMassProperties) => { const c = p.centroidMM.map(x => x * 1e-3), cc = c[0] ** 2 + c[1] ** 2 + c[2] ** 2; return p.inertiaCentroidKgM2.map((row, i) => row.map((v, j) => v + p.massKG * ((i === j ? cc : 0) - c[i] * c[j]))); };
  const m = outer.massKG - inner.reduce((a, p) => a + p.massKG, 0), V = outer.volumeMM3 - inner.reduce((a, p) => a + p.volumeMM3, 0);
  const c = [0, 1, 2].map(i => (outer.massKG * outer.centroidMM[i] - inner.reduce((a, p) => a + p.massKG * p.centroidMM[i], 0)) / m) as Point;
  const T = about(outer); for (const p of inner) about(p).forEach((row, i) => row.forEach((v, j) => { T[i][j] -= v; }));
  const cm = c.map(x => x * 1e-3), cc = cm[0] ** 2 + cm[1] ** 2 + cm[2] ** 2;
  const I = T.map((row, i) => row.map((v, j) => v - m * ((i === j ? cc : 0) - cm[i] * cm[j]))) as [[number, number, number], [number, number, number], [number, number, number]];
  return { volumeMM3: V, massKG: m, centroidMM: c, inertiaCentroidKgM2: I, method: outer.method };
}
/** A ring of section segments as profile segments (each from its start). */
const profileOfRing = (ring: readonly CurveSegment2[]): ProfileSegmentInput[] => ring.map(g => {
  if (g.kind === 'line') return { kind: 'line', start: [g.a[0], g.a[1]] };
  if (g.kind === 'arc') return { kind: 'arc', start: [g.c[0] + g.r * Math.cos(g.t0), g.c[1] + g.r * Math.sin(g.t0)], center: [g.c[0], g.c[1]], direction: g.sweep > 0 ? 'ccw' : 'cw' };
  throw new CadPartError('CAPABILITY', 'shell', 'a section with curves other than lines and arcs');
});
/** A profile's segments as a tagged section ring (`side<i>`, as the body's faces are named), and the loop. */
type LineArc = Extract<CurveSegment2, { kind: 'line' } | { kind: 'arc' }>;
function sectionRing(profile: readonly ProfileSegmentInput[], sideTags?: readonly string[]): LineArc[] {
  const loop0 = buildProfileLoop(profile, { maximumSegments: 1024 }), built = loop0.segments;
  // (Tagged: `side[t]`, by the authored segment, as revolve names them; a circle's halves both its one tag.)
  const tagOf = (i: number) => sideTags ? `side[${sideTags[built.length > 1 ? (loop0.reversed ? built.length - 1 - i : i) : 0]}]` : `side${i}`;
  // A single circle is two halves (side0, side1), as the revolved body has it.
  const loop = built.length > 1 ? built : (() => { const a = built[0] as Extract<typeof built[number], { kind: 'arc' }>; return [{ ...a, sweep: a.sweep / 2 }, { ...a, startAngle: a.startAngle + a.sweep / 2, sweep: a.sweep / 2 }]; })();
  return loop.map((g, i): LineArc => g.kind === 'line' ? { kind: 'line', a: g.start, b: g.end, tag: tagOf(i) } : { kind: 'arc', c: g.center, r: g.radiusMM, t0: g.startAngle, sweep: g.sweep, tag: tagOf(i) });
}
const ringsOfRegions = (rs: readonly CurveRegion2[]) => rs.flatMap(r => [r.outer, ...r.holes]);
/** Each body of a B-rep on its own: its shells, faces, loops, coedges, edges and vertices. */
function brepBodies(b: Brep): Brep[] {
  return b.bodies.map(body => {
    const shells = new Set(body.shells), faces = b.faces.filter(x => shells.has(x.shell)), faceIds = new Set(faces.map(x => x.id));
    const loops = b.loops.filter(l => faceIds.has(l.face)), loopIds = new Set(loops.map(l => l.id));
    const coedges = b.coedges.filter(c => loopIds.has(c.loop)), edgeIds = new Set(coedges.map(c => c.edge));
    const edges = b.edges.filter(e => edgeIds.has(e.id)), vertexIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells: b.shells.filter(x => shells.has(x.id)), faces, loops, coedges, edges, vertices: b.vertices.filter(v => vertexIds.has(v.id)) };
  });
}
const renamed = (b: Brep, from: string, to: string) => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0] }, n => n.split(from).join(to));

/**
 * A body turned a full turn, hollowed: every point's nearest wall lies in its own meridian plane, so
 * the hollow is the meridian section (with its mirror across the axis) eroded, turned again — exact,
 * its mass the body's less the hollow's part inside it (also turned: closed form).
 */
function shellRevolved(part: Part, input: RevolveInput, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  if (input.angleDegrees !== 360) fail('CAPABILITY', 'shell works on bodies turned a full turn yet (this one stops at its start and end faces)');
  const id = input.id!, ring = sectionRing(input.profile, input.sideTags), tags = new Set(ring.map(g => g.tag!)), tol = curveTolerance([ring]);
  const openTags = new Set(open.map(n => { const tag = n.startsWith(id + '.') ? n.slice(id.length + 1).replace(/#\d+$/, '') : ''; if (!tags.has(tag)) fail('SELECTION', `no face named ${n} to open; faces: ${[...tags].map(x => `${id}.${x}`).slice(0, 12).join(', ')}`); return tag; }));
  // The axis, its side the profile is on, and the mirror across it.
  const [dx, dy] = input.axis.direction, dl = Math.hypot(dx, dy), d: XY = [dx / dl, dy / dl], A = input.axis.origin, nrm: XY = [-d[1], d[0]];
  const side = Math.sign(ring.reduce((acc, g) => { const p = g.kind === 'line' ? g.a : [g.c[0] + g.r * Math.cos(g.t0 + g.sweep / 2), g.c[1] + g.r * Math.sin(g.t0 + g.sweep / 2)]; return acc + (p[0] - A[0]) * nrm[0] + (p[1] - A[1]) * nrm[1]; }, 0)) || 1;
  const refl = (p: readonly number[]): XY => { const v = [p[0] - A[0], p[1] - A[1]], u = v[0] * d[0] + v[1] * d[1]; return [A[0] + 2 * u * d[0] - v[0], A[1] + 2 * u * d[1] - v[1]]; };
  const phi = Math.atan2(d[1], d[0]);
  const mirror: LineArc[] = [...ring].reverse().map((g): LineArc => g.kind === 'line' ? { kind: 'line', a: refl(g.b), b: refl(g.a), tag: g.tag } : { kind: 'arc', c: refl(g.c), r: g.r, t0: 2 * phi - g.t0 - g.sweep, sweep: g.sweep, tag: g.tag });
  const whole = booleanCurveRegions([ring], [mirror], 'union', tol);
  let inner: CurveRegion2[] = [];
  try { inner = erodeSection(whole, t, tag => !!tag && openTags.has(tag), () => 'wall', tol); }
  catch (cause) { if (cause instanceof Error && /only straight walls/.test(cause.message)) fail('CAPABILITY', cause.message); throw cause; }
  // The profile's half of it.
  const L = 4 * Math.max(1, ...ring.flatMap(g => g.kind === 'line' ? [...g.a, ...g.b].map(Math.abs) : [Math.abs(g.c[0]) + g.r, Math.abs(g.c[1]) + g.r]), Math.abs(A[0]), Math.abs(A[1]));
  const at2 = (u: number, w: number): XY => [A[0] + u * d[0] + w * side * nrm[0], A[1] + u * d[1] + w * side * nrm[1]];
  const corners = [at2(-L, 0), at2(L, 0), at2(L, L), at2(-L, L)], halfPlane: CurveSegment2[] = corners.map((p, k) => ({ kind: 'line', a: p, b: corners[(k + 1) % 4] }));
  const area = (rs: CurveRegion2[]) => rs.reduce((a, r) => a + regionMoments(r)[0], 0);
  const orient = (ring: readonly CurveSegment2[]): CurveSegment2[] => area([{ outer: ring, holes: [] }]) < 0 ? [...ring].reverse().map(segReverse) : [...ring];
  const half = booleanCurveRegions(ringsOfRegions(inner), [orient(halfPlane)], 'intersection', tol);
  if (!half.length || area(half) <= tol * tol) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this body`);
  if (half.some(r => r.holes.length)) fail('CAPABILITY', 'shell of a revolved body whose hollow section has islands is not supported yet');
  const pieces = half.map((r, k) => ({ id: `${at}_in${k}`, profile: profileOfRing(r.outer), axis: input.axis, angleDegrees: 360 }));
  const hollow = mergeBreps(pieces.map(pc => renamed(revolveProfile(pc), `${at}_in`, `${at}.in`)), { family: 'revolve', id: `${at}_hollow` });
  // The hollow inside the body: the eroded half within the profile (an opening runs out past it).
  const inside = booleanCurveRegions(ringsOfRegions(half), [orient(ring)], 'intersection', tol).map((r, k) => ({ id: `${at}_m${k}`, profile: profileOfRing(r.outer), axis: input.axis, angleDegrees: 360 }));
  // Nothing opened: the hollow lies inside, apart from the walls — a cavity, no Boolean needed.
  const solid: Solid = openTags.size ? boolean(part.solid, { kind: 'brep', brep: hollow }, 'difference', at) : { kind: 'brep', brep: withCavities(brepOf(part, 'target'), hollow, { family: 'shell', id: at }) };
  return { solid, mass: d => massLess(revolveMassProperties(input, d), inside.map(pc => revolveMassProperties(pc, d))) };
}

/**
 * A swept body hollowed: its walls' normals lie in the path's cross-sections, so the hollow is the
 * section eroded, swept along the same path (through the same point) — run out past an open end,
 * started a wall's thickness into a closed one (on a straight run); exact, mass included.
 */
function shellSwept(part: Part, swept: NonNullable<Part['swept']>, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  const steps = [...swept.steps], last = steps.length - 1, brep = brepOf(part, 'target');
  const names = new Set(brep.faces.map(f => f.name ?? '')), startName = [`${at}`].length ? [...names].find(n => /\.s0\.(bottom|start)$/.test(n)) : undefined, endName = [...names].find(n => new RegExp(`\\.s${last}\\.(top|end)$`).test(n));
  for (const n of open) if (n !== startName && n !== endName) fail(names.has(n) ? 'CAPABILITY' : 'SELECTION', names.has(n) ? `only a swept body's end faces can be opened yet (${startName}, ${endName})` : `no face named ${n} to open; faces: ${[startName, endName].join(', ')}`);
  const openStart = !!startName && open.includes(startName), openEnd = !!endName && open.includes(endName);
  const ring = sectionRing(swept.profile, swept.sideTags), tol = curveTolerance([ring]), centre = buildProfileLoop(swept.profile, { maximumSegments: 1024 }).centroidMM;
  const inner = erodeSection([{ outer: ring, holes: [] }], t, () => false, () => 'wall', tol);
  if (!inner.length) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this section`);
  if (inner.length > 1 || inner[0].holes.length) fail('CAPABILITY', 'shell of a swept body whose hollow section falls apart is not supported yet');
  const profile = profileOfRing(inner[0].outer);
  // Its ends: a closed end on a straight run starts the hollow a wall into it.
  const trim = (k: number) => { const st = steps[k]; if (st.kind !== 'straight' || !(st.length > t)) fail('CAPABILITY', 'a closed end of a swept body must be a straight run longer than the wall yet (open it, or start with a run)'); return st.length - t; };
  const inside = steps.map(s => ({ ...s }));
  let lift = 0;
  if (!openStart) { inside[0] = { kind: 'straight', length: trim(0) }; lift = t; }
  if (!openEnd) { const k = last; const base = inside[k] as SweepStep; if (k === 0 && !openStart) { if (!(base.kind === 'straight' && base.length > t)) fail('CAPABILITY', 'the run is too short for both closed ends'); inside[0] = { kind: 'straight', length: (base as { length: number }).length - t }; } else inside[k] = { kind: 'straight', length: trim(k) }; }
  const run = 1 + t, path: SweepStep[] = [...(openStart ? [{ kind: 'straight' as const, length: run }] : []), ...inside, ...(openEnd ? [{ kind: 'straight' as const, length: run }] : [])];
  const shift = openStart ? -run : lift;
  const made = sweepBrep(profile, path, `${at}_in`, fail, centre), hollow = transformBrep(renamed(made.brep, `${at}_in`, `${at}.in`), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, shift] });
  const within = sweepBrep(profile, inside, `${at}_m`, fail, centre);
  const solid: Solid = openStart || openEnd ? boolean(part.solid, { kind: 'brep', brep: hollow }, 'difference', at) : { kind: 'brep', brep: withCavities(brep, hollow, { family: 'shell', id: at }) };
  return { solid, mass: d => { const m = within.mass(d); return massLess(part.mass!(d), [movedMass(m, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, lift])]); } };
}

/**
 * The hollow of an upright body (one section, or sections stacked): a point is hollow when it is at
 * least the wall from every wall at its height and at the heights within the wall above and below it
 * — the section at z is the intersection of the sections over [z − t, z + t], eroded (exact for lines
 * and arcs); offset walls and ledges meet sharply, as offset faces do. It runs on through open faces.
 */
function hollowOf(solid: PrismaticSolid, t: number, open: string[], at: string, fail: Tools['fail']): { hollow: PrismaticSolid; sides: Set<string>; tops: Set<string>; bottoms: Set<string> } {
  const slabs = [...solid.slabs].sort((a, b) => a.z0 - b.z0), rings = slabs.flatMap(s => s.regions.flatMap(r => [r.outer, ...r.holes])), tol = curveTolerance(rings);
  for (let k = 1; k < slabs.length; k++) if (slabs[k].z0 > slabs[k - 1].z1 + tol) fail('CAPABILITY', 'shell works on one body at a time (this one has pieces apart along its height)');
  const zmin = slabs[0].z0, zmax = slabs[slabs.length - 1].z1;
  const sides = new Set(rings.flatMap(r => r.map(g => g.tag).filter((x): x is string => !!x)));
  const capAt = (z: number) => (solid.caps ?? []).filter(c => Math.abs(c.z - z) <= tol).map(c => c.tag);
  const tops = new Set(capAt(zmax)), bottoms = new Set(capAt(zmin)), ledges = new Set((solid.caps ?? []).map(c => c.tag).filter(x => !tops.has(x) && !bottoms.has(x)));
  for (const name of open) {
    if (ledges.has(name)) fail('CAPABILITY', `${name} is a step between sections: only the top, the bottom and sides can be opened yet`);
    if (!sides.has(name) && !tops.has(name) && !bottoms.has(name)) fail('SELECTION', `no face named ${name} to open; faces: ${[...tops, ...bottoms, ...sides].slice(0, 12).join(', ')}`);
  }
  const openTop = open.some(n => tops.has(n)), openBottom = open.some(n => bottoms.has(n)), openSides = new Set(open.filter(n => sides.has(n)));
  const lo = openBottom ? zmin - 1 : zmin + t, hi = openTop ? zmax + 1 : zmax - t;
  if (!(hi > lo + tol)) fail('PARAMETER', `a wall of ${t} mm leaves no hollow between the top and the bottom`);
  // Heights where the window [z − t, z + t] takes in another section.
  const cuts = [...new Set([lo, hi, ...slabs.slice(1).flatMap(s => [s.z0 - t, s.z0 + t])].filter(z => z >= lo - tol && z <= hi + tol))].sort((a, b) => a - b);
  const pieces: { z0: number; z1: number; regions: CurveRegion2[] }[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const z0 = cuts[k], z1 = cuts[k + 1]; if (z1 - z0 <= tol) continue;
    const m = (z0 + z1) / 2, inWindow = slabs.filter(s => s.z0 < m + t - tol && s.z1 > m - t + tol);
    if (!inWindow.length) continue;
    let section: CurveRegion2[] = inWindow[0].regions as CurveRegion2[];
    for (const s of inWindow.slice(1)) section = booleanCurveRegions(section.flatMap(r => [r.outer, ...r.holes]), s.regions.flatMap(r => [r.outer, ...r.holes]), 'intersection', tol);
    let inner: CurveRegion2[] = [];
    try { inner = section.length ? erodeSection(section, t, tag => !!tag && openSides.has(tag), tag => `${at}.in.${tag ?? 'wall'}`, tol) : []; }
    catch (cause) { if (cause instanceof Error && /only straight walls/.test(cause.message)) fail('CAPABILITY', cause.message); throw cause; }
    if (inner.length) pieces.push({ z0, z1, regions: inner });
  }
  if (!pieces.length) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this body`);
  let hollow = prismaticExtrude(pieces[0].regions.flatMap(r => [r.outer, ...r.holes]), pieces[0].z0, pieces[0].z1);
  for (const p of pieces.slice(1)) hollow = booleanPrismatic(hollow, prismaticExtrude(p.regions.flatMap(r => [r.outer, ...r.holes]), p.z0, p.z1), 'union');
  // Its floor and ceiling, and the steps between (the offset ledges), are named after the shell.
  const levels = [...new Set(hollow.slabs.flatMap(s => [s.z0, s.z1]))].sort((a, b) => a - b), all = pieces.flatMap(p => p.regions);
  const caps = levels.map((z, k) => ({ z, regions: all, tag: k === 0 ? `${at}.floor` : k === levels.length - 1 ? `${at}.ceiling` : `${at}.step${k}` }));
  return { hollow: { ...hollow, caps }, sides, tops, bottoms };
}

// ---- chamfers and fillets ------------------------------------------------------------------------------
function finishEdges(part: Part, names: string[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail'], reports?: FilletReport[], radii?: readonly { at: Point; radius: number }[], shape?: { kind: 'conic'; rho: number } | { kind: 'g2'; tension: number }): Solid {
  // Vertical corners of an upright body keep it upright (its section is finished exactly); straight
  // chamfers elsewhere cut a wedge; every other edge (sloping or curved, on any body) gets a rolling-ball
  // tool (finishBrepEdges).
  const brep = brepOf(part, 'target'), byName = new Map(brep.edges.map(e => [e.name, e]));
  // (F0: a mesh body's region edges cannot be rounded yet; its names would not survive the planar path.)
  if (brep.faces.some(isFacetFace)) fail('CAPABILITY', `${kind} on mesh faces is not supported yet (general fillet and chamfer arrive with R10)`);
  const vertical: { x: number; y: number; z0: number; z1: number; name: string }[] = [], wedges: Brep['edges'][number][] = [], general: string[] = [];
  for (const name of names) {
    const e = byName.get(name);
    if (!e) fail('SELECTION', `no edge named ${name}; edges: ${brep.edges.slice(0, 12).map(x => x.name).join(', ')}${brep.edges.length > 12 ? ', …' : ''}`);
    const p = e!.curve.controlPoints, a = p[0], b = p[p.length - 1], straight = e!.curve.degree === 1 && p.length === 2;
    const tol = 1e-9 * Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
    // (A variable radius: every edge the rolling ball's, D100.)
    if (radii || shape) { general.push(name); continue; }
    if (straight && part.solid.kind === 'upright' && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && uprightCorner(part.solid.solid, a[0], a[1], tol)) vertical.push({ x: a[0], y: a[1], z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]), name: name });
    else if (straight && kind === 'chamfer') wedges.push(e!);
    else general.push(name);
  }
  // A vertical edge meeting another finished edge at a vertex goes with it (their corner is one blend).
  if (general.length || wedges.length) {
    const ends = [...general.map(n => byName.get(n)!), ...wedges].flatMap(e => [e.curve.controlPoints[0], e.curve.controlPoints[e.curve.controlPoints.length - 1]]);
    for (let i = vertical.length - 1; i >= 0; i--) {
      const c = vertical[i], tol = 1e-9 * Math.max(1, Math.abs(c.x), Math.abs(c.y), Math.abs(c.z0), Math.abs(c.z1));
      if (ends.some(p => Math.abs(p[0] - c.x) <= tol && Math.abs(p[1] - c.y) <= tol && (Math.abs(p[2] - c.z0) <= tol || Math.abs(p[2] - c.z1) <= tol))) { general.push(c.name); vertical.splice(i, 1); }
    }
  }
  let solid = part.solid;
  if (vertical.length) solid = { kind: 'upright', solid: cornerFinish((solid as Extract<Solid, { kind: 'upright' }>).solid, vertical, size, kind, at, fail) };
  for (const e of wedges) solid = wedgeChamfer(solid, brep, e, size, at, fail);
  if (general.length) {
    const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
    try { solid = { kind: 'brep', brep: finishBrepEdges(body, general, size, kind, at, { reports, ...(radii ? { radii } : {}), ...(shape ? { shape } : {}) }) }; }
    catch (cause) {
      const m = cause instanceof BrepError ? /^B-rep: (SELECTION|CAPABILITY|PARAMETER): (.*)$/s.exec(cause.message) : null;
      if (m) fail(m[1] as CadPartErrorCode, m[2]);
      if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', cause.message.replace(/^B-rep: analytic Boolean: /, ''));
      throw cause;
    }
  }
  return solid;
}
/** Whether (x, y) is a corner between two straight walls in some slab of an upright body. */
function uprightCorner(solid: PrismaticSolid, x: number, y: number, tol: number): boolean {
  return solid.slabs.some(slab => slab.regions.some(r => [r.outer, ...r.holes].some(ring => ring.some((s, i) => {
    const n = ring[(i + 1) % ring.length], p = segEnd(s);
    return Math.hypot(p[0] - x, p[1] - y) <= Math.max(tol, 1e-9) && s.kind === 'line' && n.kind === 'line';
  }))));
}

/** Chamfer or round the ring corners at the selected vertical edges, in every slab the edge spans. */
function cornerFinish(solid: PrismaticSolid, corners: { x: number; y: number; z0: number; z1: number; name: string }[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail']): PrismaticSolid {
  const tol = curveTolerance(solid.slabs.flatMap(s => s.regions.flatMap(r => [r.outer, ...r.holes])));
  const done = new Set<string>();
  const slabs = solid.slabs.map(slab => {
    const here = corners.filter(c => c.z0 <= slab.z0 + tol && c.z1 >= slab.z1 - tol);
    if (!here.length) return slab;
    const rings = slab.regions.flatMap(r => [r.outer, ...r.holes]).map(ring => {
      let out = [...ring];
      for (const c of here) {
        let i = out.findIndex(s => Math.hypot(segEnd(s)[0] - c.x, segEnd(s)[1] - c.y) <= tol);
        if (i < 0) continue;
        // Rotate so the corner's two segments are consecutive without wrapping.
        if (i === out.length - 1) { out = [out[i], ...out.slice(0, i)]; i = 0; }
        const s1 = out[i], s2 = out[(i + 1) % out.length];
        if (s1.kind !== 'line' || s2.kind !== 'line') fail('CAPABILITY', `edge ${c.name}: only corners between two straight walls can be finished yet`);
        const l1 = s1 as Extract<CurveSegment2, { kind: 'line' }>, l2 = s2 as Extract<CurveSegment2, { kind: 'line' }>;
        const L1 = Math.hypot(l1.b[0] - l1.a[0], l1.b[1] - l1.a[1]), L2 = Math.hypot(l2.b[0] - l2.a[0], l2.b[1] - l2.a[1]);
        const u: XY = [(l1.b[0] - l1.a[0]) / L1, (l1.b[1] - l1.a[1]) / L1], v: XY = [(l2.b[0] - l2.a[0]) / L2, (l2.b[1] - l2.a[1]) / L2];
        const cross = u[0] * v[1] - u[1] * v[0], dot = u[0] * v[0] + u[1] * v[1];
        if (Math.abs(cross) < 1e-9) fail('SELECTION', `edge ${c.name} joins two walls in line; there is no corner to finish`);
        const turn = Math.atan2(cross, dot), back = kind === 'chamfer' ? size : size * Math.tan(Math.abs(turn) / 2);
        if (back >= L1 - tol || back >= L2 - tol) fail('PARAMETER', `edge ${c.name}: ${kind} ${size} mm is too large for walls of ${+L1.toFixed(6)} and ${+L2.toFixed(6)} mm`);
        const p = l1.b, A: XY = [p[0] - u[0] * back, p[1] - u[1] * back], B: XY = [p[0] + v[0] * back, p[1] + v[1] * back];
        let corner: CurveSegment2;
        if (kind === 'chamfer') corner = { kind: 'line', a: A, b: B, tag: `${at}.face` };
        else {
          const n: XY = turn > 0 ? [-u[1], u[0]] : [u[1], -u[0]], centre: XY = [A[0] + n[0] * size, A[1] + n[1] * size];
          corner = { kind: 'arc', c: centre, r: size, t0: Math.atan2(A[1] - centre[1], A[0] - centre[0]), sweep: turn, tag: `${at}.face` };
        }
        out.splice(i, 2, { ...l1, b: A }, corner, { ...l2, a: B });
        done.add(c.name);
      }
      return out;
    });
    return { ...slab, regions: booleanCurveRegions(rings, [], 'union', tol) };
  });
  for (const c of corners) if (!done.has(c.name)) fail('SELECTION', `edge ${c.name} is not a corner of a wall section`);
  return { ...solid, slabs };
}

/** A straight edge between two planar faces: cut away (convex) or fill (concave) a triangular prism. */
function wedgeChamfer(solid: Solid, source: Brep, edge: Brep['edges'][number], d: number, at: string, fail: Tools['fail']): Solid {
  const uses = source.coedges.filter(c => c.edge === edge.id);
  if (uses.length !== 2) fail('SELECTION', `edge ${edge.name} does not join exactly two faces`);
  const faceOf = (loopId: string) => source.faces.find(f => f.loops.includes(loopId))!;
  const P = edge.curve.controlPoints[0], Q = edge.curve.controlPoints[1], e = unit(sub(Q, P));
  const sides = uses.map(c => {
    const f = faceOf(c.loop), s = f.surface;
    if (s.kind !== 'surface' || !(s.degreeU === 1 && s.degreeV === 1)) fail('CAPABILITY', `edge ${edge.name}: chamfers along horizontal edges need planar faces`);
    const [[p00, p01], [p10]] = s.controlPoints as Point[][], n0 = cross(sub(p10, p00), sub(p01, p00)), n = unit(f.sense === 'forward' ? n0 : [-n0[0], -n0[1], -n0[2]]);
    const dir: Point = c.sense === 'forward' ? e : [-e[0], -e[1], -e[2]];
    return { n, w: unit(cross(n, dir)) }; // w: into the face, perpendicular to the edge
  });
  const [s1, s2] = sides, convex = dot(s2.w, s1.n) < 0;
  // The chamfer must fit on both faces: d at most each face's reach across the edge — cutting, or filling (where
  // every boundary of the face bounds it: a round already made beside a concave edge too, D97).
  const walls = uses.map((c, k) => faceReach(source, faceOf(c.loop).id, edge, sides[k].w, convex)), tol = 1e-6 * Math.max(1, ...P.map(Math.abs), ...Q.map(Math.abs));
  if (walls.some(w => d > w + tol)) fail('PARAMETER', `[RADIUS_EXCEEDS_FACE] edge ${edge.name}: chamfer ${d} mm is too large for walls of ${+walls[0].toFixed(6)} and ${+walls[1].toFixed(6)} mm`);
  const corner = (X: Point) => {
    const A1 = add(X, scale(s1.w, d)), A2 = add(X, scale(s2.w, d)), M = scale(add(A1, A2), 0.5);
    // Grown about the chamfer line so no wedge face lies on a face of the body.
    return [sub(scale(A1, 2), A2), sub(scale(A2, 2), A1), sub(scale(X, 2), M)];
  };
  // The wedge ends where the edge's end face is — oblique too: its corners carried along the edge onto that face's
  // plane. A cutting one runs past an end where the body ends (the Boolean trims it) but not into a wall there; a filling
  // one stops at either (it stopped square before, adding past an oblique end, and a cutting one notched a wall, D98).
  const planes = [0, 1].map(k => endPlaneOf(source, edge, k as 0 | 1)), away = (k: number) => k ? e : scale(e, -1);
  const ends = planes.map((pl, k) => pl && !(convex && dot(pl.n, away(k)) > 0) ? pl : null), past = planes.map((pl, k) => convex && !ends[k] ? d : 0);
  const onto = (T: Point[], pl: { o: Point; n: Point } | null) => pl ? T.map(X => add(X, scale(e, dot(sub(pl.o, X), pl.n) / dot(e, pl.n)))) : T;
  const T0 = onto(corner(sub(P, scale(e, past[0]))), ends[0]), T1 = onto(corner(add(Q, scale(e, past[1]))), ends[1]);
  const wedge = prismBrep(T0, T1, `${at}.face`);
  const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
  // (A wedge ending in an end face's plane: the analytic Boolean, which takes the coplanar cap; the polyhedral one does not, D98.)
  if (planarBrep(body) && !ends.some(Boolean)) return { kind: 'brep', brep: booleanPolyhedra(body, wedge, convex ? 'difference' : 'union', { id: at }) };
  try { return { kind: 'brep', brep: booleanAnalytic(body, wedge, convex ? 'difference' : 'union', { id: at }) }; }
  catch (cause) { if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', `edge ${edge.name}: the chamfer would cut a curved face at an angle (not supported yet)`); throw cause; }
}

/**
 * The plane of the faces (not the edge's own two) meeting a straight edge at its end k — one face, or several in one
 * plane (a step's two blocks' ends) — when planar and not along the edge, its normal out of the body; else null (the
 * wedge stops square there, a cutting one run past).
 */
function endPlaneOf(source: Brep, edge: Brep['edges'][number], k: 0 | 1): { o: Point; n: Point } | null {
  const v = edge.vertices[k], loopFace = new Map(source.loops.map(l => [l.id, l.face])), facesOf = (id: string) => source.coedges.filter(c => c.edge === id).map(c => loopFace.get(c.loop)!);
  const own = new Set(facesOf(edge.id)), at = [...new Set(source.edges.filter(x => x.vertices.includes(v)).flatMap(x => facesOf(x.id)).filter(f => !own.has(f)))];
  const p = edge.curve.controlPoints, e = unit(sub(p[p.length - 1], p[0])), tol = 1e-9 * Math.max(1, ...p.flat().map(Math.abs));
  let plane: { o: Point; n: Point } | null = null;
  for (const id of at) {
    const face = source.faces.find(x => x.id === id)!, s = face.surface;
    if (s.kind !== 'surface' || !(s.degreeU === 1 && s.degreeV === 1 && s.controlPoints.length === 2 && s.controlPoints[0].length === 2)) return null;
    const [[p00, p01], [p10]] = s.controlPoints as Point[][], n0 = unit(cross(sub(p10, p00), sub(p01, p00))), n = face.sense === 'forward' ? n0 : scale(n0, -1);
    if (!plane) plane = { o: p00, n };
    else if (len(sub(n, plane.n)) > 1e-9 || Math.abs(dot(sub(p00, plane.o), plane.n)) > tol) return null;
  }
  return plane && Math.abs(dot(plane.n, e)) > 1e-6 ? plane : null;
}
/** A triangular prism between triangles T0 and T1 (corresponding corners), faces pointing out. */
function prismBrep(T0: Point[], T1: Point[], name: string): Brep {
  const a = T0[0], A = T1[0];
  let [b, c] = [T0[1], T0[2]], [B, C] = [T1[1], T1[2]];
  // Orient so the T0 triangle faces away from T1.
  if (dot(cross(sub(b, a), sub(c, a)), sub(A, a)) > 0) { [b, c] = [c, b]; [B, C] = [C, B]; }
  const pts = [a, b, c, A, B, C];
  const faces = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]];
  const plane = (ids: number[]) => { const p = ids.map(i => pts[i]), n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0]))), e1 = unit(sub(p[1], p[0])), e2 = cross(n, e1);
    const uv = p.map(q => [dot(sub(q, p[0]), e1), dot(sub(q, p[0]), e2)]), u0 = Math.min(...uv.map(x => x[0])) - 1, u1 = Math.max(...uv.map(x => x[0])) + 1, v0 = Math.min(...uv.map(x => x[1])) - 1, v1 = Math.max(...uv.map(x => x[1])) + 1;
    const pt = (u: number, v: number): Point => add(p[0], add(scale(e1, u), scale(e2, v)));
    return { kind: 'surface' as const, id: 'w', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[pt(u0, v0), pt(u0, v1)], [pt(u1, v0), pt(u1, v1)]], weights: [[1, 1], [1, 1]] };
  };
  const edgeIds = new Map<string, { id: string; v: [number, number] }>();
  const use = (i: number, j: number) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; let e = edgeIds.get(k); if (!e) { e = { id: 'e' + edgeIds.size, v: i < j ? [i, j] : [j, i] }; edgeIds.set(k, e); } return { edge: e.id, sense: (e.v[0] === i ? 'forward' : 'reversed') as 'forward' | 'reversed' }; };
  const faceInputs = faces.map((ids, fi) => ({ id: 'f' + fi, name, surface: plane(ids), sense: 'forward' as const, loops: [{ kind: 'outer' as const, uses: ids.map((v, k) => use(v, ids[(k + 1) % ids.length])) }] }));
  return buildBrepLocal(pts, [...edgeIds.values()], faceInputs);
}
function buildBrepLocal(pts: Point[], edges: { id: string; v: [number, number] }[], faces: Parameters<typeof buildBrep>[0]['bodies'][number]['shells'][number]['faces']): Brep {
  return buildBrep({ source: { family: 'wedge', id: 'wedge' }, vertices: pts.map((p, i) => ({ id: 'v' + i, point: p })),
    edges: edges.map(e => ({ id: e.id, curve: lineCurve(e.id, pts[e.v[0]], pts[e.v[1]]), vertices: ['v' + e.v[0], 'v' + e.v[1]] as [string, string] })),
    bodies: [{ id: 'wedge', kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
}

// ---- outputs --------------------------------------------------------------------------------------------
function makeOutput(id: string, feature: string, part: Part): CadPartOutput {
  const brep = brepOf(part, id.replace('/', '_'));
  let validated: BrepCheckReport | undefined, area: number | undefined;
  const flats = new Map<string, FlatPattern>();
  return Object.freeze({
    id, feature, representation: representation(part.solid), brep, bodyCount: brep.bodies.length, ...(part.gear ? { gear: part.gear } : {}), ...(part.gearPlace ? { gearPlacement: part.gearPlace } : {}), ...(part.rack ? { rack: part.rack } : {}), ...(part.rackPlace ? { rackPlacement: part.rackPlace } : {}), ...(part.subd ? { subd: part.subd } : {}), ...(part.decimate ? { decimate: part.decimate } : {}), ...(part.fillet ? { fillet: part.fillet } : {}), ...(part.shell ? { shell: part.shell } : {}), ...(part.sheet ? { sheet: part.sheet } : {}),
    massProperties(density: number) {
      // (An open mesh, a sheet, encloses nothing: no mass, said so rather than worked out from an open surface.)
      if (brep.bodies.some(b => b.kind === 'sheet')) throw new CadPartError('GEOMETRY', id, 'an open mesh (a sheet) encloses no volume: it has no mass');
      return part.mass ? part.mass(density) : part.solid.kind === 'upright' ? prismaticMassProperties(part.solid.solid, density) : brepMassProperties(brep, density, { segmentsPerQuarter: 32 });
    },
    exportStl(options: { readonly segmentsPerQuarter?: number } = {}) { return stl(brep, options.segmentsPerQuarter ?? 16); },
    exportStep(options: { readonly name?: string } = {}) { return exportStep(brep, { name: options.name ?? id }); },
    validate() { return validated ??= checkBrep(brep, { strict: true }); },
    surfaceArea() { return area ??= brepSurfaceArea(brep); },
    flatPattern(options: { readonly fixedFace?: string; readonly kFactor?: number } = {}) {
      const s = part.sheet;
      if (!s) throw new CadPartError('CAPABILITY', id, 'not made as sheet metal: give its thickness and K-factor to the kernel\'s flatPattern');
      // (A K given here, else the sheet's K, else its bend table bend by bend.)
      const k = options.kFactor ?? s.kFactor, key = `${options.fixedFace ?? s.fixedFace}|${k ?? 'table'}`;
      const hit = flats.get(key); if (hit) return hit;
      try {
        const flat = flatPatternOf(brep, { thicknessMM: s.thicknessMM, ...(k !== undefined ? { kFactor: k } : { bendTable: s.bendTable! }), fixedFace: options.fixedFace ?? s.fixedFace, bendNames: s.bends.map(b => ({ name: b.name, faces: [b.inner, b.outer] })) });
        flats.set(key, flat); return flat;
      } catch (cause) {
        if (cause instanceof FlatPatternError) throw new CadPartError(cause.code === 'CUT_ACROSS_BEND' ? 'CAPABILITY' : 'GEOMETRY', id, cause.message);
        throw cause;
      }
    },
  });
}
function stl(brep: Brep, segmentsPerQuarter: number): Uint8Array {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter });
  return encodeBinaryStl(mesh.positionsMM, mesh.indices, 'barocss part (mm)');
}
