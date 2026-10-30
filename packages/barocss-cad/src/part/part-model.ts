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
import { BrepError, buildBrep, checkBrep, isFacetFace, lineCurve, mergeBreps, nurbsOf, type Brep, type BrepCheckReport, type BrepFace } from '../brep/brep-core.js';
import { brepFromPrismatic, booleanPrismatic, prismaticExtrude, prismaticFromProfile, prismaticVolume, transformPrismatic, isPrismaticSolidError, type PrismaticSolid } from '../features/prismatic-solid.js';
import { erodeSection } from '../features/section-offset.js';
import { unitNamedField } from '../document/unit-named.js';
import { booleanCurveRegions, curveTolerance, regionMoments, sampleRing, segEnd, segReverse, isCurvedArrangementError, type CurveRegion2, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { booleanPolyhedra } from '../brep/polyhedral-boolean.js';
import { booleanAnalytic, faceGeometry, splitFaceAlongCurve, splitFaceAlongIsocline, type FaceGeometry } from '../brep/analytic-boolean.js';
import { faceReach, finishBrepEdges } from '../blend/edge-finish.js';
import { polynomialFaceFillet } from '../blend/polynomial-face-fillet.js';
import { draftedExtrusion } from '../features/drafted-extrusion.js';
import { profileRelief, type ReliefSketch } from '../features/profile-relief.js';
import { cylindricalWrapFeature, type CylindricalWrapReport } from '../features/cylindrical-wrap-feature.js';
import { fillCutSnapshot, fillCutPlacements, type FillFeaturePatternRegion } from '../features/fill-cut-pattern.js';
import { curveCutOffsets, type RawNurbsPath } from '../features/curve-cut-pattern.js';
import { stepTessellatedChars } from '../io/step.js';
import { brepFromTriangles, isMeshBrepError } from '../mesh/mesh-brep.js';
import { facetBrepFromTriangles, weldVertices } from '../mesh/facet-brep.js';
import { splitFacetBrep, type FacetSplitResult } from '../mesh/facet-split.js';
import { facetBoolean, isFacetBooleanError, splitMixedBrep } from '../mesh/facet-boolean.js';
import { selfIntersections } from '../mesh/mesh-repair.js';
import { sweepSolid } from '../brep/sweep-solid.js';
import { validateCurve } from '../core/math.js';
import { type SubdSummary } from '../features/subd.js';
import { type DecimateReport } from '../mesh/mesh-decimate.js';
import type { FilletReport } from '../blend/rolling-ball.js';
import { SIDE_TAG, type SideTags } from '../document/side-names.js';
import { type SpurRackReport, type SpurRackSpec } from '../machine/gear-rack.js';
import { type SpurGearReport, type SpurGearSpec } from '../machine/gear.js';
import { type InternalGearReport, type PlacedInternalGear } from '../machine/gear-internal.js';
import { type BevelGearReport, type PlacedBevelGear } from '../machine/gear-bevel.js';
import { type WormReport, type PlacedWorm } from '../machine/gear-worm.js';
import { type GlandPlace, type GlandRanges, type GlandReport } from '../machine/oring.js';
import { type BearingReport, type BearingRow, type BearingFitClasses } from '../machine/bearing.js';
import { type KeyReport, type KeywayReport, type PinReport, type RingReport } from '../machine/shaft-parts.js';
import type { FitTable } from '../machine/fits.js';
import { type ShaftReport } from '../machine/shaft.js';
import { type DriveRow, type SprocketReport, type PulleyReport, type BeltReport, type CouplingReport } from '../machine/drive.js';
import { type SectionTable } from '../features/section-table.js';
import { type ConnectorReport, type ConnectorRow } from '../machine/connector.js';
import { type CamLaw, type CamReport } from '../machine/cam.js';
import { type HookedSpringReport, type SpringReport } from '../machine/spring.js';
import { type ThroatedWheelReport, type PlacedThroatedWheel } from '../machine/gear-worm-wheel.js';
import { revolveProfile, revolveMassProperties, type RevolveInput } from '../features/revolve.js';
import { transformBrep, quarterTurn, type BrepAffine } from '../brep/brep-transform.js';
import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain } from '../core/math.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { rayHit, triangleBvh } from '../mesh/triangle-bvh.js';
import { combineMassProperties, prismaticMassProperties, brepMassProperties, brepSurfaceArea, isSolidMassError, type MassProperties } from '../brep/solid-mass.js';
import { readNativeSIInertia, transferNativeMassBasis, unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { glueAtSharedFace, withCavities } from '../brep/brep-glue.js';
import { loftSolid, type LoftInput, type LoftSectionFrame, type LoftSectionInput } from '../features/loft.js';
import { generalShell } from '../blend/general-shell.js';
import { offsetCavity, offsetShell, smoothOffsetBody } from '../blend/offset-cavity.js';
import { regionShell } from '../blend/region-shell.js';
import { meshInnerOffset, type MeshShellReport } from '../mesh/mesh-offset.js';
import { bendAllowance, bendDeduction, flangeSection, lookupBend, outsideSetback, type BendTable, type BendTableUse, type SheetReport } from '../frame-sheet/sheet-metal.js';
import { flatPattern as sheetFlatPattern, isFlatPatternError, type FlatPattern } from '../frame-sheet/sheet-flat.js';
import { isExtrudedProfileError, buildProfileLoop, type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { type BeadReport, type EndCapReport, type GussetReport, type BeadJointRef, type BeadSharedComponent } from '../frame-sheet/frame-weldment.js';
import { type FrameAnchor, type FrameMemberReport } from '../frame-sheet/frame-section.js';
import type { Curve, FacetPatch, Point } from '../types.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { encodeBinaryStl } from '../io/stl.js';
import { gearOperation } from './part-gears.js';
import { machineOperation } from './part-machine.js';
import { revolutionOf } from '../nurbs/surfaces/surface-revolution.js';
import { threadSolid } from '../machine/thread-solid.js';
import { finishOperation } from './part-finish.js';
import { meshOperation } from './part-mesh.js';
import { shellOperation } from './part-shell.js';
import { sheetOperation } from './part-sheet.js';
import { frameOperation, planEndpointBeads, endpointContext, isEndpointBead } from './part-frame.js';
import type { GussetPlaced, MemberPlaced, EndpointBead } from './part-frame.js';
import { checkExpected, expectOf, type CadPartNameSignature } from './part-expect.js';
import { KernelError } from '../core/barocss-error.js';
import { refusalCodeOf, type CadRefusalCode } from '../core/error-codes.js';

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
  /** About an axis in the sketch plane (through `origin`, along X or Y), by angle (default 360). */
  | { readonly kind: 'revolve'; readonly sketch: string; readonly axis: { readonly origin: CadPartPoint2; readonly direction: 'x' | 'y' | readonly [number, number] }; readonly angle?: number }
  | { readonly kind: 'union' | 'difference' | 'intersect'; readonly target: string; readonly tool: string }
  /** Add a world-axis-aligned rectangular rib to one straight-sided upright solid; actual overlap and added material must both have positive volume. */
  | { readonly kind: 'rib'; readonly target: string; readonly min: CadPartPoint3; readonly max: CadPartPoint3 }
  /** A supported XY rectangle raised above or recessed below the top of one straight-sided, single-slab upright solid. Depth is positive world mm, below the body's height. */
  | { readonly kind: 'rectangular-relief'; readonly target: string; readonly min: CadPartPoint2; readonly max: CadPartPoint2; readonly depth: CadPartDim; readonly mode: 'emboss' | 'engrave' }
  /** Line-only XY components strictly inside exactly one +Z cap in `faces`. `clearance` adds to the existing linear policy (default 0); only engrave depth must remain below slab thickness. */
  | { readonly kind: 'profile-relief'; readonly target: string; readonly faces: readonly string[]; readonly sketches: readonly string[]; readonly depth: CadPartDim; readonly mode: 'emboss' | 'engrave'; readonly clearance?: number; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
  /** One rectangle in original native UV, first +Y wall quarter; height must equal the source radius. Mass is over its certified closed radial reference. */
  | { readonly kind: 'cylindrical-wrap'; readonly target: string; readonly faces: readonly string[]; readonly rectangle: { readonly u: readonly [number, number]; readonly v: readonly [number, number] }; readonly height: CadPartDim; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
  /**
   * A full round (a face fillet): each named face — planar, facing +Z, an axis-aligned rectangle — becomes a half
   * cylinder tangent to its two sides along `along` (default: each face's longer side), of radius half its width
   * across. The sides must drop at least that radius and nothing may stand above the face: the material taken is
   * checked against L·W²(4 − π)/8. The round faces are named `<id>.round<k>`.
   */
  | { readonly kind: 'full-round'; readonly target: string; readonly faces: readonly string[]; readonly along?: 'x' | 'y'; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
  /**
   * A modelled ISO metric thread (`hand` right, the default, or left; helical B-spline faces `<id>.thread#k`) cut on one whole cylindrical face
   * of the target, any axis: from the `end` ('+': the end further along the axis, its largest component positive;
   * default) over `length` (default the face). A hole is its tap drill: `diameter` (the nominal) is then required, the
   * hole filled over the length and the thread cut, one pitch past an open end, its profile `clearance` (default
   * 0.04 mm, a modelled nut's) clear of a bolt's of the same size. A shaft's thread has the face's
   * diameter: the face is cut to a core of d/2 − 0.8·pitch and the thread joined, ending `relief` (default one pitch)
   * short of an end that is not a flat free end (a shoulder, a chamfer, the face going on). Each step's volume is
   * checked, so material in the way (a thin wall, a key) refuses rather than builds.
   */
  | { readonly kind: 'face-thread'; readonly target: string; readonly face: string; readonly pitch: CadPartDim; readonly diameter?: CadPartDim; readonly length?: CadPartDim; readonly end?: '+' | '-'; readonly relief?: CadPartDim; readonly clearance?: CadPartDim; readonly hand?: 'right' | 'left' }
  /**
   * A face fillet of constant `radius` between two planar faces that need not touch (a step, a chamfer or a groove
   * between them is replaced): the round tangent to both, along their planes' meeting line, over the length both run
   * beside it. A planar face and a whole cylinder square to it (a boss, a rim, a hole's edge) take the round revolved
   * about the cylinder's axis; the plane must then hold the tangent circle and the cylinder the tangent height. A plane
   * along a cylinder's axis, or two parallel cylinders, take the round extruded along it, at every corner they make;
   * cones, spheres and tori with planes and cylinders turning about one axis take it revolved. Other pairs go to the
   * rolling ball (the edge fillet): faces that meet by every edge they share; faces apart (planes and surfaces of
   * revolution) with the corner between them restored first — anything within 3r of both on its side replaced. At an inside corner the round is joined, at an outside one cut. Each face must hold its tangent line
   * there (its edges straight); the material joined or cut is checked. The round face is `<id>.round`.
   */
  | { readonly kind: 'face-fillet'; readonly target: string; readonly faces: readonly [string, string]; readonly radius: CadPartDim }
  /**
   * A hole along `axis` (default z) through the target, or `depth` deep from its `side` (default max:
   * the top for z). `center` is in the other two coordinates in order: z → [x, y], x → [y, z], y → [x, z].
   * `face` (D148): the planar face it is drilled into, by name — the depth and the countersink measured from that face's
   * plane rather than the target's extreme on `side` (a boss's top inside a shell); its normal along ±axis gives the side.
   */
  | { readonly kind: 'hole'; readonly target: string; readonly center: CadPartPoint2; readonly radius: CadPartDim; readonly depth?: CadPartDim; readonly axis?: CadPartAxis; readonly side?: 'min' | 'max'; /** A 90° countersink: its diameter at the face (wider than the hole). */ readonly countersink?: CadPartDim; readonly face?: string }
  | { readonly kind: 'translate'; readonly target: string; readonly offset: CadPartPoint3 }
  /** About an axis through `pivot` (default the origin) by any angle; off quarter turns about X or Y the body leaves the upright family. */
  | { readonly kind: 'rotate'; readonly target: string; readonly axis: CadPartAxis; readonly angle: number; readonly pivot?: CadPartPoint3 }
  /** Mirror in a coordinate plane through the origin; `keep` also keeps the original (one body). */
  | { readonly kind: 'mirror'; readonly target: string; readonly plane: 'xy' | 'xz' | 'yz'; readonly keep?: boolean }
  | { readonly kind: 'scale'; readonly target: string; readonly factor: number; readonly pivot?: CadPartPoint3 }
  /** `count` copies (the original included) joined into one body. */
  | { readonly kind: 'linear-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly spacing: CadPartDim; readonly count: number }
  /** Repeat the tool of the active difference producer; count includes the original cut. */
  | { readonly kind: 'linear-feature-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly spacing: CadPartDim; readonly count: number }
  /** Repeat an active difference tool on two distinct global axes; both counts include the original cut. */
  | { readonly kind: 'rectangular-feature-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly spacing: CadPartDim; readonly count: number; readonly axis2: CadPartAxis; readonly spacing2: CadPartDim; readonly count2: number }
  /** Repeat the original CUT tool on a finite XY grid, masked by an inline reference-point region. */
  | { readonly kind: 'fill-feature-pattern'; readonly target: string; readonly region: FillFeaturePatternRegion; readonly anchor: readonly [number, number]; readonly spacing: CadPartDim; readonly count: number; readonly spacing2: CadPartDim; readonly count2: number }
  /** Repeat a difference's cut tool along an open polyline, with its original orientation. */
  | { readonly kind: 'curve-feature-pattern'; readonly target: string; readonly path: RawNurbsPath; readonly spacing: CadPartDim; readonly count: number }
  /** Copies k·angle about the axis through `pivot` (about X or Y: multiples of 90°). */
  | { readonly kind: 'circular-pattern'; readonly target: string; readonly axis: CadPartAxis; readonly angle: number; readonly count: number; readonly pivot?: CadPartPoint3 }
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
  /** Two world frames: admitted convex polygon or circle/ellipse conic correspondence. */
  | { readonly kind: 'loft'; readonly sections: readonly CadPartLoftSection[]; readonly smooth?: boolean; readonly guide?: LoftInput['guide'] }
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
  | { readonly kind: 'sweep-curve'; readonly sketch: string; readonly path: RawNurbsPath }
  /**
   * Draft (taper) on chosen side faces along the signed `pull` axis (default: positive Z). Each planar side
   * face turns about its line on the neutral plane by `angle` degrees: positive leans into the material,
   * negative out. `neutral` is the world coordinate in mm along that axis (default: the body's minimum
   * for a positive pull, maximum for a negative pull).
   * The faces are selected by name.
   */
  | { readonly kind: 'draft'; readonly target: string; readonly faces: readonly string[]; readonly angle: number; readonly pull?: CadPartAxis | '-x' | '-y' | '-z'; readonly neutral?: CadPartDim; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
  /**
   * D149: one face of a part split along NURBS curves lying on it (`curves`, mm), or along its isocline n·d = 0 for the pull
   * `pull`; the face by name (a base name naming one face). The pieces are named `<face>#1`, `<face>#2` … (an isocline's +
   * side first), or by `names`; every other face, its name and the volume are kept.
   */
  | { readonly kind: 'split-face'; readonly target: string; readonly face: string; readonly curves?: readonly { readonly degree: number; readonly knots: readonly number[]; readonly controlPoints: readonly (readonly [number, number, number])[]; readonly weights: readonly number[] }[]; readonly pull?: CadPartPoint3; readonly names?: readonly string[] }
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
    /**
     * The generator version: 'spur-gear@0' (the default) the schematic root; 'spur-gear@1' (R12b.1a, D130) the root the
     * basic rack generates, its tip radius `toolTipRadius` (default 0.38 m) — spur and helical (R12b.1b), undercut taken as cut.
     */
    readonly generator?: 'spur-gear@0' | 'spur-gear@1'; readonly toolTipRadius?: CadPartDim }
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
    /** 'spur-rack@0' (the default) the schematic root corner; 'spur-rack@1' (R12b.1b, D131) the basic rack's root fillet, radius `rootFillet` (default 0.38 m). */
    readonly generator?: 'spur-rack@0' | 'spur-rack@1'; readonly rootFillet?: CadPartDim }
  /**
   * An internal (ring) gear (R12b.2a, D132): module (a helical one's normalModule, helixAngle and hand — its pinion's
   * hand), teeth, face width and the rim's outer diameter `rim`; profile shift x2 (−0.5 to 0.75), thickness reduction;
   * standing on z `from` about `center`, turned `rotation` degrees (tooth 1 on +X at 0). A spur gear meshes inside it by
   * its `mesh: { gear: <this> }`.
   */
  | { readonly kind: 'internal-gear'; readonly module?: CadPartDim; readonly normalModule?: CadPartDim; readonly helixAngle?: number; readonly hand?: 'right' | 'left'; readonly teeth: number; readonly faceWidth: CadPartDim; readonly rim: CadPartDim;
    readonly pressureAngle?: number; readonly profileShift?: number; readonly thicknessReduction?: CadPartDim; readonly profileTolerance?: number; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    /** 'internal-gear@0' (the default) the schematic root; 'internal-gear@1' (R12b.2b, D133) the root a pinion-type `cutter` cuts (its teeth, shift, tip radius). */
    readonly generator?: 'internal-gear@0' | 'internal-gear@1'; readonly cutter?: { readonly teeth: number; readonly shift?: number; readonly tipRadius?: CadPartDim } }
  /**
   * A straight bevel gear (R12b.3, D134): the spherical involute, standard proportions (addendum m, dedendum 1.25 m at
   * the heel, the cones through the apex), spherical ends. Its module and teeth, its mate's teeth `mateTeeth` and the
   * shaft angle (90° by default) fix its pitch cone; face width along the cone; a bore, a thickness reduction. Its apex
   * at (`center`, `from`), its axis +Z (the teeth above the apex), turned `rotation` degrees (tooth 1 on +X at 0); or,
   * with `mesh`, beside the bevel gear it meshes with — the same apex, its axis at the shaft angle toward `direction`
   * (degrees about the other's axis from its X), a space facing the other's tooth on the pitch line (plus `phase`
   * degrees), following its turn by −z1/z2. Faces `<id>.flankL#k`, `.flankR#k` (`.flankL2#k` … root outward),
   * `.tip#k`, `.root#k`, `.rootL#k`/`.rootR#k`, `.heel`, `.toe`, `.bore#1/2`.
   */
  | { readonly kind: 'bevel-gear'; readonly module: CadPartDim; readonly teeth: number; readonly mateTeeth: number; readonly shaftAngle?: number; readonly faceWidth: CadPartDim; readonly pressureAngle?: number;
    readonly bore?: CadPartDim; readonly thicknessReduction?: CadPartDim; readonly profileTolerance?: number; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    readonly mesh?: { readonly gear: string; readonly direction?: number; readonly phase?: number };
    /**
     * A spiral bevel gear (R12b.4, D135), the ideal conjugate (flagged as an ideal model): its mean spiral angle (degrees,
     * at most 45), hand (right: seen from its apex, the tooth turns clockwise from the toe to the heel) and the circular
     * trace's cutter radius. A mate takes the same angle and radius, the other hand, the same face width.
     */
    readonly spiral?: { readonly angle: number; readonly hand: 'right' | 'left'; readonly cutterRadius: CadPartDim };
    /** 'bevel-gear@0' (the default): straight or spiral, standard, spherical involute, schematic meridian root. */
    readonly generator?: 'bevel-gear@0' }
  /**
   * A cylindrical worm (R12b.5, D136): ZI (the default) or ZA, its axial module, starts (1–4), reference diameter, hand
   * and length; a bore, an axial thickness reduction. On its own its axis is +Z through `center` from `from`, turned
   * `rotation` degrees; or, with `mesh`, beside a helical spur gear (its wheel, at β = the worm's lead angle, of its hand):
   * its axis square to the wheel's, at the centre distance toward `direction` (degrees from +X about the wheel's axis), in
   * the wheel's mid-plane, its length centred there, turned to mesh (plus `phase` degrees of the worm's turn). A meshing
   * worm left without its axial module, diameter or hand takes them from the wheel (m_x = m_n / cos β, d1 = z1 m_x / tan β).
   * Faces `<id>.flankL#k`, `.flankR#k` (`.flankL2#k` …), `.tip#k`, `.root#k`, `.face0`, `.face1`, `.bore#1/2`, segments `.2` ….
   */
  | { readonly kind: 'worm'; readonly axialModule?: CadPartDim; readonly starts: number; readonly diameter?: CadPartDim; readonly hand?: 'right' | 'left'; readonly length: CadPartDim; readonly form?: 'ZI' | 'ZA' | 'ZN' | 'ZK' | 'ZC';
    readonly bore?: CadPartDim; readonly thicknessReduction?: CadPartDim; readonly profileTolerance?: number; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    readonly mesh?: { readonly gear: string; readonly direction?: number; readonly phase?: number };
    /** 'worm@0' (the default). */
    readonly generator?: 'worm@0' }
  /**
   * A throated (single-enveloping) worm wheel (R12b.6, D137): cut by a hob of its ZA worm's thread (`worm`: axialModule,
   * starts, diameter, hand), teeth, face width (centred on its mid-plane), a bore, the spaces widened by
   * `thicknessReduction`; its axis +Z through `center` from `from`, turned `rotation` degrees (tooth 1 on +X in the
   * mid-plane). Its worm meshes with it by the worm's `mesh` (taking the wheel's worm). Faces `<id>.filletL#k`,
   * `.flankL#k`, `.tip#k` (the throat torus), `.flankR#k`, `.filletR#k`, `.root#k` (the root torus), `.face0`, `.face1`, `.bore#1/2`, segments `.2` ….
   */
  | { readonly kind: 'worm-wheel'; readonly worm: { readonly axialModule: CadPartDim; readonly starts: number; readonly diameter: CadPartDim; readonly hand: 'right' | 'left' }; readonly teeth: number; readonly faceWidth: CadPartDim;
    readonly bore?: CadPartDim; readonly thicknessReduction?: CadPartDim; readonly profileTolerance?: number; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    /** 'worm-wheel@0' (the default). */
    readonly generator?: 'worm-wheel@0' }
  /**
   * A compression spring (R12c.1a, D153): round wire `wire` (d) on a coil of mean `diameter` (or `outerDiameter`, or
   * `innerDiameter`: one of them), `activeCoils`, the body's `pitch` or the `freeLength` (one of them), `hand` (right),
   * `ends` open | closed | closed-ground (the default), `endCoils` (dead coils at each closed end, default 1, at most 1),
   * `transition` (the pitch's change to the dead coil, degrees, default 90); `shearModulus` (G, MPa — with
   * `shearModulusEstimate` when it is one) for the rate, `load` (N) for the deflection and stress. Its axis +Z through
   * `center` from `from` (its lowest point, or its ground plane), the wire starting `rotation` degrees from +X. A `type`,
   * `body` or `wireSection` other than compression, cylindrical and round is refused (UNSUPPORTED_SPRING_KIND). The wire
   * is the exact normal-plane circle swept along the coil, fitted within `profileTolerance` (default 1e-4·d). Faces
   * `<id>.wire#k`, `.end0`, `.end1` (the wire's ends), `.ground0`, `.ground1` (the ground planes).
   * R12c.1b (D154): `type` extension — close-wound (or at `pitch`), `hooks` machine-loop (default) or crossover, `bendRadius`,
   * `loopRadius`, `loopAngle` (degrees), `initialTension` (N, the user's figure); torsion — tangent `legLengths` [start, end],
   * `youngsModulus` (E, MPa, with `youngsModulusEstimate`), `moment` (N·mm). Faces `.hook0#k`/`.hook1#k` or `.leg0#k`/`.leg1#k`.
   */
  | { readonly kind: 'spring'; readonly wire: CadPartDim; readonly diameter?: CadPartDim; readonly outerDiameter?: CadPartDim; readonly innerDiameter?: CadPartDim; readonly activeCoils: number;
    readonly pitch?: CadPartDim; readonly freeLength?: CadPartDim; readonly hand?: 'right' | 'left'; readonly ends?: 'open' | 'closed' | 'closed-ground'; readonly endCoils?: number; readonly transition?: number;
    readonly shearModulus?: number; readonly shearModulusEstimate?: boolean; readonly load?: number; readonly profileTolerance?: number;
    readonly hooks?: 'machine-loop' | 'crossover'; readonly bendRadius?: CadPartDim; readonly loopRadius?: CadPartDim; readonly loopAngle?: number; readonly initialTension?: number;
    readonly legLengths?: readonly [CadPartDim, CadPartDim]; readonly youngsModulus?: number; readonly youngsModulusEstimate?: boolean; readonly moment?: number;
    readonly type?: 'compression' | 'extension' | 'torsion'; readonly body?: 'cylindrical' | 'conical' | 'barrel' | 'variable-pitch'; readonly wireSection?: 'round' | 'rectangular';
    readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    /** 'spring@0' (the default). */
    readonly generator?: 'spring@0' }
  /**
   * A disc cam (R12c.6a, D160) for a `follower` roller | flat, its `motion` translating (the default; `offset` its line off
   * the centre) or oscillating (`pivotDistance`, the roller's `armLength`, the face's `faceOffset`), the `roller` radius,
   * the `base` circle, its `segments` — { angle (degrees), to (the follower's position, mm or the arm's degrees; omitted a
   * dwell), law uniform | harmonic | cycloidal | polynomial-345 | modified-trapezoid } from 0 round to 0 over 360° —
   * `thickness`, `bore`; `pressureAngleLimit` (degrees; default 30 translating, 35 oscillating, estimates), `faceWidth`
   * checked, `profileTolerance` (default 1e-4·base). The cam turns counter-clockwise; the follower above it at `rotation` 0
   * (degrees about +Z through `center`, from `from`). Faces `<id>.rise1#k`, `.dwell1#k`, `.return1#k`, `.bore#1`/`#2`,
   * `.face0`/`.face1`. Refused: CAM_UNDERCUT, INVALID_INPUT.
   */
  | { readonly kind: 'cam'; readonly base: CadPartDim; readonly thickness: CadPartDim; readonly follower: 'roller' | 'flat'; readonly motion?: 'translating' | 'oscillating';
    readonly roller?: CadPartDim; readonly offset?: CadPartDim; readonly pivotDistance?: CadPartDim; readonly armLength?: CadPartDim; readonly faceOffset?: CadPartDim; readonly faceWidth?: CadPartDim;
    readonly segments: readonly { readonly angle: number; readonly to?: number; readonly law?: CamLaw }[];
    readonly bore?: CadPartDim; readonly minimumRim?: CadPartDim; readonly pressureAngleLimit?: number; readonly profileTolerance?: number;
    readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    /** 'cam@0' (the default). */
    readonly generator?: 'cam@0' }
  /**
   * R12c.6b (D161): drive elements from the user's rows (`row` inline: a chain, a belt or a coupling row, citing its source
   * or flagged an estimate). A `sprocket` for a chain row, `teeth`, `tip` Ø and `width` (the tooth form `pivot-clearance`,
   * derived; `seat` Ø at least the roller's); a `pulley` for a belt row (timing: `teeth`, `width`; V: `diameter` the datum,
   * `grooves`; flat: `diameter`, `width`, `crown`); a `belt` (its row a belt or a chain) as a band on two wheels' pitch
   * radii `pitchRadii` at `centerDistance` along the turned +X (`rounding` a chain's links); a `coupling`'s envelope.
   * Each on its axis +Z through `center` from `from`, turned `rotation` degrees. Faces in `drive.ts`.
   */
  | { readonly kind: 'sprocket'; readonly row: DriveRow; readonly teeth: number; readonly tip: CadPartDim; readonly width: CadPartDim; readonly seat?: CadPartDim; readonly toothForm?: string; readonly bore?: CadPartDim; readonly minimumRim?: CadPartDim; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number; readonly generator?: 'sprocket@0' }
  | { readonly kind: 'pulley'; readonly row: DriveRow; readonly teeth?: number; readonly diameter?: CadPartDim; readonly grooves?: number; readonly width?: CadPartDim; readonly crown?: CadPartDim; readonly bore?: CadPartDim; readonly minimumRim?: CadPartDim; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number; readonly generator?: 'pulley@0' }
  | { readonly kind: 'belt'; readonly row: DriveRow; readonly pitchRadii: readonly [CadPartDim, CadPartDim]; readonly centerDistance: CadPartDim; readonly rounding?: 'whole' | 'even'; readonly width?: CadPartDim; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number; readonly generator?: 'belt@0' }
  | { readonly kind: 'coupling'; readonly row: DriveRow; readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number; readonly generator?: 'coupling@0' }
  /**
   * R12c.7 (D162): a connector's opening cut into a flat `face` of `target` at `center` (on the face), its width turned
   * `rotation` degrees about the face's normal, from the user's `row` inline (opening, body?, keepOut?; source or
   * estimate); the output's `connector` is the report (the frame, the body's gaps, the keep-out in A6.3's form). A
   * `connector-body` is the row's body envelope seated in that opening (it refers to it), its overlap with the panel
   * checked: touching at most (`CONNECTOR_FIT`).
   */
  | { readonly kind: 'connector-opening'; readonly target: string; readonly face: string; readonly row: ConnectorRow; readonly center: CadPartPoint3; readonly rotation?: number }
  | { readonly kind: 'connector-body'; readonly opening: string }
  /**
   * FRk1 (D165): a `gusset` — a plate in the plane of two members of `frame` meeting at its skeleton `point` (the two
   * there, or `members` [a, b] where more meet; a member passing through takes `along` 1 or −1, its own direction or
   * the other way), its legs `legs` [l1, l2] along their inner faces from the corner where those faces meet, the corner
   * clipped `clip` along each leg, `thickness` thick, its mid-plane through the members' lines or moved `offset` along
   * its normal. An `end-cap` — a plate `over` a member's square end (its section's outer loop) or `inset` in its bore,
   * `thickness` thick. Each an output of its own; `gusset` / `endCap` its report. Refused GUSSET_FIT, CAP_END.
   */
  | { readonly kind: 'gusset'; readonly frame: string; readonly point: number; readonly members?: readonly [number, number]; readonly along?: number; readonly legs: readonly [CadPartDim, CadPartDim]; readonly thickness: CadPartDim; readonly clip?: CadPartDim; readonly offset?: CadPartDim }
  | { readonly kind: 'end-cap'; readonly frame: string; readonly member: number; readonly end: 'start' | 'end'; readonly fit: 'over' | 'inset'; readonly thickness: CadPartDim }
  /**
   * FRk2 (D166): a fillet `weld-bead` of leg `leg` on a frame's joint: `on` a member's end landing square on other
   * members' flat faces (a butt, a T's butt, a square end on a face; `inner` the bore's loop too), or `on` a gusset (both
   * its seams, both faces). Its body the fillet (the end's loop offset by the leg, drafted 45°, less the member, kept on
   * the faces it lands on); `bead` its report. Refused BEAD_KIND, BEAD_SEAM_NOT_PLANAR, BEAD_ANGLE, BEAD_SIZE.
   */
  | { readonly kind: 'weld-bead'; readonly frame: string; readonly on: { readonly member: number; readonly end: 'start' | 'end' } | { readonly gusset: string } | { readonly cap: string }; readonly leg: CadPartDim; readonly inner?: boolean; readonly sharing?: CadPartBeadSharing }
  /**
   * A shaft (R12c.3a, D156): `steps` [{ diameter, length, fillet? (at the shoulder after it), undercut? { width, depth },
   * grooves? [{ diameter, width, at }], keyseats? [{ width, depth, length, offset, ends? square | end-mill (default) |
   * disc, cutterRadius?, angle? }] }] along +Z from `from` through `center`, `chamfers` [start, end], cross `holes`
   * [{ diameter, at, angle? }], turned `rotation` degrees. Faces `<id>.seatk`, `.shoulders`, `.fillets`, `.undercuts`,
   * `.grooveg`, `.keyseatj`, `.holej`, `.chamfer0/1`, `.end0/1` (each revolved one in halves `#1`, `#2`).
   */
  | { readonly kind: 'shaft'; readonly steps: readonly { readonly diameter: CadPartDim; readonly length: CadPartDim; readonly fillet?: CadPartDim; readonly undercut?: { readonly width: CadPartDim; readonly depth: CadPartDim };
      readonly grooves?: readonly { readonly diameter: CadPartDim; readonly width: CadPartDim; readonly at: CadPartDim }[];
      readonly keyseats?: readonly { readonly width: CadPartDim; readonly depth: CadPartDim; readonly length: CadPartDim; readonly offset: CadPartDim; readonly ends?: 'square' | 'end-mill' | 'disc'; readonly cutterRadius?: CadPartDim; readonly angle?: number }[] }[];
    readonly chamfers?: readonly [CadPartDim, CadPartDim]; readonly holes?: readonly { readonly diameter: CadPartDim; readonly at: CadPartDim; readonly angle?: number }[];
    readonly center?: CadPartPoint2; readonly from?: CadPartDim; readonly rotation?: number;
    /** 'shaft@0' (the default). */
    readonly generator?: 'shaft@0' }
  /**
   * R12c.3b (D157): what goes on a shaft. A parallel `key` in keyseat `keyseat` of the shaft feature `shaft` (width and
   * length the seat's by default; its height; ends round | square), checked against the seat and, with `hub` (a keyway
   * feature), against the hub's keyway; `fit` { tables, key, seat?, hub? } its width's classes (R12c.2). A `keyway` cut
   * into `target`'s bore `face` (width, depth t2, angle). A `retaining-ring` envelope in groove `groove` (thickness, outer
   * diameter; `row` the user's ring row). A `pin` in cross hole `hole` (diameter and length the hole's and the step's by
   * default; `fit` true when its classes make an interference a declared fit). Sizes are the user's.
   */
  | { readonly kind: 'key'; readonly shaft: string; readonly keyseat: number; readonly width?: CadPartDim; readonly height: CadPartDim; readonly length?: CadPartDim; readonly ends?: 'round' | 'square'; readonly hub?: string; readonly fit?: { readonly tables: readonly FitTable[]; readonly key: string; readonly seat?: string; readonly hub?: string } }
  | { readonly kind: 'keyway'; readonly target: string; readonly face: string; readonly width: CadPartDim; readonly depth: CadPartDim; readonly angle?: number }
  | { readonly kind: 'retaining-ring'; readonly shaft: string; readonly groove: number; readonly thickness: CadPartDim; readonly outerDiameter: CadPartDim; readonly row?: { readonly shaftDiameter?: number; readonly grooveDiameter?: number; readonly grooveWidth?: number; readonly source?: string; readonly estimate?: boolean } }
  /**
   * R12c.4 (D158): a rolling bearing's envelope from the user's catalogue `row` (bore, outside, width, chamfer, the
   * abutment values, the rings' deviations; source | estimate: none built in) on step `step` of the shaft feature `shaft`
   * against the shoulder at the step's `against` end; `housing` a body whose bore takes it; `fit` the seats' classes
   * { tables, shaft?, housing? } (R12c.2). Faces `<id>.bore`, `.outside`, `.face0/1`, `.corner1–4`.
   */
  /**
   * R12c.5 (D159): an O-ring gland's groove cut into `target` at its `face` — `gland` piston (a shaft's outside, sealing
   * on a bore of Ø `seal`), rod (a bore, sealing on a rod of Ø `seal`) or face (a flat face, the groove `depth` deep about
   * `center`) — from the user's ring `ring` row { id, dash?, insideDiameter, crossSection, source | estimate } and the
   * groove { diameter (its bottom, or a face groove's inner Ø), width, at (along the face) }; `ranges` the guidance (by
   * default D139's O2, estimates); `fit` the seal's and the groove's classes. An `oring` is the ring in a gland feature.
   */
  | { readonly kind: 'oring-gland'; readonly target: string; readonly face: string; readonly gland: 'piston' | 'rod' | 'face'; readonly ring: { readonly id: string; readonly dash?: string; readonly insideDiameter: number; readonly crossSection: number; readonly source?: string; readonly estimate?: boolean };
      readonly groove: { readonly diameter: CadPartDim; readonly width: CadPartDim; readonly at?: CadPartDim; readonly depth?: CadPartDim; readonly center?: CadPartPoint3 }; readonly seal?: CadPartDim; readonly ranges?: GlandRanges; readonly fit?: { readonly tables: readonly FitTable[]; readonly seal?: string; readonly groove?: string } }
  | { readonly kind: 'oring'; readonly gland: string }
  | { readonly kind: 'bearing'; readonly row: BearingRow; readonly shaft: string; readonly step: number; readonly against: 'start' | 'end'; readonly housing?: string; readonly fit?: BearingFitClasses }
  | { readonly kind: 'pin'; readonly shaft: string; readonly hole: number; readonly diameter?: CadPartDim; readonly length?: CadPartDim; readonly fit?: boolean }
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
   * A structural member (FR1, D123): a `section` placed square to the line `start` → `end` and extruded its length, one
   * body. The section's `anchor` point (default its centroid) lies on the line, then the section moves by `offset` (in its own XY); the
   * section's y runs along `up` (default +Z) made square to the line (a line along it takes +X, else +Y, and the report
   * says so), then the section turns `roll` degrees about the line. Sections: `rect-tube`, `round-tube`, `angle`,
   * `channel`, `tslot` (every dimension given: no sizes or radii built in, D122) or `sketch` (a closed sketch's loops in its
   * own XY, holes allowed). Faces by the section's roles (`<id>.top`, `<id>.bore.left`, `<id>.root`, `<id>.t1.floor` …;
   * a sketch's by its sides) and the ends `<id>.start` / `<id>.end`. The output's `member` reports the section, its area
   * and centroid, the line and the section's frame. Refused by name: `SECTION_DIMENSIONS`, `SEGMENT_ZERO_LENGTH`.
   */
  /**
   * A frame (FR2, D124): one member (as `frame-member`) along each of `segments` (pairs of indices into `points`, from →
   * to), each its own body, `<id>/<k>` for segment k — never united. The frame's `section`, `anchor`, `offset`, `roll`
   * and `mirror` (the section turned over across its own y axis) hold for every member unless `overrides` says otherwise
   * for one; `up` for all. Faces `<id>.m<k>.<role>` and the ends `<id>.m<k>.start` / `.end`. Each output's `member`
   * report carries its `frame` place (member, from, to). Refused by name: `SEGMENT_ZERO_LENGTH`, `MEMBER_DUPLICATE` (two
   * segments on the same two points), `SKELETON_OVERLAP` (two on one line sharing a length), and the sections'
   * `SECTION_DIMENSIONS`.
   */
  | { readonly kind: 'frame'; readonly points: readonly CadPartPoint3[]; readonly segments: readonly CadPartFrameSegment[]; readonly bends?: readonly { readonly point: number; readonly radius: CadPartDim }[]; readonly section: CadPartSection; readonly anchor?: FrameAnchor; readonly offset?: readonly [CadPartDim, CadPartDim]; readonly roll?: number; readonly mirror?: boolean; readonly up?: CadPartPoint3; readonly overrides?: readonly CadPartFrameOverride[]; readonly corners?: CadPartFrameCorners; readonly trims?: readonly CadPartFrameTrim[] }
  | { readonly kind: 'frame-member'; readonly section: CadPartSection; readonly start: CadPartPoint3; readonly end: CadPartPoint3; readonly anchor?: FrameAnchor; readonly offset?: readonly [CadPartDim, CadPartDim]; readonly roll?: number; readonly up?: CadPartPoint3 }
  /**
   * An edge flange (R12.3, D118) on a sheet (its rules from its report): on a straight `edge` between a planar skin face
   * and a thickness face, bent `angle` (default 90, in (0, 180)) towards that skin's outside, inner radius
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
  | { readonly kind: 'sheet-flange'; readonly target: string; readonly edge: string; readonly length: CadPartDim; readonly angle?: number; readonly bendRadius?: CadPartDim; readonly measure?: 'outer' | 'inner' | 'tangent'; readonly position?: 'material-inside' | 'material-outside' | 'bend-outside'; readonly offsets?: readonly [CadPartDim, CadPartDim]; readonly relief?: { readonly kind: 'rectangular' | 'obround'; readonly width: CadPartDim; readonly depth: CadPartDim } | { readonly kind: 'none' } }
  /** Hollowed to walls `thickness` thick; `open` names the faces removed (the top of a box, a side). */
  | { readonly kind: 'shell'; readonly target: string; readonly thickness: CadPartDim; readonly open?: readonly string[]; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
  | { readonly kind: 'chamfer'; readonly target: string; readonly edges: readonly string[]; readonly distance: CadPartDim; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
  /** Vertical edges of upright bodies. */
  /**
   * `radius` rounds the edges with one radius. `radii` instead gives the radius at points of the edges (2–16, each on
   * one of them; R10.5, D100): between them it varies smoothly by arc length along each chain (shape-preserving cubic,
   * two points: linear), carried on at its end slopes past the outer points of an open chain (it must stay positive
   * to the chain's ends), periodic round a closed one. Give one of them. A point with `atEnd: true` is the radius at an end
   * of the open chain the edges make: evaluated, it is the chain end nearest its `at` (the two of a pair at the two ends), so
   * it follows the ends when an earlier feature moves them.
   */
  /**
   * `section` (R10.5b, D103): the fillet's shape across — `circular` (the default, the rolling ball's arc); `conic` with
   * `rho` in (0, 1) (0.5 a parabola, less flatter, more fuller); `g2`, curvature-continuous with the faces, `tension` in
   * (0, 1) (0.5 when left out). Not circular: the rolling ball's chains, not where it rolls round or onto an edge.
   */
  | { readonly kind: 'fillet'; readonly target: string; readonly edges: readonly string[]; readonly radius?: CadPartDim; readonly radii?: readonly { readonly at: CadPartPoint3; readonly radius: CadPartDim; readonly atEnd?: true }[]; readonly section?: { readonly kind: 'circular' } | { readonly kind: 'conic'; readonly rho: number } | { readonly kind: 'g2'; readonly tension?: number }; readonly expect?: Readonly<Record<string, CadPartNameSignature>> }
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
export type CadPartLoftSection = ({ readonly sketch: string; readonly profile?: never } & (
  | { readonly z: CadPartDim; readonly frame?: never }
  /** An explicit world frame replaces the sketch's placement, keeping its local profile coordinates. */
  | { readonly frame: LoftSectionFrame; readonly z?: never }
)) | { readonly profile: Exclude<LoftSectionInput['profile'], readonly ProfileSegmentInput[]>; readonly frame: LoftSectionFrame; readonly sketch?: never; readonly z?: never };
export type CadPartSweepStep = { readonly kind: 'straight'; readonly length: CadPartDim } | { readonly kind: 'bend'; readonly radius: CadPartDim; readonly angle: number; readonly toward: 'x' | '-x' | 'y' | '-y' };
/**
 * A frame's corners (FR3a, D125): where exactly two members end at a skeleton point, `default` finishes them — `mitre`
 * (both cut on the plane halfway between them), `butt` (one runs through to cover the other, which ends on its face) or
 * `none` (left square, overlapping); `mitre` when left out — and `at` sets a point apart (`through`: the member that runs
 * on at a butt; by default the larger section, the lower index on a tie). `corners` left out: no corner is finished (an
 * FR2 frame as it was).
 * Points where three or more members end are left as they are (an ordered trim, FR3b) and reported square.
 */
export interface CadPartFrameCorners {
  readonly default?: 'mitre' | 'butt' | 'none';
  /** Full joint clearance in mm; a mitre moves each plane by gap/2. */
  readonly gap?: CadPartDim;
  /** Where three or more members end (FR3b, D126): `order` (an ordered trim: the larger sections first, then the lower index) or `none` (the default: left square). */
  readonly multi?: 'order' | 'none';
  /** Where members end on another's length — a T-joint (FR3b): `butt` (on its box face), `cope` (to its envelope) or `none` (the default). */
  readonly tee?: 'butt' | 'cope' | 'none';
  /** A point set apart: `through` at a butt or cope; `trim` at a butt (`face`, the default, or `envelope`); `order` at an ordered trim (its members, the first running through). */
  readonly at?: readonly { readonly point: number; readonly kind: 'mitre' | 'butt' | 'cope' | 'order' | 'none'; readonly through?: number; readonly trim?: 'face' | 'envelope'; readonly order?: readonly number[]; readonly gap?: CadPartDim; readonly notch?: CadPartFrameNotch }[];
}
export type CadPartFrameNotch = { readonly kind: 'holesaw'; readonly diameter: CadPartDim; readonly offset?: CadPartDim } | { readonly kind: 'v'; readonly depth: CadPartDim; readonly angle: CadPartDim };
/** A member's end trimmed to a plane (the side holding its other end kept) or to an earlier body (FR3b, D126). */
export type CadPartFrameTrim = { readonly member: number; readonly end: 'start' | 'end' } & ({ readonly plane: { readonly origin: CadPartPoint3; readonly normal: CadPartPoint3 } } | { readonly body: string });
/** One member of a frame set apart (FR2, D124): its own section, anchor, offset, roll or mirror. */
export interface CadPartFrameOverride { readonly member: number; readonly section?: CadPartSection; readonly anchor?: FrameAnchor; readonly offset?: readonly [CadPartDim, CadPartDim]; readonly roll?: number; readonly mirror?: boolean }
/** A member's section (FR1, D123): a kind and its dimensions, or a closed sketch. */
export type CadPartFrameSegment = readonly [number, number] | { readonly from: number; readonly to: number; readonly through: number } | { readonly from: number; readonly to: number; readonly center: CadPartPoint3 };

export type CadPartSection =
  | { readonly kind: 'rect-tube'; readonly width: CadPartDim; readonly height: CadPartDim; readonly wall: CadPartDim; readonly outerRadius: CadPartDim; readonly innerRadius?: CadPartDim }
  | { readonly kind: 'round-tube'; readonly diameter: CadPartDim; readonly wall: CadPartDim }
  | { readonly kind: 'angle'; readonly legX: CadPartDim; readonly legY: CadPartDim; readonly thickness: CadPartDim; readonly rootRadius: CadPartDim; readonly toeRadius: CadPartDim }
  | { readonly kind: 'channel'; readonly height: CadPartDim; readonly width: CadPartDim; readonly web: CadPartDim; readonly flange: CadPartDim; readonly rootRadius: CadPartDim; readonly toeRadius?: CadPartDim; readonly flangeSlope?: CadPartDim }
  | { readonly kind: 'i-beam'; readonly height: CadPartDim; readonly width: CadPartDim; readonly web: CadPartDim; readonly flange: CadPartDim; readonly rootRadius: CadPartDim; readonly toeRadius: CadPartDim; readonly flangeSlope: CadPartDim }
  | { readonly kind: 'tslot'; readonly size: CadPartDim; readonly cells: 1 | 2; readonly openSlots?: number; readonly opening: CadPartDim; readonly lip: CadPartDim; readonly undercut: CadPartDim; readonly depth: CadPartDim; readonly bore: CadPartDim }
  | { readonly kind: 'sketch'; readonly sketch: string }
  /** A size from a section table (R12c.7, D162): the user's rows of one kind, inline; checked whole, a size it lacks refused. */
  | { readonly kind: 'table'; readonly table: SectionTable; readonly size: string };
export type CadPartErrorCode = 'FORMAT' | 'INPUT' | 'PARAMETER' | 'REFERENCE' | 'SELECTION' | 'CAPABILITY' | 'GEOMETRY';
/** Complete declared endpoint manifest for one frame; rebuild after an atomic retry removes a component. */
export interface CadPartBeadSharing {
  readonly version: 1; readonly policy: 'equal-length';
  /** Complete active endpoint manifest for this frame; membership is not a geometric component. */
  readonly joints: readonly (BeadJointRef & { readonly leg: CadPartDim })[];
}
/**
 * A part-model refusal. Its `code` is the specific bracketed code of its message where it has one (`[FIT_TABLE_MISS]
 * …`), else its category; the category is in `details.category` either way (R7.3a batch 2, D278).
 */
export class CadPartError extends KernelError {
  declare readonly code: CadPartErrorCode | CadRefusalCode;
  declare readonly details: { readonly category: CadPartErrorCode };
  constructor(category: CadPartErrorCode, readonly feature: string | null, detail: string, readonly sharedComponent?: BeadSharedComponent) {
    super(`${feature ? feature + ': ' : ''}${detail}`.slice(0, 1024), { code: refusalCodeOf(detail) ?? category, details: { category } }); this.name = 'CadPartError';
  }
}
export interface CadPartOutput {
  /** The feature id, or `id/k` for one part of a multi-part feature. */
  readonly id: string; readonly feature: string;
  /** 'upright': a Z-prismatic solid (closed-form mass, curved Booleans); otherwise a general B-rep. */
  readonly representation: 'upright' | 'planar' | 'curved' | 'faceted';
  readonly brep: Brep;
  readonly bodyCount: number;
  /** Closed-reference qualification; mass requires this evaluation's owned live provider. */
  readonly cylindricalWrap?: CylindricalWrapReport;
  // (R7.3b: its results are functions over it — massPropertiesOf, surfaceAreaOf, checkOutput, exportStl, exportStep, flatPatternOf.)
  /** A generated gear's report: its dimensions, the measured flank deviation, its diagnostics (R6a). */
  readonly gear?: SpurGearReport;
  /** A gear's placement (spec, centre, face plane, turn; the gear it meshes with). */
  readonly gearPlacement?: GearPlacement;
  /** A rack's report and placement (R6a.5b). */
  readonly rack?: SpurRackReport;
  readonly rackPlacement?: RackPlacement;
  /** An internal gear's report and placement (R12b.2a). */
  readonly internalGear?: InternalGearReport;
  readonly internalGearPlacement?: PlacedInternalGear;
  /** A bevel gear's report and placement (R12b.3). */
  readonly bevelGear?: BevelGearReport;
  readonly bevelGearPlacement?: BevelGearPlacement;
  /** A worm's report and placement (R12b.5). */
  readonly worm?: WormReport;
  readonly wormPlacement?: WormPlacement;
  /** A throated worm wheel's report and placement (R12b.6). */
  readonly wormWheel?: ThroatedWheelReport;
  readonly wormWheelPlacement?: PlacedThroatedWheel;
  /** A spring's report: its dimensions, rate and stresses, the sweep's measured fit (R12c.1a; extension and torsion R12c.1b). */
  readonly spring?: SpringReport | HookedSpringReport;
  /** A cam's report: its program, pressure angle, curvature, fit and the follower's sweep on the built profile (R12c.6a). */
  readonly cam?: CamReport;
  /** A drive element's report (R12c.6b): a sprocket's, a pulley's, a belt's or chain's, a coupling's (a bought item). */
  readonly sprocket?: SprocketReport; readonly pulley?: PulleyReport; readonly belt?: BeltReport; readonly coupling?: CouplingReport;
  /** A connector's opening report (R12c.7): its frame, the body's fit, the keep-out; on a body, its overlap with the panel. */
  readonly connector?: ConnectorReport; readonly connectorBody?: { readonly row: string; readonly overlap: number };
  /** A shaft's report: its steps, keyseats, grooves and holes (R12c.3a). */
  readonly shaft?: ShaftReport;
  /** A key's, a keyway's, a ring's or a pin's report and checks (R12c.3b). */
  readonly key?: KeyReport; readonly keyway?: KeywayReport; readonly ring?: RingReport; readonly pin?: PinReport;
  /** A bearing's report: its row, seat, housing, fits and warnings (R12c.4). */
  readonly bearing?: BearingReport;
  /** An O-ring gland's check and the ring's free overlap with its sealing surface (R12c.5). */
  readonly gland?: GlandReport; readonly oring?: { readonly ring: string; readonly overlap: number; readonly stretchedCrossSection: number };
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
  /** A structural member's section, line and frame (FR1, D123). */
  readonly member?: FrameMemberReport;
  /** A gusset's and an end cap's report (FRk1, D165): what the weld list and the BOM read. */
  readonly gusset?: GussetReport; readonly endCap?: EndCapReport;
  /** A fillet weld bead's report (FRk2, D166): its joint, leg, seam and volume. */
  readonly bead?: BeadReport;
}
export interface CadPartSnapshot {
  readonly document: CadPartDocument;
  /** Parts no later feature consumes, in feature order. */
  readonly outputs: readonly CadPartOutput[];
  readonly features: readonly { readonly id: string; readonly kind: CadPartFeature['kind']; readonly dependencies: readonly string[] }[];
  /** Features computed in this evaluation, and features reused unchanged from the previous one. */
  readonly recomputation: { readonly evaluated: readonly string[]; readonly reused: readonly string[] };
  /** With `profile`: each feature's cost, by id (a reused feature's is its lookup). */
  readonly profile?: Readonly<Record<string, CadPartFeatureProfile>>;
  // (R7.3b: outputOf, reevaluate and saveCadPart over it.)
}
/**
 * `stepBytes`: an imported STEP file's text. A STEP file is read whole, and a solid of many faces holds
 * about 17 times its text in memory while it is built (a 19 MB faceted M8 bolt: about 320 MB): 32 MiB keeps
 * that near half a gigabyte, within a browser worker, and holds the studio's own exports of modelled
 * threads. The part document's own text stays at `fileBytes`. `stepTessellatedBytes`: a file whose excess over
 * `stepBytes` is tessellated meshes (AP242: the studio's own mesh exports, scans) — see `stepSizeProblem`.
 */
export const CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, stepBytes: 32 << 20, stepTessellatedBytes: 128 << 20, length: 10000, meshTriangles: 2_000_000, planarMeshTriangles: 100_000, subdVertices: 100_000 });
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
export type Solid = { readonly kind: 'upright'; readonly solid: PrismaticSolid } | { readonly kind: 'brep'; readonly brep: Brep };
/** `history`: an upright body of one section and the edge finishes applied to it since (for shell). */
interface Finish { readonly kind: 'chamfer' | 'fillet'; readonly edges: readonly string[]; readonly size: number; readonly id: string; /** A variable radius (D100), the radius at points of the edges. */ readonly radii?: readonly { readonly at: Point; readonly radius: number }[] }
/** `moved`: the part this one is a moved (turned, mirrored, uniformly scaled) copy of, for shell. */
export interface Part {
  readonly solid: Solid; brep?: Brep; readonly mass?: (density: number) => MassProperties;
  readonly cylindricalWrap?: CylindricalWrapReport;
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
  /** An internal gear's report and placement (R12b.2a). */
  readonly internalGear?: InternalGearReport;
  readonly internalPlace?: PlacedInternalGear;
  readonly bevelGear?: BevelGearReport;
  readonly bevelPlace?: BevelGearPlacement;
  readonly worm?: WormReport;
  readonly wormPlace?: WormPlacement;
  readonly wormWheel?: ThroatedWheelReport;
  readonly wormWheelPlace?: PlacedThroatedWheel;
  readonly spring?: SpringReport | HookedSpringReport;
  readonly cam?: CamReport;
  readonly sprocket?: SprocketReport; readonly pulley?: PulleyReport; readonly belt?: BeltReport; readonly coupling?: CouplingReport;
  readonly connector?: ConnectorReport; readonly connectorBody?: { readonly row: string; readonly overlap: number };
  readonly shaft?: ShaftReport;
  readonly shaftPlace?: BrepAffine;
  readonly key?: KeyReport; readonly keyway?: KeywayReport; readonly ring?: RingReport; readonly pin?: PinReport;
  readonly bearing?: BearingReport;
  readonly gland?: GlandReport; readonly glandPlace?: GlandPlace; readonly oring?: { readonly ring: string; readonly overlap: number; readonly stretchedCrossSection: number };
  readonly subd?: SubdSummary;
  readonly decimate?: DecimateReport;
  readonly fillet?: readonly FilletReport[];
  readonly shell?: MeshShellReport;
  readonly sheet?: SheetReport;
  readonly member?: FrameMemberReport;
  /** A frame member's placement as built (FRk1): its section on its line, its length and how far each end runs on, its face prefix. */
  readonly memberPlace?: MemberPlaced;
  readonly gusset?: GussetReport; readonly endCap?: EndCapReport;
  /** A gusset's placement as built (FRk2: its beads): its plane's frame and corner, its legs, clip, thickness and offset. */
  readonly gussetPlace?: GussetPlaced;
  readonly bead?: BeadReport;
}
/** A rack as placed: its pitch line from `origin` along `angle` (radians); the gear it meshes with, if any. */
export interface RackPlacement { readonly spec: SpurRackSpec; readonly origin: XY; readonly angle: number; readonly from: number; readonly meshesWith?: string; readonly driver?: GearPlacement }
/** A spur gear as placed: its spec, axis through `center` along +Z from `from`, turned by `rotation` (radians). */
export interface GearPlacement {
  readonly spec: SpurGearSpec; readonly center: XY; readonly from: number; readonly rotation: number;
  /** A meshing gear: the feature it meshes with, and that gear's placement (for the pair checks, checkPlacedSpurGears). */
  readonly meshesWith?: string; readonly driver?: GearPlacement;
  /** A pinion meshing inside a ring (R12b.2a): the ring's placement (checkPlacedInternalGears). */
  readonly ring?: PlacedInternalGear;
}
/** A worm as placed (R12b.5): its frame and turn; the wheel it meshes with and that one's placement. */
export interface WormPlacement extends PlacedWorm { readonly meshesWith?: string; readonly wheel?: GearPlacement; readonly throatedWheel?: PlacedThroatedWheel }
/** A bevel gear as placed (R12b.3): its apex, axis and turn; the bevel gear it meshes with and that one's placement. */
export interface BevelGearPlacement extends PlacedBevelGear { readonly meshesWith?: string; readonly driver?: BevelGearPlacement }
type SweepStep = { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' };
/** x ↦ m·x + o from a sketch's own XY (Z along its normal) into the part. */
type Frame = { readonly m: BrepAffine['matrix']; readonly o: Point };
export type Result = { readonly kind: 'sketch'; readonly outer: readonly ProfileSegmentInput[]; readonly frame?: Frame; readonly regions?: readonly (readonly ProfileSegmentInput[])[]; readonly holes?: readonly (readonly ProfileSegmentInput[])[]; readonly tags?: SideTags } | { readonly kind: 'solid'; readonly parts: readonly Part[] };

/** A B-rep of several bodies as one B-rep per body (each with its own shells, faces, loops, edges and vertices). */
export function splitBodies(b: Brep): Brep[] {
  if (b.bodies.length <= 1) return [b];
  return b.bodies.map(body => {
    const shells = b.shells.filter(x => x.body === body.id), faceIds = new Set(shells.flatMap(x => x.faces)), faces = b.faces.filter(f => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap(f => f.loops)), loops = b.loops.filter(l => loopIds.has(l.id)), coIds = new Set(loops.flatMap(l => l.coedges));
    const coedges = b.coedges.filter(c => coIds.has(c.id)), edgeIds = new Set(coedges.map(c => c.edge)), edges = b.edges.filter(e => edgeIds.has(e.id)), vIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter(v => vIds.has(v.id)) };
  });
}
export const empty = (s: Solid) => s.kind === 'upright' ? !s.solid.slabs.length : !s.brep.bodies.length;
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
/** The current feature's kernel calls while `profile` evaluates (null otherwise: one test per counted call). */
let profiling: CadPartProfileCalls | null = null;
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
  catch (cause) { if (isMeshBrepError(cause)) throw new CadPartError('GEOMETRY', at, cause.message); throw cause; }
}
export const brepOf = (part: Part, id: string): Brep => part.brep ??= part.solid.kind === 'upright' ? brepFromPrismatic(part.solid.solid, { id }) : part.solid.brep;
/** A feature run after its stored names are checked on each target part (O19, D277). */
function expectedThen(f: CadPartFeature & Record<string, unknown>, t: Tools, expect: ReturnType<typeof expectOf> & object, run: () => Result): () => Result {
  const parts = t.solids(f.target, 'target'), edges = f.kind === 'fillet' || f.kind === 'chamfer';
  return () => { for (const p of parts) checkExpected(brepOf(p, t.at), expect, edges, f.kind, t.fail); return run(); };
}

/** Free space closer than this above a hole's face (mm) refuses it (D148b): the cutter has no room to stop short of it. */
const OBSTRUCTION_MM = 1e-3;
/** Unit vectors of the two coordinates a hole's `center` is in, for axis k: z → (x, y), x → (y, z), y → (x, z). */
const HOLE_PLANE_AXES: readonly (readonly [number, number])[] = [[1, 2], [0, 2], [0, 1]];
/**
 * The free space above a hole's face along its axis (D148b): rays from the face's plane, out along its normal, from the
 * hole's centre and 16 points on its rim and 8 at half its radius, against the body's tessellation (K2's tree); the
 * least hit, or Infinity when nothing is above.
 */
function clearanceAbove(brep: Brep, k: number, dir: 1 | -1, face: number, c: XY, r: number): number {
  if (profiling) profiling.tessellations++;
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 8 }), bvh = triangleBvh(mesh.positions, mesh.indices), [a, b] = HOLE_PLANE_AXES[k];
  const o: Point = [0, 0, 0], d: Point = [0, 0, 0]; d[k] = dir;
  let least = Infinity;
  for (let s = 0; s < 25; s++) {
    const rad = s === 0 ? 0 : s <= 16 ? r : r / 2, ang = s === 0 ? 0 : s <= 16 ? 2 * Math.PI * (s - 1) / 16 : 2 * Math.PI * (s - 17) / 8;
    o[a] = c[0] + rad * Math.cos(ang); o[b] = c[1] + rad * Math.sin(ang); o[k] = face;
    least = Math.min(least, rayHit(bvh, o, d, 1e-9));
  }
  return least;
}
/** A named planar face of a body square to coordinate axis k: its plane's coordinate and the side its outward normal faces (D148). */
function holeFace(brep: Brep, name: string, k: number, fail: (code: CadPartErrorCode, detail: string) => never): { at: number; side: 'min' | 'max' } {
  const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
  if (!face) return fail('REFERENCE', `no face ${name} on the target`);
  const g = faceGeometry(face);
  if (g.kind !== 'plane' || Math.abs(Math.abs(g.n[k]) - 1) > 1e-9) return fail('SELECTION', `${name} is not a flat face square to the hole's axis`);
  return { at: g.o[k], side: g.n[k] > 0 ? 'max' : 'min' };
}
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
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function admit(input: unknown): CadPartDocument {
  const fail = (detail: string, feature: string | null = null): never => { throw new CadPartError('FORMAT', feature, detail); };
  if (!isRecord(input) || input.format !== 'barocss-cad-part' || input.version !== 1 || input.units !== 'mm') fail('a barocss-cad-part version 1 document in mm is required');
  const doc = input as unknown as CadPartDocument;
  if (!isRecord(doc.parameters) || Object.keys(doc.parameters).length > CadPartLimits.parameters) fail('parameters must be an object of at most 256 entries');
  for (const [k, v] of Object.entries(doc.parameters)) if (!ID.test(k) || typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > CadPartLimits.length) fail(`parameter ${k} must be a finite number within ±10000`);
  if (!Array.isArray(doc.features) || doc.features.length > CadPartLimits.features) fail('features must be an array of at most 512 features');
  const seen = new Set<string>();
  for (const f of doc.features) {
    if (!isRecord(f) || typeof f.id !== 'string' || !ID.test(f.id)) fail('every feature needs an id (a letter, then letters, digits, _ or -)');
    if (seen.has(f.id)) fail('duplicate feature id', f.id);
    seen.add(f.id);
    const named = unitNamedField(f);
    if (named) fail(`${named.path} is not a field: a length, angle or force carries no unit in its name (R7.7b, D281) — it is ${named.field}`, f.id);
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
  if (what === 'positions') { for (let i = 0; i < a.length; i++) { const x = a[i]; if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length) return false; } }
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

/**
 * `facetExplodeTriangles`: the F0 planar-path limit for this evaluation (FACET_PREVIEW_TRIANGLES for a preview; default
 * FACET_EXPLODE_TRIANGLES). `profile` (O10, D228): the snapshot's `profile`, each feature's own wall time and kernel calls.
 */
export interface CadPartEvaluationOptions { readonly facetExplodeTriangles?: number; readonly profile?: boolean }
/**
 * A feature's kernel calls during its evaluation (`profile`), counted at the part model's own entry points: its Boolean
 * dispatcher (`booleans`), the planar Boolean (`planarBooleans`), tessellations it makes, sweeps (the stepped and the
 * curved path), shells and edge finishes (fillets and chamfers). Calls a machine element's own sub-evaluation makes count
 * for the feature that made it. A body's B-rep built lazily, after the evaluation, is not counted.
 */
export interface CadPartProfileCalls { booleans: number; planarBooleans: number; tessellations: number; sweeps: number; shells: number; finishes: number }
/** A feature's cost in one evaluation: `wallTime` in seconds (performance.now(), not CPU time); `calls`, as above. */
export interface CadPartFeatureProfile { readonly wallTime: number; readonly calls: Readonly<CadPartProfileCalls> }
export function evaluateCadPart(input: CadPartDocument, previous?: Cache, options: CadPartEvaluationOptions = {}): CadPartSnapshot {
  const was = facetLimit, wasProfiling = profiling;
  facetLimit = Math.min(FACET_EXPLODE_TRIANGLES, options.facetExplodeTriangles ?? FACET_EXPLODE_TRIANGLES);
  try { return evaluateWith(input, previous, options); }
  finally { facetLimit = was; profiling = wasProfiling; }
}
function evaluateWith(input: CadPartDocument, previous: Cache | undefined, options: CadPartEvaluationOptions): CadPartSnapshot {
  const doc = admit(input), cache: Cache = new Map(), results = new Map<string, Result>();
  const lookup = (key: string, deps: readonly Result[]) => previous?.get(key)?.find(e => e.deps.length === deps.length && e.deps.every((d, i) => d === deps[i]))?.result;
  const remember = (key: string, deps: readonly Result[], result: Result) => { const list = cache.get(key); if (list) list.push({ deps, result }); else cache.set(key, [{ deps, result }]); };
  const consumed = new Map<string, Set<number> | 'all'>(), features: { id: string; kind: CadPartFeature['kind']; dependencies: string[] }[] = [];
  const evaluated: string[] = [], reusedIds: string[] = [], profile: Record<string, CadPartFeatureProfile> | null = options.profile === true ? {} : null;
  // One frame plan per evaluation. A participant cannot escape a peer's refusal through the result cache.
  const beadPlans = new Map<string, ReturnType<typeof planEndpointBeads>>();
  const endpointBead: Tools['endpointBead'] = (f, byMember, frame) => {
    let plan = beadPlans.get(frame);
    if (!plan) { plan = planEndpointBeads(doc.features, byMember, frame, doc.parameters); beadPlans.set(frame, plan); }
    const entry = plan.get(f.id)!;
    if (entry instanceof CadPartError) throw entry;
    return entry;
  };
  for (const feature of doc.features) {
    const at = feature.id, deps: string[] = [];
    let started = 0;
    if (profile) { profiling = { booleans: 0, planarBooleans: 0, tessellations: 0, sweeps: 0, shells: 0, finishes: 0 }; started = performance.now(); }
    const fail = (code: CadPartErrorCode, detail: string): never => { throw new CadPartError(code, at, detail); };
    const dim = (v: CadPartDim | undefined, what: string, positive = false): number => {
      let x: unknown = v;
      if (isRecord(v)) { const name = (v as { parameter: unknown }).parameter; if (typeof name !== 'string' || !Object.hasOwn(doc.parameters, name)) fail('PARAMETER', `${what}: unknown parameter ${String(name)}`); x = doc.parameters[name as string]; }
      if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length) fail('PARAMETER', `${what} must be a finite length within ±10000 mm`);
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
      let part = k === undefined ? null : Number(k);
      const author = doc.features.find(f => f.id === id);
      if (part !== null && author?.kind === 'frame' && author.bends !== undefined && result!.kind === 'solid') part = result!.parts.findIndex(p => p.member?.frame?.member === part);

      if (part !== null && !(Number.isInteger(part) && part >= 0 && result!.kind === 'solid' && part < result!.parts.length)) fail('REFERENCE', `${what}: ${r} is not a part`);
      return { id, part, result: result! };
    };
    const solids = (r: unknown, what: string, allowEmpty = false): Part[] => {
      const { id, part, result } = ref(r, what);
      if (result.kind !== 'solid') fail('REFERENCE', `${what}: ${id} is a sketch, not a solid`);
      const parts = (result as Extract<Result, { kind: 'solid' }>).parts, picked = part === null ? parts : [parts[part]];
      if (picked.some(p => p.cylindricalWrap)) fail('CAPABILITY', 'a cylindrical wrap reference cannot be consumed by another feature yet; its reference mass and face tolerance apply only to the original result');
      if (!allowEmpty && picked.every(p => empty(p.solid))) fail('SELECTION', `${what}: ${r} is empty`);
      const used = consumed.get(id); if (part === null) consumed.set(id, 'all'); else if (used !== 'all') consumed.set(id, (used ?? new Set()).add(part));
      return picked.filter(p => !empty(p.solid));
    };
    const cutSource: Tools['cutSource'] = r => {
      const selected = ref(r, 'target'), author = doc.features.find(f => f.id === selected.id);
      if (author?.kind !== 'difference') return fail('REFERENCE', 'feature pattern target must be a direct difference result');
      if ('suppressed' in author && author.suppressed) return fail('REFERENCE', 'feature pattern target must be an unsuppressed difference');
      const used = consumed.get(selected.id);
      if (used === 'all' || used?.has(0)) return fail('REFERENCE', 'feature pattern target must still be active');
      if (selected.result.kind !== 'solid' || selected.result.parts.length !== 1 || empty(selected.result.parts[0].solid)) return fail('REFERENCE', 'feature pattern target must be one nonempty solid');
      // One Part may hold several B-rep bodies; count the existing representation without mutating the cached Part.
      const selectedBrep = brepOf({ solid: selected.result.parts[0].solid }, selected.id);
      if (selectedBrep.bodies.length !== 1 || selectedBrep.bodies[0].kind !== 'solid') return fail('REFERENCE', 'feature pattern target must be one nonempty solid');
      // Resolve the original operands as dependencies; never replace or truncate their history.
      const base = solids(author.target, 'difference target', true), tool = solids(author.tool, 'difference tool', true);
      if (base.length !== 1) return fail('REFERENCE', 'feature pattern difference must have one base solid');
      return { seed: solids(r, 'target')[0], tool };
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
        const tools = { dim, xy, xyz, integer, axisOf, solids, ref, cutSource, fail, at, endpointBead }, run = operation(f, tools);
        // (O19: stored names checked against what they named before the feature builds on them, D277.)
        const expect = expectOf(f, fail), compute = expect ? expectedThen(f, tools, expect, run) : run;
        const key = JSON.stringify([f.kind, resolvedDefinition(f, doc.parameters), ...(isEndpointBead(f) ? [endpointContext(doc.features, f.frame, doc.parameters)] : [])]), inputs = deps.map(d => results.get(d)!);
        const reused = lookup(key, inputs);
        result = reused ?? compute();
        (reused ? reusedIds : evaluated).push(at);
        remember(key, inputs, result);
      }
    } catch (cause) {
      if (cause instanceof CadPartError) throw cause;
      // Kernel refusals keep their own reason; anything else is reported, never swallowed.
      const known = cause instanceof BrepError || isPrismaticSolidError(cause) || isCurvedArrangementError(cause) || isExtrudedProfileError(cause) || isSolidMassError(cause);
      throw new CadPartError('GEOMETRY', at, known ? (cause as Error).message : `unexpected kernel failure: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    results.set(at, result); features.push({ id: at, kind: f.kind, dependencies: [...new Set(deps)] });
    if (profile) { profile[at] = Object.freeze({ wallTime: (performance.now() - started) / 1000, calls: Object.freeze(profiling!) }); profiling = null; }
  }
  // Outputs: parts not consumed by a later feature.
  const outputs: CadPartOutput[] = [];
  for (const feature of doc.features) {
    const result = results.get(feature.id)!, used = consumed.get(feature.id);
    if (result.kind !== 'solid' || used === 'all') continue;
    result.parts.forEach((part, k) => {
      if (used?.has(k) || empty(part.solid)) return;
      outputs.push(makeOutput(feature.kind === 'frame' && feature.bends !== undefined ? `${feature.id}/${part.member?.frame?.member ?? k}` : result.parts.length === 1 ? feature.id : `${feature.id}/${k}`, feature.id, part));
    });
  }
  const snapshot: CadPartSnapshot = {
    document: deepFreeze(doc), outputs: Object.freeze(outputs), features: deepFreeze(features), recomputation: deepFreeze({ evaluated, reused: reusedIds }),
    ...(profile ? { profile: Object.freeze(profile) } : undefined),
  };
  snapshotState.set(snapshot, { cache, ...(options ? { options } : {}) });
  return Object.freeze(snapshot);
}

/** A snapshot's evaluation cache and options, so a re-evaluation reuses what it can (R7.3b). */
const snapshotState = new WeakMap<CadPartSnapshot, { readonly cache: Cache | undefined; readonly options?: CadPartEvaluationOptions }>();
/** The output of a snapshot by id; refused, REFERENCE, when there is none. */
export function outputOf(snapshot: CadPartSnapshot, id: string): CadPartOutput {
  const o = snapshot.outputs.find(x => x.id === id); if (!o) throw new CadPartError('REFERENCE', null, `no output ${id}`); return o;
}
/**
 * A snapshot evaluated again: with new parameter values (`parameters`, each one the document declares), or another
 * document (`document`); every feature whose resolved definition is unchanged is reused.
 */
export function reevaluate(snapshot: CadPartSnapshot, change: { readonly parameters: Readonly<Record<string, number>> } | { readonly document: CadPartDocument }): CadPartSnapshot {
  const st = snapshotState.get(snapshot), doc = snapshot.document;
  if ('document' in change) return evaluateCadPart(change.document, st?.cache, st?.options);
  const parameters = { ...doc.parameters };
  for (const [k, v] of Object.entries(change.parameters)) { if (!Object.hasOwn(parameters, k)) throw new CadPartError('PARAMETER', null, `unknown parameter ${k}`); parameters[k] = v; }
  return evaluateCadPart({ ...doc, parameters }, st?.cache, st?.options);
}
/** A snapshot's document as saved text (a mesh's typed arrays written as plain arrays). */
export const saveCadPart = (snapshot: CadPartSnapshot): string => JSON.stringify(snapshot.document, (_, v) => isMeshArray(v) ? Array.from(v) : v) + '\n';

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
export function resolvedDefinition(f: unknown, parameters: Readonly<Record<string, number>>): unknown {
  if (isMeshArray(f)) return hashOfArray(f);
  if (typeof f === 'string' && f.length > LONG_TEXT) return textKey(f);
  if (Array.isArray(f)) return f.map(x => resolvedDefinition(x, parameters));
  if (isRecord(f)) { if (typeof f.parameter === 'string' && Object.keys(f).length === 1) return parameters[f.parameter]; return Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'id').map(([k, v]) => [k, resolvedDefinition(v, parameters)])); }
  return f;
}

export type Tools = {
  dim: (v: CadPartDim | undefined, what: string, positive?: boolean) => number; xy: (p: CadPartPoint2 | undefined, what: string) => XY; xyz: (p: CadPartPoint3 | undefined, what: string) => Point;
  integer: (v: unknown, what: string, lo: number, hi: number) => number; axisOf: (v: unknown) => CadPartAxis; solids: (r: unknown, what: string, allowEmpty?: boolean) => Part[];
  ref: (r: unknown, what: string) => { id: string; part: number | null; result: Result };
  cutSource: (r: unknown) => { seed: Part; tool: Part[] };
  fail: (code: CadPartErrorCode, detail: string) => never; at: string;
  endpointBead: (f: EndpointBead, byMember: ReadonlyMap<number, Part>, frame: string) => Result;
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
const exactVolume = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : brepMassProperties(s.brep, 1).volume;
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
  const local = (outer: ProfileSegmentInput[], from: number, h: number, tag: string, names?: { outer: string[]; bottom: string; top: string }) => affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: h, from: from, tag, ...(names ? { names } : {}) }) }, F, A);
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
  try { loops.forEach((outer, k) => { plate = boolean(plate, affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: T + 2, from: 0, tag: k ? `${at}.relief${k}` : trim > 0 ? `${at}.trim` : `${at}.relief0` }) }, G, top), 'difference', at); }); }
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
  const bend = { name: `${at}.bend`, inner: `${at}.bend.inner`, outer: `${at}.bend.outer`, radius: R, angle: th * 180 / Math.PI, axis: { origin: c, direction: w }, allowance: bendAllowance(th, R, T, K.kFactor), setback: outsideSetback(th, R, T), deduction: bendDeduction(th, R, T, K.kFactor), kFactor: K.kFactor, ...(K.use ? { table: K.use } : {}) };
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
  const T = sheet.thickness, brep = brepOf(part, 'target'), e = edgeNamed(brep, corner, fail);
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
  const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: z1 - z0, from: z0, tag: at }) }, [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], A);
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
/** A guide given in world coordinates, into a sketch frame's (z along its normal); left as given when it is not well formed (the loft refuses it). */
function guideInFrame(g: Record<string, unknown>, frame: Frame | undefined): Record<string, unknown> {
  const P = g.controlPoints;
  if (!frame || !Array.isArray(P) || !P.every(q => Array.isArray(q) && q.length === 3 && q.every(x => typeof x === 'number' && Number.isFinite(x)))) return g;
  const m = frame.m, o = frame.o;
  return { ...g, controlPoints: (P as number[][]).map(q => { const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; return [0, 1, 2].map(k => m[k] * d[0] + m[3 + k] * d[1] + m[6 + k] * d[2]); }) };
}
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
      if (draft === 0) return placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(regions ? { regions } : {}), ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), height: Math.abs(h), from: h > 0 ? from : from + h, tag: at }) }));
      if (regions?.length || holes?.length) fail('CAPABILITY', 'a drafted extrude takes one loop (no regions or holes) yet');
      // Built upwards from the sketch plane, then turned over for a downward extrude (the walls lean
      // away from the sketch plane either way).
      return placed(frame, () => {
        let brep: Brep;
        try { brep = draftedExtrusion({ profile: outer, z0: 0, z1: Math.abs(h), draft: draft as number, tag: at, id: at, ...(tags ? { sideTags: tags.outer } : {}) }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : 'PARAMETER', cause.message.replace(/^B-rep: drafted extrusion: /, '')); throw cause; }
        return one({ kind: 'brep', brep: transformBrep(brep!, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, h > 0 ? 1 : -1], offset: [0, 0, from] }) });
      });
    }
    case 'revolve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length) fail('CAPABILITY', 'revolve takes one outer loop with optional holes (no regions)');
      const ax = f.axis as { origin?: CadPartPoint2; direction?: unknown } | undefined;
      // The axis lies in the sketch plane: along its X or Y, or any direction [dx, dy] there.
      const free = Array.isArray(ax?.direction) && ax!.direction.length === 2 && ax!.direction.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.hypot(...(ax!.direction as number[])) > 1e-12;
      if (!isRecord(ax) || (ax.direction !== 'x' && ax.direction !== 'y' && !free)) fail('INPUT', 'axis must be { origin: [x, y], direction: "x" | "y" | [dx, dy] }');
      const origin = xy(ax!.origin, 'axis origin'), deg = f.angle === undefined ? 360 : f.angle as number;
      if (typeof deg !== 'number' || !(deg > 0 && deg <= 360)) fail('INPUT', 'angle must be in (0, 360]');
      const rtags = (sketch as Extract<Result, { kind: 'sketch' }>).tags;
      const input = { id: at, profile: (sketch as Extract<Result, { kind: 'sketch' }>).outer, axis: { origin, direction: (free ? ax!.direction : ax!.direction === 'x' ? [1, 0] : [0, 1]) as XY }, angle: deg, ...((sketch as Extract<Result, { kind: 'sketch' }>).holes?.length ? { holes: (sketch as Extract<Result, { kind: 'sketch' }>).holes } : {}), ...(rtags ? { sideTags: rtags.outer, holeTags: rtags.holes } : {}) };
      return placed((sketch as Extract<Result, { kind: 'sketch' }>).frame, () => ({ kind: 'solid', parts: [{ solid: { kind: 'brep', brep: revolveProfile(input) }, mass: (density: number) => revolveMassProperties(input, density), revolved: input }] }));
    }
    case 'union': case 'difference': case 'intersect': {
      // (An operand may be empty — an intersection that met nothing, as agents' trees do: the Booleans' algebra holds,
      // A ∪ ∅ = A, A − ∅ = A, ∅ − B = A ∩ ∅ = ∅, where it was refused. L4 fuzz, D190.)
      const target = solids(f.target, 'target', true), tool = solids(f.tool, 'tool', true), op = f.kind === 'intersect' ? 'intersection' : f.kind;
      return () => {
        if (!tool.length || !target.length) {
          const left = target.length ? target : tool;
          if (op === 'intersection' || !left.length || (op === 'difference' && !target.length)) return many([]);
          if (op === 'union') return one(left.slice(1).reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), left[0].solid));
          return { kind: 'solid', parts: target };
        }
        // (The tool's parts joined from the first over the rest: over all of them, every such feature began with
        // tool[0] ∪ tool[0], a Boolean of a body with itself, D260/D268.)
        const joined = tool.slice(1).reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), tool[0].solid);
        // Unions merge every target part into one; difference and intersection act on each part.
        if (op === 'union') return one(target.reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), joined));
        // (A sheet's holes and cuts: still the sheet, its rules carried on; R12.2, D117.)
        const out = many(target.map(p => boolean(p.solid, joined, op, at)));
        return op === 'difference' ? carrySheet(out, target) : out;
      };
    }
    case 'rib': {
      const target = solids(f.target, 'target'), min = xyz(f.min as CadPartPoint3, 'min'), max = xyz(f.max as CadPartPoint3, 'max');
      if (target.length !== 1) fail('REFERENCE', 'rib target must be one nonempty solid');
      if (!min.every((v, k) => v < max[k])) fail('PARAMETER', 'rib min must be below max on every axis');
      const source = target[0].solid, body = brepOf({ solid: source }, at);
      if (body.bodies.length !== 1 || body.bodies[0].kind !== 'solid') fail('REFERENCE', 'rib target must be one nonempty solid');
      // Stay in the existing straight-sided prismatic Boolean and volume path; no curved quadrature admission.
      if (source.kind !== 'upright' || !lineOnly(source.solid)) fail('CAPABILITY', 'rib requires a straight-sided upright prismatic target');
      return () => {
        const rib = boxSolid(min, max, at);
        const overlap = boolean(source, rib, 'intersection', at);
        const overlapVolume = empty(overlap) ? 0 : exactVolume(overlap);
        if (!(Number.isFinite(overlapVolume) && overlapVolume > 0)) fail('GEOMETRY', 'rib must have positive volume overlap with its target');
        const added = boolean(rib, source, 'difference', at);
        const addedVolume = empty(added) ? 0 : exactVolume(added);
        if (!(Number.isFinite(addedVolume) && addedVolume > 0)) fail('GEOMETRY', 'rib must add positive volume outside its target');
        const joined = boolean(source, rib, 'union', at), joinedBrep = brepOf({ solid: joined }, at);
        const volume = empty(joined) ? 0 : exactVolume(joined);
        if (joinedBrep.bodies.length !== 1 || joinedBrep.bodies[0].kind !== 'solid' || !(Number.isFinite(volume) && volume > 0)) fail('GEOMETRY', 'rib union must be one nonempty solid');
        return one(joined);
      };
    }
    case 'cylindrical-wrap': {
      const target = solids(f.target, 'target'), selected = f.faces, rectangle = f.rectangle as { u?: unknown; v?: unknown } | undefined;
      if (target.length !== 1) fail('REFERENCE', 'cylindrical wrap target must be one nonempty solid');
      if (!Array.isArray(selected) || selected.length !== 1 || typeof selected[0] !== 'string' || !selected[0] || selected[0].includes('+')) fail('INPUT', 'cylindrical wrap faces must contain one exact native wall name');
      if (!rectangle || typeof rectangle !== 'object' || Array.isArray(rectangle) || Object.keys(rectangle).some(k => k !== 'u' && k !== 'v')) fail('INPUT', 'cylindrical wrap rectangle must contain original native u and v intervals');
      const u = rectangle!.u, v = rectangle!.v;
      if (!Array.isArray(u) || !Array.isArray(v) || u.length !== 2 || v.length !== 2 || ![...u, ...v].every(x => typeof x === 'number' && Number.isFinite(x))) fail('INPUT', 'cylindrical wrap intervals must each contain two finite Numbers');
      const U = u as [number, number], V = v as [number, number];
      if (!(0 < U[0] && U[0] < U[1] && U[1] < 0.5 && 0 < V[0] && V[0] < V[1] && V[1] < 1)) fail('PARAMETER', 'cylindrical wrap needs 0 < u0 < u1 < 0.5 and 0 < v0 < v1 < 1');
      const height = dim(f.height as CadPartDim, 'height', true), source = target[0], brep = brepOf(source, at);
      if (!brep.faces.some(face => face.name === selected[0])) fail('REFERENCE', 'cylindrical wrap selected wall name is missing from its target');
      const owned = { solid: source.solid, brep }, bounds = { u: [...U] as [number, number], v: [...V] as [number, number] }, face = selected[0] as string;
      return () => ({ kind: 'solid', parts: [cylindricalWrapFeature(owned, face, bounds, height, at, fail)] });
    }
    case 'profile-relief': {
      const target = solids(f.target, 'target'), names = f.sketches as unknown, selected = f.faces as unknown, depth = dim(f.depth as CadPartDim, 'depth', true), mode = f.mode;
      if (mode !== 'emboss' && mode !== 'engrave') fail('INPUT', 'profile relief mode must be emboss or engrave');
      if (!Array.isArray(selected) || selected.length !== 1 || typeof selected[0] !== 'string' || !selected[0] || selected[0].includes('+')) fail('INPUT', 'profile relief faces must contain exactly one exact cap face name');
      const face = (selected as string[])[0];
      if (f.clearance !== undefined && (typeof f.clearance !== 'number' || !Number.isFinite(f.clearance) || f.clearance < 0 || f.clearance > CadPartLimits.length)) fail('INPUT', 'profile relief clearance must be a finite nonnegative native length');
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges) fail('INPUT', 'profile relief needs 1..64 distinct component sketch references');
      if (target.length !== 1) fail('REFERENCE', 'profile relief target must be one nonempty solid');
      const source = target[0].solid;
      if (source.kind !== 'upright' || !lineOnly(source.solid) || source.solid.slabs.length !== 1) fail('CAPABILITY', 'profile relief requires one line-only upright slab');
      const seen = new Set<string>(), sketches: ReliefSketch[] = [];
      for (const name of names as unknown[]) {
        if (typeof name !== 'string' || !name || seen.has(name)) fail('INPUT', 'profile relief needs distinct component sketch names');
        seen.add(name as string);
        const sketch = ref(name, 'component sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', 'profile relief component references must name sketches');
        sketches.push(sketch as Extract<Result, { kind: 'sketch' }>);
      }
      return () => one({ kind: 'upright', solid: profileRelief((source as Extract<Solid, { kind: 'upright' }>).solid, brepOf(target[0], at), face as string, sketches, depth, mode as 'emboss' | 'engrave', f.clearance as number | undefined, at, fail) });
    }
    case 'rectangular-relief': {
      const target = solids(f.target, 'target'), min = xy(f.min as CadPartPoint2, 'min'), max = xy(f.max as CadPartPoint2, 'max'), depth = dim(f.depth as CadPartDim, 'depth', true), mode = f.mode;
      if (mode !== 'emboss' && mode !== 'engrave') fail('INPUT', 'rectangular relief mode must be emboss or engrave');
      if (!min.every((v, k) => v < max[k])) fail('PARAMETER', 'rectangular relief min must be below max on both axes');
      if (target.length !== 1) fail('REFERENCE', 'rectangular relief target must be one nonempty solid');
      const source = target[0].solid, body = brepOf({ solid: source }, at);
      if (body.bodies.length !== 1 || body.bodies[0].kind !== 'solid') fail('REFERENCE', 'rectangular relief target must be one nonempty solid');
      const prism = source.kind === 'upright' && lineOnly(source.solid) && source.solid.slabs.length === 1 ? source.solid : fail('CAPABILITY', 'rectangular relief requires one straight-sided upright slab with a planar top');
      const slab = prism.slabs[0];
      if (!(depth < slab.z1 - slab.z0)) fail('PARAMETER', 'rectangular relief depth must be below the target height');
      const top = dim(slab.z1 + depth, 'relief tool top');
      return () => {
        // Full-height support tests the actual footprint, including holes and concavities, not its AABB.
        const support = boxSolid([min[0], min[1], slab.z0], [max[0], max[1], slab.z1], `${at}.support`);
        if (!empty(boolean(support, source, 'difference', at))) fail('GEOMETRY', 'rectangular relief footprint must be fully supported by the target top');
        // Existing material seats the raised rectangle; the external portion adds exactly the authored depth.
        const tool = boxSolid([min[0], min[1], slab.z1 - depth], [max[0], max[1], top], at);
        const overlap = boolean(source, tool, 'intersection', at), removed = empty(overlap) ? 0 : exactVolume(overlap);
        if (!(Number.isFinite(removed) && removed > 0)) fail('GEOMETRY', 'rectangular relief must overlap positive target volume');
        if (mode === 'emboss') {
          const extra = boolean(tool, source, 'difference', at), added = empty(extra) ? 0 : exactVolume(extra);
          if (!(Number.isFinite(added) && added > 0)) fail('GEOMETRY', 'rectangular relief must add positive volume');
        }
        const result = boolean(source, tool, mode === 'emboss' ? 'union' : 'difference', at), resultBrep = brepOf({ solid: result }, at);
        const volume = empty(result) ? 0 : exactVolume(result);
        if (resultBrep.bodies.length !== 1 || resultBrep.bodies[0].kind !== 'solid' || !(Number.isFinite(volume) && volume > 0)) fail('GEOMETRY', 'rectangular relief result must be one nonempty solid');
        const sourceVolume = exactVolume(source), change = mode === 'emboss' ? volume - sourceVolume : sourceVolume - volume;
        if (!(Number.isFinite(change) && change > 0)) fail('GEOMETRY', 'rectangular relief must change positive target volume');
        return one(result);
      };
    }
    case 'full-round': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, along = f.along as unknown;
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges || !names.every(x => typeof x === 'string') || new Set(names).size !== names.length) fail('INPUT', 'faces must list 1 to 64 distinct face names');
      if (along !== undefined && along !== 'x' && along !== 'y') fail('INPUT', 'along must be x or y');
      if (target.length !== 1) fail('REFERENCE', 'full round one part at a time (name it as id/k)');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'full round on mesh faces is not supported yet');
        const brep = brepOf(target[0], at), edges = new Map(brep.edges.map(e => [e.id, e])), points = new Map(brep.vertices.map(v => [v.id, v.point])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
        // Each face's rectangle, read from the body as it was (before any round): its span along and across, and its height.
        const rounds = (names as string[]).map(name => {
          const face = brep.faces.find(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!face) return fail('REFERENCE', `no face ${name} on the target`);
          const g = faceGeometry(face);
          if (g.kind !== 'plane' || Math.abs(g.n[2] - 1) > 1e-9) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} is not a planar face facing +Z`);
          if (face.loops.length !== 1) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} has holes`);
          const loop = brep.loops.find(l => l.id === face.loops[0])!;
          const ring = loop.coedges.map(id => { const c = coedges.get(id)!, e = edges.get(c.edge)!; if (e.curve.degree !== 1 || e.curve.controlPoints.length !== 2) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} has a curved edge`); return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!; });
          const xs = ring.map(q => q[0]), ys = ring.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), z = ring[0][2];
          const tol = 1e-9 * Math.max(1, ...ring.flat().map(Math.abs));
          const corner = (q: Point) => (Math.abs(q[0] - x0) <= tol || Math.abs(q[0] - x1) <= tol) && (Math.abs(q[1] - y0) <= tol || Math.abs(q[1] - y1) <= tol);
          if (ring.length !== 4 || !ring.every(corner) || new Set(ring.map(q => `${Math.abs(q[0] - x0) <= tol}${Math.abs(q[1] - y0) <= tol}`)).size !== 4) fail('CAPABILITY', `[FULL_ROUND_FACE] ${name} is not an axis-aligned rectangle`);
          const dir = along ?? (x1 - x0 >= y1 - y0 ? 'x' : 'y');
          const [l0, l1, a0, a1] = dir === 'x' ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
          return { name, dir, l0, l1, a0, a1, z, r: (a1 - a0) / 2 };
        });
        let out = target[0].solid;
        rounds.forEach((q, k) => {
          // The corner material above the round, in (across, height), laid along the face: up one side, over the top,
          // down the other and back over the half circle. X, Y, Z: the local axes' images (determinant +1).
          const across = q.dir === 'x' ? [q.a0, q.a1] : [-q.a1, -q.a0], base = q.z - q.r, mid = (across[0] + across[1]) / 2;
          const outer: ProfileSegmentInput[] = [{ kind: 'line', start: [across[0], base] }, { kind: 'line', start: [across[0], q.z + q.r] }, { kind: 'line', start: [across[1], q.z + q.r] }, { kind: 'arc', start: [across[1], base], center: [mid, base], direction: 'ccw' }];
          const m: BrepAffine['matrix'] = q.dir === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [-1, 0, 0, 0, 0, 1, 0, 1, 0];
          const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: q.l1 - q.l0, from: 0, tag: `${at}.round${k}` }) }, m, q.dir === 'x' ? [q.l0, 0, 0] : [0, q.l0, 0], n => n === `${at}.round${k}.side3` ? `${at}.round${k}` : n);
          // Open sides: no material just outside either side, a radius deep, from the round's foot to the top (a plate
          // under the face, or a neighbour within the radius, would be grooved by the cut).
          for (const [s0, s1] of [[q.a0 - q.r, q.a0], [q.a1, q.a1 + q.r]]) {
            const strip = q.dir === 'x' ? boxSolid([q.l0, s0, base], [q.l1, s1, q.z], `${at}.clear${k}`) : boxSolid([s0, q.l0, base], [s1, q.l1, q.z], `${at}.clear${k}`);
            const beside = boolean(out, strip, 'intersection', at);
            if (!empty(beside) && exactVolume(beside) > 1e-9 * exactVolume(strip)) fail('GEOMETRY', `[FULL_ROUND_NOT_CLEAR] the full round of ${q.name} needs its sides open ${+q.r.toPrecision(9)} mm down from it: material stands beside it`);
          }
          const before = exactVolume(out), next = boolean(out, tool, 'difference', at), pieces = next.kind === 'brep' ? next.brep.bodies.length : 1;
          const took = before - (empty(next) ? 0 : exactVolume(next)), want = (q.l1 - q.l0) * (q.a1 - q.a0) ** 2 * (4 - Math.PI) / 8;
          if (pieces !== 1 || Math.abs(took - want) > 1e-8 * Math.max(want, before)) fail('GEOMETRY', `[FULL_ROUND_NOT_CLEAR] the full round of ${q.name} would take ${+took.toPrecision(9)} mm³, not the ${+want.toPrecision(9)} its top holds: its sides must drop at least ${+q.r.toPrecision(9)} mm and nothing may stand above it`);
          out = next;
        });
        return one(out);
      };
    }
    case 'face-thread': {
      const target = solids(f.target, 'target'), name = f.face, p = dim(f.pitch as CadPartDim, 'pitch', true);
      const nominal = f.diameter === undefined ? null : dim(f.diameter as CadPartDim, 'diameter', true), want = f.length === undefined ? null : dim(f.length as CadPartDim, 'length', true);
      const end = f.end ?? '+', relief = f.relief === undefined ? p : dim(f.relief as CadPartDim, 'relief'), clearance = f.clearance === undefined ? null : dim(f.clearance as CadPartDim, 'clearance');
      if (typeof name !== 'string' || !name) fail('INPUT', 'face must name a cylindrical face');
      if (end !== '+' && end !== '-') fail('INPUT', "end must be '+' or '-'");
      const hand = f.hand ?? 'right';
      if (hand !== 'right' && hand !== 'left') fail('INPUT', 'hand must be right or left');
      if (!(relief >= 0)) fail('INPUT', 'relief must not be negative');
      if (clearance !== null && !(clearance >= 0 && clearance < p / 4)) fail('INPUT', 'clearance must be at least 0 and below a quarter of the pitch');
      if (target.length !== 1) fail('REFERENCE', 'thread one part at a time (name it as id/k)');
      return () => {
        const source = target[0].solid;
        if (source.kind === 'brep' && source.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'a thread on mesh faces is not supported yet');
        // The face by its name: a whole cylinder is often kept as its halves (`#1`, `#2`), one surface between them.
        const brep = brepOf(target[0], at), group = brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name);
        if (!group.length) return fail('REFERENCE', `no face ${name} on the target`);
        const g = faceGeometry(group[0]);
        if (g.kind !== 'cylinder') return fail('CAPABILITY', `[FACE_THREAD_FACE] ${name} is not a cylindrical face`);
        for (const x of group.slice(1)) {
          const h = faceGeometry(x);
          if (h.kind !== 'cylinder' || Math.abs(h.r - g.r) > 1e-9 * Math.max(1, g.r) || Math.abs(Math.abs(dot(unit(h.a), unit(g.a))) - 1) > 1e-12 || len(cross(sub(h.c, g.c), unit(g.a))) > 1e-9 * Math.max(1, g.r) || h.out !== g.out) fail('CAPABILITY', `[FACE_THREAD_FACE] the faces named ${name} are not one cylinder`);
        }
        const inGroup = new Set(group.map(x => x.id)), loops = new Set(group.flatMap(x => x.loops));
        // The axis, its largest component positive; t: the distance along it from the face's axis point.
        const k0 = [0, 1, 2].reduce((m, k) => Math.abs(g.a[k]) > Math.abs(g.a[m]) ? k : m, 0), a = unit(g.a[k0] < 0 ? scale(g.a, -1) : g.a), R = g.r;
        const points = new Map(brep.vertices.map(v => [v.id, v.point])), edges = new Map(brep.edges.map(e => [e.id, e])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
        const own = brep.coedges.filter(c => loops.has(c.loop)), uses = new Map<string, number>();
        for (const c of own) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
        const tOf = (q: Point) => dot(sub(q, g.c), a), radial = (q: Point) => len(sub(sub(q, g.c), scale(a, tOf(q))));
        const ts = own.flatMap(c => edges.get(c.edge)!.vertices.map(v => tOf(points.get(v)!))), t0 = Math.min(...ts), t1 = Math.max(...ts), L = t1 - t0, tol = 1e-7 * Math.max(1, R, L);
        // Whole round: every edge it does not share with itself (a seam) is a circle in one of its end planes.
        const boundary = [...uses].filter(([, n]) => n === 1).map(([id]) => edges.get(id)!);
        const atEnd = (t: number) => Math.abs(t - t0) <= tol ? 0 : Math.abs(t - t1) <= tol ? 1 : -1;
        if (!(L > tol) || boundary.some(e => { const [u, v] = e.vertices.map(id => atEnd(tOf(points.get(id)!))); return u < 0 || u !== v; })) fail('CAPABILITY', `[FACE_THREAD_FACE] ${name} is not a whole round face between two end circles`);
        // Each end: what lies beyond it, from the faces met there — outward (a shoulder, the plate a hole opens in),
        // or not; flat: a plane square to the axis.
        const beyond = [0, 1].map(side => {
          const met = new Set(boundary.filter(e => atEnd(tOf(points.get(e.vertices[0])!)) === side).flatMap(e => brep.coedges.filter(c => c.edge === e.id).map(c => loopFace.get(c.loop)!)).filter(id => !inGroup.has(id)));
          const faces = brep.faces.filter(x => met.has(x.id)), corners = faces.flatMap(x => faceVertices(brep, x.id));
          const outward = corners.some(q => radial(q) > R + tol), flat = faces.length > 0 && faces.every(x => { const h = faceGeometry(x); return h.kind === 'plane' && Math.abs(Math.abs(dot(h.n, a)) - 1) <= 1e-9; });
          return { outward, flat };
        });
        const span = want ?? L;
        if (span > L + tol) fail('PARAMETER', `[FACE_THREAD_SIZE] the thread's length ${+span.toPrecision(9)} is longer than the face (${+L.toPrecision(9)})`);
        const r0 = end === '+' ? t1 - span : t0, r1 = end === '+' ? t1 : t0 + span;
        // A range end on a face end takes that end's kind; one inside the face meets the face going on (outward-free, not flat).
        const kindAt = (t: number) => { const side = atEnd(t); return side < 0 ? { outward: false, flat: false } : beyond[side]; };
        const ends = [kindAt(r0), kindAt(r1)], external = g.out === 1;
        // Local frame: Z along the axis from its point g.c (identity for +Z, to keep upright tools upright).
        const e1 = Math.abs(a[2] - 1) <= 1e-15 ? [1, 0, 0] as Point : unit(cross(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], a)), e2 = cross(a, e1);
        const m: BrepAffine['matrix'] = [e1[0], e2[0], a[0], e1[1], e2[1], a[1], e1[2], e2[2], a[2]], o = [g.c[0], g.c[1], g.c[2]];
        const local = (s: Solid) => affine(s, m, o);
        const ring = (outer: number, inner: number | null, lo: number, hi: number, tag: string) => local({ kind: 'upright', solid: prismaticFromProfile({ outer: [{ kind: 'arc', start: [outer, 0], center: [0, 0], direction: 'ccw' }], ...(inner !== null ? { holes: [[{ kind: 'arc', start: [inner, 0], center: [0, 0], direction: 'ccw' }]] } : {}), height: hi - lo, from: lo, tag }) });
        const rod = (d: number, lo: number, hi: number, clear = 0) => {
          if (!(hi - lo >= p - tol)) fail('PARAMETER', `[FACE_THREAD_SIZE] the thread would be ${+(hi - lo).toPrecision(9)} mm long: at least a pitch (${p}) is needed`);
          let made: Brep;
          try { made = threadSolid({ id: at, diameter: d, pitch: p, center: [0, 0], seat: hi, length: hi - lo, form: 'helical', clearance: clear }); }
          catch (cause) { if (cause instanceof RangeError || isMeshBrepError(cause)) fail('PARAMETER', cause.message); throw cause; }
          // (A left-hand thread: the right-hand rod mirrored through a plane holding its axis.)
          const s = local(hand === 'left' ? affine({ kind: 'brep', brep: made! }, [-1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]) : { kind: 'brep', brep: made! });
          return { solid: s, area: exactVolume(s) / (hi - lo) };
        };
        const close = (got: number, expected: number, scaleOf: number) => Math.abs(got - expected) <= 1e-7 * Math.max(expected, scaleOf);
        const before = exactVolume(source);
        if (!external) {
          if (nominal === null) fail('INPUT', 'a thread in a hole needs its nominal diameter: the hole is its tap drill');
          const d = nominal!;
          if (!(d / 2 > R + tol)) fail('PARAMETER', `[FACE_THREAD_SIZE] an M${d} thread is no wider than the ${+(2 * R).toPrecision(9)} mm hole`);
          // Fill the hole over the length (a plug a pitch wider, in the wall), then cut the thread.
          const filled = boolean(source, ring(d / 2 + p, null, r0, r1, `${at}.plug`), 'union', at), added = exactVolume(filled) - before;
          if (!close(added, Math.PI * R * R * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the wall round ${name} is thinner than the thread needs (${+(d / 2 + p - R).toPrecision(9)} mm past the hole)`);
          const tap = rod(d, r0 - (ends[0].outward ? p : 0), r1 + (ends[1].outward ? p : 0), clearance ?? 0.04);
          const out = boolean(filled, tap.solid, 'difference', at), taken = exactVolume(filled) - exactVolume(out), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
          if (pieces !== 1 || !close(taken, tap.area * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the thread in ${name} would take ${+taken.toPrecision(9)} mm³, not the ${+(tap.area * span).toPrecision(9)} its length holds: something stands past the hole's ends`);
          return one(out);
        }
        if (clearance !== null) fail('INPUT', `the clearance goes in the hole: a shaft's thread (${name}) is the bolt's own`);
        if (nominal !== null && Math.abs(nominal - 2 * R) > tol) fail('PARAMETER', `[FACE_THREAD_SIZE] a thread on a ${+(2 * R).toPrecision(9)} mm shaft is M${+(2 * R).toPrecision(9)}, not M${nominal}`);
        const core = R - 0.8 * p;
        if (!(core > 0)) fail('PARAMETER', `[FACE_THREAD_SIZE] a ${p} mm pitch is too coarse for a ${+(2 * R).toPrecision(9)} mm shaft`);
        // A flat free end takes the thread to it; any other end leaves a relief groove at the core.
        const free = ends.map(e => !e.outward && e.flat), w = free.map(x => x ? 0 : relief);
        if (w.some((x, i) => !free[i] && !(x > 0))) fail('CAPABILITY', `[FACE_THREAD_RELIEF] the thread on ${name} ends at a shoulder or inside the face: it needs a relief groove (relief > 0)`);
        const necked = boolean(source, ring(R + p, core, r0 - (free[0] ? p : 0), r1 + (free[1] ? p : 0), `${at}.neck`), 'difference', at), cut = before - exactVolume(necked);
        if (!close(cut, Math.PI * (R * R - core * core) * span, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] material stands round ${name} within ${+p.toPrecision(9)} mm of it: the thread has no room`);
        const thread = rod(2 * R, r0 + w[0], r1 - w[1]), length = r1 - w[1] - r0 - w[0];
        const out = boolean(necked, thread.solid, 'union', at), joined = exactVolume(out) - exactVolume(necked), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
        if (pieces !== 1 || !close(joined, (thread.area - Math.PI * core * core) * length, before)) fail('GEOMETRY', `[FACE_THREAD_NOT_CLEAR] the thread on ${name} did not join the shaft's core as one body`);
        return one(out);
      };
    }
    case 'face-fillet': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, r = dim(f.radius as CadPartDim, 'radius', true);
      if (!Array.isArray(names) || names.length !== 2 || !names.every(x => typeof x === 'string' && x) || names[0] === names[1]) fail('INPUT', 'faces must name two different faces');
      if (target.length !== 1) fail('REFERENCE', 'face fillet one part at a time (name it as id/k)');
      // The rounds built from a section (extruded or revolved); a pair those do not take goes to the rolling ball: faces
      // that meet, by every edge they share (F0); faces apart, with their corner restored first (F1).
      const built = (): Result => {
        const source = target[0].solid;
        if (source.kind === 'brep' && source.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'a face fillet on mesh faces is not supported yet');
        const brep = brepOf(target[0], at), points = new Map(brep.vertices.map(v => [v.id, v.point])), edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
        // A plane and a cylinder square to it: the round revolved about the cylinder's axis.
        const groups = (names as string[]).map(name => brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name));
        const kinds = groups.map(g => g.length ? faceGeometry(g[0]).kind : null);
        const sides = (names as string[]).map((name, k) => ({ name, faces: groups[k] }));
        if (groups.every(g => g.length) && !kinds.every(x => x === 'plane')) {
          // A plane across a cylinder's axis, or a cone: the round revolved; a plane along the axis, or two parallel
          // cylinders: the round extruded.
          const k = kinds.indexOf('plane'), c = kinds.indexOf('cylinder'), cyl = c >= 0 ? faceGeometry(groups[c][0]) : null;
          const across = k >= 0 && cyl?.kind === 'cylinder' && Math.abs(dot(unit((faceGeometry(groups[k][0]) as { n: Point }).n), unit(cyl.a))) > 0.5;
          if (kinds.includes('other') || across) return one(revolvedFillet(brep, source, sides[0], sides[1], r, at, fail));
          if (kinds.every(x => x === 'cylinder' || x === 'plane')) return one(parallelFillet(brep, source, sides[0], sides[1], r, at, fail));
        }
        // Each face by its name (pieces `#k` of one plane together): its plane and its loops as rings of points.
        const planes = (names as string[]).map(name => {
          const group = brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name);
          if (!group.length) return fail('REFERENCE', `no face ${name} on the target`);
          const g = faceGeometry(group[0]);
          if (g.kind !== 'plane') return fail('CAPABILITY', `[FACE_FILLET_FACE] ${name} is not a planar face (a face fillet takes planes and cylinders: two planes, a plane and a cylinder across or along its axis, or two parallel cylinders)`);
          const rings = group.flatMap(x => x.loops.map(id => brep.loops.find(l => l.id === id)!.coedges.map(cid => {
            const c = coedges.get(cid)!, e = edges.get(c.edge)!;
            if (e.curve.degree !== 1 || e.curve.controlPoints.length !== 2) fail('CAPABILITY', `[FACE_FILLET_FACE] ${name} has a curved edge`);
            return points.get(c.sense === 'forward' ? e.vertices[0] : e.vertices[1])!;
          })));
          for (const x of group.slice(1)) { const h = faceGeometry(x); if (h.kind !== 'plane' || len(sub(h.n, g.n)) > 1e-9 || Math.abs(dot(sub(h.o, g.o), g.n)) > 1e-9 * Math.max(1, len(g.o))) fail('CAPABILITY', `[FACE_FILLET_FACE] the faces named ${name} are not one plane`); }
          return { name, n: unit(g.n), d: dot(unit(g.n), g.o), rings };
        });
        const [A, B] = planes, u = cross(A.n, B.n), uu = dot(u, u);
        if (!(Math.sqrt(uu) > 1e-9)) fail('CAPABILITY', `[FACE_FILLET_PARALLEL] ${A.name} and ${B.name} are parallel: their planes do not meet`);
        // The planes' meeting line: point C, direction t.
        const t = unit(u), C = scale(add(scale(cross(B.n, u), A.d), scale(cross(u, A.n), B.d)), 1 / uu);
        const all = [...A.rings.flat(), ...B.rings.flat()], size = Math.max(1, r, ...all.map(q => len(sub(q, C)))), tol = 1e-9 * size;
        // Each face's side of the line, in its plane and square to the line; the face must lie wholly on it.
        const toward = (S: typeof A) => {
          const q = S.rings.flat(), mid = scale(q.reduce((m, x) => add(m, x), [0, 0, 0] as Point), 1 / q.length), w = sub(mid, C), dir = unit(sub(w, scale(t, dot(w, t))));
          if (q.some(x => dot(sub(x, C), dir) < -tol)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${S.name} crosses the line where its plane meets the other's`);
          return dir;
        };
        const dA = toward(A), dB = toward(B), cos = Math.max(-1, Math.min(1, dot(dA, dB))), theta = Math.acos(cos);
        if (!(theta > 1e-6 && theta < Math.PI - 1e-6)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A.name} and ${B.name} lie in one plane`);
        // Inside corner: each face's outward normal points to the other's side.
        const sA = dot(A.n, dB), sB = dot(B.n, dA);
        if (!(Math.abs(sA) > 1e-9 && Math.sign(sA) === Math.sign(sB))) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A.name} and ${B.name} face neither into nor away from their corner`);
        const inside = sA > 0, a = r / Math.tan(theta / 2);
        // Over the length both faces run beside the line.
        const along = (S: typeof A) => S.rings.flat().map(x => dot(sub(x, C), t)), ta = along(A), tb = along(B), lo = Math.max(Math.min(...ta), Math.min(...tb)), hi = Math.min(Math.max(...ta), Math.max(...tb));
        if (!(hi - lo > tol)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A.name} and ${B.name} do not run side by side along their corner`);
        // Tangency: each face holds its tangent line (a from the corner) over [lo, hi].
        for (const [S, d] of [[A, dA], [B, dB]] as const) {
          const p2 = (x: Point): [number, number] => [dot(sub(x, C), t), dot(sub(x, C), d)];
          if (!lineInFace(S.rings.map(ring => ring.map(p2)), a, lo, hi, tol)) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round would not meet ${S.name} tangentially: the face stops before ${+a.toPrecision(9)} mm from the corner`);
        }
        // The round's section Q (corner, tangent point on A, the near arc, tangent point on B), laid along the line.
        const X = dA, Y = unit(sub(dB, scale(dA, cos))), Z = cross(X, Y), flip = dot(Z, t) < 0, z0 = flip ? -hi : lo, z1 = flip ? -lo : hi;
        const outer: ProfileSegmentInput[] = [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [a, 0], center: [a, r], direction: 'cw' }, { kind: 'line', start: [a * cos, a * Math.sin(theta)] }];
        const m: BrepAffine['matrix'] = [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
        const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: z1 - z0, from: z0, tag: at }) }, m, C, n => n === `${at}.side1` ? `${at}.round` : n);
        const area = a * r - r * r * (Math.PI - theta) / 2, held = boolean(source, tool, 'intersection', at), was = empty(held) ? 0 : exactVolume(held), before = exactVolume(source), L = hi - lo;
        const out = boolean(source, tool, inside ? 'union' : 'difference', at), change = exactVolume(out) - before, pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
        const want = inside ? area * L - was : -was, close = Math.abs(change - want) <= 1e-7 * Math.max(before, area * L);
        if (pieces !== 1 || !close || !(Math.abs(want) > 1e-9 * area * L)) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] the round between ${A.name} and ${B.name} would ${inside ? 'add' : 'take'} ${+Math.abs(change).toPrecision(9)} mm³ (${+Math.abs(want).toPrecision(9)} expected)${pieces !== 1 ? ` and leave ${pieces} bodies` : ''}`);
        return one(out);
      };
      return () => {
        try { return built(); }
        catch (cause) {
          // (Only a pair of kinds the sections do not take: parallel faces never meet, the ball cannot help them.)
          if (!(cause instanceof CadPartError) || cause.details.category !== 'CAPABILITY' || !/\[FACE_FILLET_FACE\]/.test(cause.message)) throw cause;
          let part: Part = target[0], shared = sharedEdges(brepOf(part, at), names as string[]);
          if (!shared.length) {
            // F1: apart — restore the corner between them (what lies there removed or filled), then the same.
            const restored = restoreCorner(brepOf(part, at), part.solid, (names as string[]).map(name => ({ name, faces: brepOf(part, at).faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name) })), r, at, fail);
            if (!restored) {
              // A bounded convex polynomial corner can replace its old strip directly. Analytic restores keep priority.
              try {
                const made = polynomialFaceFillet(brepOf(part, at), names as [string, string], r, at);
                if (made) return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, fillet: [made.report] }] };
              } catch (error) {
                const refusal = error instanceof BrepError ? /^B-rep: (SELECTION|CAPABILITY|PARAMETER): (.*)$/s.exec(error.message) : null;
                if (refusal) fail(refusal[1] as CadPartErrorCode, refusal[2]);
                throw error;
              }
              throw cause;
            }
            part = { solid: restored }; shared = sharedEdges(brepOf(part, at), names as string[]);
            if (!shared.length) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] ${(names as string[]).join(' and ')} do not meet once the corner between them is restored`);
          }
          const reports: FilletReport[] = [], solid = finishEdges(part, shared, r, 'fillet', at, fail, reports);
          return { kind: 'solid', parts: [{ solid, ...(reports.length ? { fillet: reports } : {}) }] };
        }
      };
    }
    case 'hole': {
      const target = solids(f.target, 'target'), c = xy(f.center as CadPartPoint2, 'center'), r = dim(f.radius as CadPartDim, 'radius', true);
      const depth = f.depth === undefined ? null : dim(f.depth as CadPartDim, 'depth', true), axis = f.axis === undefined ? 'z' : axisOf(f.axis);
      const named = f.face === undefined ? null : f.face;
      if (named !== null && (typeof named !== 'string' || !named)) fail('INPUT', 'face must be a face name');
      const given = f.side;
      if (given !== undefined && given !== 'min' && given !== 'max') fail('INPUT', 'side must be min or max');
      const csk = f.countersink === undefined ? null : dim(f.countersink as CadPartDim, 'countersink', true);
      if (csk !== null && !(csk / 2 > r)) fail('INPUT', 'a countersink must be wider than the hole');
      return () => carrySheet(many(target.map(p => {
        // The tool: a cylinder along local z over [h0, h1], centred at local (c1, c2), turned onto the axis
        // by a cyclic permutation (x: local x, y, z → world y, z, x; y: → world z, x, y).
        const box = bounds(p.solid), k = 'xyz'.indexOf(axis), hi = box.max[k], lo = box.min[k];
        // (The face drilled into: the named planar face's plane, its outward normal along ±axis the side; else the
        // target's extreme on `side`. From a named face the tool reaches past it by 1 % of the depth, at most 1 mm, and at
        // most half the free space above the face over the hole (D148b: a lip or an overhang there stays whole); from the
        // extreme, 1 mm as before.)
        const start = named === null ? null : holeFace(brepOf(p, at), named, k, fail);
        const side = start ? start.side : given ?? 'max';
        if (start && given !== undefined && given !== start.side) fail('INPUT', `side ${given} does not match ${named}, which faces ${start.side === 'max' ? '+' : '-'}${axis}`);
        const face = start ? start.at : side === 'max' ? hi : lo;
        let over = 1;
        if (start && depth !== null) {
          const free = clearanceAbove(brepOf(p, at), k, side === 'max' ? 1 : -1, face, c, r);
          if (free < OBSTRUCTION_MM) fail('GEOMETRY', `[OBSTRUCTED_ABOVE] material ${+free.toPrecision(3)} mm above ${named} over the hole at (${c[0]}, ${c[1]}): a blind hole from that face would cut it`);
          over = Math.min(1, 0.01 * depth, free / 2);
        }
        const [h0, h1] = depth === null ? [lo - 1, hi + 1] : side === 'max' ? [face - depth, face + over] : [face - over, face + depth];
        const local: XY = axis === 'y' ? [c[1], c[0]] : c;
        const cylinder = prismaticFromProfile({ outer: [{ kind: 'arc', start: [local[0] + r, local[1]], center: local, direction: 'ccw' }], height: h1 - h0, from: h0, tag: at });
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
        const R = csk / 2, e = Math.min(0.5, R), t = R - r, down = side === 'max' ? -1 : 1;
        const cone = revolveProfile({ id: `${at}_csk`, profile: [{ kind: 'line', start: [0, -e] }, { kind: 'line', start: [R + e, -e] }, { kind: 'line', start: [r, t] }, { kind: 'line', start: [0, t] }], axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 });
        const M = [1, 0, 0, 0, 0, -down, 0, down, 0], P = axis === 'z' ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : axis === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : [0, 1, 0, 0, 0, 1, 1, 0, 0];
        const mul = (A: number[], B: number[]) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]));
        const o: Point = [local[0], local[1], face], offset = [0, 1, 2].map(i => P[3 * i] * o[0] + P[3 * i + 1] * o[1] + P[3 * i + 2] * o[2]) as Point;
        const placedCone = transformBrep(cone, { matrix: mul(P, M) as unknown as BrepAffine['matrix'], offset }, n => n.split('|').map(q => q.replace(`${at}_csk.`, `${at}.countersink-`)).join('|'));
        return boolean(out, { kind: 'brep', brep: placedCone }, 'difference', at);
      })), target);
    }
    case 'translate': {
      const target = solids(f.target, 'target'), o = xyz(f.offset as CadPartPoint3, 'offset');
      return () => moveAll(target, [1, 0, 0, 0, 1, 0, 0, 0, 1], o, true);
    }
    case 'rotate': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angle as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > 3600) fail('INPUT', 'angle must be a finite number of degrees');
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
      // (A pattern of an empty result — an intersection that met nothing — is empty, as the Booleans take it: D190.)
      const target = solids(f.target, 'target', true), axis = axisOf(f.axis), spacing = dim(f.spacing as CadPartDim, 'spacing'), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      if (spacing === 0) fail('PARAMETER', 'spacing must not be zero');
      return () => many(target.map(p => {
        const copies = Array.from({ length: count }, (_, k) => { if (!k) return p.solid; const o: Point = [0, 0, 0]; o['xyz'.indexOf(axis)] = spacing * k; return affine(p.solid, [1, 0, 0, 0, 1, 0, 0, 0, 1], o, n => `${n}@${k}`); });
        return unionAll(copies, at);
      }));
    }
    case 'linear-feature-pattern': {
      const { seed, tool } = t.cutSource(f.target), axis = axisOf(f.axis), spacing = dim(f.spacing as CadPartDim, 'spacing'), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      if (spacing === 0) fail('PARAMETER', 'spacing must not be zero');
      return () => {
        if (count === 1 || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = tool.slice(1).reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), tool[0].solid);
        // The seed already contains the original cut. Translate only its tool for the remaining cuts.
        let cut = seed.solid;
        for (let k = 1; k < count; k++) {
          const offset: Point = [0, 0, 0]; offset['xyz'.indexOf(axis)] = spacing * k;
          cut = boolean(cut, affine(joined, [1, 0, 0, 0, 1, 0, 0, 0, 1], offset, n => `${n}@${k}`), 'difference', at);
        }
        return one(cut);
      };
    }
    case 'rectangular-feature-pattern': {
      const axis = axisOf(f.axis), axis2 = axisOf(f.axis2);
      if (axis === axis2) fail('INPUT', 'rectangular feature pattern axes must be distinct');
      const spacing = dim(f.spacing as CadPartDim, 'spacing'), spacing2 = dim(f.spacing2 as CadPartDim, 'spacing2');
      if (spacing === 0 || spacing2 === 0) fail('PARAMETER', 'rectangular feature pattern spacing must not be zero');
      const count = integer(f.count, 'count', 1, CadPartLimits.copies), count2 = integer(f.count2, 'count2', 1, CadPartLimits.copies);
      const cells = count * count2;
      if (!Number.isSafeInteger(cells) || cells > CadPartLimits.copies) fail('INPUT', `rectangular feature pattern must have at most ${CadPartLimits.copies} cells`);
      const { seed, tool } = t.cutSource(f.target), first = 'xyz'.indexOf(axis), second = 'xyz'.indexOf(axis2);
      const matrix: BrepAffine['matrix'] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        if (cells === 1 || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = unionAll(tool.map(p => p.solid), at);
        let cut = seed.solid;
        for (let j = 0; j < count2; j++) for (let i = 0; i < count; i++) {
          if (i === 0 && j === 0) continue;
          const offset: Point = [0, 0, 0]; offset[first] = spacing * i; offset[second] = spacing2 * j;
          cut = boolean(cut, affine(joined, matrix, offset, `@${i},${j}`), 'difference', at);
        }
        return one(cut);
      };
    }
    case 'fill-feature-pattern': {
      const spacing = dim(f.spacing as CadPartDim, 'spacing'), spacing2 = dim(f.spacing2 as CadPartDim, 'spacing2');
      if (spacing === 0 || spacing2 === 0) fail('PARAMETER', 'fill feature pattern spacing must not be zero');
      const count = integer(f.count, 'count', 1, CadPartLimits.copies), count2 = integer(f.count2, 'count2', 1, CadPartLimits.copies);
      if (count * count2 > CadPartLimits.copies) fail('INPUT', `fill feature pattern must have at most ${CadPartLimits.copies} candidate cells`);
      const snapshot = fillCutSnapshot(f.region, f.anchor, fail);
      const placements = fillCutPlacements(snapshot.region, snapshot.anchor, spacing, count, spacing2, count2);
      const { seed, tool } = t.cutSource(f.target);
      const matrix: BrepAffine['matrix'] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        if (!placements.length || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = unionAll(tool.map(p => p.solid), at);
        let cut = seed.solid;
        for (const placement of placements) cut = boolean(cut, affine(joined, matrix, placement.offset, placement.suffix), 'difference', at);
        return one(cut);
      };
    }
    case 'curve-feature-pattern': {
      const spacing = dim(f.spacing as CadPartDim, 'spacing', true), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      const offsets = curveCutOffsets(f.path, spacing, count, CadPartLimits.length, fail);
      const { seed, tool } = t.cutSource(f.target);
      const matrix: BrepAffine['matrix'] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        if (count === 1 || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = unionAll(tool.map(p => p.solid), at);
        let cut = seed.solid;
        for (let k = 1; k < count; k++) cut = boolean(cut, affine(joined, matrix, offsets[k], `@${k}`), 'difference', at);
        return one(cut);
      };
    }
    case 'circular-pattern': {
      const target = solids(f.target, 'target', true), axis = axisOf(f.axis), deg = f.angle as number, count = integer(f.count, 'count', 1, CadPartLimits.copies);
      const pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || deg === 0 || Math.abs(deg) > 360) fail('INPUT', 'angle must be a nonzero step of at most 360°');
      if (axis !== 'z' && Math.round(deg / 90) * 90 !== deg) fail('CAPABILITY', 'patterns about X or Y must step by multiples of 90°');
      return () => many(target.map(p => {
        return unionAll(Array.from({ length: count }, (_, k) => k ? rotate(p.solid, axis, deg * k, pivot, n => `${n}@${k}`) : p.solid), at);
      }));
    }
    case 'frame-member': case 'frame': case 'gusset': case 'end-cap': case 'weld-bead': return frameOperation(f, t);
    case 'sheet-base': case 'sheet-contour': case 'sheet-corner-relief': case 'sheet-flange': return sheetOperation(f, t, HELPERS);
    case 'sweep': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'sweep takes a sketch of one loop (no regions or holes) yet');
      const path = f.path as unknown;
      if (!Array.isArray(path) || !path.length || path.length > CadPartLimits.copies) fail('INPUT', 'path must list 1 to 64 steps');
      const steps = (path as unknown[]).map((st, i): { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' } => {
        if (!isRecord(st)) return fail('INPUT', `path[${i}] must be a step`);
        if (st.kind === 'straight') return { kind: 'straight', length: dim(st.length as CadPartDim, `path[${i}].length`, true) };
        if (st.kind === 'bend') {
          const a = st.angle, toward = st.toward;
          if (typeof a !== 'number' || !(a > 0 && a <= 180)) fail('INPUT', `path[${i}].angle must be in (0, 180]`);
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
      const framedSections = (list as unknown[]).some(sec => isRecord(sec) && (sec.frame !== undefined || Object.hasOwn(sec, 'profile')));
      // (CG1.3: a general guide — kind nurbs — on sketches stacked along their plane's normal takes the z path.)
      const nurbsGuide = isRecord(f.guide) && (f.guide as { kind?: unknown }).kind === 'nurbs' && !framedSections;
      if ((f.guide !== undefined && !nurbsGuide) || framedSections) {
        if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
        const framed = (list as unknown[]).map((sec, i) => {
          if (!isRecord(sec) || sec.frame === undefined || sec.z !== undefined) return fail('INPUT', `sections[${i}] need an explicit frame without z`);
          if (Object.hasOwn(sec, 'profile')) {
            if (Object.hasOwn(sec, 'sketch') || !isRecord(sec.profile) || sec.profile.kind !== 'ellipse') return fail('INPUT', `sections[${i}] must provide an ellipse profile or a sketch, never both`);
            return { profile: sec.profile as unknown as Exclude<LoftSectionInput['profile'], readonly ProfileSegmentInput[]>, frame: sec.frame as unknown as LoftSectionFrame, tags: undefined };
          }
          if (typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch or an inline ellipse profile`);
          const sketch = ref(sec.sketch, 'sketch').result;
          if (sketch.kind !== 'sketch') return fail('REFERENCE', `${sec.sketch} is not a sketch`);
          if (sketch.regions?.length || sketch.holes?.length) return fail('CAPABILITY', 'oriented loft sections need one loop without holes');
          return { profile: sketch.outer, frame: sec.frame as unknown as LoftSectionFrame, tags: sketch.tags };
        });
        return () => {
          const { brep, mass } = loftSolid({ id: at, name: at, sections: framed, smooth: f.smooth === true, ...(f.guide !== undefined ? { guide: f.guide as LoftInput['guide'] } : {}), ...(framed[0].tags ? { sideTags: framed[0].tags.outer } : {}) });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] };
        };
      }
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
      const guide = nurbsGuide ? { guide: guideInFrame(f.guide as Record<string, unknown>, frame) as LoftInput['guide'] } : {};
      return placed(frame, () => { const { brep, mass } = loftSolid({ id: at, name: at, sections: sections.map(({ profile, z }) => ({ profile, z })), smooth: f.smooth === true, ...guide, ...(sections[0].tags ? { sideTags: sections[0].tags.outer } : {}) }); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] }; });
    }
    case 'import': case 'subd': case 'sew': case 'mesh': case 'decimate': case 'separate': return meshOperation(f, t, HELPERS);
    case 'draft': {
      const target = solids(f.target, 'target'), names = f.faces as unknown, angle = f.angle as unknown;
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges || !names.every(x => typeof x === 'string')) fail('INPUT', 'faces must list 1 to 64 face names');
      if (typeof angle !== 'number' || !Number.isFinite(angle) || angle === 0 || Math.abs(angle) >= 45) fail('INPUT', 'angle must be a number of degrees, not 0, below 45 in size');
      if (target.length !== 1) fail('REFERENCE', 'draft one part at a time (name it as id/k)');
      const neutral = f.neutral === undefined ? undefined : dim(f.neutral as CadPartDim, 'neutral');
      const pull = f.pull === undefined ? 'z' : f.pull as unknown;
      if (pull !== 'x' && pull !== 'y' && pull !== 'z' && pull !== '-x' && pull !== '-y' && pull !== '-z') fail('INPUT', 'pull must be x, y or z (a positive coordinate axis), or -x, -y or -z');
      return () => {
        if (target[0].solid.kind === 'brep' && target[0].solid.brep.faces.some(isFacetFace)) fail('CAPABILITY', 'draft on mesh faces is not supported yet (general draft and offset arrive with R11)');
        // Signed permutations put the pull on local Z with determinant +1 and no trigonometric rotation.
        const negativePull = pull === '-x' || pull === '-y' || pull === '-z';
        const toZ: BrepAffine['matrix'] | null = pull === 'x' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : pull === 'y' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : pull === '-x' ? [0, 1, 0, 0, 0, -1, -1, 0, 0] : pull === '-y' ? [0, 0, 1, -1, 0, 0, 0, -1, 0] : pull === '-z' ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : null;
        const fromZ: BrepAffine['matrix'] | null = pull === 'x' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : pull === 'y' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : pull === '-x' ? [0, 0, -1, 1, 0, 0, 0, -1, 0] : pull === '-y' ? [0, -1, 0, 0, 0, -1, 1, 0, 0] : pull === '-z' ? [1, 0, 0, 0, -1, 0, 0, 0, -1] : null;
        const localSolid = toZ ? affine(target[0].solid, toZ, [0, 0, 0]) : target[0].solid;
        const brep = brepOf(toZ ? { solid: localSolid } : target[0], at), box = bounds(localSolid), zN = negativePull && neutral !== undefined ? -neutral : neutral ?? box.min[2], R = len(sub(box.max, box.min)) + 2, a = (angle as number) * Math.PI / 180;
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
          if (Math.abs(n[2]) > 1e-9 || face.loops.length > 1) fail('CAPABILITY', `${name}: a draft takes side faces square to the pull (${pull === 'x' ? 'X' : pull === 'y' ? 'Y' : pull === '-x' ? '-X' : pull === '-y' ? '-Y' : pull === '-z' ? '-Z' : 'Z'}) without holes`);
          const zs = ring.map(p => p[2]), top = Math.max(...zs), height = top - zN;
          if (!(height > 0) || Math.min(...zs) < zN - 1e-6) fail('SELECTION', negativePull ? `${name}: the neutral plane ${pull.slice(1)} = ${-zN} must be at or above the face for pull ${pull}` : `${name}: the neutral plane ${pull} = ${zN} must be at or below the face`);
          // A frame on the face: X along it (level), Y up, Z into the body (draft in) or out of it (draft out).
          const along: Point = a > 0 ? [-n[0], -n[1], -n[2]] : n, x = unit(cross([0, 0, 1], along)), y = cross(along, x);
          const m: BrepAffine['matrix'] = [x[0], y[0], along[0], x[1], y[1], along[1], x[2], y[2], along[2]], o = ring[0];
          const uv = ring.map(p => { const d = sub(p, o); return [dot(d, x), dot(d, y)]; });
          // (A little wider and taller than the face, so the wedge's ends do not lie on its neighbours' planes.)
          const e = 1e-3 * R, wide = a > 0 ? e : 0, u0 = Math.min(...uv.map(q => q[0])) - wide, u1 = Math.max(...uv.map(q => q[0])) + wide, v0 = Math.min(...uv.map(q => q[1])) - 2 * lift, v1 = Math.max(...uv.map(q => q[1])) + wide;
          const depth = height * Math.tan(Math.abs(a)) + 1;
          const outline: ProfileSegmentInput[] = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(start => ({ kind: 'line', start: start as XY }));
          const prism = affine({ kind: 'upright', solid: prismaticFromProfile({ outer: outline, height: depth, from: a > 0 ? 0 : -1e-3, tag: `${at}.draft` }) }, m, o);
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
        const result = all ? boolean(localSolid, all, a > 0 ? 'difference' : 'union', at) : localSolid;
        return one(fromZ ? affine(result, fromZ, [0, 0, 0]) : result);
      };
    }
    case 'split-face': {
      const target = solids(f.target, 'target'), face = f.face, given = f.curves as unknown, names = f.names as unknown;
      if (typeof face !== 'string' || !face) fail('INPUT', 'face must be a face name');
      if ((given === undefined) === (f.pull === undefined)) fail('INPUT', 'give curves, or pull for the isocline (one of them)');
      if (target.length !== 1) fail('REFERENCE', 'split one part at a time (name it as id/k)');
      if (names !== undefined && (!Array.isArray(names) || !names.every(n => typeof n === 'string'))) fail('INPUT', 'names must list the pieces\' names');
      const pull = f.pull === undefined ? null : xyz(f.pull as CadPartPoint3, 'pull');
      let curves: Curve[] | null = null;
      if (given !== undefined) {
        if (!Array.isArray(given) || !given.length || given.length > CadPartLimits.edges) fail('INPUT', 'curves must list 1 to 64 NURBS curves');
        curves = (given as Record<string, unknown>[]).map((c, i) => {
          if (!isRecord(c)) fail('INPUT', `curves[${i}] must be a NURBS curve { degree, knots, controlPoints, weights }`);
          const curve = { kind: 'curve' as const, id: `split_curve${i}`, degree: c.degree as number, knots: c.knots as number[], controlPoints: c.controlPoints as Point[], weights: c.weights as number[] };
          try { validateCurve(curve); } catch (cause) { fail('INPUT', `curves[${i}]: ${cause instanceof Error ? cause.message : String(cause)}`); }
          return curve;
        });
      }
      return () => {
        const brep = brepOf(target[0], at), options = { id: at, ...(names === undefined ? {} : { names: names as string[] }) };
        try { return one({ kind: 'brep', brep: (curves ? splitFaceAlongCurve(brep, face as string, curves, options) : splitFaceAlongIsocline(brep, face as string, pull!, options)).brep }); }
        catch (cause) {
          if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : /\[(NO_FACE|AMBIGUOUS)\]/.test(cause.message) ? 'REFERENCE' : cause.code === 'INPUT' ? 'INPUT' : 'GEOMETRY', cause.message.replace(/^B-rep: /, ''));
          throw cause;
        }
      };
    }
    case 'shell': case 'thicken': return shellOperation(f, t, HELPERS);
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
          if (profiling) profiling.sweeps++;
          return one({ kind: 'brep', brep: sweepSolid({ id: at, outer: loopPoints(sk.outer), holes: (sk.holes ?? []).map(loopPoints), xAxis: [m[0], m[3], m[6]], yAxis: [m[1], m[4], m[7]], path: curve }) });
        } catch (cause) { if (cause instanceof RangeError || isMeshBrepError(cause)) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'spur-gear': case 'internal-gear': case 'bevel-gear': case 'worm': case 'worm-wheel': case 'spur-rack': return gearOperation(f, t, HELPERS);
    case 'connector-opening': case 'connector-body': case 'oring-gland': case 'oring': case 'bearing': case 'key': case 'retaining-ring': case 'pin': case 'keyway': case 'shaft': case 'spring': case 'sprocket': case 'pulley': case 'belt': case 'coupling': case 'cam': case 'thread': return machineOperation(f, t, HELPERS);
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
    case 'chamfer': case 'fillet': return finishOperation(f, t, HELPERS);
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
export function obliqueHalf(o: Point, n: Point, x: Point, y: Point, R: number, below: boolean, at: string, capName?: string): Solid {
  const corner = (deg: number) => add(o, add(scale(x, 4 * R * Math.cos(deg * Math.PI / 180)), scale(y, 4 * R * Math.sin(deg * Math.PI / 180))));
  const apex = add(o, scale(n, below ? -4 * R : 4 * R));
  const positions = [...corner(90), ...corner(210), ...corner(330), ...apex];
  // The base first (wound about +n below, −n above), then the sides against its edges.
  const indices = below ? [0, 1, 2, 1, 0, 3, 2, 1, 3, 0, 2, 3] : [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3];
  const tool = brepFromTriangles(positions, indices, { id: `${at}_cut`, maximumTriangles: 4 });
  const base = `${at}_cut.facet0`, cap = capName ?? `${at}.cut.${below ? 'top' : 'bottom'}`;
  return { kind: 'brep', brep: transformBrep(tool, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, name => name.split('|').map(q => q === base ? cap : q.replace(`${at}_cut.facet`, `${at}.cut.side`)).join('|')) };
}
/** F2: a body with mesh faces and an exact body, `op`; refusals typed. */
function facetWith(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string): Solid {
  const B = b.kind === 'upright' ? brepFromPrismatic(b.solid, { id: at + '_tool' }) : b.brep;
  try { return { kind: 'brep', brep: facetBoolean((a as Extract<Solid, { kind: 'brep' }>).brep, B, op, { id: at, nearTriangles: facetLimit }) }; }
  catch (cause) { if (isFacetBooleanError(cause)) throw new CadPartError(cause.code, at, cause.message); if (cause instanceof BrepError) throw new CadPartError('GEOMETRY', at, cause.message.replace(/^B-rep: /, '')); throw cause; }
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
  catch (cause) { if (cause instanceof BrepError || isFacetBooleanError(cause)) throw new CadPartError('GEOMETRY', at, cause.message.replace(/^B-rep: /, '')); throw cause; }
  if (!r.below || !r.above) throw new CadPartError('SELECTION', at, 'the split plane does not cross the target');
  return [{ kind: 'brep', brep: r.below }, { kind: 'brep', brep: r.above }];
}

/** A face's analytic surface, for the corner restore: its signed distance (outside +) and a shell d thick beside it. */
interface Analytic { readonly dist: (x: Point) => number; readonly shell: (d: number, side: 1 | -1, margin: number, tag: string) => Solid | null }
function analyticOf(S: { name: string; faces: readonly BrepFace[] }, brep: Brep, size: number): Analytic | null {
  if (!S.faces.length || S.faces.some(x => x.surface.kind === 'facets')) return null;
  const g = faceGeometry(S.faces[0]), pts = boundaryOf(brep, S.faces).flat();
  if (g.kind === 'plane') {
    const n = unit(g.n), o = g.o, u = unit(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0])), v = cross(n, u);
    const us = pts.map(q => dot(sub(q, o), u)), vs = pts.map(q => dot(sub(q, o), v));
    return {
      dist: x => dot(sub(x, o), n),
      shell: (d, side, margin, tag) => {
        const [u0, u1, v0, v1] = [Math.min(...us) - margin, Math.max(...us) + margin, Math.min(...vs) - margin, Math.max(...vs) + margin];
        const box: Solid = { kind: 'upright', solid: prismaticFromProfile({ outer: [{ kind: 'line', start: [u0, v0] }, { kind: 'line', start: [u1, v0] }, { kind: 'line', start: [u1, v1] }, { kind: 'line', start: [u0, v1] }], height: d, from: side > 0 ? 0 : -d, tag }) };
        return affine(box, [u[0], v[0], n[0], u[1], v[1], n[1], u[2], v[2], n[2]], o);
      },
    };
  }
  const R = revolutionOf(nurbsOf(S.faces[0]), size);
  if (!R) return null;
  const toRH = (x: Point): XY2 => { const w = sub(x, R.c), h = dot(w, R.a); return [len(sub(w, scale(R.a, h))), h]; };
  // The outward side in the half-plane: from the surface's normal at its middle (the face's sense kept).
  const F = nurbsOf(S.faces[0]), { u, v } = surfaceDomain(F), um = (u[0] + u[1]) / 2, vm = (v[0] + v[1]) / 2, du = 1e-6 * (u[1] - u[0]), dv = 1e-6 * (v[1] - v[0]);
  const P = evaluateSurface(F, um, vm) as Point, N3 = scale(unit(cross(sub(evaluateSurface(F, um + du, vm) as Point, P), sub(evaluateSurface(F, um, vm + dv) as Point, P))), S.faces[0].sense === 'forward' ? 1 : -1);
  const radial = unit(sub(sub(P, R.c), scale(R.a, dot(sub(P, R.c), R.a)))), n2: XY2 = [dot(N3, radial), dot(N3, R.a)], P2 = toRH(P), rh = pts.map(toRH);
  const Z = cross(R.e1, R.a), m: BrepAffine['matrix'] = [R.e1[0], R.a[0], Z[0], R.e1[1], R.a[1], Z[1], R.e1[2], R.a[2], Z[2]];
  const revolved = (outer: ProfileSegmentInput[], tag: string): Solid => affine({ kind: 'brep', brep: revolveProfile({ id: tag, profile: outer, axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 }) }, m, R.c);
  const pr = R.profile;
  if (pr.kind === 'line') {
    const dl = sub2(pr.q, pr.p), t = unit2(dl), side0 = Math.sign(cross2(t, n2)) || 1, nrm: XY2 = [-t[1] * side0, t[0] * side0];
    const ss = rh.map(q => (q[0] - pr.p[0]) * t[0] + (q[1] - pr.p[1]) * t[1]);
    return {
      dist: x => { const q = toRH(x); return (q[0] - pr.p[0]) * nrm[0] + (q[1] - pr.p[1]) * nrm[1]; },
      shell: (d, side, margin, tag) => {
        const s0 = Math.min(...ss) - margin, s1 = Math.max(...ss) + margin, at2 = (s: number, off: number): XY2 => [pr.p[0] + t[0] * s + nrm[0] * off, pr.p[1] + t[1] * s + nrm[1] * off];
        const corners = [at2(s0, 0), at2(s1, 0), at2(s1, side * d), at2(s0, side * d)];
        if (corners.some(q => q[0] <= 1e-9 * size)) return null;
        return revolved(corners.map(start => ({ kind: 'line', start })), tag);
      },
    };
  }
  const out: 1 | -1 = n2[0] * (P2[0] - pr.c[0]) + n2[1] * (P2[1] - pr.c[1]) > 0 ? 1 : -1, ang = (q: XY2) => Math.atan2(q[1] - pr.c[1], q[0] - pr.c[0]);
  const mid = ang(P2), as = rh.map(q => { let a = ang(q) - mid; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; });
  return {
    dist: x => (len2(sub2(toRH(x), pr.c)) - pr.r) * out,
    shell: (d, side, margin, tag) => {
      const a0 = mid + Math.max(-Math.PI + 1e-3, Math.min(...as) - margin / pr.r), a1 = mid + Math.min(Math.PI - 1e-3, Math.max(...as) + margin / pr.r), r2 = pr.r + side * out * d;
      const pt = (a: number, rr: number): XY2 => [pr.c[0] + rr * Math.cos(a), pr.c[1] + rr * Math.sin(a)];
      const ring = [pt(a0, pr.r), pt(a1, pr.r), pt(a1, r2), pt(a0, r2)];
      if (!(r2 > 1e-9 * size) || ring.some(q => q[0] <= 1e-9 * size)) return null;
      return revolved([{ kind: 'arc', start: ring[0], center: pr.c, direction: 'ccw' }, { kind: 'line', start: ring[1] }, { kind: 'arc', start: ring[2], center: pr.c, direction: 'cw' }, { kind: 'line', start: ring[3] }], tag);
    },
  };
}

/**
 * The corner between two faces that do not meet, restored (F1): whatever lies within d of both their surfaces on the
 * corner's side — an earlier round, a chamfer, a step — removed (an inside corner: the body less the outer shells'
 * overlap W) or filled (an outside corner: the body and the inner shells' overlap), so the two meet along their
 * surfaces' intersection. Which side, from a face between them (its vertices within d of both, outside both or inside
 * both). W's faces on A's or B's surface take their names. Null when the faces are not planes or surfaces of revolution.
 */
function restoreCorner(brep: Brep, source: Solid, sides: readonly { name: string; faces: readonly BrepFace[] }[], r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid | null {
  const size = Math.max(1, r, ...brep.vertices.map(v => len(v.point))), surf = sides.map(S => analyticOf(S, brep, size));
  if (surf.some(x => !x)) return null;
  // (Two parallel planes never meet: there is no corner to restore.)
  const g = sides.map(S => faceGeometry(S.faces[0]));
  if (g[0].kind === 'plane' && g[1].kind === 'plane' && len(cross(unit(g[0].n), unit(g[1].n))) < 1e-9) return null;
  const [A, B] = surf as Analytic[], d = 3 * r, margin = d + 1e-3 * size, inSides = new Set(sides.flatMap(S => S.faces.map(x => x.id)));
  // (Points inside the faces, not their vertices: a round's lie on its contacts, on A or B.)
  const inner = (x: BrepFace): Point[] => { if (x.surface.kind === 'facets') return []; const F = nurbsOf(x), { u, v } = surfaceDomain(F); return [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7]].map(([p, q]) => evaluateSurface(F, u[0] + (u[1] - u[0]) * p, v[0] + (v[1] - v[0]) * q) as Point); };
  // (Faces between the two border one of them: an edge shared with A or B — not a far face that happens to lie near both.)
  const loopsOf = new Map(brep.loops.map(l => [l.id, l.face])), sideEdges = new Set(brep.coedges.filter(c => inSides.has(loopsOf.get(c.loop)!)).map(c => c.edge));
  const bordering = new Set(brep.coedges.filter(c => sideEdges.has(c.edge)).map(c => loopsOf.get(c.loop)!));
  const between = brep.faces.filter(x => !inSides.has(x.id) && bordering.has(x.id)).flatMap(inner).map(q => [A.dist(q), B.dist(q)]).filter(([a, b]) => Math.abs(a) < d && Math.abs(b) < d);
  const outside = between.some(([a, b]) => a > 1e-7 * size && b > 1e-7 * size), insideBoth = between.some(([a, b]) => a < -1e-7 * size && b < -1e-7 * size);
  if (outside === insideBoth) fail('CAPABILITY', `[FACE_FILLET_FACES] nothing lies between ${sides[0].name} and ${sides[1].name} on one side of their corner to replace`);
  const side: 1 | -1 = outside ? 1 : -1;
  const shells = surf.map((x, k) => x!.shell(d, side, margin, `${at}_w${k}`));
  if (shells.some(x => !x)) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round's corner region would cross the axis`);
  const W = boolean(shells[0]!, shells[1]!, 'intersection', at);
  if (empty(W)) return null;
  const out = boolean(source, W, outside ? 'difference' : 'union', at), pieces = out.kind === 'brep' ? out.brep.bodies.length : 1;
  if (pieces !== 1) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] restoring the corner between ${sides[0].name} and ${sides[1].name} would leave ${pieces} bodies`);
  // W's faces left on A's or B's surface (every inner point on it) take that face's name.
  if (out.kind !== 'brep') return out;
  const named = out.brep.faces.map(x => { if (inSides.has(x.id)) return x; const q = inner(x); const k = q.length ? [A, B].findIndex(Sx => q.every(p => Math.abs(Sx.dist(p)) <= 1e-7 * size)) : -1; return k < 0 ? x : { ...x, name: sides[k].name }; });
  return { kind: 'brep', brep: { ...out.brep, faces: named } };
}

/** The names of the edges two named faces share (each face with its pieces `#k`), in the body's order; none when one has no name (the edge fillet finds edges by name). */
function sharedEdges(brep: Brep, names: readonly string[]): string[] {
  const of = (name: string) => new Set(brep.faces.filter(x => x.name === name || (x.name ?? '').split('#')[0] === name).flatMap(x => x.loops));
  const [A, B] = names.map(of), byEdge = new Map<string, { a: boolean; b: boolean }>();
  for (const c of brep.coedges) { const u = byEdge.get(c.edge) ?? { a: false, b: false }; if (A.has(c.loop)) u.a = true; if (B.has(c.loop)) u.b = true; byEdge.set(c.edge, u); }
  const shared = brep.edges.filter(e => byEdge.get(e.id)?.a && byEdge.get(e.id)?.b);
  return shared.every(e => e.name) ? shared.map(e => e.name!) : [];
}

/** A face's boundary: the edges of its pieces not shared between them, each sampled as a polyline (lines as their ends). */
function boundaryOf(brep: Brep, faces: readonly BrepFace[]): Point[][] {
  const loops = new Set(faces.flatMap(x => x.loops)), uses = new Map<string, number>(), edges = new Map(brep.edges.map(e => [e.id, e]));
  for (const c of brep.coedges) if (loops.has(c.loop)) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
  return [...uses].filter(([, k]) => k === 1).map(([id]) => { const e = edges.get(id)!, [t0, t1] = curveDomain(e.curve), N = e.curve.degree === 1 && e.curve.controlPoints.length === 2 ? 1 : 64; return Array.from({ length: N + 1 }, (_, i) => evaluateCurve(e.curve, t0 + (t1 - t0) * i / N) as Point); });
}
/** A circle through a polyline's points (its centre and unit normal), or null when they are not on one. */
function circleOf(pts: readonly Point[]): { c: Point; n: Point; R: number } | null {
  if (pts.length < 3) return null;
  const A = pts[0], B = pts[Math.floor(pts.length / 3)], C = pts[Math.floor(2 * pts.length / 3)], ab = sub(B, A), ac = sub(C, A), n0 = cross(ab, ac), nn = dot(n0, n0);
  if (!(nn > 1e-24)) return null;
  const c = add(A, scale(add(scale(cross(n0, ab), dot(ac, ac)), scale(cross(ac, n0), dot(ab, ab))), 1 / (2 * nn))), R = len(sub(A, c));
  return pts.every(q => Math.abs(len(sub(q, c)) - R) <= 1e-7 * Math.max(1, R) && Math.abs(dot(sub(q, c), unit(n0))) <= 1e-7 * Math.max(1, R)) ? { c, n: unit(n0), R } : null;
}

/**
 * A face fillet between two faces that turn about one axis — a plane across it, a cylinder, a cone, a sphere, a torus
 * (a boss on a plate, a tapered boss, a disc's rim, a hole's or countersink's edge, a chamfer meeting a shaft, a ball
 * on a stem, a dome on a plate, beside an earlier round). In the half-plane through the axis (radius, height) each is a
 * line or a circle: the round's centre is where they meet pushed off by its radius (outward: an inside corner, filled;
 * inward: an outside one, cut), and its section — the corner, along one face to its tangent point, the round's short
 * arc, back along the other — is revolved about the axis; corners on several circles are each rounded. A cylinder,
 * cone, sphere or torus must be whole round and hold its tangent point along its generator; a plane must hold the
 * tangent circle; the volume is checked by Pappus (the section's area and first moment, its arcs exact).
 */
function revolvedFillet(brep: Brep, source: Solid, A0: { name: string; faces: readonly BrepFace[] }, B0: { name: string; faces: readonly BrepFace[] }, r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid {
  const sides = [A0, B0].map(S => ({ ...S, g: faceGeometry(S.faces[0]), bound: boundaryOf(brep, S.faces) }));
  const unsupported = (S: typeof sides[number]) => fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is not a plane, cylinder, cone, sphere or torus turning about the other's axis (a face fillet takes these)`);
  // The axis: a cylinder's, else the common axis of a curved face's boundary circles.
  let O: Point, a: Point;
  const cyl = sides.find(S => S.g.kind === 'cylinder');
  if (cyl && cyl.g.kind === 'cylinder') { O = cyl.g.c; a = unit(cyl.g.a); }
  else {
    // (A cone's, sphere's or torus's own axis, as the kernel recognises it.)
    const S0 = sides.find(x => x.g.kind === 'other')!, R0 = S0.faces[0].surface.kind === 'facets' ? null : revolutionOf(nurbsOf(S0.faces[0]), Math.max(1, r, ...sides.flatMap(S => S.bound.flat().map(q => len(q)))));
    if (!R0) return unsupported(S0);
    O = R0.c; a = unit(R0.a);
  }
  const k0 = [0, 1, 2].reduce((m, k) => Math.abs(a[k]) > Math.abs(a[m]) ? k : m, 0); if (a[k0] < 0) a = scale(a, -1);
  const hOf = (q: Point) => dot(sub(q, O), a), radialOf = (q: Point) => sub(sub(q, O), scale(a, hOf(q))), rhoOf = (q: Point) => len(radialOf(q)), to2 = (q: Point): XY2 => [rhoOf(q), hOf(q)];
  const size = Math.max(1, r, ...sides.flatMap(S => S.bound.flat().map(q => len(sub(q, O))))), tol = 1e-9 * size, fit = 1e-7 * size;
  const wholeRound = (S: typeof sides[number]) => S.bound.every(e => circleOf(e) !== null);
  // Each face as a curve in the half-plane, with what it holds of it: a line's extent along it, a circle's arc.
  const curves = sides.map(S => {
    const pts = S.bound.flat().map(to2);
    if (S.g.kind === 'plane') {
      if (Math.abs(Math.abs(dot(unit(S.g.n), a)) - 1) > 1e-9) return fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is not square to the axis`);
      return { S, sec: { kind: 'line', p: [0, hOf(S.g.o)], n: [0, Math.sign(dot(unit(S.g.n), a))] } as Section2, flat: true, pts, mid: null as XY2 | null };
    }
    if (S.g.kind === 'cylinder') {
      if (len(cross(unit(S.g.a), a)) > 1e-9 || rhoOf(S.g.c) > tol) return fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} does not turn about the other's axis`);
      if (!wholeRound(S)) return fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is not a whole round face`);
      return { S, sec: { kind: 'line', p: [S.g.r, 0], n: [S.g.out, 0] } as Section2, flat: false, pts, mid: null as XY2 | null };
    }
    // A cone, sphere or torus: its surface on one line or circle in the half-plane, whole round.
    if (S.faces.some(x => x.surface.kind === 'facets') || !wholeRound(S)) return unsupported(S);
    // Recognised by the kernel (revolutionOf): its axis must be the corner's, its meridian a line (a cone) or a circle
    // (a sphere, a torus), seen in this half-plane; every sample of every piece on it.
    const Rv = revolutionOf(nurbsOf(S.faces[0]), size);
    if (!Rv || len(cross(unit(Rv.a), a)) > 1e-9 || len(cross(sub(Rv.c, O), a)) > fit) return unsupported(S);
    const flip = dot(Rv.a, a) < 0 ? -1 : 1, off = dot(sub(Rv.c, O), a), toHalf = (q: XY2): XY2 => [q[0], off + flip * q[1]];
    const samples = S.faces.flatMap(x => { const F = nurbsOf(x), { u, v } = surfaceDomain(F); return Array.from({ length: 49 }, (_, i) => to2(evaluateSurface(F, u[0] + (u[1] - u[0]) * (i % 7) / 6, v[0] + (v[1] - v[0]) * Math.floor(i / 7) / 6) as Point)); });
    const F = nurbsOf(S.faces[0]), { u, v } = surfaceDomain(F), um = (u[0] + u[1]) / 2, vm = (v[0] + v[1]) / 2, du = 1e-6 * (u[1] - u[0]), dv = 1e-6 * (v[1] - v[0]);
    const P = evaluateSurface(F, um, vm) as Point, N3 = scale(unit(cross(sub(evaluateSurface(F, um + du, vm) as Point, P), sub(evaluateSurface(F, um, vm + dv) as Point, P))), S.faces[0].sense === 'forward' ? 1 : -1);
    const P2 = to2(P), n2: XY2 = [dot(N3, unit(radialOf(P))), dot(N3, a)], pr = Rv.profile;
    if (pr.kind === 'line') {
      const p0 = toHalf(pr.p), d = unit2(sub2(toHalf(pr.q), p0));
      if (Math.abs(d[0]) <= 1e-9 || Math.abs(d[1]) <= 1e-9 || samples.some(q => Math.abs(cross2(d, sub2(q, p0))) > fit)) return unsupported(S);
      const side = Math.sign(cross2(d, n2)) || 1;
      return { S, sec: { kind: 'line', p: p0, n: [-d[1] * side, d[0] * side] } as Section2, flat: false, pts: samples, mid: null as XY2 | null };
    }
    const cc = toHalf(pr.c), R = pr.r;
    if (samples.some(q => Math.abs(len2(sub2(q, cc)) - R) > fit)) return unsupported(S);
    const out: 1 | -1 = n2[0] * (P2[0] - cc[0]) + n2[1] * (P2[1] - cc[1]) > 0 ? 1 : -1;
    return { S, sec: { kind: 'circle', c: cc, R, out } as Section2, flat: false, pts: samples, mid: P2 };
  });
  // Whether a face holds a section point T: a plane the circle through it, a line face its extent, a circle face its arc.
  const holds = (k: number, T: XY2) => {
    const K = curves[k], c = K.sec;
    if (K.flat) {
      const rho = T[0], crossing = K.S.bound.some(e => e.some((q, i) => i > 0 && (rhoOf(e[i - 1]) - rho) * (rhoOf(q) - rho) < -1e-14 * size * size));
      const e1 = unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), e2 = cross(a, e1), flat = (q: Point): XY2 => [dot(sub(q, O), e1), dot(sub(q, O), e2)];
      const flats = K.S.bound.map(e => e.map(flat)), probe = (phi: number): XY2 => [rho * Math.cos(phi), rho * Math.sin(phi)];
      const away = (pt: XY2) => Math.min(...flats.flat().map(q => Math.hypot(q[0] - pt[0], q[1] - pt[1])));
      const best = Array.from({ length: 8 }, (_, i) => probe(i * Math.PI / 4)).reduce((m, pt) => away(pt) > away(m) ? pt : m);
      const inFace = flats.reduce((n, e) => n + e.filter((pt, i) => { if (i === 0) return false; const q = e[i - 1]; return (pt[1] > best[1]) !== (q[1] > best[1]) && best[0] < pt[0] + (best[1] - pt[1]) * (q[0] - pt[0]) / (q[1] - pt[1]); }).length, 0) % 2 === 1;
      return !crossing && inFace && rho > tol;
    }
    if (c.kind === 'line') { const d: XY2 = [-c.n[1], c.n[0]], ts = K.pts.map(q => (q[0] - c.p[0]) * d[0] + (q[1] - c.p[1]) * d[1]), t = (T[0] - c.p[0]) * d[0] + (T[1] - c.p[1]) * d[1]; return t >= Math.min(...ts) - fit && t <= Math.max(...ts) + fit; }
    const ang = (q: XY2) => { const w = sub2(q, c.c), m = sub2(K.mid!, c.c); return Math.atan2(cross2(m, w), m[0] * w[0] + m[1] * w[1]); };
    const as = K.pts.map(ang), t = ang(T); return t >= Math.min(...as) - fit / c.R && t <= Math.max(...as) + fit / c.R;
  };
  const found: { s: 1 | -1; X: XY2; tA: XY2; tB: XY2; C: XY2 }[] = [], missed: string[] = [];
  for (const s of [1, -1] as const) for (const X of meet2(offset2(curves[0].sec, s * r), offset2(curves[1].sec, s * r))) {
    const tA = foot2(curves[0].sec, X), tB = foot2(curves[1].sec, X), corners = meet2(curves[0].sec, curves[1].sec).sort((p, q) => len2(sub2(p, X)) - len2(sub2(q, X)));
    if (!corners.length) continue;
    if (!holds(0, tA)) { missed.push(A0.name); continue; }
    if (!holds(1, tB)) { missed.push(B0.name); continue; }
    found.push({ s, X, tA, tB, C: corners[0] });
  }
  if (!found.length && missed.length) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round would not meet ${[...new Set(missed)].join(' or ')} tangentially: its tangent point lies off the face`);
  if (!found.length) fail('GEOMETRY', `[FACE_FILLET_RADIUS] no ${r} mm round is tangent to both ${A0.name} and ${B0.name} (their surfaces do not meet)`);
  const corners = found.filter((f, k) => found.findIndex(g => len2(sub2(g.C, f.C)) <= 1e-9 * size) === k);
  if (corners.some(f => f.s !== corners[0].s)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A0.name} and ${B0.name} make an inside and an outside corner: a ${r} mm round fits both ways`);
  const inside = corners[0].s > 0;
  // The rounds' seam laid where a face's own seam is (the line its halves share): a seam met off it breaks the Boolean's
  // topology; with none, square to the axis from its first coordinate direction.
  const seamOf = (S: typeof sides[number]) => { const loops = new Set(S.faces.flatMap(x => x.loops)), uses = new Map<string, number>(); for (const c of brep.coedges) if (loops.has(c.loop)) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1); const id = [...uses].find(([, k]) => k === 2)?.[0]; return id === undefined ? null : brep.vertices.find(v => v.id === brep.edges.find(e => e.id === id)!.vertices[0])!.point; };
  const seam = [...sides].sort((p, q) => (p.g.kind === 'other' ? 0 : 1) - (q.g.kind === 'other' ? 0 : 1)).map(seamOf).find(x => x && rhoOf(x) > tol);
  const e1 = seam ? unit(radialOf(seam)) : unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), Z = cross(e1, a), m: BrepAffine['matrix'] = [e1[0], a[0], Z[0], e1[1], a[1], Z[1], e1[2], a[2], Z[2]];
  const along = (c: Section2, P: XY2, Q: XY2): ProfileSegmentInput => c.kind === 'line' ? { kind: 'line', start: P } : { kind: 'arc', start: P, center: c.c, direction: shortWay(P, Q, c.c) };
  let out = source;
  corners.forEach(({ X, tA, tB, C }, k) => {
    const outer: ProfileSegmentInput[] = [along(curves[0].sec, C, tA), { kind: 'arc', start: tA, center: X, direction: shortWay(tA, tB, X) }, along(curves[1].sec, tB, C)];
    // The section stays off the axis.
    if (!([C, tA, tB].every(q => q[0] > tol) && X[0] - r > -tol)) fail('GEOMETRY', `[FACE_FILLET_RADIUS] a ${r} mm round would cross the axis`);
    const { area, moment } = loopMoments2(outer), V = 2 * Math.PI * Math.abs(moment), tag = k ? `${at}_${k}` : at, name = k ? `${at}.round${k}` : `${at}.round`;
    const made = revolveProfile({ id: tag, profile: outer, axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 });
    const tool = affine({ kind: 'brep', brep: made }, m, O, x => x.startsWith(`${tag}.side1`) ? `${name}${x.slice(`${tag}.side1`.length)}` : x);
    const held = boolean(out, tool, 'intersection', at), was = empty(held) ? 0 : exactVolume(held), before = exactVolume(out);
    const next = boolean(out, tool, inside ? 'union' : 'difference', at), change = exactVolume(next) - before, pieces = next.kind === 'brep' ? next.brep.bodies.length : 1, want = inside ? V - was : -was;
    if (pieces !== 1 || Math.abs(change - want) > 1e-7 * Math.max(before, V) || !(Math.abs(want) > 1e-9 * V) || !(Math.abs(area) > 0)) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] the round between ${A0.name} and ${B0.name} would ${inside ? 'add' : 'take'} ${+Math.abs(change).toPrecision(9)} mm³ (${+Math.abs(want).toPrecision(9)} expected)${pieces !== 1 ? ` and leave ${pieces} bodies` : ''}`);
    out = next;
  });
  return out;
}

type XY2 = [number, number];
/** A face seen in the section square to the fillet's direction: a line (a point, its outward normal) or a circle. */
type Section2 = { kind: 'line'; p: XY2; n: XY2 } | { kind: 'circle'; c: XY2; R: number; out: 1 | -1 };
const sub2 = (a: XY2, b: XY2): XY2 => [a[0] - b[0], a[1] - b[1]], cross2 = (a: XY2, b: XY2) => a[0] * b[1] - a[1] * b[0], len2 = (a: XY2) => Math.hypot(a[0], a[1]);
const unit2 = (a: XY2): XY2 => { const l = len2(a); return [a[0] / l, a[1] / l]; };
/** A section curve pushed off by `by` along its outward normal. */
function offset2(c: Section2, by: number): Section2 { return c.kind === 'line' ? { ...c, p: [c.p[0] + c.n[0] * by, c.p[1] + c.n[1] * by] } : { ...c, R: c.R + by * c.out }; }
/** Where two section curves meet (none, one or two points). */
function meet2(a: Section2, b: Section2): XY2[] {
  if (a.kind === 'line' && b.kind === 'line') {
    const da: XY2 = [-a.n[1], a.n[0]], db: XY2 = [-b.n[1], b.n[0]], den = cross2(da, db);
    if (Math.abs(den) < 1e-12) return [];
    const t = cross2(sub2(b.p, a.p), db) / den; return [[a.p[0] + da[0] * t, a.p[1] + da[1] * t]];
  }
  if (a.kind === 'circle' && b.kind === 'line') return meet2(b, a);
  if (a.kind === 'line' && b.kind === 'circle') {
    const dir: XY2 = [-a.n[1], a.n[0]], w = sub2(a.p, b.c), along = w[0] * dir[0] + w[1] * dir[1], dist = w[0] * a.n[0] + w[1] * a.n[1], h2 = b.R * b.R - dist * dist;
    if (h2 < 0) return [];
    const foot: XY2 = [a.p[0] - dir[0] * along, a.p[1] - dir[1] * along], h = Math.sqrt(h2);
    return [[foot[0] + dir[0] * h, foot[1] + dir[1] * h], [foot[0] - dir[0] * h, foot[1] - dir[1] * h]];
  }
  const A = a as Extract<Section2, { kind: 'circle' }>, B = b as Extract<Section2, { kind: 'circle' }>, w = sub2(B.c, A.c), D = len2(w);
  if (!(D > 1e-12) || D > A.R + B.R || D < Math.abs(A.R - B.R)) return [];
  const x = (D * D + A.R * A.R - B.R * B.R) / (2 * D), h = Math.sqrt(Math.max(0, A.R * A.R - x * x)), u: XY2 = [w[0] / D, w[1] / D];
  return [[A.c[0] + u[0] * x - u[1] * h, A.c[1] + u[1] * x + u[0] * h], [A.c[0] + u[0] * x + u[1] * h, A.c[1] + u[1] * x - u[0] * h]];
}
/** The point of a section curve nearest X (a ball's tangent point). */
function foot2(c: Section2, X: XY2): XY2 {
  if (c.kind === 'line') { const d = (X[0] - c.p[0]) * c.n[0] + (X[1] - c.p[1]) * c.n[1]; return [X[0] - c.n[0] * d, X[1] - c.n[1] * d]; }
  const w = sub2(X, c.c), l = len2(w); return [c.c[0] + w[0] / l * c.R, c.c[1] + w[1] / l * c.R];
}
/** The short way round a circle from P to Q about M. */
const shortWay = (P: XY2, Q: XY2, M: XY2): 'cw' | 'ccw' => cross2(sub2(P, M), sub2(Q, M)) > 0 ? 'ccw' : 'cw';
/** A closed loop's signed area (counter-clockwise positive), its arcs exact: each chord's triangle plus the arc's segment. */
function loopArea2(loop: readonly ProfileSegmentInput[]): number {
  let A = 0;
  loop.forEach((g, k) => {
    const P = g.start as XY2, Q = loop[(k + 1) % loop.length].start as XY2; A += cross2(P, Q) / 2;
    if (g.kind === 'arc') { const M = g.center as XY2, R = len2(sub2(P, M)), phi = Math.abs(Math.atan2(cross2(sub2(P, M), sub2(Q, M)), (P[0] - M[0]) * (Q[0] - M[0]) + (P[1] - M[1]) * (Q[1] - M[1]))); A += (g.direction === 'ccw' ? 1 : -1) * R * R / 2 * (phi - Math.sin(phi)); }
  });
  return A;
}
/**
 * A closed loop's signed area and first moment about the y axis (∫∫ x dA), by Green's theorem (∮ x dy, ∮ x²/2 dy):
 * lines in closed form, arcs integrated exactly over their sweep.
 */
function loopMoments2(loop: readonly ProfileSegmentInput[]): { area: number; moment: number } {
  let area = 0, moment = 0;
  loop.forEach((g, k) => {
    const P = g.start as XY2, Q = loop[(k + 1) % loop.length].start as XY2;
    if (g.kind !== 'arc') { area += (Q[1] - P[1]) * (P[0] + Q[0]) / 2; moment += (Q[1] - P[1]) * (P[0] * P[0] + P[0] * Q[0] + Q[0] * Q[0]) / 6; return; }
    const M = g.center as XY2, R = len2(sub2(P, M)), t0 = Math.atan2(P[1] - M[1], P[0] - M[0]);
    let sweep = Math.atan2(Q[1] - M[1], Q[0] - M[0]) - t0;
    if (g.direction === 'ccw') { while (sweep <= 0) sweep += 2 * Math.PI; } else { while (sweep >= 0) sweep -= 2 * Math.PI; }
    const t1 = t0 + sweep, cx = M[0], S1 = (t: number) => Math.sin(t), C2 = (t: number) => t / 2 + Math.sin(2 * t) / 4, C3 = (t: number) => Math.sin(t) - Math.sin(t) ** 3 / 3;
    // x = cx + R cos t, dy = R cos t dt.
    area += cx * R * (S1(t1) - S1(t0)) + R * R * (C2(t1) - C2(t0));
    moment += (cx * cx * R * (S1(t1) - S1(t0)) + 2 * cx * R * R * (C2(t1) - C2(t0)) + R ** 3 * (C3(t1) - C3(t0))) / 2;
  });
  return { area, moment };
}
/** Whether the segment y = h, x in [x0, x1] lies inside the region bounded by these polylines (even-odd), its boundary included. */
function lineInSoup(lines: readonly (readonly XY2[])[], h: number, x0: number, x1: number, tol: number): boolean {
  const segs: [XY2, XY2][] = lines.flatMap(l => l.slice(1).map((q, k) => [l[k], q] as [XY2, XY2]));
  const onEdge = (x: number, y: number) => segs.some(([p, q]) => { const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy, s = l2 > 0 ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2)) : 0; return Math.hypot(p[0] + s * dx - x, p[1] + s * dy - y) <= tol; });
  const inside = (x: number, y: number) => onEdge(x, y) || segs.filter(([p, q]) => (p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])).length % 2 === 1;
  const xs = [x0, x1];
  for (const [p, q] of segs) { if (Math.abs(p[1] - h) <= tol) xs.push(p[0]); if ((p[1] - h) * (q[1] - h) < 0) xs.push(p[0] + (h - p[1]) * (q[0] - p[0]) / (q[1] - p[1])); }
  const cuts = [...new Set(xs.filter(x => x >= x0 - tol && x <= x1 + tol).map(x => Math.min(x1, Math.max(x0, x))))].sort((p, q) => p - q);
  return cuts.every((x, k) => inside(x, h) && (k === 0 || inside((cuts[k - 1] + x) / 2, h)));
}

/**
 * A face fillet between faces that all run along one direction — a plane along a cylinder's axis (a tube on a plate),
 * or two parallel cylinders (two bosses joined) — that need not touch. In the section square to the direction the faces
 * are lines and circles: the round's centre is where their curves pushed off by the radius meet (outward for an inside
 * corner, filled; inward for an outside one, cut), and its section — the corner where the curves meet, along one face
 * to its tangent point, the round's short arc, back along the other — is extruded over the length both faces run.
 * Faces that meet at two corners (a tube on a plate, two joined bosses) are rounded at both.
 * Each face (a cylinder may be partial) must hold its tangent line there; the volume is checked against the section's
 * exact area.
 */
function parallelFillet(brep: Brep, source: Solid, A0: { name: string; faces: readonly BrepFace[] }, B0: { name: string; faces: readonly BrepFace[] }, r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid {
  const sides = [A0, B0].map(S => ({ ...S, g: faceGeometry(S.faces[0]) }));
  const cyl = sides.find(S => S.g.kind === 'cylinder')!.g as Extract<FaceGeometry, { kind: 'cylinder' }>, d = unit(cyl.a), O = cyl.c;
  for (const S of sides) {
    for (const x of S.faces.slice(1)) { const h = faceGeometry(x); if (h.kind !== S.g.kind || (h.kind === 'plane' && S.g.kind === 'plane' && len(sub(unit(h.n), unit(S.g.n))) > 1e-9) || (h.kind === 'cylinder' && S.g.kind === 'cylinder' && (Math.abs(h.r - S.g.r) > 1e-9 * Math.max(1, S.g.r) || len(cross(sub(h.c, S.g.c), unit(S.g.a))) > 1e-9 * Math.max(1, S.g.r)))) fail('CAPABILITY', `[FACE_FILLET_FACE] the faces named ${S.name} are not one surface`); }
    if (S.g.kind === 'plane' && Math.abs(dot(unit(S.g.n), d)) > 1e-9) fail('CAPABILITY', `[FACE_FILLET_FACE] ${S.name} is neither across nor along the cylinder's axis`);
    if (S.g.kind === 'cylinder' && len(cross(unit(S.g.a), d)) > 1e-9) fail('CAPABILITY', `[FACE_FILLET_FACE] ${A0.name} and ${B0.name} are cylinders whose axes are not parallel`);
  }
  const e1 = unit(Math.abs(d[0]) < 0.9 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0])), e2 = cross(d, e1);
  const to2 = (q: Point): XY2 => [dot(sub(q, O), e1), dot(sub(q, O), e2)], hOf = (q: Point) => dot(sub(q, O), d);
  const curves: Section2[] = sides.map(S => S.g.kind === 'plane' ? { kind: 'line', p: to2(S.g.o), n: [dot(unit(S.g.n), e1), dot(unit(S.g.n), e2)] } : { kind: 'circle', c: to2((S.g as { c: Point }).c), R: (S.g as { r: number }).r, out: (S.g as { out: 1 | -1 }).out });
  const edges = new Map(brep.edges.map(e => [e.id, e]));
  // Each face's boundary (edges not shared between its pieces), sampled.
  const bounds = sides.map(S => {
    const loops = new Set(S.faces.flatMap(x => x.loops)), uses = new Map<string, number>();
    for (const c of brep.coedges) if (loops.has(c.loop)) uses.set(c.edge, (uses.get(c.edge) ?? 0) + 1);
    return [...uses].filter(([, k]) => k === 1).map(([id]) => { const e = edges.get(id)!, [t0, t1] = curveDomain(e.curve), N = e.curve.degree === 1 && e.curve.controlPoints.length === 2 ? 1 : 64; return Array.from({ length: N + 1 }, (_, i) => evaluateCurve(e.curve, t0 + (t1 - t0) * i / N) as Point); });
  });
  const hs = bounds.map(b => b.flat().map(hOf)), lo = Math.max(...hs.map(h => Math.min(...h))), hi = Math.min(...hs.map(h => Math.max(...h)));
  const size = Math.max(1, r, ...curves.map(c => c.kind === 'circle' ? c.R + len2(c.c) : len2(c.p))), tol = 1e-9 * size;
  if (!(hi - lo > tol)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A0.name} and ${B0.name} do not run side by side`);
  // Whether a face holds the line along the direction through a section point T, over [lo, hi].
  const holds = (k: number, T: XY2) => {
    const c = curves[k], lines = c.kind === 'line'
      ? bounds[k].map(l => l.map(q => [hOf(q), cross2(c.n, sub2(to2(q), T))] as XY2))
      : bounds[k].map(l => l.map(q => { const w = sub2(to2(q), c.c), t = sub2(T, c.c); return [hOf(q), c.R * Math.atan2(cross2(t, w), t[0] * w[0] + t[1] * w[1])] as XY2; })).flatMap(l => {
        // (Split where the angle jumps round the back of the cylinder.)
        const parts: XY2[][] = [[]]; l.forEach((p, i) => { if (i && Math.abs(p[1] - l[i - 1][1]) > Math.PI * c.R) parts.push([]); parts[parts.length - 1].push(p); }); return parts.filter(x => x.length > 1);
      });
    return lineInSoup(lines, 0, lo, hi, 1e-7 * size);
  };
  // The round's centre: the curves pushed off by r meet there, outward (inside corner) or inward (outside corner).
  const found: { s: 1 | -1; X: XY2; tA: XY2; tB: XY2; C: XY2 }[] = [];
  for (const s of [1, -1] as const) for (const X of meet2(offset2(curves[0], s * r), offset2(curves[1], s * r))) {
    const tA = foot2(curves[0], X), tB = foot2(curves[1], X), corners = meet2(curves[0], curves[1]).sort((p, q) => len2(sub2(p, X)) - len2(sub2(q, X)));
    if (!corners.length || !holds(0, tA) || !holds(1, tB)) continue;
    found.push({ s, X, tA, tB, C: corners[0] });
  }
  if (!found.length) fail('GEOMETRY', `[FACE_FILLET_RADIUS] no ${r} mm round is tangent to both ${A0.name} and ${B0.name} where they run (or their surfaces do not meet)`);
  // Every corner the faces meet at is rounded, all inside or all outside; both kinds at once is no one corner's round.
  const corners = found.filter((f, k) => found.findIndex(g => len2(sub2(g.C, f.C)) <= 1e-9 * size) === k);
  if (corners.some(f => f.s !== corners[0].s)) fail('CAPABILITY', `[FACE_FILLET_FACES] ${A0.name} and ${B0.name} make an inside and an outside corner: a ${r} mm round fits both ways`);
  const inside = corners[0].s > 0, L = hi - lo, m: BrepAffine['matrix'] = [e1[0], e2[0], d[0], e1[1], e2[1], d[1], e1[2], e2[2], d[2]];
  // Each section: corner → along the first face → the round's short arc → along the second face back to the corner.
  const along = (c: Section2, P: XY2, Q: XY2): ProfileSegmentInput => c.kind === 'line' ? { kind: 'line', start: P } : { kind: 'arc', start: P, center: c.c, direction: shortWay(P, Q, c.c) };
  let out = source;
  corners.forEach(({ X, tA, tB, C }, k) => {
    const outer: ProfileSegmentInput[] = [along(curves[0], C, tA), { kind: 'arc', start: tA, center: X, direction: shortWay(tA, tB, X) }, along(curves[1], tB, C)];
    const area = Math.abs(loopArea2(outer)), tag = `${at}.q${k}`, name = k ? `${at}.round${k}` : `${at}.round`;
    const tool = affine({ kind: 'upright', solid: prismaticFromProfile({ outer, height: L, from: lo, tag }) }, m, O, x => x === `${tag}.side1` ? name : x);
    const held = boolean(out, tool, 'intersection', at), was = empty(held) ? 0 : exactVolume(held), before = exactVolume(out);
    const next = boolean(out, tool, inside ? 'union' : 'difference', at), change = exactVolume(next) - before, pieces = next.kind === 'brep' ? next.brep.bodies.length : 1, want = inside ? area * L - was : -was;
    if (pieces !== 1 || Math.abs(change - want) > 1e-7 * Math.max(before, area * L) || !(Math.abs(want) > 1e-9 * area * L)) fail('GEOMETRY', `[FACE_FILLET_NOT_CLEAR] the round between ${A0.name} and ${B0.name} would ${inside ? 'add' : 'take'} ${+Math.abs(change).toPrecision(9)} mm³ (${+Math.abs(want).toPrecision(9)} expected)${pieces !== 1 ? ` and leave ${pieces} bodies` : ''}`);
    out = next;
  });
  return out;
}

/**
 * Whether the segment y = h, x in [x0, x1] lies in a face (its rings in the plane's coordinates; the first of each
 * piece outer, the rest holes — tested by even-odd crossing, so the order does not matter), its boundary included.
 */
function lineInFace(rings: readonly (readonly [number, number][])[], h: number, x0: number, x1: number, tol: number): boolean {
  const onEdge = (x: number, y: number) => rings.some(ring => ring.some((p, k) => { const q = ring[(k + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy;
    const s = l2 > 0 ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2)) : 0; return Math.hypot(p[0] + s * dx - x, p[1] + s * dy - y) <= tol; }));
  const inside = (x: number, y: number) => onEdge(x, y) || rings.reduce((n, ring) => n + ring.filter((p, k) => { const q = ring[(k + 1) % ring.length]; return (p[1] > y) !== (q[1] > y) && x < p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1]); }).length, 0) % 2 === 1;
  // Where the boundary meets the line: between those, the line is wholly in or out.
  const xs = [x0, x1];
  for (const ring of rings) ring.forEach((p, k) => { const q = ring[(k + 1) % ring.length];
    if (Math.abs(p[1] - h) <= tol) xs.push(p[0]);
    if ((p[1] - h) * (q[1] - h) < 0) xs.push(p[0] + (h - p[1]) * (q[0] - p[0]) / (q[1] - p[1])); });
  const cuts = [...new Set(xs.filter(x => x >= x0 - tol && x <= x1 + tol).map(x => Math.min(x1, Math.max(x0, x))))].sort((p, q) => p - q);
  return cuts.every((x, k) => inside(x, h) && (k === 0 || inside((cuts[k - 1] + x) / 2, h)));
}

function boxSolid(min: Point, max: Point, tag: string): Solid {
  const ring: ProfileSegmentInput[] = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(start => ({ kind: 'line', start: start as XY }));
  return { kind: 'upright', solid: prismaticFromProfile({ outer: ring, height: max[2] - min[2], from: min[2], tag }) };
}

/** Upright Booleans stay upright; otherwise both bodies must be planar for the exact polyhedral Boolean. */
export function boolean(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, edgeFitTolerance?: number): Solid {
  if (profiling) profiling.booleans++;
  if (empty(b)) return op === 'intersection' ? b : a;
  if (empty(a)) return op === 'union' ? b : a;
  if (a.kind === 'upright' && b.kind === 'upright') {
    // (Lumps that touch along an edge or at a point stay separate bodies, as lumps apart are: D204.)
    return { kind: 'upright', solid: booleanPrismatic(a.solid, b.solid, op) };
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
  if (A && B && planarBrep(A) && planarBrep(B)) return { kind: 'brep', brep: planarBoolean(A, B, op, at) };
  // Planes and cylinders of any axis.
  const toBrep = (s: Solid) => s.kind === 'upright' ? brepFromPrismatic(s.solid, { id: at + '_in' }) : s.brep;
  try { return { kind: 'brep', brep: booleanAnalytic(toBrep(a), toBrep(b), op, { id: at, ...(edgeFitTolerance === undefined ? {} : { edgeFitTolerance: edgeFitTolerance }) }) }; }
  catch (cause) {
    if (cause instanceof BrepError && /not supported yet/.test(cause.message)) throw new CadPartError('CAPABILITY', at, cause.message.replace(/^B-rep: (analytic Boolean: )?/, ''));
    throw cause;
  }
}
/**
 * Two bodies of planes only: the exact rational polyhedral Boolean. It needs each face's vertices exactly coplanar; a
 * body off the axes (a member on an oblique line, a split's slanted cut) has them so only to binary64 (~1e-15), and the
 * polyhedral route refuses the face (reason `NOT_PLANAR_WITHIN_FLOAT`, D126). Then the analytic Boolean, which works on the planes in binary64,
 * takes the pair (FR3a, D125: a mitred sharp tube on a 120° or 3D corner, and two such tubes welded, were refused).
 */
function planarBoolean(a: Brep, b: Brep, op: 'union' | 'difference' | 'intersection', at: string): Brep {
  if (profiling) profiling.planarBooleans++;
  try { return booleanPolyhedra(a, b, op, { id: at }); }
  catch (cause) { if (!(cause instanceof BrepError && cause.reason === 'NOT_PLANAR_WITHIN_FLOAT')) throw cause; }
  return booleanAnalytic(a, b, op, { id: at });
}
/**
 * Copies united in a balanced tree (neighbours first, so each Boolean joins two bodies of like size, not
 * one growing body and a copy).
 */
function unionAll(list: Solid[], at: string): Solid {
  let level = list;
  while (level.length > 1) { const next: Solid[] = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? boolean(level[i], level[i + 1], 'union', at) : level[i]); level = next; }
  return level[0];
}
export const volumeOfSolid = (s: Solid) => s.kind === 'upright' ? prismaticVolume(s.solid) : s.brep.bodies.length ? brepMassProperties(s.brep, 1, { segmentsPerQuarter: 8, quadratureSegments: 0 }).volume : 0;

function affine(s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: ((n: string) => string) | string): Solid {
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
export function moveAll(parts: readonly Part[], m: BrepAffine['matrix'], o: Point, preserveNativeSI = false): Result {
  return { kind: 'solid', parts: parts.map((p): Part => {
    const exact = p.mass ?? (p.solid.kind === 'upright' ? ((s: PrismaticSolid) => (d: number) => prismaticMassProperties(s, d))(p.solid.solid) : undefined);
    return { solid: affine(p.solid, m, o), moved: { from: p, m, o }, ...(exact ? { mass: (d: number) => movedMass(exact(d), m, o, preserveNativeSI) } : {}) };
  }) };
}
function movedMass(p: MassProperties, m: BrepAffine['matrix'], o: Point, preserveNativeSI = false): MassProperties {
  const k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]))), R = m.map(x => x / k);
  const c = p.centroid, I = p.inertia, k5 = k ** 5;
  const RIRt = [0, 1, 2].map(i => [0, 1, 2].map(j => { let sum = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum += R[3 * i + a] * I[a][b] * R[3 * j + b]; return sum * k5; })) as [[number, number, number], [number, number, number], [number, number, number]];
  const moved = unsupportedNativeMass({ volume: p.volume * k ** 3, mass: p.mass * k ** 3, method: p.method, inertia: RIRt,
    centroid: [0, 1, 2].map(i => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i]) as Point }, 'transformed');
  // Only the translate feature may retain an existing integral basis: central moments do not
  // change under translation. Identity rotations/scales and unsupported bases stay unsupported.
  if (preserveNativeSI && m.every((x, i) => x === (i === 0 || i === 4 || i === 8 ? 1 : 0)) && readNativeSIInertia(p).ok) transferNativeMassBasis(p, moved);
  return moved;
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
function sweepBrep(profile: readonly ProfileSegmentInput[], steps: readonly SweepStep[], at: string, fail: Tools['fail'], through?: XY, sideTags?: readonly string[]): { brep: Brep; mass: (density: number) => MassProperties } {
  if (profiling) profiling.sweeps++;
  // The path runs through the profile's centroid (or a given point): the profile is moved there, the body back.
  const centre = through ?? buildProfileLoop(profile, { maximumSegments: 1024 }).centroid;
  const outer: ProfileSegmentInput[] = profile.map(g => g.kind === 'line' ? { kind: 'line', start: [g.start[0] - centre[0], g.start[1] - centre[1]] } : { ...g, start: [g.start[0] - centre[0], g.start[1] - centre[1]], center: [g.center[0] - centre[0], g.center[1] - centre[1]] });
  let o: Point = [centre[0], centre[1], 0], x: Point = [1, 0, 0], y: Point = [0, 1, 0], z: Point = [0, 0, 1];
  // (Ids are identifiers; the pieces' faces are named `${at}.s${k}.…`.)
  const place = (b: Brep, k: number): Brep => transformBrep(b, { matrix: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], offset: [o[0], o[1], o[2]] }, n => n.split(`${at}_s${k}`).join(`${at}.s${k}`));
  const rot = (v: Point, d: Point, t: number): Point => add(add(scale(v, Math.cos(t)), scale(cross(d, v), Math.sin(t))), scale(d, dot(d, v) * (1 - Math.cos(t))));
  // Each piece's mass in its own frame; these add only when the pieces are glued without overlap.
  const pieces: Brep[] = [], masses: { local: (density: number) => MassProperties; axes: [Point, Point, Point]; offset: Point }[] = [];
  steps.forEach((st, k) => {
    const tag = `${at}_s${k}`;
    if (st.kind === 'straight') {
      const prism = prismaticFromProfile({ outer, height: st.length, tag, ...(sideTags ? { sideTags: { outer: sideTags } } : {}) });
      masses.push({ local: d => prismaticMassProperties(prism, d), axes: [x, y, z], offset: o });
      pieces.push(place(brepFromPrismatic(prism, { id: tag }), k));
      o = add(o, scale(z, st.length));
      return;
    }
    // The bend axis lies in the profile's plane, `radius` towards the side, square to that side.
    const side = st.toward, sx = side === 'x' ? 1 : side === '-x' ? -1 : 0, sy = side === 'y' ? 1 : side === '-y' ? -1 : 0;
    const origin: XY = [sx * st.radius, sy * st.radius], direction: XY = sx ? [0, 1] : [1, 0];
    let turned: Brep;
    try { turned = revolveProfile({ id: tag, profile: outer, axis: { origin, direction }, angle: st.angle, ...(sideTags ? { sideTags } : {}) }); }
    catch (cause) { if (cause instanceof BrepError && /axis/.test(cause.message)) fail('PARAMETER', `bend ${k}: the profile reaches the bend's axis (use a radius larger than the profile's reach towards ${side})`); throw cause; }
    pieces.push(place(turned!, k));
    const input = { id: tag, profile: outer, axis: { origin, direction }, angle: st.angle };
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
  let body = pieces[0], additive = true;
  for (const p of pieces.slice(1)) {
    const glued = separate ? glueAtSharedFace(body, p, { family: 'sweep', id: at }) : null;
    if (!glued) additive = false;
    body = glued ?? booleanAnalytic(body, p, 'union', { id: at });
  }
  return { brep: body, mass: d => additive
    ? combineMassProperties(masses.map(m => ({ props: m.local(d), axes: m.axes, offset: m.offset })))
    : brepMassProperties(body, d) };
}

// ---- shell -----------------------------------------------------------------------------------------------
/**
 * An upright body of one section, hollowed: the section eroded by the thickness (exact for lines and
 * arcs), extruded from the thickness above the bottom to below the top (or through an open top or
 * bottom), and taken away; open side walls let the hollow run through them.
 */
/** The shell of a part, by how it was made (its mass exact when that can be). */
function shellOf(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  if (profiling) profiling.shells++;
  // A mesh body (facet faces): its cavity its triangles offset in, the wall it achieves measured (R11.3, D114).
  const s = part.solid;
  if (s.kind === 'brep' && s.brep.faces.length && s.brep.faces.every(isFacetFace)) {
    if (open.length) fail('CAPABILITY', `opening a face of a mesh body (${open.join(', ')}) is not supported yet: shell it closed`);
    if (s.brep.bodies.some(b => b.kind === 'sheet')) fail('CAPABILITY', 'a mesh sheet encloses nothing to shell: thicken it instead');
    const mesh = facetTriangles(s.brep);
    try {
      const r = meshInnerOffset(mesh.positions, mesh.indices, t);
      const cavity = facetBrepFromTriangles(r.positions, mesh.indices, { id: `${at}_in`, maximumTriangles: CadPartLimits.meshTriangles, groups: mesh.groups, groupName: g => `${at}.in.${mesh.names[g]}`, crease: 180 });
      return { solid: { kind: 'brep', brep: withCavities(s.brep, cavity, { family: 'shell', id: at }) }, shell: r.report };
    } catch (cause) {
      const m = cause instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(cause.message) : null;
      if (m) fail('CAPABILITY', m[1]);
      if (isMeshBrepError(cause)) fail('GEOMETRY', cause.message);
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

/** A body less hollows inside it: masses and moments subtracted (inertia via the origin; mm and g). */
function massLess(outer: MassProperties, inner: readonly MassProperties[]): MassProperties {
  const about = (p: MassProperties) => { const c = p.centroid, cc = c[0] ** 2 + c[1] ** 2 + c[2] ** 2; return p.inertia.map((row, i) => row.map((v, j) => v + p.mass * ((i === j ? cc : 0) - c[i] * c[j]))); };
  const m = outer.mass - inner.reduce((a, p) => a + p.mass, 0), V = outer.volume - inner.reduce((a, p) => a + p.volume, 0);
  const c = [0, 1, 2].map(i => (outer.mass * outer.centroid[i] - inner.reduce((a, p) => a + p.mass * p.centroid[i], 0)) / m) as Point;
  const T = about(outer); for (const p of inner) about(p).forEach((row, i) => row.forEach((v, j) => { T[i][j] -= v; }));
  const cc = c[0] ** 2 + c[1] ** 2 + c[2] ** 2;
  const I = T.map((row, i) => row.map((v, j) => v - m * ((i === j ? cc : 0) - c[i] * c[j]))) as [[number, number, number], [number, number, number], [number, number, number]];
  return unsupportedNativeMass({ volume: V, mass: m, centroid: c, inertia: I, method: outer.method }, 'difference');
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
  return loop.map((g, i): LineArc => g.kind === 'line' ? { kind: 'line', a: g.start, b: g.end, tag: tagOf(i) } : { kind: 'arc', c: g.center, r: g.radius, t0: g.startAngle, sweep: g.sweep, tag: tagOf(i) });
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
  if (input.angle !== 360) fail('CAPABILITY', 'shell works on bodies turned a full turn yet (this one stops at its start and end faces)');
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
  const pieces = half.map((r, k) => ({ id: `${at}_in${k}`, profile: profileOfRing(r.outer), axis: input.axis, angle: 360 }));
  const hollow = mergeBreps(pieces.map(pc => renamed(revolveProfile(pc), `${at}_in`, `${at}.in`)), { family: 'revolve', id: `${at}_hollow` });
  // The hollow inside the body: the eroded half within the profile (an opening runs out past it).
  const inside = booleanCurveRegions(ringsOfRegions(half), [orient(ring)], 'intersection', tol).map((r, k) => ({ id: `${at}_m${k}`, profile: profileOfRing(r.outer), axis: input.axis, angle: 360 }));
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
  const ring = sectionRing(swept.profile, swept.sideTags), tol = curveTolerance([ring]), centre = buildProfileLoop(swept.profile, { maximumSegments: 1024 }).centroid;
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
  if (profiling) profiling.finishes++;
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
        if (back >= L1 - tol || back >= L2 - tol) fail('PARAMETER', `[RADIUS_EXCEEDS_FACE] edge ${c.name}: ${kind} ${size} mm is too large for walls of ${+L1.toFixed(6)} and ${+L2.toFixed(6)} mm`);
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
  if (planarBrep(body) && !ends.some(Boolean)) return { kind: 'brep', brep: planarBoolean(body, wedge, convex ? 'difference' : 'union', at) };
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
/** What an output's functions need beyond its data: the part it was made from, and its worked-out values. */
interface OutputState { readonly part: Part; validated?: BrepCheckReport; area?: number; readonly flats: Map<string, FlatPattern> }
const outputState = new WeakMap<CadPartOutput, OutputState>();
function makeOutput(id: string, feature: string, part: Part): CadPartOutput {
  const brep = brepOf(part, id.replace('/', '_'));
  const output: CadPartOutput = Object.freeze({
    id, feature, representation: representation(part.solid), brep, bodyCount: brep.bodies.length, ...(part.cylindricalWrap ? { cylindricalWrap: part.cylindricalWrap } : {}), ...(part.gear ? { gear: part.gear } : {}), ...(part.gearPlace ? { gearPlacement: part.gearPlace } : {}), ...(part.rack ? { rack: part.rack } : {}), ...(part.rackPlace ? { rackPlacement: part.rackPlace } : {}), ...(part.internalGear ? { internalGear: part.internalGear } : {}), ...(part.internalPlace ? { internalGearPlacement: part.internalPlace } : {}), ...(part.bevelGear ? { bevelGear: part.bevelGear } : {}), ...(part.bevelPlace ? { bevelGearPlacement: part.bevelPlace } : {}), ...(part.worm ? { worm: part.worm } : {}), ...(part.wormPlace ? { wormPlacement: part.wormPlace } : {}), ...(part.wormWheel ? { wormWheel: part.wormWheel } : {}), ...(part.wormWheelPlace ? { wormWheelPlacement: part.wormWheelPlace } : {}), ...(part.spring ? { spring: part.spring } : {}), ...(part.cam ? { cam: part.cam } : {}), ...(part.sprocket ? { sprocket: part.sprocket } : {}), ...(part.pulley ? { pulley: part.pulley } : {}), ...(part.belt ? { belt: part.belt } : {}), ...(part.coupling ? { coupling: part.coupling } : {}), ...(part.connector ? { connector: part.connector } : {}), ...(part.connectorBody ? { connectorBody: part.connectorBody } : {}), ...(part.shaft ? { shaft: part.shaft } : {}), ...(part.key ? { key: part.key } : {}), ...(part.keyway ? { keyway: part.keyway } : {}), ...(part.ring ? { ring: part.ring } : {}), ...(part.pin ? { pin: part.pin } : {}), ...(part.bearing ? { bearing: part.bearing } : {}), ...(part.gland ? { gland: part.gland } : {}), ...(part.oring ? { oring: part.oring } : {}), ...(part.subd ? { subd: part.subd } : {}), ...(part.decimate ? { decimate: part.decimate } : {}), ...(part.fillet ? { fillet: part.fillet } : {}), ...(part.shell ? { shell: part.shell } : {}), ...(part.sheet ? { sheet: part.sheet } : {}), ...(part.member ? { member: part.member } : {}), ...(part.gusset ? { gusset: part.gusset } : {}), ...(part.endCap ? { endCap: part.endCap } : {}), ...(part.bead ? { bead: part.bead } : {})
  });
  outputState.set(output, { part, flats: new Map() });
  return output;
}
/** An output not made by evaluateCadPart (a copy, a deserialised one): its state from its B-rep alone. */
const stateOf = (o: CadPartOutput): OutputState => { let st = outputState.get(o); if (!st) { st = { part: { solid: { kind: 'brep', brep: o.brep }, brep: o.brep }, flats: new Map() }; outputState.set(o, st); } return st; };

/**
 * An output's mass properties (R7.3b, MMGS): `density` in g/cm³ (1 by default); volume mm³, mass g, centroid mm,
 * inertia g·mm² about the centroid. An open mesh (a sheet) encloses nothing: refused.
 */
export function massPropertiesOf(output: CadPartOutput, density = 1): MassProperties {
  const { part } = stateOf(output), brep = output.brep;
  if ((output.cylindricalWrap || brep.source?.family === 'cylindrical-wrap-assembly') && !part.mass) throw new CadPartError('CAPABILITY', output.id, 'cylindrical wrap mass requires a live evaluated provider; load and evaluate the saved document recipe');
  if (brep.bodies.some(b => b.kind === 'sheet')) throw new CadPartError('GEOMETRY', output.id, 'an open mesh (a sheet) encloses no volume: it has no mass');
  return part.mass ? part.mass(density) : part.solid.kind === 'upright' ? prismaticMassProperties(part.solid.solid, density) : brepMassProperties(brep, density, { segmentsPerQuarter: 32 });
}
/** An output's surface area (mm²) over its exact surfaces (brepSurfaceArea), worked out once. */
export function surfaceAreaOf(output: CadPartOutput): number { const st = stateOf(output); return st.area ??= brepSurfaceArea(output.brep); }
/**
 * An output's L0 validation (checkBrep with `strict`): topology, edges on their surfaces, loops that do not cross, no
 * slivers, tolerances under the cap. Worked out once; an imported STEP body is reported here rather than refused.
 */
export function checkOutput(output: CadPartOutput): BrepCheckReport { const st = stateOf(output); return st.validated ??= checkBrep(output.brep, { strict: true }); }
/** Binary STL (little-endian, 80-byte header) of an output's display tessellation. */
export function exportStl(output: CadPartOutput, options: { readonly segmentsPerQuarter?: number } = {}): Uint8Array { return stl(output.brep, options.segmentsPerQuarter ?? 16); }
/** A sheet-metal output's flat pattern: its fixed face and K-factor as made unless given, else its bend table bend by bend. */
export function flatPatternOf(output: CadPartOutput, options: { readonly fixedFace?: string; readonly kFactor?: number } = {}): FlatPattern {
  const st = stateOf(output), s = st.part.sheet, id = output.id;
  if (!s) throw new CadPartError('CAPABILITY', id, 'not made as sheet metal: give its thickness and K-factor to the kernel\'s flatPattern');
  const k = options.kFactor ?? s.kFactor, key = `${options.fixedFace ?? s.fixedFace}|${k ?? 'table'}`;
  const hit = st.flats.get(key); if (hit) return hit;
  try {
    const flat = sheetFlatPattern(output.brep, { thickness: s.thickness, ...(k !== undefined ? { kFactor: k } : { bendTable: s.bendTable! }), fixedFace: options.fixedFace ?? s.fixedFace, bendNames: s.bends.map(b => ({ name: b.name, faces: [b.inner, b.outer] })) });
    st.flats.set(key, flat); return flat;
  } catch (cause) {
    if (isFlatPatternError(cause)) throw new CadPartError(cause.code === 'CUT_ACROSS_BEND' ? 'CAPABILITY' : 'GEOMETRY', id, cause.message);
    throw cause;
  }
}
function stl(brep: Brep, segmentsPerQuarter: number): Uint8Array {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter });
  return encodeBinaryStl(mesh.positions, mesh.indices, 'barocss part (mm)');
}

/**
 * The part model's own helpers a feature family's module uses: passed in, never imported (they share this module's state,
 * the facet limit; `boolean` stays here). Frozen, so no family can swap one (R5.3, D221).
 */
const HELPERS = Object.freeze({ isRecord, brepOf, finishEdges, CadPartLimits, stepSizeProblem, splitBodies, meshArrayOk, facetBody, facetTriangles, brepBodies, shellOf, bendK, frameOf, framed, placed, sheetCornerRelief, sheetFlange, withSheet });
export type PartHelpers = typeof HELPERS;
