// R7 (the facades): Plane, Location and the sketcher, as objects of their own (build123d's Plane and Location,
// replicad's `draw().lineTo().arcTo().close()`). Each is immutable and plain underneath: a Plane is a sketch's
// `{ origin, normal, xAxis }` (the kernel's CadPartSketchPlane and the studio's DocPlane, one shape), a Location the
// documents' Pose `{ position, rotation }` (api-conventions.md §10.2), and a Sketch the profile fields a sketch
// node carries in both documents (rectangle, circle, polygon or a loop of lines and arcs). The facade writes them into
// sketch, translate and rotate nodes; it computes no geometry of its own.
import { refuse } from './refusal.js';
const finite = (name, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v))
        throw refuse('VALUE', `${name} must be a number, not ${String(v)}`);
    return v;
};
const record = (name, value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw refuse('VALUE', `${name} must be an options object`);
};
const vec2 = (name, v) => {
    if (!Array.isArray(v) || v.length !== 2)
        throw refuse('VALUE', `${name} must be a point [x, y] in mm`);
    return [finite(name, v[0]), finite(name, v[1])];
};
const vec3 = (name, v) => {
    if (!Array.isArray(v) || v.length !== 3)
        throw refuse('VALUE', `${name} must be [x, y, z]`);
    return [finite(name, v[0]), finite(name, v[1]), finite(name, v[2])];
};
// (Unit and square: what the documents' planes are; the kernel normalises, the facade refuses a plane that isn't one.)
const UNIT_TOL = 1e-9;
/** A sketch plane (build123d's Plane): XY, XZ or YZ through the origin, offset along its normal, or any of your own. */
export class Plane {
    origin;
    normal;
    xAxis;
    constructor(origin, normal, xAxis) {
        this.origin = Object.freeze([...origin]);
        this.normal = Object.freeze([...normal]);
        this.xAxis = Object.freeze([...xAxis]);
        Object.freeze(this);
    }
    /** The XY plane: sketch X along X, sketch Y along Y, solids grow along +Z. A sketch on it stores no plane. */
    static XY = new Plane([0, 0, 0], [0, 0, 1], [1, 0, 0]);
    /** The XZ plane: sketch X along X, sketch Y along Z (its normal −Y, so Y = normal × X). */
    static XZ = new Plane([0, 0, 0], [0, -1, 0], [1, 0, 0]);
    /** The YZ plane: sketch X along Y, sketch Y along Z (its normal +X). */
    static YZ = new Plane([0, 0, 0], [1, 0, 0], [0, 1, 0]);
    /** A plane of your own; its normal and X axis unit vectors, square to each other. */
    static of(data) {
        record('plane', data);
        const o = vec3('origin', data.origin), n = vec3('normal', data.normal), x = vec3('xAxis', data.xAxis);
        if (Math.abs(Math.hypot(...n) - 1) > UNIT_TOL || Math.abs(Math.hypot(...x) - 1) > UNIT_TOL)
            throw refuse('VALUE', 'a plane\'s normal and X axis must be unit vectors');
        if (Math.abs(n[0] * x[0] + n[1] * x[1] + n[2] * x[2]) > UNIT_TOL)
            throw refuse('VALUE', 'a plane\'s X axis must lie in it, square to its normal');
        return new Plane(o, n, x);
    }
    /** The same plane moved `distance` (mm) along its normal. */
    offset(distance) {
        const k = finite('distance', distance), [o, n] = [this.origin, this.normal];
        return new Plane([o[0] + n[0] * k, o[1] + n[1] * k, o[2] + n[2] * k], n, this.xAxis);
    }
    /** Whether it is the XY plane through the origin, which a sketch node leaves out. */
    get isXY() { return same(this.origin, Plane.XY.origin) && same(this.normal, Plane.XY.normal) && same(this.xAxis, Plane.XY.xAxis); }
    /** The plain plane, as a sketch node stores it. */
    get data() {
        return { origin: [...this.origin], normal: [...this.normal], xAxis: [...this.xAxis] };
    }
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** A placement (build123d's Location), the documents' Pose: a turn about X, then Y, then Z, through the origin, then a move. */
export class Location {
    position;
    rotation;
    constructor(position, rotation) {
        this.position = Object.freeze([...position]);
        this.rotation = Object.freeze([...rotation]);
        Object.freeze(this);
    }
    /** Where nothing moves. */
    static IDENTITY = new Location([0, 0, 0], [0, 0, 0]);
    /** A placement of your own, either part left out at zero. */
    static of(pose) {
        record('location', pose);
        return new Location(vec3('position', pose.position === undefined ? [0, 0, 0] : pose.position), vec3('rotation', pose.rotation === undefined ? [0, 0, 0] : pose.rotation));
    }
    /** A move only. */
    static at(position) { return Location.of({ position: vec3('position', position) }); }
    /** The plain pose, as an instance stores it. */
    get data() { return { position: [...this.position], rotation: [...this.rotation] }; }
}
/** A finished, closed profile on a plane, ready for `extrude` or `revolve`. */
export class Sketch {
    #data;
    constructor(data) { this.#data = structuredClone(data); }
    /** The plain profile (a copy), as the sketch node stores it. */
    get data() { return structuredClone(this.#data); }
}
// (A sketch on XY through the origin stores no plane, as the studio writes it; every side gets its tag, `sides` of them.)
const onPlane = (plane, data, sides) => new Sketch({ ...data, ...(plane.isXY ? {} : { plane: plane.data }), sideTags: { outer: Array.from({ length: sides }, (_, k) => `e${k + 1}`) } });
const positive = (name, v) => { if (!(finite(name, v) > 0))
    throw refuse('VALUE', `${name} must be a positive number of mm, not ${v}`); return v; };
/** The start of a sketch on a plane: a rectangle, a circle, a polygon, or a path begun with `moveTo`. */
export class SketchStart {
    plane;
    constructor(plane) { this.plane = plane; }
    /** A w × d rectangle with its least corner at (x, y) in the plane — the box command's profile. */
    rectangle(o) {
        record('rectangle', o);
        const x = finite('x', o.x ?? 0), y = finite('y', o.y ?? 0);
        return onPlane(this.plane, { profile: 'rectangle', min: [x, y], max: [x + positive('w', o.w), y + positive('d', o.d)] }, 4);
    }
    /** A circle of radius r about (x, y) in the plane — the cylinder command's profile. */
    circle(o) {
        record('circle', o);
        return onPlane(this.plane, { profile: 'circle', center: [finite('x', o.x ?? 0), finite('y', o.y ?? 0)], radius: positive('r', o.r) }, 1);
    }
    /** A closed polygon through the points (mm, in the plane), in order. */
    polygon(points) {
        if (!Array.isArray(points) || points.length < 3)
            throw refuse('VALUE', 'a polygon needs at least three points');
        return onPlane(this.plane, { profile: 'polygon', points: Array.from(points, (p, k) => vec2(`point ${k + 1}`, p)) }, points.length);
    }
    /** A path of lines and arcs from a point; `close()` finishes it. */
    moveTo(point) { return new SketchPath(this.plane, vec2('moveTo', point), [], vec2('moveTo', point)); }
}
/** A path being drawn: each step returns a new path; `close()` returns the sketch. */
export class SketchPath {
    #plane;
    #first;
    #segments;
    #at;
    constructor(plane, first, segments, at) { this.#plane = plane; this.#first = first; this.#segments = segments; this.#at = at; }
    /** A straight line to the point. */
    lineTo(point) { return new SketchPath(this.#plane, this.#first, [...this.#segments, { kind: 'line', start: this.#at }], vec2('lineTo', point)); }
    /** An arc to the point round a centre, counter-clockwise unless `direction: 'cw'`. */
    arcTo(point, o) {
        record('arc', o);
        const direction = o.direction ?? 'ccw';
        if (direction !== 'ccw' && direction !== 'cw')
            throw refuse('VALUE', `an arc's direction is ccw or cw, not ${String(direction)}`);
        return new SketchPath(this.#plane, this.#first, [...this.#segments, { kind: 'arc', start: this.#at, center: vec2('center', o.center), direction }], vec2('arcTo', point));
    }
    /** The loop closed with a straight line back to its first point (none when it is already there). */
    close() {
        const back = this.#at[0] !== this.#first[0] || this.#at[1] !== this.#first[1];
        const segments = back ? [...this.#segments, { kind: 'line', start: this.#at }] : this.#segments;
        if (segments.length < 2)
            throw refuse('VALUE', 'a closed path needs at least two segments');
        return onPlane(this.#plane, { profile: 'loop', segments }, segments.length);
    }
}
/** A new sketch on a plane (XY unless given). */
export function sketch(plane = Plane.XY) {
    if (!(plane instanceof Plane))
        throw refuse('VALUE', 'a sketch goes on a Plane (Plane.XY, Plane.XZ, Plane.YZ, Plane.of(...))');
    return new SketchStart(plane);
}
