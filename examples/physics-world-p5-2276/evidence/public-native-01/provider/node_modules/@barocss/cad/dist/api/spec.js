// R7 (the facades): a modelling verb as a document-neutral spec — the agent's v2 command name and its `values`
// (api-conventions.md §12), with the faces or edges it acts on by persistent name, the sketch it is built from, or the
// tool body it combines with. The one part implementation (./part) turns each verb into a spec once; each document's
// backend writes the spec into its own document (§11): cad's into a CadPartDocument, cad-model's through the studio's
// own command, as the agent's run_command does. The body a spec acts on (the part's one body, or the chosen one) is the
// backend's argument beside it.
import { refuse } from './refusal.js';
import { surfaceSnapshot, surfaceSnapshots } from './surface-snapshot.js';
import { fillCutSnapshot } from '../features/fill-cut-pattern.js';
import { Sketch } from './sketch.js';
/** A value bound to a parameter: `box({ w: param('W'), d: 40, h: 10 })`. */
export const param = (name) => ({ parameter: name });
export const isParam = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.parameter === 'string';
const positive = (name, v) => { if (!(Number.isFinite(v) && v > 0))
    throw refuse('VALUE', `${name} must be a positive number of mm, not ${String(v)}`); return v; };
const finite = (name, v) => { if (!Number.isFinite(v))
    throw refuse('VALUE', `${name} must be a number of mm, not ${String(v)}`); return v; };
const degrees = (name, v) => { if (!Number.isFinite(v))
    throw refuse('VALUE', `${name} must be a number of degrees, not ${String(v)}`); return v; };
const count = (v) => { if (!Number.isInteger(v) || v < 2)
    throw refuse('VALUE', `count must be a whole number of copies, at least 2, not ${String(v)}`); return v; };
const axisName = (v) => { if (v !== 'x' && v !== 'y' && v !== 'z')
    throw refuse('VALUE', `an axis is x, y or z, not ${String(v)}`); return v; };
const tuple3 = (name, value) => {
    if (!Array.isArray(value) || value.length !== 3)
        throw refuse('VALUE', `${name} must be [x, y, z]`);
    const component = (k) => {
        const v = value[k];
        if (typeof v !== 'number' || !Number.isFinite(v))
            throw refuse('VALUE', `${name} ${'xyz'[k]} must be a finite number, not ${String(v)}`);
        return v;
    };
    return [component(0), component(1), component(2)];
};
const edgesOf = (edges, verb) => { if (!edges.length)
    throw refuse('SELECTION_EMPTY', `the selector picked no edge to ${verb}`); return edges; };
const sketchData = (s) => { if (!(s instanceof Sketch))
    throw refuse('VALUE', 'give a finished sketch: sketch(plane)…close(), .rectangle(), .circle() or .polygon()'); return s.data; };
export function boxSpec(o) {
    return { command: 'box', values: { w: positive('w', o.w), d: positive('d', o.d), h: positive('h', o.h), x: finite('x', o.x ?? 0), y: finite('y', o.y ?? 0), z: finite('z', o.z ?? 0) } };
}
export function cylinderSpec(o) {
    return { command: 'cylinder', values: { r: positive('r', o.r), h: positive('h', o.h), x: finite('x', o.x ?? 0), y: finite('y', o.y ?? 0), z: finite('z', o.z ?? 0) } };
}
export function extrudeSpec(s, o) {
    return { command: 'extrude', sketch: sketchData(s), values: { h: positive('h', o.h), draft: degrees('draft', o.draft ?? 0) } };
}
export function revolveSpec(s, o = {}) {
    const axis = o.axis ?? 'y', deg = degrees('deg', o.deg ?? 360);
    if (axis !== 'x' && axis !== 'y')
        throw refuse('VALUE', `a revolve turns about the sketch's x or y axis, not ${String(axis)}`);
    if (!(deg > 0 && deg <= 360))
        throw refuse('VALUE', `deg is more than 0 and at most 360, not ${deg}`);
    return { command: 'revolve', sketch: sketchData(s), values: { axis, deg } };
}
export function holeSpec(face, o) {
    const requestedType = o.type, type = requestedType === undefined ? (o.depth !== undefined ? 'blind' : 'through') : requestedType;
    if (type !== 'through' && type !== 'blind')
        throw refuse('VALUE', `a hole's type is through or blind, not ${String(type)}`);
    if (type === 'blind' && o.depth === undefined)
        throw refuse('VALUE', 'a blind hole needs depth');
    return { command: 'hole', face, values: { type, d: positive('d', o.d), x: finite('x', o.x), y: finite('y', o.y), ...(type === 'blind' ? { depth: positive('depth', o.depth) } : {}) } };
}
export function filletSpec(edges, o, picked) {
    const names = edgesOf(edges, 'fillet'), radius = positive('radius', o.radius);
    if (o.endRadius === undefined)
        return { command: 'fillet', edges: names, values: { radius } };
    const endRadius = finite('endRadius', o.endRadius);
    if (radius < 0.1 || endRadius < 0.1)
        throw refuse('VALUE', 'explicit fillet endpoint radii must be at least 0.1 mm');
    if (picked?.length !== 1)
        throw refuse('SELECTION_ONE', 'an endRadius takes exactly one straight open edge with one name');
    const edge = picked[0];
    if (!edge.straight || edge.a.length !== 3 || edge.b.length !== 3 || ![...edge.a, ...edge.b].every(Number.isFinite)
        || edge.a.map(x => Math.round(x * 1e4)).join(',') === edge.b.map(x => Math.round(x * 1e4)).join(','))
        throw refuse('VALUE', 'an endRadius takes one straight open edge with distinct endpoints');
    if (names.length !== 1)
        throw refuse('SELECTION_ONE', 'an endRadius takes exactly one straight open edge with one name');
    // Preserve the existing Studio command threshold without silently dropping a distinct end radius.
    if (endRadius !== radius && Math.abs(endRadius - radius) <= 1e-9)
        throw refuse('VALUE', 'distinct fillet endpoint radii must differ by more than 1e-9 mm');
    return { command: 'fillet', edges: names, values: { radius, ...(endRadius !== radius ? { endRadius } : {}) } };
}
export function chamferSpec(edges, o) {
    return { command: 'chamfer', edges: edgesOf(edges, 'chamfer'), values: { distance: positive('distance', o.distance) } };
}
export function cylindricalWrapSpec(face, o) {
    if (![o.u0, o.u1, o.v0, o.v1].every(v => typeof v === 'number' && Number.isFinite(v)))
        throw refuse('VALUE', 'cylindrical wrap bounds must be finite original native UV values');
    if (!(0 < o.u0 && o.u0 < o.u1 && o.u1 < 0.5 && 0 < o.v0 && o.v0 < o.v1 && o.v1 < 1))
        throw refuse('VALUE', 'cylindrical wrap needs 0 < u0 < u1 < 0.5 and 0 < v0 < v1 < 1');
    return { command: 'cylindrical-wrap', face, values: { u0: o.u0, u1: o.u1, v0: o.v0, v1: o.v1, height: positive('height', o.height) } };
}
export function shellSpec(open, o) {
    return { command: 'shell', faces: open, values: { t: positive('t', o.t) } };
}
/** Capture a whole-surface recipe once; curved results use the native faceted approximation. */
export function thickenSpec(surface, o) {
    const t = positive('t', o.t), side = o.side;
    if (t > 10000)
        throw refuse('VALUE', 'thicken t must be at most 10000 mm');
    if (side !== undefined && side !== 'normal' && side !== 'reverse' && side !== 'both')
        throw refuse('VALUE', 'thicken side must be normal, reverse or both');
    return { command: 'thicken', surface: surfaceSnapshot(surface), values: { t, ...(side !== undefined && side !== 'normal' ? { side } : {}) } };
}
/** Copy ordered whole surfaces into one new closed body with the existing native sewing algorithm. */
export function sewSpec(surfaces, o = {}) {
    const tol = o.tol === undefined ? 0 : o.tol;
    if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 0 || tol > 1)
        throw refuse('VALUE', 'sew tol must be 0 (automatic) or a positive number at most 1 mm');
    return { command: 'sew', surfaces: surfaceSnapshots(surfaces), values: { tol } };
}
export function booleanSpec(command, tool) {
    return { command, tool, values: {} };
}
export function linearPatternSpec(o) {
    return { command: 'linear-pattern', values: { axis: axisName(o.axis), spacing: positive('spacing', o.spacing), count: count(o.count) } };
}
export function linearFeaturePatternSpec(o) {
    return { command: 'linear-feature-pattern', values: { axis: axisName(o.axis), spacing: positive('spacing', o.spacing), count: count(o.count) } };
}
export function rectangularFeaturePatternSpec(o) {
    const axis = axisName(o.axis), axis2 = axisName(o.axis2);
    if (axis === axis2)
        throw refuse('VALUE', 'rectangular feature pattern axes must be distinct');
    if (!Number.isSafeInteger(o.count) || o.count < 1 || !Number.isSafeInteger(o.count2) || o.count2 < 1)
        throw refuse('VALUE', 'rectangular feature pattern counts must be safe whole numbers of at least 1');
    return { command: 'rectangular-feature-pattern', values: { axis, spacing: positive('spacing', o.spacing), count: o.count, axis2, spacing2: positive('spacing2', o.spacing2), count2: o.count2 } };
}
export function fillFeaturePatternSpec(o) {
    const spacing = positive('spacing', o.spacing), spacing2 = positive('spacing2', o.spacing2);
    if (spacing > 10000 || spacing2 > 10000)
        throw refuse('VALUE', 'fill cut pattern spacing must be at most 10000 mm');
    if (!Number.isSafeInteger(o.count) || o.count < 1 || o.count > 64 || !Number.isSafeInteger(o.count2) || o.count2 < 1 || o.count2 > 64 || o.count * o.count2 > 64)
        throw refuse('VALUE', 'fill cut pattern needs at most 64 candidate cells, with each count from 1 to 64');
    const snapshot = fillCutSnapshot(o.region, o.anchor, (_code, message) => { throw refuse('VALUE', message); });
    return { command: 'fill-feature-pattern', ...snapshot, values: { spacing, count: o.count, spacing2, count2: o.count2 } };
}
export function curveFeaturePatternSpec(o) {
    const spacing = positive('spacing', o.spacing);
    if (spacing > 10000)
        throw refuse('VALUE', 'path cut pattern spacing must be at most 10000 mm');
    if (!Number.isSafeInteger(o.count) || o.count < 1 || o.count > 64)
        throw refuse('VALUE', 'path cut pattern count must be a whole number from 1 to 64, including the original cut');
    return { command: 'curve-feature-pattern', path: o.path, values: { spacing, count: o.count } };
}
export function circularPatternSpec(o) {
    const axis = axisName(o.axis ?? 'z'), n = count(o.count), span = degrees('span', o.span ?? 360);
    if (!(span > 0 && span <= 360))
        throw refuse('VALUE', `span is more than 0 and at most 360, not ${span}`);
    if (axis !== 'z' && (n > 4 || span !== 360 || o.px !== undefined || o.py !== undefined))
        throw refuse('VALUE', `about ${axis} the copies step by quarter turns: 2 to 4 of them, with no span or axis position`);
    return { command: 'circular-pattern', values: { axis, count: n, span, px: finite('px', o.px ?? 0), py: finite('py', o.py ?? 0) } };
}
export function moveSpec(offset) {
    const [x, y, z] = tuple3('offset', offset);
    return { command: 'move', values: { x, y, z } };
}
/** A turn about an axis through the origin (a Location's). */
export function rotateSpec(axis, angle) {
    return { command: 'rotate', values: { axis: axisName(axis), angle: degrees('angle', angle), px: 0, py: 0, pz: 0 } };
}
export function mirrorSpec(o) {
    if (o.plane !== 'yz' && o.plane !== 'xz' && o.plane !== 'xy')
        throw refuse('VALUE', `a mirror plane is yz, xz or xy, not ${String(o.plane)}`);
    return { command: 'mirror', values: { plane: o.plane, at: finite('at', o.at ?? 0) } };
}
/** A uniform scale about a pivot (the origin unless given, in both cores: the studio's own default, the body's centre, is not taken). */
export function scaleSpec(o) {
    const p = tuple3('pivot', o.pivot === undefined ? [0, 0, 0] : o.pivot);
    if (!(Number.isFinite(o.factor) && o.factor > 0))
        throw refuse('VALUE', `factor must be a positive number, not ${String(o.factor)}`);
    return { command: 'scale', values: { factor: o.factor, px: finite('pivot x', p[0]), py: finite('pivot y', p[1]), pz: finite('pivot z', p[2]) } };
}
export function splitSpec(o) {
    const at = finite('at', o.at);
    if ('normal' in o) {
        const [nx, ny, nz] = tuple3('normal', o.normal);
        if (!(Math.hypot(nx, ny, nz) > 1e-9))
            throw refuse('VALUE', 'a split plane\'s normal must not be zero');
        return { command: 'split', values: { axis: 'n', nx, ny, nz, at } };
    }
    return { command: 'split', values: { axis: axisName(o.axis), at } };
}
/** A studio command's spec: each value a finite number or a string, by the command's own names (its checks are its own). */
export function studioSpec(command, values) {
    const out = {};
    for (const [k, v] of Object.entries(values)) {
        if (v === undefined)
            continue;
        if (typeof v === 'number' ? !Number.isFinite(v) : typeof v !== 'string')
            throw refuse('VALUE', `${command}'s ${k} is a number or a word, not ${String(v)}`);
        out[k] = v;
    }
    return { command, values: out };
}
