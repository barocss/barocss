import { booleanAnalytic } from '../brep/analytic-boolean.js';
import { transformBrep } from '../brep/brep-transform.js';
import { evaluateCadPart, outputOf } from '../part/part-model.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
/** This module's refusal (R7.3a batch 2: the ShaftError class folded, D279): a BarocssError, `details.source` 'shaft'. */
export const shaftError = (code, detail) => kernelRefusal('shaft', code, `shaft: ${detail}`);
/** Whether something thrown is this module's refusal. */
export const isShaftError = (e) => isFrom(e, 'shaft');
const fail = (code, detail) => { throw shaftError(code, detail); };
const pos = (v, what, code) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fail(code, `${what} must be a number of mm above 0`));
const nonneg = (v, what, code) => (v === undefined ? 0 : typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail(code, `${what} must be a number of mm, 0 or more`));
const ang = (v, what, dflt) => (v === undefined ? dflt : typeof v === 'number' && Number.isFinite(v) ? v : fail('INVALID_INPUT', `${what} must be a number of degrees`));
/** A face name as a side tag (letters, digits, _ and -): `.` as `-`; and back. */
const tagOf = (name) => name.replace(/\./g, '-');
const nameOf = (t) => t.replace(/-/g, '.');
const EPS = 1e-9;
/** The checked spec's half-section: its outline pieces and their face names. */
function section(spec) {
    if (!Array.isArray(spec.steps) || !spec.steps.length)
        fail('SHAFT_STEPS', 'a shaft needs at least one step');
    const steps = spec.steps, n = steps.length, z = [0], R = [];
    steps.forEach((s, k) => { R.push(pos(s.diameter, `step ${k + 1}'s diameter`, 'SHAFT_STEPS') / 2); z.push(z[k] + pos(s.length, `step ${k + 1}'s length`, 'SHAFT_STEPS')); });
    for (let k = 0; k + 1 < n; k++)
        if (Math.abs(R[k] - R[k + 1]) < EPS)
            fail('SHAFT_STEPS', `steps ${k + 1} and ${k + 2} have one diameter: make them one step`);
    const ch = spec.chamfers ?? [0, 0];
    if (!Array.isArray(ch) || ch.length !== 2)
        fail('SHAFT_STEPS', 'chamfers must be [start, end]');
    const c0 = nonneg(ch[0], 'the start chamfer', 'SHAFT_STEPS'), c1 = nonneg(ch[1], 'the end chamfer', 'SHAFT_STEPS');
    // Each shoulder's treatment, on its smaller step.
    const fil = [], und = [];
    for (let k = 0; k < n; k++) {
        const s = steps[k], f = nonneg(s.fillet, `step ${k + 1}'s fillet`, 'SHAFT_STEPS');
        if (k === n - 1 && (f || s.undercut))
            fail('SHAFT_STEPS', `the last step has no shoulder after it for a fillet or an undercut`);
        if (f && s.undercut)
            fail('SHAFT_STEPS', `shoulder ${k + 1} takes a fillet or an undercut, not both`);
        if (k < n - 1) {
            const h = Math.abs(R[k] - R[k + 1]), small = R[k] < R[k + 1] ? k : k + 1;
            if (f >= h)
                fail('SHAFT_STEPS', `shoulder ${k + 1}'s fillet ${f} mm reaches past its height ${+h.toFixed(6)} mm`);
            if (f >= steps[small].length)
                fail('SHAFT_STEPS', `shoulder ${k + 1}'s fillet ${f} mm is longer than step ${small + 1}`);
            if (s.undercut) {
                const w = pos(s.undercut.width, `shoulder ${k + 1}'s undercut width`, 'SHAFT_STEPS'), d = pos(s.undercut.depth, `shoulder ${k + 1}'s undercut depth`, 'SHAFT_STEPS');
                if (d >= R[small])
                    fail('SHAFT_STEPS', `shoulder ${k + 1}'s undercut ${d} mm deep reaches the axis of step ${small + 1}`);
                if (w >= steps[small].length)
                    fail('SHAFT_STEPS', `shoulder ${k + 1}'s undercut ${w} mm wide is longer than step ${small + 1}`);
            }
        }
        fil.push(f);
        und.push(s.undercut);
    }
    if (c0 >= Math.min(R[0], steps[0].length) || c1 >= Math.min(R[n - 1], steps[n - 1].length))
        fail('SHAFT_STEPS', 'a chamfer must be smaller than its end step\'s radius and length');
    const segs = [], names = [], grooves = [];
    const line = (x, y, name) => { segs.push({ kind: 'line', start: [x, y] }); names.push(name); };
    line(0, 0, 'end0');
    if (c0 > 0)
        line(R[0] - c0, 0, 'chamfer0');
    let g = 0;
    for (let k = 0; k < n; k++) {
        const r = R[k], z0 = z[k], z1 = z[k + 1], label = k + 1, last = k === n - 1;
        const prevBigger = k > 0 && R[k - 1] > r, nextBigger = !last && R[k + 1] > r;
        const fStart = prevBigger ? fil[k - 1] : 0, uStart = prevBigger ? und[k - 1] : undefined, fEnd = nextBigger ? fil[k] : 0, uEnd = nextBigger ? und[k] : undefined;
        // The seat runs from after the chamfer or the fillet below to before the fillet or the chamfer above.
        const seatFrom = z0 + (k === 0 ? c0 : 0) + fStart, seatTo = z1 - (last ? c1 : 0) - fEnd;
        const dips = [];
        if (uStart)
            dips.push({ from: z0, to: z0 + uStart.width, r: r - uStart.depth, kind: 'undercut', n: k, w: uStart.width });
        for (const [gi, gr] of (steps[k].grooves ?? []).entries()) {
            const w = pos(gr.width, `step ${label}'s groove ${gi + 1}'s width`, 'GROOVE_DIMENSIONS'), at = nonneg(gr.at, `step ${label}'s groove ${gi + 1}'s position`, 'GROOVE_DIMENSIONS'), rb = pos(gr.diameter, `step ${label}'s groove ${gi + 1}'s diameter`, 'GROOVE_DIMENSIONS') / 2;
            if (!(rb < r - EPS))
                fail('GROOVE_DIMENSIONS', `step ${label}'s groove ${gi + 1}: its bottom Ø${2 * rb} must be below the step's Ø${2 * r}`);
            dips.push({ from: z0 + at, to: z0 + at + w, r: rb, kind: 'groove', n: gi, w });
        }
        if (uEnd)
            dips.push({ from: z1 - uEnd.width, to: z1, r: r - uEnd.depth, kind: 'undercut', n: k + 1, w: uEnd.width });
        dips.sort((a, b) => a.from - b.from);
        for (const [i, d] of dips.entries()) {
            if (d.kind === 'groove' && (d.from < seatFrom - EPS || d.to > seatTo + EPS))
                fail('GROOVE_DIMENSIONS', `step ${label}'s groove ${d.n + 1} (${+(d.from - z0).toFixed(6)} to ${+(d.to - z0).toFixed(6)} mm) runs off the step's seat (${+(seatFrom - z0).toFixed(6)} to ${+(seatTo - z0).toFixed(6)})`);
            if (i > 0 && d.from < dips[i - 1].to + EPS)
                fail('GROOVE_DIMENSIONS', `step ${label}'s grooves and undercuts meet or overlap: leave seat between them`);
        }
        // The start: a fillet from the shoulder above it round to the seat (its centre (r + ρ, z0 + ρ)).
        let cur = seatFrom;
        if (fStart > 0) {
            segs.push({ kind: 'arc', start: [r + fStart, z0], center: [r + fStart, z0 + fStart], direction: 'cw' });
            names.push(`fillet${k}`);
        }
        let piece = 1;
        const seat = (from) => { line(r, from, piece === 1 ? `seat${label}` : `seat${label}.${piece}`); piece++; };
        for (const d of dips) {
            if (d.from > cur + EPS)
                seat(cur);
            const atShoulder = d.kind === 'undercut' && Math.abs(d.from - z0) < EPS;
            if (!atShoulder)
                line(r, d.from, d.kind === 'groove' ? `groovewall${g + 1}.1` : `undercutwall${d.n}`);
            if (d.kind === 'groove') {
                g++;
                grooves.push({ index: g, step: label, diameter: 2 * d.r, width: d.w, from: d.from });
            }
            line(d.r, d.from, d.kind === 'groove' ? `groove${g}` : `undercut${d.n}`);
            const atNext = d.kind === 'undercut' && Math.abs(d.to - z1) < EPS;
            if (!atNext)
                line(d.r, d.to, d.kind === 'groove' ? `groovewall${g}.2` : `undercutwall${d.n}`);
            cur = d.to;
        }
        if (seatTo > cur + EPS)
            seat(cur);
        // The step's end: the last end's chamfer and face; else the shoulder (a fillet into it when the next step is bigger).
        if (last) {
            if (c1 > 0)
                line(r, z1 - c1, 'chamfer1');
            line(r - c1, z1, 'end1');
            line(0, z1, 'axis');
        }
        else if (nextBigger) {
            if (fEnd > 0) {
                segs.push({ kind: 'arc', start: [r, z1 - fEnd], center: [r + fEnd, z1 - fEnd], direction: 'cw' });
                names.push(`fillet${label}`);
                line(r + fEnd, z1, `shoulder${label}`);
            }
            else
                line(uEnd ? r - uEnd.depth : r, z1, `shoulder${label}`);
        }
        else
            line(r, z1, `shoulder${label}`);
    }
    return { segs, names, z, grooves };
}
/** A tool's part document: one sketch (`profile`) extruded `height` along its plane's normal. */
function tool(id, sketch, height) {
    const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: `${id}s`, kind: 'sketch', ...sketch }, { id, kind: 'extrude', sketch: `${id}s`, height }] };
    return outputOf(evaluateCadPart(doc), id).brep;
}
const turnZ = (b, deg) => { if (!deg)
    return b; const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return transformBrep(b, { matrix: [c, -s, 0, s, c, 0, 0, 0, 1] }); };
const renamed = (b, name) => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, () => name);
/** A shaft (shaft@0) in its own frame: axis +Z from z 0. */
export function shaftSolid(spec, options = {}) {
    const id = (options.id ?? 'shaft').replace(/[^A-Za-z0-9_.-]/g, '_');
    if (!spec || typeof spec !== 'object')
        fail('INVALID_INPUT', 'a shaft is { steps, chamfers?, holes? }');
    const { segs, names, z, grooves } = section(spec), L = z[z.length - 1], sub = `${id}__r`;
    const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
            { id: `${sub}s`, kind: 'sketch', profile: 'loop', segments: segs, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, sideTags: { outer: names.map(tagOf) } },
            { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angle: 360 }
        ] };
    const prefix = `${sub}.side[`;
    let brep = transformBrep(outputOf(evaluateCadPart(doc), sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, nm => nm.split('|').map(p => p.startsWith(prefix) ? `${id}.${nameOf(p.slice(prefix.length, p.indexOf(']')))}${p.slice(p.indexOf(']') + 1)}` : p).join('|'));
    // Keyseats, in order over the steps.
    const keyseats = [];
    spec.steps.forEach((s, k) => (s.keyseats ?? []).forEach((ks, j) => {
        const label = `step ${k + 1}'s keyseat ${j + 1}`, R = s.diameter / 2, z0 = z[k];
        const b = pos(ks.width, `${label}'s width`, 'KEYSEAT_DIMENSIONS'), t1 = pos(ks.depth, `${label}'s depth`, 'KEYSEAT_DIMENSIONS'), l = pos(ks.length, `${label}'s length`, 'KEYSEAT_DIMENSIONS'), off = nonneg(ks.offset, `${label}'s offset`, 'KEYSEAT_DIMENSIONS');
        const ends = ks.ends ?? 'end-mill', a = ang(ks.angle, `${label}'s angle`, 0);
        if (ends !== 'square' && ends !== 'end-mill' && ends !== 'disc')
            fail('KEYSEAT_DIMENSIONS', `${label}: ends must be square, end-mill or disc`);
        if (!(t1 < R))
            fail('KEYSEAT_DIMENSIONS', `${label}: its depth ${t1} mm reaches the axis of a Ø${2 * R} step`);
        const half = Math.sqrt(R * R - (R - t1) ** 2);
        if (!(b < 2 * half))
            fail('KEYSEAT_DIMENSIONS', `${label}: ${b} mm wide is no narrower than the step's chord ${+(2 * half).toFixed(6)} mm at its floor (its sides would not stand)`);
        if (ends === 'end-mill' && !(l > b))
            fail('KEYSEAT_DIMENSIONS', `${label}: an end-milled seat's length ${l} mm must exceed its width ${b} mm`);
        const Rc = ends === 'disc' ? pos(ks.cutterRadius, `${label}'s cutter radius`, 'KEYSEAT_DIMENSIONS') : 0;
        if (ends === 'disc' && !(Rc > t1))
            fail('KEYSEAT_DIMENSIONS', `${label}: a disc cutter of radius ${Rc} mm must be larger than the depth ${t1} mm`);
        const runout = ends === 'disc' ? Math.sqrt(Rc * Rc - (Rc - t1) ** 2) : 0, from = z0 + off;
        if (from - runout < z0 - EPS || from + l + runout > z[k + 1] + EPS)
            fail('KEYSEAT_DIMENSIONS', `${label}: ${ends === 'disc' ? `with its run-out (${+runout.toFixed(6)} mm each end) ` : ''}it runs off the step (${+off.toFixed(6)} to ${+(off + l).toFixed(6)} of ${s.length} mm): a seat crossing a step is refused`);
        const n = keyseats.length + 1, tid = `${id}__k${n}`, top = R + 1;
        let t;
        if (ends === 'square')
            t = tool(tid, { profile: 'rectangle', min: [-b / 2, from], max: [b / 2, from + l], plane: { origin: [R - t1, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, top - (R - t1));
        else if (ends === 'end-mill') {
            const lo = from + b / 2, hi = from + l - b / 2, h = b / 2;
            t = tool(tid, { profile: 'loop', segments: [{ kind: 'line', start: [h, lo] }, { kind: 'arc', start: [h, hi], center: [0, hi], direction: 'ccw' }, { kind: 'line', start: [-h, hi] }, { kind: 'arc', start: [-h, lo], center: [0, lo], direction: 'ccw' }], plane: { origin: [R - t1, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, top - (R - t1));
        }
        else {
            // (In the plane y = −b/2: its x the shaft's z, its y the radius; the cutter's circle at each end of the floor.)
            const rc = R - t1 + Rc;
            t = tool(tid, { profile: 'loop', segments: [{ kind: 'arc', start: [from - Rc, rc], center: [from, rc], direction: 'ccw' }, { kind: 'line', start: [from, R - t1] }, { kind: 'arc', start: [from + l, R - t1], center: [from + l, rc], direction: 'ccw' }, { kind: 'line', start: [from + l + Rc, rc] }], plane: { origin: [0, -b / 2, 0], normal: [0, 1, 0], xAxis: [0, 0, 1] } }, b);
        }
        brep = booleanAnalytic(brep, renamed(turnZ(t, a), `${id}.keyseat${n}`), 'difference');
        keyseats.push({ index: n, step: k + 1, ends, width: b, depth: t1, length: l, from: from, floorRadius: R - t1, surfaceLength: l + 2 * runout, angle: a, ...(ends === 'disc' ? { cutterRadius: Rc } : {}) });
    }));
    // Cross holes.
    const holes = [];
    (spec.holes ?? []).forEach((h, j) => {
        const label = `hole ${j + 1}`, dh = pos(h.diameter, `${label}'s diameter`, 'HOLE_DIMENSIONS'), at = typeof h.at === 'number' && Number.isFinite(h.at) ? h.at : fail('HOLE_DIMENSIONS', `${label}'s position must be a number of mm`), a = ang(h.angle, `${label}'s angle`, 90);
        const k = z.findIndex((zz, i) => i > 0 && at <= zz) - 1;
        if (!(at - dh / 2 >= -EPS && at + dh / 2 <= L + EPS) || k < 0)
            fail('HOLE_DIMENSIONS', `${label} (Ø${dh} at ${at} mm) runs off the shaft (0 to ${L} mm)`);
        const R = spec.steps[k].diameter / 2;
        if (at - dh / 2 < z[k] - EPS || at + dh / 2 > z[k + 1] + EPS)
            fail('HOLE_DIMENSIONS', `${label} (Ø${dh} at ${at} mm) crosses a shoulder (step ${k + 1} runs ${z[k]} to ${z[k + 1]} mm)`);
        if (!(dh < 2 * R))
            fail('HOLE_DIMENSIONS', `${label}: Ø${dh} is no smaller than step ${k + 1}'s Ø${2 * R}`);
        const far = Math.max(...spec.steps.map(s => s.diameter)) / 2 + 1, t = tool(`${id}__h${j + 1}`, { profile: 'circle', center: [0, 0], radius: dh / 2, plane: { origin: [-far, 0, at], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, 2 * far);
        brep = booleanAnalytic(brep, renamed(turnZ(t, a), `${id}.hole${j + 1}`), 'difference');
        holes.push({ index: j + 1, diameter: dh, at, angle: a });
    });
    const steps = spec.steps.map((s, k) => ({ index: k + 1, diameter: s.diameter, from: z[k], to: z[k + 1] }));
    const shoulders = spec.steps.slice(0, -1).map((s, k) => ({ index: k + 1, at: z[k + 1], before: s.diameter, after: spec.steps[k + 1].diameter, fillet: s.fillet ?? 0, ...(s.undercut ? { undercut: { width: s.undercut.width, depth: s.undercut.depth } } : {}) }));
    return { brep, report: { generator: 'shaft@0', length: L, steps, keyseats, grooves, holes, shoulders, manufacturingValidated: false } };
}
