import type { ProfileSegmentInput } from './extruded-profile-solid.js';

// FRk1 (D164, D165): a frame's weldment plates — gussets in the corner of two members, caps over (or plugs in) a member's
// square end. Each is a prism of the user's thickness placed by the members' own lines, frames and section boxes, its
// report what the outer lane's weld list and BOM read (the shape frozen in D164). No size is defaulted: legs, clips and
// thicknesses are the user's.

type P3 = readonly [number, number, number];

/** One weld seam of a plate: the edge lying on a member's face, its length (a straight edge's: exact), the face's name. */
export interface WeldmentSeam { readonly member: number; readonly lengthMM: number; readonly face?: string }

/**
 * A gusset (FRk1): a plate in the plane of two members meeting at a skeleton point, its legs along their inner faces
 * from the corner where those faces meet, the corner clipped `clipMM` along each leg. `plane` is its mid-plane;
 * `outline` its corners there (anticlockwise about `plane.normal`); `seams` the edges on the two members' faces.
 */
export interface GussetReport {
  readonly frame: string; readonly point: number; readonly members: readonly [number, number];
  readonly legsMM: readonly [number, number]; readonly thicknessMM: number; readonly clipMM: number; readonly offsetMM: number;
  /** The angle between the two members' directions away from the joint. */
  readonly angleDegrees: number;
  readonly plane: { readonly origin: P3; readonly normal: P3 };
  readonly areaMM2: number; readonly volumeMM3: number;
  readonly outline: readonly P3[];
  readonly seams: readonly WeldmentSeam[];
}

/**
 * An end cap (FRk1): a plate `over` a member's square end (its section's outer loop) or `inset` in its bore (the bore's
 * loop), `thicknessMM` thick. `plane` is the face it sits on (the member's end), its normal out of the member; the seam
 * its loop where it meets the member (the loop's perimeter, exact for lines and arcs).
 */
export interface EndCapReport {
  readonly frame: string; readonly member: number; readonly end: 'start' | 'end'; readonly fit: 'over' | 'inset';
  readonly thicknessMM: number; readonly areaMM2: number; readonly volumeMM3: number;
  readonly plane: { readonly origin: P3; readonly normal: P3 };
  readonly seam: { readonly lengthMM: number; readonly exact: true };
}

/** The signed sweep of an arc segment from its start to `end` (anticlockwise positive), a full turn when they meet. */
function arcSweep(g: Extract<ProfileSegmentInput, { kind: 'arc' }>, end: readonly [number, number]): { r: number; a0: number; d: number } {
  const c = g.center, r = Math.hypot(g.start[0] - c[0], g.start[1] - c[1]), a0 = Math.atan2(g.start[1] - c[1], g.start[0] - c[0]);
  let d = Math.atan2(end[1] - c[1], end[0] - c[0]) - a0;
  if (g.direction === 'ccw') { while (d <= 1e-15) d += 2 * Math.PI; } else { while (d >= -1e-15) d -= 2 * Math.PI; }
  return { r, a0, d };
}
/** The area a loop of lines and arcs encloses (each segment from its start to the next one's), by Green's theorem: closed form, unsigned. */
export function loopArea(loop: readonly ProfileSegmentInput[]): number {
  let A = 0;
  for (let i = 0; i < loop.length; i++) {
    const g = loop[i], e = loop[(i + 1) % loop.length].start;
    if (g.kind === 'line') { A += (g.start[0] * e[1] - e[0] * g.start[1]) / 2; continue; }
    const { r, a0, d } = arcSweep(g, e), c = g.center;
    A += 0.5 * (r * r * d + c[0] * r * (Math.sin(a0 + d) - Math.sin(a0)) - c[1] * r * (Math.cos(a0 + d) - Math.cos(a0)));
  }
  return Math.abs(A);
}
/** A loop's perimeter: lines' lengths and arcs' r·|sweep|, closed form. */
export function loopPerimeter(loop: readonly ProfileSegmentInput[]): number {
  let L = 0;
  for (let i = 0; i < loop.length; i++) {
    const g = loop[i], e = loop[(i + 1) % loop.length].start;
    if (g.kind === 'line') { L += Math.hypot(e[0] - g.start[0], e[1] - g.start[1]); continue; }
    const { r, d } = arcSweep(g, e);
    L += r * Math.abs(d);
  }
  return L;
}
