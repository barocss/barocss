// LIB2 (D62): placing library parts by their interfaces, and the fits a library declares checked by building them.
// Two interfaces mate facing each other: b's frame turned and moved onto a's with its z against a's z and its x along
// a's x (y following), shifted by an offset in a's frame. A fit builds both parts, places b so, and measures their
// overlap with the exact Boolean: touching parts overlap by nothing.
import { booleanAnalytic } from '../brep/analytic-boolean.js';
import { brepMassProperties } from '../brep/solid-mass.js';
import { transformBrep } from '../brep/brep-transform.js';
import { evaluateCadPart, outputOf } from '../part/part-model.js';
import { CadLibraryError, evaluateLibraryExpression, instantiateLibraryPart, parseLibraryExpression } from './library.js';
import { cross as crossOf } from '../core/vec3.js';
const unitOf = (v) => { const a = v, n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
/**
 * Where b goes so that its interface meets a's: R takes b's frame (x, y, z) to (x_a, −y_a, −z_a) — facing — and t puts
 * b's origin at a's moved by `offset` (along a's x, y, z). Frames in their parts' own coordinates; the result in a's.
 */
export function placeByInterfaces(a, b, offset = [0, 0, 0]) {
    const za = unitOf(a.frame.z), xa = unitOf(a.frame.x), ya = crossOf(za, xa), zb = unitOf(b.frame.z), xb = unitOf(b.frame.x), yb = crossOf(zb, xb);
    // (Orthonormal: the x's made perpendicular to the z's on load; y = z × x.)
    const to = [xa, [-ya[0], -ya[1], -ya[2]], [-za[0], -za[1], -za[2]]], from = [xb, yb, zb], R = [];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            R.push(to[0][i] * from[0][j] + to[1][i] * from[1][j] + to[2][i] * from[2][j]);
    const oa = a.frame.origin, ob = b.frame.origin;
    const t = [0, 1, 2].map(i => oa[i] + offset[0] * xa[i] + offset[1] * ya[i] + offset[2] * za[i] - (R[3 * i] * ob[0] + R[3 * i + 1] * ob[1] + R[3 * i + 2] * ob[2]));
    return { rotation: R, translation: t };
}
const builds = new WeakMap();
function build(lib, end, prefix) {
    let byKey = builds.get(lib);
    if (!byKey) {
        byKey = new Map();
        builds.set(lib, byKey);
    }
    const key = JSON.stringify([end.part, end.variant ?? null, end.params ?? null, end.interface, prefix]);
    let out = byKey.get(key);
    if (!out) {
        out = buildEnd(lib, end, prefix);
        byKey.set(key, out);
    }
    return out;
}
/** One end built: its bodies (the part's outputs) and its interface. */
function buildEnd(lib, end, prefix) {
    const inst = instantiateLibraryPart(lib, end.part, { ...(end.variant ? { variant: end.variant } : {}), ...(end.params ? { params: end.params } : {}), prefix });
    const itf = inst.interfaces.find(i => i.id === end.interface);
    if (!itf)
        throw new CadLibraryError('REFERENCE', `${lib.manifest.id}/${end.part}`, `interface ${end.interface} is not there for these values`);
    const result = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: inst.features });
    return { breps: inst.outputs.map(o => outputOf(result, o).brep), itf, warnings: inst.warnings, values: inst.values };
}
/** A declared fit (or one given): both parts built, b placed onto a, their overlap by the exact Boolean intersection. */
export function checkLibraryFit(lib, fit) {
    const f = typeof fit === 'string' ? lib.manifest.fits?.find(x => x.id === fit) : fit;
    if (!f)
        throw new CadLibraryError('REFERENCE', lib.manifest.id, `no fit ${String(fit)}`);
    const A = build(lib, f.a, 'A'), B = build(lib, f.b, 'B'), offset = f.offset ?? [0, 0, 0], placement = placeByInterfaces(A.itf, B.itf, offset);
    const probe = 0.01, pushed = placeByInterfaces(A.itf, B.itf, [offset[0], offset[1], offset[2] - probe]);
    const overlap = overlapOf(A.breps, B.breps, placement), max = f.maxOverlap ?? 1e-6, contact = overlapOf(A.breps, B.breps, pushed) > max;
    const scope = {};
    for (const [k, v] of Object.entries(A.values))
        scope[`a_${k}`] = v;
    for (const [k, v] of Object.entries(B.values))
        scope[`b_${k}`] = v;
    const checks = (f.checks ?? []).map(c => ({ id: c.id, pass: evaluateLibraryExpression(parseLibraryExpression(c.expr), scope, `${f.id ?? 'fit'}!${c.id}`) !== 0, ...(c.value ? { value: evaluateLibraryExpression(parseLibraryExpression(c.value), scope) } : {}), message: c.message }));
    return { id: f.id ?? 'fit', overlap: overlap, maxOverlap: max, contact, contactProbe: probe, ok: overlap <= max && contact && checks.every(c => c.pass), placement, warnings: [...A.warnings, ...B.warnings], checks };
}
/** The volume common to a's bodies and b's placed. */
function overlapOf(a, b, p) {
    let overlap = 0;
    for (const bb of b) {
        const moved = transformBrep(bb, { matrix: p.rotation, offset: p.translation });
        for (const ab of a) {
            const common = booleanAnalytic(ab, moved, 'intersection');
            if (common.bodies.length)
                overlap += brepMassProperties(common, 1).volume;
        }
    }
    return overlap;
}
