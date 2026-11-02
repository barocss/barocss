import { booleanAnalytic, faceGeometry } from '../brep/analytic-boolean.js';
import { brepMassProperties } from '../brep/solid-mass.js';
import { transformBrep } from '../brep/brep-transform.js';
import { evaluateCadPart, outputOf } from '../part/part-model.js';
import { lookupFit, FitError } from './fits.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
/** This module's refusal (R7.3a batch 2: the GlandError class folded, D279): a BarocssError, `details.source` 'gland'. */
export const glandError = (code, detail) => kernelRefusal('gland', code, `gland: ${detail}`);
/** Whether something thrown is this module's refusal. */
export const isGlandError = (e) => isFrom(e, 'gland');
const fail = (code, detail) => { throw glandError(code, detail); };
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const pct = (x) => +(100 * x).toFixed(3);
const mm = (x) => +x.toFixed(6);
/** D139's O2 (Fictiv's O-ring groove design guide, read 2026-10-21): guidance ranges, shipped as estimates. */
export const O2_RANGES = {
    radial: { squeezePercent: [18, 25], fillPercent: [75, 85], stretchMaxPercent: 5, source: 'Fictiv, O-Ring Groove (Gland) Design Guide (D139 O2): guidance', estimate: true },
    face: { squeezePercent: [20, 30], fillPercent: [75, 85], stretchMaxPercent: 5, source: 'Fictiv, O-Ring Groove (Gland) Design Guide (D139 O2): guidance', estimate: true },
};
/** Why an O-ring row is not one, or null. */
export function oringRowProblem(r) {
    if (typeof r !== 'object' || r === null || Array.isArray(r))
        return 'an O-ring row is an object { id, dash?, insideDiameter, crossSection, source | estimate }';
    const o = r, at = typeof o.id === 'string' && o.id.trim() ? `O-ring row ${o.id}` : '';
    if (!at)
        return 'an O-ring row needs an id';
    for (const k of Object.keys(o))
        if (!['id', 'dash', 'insideDiameter', 'crossSection', 'source', 'estimate'].includes(k))
            return `${at}: unknown field ${k}`;
    for (const k of ['insideDiameter', 'crossSection'])
        if (!(num(o[k]) && o[k] > 0))
            return `${at}: ${k} must be a number of mm above 0`;
    if ((o.source !== undefined) === (o.estimate === true))
        return `${at}: cite its source or say estimate: true — ${o.source !== undefined ? 'not both' : 'never neither'}`;
    return null;
}
function rangesProblem(r) {
    const ok2 = (v) => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) && v[0] <= v[1];
    if (!ok2(r.squeezePercent) || !ok2(r.fillPercent) || !num(r.stretchMaxPercent))
        return 'ranges are { squeezePercent: [lo, hi], fillPercent: [lo, hi], stretchMaxPercent, source | estimate }';
    if (r.source === undefined && !r.estimate)
        return 'ranges cite their source or say estimate: true';
    return null;
}
/** The section r' of a ring of section r and mean radius R once its mean radius is Rb + r' (volume kept). */
function stretched(r, R, Rb) { let s = r; for (let i = 0; i < 80; i++) {
    const n = Math.sqrt(r * r * R / (Rb + s));
    if (Math.abs(n - s) < 1e-15)
        return n;
    s = n;
} return s; }
/** A gland's arithmetic: its depth, stretch, stretched section, squeeze, fill; checked against the ranges. */
export function glandCheck(spec) {
    const p = oringRowProblem(spec.ring);
    if (p)
        fail('INVALID_INPUT', p);
    const k = spec.kind;
    if (k !== 'piston' && k !== 'rod' && k !== 'face')
        fail('INVALID_INPUT', `a gland is piston, rod or face (got ${String(k)})`);
    const Dg = spec.grooveDiameter, w = spec.width;
    if (!(num(Dg) && Dg > 0 && num(w) && w > 0))
        fail('GLAND_DIMENSIONS', 'the groove\'s diameter and width must be numbers of mm above 0');
    const ranges = spec.ranges ?? (k === 'face' ? O2_RANGES.face : O2_RANGES.radial), rp = rangesProblem(ranges);
    if (rp)
        fail('INVALID_INPUT', rp);
    const ID = spec.ring.insideDiameter, CS = spec.ring.crossSection, r = CS / 2, R = ID / 2 + r;
    let h, base, seal;
    if (k === 'face') {
        h = spec.depth ?? fail('GLAND_DIMENSIONS', 'a face gland needs its depth');
        base = Dg / 2;
    }
    else {
        seal = spec.sealDiameter ?? fail('GLAND_DIMENSIONS', `a ${k} gland needs the ${k === 'piston' ? 'bore' : 'rod'}'s Ø it seals on`);
        h = k === 'piston' ? (seal - Dg) / 2 : (Dg - seal) / 2;
        base = k === 'piston' ? Dg / 2 : seal / 2;
    }
    if (!(h > 0))
        fail('GLAND_DIMENSIONS', `the gland has no depth (${mm(h)} mm): ${k === 'piston' ? 'the groove\'s bottom must be below the bore' : k === 'rod' ? 'the groove\'s bottom must be beyond the rod' : 'give a depth above 0'}`);
    const stretch = (2 * base - ID) / ID, rs = stretched(r, R, base), CSs = 2 * rs;
    const sq0 = (CS - h) / CS, sq = (CSs - h) / CSs, fill0 = Math.PI * CS * CS / 4 / (w * h), fill = Math.PI * CSs * CSs / 4 / (w * h);
    if (!(sq > 0))
        fail('GLAND_DIMENSIONS', `the ring (its section ${mm(CSs)} mm stretched) is not squeezed in a gland ${mm(h)} deep: no seal`);
    if (!(fill < 1))
        fail('GLAND_DIMENSIONS', `the ring fills ${pct(fill)} % of the groove (${mm(w)} × ${mm(h)}): it cannot fit`);
    // The fit's extremes: the depth between the seal's and the groove's limit sizes.
    let range;
    if (spec.fit && k !== 'face' && (spec.fit.seal || spec.fit.groove)) {
        const lim = (cls, size) => { if (!cls)
            return { min: size, max: size }; try {
            const l = lookupFit(spec.fit.tables, cls, size);
            return { min: l.min, max: l.max };
        }
        catch (cause) {
            if (cause instanceof FitError)
                fail('GLAND_DIMENSIONS', cause.message);
            throw cause;
        } };
        const s = lim(spec.fit.seal, seal), g = lim(spec.fit.groove, Dg);
        const hMin = k === 'piston' ? (s.min - g.max) / 2 : (g.min - s.max) / 2, hMax = k === 'piston' ? (s.max - g.min) / 2 : (g.max - s.min) / 2;
        range = [(CSs - hMax) / CSs, (CSs - hMin) / CSs];
        if (!(range[0] > 0))
            fail('GLAND_DIMENSIONS', `at the fit's extremes the gland is ${mm(hMax)} deep: the ring is not squeezed (${pct(range[0])} %)`);
    }
    const warnings = [], tag = ranges.estimate ? ' (an estimate)' : '';
    const sqLo = range ? range[0] : sq, sqHi = range ? range[1] : sq;
    if (100 * sqLo < ranges.squeezePercent[0] || 100 * sqHi > ranges.squeezePercent[1])
        warnings.push({ code: 'SQUEEZE_RANGE', message: `squeeze ${range ? `${pct(sqLo)}–${pct(sqHi)}` : pct(sq)} % outside ${ranges.squeezePercent[0]}–${ranges.squeezePercent[1]} %${tag}` });
    if (100 * fill < ranges.fillPercent[0] || 100 * fill > ranges.fillPercent[1])
        warnings.push({ code: 'FILL_RANGE', message: `fill ${pct(fill)} % outside ${ranges.fillPercent[0]}–${ranges.fillPercent[1]} %${tag}` });
    if (100 * stretch > ranges.stretchMaxPercent || stretch < 0)
        warnings.push({ code: 'STRETCH_RANGE', message: stretch < 0 ? `the ring's ID ${mm(ID)} is larger than the Ø${mm(2 * base)} it lies on: loose (${pct(stretch)} %)` : `stretch ${pct(stretch)} % above ${ranges.stretchMaxPercent} %${tag}` });
    return { kind: k, ring: spec.ring.id, ringEstimate: spec.ring.estimate === true, ...(spec.ring.source ? { ringSource: spec.ring.source } : {}), insideDiameter: ID, crossSection: CS,
        grooveDiameter: Dg, width: w, depth: h, ...(seal !== undefined ? { sealDiameter: seal } : {}), stretchPercent: 100 * stretch, stretchedCrossSection: CSs,
        squeezePercent: 100 * sq0, squeezeStretchedPercent: 100 * sq, fillPercent: 100 * fill0, fillStretchedPercent: 100 * fill, ...(range ? { squeezeRangePercent: [100 * range[0], 100 * range[1]] } : {}), ranges, warnings };
}
/** A part document's solid: one sketch extruded along its plane's normal. */
function prism(id, sketch, height) {
    const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: `${id}s`, kind: 'sketch', ...sketch }, { id, kind: 'extrude', sketch: `${id}s`, height }] };
    return outputOf(evaluateCadPart(doc), id).brep;
}
const ring = (r) => [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }, { kind: 'arc', start: [-r, 0], center: [0, 0], direction: 'ccw' }];
const frameOf = (origin, a) => {
    const x = Math.abs(a[2]) < 0.9 ? [a[1], -a[0], 0] : [0, a[2], -a[1]], n = Math.hypot(...x), u = [x[0] / n, x[1] / n, x[2] / n];
    const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
    return { matrix: [u[0], v[0], a[0], u[1], v[1], a[1], u[2], v[2], a[2]], offset: origin };
};
const vol = (b) => brepMassProperties(b, 1, { quadratureSegments: 12 }).volume;
/** The gland's groove cut into `target` at its face, with the gland's check. */
export function glandCut(target, spec, id) {
    const report = glandCheck(spec);
    const face = target.faces.find(f => f.name === spec.face) ?? target.faces.find(f => f.name?.replace(/#\d+$/, '') === spec.face) ?? target.faces.find(f => f.id === spec.face) ?? fail('INVALID_INPUT', `no face ${spec.face}`);
    const g = faceGeometry(face), w = spec.width, h = report.depth, Dg = spec.grooveDiameter;
    let tool, place;
    if (spec.kind === 'face') {
        if (g.kind !== 'plane')
            fail('GLAND_DIMENSIONS', `${spec.face} is not flat: a face gland is cut into a flat face`);
        const pl = g, n = [...pl.n], c = spec.center ?? fail('INVALID_INPUT', 'a face gland needs its centre');
        const off = (c[0] - pl.o[0]) * n[0] + (c[1] - pl.o[1]) * n[1] + (c[2] - pl.o[2]) * n[2];
        if (Math.abs(off) > 1e-6)
            fail('GLAND_DIMENSIONS', `the gland's centre is ${mm(off)} mm off the face's plane`);
        const inward = [-n[0], -n[1], -n[2]], origin = [c[0] + n[0] * 1, c[1] + n[1] * 1, c[2] + n[2] * 1];
        tool = transformBrep(prism(`${id}__g`, { profile: 'circle', center: [0, 0], radius: Dg / 2 + w, holes: [ring(Dg / 2)], plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, h + 1), frameOf(origin, inward));
        place = { origin: c, axis: n, from: -h, to: 0, ringCenterRadius: Dg / 2 + report.stretchedCrossSection / 2, ringCenterAlong: -h + report.stretchedCrossSection / 2 };
    }
    else {
        if (g.kind !== 'cylinder')
            fail('GLAND_DIMENSIONS', `${spec.face} is not a cylinder: a ${spec.kind} gland is cut into one`);
        const cy = g;
        if (spec.kind === 'piston' && cy.out !== 1)
            fail('GLAND_DIMENSIONS', `${spec.face} is a bore: a piston gland's groove is cut into a shaft's outside (a rod gland into a bore)`);
        if (spec.kind === 'rod' && cy.out !== -1)
            fail('GLAND_DIMENSIONS', `${spec.face} is a shaft's outside: a rod gland's groove is cut into a bore (a piston gland into a shaft)`);
        if (spec.kind === 'piston' && !(Dg < 2 * cy.r - 1e-9))
            fail('GLAND_DIMENSIONS', `the groove's bottom Ø${mm(Dg)} is not below the face's Ø${mm(2 * cy.r)}`);
        if (spec.kind === 'rod' && !(Dg > 2 * cy.r + 1e-9))
            fail('GLAND_DIMENSIONS', `the groove's bottom Ø${mm(Dg)} is not beyond the bore's Ø${mm(2 * cy.r)}`);
        // The face's extent along its axis; the groove from `at` within it.
        const a = [...cy.a], loops = new Set(face.loops), edges = new Map(target.edges.map(e => [e.id, e])), verts = new Map(target.vertices.map(v => [v.id, v.point]));
        let lo = Infinity, hi = -Infinity;
        for (const ce of target.coedges)
            if (loops.has(ce.loop))
                for (const v of edges.get(ce.edge).vertices) {
                    const q = verts.get(v), s = (q[0] - cy.c[0]) * a[0] + (q[1] - cy.c[1]) * a[1] + (q[2] - cy.c[2]) * a[2];
                    lo = Math.min(lo, s);
                    hi = Math.max(hi, s);
                }
        const at = spec.at ?? fail('INVALID_INPUT', 'a radial gland needs its position (at, along the face from its start)');
        if (at < -1e-9 || at + w > hi - lo + 1e-9)
            fail('GLAND_DIMENSIONS', `the groove (${mm(at)} to ${mm(at + w)}) runs off the face (0 to ${mm(hi - lo)})`);
        const origin = [cy.c[0] + a[0] * (lo + at), cy.c[1] + a[1] * (lo + at), cy.c[2] + a[2] * (lo + at)];
        const outer = spec.kind === 'piston' ? cy.r + 1 : Dg / 2, inner = spec.kind === 'piston' ? Dg / 2 : Math.max(cy.r - Math.min(1, cy.r / 2), cy.r / 2);
        tool = transformBrep(prism(`${id}__g`, { profile: 'circle', center: [0, 0], radius: outer, holes: [ring(inner)], plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, w), frameOf(origin, a));
        const rs = report.stretchedCrossSection / 2;
        // (The free ring rests where it is stretched, centred along the groove: a piston's on the groove's bottom, the bore
        // displacing its outer side; a rod's on the rod (its stretch is on the rod, D163's fix), the groove's bottom
        // displacing its outer side. Either way its volume is the free ring's, 2π²(ID/2 + r)r².)
        place = { origin, axis: a, from: 0, to: w, ringCenterRadius: spec.kind === 'piston' ? Dg / 2 + rs : report.sealDiameter / 2 + rs, ringCenterAlong: w / 2 };
    }
    const named = transformBrep(tool, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, () => `${id}.groove`);
    const brep = booleanAnalytic(target, named, 'difference');
    if (brep.bodies.length > target.bodies.length)
        fail('GLAND_DIMENSIONS', 'the groove cuts through the part\'s wall: it splits it');
    return { brep, report, place };
}
/** The O-ring in its gland as an exact torus (stretched section, at rest where it is stretched: a piston's groove bottom, a rod), and the free ring's overlap with what squeezes it (the bore, the rod gland's groove bottom, the face's flange) by the analytic Boolean. */
export function oringInGland(report, place, id) {
    const rs = report.stretchedCrossSection / 2, Rc = place.ringCenterRadius, sub = `${id}__t`;
    const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
            { id: `${sub}s`, kind: 'sketch', profile: 'circle', center: [Rc, place.ringCenterAlong], radius: rs, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
            { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angle: 360 }
        ] };
    const local = transformBrep(outputOf(evaluateCadPart(doc), sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split(`${sub}.`).join(`${id}.`));
    // What squeezes it, in the gland's frame: beyond the bore (piston), beyond the groove's bottom (rod), above the face (face).
    let keep, overlap = 0;
    if (report.kind === 'piston')
        keep = prism(`${id}__b`, { profile: 'circle', center: [0, 0], radius: report.sealDiameter / 2, plane: { origin: [0, 0, place.ringCenterAlong - 2 * rs - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, 4 * rs + 2);
    else if (report.kind === 'rod')
        keep = prism(`${id}__b`, { profile: 'circle', center: [0, 0], radius: report.grooveDiameter / 2, plane: { origin: [0, 0, place.ringCenterAlong - 2 * rs - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, 4 * rs + 2);
    else
        keep = prism(`${id}__b`, { profile: 'circle', center: [0, 0], radius: Rc + 2 * rs + 1, plane: { origin: [0, 0, place.ringCenterAlong - 2 * rs - 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, 2 * rs + 1 - place.ringCenterAlong);
    // (What is displaced: the ring less its side of the squeezing surface, measured directly.)
    try {
        const out = booleanAnalytic(local, keep, 'difference');
        overlap = out.bodies.length ? vol(out) : 0;
    }
    catch (cause) {
        if (!(cause instanceof Error && /empty|no solid|nothing/i.test(cause.message)))
            throw cause;
        overlap = 0;
    }
    return { brep: transformBrep(local, frameOf(place.origin, place.axis)), overlap: overlap };
}
