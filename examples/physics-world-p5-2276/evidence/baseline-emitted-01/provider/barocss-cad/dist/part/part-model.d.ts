import { type Brep, type BrepCheckReport } from '../brep/brep-core.js';
import { type PrismaticSolid } from '../features/prismatic-solid.js';
import { type XY } from '../brep/curved-arrangement.js';
import { type CylindricalWrapReport } from '../features/cylindrical-wrap-feature.js';
import { type FillFeaturePatternRegion } from '../features/fill-cut-pattern.js';
import { type RawNurbsPath } from '../features/curve-cut-pattern.js';
import { type SubdSummary } from '../features/subd.js';
import type { CadBandReport } from '../features/band-surface.js';
import { type DecimateReport } from '../mesh/mesh-decimate.js';
import type { FilletReport } from '../blend/rolling-ball.js';
import { type SideTags } from '../document/side-names.js';
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
import { type RevolveInput } from '../features/revolve.js';
import { type BrepAffine } from '../brep/brep-transform.js';
import { type MassProperties } from '../brep/solid-mass.js';
import { type LoftInput, type LoftSectionFrame, type LoftSectionInput } from '../features/loft.js';
import { type MeshShellReport } from '../mesh/mesh-offset.js';
import { type BendTable, type SheetReport } from '../frame-sheet/sheet-metal.js';
import { type FlatPattern } from '../frame-sheet/sheet-flat.js';
import { type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { type BeadReport, type EndCapReport, type GussetReport, type BeadJointRef, type BeadSharedComponent } from '../frame-sheet/frame-weldment.js';
import { type FrameAnchor, type FrameMemberReport } from '../frame-sheet/frame-section.js';
import type { Point } from '../types.js';
import { brepBodies } from './part-shell.js';
import type { GussetPlaced, MemberPlaced, EndpointBead } from './part-frame.js';
import { type CadPartNameSignature } from './part-expect.js';
import { KernelError } from '../core/barocss-error.js';
import { type CadRefusalCode } from '../core/error-codes.js';
export type CadPartDim = number | {
    readonly parameter: string;
};
export type CadPartAxis = 'x' | 'y' | 'z';
export type CadPartPoint2 = readonly [CadPartDim, CadPartDim];
export type CadPartPoint3 = readonly [CadPartDim, CadPartDim, CadPartDim];
export type CadPartLoopSegment = {
    readonly kind: 'line';
    readonly start: CadPartPoint2;
} | {
    readonly kind: 'arc';
    readonly start: CadPartPoint2;
    readonly center: CadPartPoint2;
    readonly direction: 'ccw' | 'cw';
};
type Base = {
    readonly id: string;
};
/**
 * Where a sketch lies: its X runs along `xAxis` and its Y along normal × xAxis from `origin`, and its
 * solids grow along `normal` (both directions are unit vectors after normalising); any plane, tilted
 * ones included. A body built on a plane with a vertical axis stays upright (exact, prismatic); on any
 * other it is a general B-rep. Without a plane a sketch lies on XY at Z 0.
 */
export interface CadPartSketchPlane {
    readonly origin: CadPartPoint3;
    readonly normal: readonly [number, number, number];
    readonly xAxis: readonly [number, number, number];
}
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
type Placed = {
    readonly plane?: CadPartSketchPlane;
    readonly regions?: readonly (readonly CadPartLoopSegment[])[];
    readonly holes?: readonly (readonly CadPartLoopSegment[])[];
    readonly sideTags?: CadPartSideTags;
};
export type CadPartSideTags = SideTags;
export type CadPartFeature = Base & (({
    readonly kind: 'sketch';
    readonly profile: 'rectangle';
    readonly min: CadPartPoint2;
    readonly max: CadPartPoint2;
} & Placed) | ({
    readonly kind: 'sketch';
    readonly profile: 'circle';
    readonly center: CadPartPoint2;
    readonly radius: CadPartDim;
} & Placed) | ({
    readonly kind: 'sketch';
    readonly profile: 'polygon';
    readonly points: readonly CadPartPoint2[];
} & Placed) | ({
    readonly kind: 'sketch';
    readonly profile: 'loop';
    readonly segments: readonly CadPartLoopSegment[];
} & Placed)
/** Along the sketch normal (+Z) from `from` (default 0); a negative height extrudes the other way. */
/** `draft` (degrees, |θ| < 89) leans every wall into the material away from the sketch plane. */
 | {
    readonly kind: 'extrude';
    readonly sketch: string;
    readonly height: CadPartDim;
    readonly from?: CadPartDim;
    readonly draft?: number;
}
/** About an axis in the sketch plane (through `origin`, along X or Y), by angle (default 360). */
 | {
    readonly kind: 'revolve';
    readonly sketch: string;
    readonly axis: {
        readonly origin: CadPartPoint2;
        readonly direction: 'x' | 'y' | readonly [number, number];
    };
    readonly angle?: number;
} | {
    readonly kind: 'union' | 'difference' | 'intersect';
    readonly target: string;
    readonly tool: string;
}
/** Add a world-axis-aligned rectangular rib to one straight-sided upright solid; actual overlap and added material must both have positive volume. */
 | {
    readonly kind: 'rib';
    readonly target: string;
    readonly min: CadPartPoint3;
    readonly max: CadPartPoint3;
}
/** A supported XY rectangle raised above or recessed below the top of one straight-sided, single-slab upright solid. Depth is positive world mm, below the body's height. */
 | {
    readonly kind: 'rectangular-relief';
    readonly target: string;
    readonly min: CadPartPoint2;
    readonly max: CadPartPoint2;
    readonly depth: CadPartDim;
    readonly mode: 'emboss' | 'engrave';
}
/** Line-only XY components strictly inside exactly one +Z cap in `faces`. `clearance` adds to the existing linear policy (default 0); only engrave depth must remain below slab thickness. */
 | {
    readonly kind: 'profile-relief';
    readonly target: string;
    readonly faces: readonly string[];
    readonly sketches: readonly string[];
    readonly depth: CadPartDim;
    readonly mode: 'emboss' | 'engrave';
    readonly clearance?: number;
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
}
/** One rectangle in original native UV, first +Y wall quarter; height must equal the source radius. Mass is over its certified closed radial reference. */
 | {
    readonly kind: 'cylindrical-wrap';
    readonly target: string;
    readonly faces: readonly string[];
    readonly rectangle: {
        readonly u: readonly [number, number];
        readonly v: readonly [number, number];
    };
    readonly height: CadPartDim;
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
}
/**
 * A full round (a face fillet): each named face — planar, facing +Z, an axis-aligned rectangle — becomes a half
 * cylinder tangent to its two sides along `along` (default: each face's longer side), of radius half its width
 * across. The sides must drop at least that radius and nothing may stand above the face: the material taken is
 * checked against L·W²(4 − π)/8. The round faces are named `<id>.round<k>`.
 */
 | {
    readonly kind: 'full-round';
    readonly target: string;
    readonly faces: readonly string[];
    readonly along?: 'x' | 'y';
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
}
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
 | {
    readonly kind: 'face-thread';
    readonly target: string;
    readonly face: string;
    readonly pitch: CadPartDim;
    readonly diameter?: CadPartDim;
    readonly length?: CadPartDim;
    readonly end?: '+' | '-';
    readonly relief?: CadPartDim;
    readonly clearance?: CadPartDim;
    readonly hand?: 'right' | 'left';
}
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
 | {
    readonly kind: 'face-fillet';
    readonly target: string;
    readonly faces: readonly [string, string];
    readonly radius: CadPartDim;
}
/**
 * A hole along `axis` (default z) through the target, or `depth` deep from its `side` (default max:
 * the top for z). `center` is in the other two coordinates in order: z → [x, y], x → [y, z], y → [x, z].
 * `face` (D148): the planar face it is drilled into, by name — the depth and the countersink measured from that face's
 * plane rather than the target's extreme on `side` (a boss's top inside a shell); its normal along ±axis gives the side.
 */
 | {
    readonly kind: 'hole';
    readonly target: string;
    readonly center: CadPartPoint2;
    readonly radius: CadPartDim;
    readonly depth?: CadPartDim;
    readonly axis?: CadPartAxis;
    readonly side?: 'min' | 'max'; /** A 90° countersink: its diameter at the face (wider than the hole). */
    readonly countersink?: CadPartDim;
    readonly face?: string;
} | {
    readonly kind: 'translate';
    readonly target: string;
    readonly offset: CadPartPoint3;
}
/** About an axis through `pivot` (default the origin) by any angle; off quarter turns about X or Y the body leaves the upright family. */
 | {
    readonly kind: 'rotate';
    readonly target: string;
    readonly axis: CadPartAxis;
    readonly angle: number;
    readonly pivot?: CadPartPoint3;
}
/** Mirror in a coordinate plane through the origin; `keep` also keeps the original (one body). */
 | {
    readonly kind: 'mirror';
    readonly target: string;
    readonly plane: 'xy' | 'xz' | 'yz';
    readonly keep?: boolean;
} | {
    readonly kind: 'scale';
    readonly target: string;
    readonly factor: number;
    readonly pivot?: CadPartPoint3;
}
/** `count` copies (the original included) joined into one body. */
 | {
    readonly kind: 'linear-pattern';
    readonly target: string;
    readonly axis: CadPartAxis;
    readonly spacing: CadPartDim;
    readonly count: number;
}
/** Repeat the tool of the active difference producer; count includes the original cut. */
 | {
    readonly kind: 'linear-feature-pattern';
    readonly target: string;
    readonly axis: CadPartAxis;
    readonly spacing: CadPartDim;
    readonly count: number;
}
/** Repeat an active difference tool on two distinct global axes; both counts include the original cut. */
 | {
    readonly kind: 'rectangular-feature-pattern';
    readonly target: string;
    readonly axis: CadPartAxis;
    readonly spacing: CadPartDim;
    readonly count: number;
    readonly axis2: CadPartAxis;
    readonly spacing2: CadPartDim;
    readonly count2: number;
}
/** Repeat the original CUT tool on a finite XY grid, masked by an inline reference-point region. */
 | {
    readonly kind: 'fill-feature-pattern';
    readonly target: string;
    readonly region: FillFeaturePatternRegion;
    readonly anchor: readonly [number, number];
    readonly spacing: CadPartDim;
    readonly count: number;
    readonly spacing2: CadPartDim;
    readonly count2: number;
}
/** Repeat a difference's cut tool along an open polyline, with its original orientation. */
 | {
    readonly kind: 'curve-feature-pattern';
    readonly target: string;
    readonly path: RawNurbsPath;
    readonly spacing: CadPartDim;
    readonly count: number;
}
/** Copies k·angle about the axis through `pivot` (about X or Y: multiples of 90°). */
 | {
    readonly kind: 'circular-pattern';
    readonly target: string;
    readonly axis: CadPartAxis;
    readonly angle: number;
    readonly count: number;
    readonly pivot?: CadPartPoint3;
}
/**
 * Parts /0 (below `at`) and /1 (above): across the plane `axis` = at, or with `normal` (any direction,
 * not necessarily unit) across the plane normal·p = at — x + y = at for [1, 1, 0], a mitre.
 */
 | {
    readonly kind: 'split';
    readonly target: string;
    readonly axis?: CadPartAxis;
    readonly normal?: CadPartPoint3;
    readonly at: CadPartDim;
}
/**
 * The sketch's profile swept along a path through its centroid, from the sketch plane up +Z: straight
 * runs and bends of a radius (to the path) towards ±X or ±Y (as a pipe is bent), each from where the
 * last ended.
 */
 | {
    readonly kind: 'sweep';
    readonly sketch: string;
    readonly path: readonly CadPartSweepStep[];
}
/**
 * A ruled loft through sketches placed at increasing heights: each section's edges joined by straight
 * rulings to the next one's (edge counts are evened out by halving the longest edges). Faces
 * `${id}.bottom`, `.top`, `.side${i}` (two sections) or `.s${k}.side${i}`. `smooth` (three or more
 * sections): one smooth side per edge through them all (C1), named `.side${i}`.
 */
/** Two world frames: admitted convex polygon or circle/ellipse conic correspondence. */
 | {
    readonly kind: 'loft';
    readonly sections: readonly CadPartLoftSection[];
    readonly smooth?: boolean;
    readonly guide?: LoftInput['guide'];
}
/**
 * A body read from a STEP file (its text); its faces keep their names, prefixed `${id}.`. `each`: every
 * solid of the file is its own part (`id/k`, in file order) instead of one body holding them all.
 */
 | {
    readonly kind: 'import';
    readonly step: string;
    readonly each?: boolean;
}
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
 | {
    readonly kind: 'mesh';
    readonly positions: readonly number[] | Float64Array | Float32Array;
    readonly indices: readonly number[] | Uint32Array;
    readonly representation?: 'facets' | 'planar';
    readonly each?: boolean;
    readonly open?: boolean;
    readonly groups?: readonly number[] | Int32Array;
}
/**
 * A modelled ISO metric thread (faceted helix, one solid with no Boolean): a rod of `length` below
 * `seat` on the axis through `center`; with `hex`, a hex head bolt (head above the seat), or with
 * `hex.internal` a hex nut above the seat threaded through.
 */
/**
 * The sketch's profile swept along a curve (any NURBS path in mm): its middle starts on the path's
 * start, square to it, carried along without twisting; the ends capped; holes run through. Faceted.
 */
 | {
    readonly kind: 'sweep-curve';
    readonly sketch: string;
    readonly path: RawNurbsPath;
}
/**
 * Draft (taper) on chosen side faces along the signed `pull` axis (default: positive Z). Each planar side
 * face turns about its line on the neutral plane by `angle` degrees: positive leans into the material,
 * negative out. `neutral` is the world coordinate in mm along that axis (default: the body's minimum
 * for a positive pull, maximum for a negative pull).
 * The faces are selected by name.
 */
 | {
    readonly kind: 'draft';
    readonly target: string;
    readonly faces: readonly string[];
    readonly angle: number;
    readonly pull?: CadPartAxis | '-x' | '-y' | '-z';
    readonly neutral?: CadPartDim;
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
}
/**
 * D149: one face of a part split along NURBS curves lying on it (`curves`, mm), or along its isocline n·d = 0 for the pull
 * `pull`; the face by name (a base name naming one face). The pieces are named `<face>#1`, `<face>#2` … (an isocline's +
 * side first), or by `names`; every other face, its name and the volume are kept.
 */
 | {
    readonly kind: 'split-face';
    readonly target: string;
    readonly face: string;
    readonly curves?: readonly {
        readonly degree: number;
        readonly knots: readonly number[];
        readonly controlPoints: readonly (readonly [number, number, number])[];
        readonly weights: readonly number[];
    }[];
    readonly pull?: CadPartPoint3;
    readonly names?: readonly string[];
}
/** An open NURBS surface thickened into a solid: `thickness` along its normal (or against it, or half each way). Faceted. */
 | {
    readonly kind: 'thicken';
    readonly surface: {
        readonly degreeU: number;
        readonly degreeV: number;
        readonly knotsU: readonly number[];
        readonly knotsV: readonly number[];
        readonly controlPoints: readonly (readonly (readonly [number, number, number])[])[];
        readonly weights: readonly (readonly number[])[];
    };
    readonly thickness: CadPartDim;
    readonly side?: 'normal' | 'reverse' | 'both';
}
/**
 * B2: a ruled band surface between two edge chains of earlier bodies (read, never consumed): `a` and `b` each name a body (`target`,
 * `id` or `id/k`) and its edges by name (up to 32, pick order). One open chain or one closed loop on each side, paired piece by
 * piece (equal counts) or by normalized length, joined by exact ruled NURBS patches `${id}.band<k>` into one sheet body (output
 * `band` report). `flip` runs B the other way. `expect` is each name's signature when stored (checked as a fillet's is).
 */
 | {
    readonly kind: 'band-surface';
    readonly a: {
        readonly target: string;
        readonly edges: readonly string[];
    };
    readonly b: {
        readonly target: string;
        readonly edges: readonly string[];
    };
    readonly flip?: boolean;
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
}
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
 | {
    readonly kind: 'subd';
    readonly cage: {
        readonly positions: readonly number[] | Float64Array;
        readonly faces: readonly (readonly number[])[];
        readonly creases?: readonly (readonly [number, number])[];
    };
} | {
    readonly kind: 'sew';
    readonly surfaces: readonly {
        readonly degreeU: number;
        readonly degreeV: number;
        readonly knotsU: readonly number[];
        readonly knotsV: readonly number[];
        readonly controlPoints: readonly (readonly (readonly [number, number, number])[])[];
        readonly weights: readonly (readonly number[])[];
    }[];
    readonly tolerance?: number;
}
/**
 * R6a (issue #2167, D53–D54): an involute spur gear on the XY plane, about `center`, from z `from` through
 * `faceWidth` — 20°, no profile shift in this stage (other input refused with its code). Faces `<id>.flankL#k`,
 * `.flankR#k`, `.tip#k`, `.root#k`, `.rootL#k`/`.rootR#k`, `.face0`/`.face1`, `.bore#1/2`; its report (dimensions,
 * the measured flank deviation, the schematic root's warning) is the output's `gear`. `generator` records the
 * version that made it.
 */
 | {
    readonly kind: 'spur-gear';
    /** A spur gear's module; a helical gear (`helixAngle` and `hand`, R6a.5c) gives `normalModule` instead. */
    readonly module?: CadPartDim;
    readonly normalModule?: CadPartDim;
    readonly helixAngle?: number;
    readonly hand?: 'right' | 'left';
    readonly teeth: number;
    readonly faceWidth: CadPartDim;
    readonly pressureAngle?: number;
    readonly profileShift?: number;
    readonly bore?: CadPartDim;
    readonly thicknessReduction?: CadPartDim;
    readonly profileTolerance?: number;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    /** Turned about its axis (degrees; tooth 1 on +X at 0). */
    readonly rotation?: number;
    /**
     * Meshing with another spur gear (R6a.4, D56): placed beside it — on its face plane, at `centerDistance` (default
     * the one without backlash: m(z1 + z2)/2, or the working one for shifted gears) along `direction` (degrees from +X) — and turned so its teeth mesh (a space facing the
     * other's tooth on the line of centres, plus `phase` degrees), following the other's turn by −z1/z2. Its own
     * `center`, `from` and `rotation` are then not used.
     */
    readonly mesh?: {
        readonly gear: string;
        readonly direction?: number;
        readonly centerDistance?: CadPartDim;
        readonly phase?: number;
    };
    /**
     * The generator version: 'spur-gear@0' (the default) the schematic root; 'spur-gear@1' (R12b.1a, D130) the root the
     * basic rack generates, its tip radius `toolTipRadius` (default 0.38 m) — spur and helical (R12b.1b), undercut taken as cut.
     */
    readonly generator?: 'spur-gear@0' | 'spur-gear@1';
    readonly toolTipRadius?: CadPartDim;
}
/**
 * A rack (R6a.5b, D58): its pitch line from `origin` along `angle` degrees (teeth to its left, the back `height` below
 * the line), standing on z `from`; or, with `mesh`, under a spur gear — its pitch line `centerDistance` from the gear's
 * axis (default r + x m) across `direction` (degrees from +X, the axis to the pitch point), on the gear's face plane,
 * slid so its middle gap meets a tooth (plus `phase` mm) and travelling r per radian of the gear's turn.
 */
 | {
    readonly kind: 'spur-rack';
    /** A straight rack's module; a helical rack's `normalModule`, `helixAngle` and `hand` (meshing: taken from the gear, the opposite hand). */
    readonly module?: CadPartDim;
    readonly normalModule?: CadPartDim;
    readonly helixAngle?: number;
    readonly hand?: 'right' | 'left';
    readonly teeth: number;
    readonly faceWidth: CadPartDim;
    readonly height: CadPartDim;
    readonly pressureAngle?: number;
    readonly thicknessReduction?: CadPartDim;
    readonly origin?: CadPartPoint2;
    readonly angle?: number;
    readonly from?: CadPartDim;
    readonly mesh?: {
        readonly gear: string;
        readonly direction?: number;
        readonly centerDistance?: CadPartDim;
        readonly phase?: CadPartDim;
    };
    /** 'spur-rack@0' (the default) the schematic root corner; 'spur-rack@1' (R12b.1b, D131) the basic rack's root fillet, radius `rootFillet` (default 0.38 m). */
    readonly generator?: 'spur-rack@0' | 'spur-rack@1';
    readonly rootFillet?: CadPartDim;
}
/**
 * An internal (ring) gear (R12b.2a, D132): module (a helical one's normalModule, helixAngle and hand — its pinion's
 * hand), teeth, face width and the rim's outer diameter `rim`; profile shift x2 (−0.5 to 0.75), thickness reduction;
 * standing on z `from` about `center`, turned `rotation` degrees (tooth 1 on +X at 0). A spur gear meshes inside it by
 * its `mesh: { gear: <this> }`.
 */
 | {
    readonly kind: 'internal-gear';
    readonly module?: CadPartDim;
    readonly normalModule?: CadPartDim;
    readonly helixAngle?: number;
    readonly hand?: 'right' | 'left';
    readonly teeth: number;
    readonly faceWidth: CadPartDim;
    readonly rim: CadPartDim;
    readonly pressureAngle?: number;
    readonly profileShift?: number;
    readonly thicknessReduction?: CadPartDim;
    readonly profileTolerance?: number;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    /** 'internal-gear@0' (the default) the schematic root; 'internal-gear@1' (R12b.2b, D133) the root a pinion-type `cutter` cuts (its teeth, shift, tip radius). */
    readonly generator?: 'internal-gear@0' | 'internal-gear@1';
    readonly cutter?: {
        readonly teeth: number;
        readonly shift?: number;
        readonly tipRadius?: CadPartDim;
    };
}
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
 | {
    readonly kind: 'bevel-gear';
    readonly module: CadPartDim;
    readonly teeth: number;
    readonly mateTeeth: number;
    readonly shaftAngle?: number;
    readonly faceWidth: CadPartDim;
    readonly pressureAngle?: number;
    readonly bore?: CadPartDim;
    readonly thicknessReduction?: CadPartDim;
    readonly profileTolerance?: number;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    readonly mesh?: {
        readonly gear: string;
        readonly direction?: number;
        readonly phase?: number;
    };
    /**
     * A spiral bevel gear (R12b.4, D135), the ideal conjugate (flagged as an ideal model): its mean spiral angle (degrees,
     * at most 45), hand (right: seen from its apex, the tooth turns clockwise from the toe to the heel) and the circular
     * trace's cutter radius. A mate takes the same angle and radius, the other hand, the same face width.
     */
    readonly spiral?: {
        readonly angle: number;
        readonly hand: 'right' | 'left';
        readonly cutterRadius: CadPartDim;
    };
    /** 'bevel-gear@0' (the default): straight or spiral, standard, spherical involute, schematic meridian root. */
    readonly generator?: 'bevel-gear@0';
}
/**
 * A cylindrical worm (R12b.5, D136): ZI (the default) or ZA, its axial module, starts (1–4), reference diameter, hand
 * and length; a bore, an axial thickness reduction. On its own its axis is +Z through `center` from `from`, turned
 * `rotation` degrees; or, with `mesh`, beside a helical spur gear (its wheel, at β = the worm's lead angle, of its hand):
 * its axis square to the wheel's, at the centre distance toward `direction` (degrees from +X about the wheel's axis), in
 * the wheel's mid-plane, its length centred there, turned to mesh (plus `phase` degrees of the worm's turn). A meshing
 * worm left without its axial module, diameter or hand takes them from the wheel (m_x = m_n / cos β, d1 = z1 m_x / tan β).
 * Faces `<id>.flankL#k`, `.flankR#k` (`.flankL2#k` …), `.tip#k`, `.root#k`, `.face0`, `.face1`, `.bore#1/2`, segments `.2` ….
 */
 | {
    readonly kind: 'worm';
    readonly axialModule?: CadPartDim;
    readonly starts: number;
    readonly diameter?: CadPartDim;
    readonly hand?: 'right' | 'left';
    readonly length: CadPartDim;
    readonly form?: 'ZI' | 'ZA' | 'ZN' | 'ZK' | 'ZC';
    readonly bore?: CadPartDim;
    readonly thicknessReduction?: CadPartDim;
    readonly profileTolerance?: number;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    readonly mesh?: {
        readonly gear: string;
        readonly direction?: number;
        readonly phase?: number;
    };
    /** 'worm@0' (the default). */
    readonly generator?: 'worm@0';
}
/**
 * A throated (single-enveloping) worm wheel (R12b.6, D137): cut by a hob of its ZA worm's thread (`worm`: axialModule,
 * starts, diameter, hand), teeth, face width (centred on its mid-plane), a bore, the spaces widened by
 * `thicknessReduction`; its axis +Z through `center` from `from`, turned `rotation` degrees (tooth 1 on +X in the
 * mid-plane). Its worm meshes with it by the worm's `mesh` (taking the wheel's worm). Faces `<id>.filletL#k`,
 * `.flankL#k`, `.tip#k` (the throat torus), `.flankR#k`, `.filletR#k`, `.root#k` (the root torus), `.face0`, `.face1`, `.bore#1/2`, segments `.2` ….
 */
 | {
    readonly kind: 'worm-wheel';
    readonly worm: {
        readonly axialModule: CadPartDim;
        readonly starts: number;
        readonly diameter: CadPartDim;
        readonly hand: 'right' | 'left';
    };
    readonly teeth: number;
    readonly faceWidth: CadPartDim;
    readonly bore?: CadPartDim;
    readonly thicknessReduction?: CadPartDim;
    readonly profileTolerance?: number;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    /** 'worm-wheel@0' (the default). */
    readonly generator?: 'worm-wheel@0';
}
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
 | {
    readonly kind: 'spring';
    readonly wire: CadPartDim;
    readonly diameter?: CadPartDim;
    readonly outerDiameter?: CadPartDim;
    readonly innerDiameter?: CadPartDim;
    readonly activeCoils: number;
    readonly pitch?: CadPartDim;
    readonly freeLength?: CadPartDim;
    readonly hand?: 'right' | 'left';
    readonly ends?: 'open' | 'closed' | 'closed-ground';
    readonly endCoils?: number;
    readonly transition?: number;
    readonly shearModulus?: number;
    readonly shearModulusEstimate?: boolean;
    readonly load?: number;
    readonly profileTolerance?: number;
    readonly hooks?: 'machine-loop' | 'crossover';
    readonly bendRadius?: CadPartDim;
    readonly loopRadius?: CadPartDim;
    readonly loopAngle?: number;
    readonly initialTension?: number;
    readonly legLengths?: readonly [CadPartDim, CadPartDim];
    readonly youngsModulus?: number;
    readonly youngsModulusEstimate?: boolean;
    readonly moment?: number;
    readonly type?: 'compression' | 'extension' | 'torsion';
    readonly body?: 'cylindrical' | 'conical' | 'barrel' | 'variable-pitch';
    readonly wireSection?: 'round' | 'rectangular';
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    /** 'spring@0' (the default). */
    readonly generator?: 'spring@0';
}
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
 | {
    readonly kind: 'cam';
    readonly base: CadPartDim;
    readonly thickness: CadPartDim;
    readonly follower: 'roller' | 'flat';
    readonly motion?: 'translating' | 'oscillating';
    readonly roller?: CadPartDim;
    readonly offset?: CadPartDim;
    readonly pivotDistance?: CadPartDim;
    readonly armLength?: CadPartDim;
    readonly faceOffset?: CadPartDim;
    readonly faceWidth?: CadPartDim;
    readonly segments: readonly {
        readonly angle: number;
        readonly to?: number;
        readonly law?: CamLaw;
    }[];
    readonly bore?: CadPartDim;
    readonly minimumRim?: CadPartDim;
    readonly pressureAngleLimit?: number;
    readonly profileTolerance?: number;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    /** 'cam@0' (the default). */
    readonly generator?: 'cam@0';
}
/**
 * R12c.6b (D161): drive elements from the user's rows (`row` inline: a chain, a belt or a coupling row, citing its source
 * or flagged an estimate). A `sprocket` for a chain row, `teeth`, `tip` Ø and `width` (the tooth form `pivot-clearance`,
 * derived; `seat` Ø at least the roller's); a `pulley` for a belt row (timing: `teeth`, `width`; V: `diameter` the datum,
 * `grooves`; flat: `diameter`, `width`, `crown`); a `belt` (its row a belt or a chain) as a band on two wheels' pitch
 * radii `pitchRadii` at `centerDistance` along the turned +X (`rounding` a chain's links); a `coupling`'s envelope.
 * Each on its axis +Z through `center` from `from`, turned `rotation` degrees. Faces in `drive.ts`.
 */
 | {
    readonly kind: 'sprocket';
    readonly row: DriveRow;
    readonly teeth: number;
    readonly tip: CadPartDim;
    readonly width: CadPartDim;
    readonly seat?: CadPartDim;
    readonly toothForm?: string;
    readonly bore?: CadPartDim;
    readonly minimumRim?: CadPartDim;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    readonly generator?: 'sprocket@0';
} | {
    readonly kind: 'pulley';
    readonly row: DriveRow;
    readonly teeth?: number;
    readonly diameter?: CadPartDim;
    readonly grooves?: number;
    readonly width?: CadPartDim;
    readonly crown?: CadPartDim;
    readonly bore?: CadPartDim;
    readonly minimumRim?: CadPartDim;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    readonly generator?: 'pulley@0';
} | {
    readonly kind: 'belt';
    readonly row: DriveRow;
    readonly pitchRadii: readonly [CadPartDim, CadPartDim];
    readonly centerDistance: CadPartDim;
    readonly rounding?: 'whole' | 'even';
    readonly width?: CadPartDim;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    readonly generator?: 'belt@0';
} | {
    readonly kind: 'coupling';
    readonly row: DriveRow;
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    readonly generator?: 'coupling@0';
}
/**
 * R12c.7 (D162): a connector's opening cut into a flat `face` of `target` at `center` (on the face), its width turned
 * `rotation` degrees about the face's normal, from the user's `row` inline (opening, body?, keepOut?; source or
 * estimate); the output's `connector` is the report (the frame, the body's gaps, the keep-out in A6.3's form). A
 * `connector-body` is the row's body envelope seated in that opening (it refers to it), its overlap with the panel
 * checked: touching at most (`CONNECTOR_FIT`).
 */
 | {
    readonly kind: 'connector-opening';
    readonly target: string;
    readonly face: string;
    readonly row: ConnectorRow;
    readonly center: CadPartPoint3;
    readonly rotation?: number;
} | {
    readonly kind: 'connector-body';
    readonly opening: string;
}
/**
 * FRk1 (D165): a `gusset` — a plate in the plane of two members of `frame` meeting at its skeleton `point` (the two
 * there, or `members` [a, b] where more meet; a member passing through takes `along` 1 or −1, its own direction or
 * the other way), its legs `legs` [l1, l2] along their inner faces from the corner where those faces meet, the corner
 * clipped `clip` along each leg, `thickness` thick, its mid-plane through the members' lines or moved `offset` along
 * its normal. An `end-cap` — a plate `over` a member's square end (its section's outer loop) or `inset` in its bore,
 * `thickness` thick. Each an output of its own; `gusset` / `endCap` its report. Refused GUSSET_FIT, CAP_END.
 */
 | {
    readonly kind: 'gusset';
    readonly frame: string;
    readonly point: number;
    readonly members?: readonly [number, number];
    readonly along?: number;
    readonly legs: readonly [CadPartDim, CadPartDim];
    readonly thickness: CadPartDim;
    readonly clip?: CadPartDim;
    readonly offset?: CadPartDim;
} | {
    readonly kind: 'end-cap';
    readonly frame: string;
    readonly member: number;
    readonly end: 'start' | 'end';
    readonly fit: 'over' | 'inset';
    readonly thickness: CadPartDim;
}
/**
 * FRk2 (D166): a fillet `weld-bead` of leg `leg` on a frame's joint: `on` a member's end landing square on other
 * members' flat faces (a butt, a T's butt, a square end on a face; `inner` the bore's loop too), or `on` a gusset (both
 * its seams, both faces). Its body the fillet (the end's loop offset by the leg, drafted 45°, less the member, kept on
 * the faces it lands on); `bead` its report. Refused BEAD_KIND, BEAD_SEAM_NOT_PLANAR, BEAD_ANGLE, BEAD_SIZE.
 */
 | {
    readonly kind: 'weld-bead';
    readonly frame: string;
    readonly on: {
        readonly member: number;
        readonly end: 'start' | 'end';
    } | {
        readonly gusset: string;
    } | {
        readonly cap: string;
    };
    readonly leg: CadPartDim;
    readonly inner?: boolean;
    readonly sharing?: CadPartBeadSharing;
}
/**
 * A shaft (R12c.3a, D156): `steps` [{ diameter, length, fillet? (at the shoulder after it), undercut? { width, depth },
 * grooves? [{ diameter, width, at }], keyseats? [{ width, depth, length, offset, ends? square | end-mill (default) |
 * disc, cutterRadius?, angle? }] }] along +Z from `from` through `center`, `chamfers` [start, end], cross `holes`
 * [{ diameter, at, angle? }], turned `rotation` degrees. Faces `<id>.seatk`, `.shoulders`, `.fillets`, `.undercuts`,
 * `.grooveg`, `.keyseatj`, `.holej`, `.chamfer0/1`, `.end0/1` (each revolved one in halves `#1`, `#2`).
 */
 | {
    readonly kind: 'shaft';
    readonly steps: readonly {
        readonly diameter: CadPartDim;
        readonly length: CadPartDim;
        readonly fillet?: CadPartDim;
        readonly undercut?: {
            readonly width: CadPartDim;
            readonly depth: CadPartDim;
        };
        readonly grooves?: readonly {
            readonly diameter: CadPartDim;
            readonly width: CadPartDim;
            readonly at: CadPartDim;
        }[];
        readonly keyseats?: readonly {
            readonly width: CadPartDim;
            readonly depth: CadPartDim;
            readonly length: CadPartDim;
            readonly offset: CadPartDim;
            readonly ends?: 'square' | 'end-mill' | 'disc';
            readonly cutterRadius?: CadPartDim;
            readonly angle?: number;
        }[];
    }[];
    readonly chamfers?: readonly [CadPartDim, CadPartDim];
    readonly holes?: readonly {
        readonly diameter: CadPartDim;
        readonly at: CadPartDim;
        readonly angle?: number;
    }[];
    readonly center?: CadPartPoint2;
    readonly from?: CadPartDim;
    readonly rotation?: number;
    /** 'shaft@0' (the default). */
    readonly generator?: 'shaft@0';
}
/**
 * R12c.3b (D157): what goes on a shaft. A parallel `key` in keyseat `keyseat` of the shaft feature `shaft` (width and
 * length the seat's by default; its height; ends round | square), checked against the seat and, with `hub` (a keyway
 * feature), against the hub's keyway; `fit` { tables, key, seat?, hub? } its width's classes (R12c.2). A `keyway` cut
 * into `target`'s bore `face` (width, depth t2, angle). A `retaining-ring` envelope in groove `groove` (thickness, outer
 * diameter; `row` the user's ring row). A `pin` in cross hole `hole` (diameter and length the hole's and the step's by
 * default; `fit` true when its classes make an interference a declared fit). Sizes are the user's.
 */
 | {
    readonly kind: 'key';
    readonly shaft: string;
    readonly keyseat: number;
    readonly width?: CadPartDim;
    readonly height: CadPartDim;
    readonly length?: CadPartDim;
    readonly ends?: 'round' | 'square';
    readonly hub?: string;
    readonly fit?: {
        readonly tables: readonly FitTable[];
        readonly key: string;
        readonly seat?: string;
        readonly hub?: string;
    };
} | {
    readonly kind: 'keyway';
    readonly target: string;
    readonly face: string;
    readonly width: CadPartDim;
    readonly depth: CadPartDim;
    readonly angle?: number;
} | {
    readonly kind: 'retaining-ring';
    readonly shaft: string;
    readonly groove: number;
    readonly thickness: CadPartDim;
    readonly outerDiameter: CadPartDim;
    readonly row?: {
        readonly shaftDiameter?: number;
        readonly grooveDiameter?: number;
        readonly grooveWidth?: number;
        readonly source?: string;
        readonly estimate?: boolean;
    };
}
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
 | {
    readonly kind: 'oring-gland';
    readonly target: string;
    readonly face: string;
    readonly gland: 'piston' | 'rod' | 'face';
    readonly ring: {
        readonly id: string;
        readonly dash?: string;
        readonly insideDiameter: number;
        readonly crossSection: number;
        readonly source?: string;
        readonly estimate?: boolean;
    };
    readonly groove: {
        readonly diameter: CadPartDim;
        readonly width: CadPartDim;
        readonly at?: CadPartDim;
        readonly depth?: CadPartDim;
        readonly center?: CadPartPoint3;
    };
    readonly seal?: CadPartDim;
    readonly ranges?: GlandRanges;
    readonly fit?: {
        readonly tables: readonly FitTable[];
        readonly seal?: string;
        readonly groove?: string;
    };
} | {
    readonly kind: 'oring';
    readonly gland: string;
} | {
    readonly kind: 'bearing';
    readonly row: BearingRow;
    readonly shaft: string;
    readonly step: number;
    readonly against: 'start' | 'end';
    readonly housing?: string;
    readonly fit?: BearingFitClasses;
} | {
    readonly kind: 'pin';
    readonly shaft: string;
    readonly hole: number;
    readonly diameter?: CadPartDim;
    readonly length?: CadPartDim;
    readonly fit?: boolean;
} | {
    readonly kind: 'thread';
    readonly diameter: CadPartDim;
    readonly pitch: CadPartDim;
    readonly center?: CadPartPoint2;
    readonly seat?: CadPartDim;
    readonly length?: CadPartDim;
    readonly hex?: {
        readonly across: CadPartDim;
        readonly height: CadPartDim;
        readonly internal?: boolean;
    };
    /** `helical` (B-spline faces `.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5`…) or `faceted` (`.facet${k}`). Left out: faceted, the form documents written before helical became the default keep (their names keep resolving). New documents write `helical`. */
    readonly form?: 'faceted' | 'helical';
}
/**
 * A body in several pieces (a cut right through it) as one part per piece, `id/0`, `id/1` … in the
 * order of its B-rep's bodies; refused for a body in one piece.
 */
 | {
    readonly kind: 'separate';
    readonly target: string;
}
/**
 * R9 (M4, D85): a mesh body (facet faces) simplified by edge collapse under the quadric error metric — to
 * `triangles`, or a `ratio` of its triangles, no collapse past `maxError` mm (its quadric bound). Its faces keep
 * their regions and names: the regions' boundaries (where the mesh's creases are) and open edges are kept as lines,
 * and with `featureAngle` (degrees) any edge sharper than it too — left out, none (a scan's noise is no crease). The
 * output's `decimate` reports the counts and the measured distance both ways.
 */
 | {
    readonly kind: 'decimate';
    readonly target: string;
    readonly triangles?: number;
    readonly ratio?: number;
    readonly maxError?: CadPartDim;
    readonly featureAngle?: number;
}
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
 | ({
    readonly kind: 'sheet-base';
    readonly sketch: string;
    readonly thickness: CadPartDim;
    readonly bendRadius: CadPartDim;
    readonly reverse?: boolean;
} & CadPartSheetK) | ({
    readonly kind: 'sheet-contour';
    readonly path: readonly CadPartPoint2[];
    readonly plane?: CadPartSketchPlane;
    readonly side: 'left' | 'right';
    readonly width: CadPartDim;
    readonly thickness: CadPartDim;
    readonly bendRadius: CadPartDim;
} & CadPartSheetK)
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
 | {
    readonly kind: 'frame';
    readonly points: readonly CadPartPoint3[];
    readonly segments: readonly CadPartFrameSegment[];
    readonly bends?: readonly {
        readonly point: number;
        readonly radius: CadPartDim;
    }[];
    readonly section: CadPartSection;
    readonly anchor?: FrameAnchor;
    readonly offset?: readonly [CadPartDim, CadPartDim];
    readonly roll?: number;
    readonly mirror?: boolean;
    readonly up?: CadPartPoint3;
    readonly overrides?: readonly CadPartFrameOverride[];
    readonly corners?: CadPartFrameCorners;
    readonly trims?: readonly CadPartFrameTrim[];
} | {
    readonly kind: 'frame-member';
    readonly section: CadPartSection;
    readonly start: CadPartPoint3;
    readonly end: CadPartPoint3;
    readonly anchor?: FrameAnchor;
    readonly offset?: readonly [CadPartDim, CadPartDim];
    readonly roll?: number;
    readonly up?: CadPartPoint3;
}
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
 | {
    readonly kind: 'sheet-corner-relief';
    readonly target: string;
    readonly corner: string;
    readonly shape: 'square' | 'round';
    readonly size: CadPartDim;
} | {
    readonly kind: 'sheet-flange';
    readonly target: string;
    readonly edge: string;
    readonly length: CadPartDim;
    readonly angle?: number;
    readonly bendRadius?: CadPartDim;
    readonly measure?: 'outer' | 'inner' | 'tangent';
    readonly position?: 'material-inside' | 'material-outside' | 'bend-outside';
    readonly offsets?: readonly [CadPartDim, CadPartDim];
    readonly relief?: {
        readonly kind: 'rectangular' | 'obround';
        readonly width: CadPartDim;
        readonly depth: CadPartDim;
    } | {
        readonly kind: 'none';
    };
}
/** Hollowed to walls `thickness` thick; `open` names the faces removed (the top of a box, a side). */
 | {
    readonly kind: 'shell';
    readonly target: string;
    readonly thickness: CadPartDim;
    readonly open?: readonly string[];
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
} | {
    readonly kind: 'chamfer';
    readonly target: string;
    readonly edges: readonly string[];
    readonly distance: CadPartDim;
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
}
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
 | {
    readonly kind: 'fillet';
    readonly target: string;
    readonly edges: readonly string[];
    readonly radius?: CadPartDim;
    readonly radii?: readonly {
        readonly at: CadPartPoint3;
        readonly radius: CadPartDim;
        readonly atEnd?: true;
    }[];
    readonly section?: {
        readonly kind: 'circular';
    } | {
        readonly kind: 'conic';
        readonly rho: number;
    } | {
        readonly kind: 'g2';
        readonly tension?: number;
    };
    readonly expect?: Readonly<Record<string, CadPartNameSignature>>;
});
/**
 * A sheet's K (R12.4, D120): one `kFactor` for every bend, or a `bendTable` (rows of T, R, angle → K, BA or BD, each
 * citing a source or saying it is an estimate) giving each bend's — one of them, no default.
 */
export type CadPartSheetK = {
    readonly kFactor: number;
    readonly bendTable?: undefined;
} | {
    readonly bendTable: BendTable;
    readonly kFactor?: undefined;
};
export interface CadPartDocument {
    readonly format: 'barocss-cad-part';
    readonly version: 1;
    readonly units: 'mm';
    readonly parameters: Readonly<Record<string, number>>;
    readonly features: readonly CadPartFeature[];
}
export type CadPartLoftSection = ({
    readonly sketch: string;
    readonly profile?: never;
} & ({
    readonly z: CadPartDim;
    readonly frame?: never;
}
/** An explicit world frame replaces the sketch's placement, keeping its local profile coordinates. */
 | {
    readonly frame: LoftSectionFrame;
    readonly z?: never;
})) | {
    readonly profile: Exclude<LoftSectionInput['profile'], readonly ProfileSegmentInput[]>;
    readonly frame: LoftSectionFrame;
    readonly sketch?: never;
    readonly z?: never;
};
export type CadPartSweepStep = {
    readonly kind: 'straight';
    readonly length: CadPartDim;
} | {
    readonly kind: 'bend';
    readonly radius: CadPartDim;
    readonly angle: number;
    readonly toward: 'x' | '-x' | 'y' | '-y';
};
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
    readonly at?: readonly {
        readonly point: number;
        readonly kind: 'mitre' | 'butt' | 'cope' | 'order' | 'none';
        readonly through?: number;
        readonly trim?: 'face' | 'envelope';
        readonly order?: readonly number[];
        readonly gap?: CadPartDim;
        readonly notch?: CadPartFrameNotch;
    }[];
}
export type CadPartFrameNotch = {
    readonly kind: 'holesaw';
    readonly diameter: CadPartDim;
    readonly offset?: CadPartDim;
} | {
    readonly kind: 'v';
    readonly depth: CadPartDim;
    readonly angle: CadPartDim;
};
/** A member's end trimmed to a plane (the side holding its other end kept) or to an earlier body (FR3b, D126). */
export type CadPartFrameTrim = {
    readonly member: number;
    readonly end: 'start' | 'end';
} & ({
    readonly plane: {
        readonly origin: CadPartPoint3;
        readonly normal: CadPartPoint3;
    };
} | {
    readonly body: string;
});
/** One member of a frame set apart (FR2, D124): its own section, anchor, offset, roll or mirror. */
export interface CadPartFrameOverride {
    readonly member: number;
    readonly section?: CadPartSection;
    readonly anchor?: FrameAnchor;
    readonly offset?: readonly [CadPartDim, CadPartDim];
    readonly roll?: number;
    readonly mirror?: boolean;
}
/** A member's section (FR1, D123): a kind and its dimensions, or a closed sketch. */
export type CadPartFrameSegment = readonly [number, number] | {
    readonly from: number;
    readonly to: number;
    readonly through: number;
} | {
    readonly from: number;
    readonly to: number;
    readonly center: CadPartPoint3;
};
export type CadPartSection = {
    readonly kind: 'rect-tube';
    readonly width: CadPartDim;
    readonly height: CadPartDim;
    readonly wall: CadPartDim;
    readonly outerRadius: CadPartDim;
    readonly innerRadius?: CadPartDim;
} | {
    readonly kind: 'round-tube';
    readonly diameter: CadPartDim;
    readonly wall: CadPartDim;
} | {
    readonly kind: 'angle';
    readonly legX: CadPartDim;
    readonly legY: CadPartDim;
    readonly thickness: CadPartDim;
    readonly rootRadius: CadPartDim;
    readonly toeRadius: CadPartDim;
} | {
    readonly kind: 'channel';
    readonly height: CadPartDim;
    readonly width: CadPartDim;
    readonly web: CadPartDim;
    readonly flange: CadPartDim;
    readonly rootRadius: CadPartDim;
    readonly toeRadius?: CadPartDim;
    readonly flangeSlope?: CadPartDim;
} | {
    readonly kind: 'i-beam';
    readonly height: CadPartDim;
    readonly width: CadPartDim;
    readonly web: CadPartDim;
    readonly flange: CadPartDim;
    readonly rootRadius: CadPartDim;
    readonly toeRadius: CadPartDim;
    readonly flangeSlope: CadPartDim;
} | {
    readonly kind: 'tslot';
    readonly size: CadPartDim;
    readonly cells: 1 | 2;
    readonly openSlots?: number;
    readonly opening: CadPartDim;
    readonly lip: CadPartDim;
    readonly undercut: CadPartDim;
    readonly depth: CadPartDim;
    readonly bore: CadPartDim;
} | {
    readonly kind: 'sketch';
    readonly sketch: string;
}
/** A size from a section table (R12c.7, D162): the user's rows of one kind, inline; checked whole, a size it lacks refused. */
 | {
    readonly kind: 'table';
    readonly table: SectionTable;
    readonly size: string;
};
export type CadPartErrorCode = 'FORMAT' | 'INPUT' | 'PARAMETER' | 'REFERENCE' | 'SELECTION' | 'CAPABILITY' | 'GEOMETRY';
/** Complete declared endpoint manifest for one frame; rebuild after an atomic retry removes a component. */
export interface CadPartBeadSharing {
    readonly version: 1;
    readonly policy: 'equal-length';
    /** Complete active endpoint manifest for this frame; membership is not a geometric component. */
    readonly joints: readonly (BeadJointRef & {
        readonly leg: CadPartDim;
    })[];
}
/**
 * A part-model refusal. Its `code` is the specific bracketed code of its message where it has one (`[FIT_TABLE_MISS]
 * …`), else its category; the category is in `details.category` either way (R7.3a batch 2, D278).
 */
export declare class CadPartError extends KernelError {
    readonly feature: string | null;
    readonly sharedComponent?: BeadSharedComponent | undefined;
    readonly code: CadPartErrorCode | CadRefusalCode;
    readonly details: {
        readonly category: CadPartErrorCode;
    };
    constructor(category: CadPartErrorCode, feature: string | null, detail: string, sharedComponent?: BeadSharedComponent | undefined);
}
export interface CadPartOutput {
    /** The feature id, or `id/k` for one part of a multi-part feature. */
    readonly id: string;
    readonly feature: string;
    /** 'upright': a Z-prismatic solid (closed-form mass, curved Booleans); otherwise a general B-rep. */
    readonly representation: 'upright' | 'planar' | 'curved' | 'faceted';
    readonly brep: Brep;
    readonly bodyCount: number;
    /** Closed-reference qualification; mass requires this evaluation's owned live provider. */
    readonly cylindricalWrap?: CylindricalWrapReport;
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
    readonly sprocket?: SprocketReport;
    readonly pulley?: PulleyReport;
    readonly belt?: BeltReport;
    readonly coupling?: CouplingReport;
    /** A connector's opening report (R12c.7): its frame, the body's fit, the keep-out; on a body, its overlap with the panel. */
    readonly connector?: ConnectorReport;
    readonly connectorBody?: {
        readonly row: string;
        readonly overlap: number;
    };
    /** A shaft's report: its steps, keyseats, grooves and holes (R12c.3a). */
    readonly shaft?: ShaftReport;
    /** A key's, a keyway's, a ring's or a pin's report and checks (R12c.3b). */
    readonly key?: KeyReport;
    readonly keyway?: KeywayReport;
    readonly ring?: RingReport;
    readonly pin?: PinReport;
    /** A bearing's report: its row, seat, housing, fits and warnings (R12c.4). */
    readonly bearing?: BearingReport;
    /** An O-ring gland's check and the ring's free overlap with its sealing surface (R12c.5). */
    readonly gland?: GlandReport;
    readonly oring?: {
        readonly ring: string;
        readonly overlap: number;
        readonly stretchedCrossSection: number;
    };
    /** A SubD body's make-up: steps, caps and their distance from the limit surface (R7, D79). */
    readonly subd?: SubdSummary;
    /** A band surface's report: patches, closed or open, exactness, the measured boundary deviation (B2). */
    readonly band?: CadBandReport;
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
    readonly gusset?: GussetReport;
    readonly endCap?: EndCapReport;
    /** A fillet weld bead's report (FRk2, D166): its joint, leg, seam and volume. */
    readonly bead?: BeadReport;
}
export interface CadPartSnapshot {
    readonly document: CadPartDocument;
    /** Parts no later feature consumes, in feature order. */
    readonly outputs: readonly CadPartOutput[];
    readonly features: readonly {
        readonly id: string;
        readonly kind: CadPartFeature['kind'];
        readonly dependencies: readonly string[];
    }[];
    /** Features computed in this evaluation, and features reused unchanged from the previous one. */
    readonly recomputation: {
        readonly evaluated: readonly string[];
        readonly reused: readonly string[];
    };
    /** With `profile`: each feature's cost, by id (a reused feature's is its lookup). */
    readonly profile?: Readonly<Record<string, CadPartFeatureProfile>>;
}
/**
 * `stepBytes`: an imported STEP file's text. A STEP file is read whole, and a solid of many faces holds
 * about 17 times its text in memory while it is built (a 19 MB faceted M8 bolt: about 320 MB): 32 MiB keeps
 * that near half a gigabyte, within a browser worker, and holds the studio's own exports of modelled
 * threads. The part document's own text stays at `fileBytes`. `stepTessellatedBytes`: a file whose excess over
 * `stepBytes` is tessellated meshes (AP242: the studio's own mesh exports, scans) — see `stepSizeProblem`.
 */
export declare const CadPartLimits: Readonly<{
    features: 512;
    parameters: 256;
    points: 1024;
    edges: 64;
    copies: 64;
    fileBytes: number;
    stepBytes: number;
    stepTessellatedBytes: number;
    length: 10000;
    meshTriangles: 2000000;
    planarMeshTriangles: 100000;
    subdVertices: 100000;
}>;
/**
 * Why a STEP file is too large to read, or null: its text past `stepTessellatedBytes`, or what is not tessellated in
 * it (B-rep records and the rest) past `stepBytes` (D49). Tessellated records take about 13 times their text while
 * read into a part (a 50 MB file of a million triangles: 680 MB; the owner's 128 MiB, D49, holds a 2M-triangle file) and a
 * mesh that size is held as arrays after; a mesh larger still opens from a .bcad file. A scan, no parse: checked before a file is read (the studio's worker too).
 */
export declare function stepSizeProblem(text: string): string | null;
export type Solid = {
    readonly kind: 'upright';
    readonly solid: PrismaticSolid;
} | {
    readonly kind: 'brep';
    readonly brep: Brep;
};
/** `history`: an upright body of one section and the edge finishes applied to it since (for shell). */
export interface Finish {
    readonly kind: 'chamfer' | 'fillet';
    readonly edges: readonly string[];
    readonly size: number;
    readonly id: string; /** A variable radius (D100), the radius at points of the edges. */
    readonly radii?: readonly {
        readonly at: Point;
        readonly radius: number;
    }[];
}
/** `moved`: the part this one is a moved (turned, mirrored, uniformly scaled) copy of, for shell. */
export interface Part {
    readonly solid: Solid;
    brep?: Brep;
    readonly mass?: (density: number) => MassProperties;
    readonly cylindricalWrap?: CylindricalWrapReport;
    readonly history?: {
        readonly base: PrismaticSolid;
        readonly finishes: readonly Finish[];
    };
    readonly moved?: {
        readonly from: Part;
        readonly m: BrepAffine['matrix'];
        readonly o: Point;
    };
    /** How a revolved or swept body was made (shell erodes its section and makes it again). */
    readonly revolved?: RevolveInput;
    readonly swept?: {
        readonly profile: readonly ProfileSegmentInput[];
        readonly steps: readonly SweepStep[];
        readonly sideTags?: readonly string[];
    };
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
    readonly sprocket?: SprocketReport;
    readonly pulley?: PulleyReport;
    readonly belt?: BeltReport;
    readonly coupling?: CouplingReport;
    readonly connector?: ConnectorReport;
    readonly connectorBody?: {
        readonly row: string;
        readonly overlap: number;
    };
    readonly shaft?: ShaftReport;
    readonly shaftPlace?: BrepAffine;
    readonly key?: KeyReport;
    readonly keyway?: KeywayReport;
    readonly ring?: RingReport;
    readonly pin?: PinReport;
    readonly bearing?: BearingReport;
    readonly gland?: GlandReport;
    readonly glandPlace?: GlandPlace;
    readonly oring?: {
        readonly ring: string;
        readonly overlap: number;
        readonly stretchedCrossSection: number;
    };
    readonly subd?: SubdSummary;
    /** A band surface's report (B2). */
    readonly band?: CadBandReport;
    readonly decimate?: DecimateReport;
    readonly fillet?: readonly FilletReport[];
    readonly shell?: MeshShellReport;
    readonly sheet?: SheetReport;
    readonly member?: FrameMemberReport;
    /** A frame member's placement as built (FRk1): its section on its line, its length and how far each end runs on, its face prefix. */
    readonly memberPlace?: MemberPlaced;
    readonly gusset?: GussetReport;
    readonly endCap?: EndCapReport;
    /** A gusset's placement as built (FRk2: its beads): its plane's frame and corner, its legs, clip, thickness and offset. */
    readonly gussetPlace?: GussetPlaced;
    readonly bead?: BeadReport;
}
/** A rack as placed: its pitch line from `origin` along `angle` (radians); the gear it meshes with, if any. */
export interface RackPlacement {
    readonly spec: SpurRackSpec;
    readonly origin: XY;
    readonly angle: number;
    readonly from: number;
    readonly meshesWith?: string;
    readonly driver?: GearPlacement;
}
/** A spur gear as placed: its spec, axis through `center` along +Z from `from`, turned by `rotation` (radians). */
export interface GearPlacement {
    readonly spec: SpurGearSpec;
    readonly center: XY;
    readonly from: number;
    readonly rotation: number;
    /** A meshing gear: the feature it meshes with, and that gear's placement (for the pair checks, checkPlacedSpurGears). */
    readonly meshesWith?: string;
    readonly driver?: GearPlacement;
    /** A pinion meshing inside a ring (R12b.2a): the ring's placement (checkPlacedInternalGears). */
    readonly ring?: PlacedInternalGear;
}
/** A worm as placed (R12b.5): its frame and turn; the wheel it meshes with and that one's placement. */
export interface WormPlacement extends PlacedWorm {
    readonly meshesWith?: string;
    readonly wheel?: GearPlacement;
    readonly throatedWheel?: PlacedThroatedWheel;
}
/** A bevel gear as placed (R12b.3): its apex, axis and turn; the bevel gear it meshes with and that one's placement. */
export interface BevelGearPlacement extends PlacedBevelGear {
    readonly meshesWith?: string;
    readonly driver?: BevelGearPlacement;
}
export type SweepStep = {
    kind: 'straight';
    length: number;
} | {
    kind: 'bend';
    radius: number;
    angle: number;
    toward: 'x' | '-x' | 'y' | '-y';
};
/** x ↦ m·x + o from a sketch's own XY (Z along its normal) into the part. */
type Frame = {
    readonly m: BrepAffine['matrix'];
    readonly o: Point;
};
export type Result = {
    readonly kind: 'sketch';
    readonly outer: readonly ProfileSegmentInput[];
    readonly frame?: Frame;
    readonly regions?: readonly (readonly ProfileSegmentInput[])[];
    readonly holes?: readonly (readonly ProfileSegmentInput[])[];
    readonly tags?: SideTags;
} | {
    readonly kind: 'solid';
    readonly parts: readonly Part[];
};
/** A B-rep of several bodies as one B-rep per body (each with its own shells, faces, loops, edges and vertices). */
export declare function splitBodies(b: Brep): Brep[];
export declare const empty: (s: Solid) => boolean;
export declare const planarBrep: (b: Brep) => boolean;
/**
 * F0 fallback (owner, 2026-10-18; D3, D42): a facet body (a mesh imported as facet faces) meets a Boolean,
 * split, hole or draft only through the planar path until F1/F2 give facets their own — exploded back to the
 * planar per-triangle B-rep when it has at most this many triangles, refused with CAPABILITY above it. Committed
 * evaluations take up to this many: about 5 s at the worst, a hole (its cylinder takes the analytic path) through
 * a 16k-triangle mesh in the studio's whole evaluation (4.8 s; 18k 5.1–5.4 s, 20k 6.1 s; a polyhedral union with a
 * box is faster, 3.2 s at 20k in R2). Since F1 (D50) and F2 (D52) only a Boolean of two meshes takes it (F3); F2
 * holds the same number for the mesh near an exact tool, the share its exact Boolean takes.
 */
export declare const FACET_EXPLODE_TRIANGLES = 16000;
/** A preview's limit (CadPartEvaluationOptions.facetExplodeTriangles): about a second, so a preview stays live. */
export declare const FACET_PREVIEW_TRIANGLES = 5000;
/** The current feature's kernel calls while `profile` evaluates (null otherwise: one test per counted call). */
export declare let profiling: CadPartProfileCalls | null;
export declare const brepOf: (part: Part, id: string) => Brep;
export declare const isRecord: (v: unknown) => v is Record<string, unknown>;
declare function meshArrayOk(v: unknown, what: 'positions' | 'indices', nv?: number): boolean;
/**
 * Results by their feature's resolved definition, each with the inputs it was made from: a feature is
 * reused when its definition is the same and every input is the very result (===) it was made from —
 * reused inputs stay the same objects, so a key never has to spell out what is upstream of it.
 */
type Cache = Map<string, {
    deps: readonly Result[];
    result: Result;
}[]>;
/**
 * `facetExplodeTriangles`: the F0 planar-path limit for this evaluation (FACET_PREVIEW_TRIANGLES for a preview; default
 * FACET_EXPLODE_TRIANGLES). `profile` (O10, D228): the snapshot's `profile`, each feature's own wall time and kernel calls.
 */
export interface CadPartEvaluationOptions {
    readonly facetExplodeTriangles?: number;
    readonly profile?: boolean;
}
/**
 * A feature's kernel calls during its evaluation (`profile`), counted at the part model's own entry points: its Boolean
 * dispatcher (`booleans`), the planar Boolean (`planarBooleans`), tessellations it makes, sweeps (the stepped and the
 * curved path), shells and edge finishes (fillets and chamfers). Calls a machine element's own sub-evaluation makes count
 * for the feature that made it. A body's B-rep built lazily, after the evaluation, is not counted.
 */
export interface CadPartProfileCalls {
    booleans: number;
    planarBooleans: number;
    tessellations: number;
    sweeps: number;
    shells: number;
    finishes: number;
}
/** A feature's cost in one evaluation: `wallTime` in seconds (performance.now(), not CPU time); `calls`, as above. */
export interface CadPartFeatureProfile {
    readonly wallTime: number;
    readonly calls: Readonly<CadPartProfileCalls>;
}
export declare function evaluateCadPart(input: CadPartDocument, previous?: Cache, options?: CadPartEvaluationOptions): CadPartSnapshot;
/** The output of a snapshot by id; refused, REFERENCE, when there is none. */
export declare function outputOf(snapshot: CadPartSnapshot, id: string): CadPartOutput;
/**
 * A snapshot evaluated again: with new parameter values (`parameters`, each one the document declares), or another
 * document (`document`); every feature whose resolved definition is unchanged is reused.
 */
export declare function reevaluate(snapshot: CadPartSnapshot, change: {
    readonly parameters: Readonly<Record<string, number>>;
} | {
    readonly document: CadPartDocument;
}): CadPartSnapshot;
/** A snapshot's document as saved text (a mesh's typed arrays written as plain arrays). */
export declare const saveCadPart: (snapshot: CadPartSnapshot) => string;
/** Parses and evaluates a saved part document. */
export declare function loadCadPart(text: string): CadPartSnapshot;
export declare const emptyCadPart: () => CadPartDocument;
export declare function resolvedDefinition(f: unknown, parameters: Readonly<Record<string, number>>): unknown;
export type Tools = {
    dim: (v: CadPartDim | undefined, what: string, positive?: boolean) => number;
    xy: (p: CadPartPoint2 | undefined, what: string) => XY;
    xyz: (p: CadPartPoint3 | undefined, what: string) => Point;
    integer: (v: unknown, what: string, lo: number, hi: number) => number;
    axisOf: (v: unknown) => CadPartAxis;
    solids: (r: unknown, what: string, allowEmpty?: boolean) => Part[];
    ref: (r: unknown, what: string) => {
        id: string;
        part: number | null;
        result: Result;
    };
    cutSource: (r: unknown) => {
        seed: Part;
        tool: Part[];
    };
    fail: (code: CadPartErrorCode, detail: string) => never;
    at: string;
    endpointBead: (f: EndpointBead, byMember: ReadonlyMap<number, Part>, frame: string) => Result;
};
declare function frameOf(plane: CadPartSketchPlane, xyz: Tools['xyz'], fail: Tools['fail']): Frame;
/** A solid's volume by its exact surfaces (quadrature where curved): the flange's collision test. */
export declare const exactVolume: (s: Solid) => number;
/** The points of a face's loops' vertices (its edges' ends). */
export declare function faceVertices(brep: Brep, face: string): Point[];
/**
 * One side of an oblique split plane round a target within R of o: a tetrahedron, its base a triangle on the plane
 * (inradius 2R about o) and its apex 4R off it, so that it holds everything within R of o on its side. Triangles
 * only: a rotated box's quads are not exactly planar in binary64 and the exact polyhedral Boolean refused them
 * (D50). Both sides take the same three base corners, so they share one exact plane. Its base is `<at>.cut.top`
 * below and `<at>.cut.bottom` above, as the axis split's box names it.
 */
export declare function obliqueHalf(o: Point, n: Point, x: Point, y: Point, R: number, below: boolean, at: string, capName?: string): Solid;
/**
 * A facet body's triangles as one welded mesh (its faces share their boundary points exactly), each triangle's group
 * its face, and the faces' names (without a `#k`: a face split again keeps its source's name, numbered).
 */
export declare function facetTriangles(brep: Brep): {
    positions: Float64Array;
    indices: Uint32Array;
    groups: Int32Array;
    names: string[];
};
/** Upright Booleans stay upright; otherwise both bodies must be planar for the exact polyhedral Boolean. */
export declare function boolean(a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, edgeFitTolerance?: number): Solid;
/**
 * Two bodies of planes only: the exact rational polyhedral Boolean. It needs each face's vertices exactly coplanar; a
 * body off the axes (a member on an oblique line, a split's slanted cut) has them so only to binary64 (~1e-15), and the
 * polyhedral route refuses the face (reason `NOT_PLANAR_WITHIN_FLOAT`, D126). Then the analytic Boolean, which works on the planes in binary64,
 * takes the pair (FR3a, D125: a mitred sharp tube on a 120° or 3D corner, and two such tubes welded, were refused).
 */
export declare function planarBoolean(a: Brep, b: Brep, op: 'union' | 'difference' | 'intersection', at: string): Brep;
export declare const volumeOfSolid: (s: Solid) => number;
export declare function affine(s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: ((n: string) => string) | string): Solid;
/**
 * Parts moved by x ↦ m·x + o (m a rotation or reflection times a uniform scale): each remembers what it
 * was moved from, and its mass moves with it (exact when the original's was).
 */
export declare function moveAll(parts: readonly Part[], m: BrepAffine['matrix'], o: Point, preserveNativeSI?: boolean): Result;
export declare function movedMass(p: MassProperties, m: BrepAffine['matrix'], o: Point, preserveNativeSI?: boolean): MassProperties;
/**
 * A profile swept along straight runs (extrusions) and bends (revolutions about an axis in the profile's
 * plane, a radius to its side), each placed where the last one ended; the pieces meet in whole
 * cross-sections and are joined.
 */
export declare function sweepBrep(profile: readonly ProfileSegmentInput[], steps: readonly SweepStep[], at: string, fail: Tools['fail'], through?: XY, sideTags?: readonly string[]): {
    brep: Brep;
    mass: (density: number) => MassProperties;
};
/**
 * An output's mass properties (R7.3b, MMGS): `density` in g/cm³ (1 by default); volume mm³, mass g, centroid mm,
 * inertia g·mm² about the centroid. An open mesh (a sheet) encloses nothing: refused.
 */
export declare function massPropertiesOf(output: CadPartOutput, density?: number): MassProperties;
/** An output's surface area (mm²) over its exact surfaces (brepSurfaceArea), worked out once. */
export declare function surfaceAreaOf(output: CadPartOutput): number;
/**
 * An output's L0 validation (checkBrep with `strict`): topology, edges on their surfaces, loops that do not cross, no
 * slivers, tolerances under the cap. Worked out once; an imported STEP body is reported here rather than refused.
 */
export declare function checkOutput(output: CadPartOutput): BrepCheckReport;
/** Binary STL (little-endian, 80-byte header) of an output's display tessellation. */
export declare function exportStl(output: CadPartOutput, options?: {
    readonly segmentsPerQuarter?: number;
}): Uint8Array;
/** A sheet-metal output's flat pattern: its fixed face and K-factor as made unless given, else its bend table bend by bend. */
export declare function flatPatternOf(output: CadPartOutput, options?: {
    readonly fixedFace?: string;
    readonly kFactor?: number;
}): FlatPattern;
/**
 * The part model's own helpers a feature family's module uses: passed in, never imported (they share this module's state,
 * the facet limit; `boolean` stays here). Frozen, so no family can swap one (R5.3, D221).
 */
declare const HELPERS: Readonly<{
    isRecord: (v: unknown) => v is Record<string, unknown>;
    brepOf: (part: Part, id: string) => Brep;
    CadPartLimits: Readonly<{
        features: 512;
        parameters: 256;
        points: 1024;
        edges: 64;
        copies: 64;
        fileBytes: number;
        stepBytes: number;
        stepTessellatedBytes: number;
        length: 10000;
        meshTriangles: 2000000;
        planarMeshTriangles: 100000;
        subdVertices: 100000;
    }>;
    stepSizeProblem: typeof stepSizeProblem;
    splitBodies: typeof splitBodies;
    meshArrayOk: typeof meshArrayOk;
    facetBody: (s: Solid) => boolean;
    facetTriangles: typeof facetTriangles;
    brepBodies: typeof brepBodies;
    frameOf: typeof frameOf;
    framed: (frame: Frame | undefined, p: Point) => Point;
    placed: (frame: Frame | undefined, compute: () => Result) => (() => Result);
}>;
export type PartHelpers = typeof HELPERS;
export {};
