// R7 (the facades): Plane, Location and the sketcher, as objects of their own (build123d's Plane and Location,
// replicad's `draw().lineTo().arcTo().close()`). Each is immutable and plain underneath: a Plane is a sketch's
// `{ origin, normal, xAxis }` (the kernel's CadPartSketchPlane and the studio's DocPlane, one shape), a Location the
// documents' Pose `{ position, rotation }` (api-conventions.md §10.2), and a Sketch the profile fields a sketch
// node carries in both documents (rectangle, circle, polygon or a loop of lines and arcs). The facade writes them into
// sketch, translate and rotate nodes; it computes no geometry of its own.
import { refuse } from './refusal.js';
import type { Vec3 } from './select.js';

export type Vec2 = readonly [number, number];

/** A plane as the documents store it: its origin (mm), its normal and its X axis (unit vectors, square to each other). */
export interface PlaneData { readonly origin: Vec3; readonly normal: Vec3; readonly xAxis: Vec3 }

const finite = (name: string, v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw refuse('VALUE', `${name} must be a number, not ${String(v)}`);
  return v;
};
const vec2 = (name: string, v: Vec2): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2) throw refuse('VALUE', `${name} must be a point [x, y] in mm`);
  return [finite(name, v[0]), finite(name, v[1])];
};
const vec3 = (name: string, v: Vec3): [number, number, number] => {
  if (!Array.isArray(v) || v.length !== 3) throw refuse('VALUE', `${name} must be [x, y, z]`);
  return [finite(name, v[0]), finite(name, v[1]), finite(name, v[2])];
};
// (Unit and square: what the documents' planes are; the kernel normalises, the facade refuses a plane that isn't one.)
const UNIT_TOL = 1e-9;

/** A sketch plane (build123d's Plane): XY, XZ or YZ through the origin, offset along its normal, or any of your own. */
export class Plane {
  readonly origin: Vec3; readonly normal: Vec3; readonly xAxis: Vec3;
  private constructor(origin: Vec3, normal: Vec3, xAxis: Vec3) { this.origin = origin; this.normal = normal; this.xAxis = xAxis; Object.freeze(this); }

  /** The XY plane: sketch X along X, sketch Y along Y, solids grow along +Z. A sketch on it stores no plane. */
  static readonly XY = new Plane([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  /** The XZ plane: sketch X along X, sketch Y along Z (its normal −Y, so Y = normal × X). */
  static readonly XZ = new Plane([0, 0, 0], [0, -1, 0], [1, 0, 0]);
  /** The YZ plane: sketch X along Y, sketch Y along Z (its normal +X). */
  static readonly YZ = new Plane([0, 0, 0], [1, 0, 0], [0, 1, 0]);

  /** A plane of your own; its normal and X axis unit vectors, square to each other. */
  static of(data: PlaneData): Plane {
    const o = vec3('origin', data.origin), n = vec3('normal', data.normal), x = vec3('xAxis', data.xAxis);
    if (Math.abs(Math.hypot(...n) - 1) > UNIT_TOL || Math.abs(Math.hypot(...x) - 1) > UNIT_TOL) throw refuse('VALUE', 'a plane\'s normal and X axis must be unit vectors');
    if (Math.abs(n[0] * x[0] + n[1] * x[1] + n[2] * x[2]) > UNIT_TOL) throw refuse('VALUE', 'a plane\'s X axis must lie in it, square to its normal');
    return new Plane(o, n, x);
  }

  /** The same plane moved `distance` (mm) along its normal. */
  offset(distance: number): Plane {
    const k = finite('distance', distance), [o, n] = [this.origin, this.normal];
    return new Plane([o[0] + n[0] * k, o[1] + n[1] * k, o[2] + n[2] * k], n, this.xAxis);
  }

  /** Whether it is the XY plane through the origin, which a sketch node leaves out. */
  get isXY(): boolean { return same(this.origin, Plane.XY.origin) && same(this.normal, Plane.XY.normal) && same(this.xAxis, Plane.XY.xAxis); }

  /** The plain plane, as a sketch node stores it. */
  get data(): { origin: [number, number, number]; normal: [number, number, number]; xAxis: [number, number, number] } {
    return { origin: [...this.origin], normal: [...this.normal], xAxis: [...this.xAxis] };
  }
}

const same = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** A placement as the documents store one (an instance's, a frame's): rotated about X, then Y, then Z (degrees), then moved (mm). */
export interface PoseData { readonly position: Vec3; readonly rotation: Vec3 }

/** A placement (build123d's Location), the documents' Pose: a turn about X, then Y, then Z, through the origin, then a move. */
export class Location {
  readonly position: Vec3; readonly rotation: Vec3;
  private constructor(position: Vec3, rotation: Vec3) { this.position = position; this.rotation = rotation; Object.freeze(this); }

  /** Where nothing moves. */
  static readonly IDENTITY = new Location([0, 0, 0], [0, 0, 0]);
  /** A placement of your own, either part left out at zero. */
  static of(pose: Partial<PoseData>): Location { return new Location(vec3('position', pose.position ?? [0, 0, 0]), vec3('rotation', pose.rotation ?? [0, 0, 0])); }
  /** A move only. */
  static at(position: Vec3): Location { return Location.of({ position }); }

  /** The plain pose, as an instance stores it. */
  get data(): { position: [number, number, number]; rotation: [number, number, number] } { return { position: [...this.position], rotation: [...this.rotation] }; }
}

/** One segment of a sketch loop, as both documents store it: from `start` to the next segment's start, straight or round `center`. */
export type LoopSegment = { readonly kind: 'line'; readonly start: Vec2 } | { readonly kind: 'arc'; readonly start: Vec2; readonly center: Vec2; readonly direction: 'ccw' | 'cw' };

/**
 * A sketch's profile, the fields its node carries (a node adds `kind: 'sketch'` and its id). `sideTags` (D86) give each
 * side an id of its own, `e1` … in the order the sides run, as the studio's sketcher gives them: the walls a body makes
 * of the sketch are named `side[e<k>]`, and keep their names when a side is added or taken away elsewhere (a vertex
 * inserted in the studio's sketcher takes a new id and leaves the others).
 */
export type SketchData = (
  | { readonly profile: 'rectangle'; readonly min: Vec2; readonly max: Vec2 }
  | { readonly profile: 'circle'; readonly center: Vec2; readonly radius: number }
  | { readonly profile: 'polygon'; readonly points: readonly Vec2[] }
  | { readonly profile: 'loop'; readonly segments: readonly LoopSegment[] }
) & { readonly plane?: PlaneData; readonly sideTags?: { readonly outer: readonly string[] } };

/** A finished, closed profile on a plane, ready for `extrude` or `revolve`. */
export class Sketch {
  readonly #data: SketchData;
  constructor(data: SketchData) { this.#data = data; }
  /** The plain profile (a copy), as the sketch node stores it. */
  get data(): SketchData { return structuredClone(this.#data); }
}

// (A sketch on XY through the origin stores no plane, as the studio writes it; every side gets its tag, `sides` of them.)
const onPlane = (plane: Plane, data: SketchData, sides: number): Sketch =>
  new Sketch({ ...data, ...(plane.isXY ? {} : { plane: plane.data }), sideTags: { outer: Array.from({ length: sides }, (_, k) => `e${k + 1}`) } });

const positive = (name: string, v: number) => { if (!(finite(name, v) > 0)) throw refuse('VALUE', `${name} must be a positive number of mm, not ${v}`); return v; };

/** The start of a sketch on a plane: a rectangle, a circle, a polygon, or a path begun with `moveTo`. */
export class SketchStart {
  readonly plane: Plane;
  constructor(plane: Plane) { this.plane = plane; }

  /** A w × d rectangle with its least corner at (x, y) in the plane — the box command's profile. */
  rectangle(o: { w: number; d: number; x?: number; y?: number }): Sketch {
    const x = finite('x', o.x ?? 0), y = finite('y', o.y ?? 0);
    return onPlane(this.plane, { profile: 'rectangle', min: [x, y], max: [x + positive('w', o.w), y + positive('d', o.d)] }, 4);
  }
  /** A circle of radius r about (x, y) in the plane — the cylinder command's profile. */
  circle(o: { r: number; x?: number; y?: number }): Sketch {
    return onPlane(this.plane, { profile: 'circle', center: [finite('x', o.x ?? 0), finite('y', o.y ?? 0)], radius: positive('r', o.r) }, 1);
  }
  /** A closed polygon through the points (mm, in the plane), in order. */
  polygon(points: readonly Vec2[]): Sketch {
    if (!Array.isArray(points) || points.length < 3) throw refuse('VALUE', 'a polygon needs at least three points');
    return onPlane(this.plane, { profile: 'polygon', points: points.map((p, k) => vec2(`point ${k + 1}`, p)) }, points.length);
  }
  /** A path of lines and arcs from a point; `close()` finishes it. */
  moveTo(point: Vec2): SketchPath { return new SketchPath(this.plane, vec2('moveTo', point), [], vec2('moveTo', point)); }
}

/** A path being drawn: each step returns a new path; `close()` returns the sketch. */
export class SketchPath {
  readonly #plane: Plane; readonly #first: Vec2; readonly #segments: readonly LoopSegment[]; readonly #at: Vec2;
  constructor(plane: Plane, first: Vec2, segments: readonly LoopSegment[], at: Vec2) { this.#plane = plane; this.#first = first; this.#segments = segments; this.#at = at; }

  /** A straight line to the point. */
  lineTo(point: Vec2): SketchPath { return new SketchPath(this.#plane, this.#first, [...this.#segments, { kind: 'line', start: this.#at }], vec2('lineTo', point)); }
  /** An arc to the point round a centre, counter-clockwise unless `direction: 'cw'`. */
  arcTo(point: Vec2, o: { center: Vec2; direction?: 'ccw' | 'cw' }): SketchPath {
    const direction = o.direction ?? 'ccw';
    if (direction !== 'ccw' && direction !== 'cw') throw refuse('VALUE', `an arc's direction is ccw or cw, not ${String(direction)}`);
    return new SketchPath(this.#plane, this.#first, [...this.#segments, { kind: 'arc', start: this.#at, center: vec2('center', o.center), direction }], vec2('arcTo', point));
  }
  /** The loop closed with a straight line back to its first point (none when it is already there). */
  close(): Sketch {
    const back = this.#at[0] !== this.#first[0] || this.#at[1] !== this.#first[1];
    const segments = back ? [...this.#segments, { kind: 'line' as const, start: this.#at }] : this.#segments;
    if (segments.length < 2) throw refuse('VALUE', 'a closed path needs at least two segments');
    return onPlane(this.#plane, { profile: 'loop', segments }, segments.length);
  }
}


/** A new sketch on a plane (XY unless given). */
export function sketch(plane: Plane = Plane.XY): SketchStart {
  if (!(plane instanceof Plane)) throw refuse('VALUE', 'a sketch goes on a Plane (Plane.XY, Plane.XZ, Plane.YZ, Plane.of(...))');
  return new SketchStart(plane);
}
