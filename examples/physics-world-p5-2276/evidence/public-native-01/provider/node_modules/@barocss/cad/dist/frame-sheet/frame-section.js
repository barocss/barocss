import { isFrom, kernelRefusal } from '../core/barocss-error.js';
/** A section's dimensions refused: the part model's PARAMETER code, the message starting `[SECTION_DIMENSIONS]`. */
export const frameSectionError = (detail) => kernelRefusal('frame-section', 'SECTION_DIMENSIONS', `[SECTION_DIMENSIONS] ${detail}`.slice(0, 1024));
/** Whether something thrown is this module's refusal. */
export const isFrameSectionError = (e) => isFrom(e, 'frame-section');
/** The spandrel of a quarter disk of radius r (the square r × r less the disk): its area and its centroid's distance from the square's corner, along each side. */
const SPANDREL = 1 - Math.PI / 4;
const spandrelArea = (r) => SPANDREL * r * r;
const spandrelReach = (r) => r * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
const fmt = (x) => String(+x.toFixed(4));
const refuse = (detail) => { throw frameSectionError(detail); };
function line(b, start, name) { b.segments.push({ kind: 'line', start }); b.names.push(name); }
function arc(b, start, center, direction, name) { b.segments.push({ kind: 'arc', start, center, direction }); b.names.push(name); }
/** A rectangle 2hx × 2hy about the origin, corners rounded r (0: sharp), anticlockwise from its bottom side; names under `prefix`. */
function roundedRect(hx, hy, r, prefix) {
    const b = { segments: [], names: [] };
    if (r === 0) {
        line(b, [-hx, -hy], `${prefix}bottom`);
        line(b, [hx, -hy], `${prefix}right`);
        line(b, [hx, hy], `${prefix}top`);
        line(b, [-hx, hy], `${prefix}left`);
        return b;
    }
    line(b, [-hx + r, -hy], `${prefix}bottom`);
    arc(b, [hx - r, -hy], [hx - r, -hy + r], 'ccw', `${prefix}round.br`);
    line(b, [hx, -hy + r], `${prefix}right`);
    arc(b, [hx, hy - r], [hx - r, hy - r], 'ccw', `${prefix}round.tr`);
    line(b, [hx - r, hy], `${prefix}top`);
    arc(b, [-hx + r, hy], [-hx + r, hy - r], 'ccw', `${prefix}round.tl`);
    line(b, [-hx, hy - r], `${prefix}left`);
    arc(b, [-hx, -hy + r], [-hx + r, -hy + r], 'ccw', `${prefix}round.bl`);
    return b;
}
function positive(x, what) { if (!(x > 0))
    refuse(`${what} must be positive (${x})`); }
function nonNegative(x, what) { if (!(x >= 0))
    refuse(`${what} must be 0 or more (${x})`); }
/**
 * A rectangular tube `width` (x) × `height` (y), wall t, outer corners `outerRadius` ro (0: sharp) and the bore's
 * `innerRadius` ri — by default concentric, ro − t (ro 0: 0). A ro in (0, t) has no concentric bore: its ri is given.
 * A = bh − (4 − π)ro² − [(b − 2t)(h − 2t) − (4 − π)ri²]; centred on the origin. Faces `bottom`, `right`, `top`, `left`,
 * `round.br` …, and the bore's `bore.bottom` ….
 */
function rectTube(s) {
    const { width: b, height: h, wall: t, outerRadius: ro } = s;
    positive(b, 'width');
    positive(h, 'height');
    positive(t, 'wall');
    nonNegative(ro, 'outerRadius');
    if (!(2 * t < Math.min(b, h)))
        refuse(`a wall ${fmt(t)} leaves no bore in ${fmt(b)} × ${fmt(h)}`);
    if (!(ro < Math.min(b, h) / 2))
        refuse(`an outer radius ${fmt(ro)} leaves no flat side on ${fmt(b)} × ${fmt(h)}`);
    if (s.innerRadius === undefined && ro > 0 && ro < t)
        refuse(`an outer radius ${fmt(ro)} under the wall ${fmt(t)} has no concentric bore radius: give innerRadius`);
    const ri = s.innerRadius ?? Math.max(0, ro - t);
    nonNegative(ri, 'innerRadius');
    if (!(ri < Math.min(b, h) / 2 - t))
        refuse(`an inner radius ${fmt(ri)} leaves no flat side in the bore`);
    if (ri > ro)
        refuse(`an inner radius ${fmt(ri)} past the outer ${fmt(ro)} thins the wall at the corners`);
    const out = roundedRect(b / 2, h / 2, ro, ''), bore = roundedRect(b / 2 - t, h / 2 - t, ri, 'bore.'), k = 4 - Math.PI;
    return { outer: out.segments, outerNames: out.names, holes: [bore.segments], holeNames: [bore.names],
        area: b * h - k * ro * ro - ((b - 2 * t) * (h - 2 * t) - k * ri * ri), centroid: [0, 0], box: { min: [-b / 2, -h / 2], max: [b / 2, h / 2] },
        label: `rect-tube ${fmt(b)} × ${fmt(h)} × ${fmt(t)}${ro ? `, ro ${fmt(ro)}, ri ${fmt(ri)}${s.innerRadius === undefined ? ' (concentric)' : ''}` : s.innerRadius !== undefined ? `, ri ${fmt(ri)}` : ''}`,
        ...(s.innerRadius === undefined ? { derived: { innerRadius: ro ? 'concentric: ro − t' : 'sharp: 0, as the outer corners' } } : {}) };
}
/** A round tube Ø`diameter`, wall t, centred on the origin: A = π(R² − r²). Faces `outside`, `bore`. */
function roundTube(s) {
    const R = s.diameter / 2, t = s.wall;
    positive(s.diameter, 'diameter');
    positive(t, 'wall');
    if (!(t < R))
        refuse(`a wall ${fmt(t)} leaves no bore in Ø${fmt(s.diameter)}`);
    const r = R - t;
    return { outer: [{ kind: 'arc', start: [R, 0], center: [0, 0], direction: 'ccw' }], outerNames: ['outside'], holes: [[{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }]], holeNames: [['bore']],
        area: Math.PI * (R * R - r * r), centroid: [0, 0], box: { min: [-R, -R], max: [R, R] }, label: `round-tube Ø${fmt(s.diameter)} × ${fmt(t)}` };
}
/**
 * An angle: legs `legX` a (along x) and `legY` b (along y), thickness t, root radius r1, toe radii r2; the heel at the
 * origin. A = t(a + b − t) + (1 − π/4)(r1² − 2r2²). Faces `back.x` (y 0), `end.x`, `toe.x`, `face.x` (y t), `root`,
 * `face.y` (x t), `toe.y`, `end.y`, `back.y` (x 0).
 */
function angle(s) {
    const { legX: a, legY: b, thickness: t, rootRadius: r1, toeRadius: r2 } = s;
    positive(a, 'legX');
    positive(b, 'legY');
    positive(t, 'thickness');
    nonNegative(r1, 'rootRadius');
    nonNegative(r2, 'toeRadius');
    if (!(r2 < t))
        refuse(`a toe radius ${fmt(r2)} must be under the thickness ${fmt(t)}`);
    if (!(a - r2 > t + r1) || !(b - r2 > t + r1))
        refuse(`legs ${fmt(a)} and ${fmt(b)} leave no flat face between the root (${fmt(t)} + ${fmt(r1)}) and the toe (${fmt(r2)})`);
    const L = { segments: [], names: [] };
    line(L, [0, 0], 'back.x');
    line(L, [a, 0], 'end.x');
    if (r2 > 0)
        arc(L, [a, t - r2], [a - r2, t - r2], 'ccw', 'toe.x');
    line(L, [a - r2, t], 'face.x');
    if (r1 > 0)
        arc(L, [t + r1, t], [t + r1, t + r1], 'cw', 'root');
    line(L, [t, t + r1], 'face.y');
    if (r2 > 0)
        arc(L, [t, b - r2], [t - r2, b - r2], 'ccw', 'toe.y');
    line(L, [t - r2, b], 'end.y');
    line(L, [0, b], 'back.y');
    // Moments: the two legs (x 0..a by 0..t, then 0..t by t..b), the root's spandrel added at (t, t), each toe's taken off.
    const s1 = spandrelArea(r1), s2 = spandrelArea(r2), c1 = spandrelReach(r1), c2 = spandrelReach(r2);
    const A = a * t + t * (b - t) + s1 - 2 * s2;
    const Mx = a * t * a / 2 + t * (b - t) * t / 2 + s1 * (t + c1) - s2 * (a - c2) - s2 * (t - c2);
    const My = a * t * t / 2 + t * (b - t) * (t + b) / 2 + s1 * (t + c1) - s2 * (t - c2) - s2 * (b - c2);
    return { outer: L.segments, outerNames: L.names, holes: [], holeNames: [], area: A, centroid: [Mx / A, My / A], box: { min: [0, 0], max: [a, b] },
        label: `angle ${fmt(a)} × ${fmt(b)} × ${fmt(t)}${r1 || r2 ? `, r1 ${fmt(r1)}, r2 ${fmt(r2)}` : ''}` };
}
/**
 * A channel with parallel flanges: `height` h along y, flanges `width` b along x, `web` tw, `flange` tf, root radius r;
 * its back on x 0 and its bottom on y 0. A = h·tw + 2(b − tw)tf + 2(1 − π/4)r². Faces `back`, `bottom`, `tip.bottom`,
 * `inside.bottom`, `root.bottom`, `web`, `root.top`, `inside.top`, `tip.top`, `top`.
 */
function channel(s) {
    if ((s.toeRadius ?? 0) !== 0 || (s.flangeSlope ?? 0) !== 0)
        return flanged(s);
    const { height: h, width: b, web: tw, flange: tf, rootRadius: r } = s;
    positive(h, 'height');
    positive(b, 'width');
    positive(tw, 'web');
    positive(tf, 'flange');
    nonNegative(r, 'rootRadius');
    if (!(b - tw > r))
        refuse(`flanges ${fmt(b)} wide leave no flat inside past the web ${fmt(tw)} and the root ${fmt(r)}`);
    if (!(h - 2 * tf - 2 * r > 0))
        refuse(`a height ${fmt(h)} leaves no flat web between the flanges ${fmt(tf)} and the roots ${fmt(r)}`);
    const L = { segments: [], names: [] };
    line(L, [0, 0], 'bottom');
    line(L, [b, 0], 'tip.bottom');
    line(L, [b, tf], 'inside.bottom');
    if (r > 0)
        arc(L, [tw + r, tf], [tw + r, tf + r], 'cw', 'root.bottom');
    line(L, [tw, tf + r], 'web');
    if (r > 0)
        arc(L, [tw, h - tf - r], [tw + r, h - tf - r], 'cw', 'root.top');
    line(L, [tw + r, h - tf], 'inside.top');
    line(L, [b, h - tf], 'tip.top');
    line(L, [b, h], 'top');
    line(L, [0, h], 'back');
    const S = spandrelArea(r), c = spandrelReach(r), A = h * tw + 2 * (b - tw) * tf + 2 * S;
    const Mx = h * tw * tw / 2 + 2 * (b - tw) * tf * (tw + b) / 2 + 2 * S * (tw + c);
    return { outer: L.segments, outerNames: L.names, holes: [], holeNames: [], area: A, centroid: [Mx / A, h / 2], box: { min: [0, 0], max: [b, h] },
        label: `channel ${fmt(h)} × ${fmt(b)} × ${fmt(tw)}/${fmt(tf)}${r ? `, r ${fmt(r)}` : ''}` };
}
/** FRk3 tangent line/arc outline. Dimensions describe the sharp intersections, not tangent points. */
function flanged(s) {
    const { height: h, width: b, web: w, flange: f, rootRadius: root } = s;
    const isI = s.kind === 'i-beam', toe = isI ? s.toeRadius : s.toeRadius ?? 0, slope = isI ? s.flangeSlope : s.flangeSlope ?? 0;
    for (const [name, value] of Object.entries({ height: h, width: b, web: w, flange: f })) {
        if (!Number.isFinite(value))
            refuse(`${name} must be finite`);
        positive(value, name);
    }
    for (const [name, value] of Object.entries({ rootRadius: root, toeRadius: toe, flangeSlope: slope })) {
        if (!Number.isFinite(value))
            refuse(`${name} must be finite`);
        nonNegative(value, name);
    }
    const a = (b - w) / (isI ? 2 : 1), tip = f - slope * a / 2, atWeb = f + slope * a / 2;
    if (!(a > 0 && tip > 0 && h > 2 * atWeb))
        refuse('web, flange and slope leave no positive tip or web opening');
    const H = h / 2, B = b / 2, W = w / 2;
    const poly = isI
        ? [[-B, -H], [B, -H], [B, -H + tip], [W, -H + atWeb], [W, H - atWeb], [B, H - tip], [B, H], [-B, H], [-B, H - tip], [-W, H - atWeb], [-W, -H + atWeb], [-B, -H + tip]]
        : [[0, 0], [b, 0], [b, tip], [w, atWeb], [w, h - atWeb], [b, h - tip], [b, h], [0, h]];
    const names = isI
        ? ['outer.bottom', 'tip.bottom.right', 'inside.bottom.right', 'web.right', 'inside.top.right', 'tip.top.right', 'outer.top', 'tip.top.left', 'inside.top.left', 'web.left', 'inside.bottom.left', 'tip.bottom.left']
        : ['bottom', 'tip.bottom', 'inside.bottom', 'web', 'inside.top', 'tip.top', 'top', 'back'];
    const corners = isI
        ? ['', '', 'toe.bottom.right', 'root.bottom.right', 'root.top.right', 'toe.top.right', '', '', 'toe.top.left', 'root.top.left', 'root.bottom.left', 'toe.bottom.left']
        : ['', '', 'toe.bottom', 'root.bottom', 'root.top', 'toe.top', '', ''];
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
    const addScaled = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
    const unit = (p) => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l]; };
    const cross = (p, q) => p[0] * q[1] - p[1] * q[0];
    const fillets = poly.map((v, i) => {
        const radius = corners[i].startsWith('root') ? root : corners[i].startsWith('toe') ? toe : 0;
        if (!radius)
            return { before: v, after: v, center: v, distance: 0, direction: 'ccw' };
        const previous = poly[(i + poly.length - 1) % poly.length], next = poly[(i + 1) % poly.length];
        const u = unit(sub(previous, v)), t = unit(sub(next, v));
        const alpha = Math.acos(u[0] * t[0] + u[1] * t[1]), distance = radius / Math.tan(alpha / 2);
        const center = addScaled(v, unit([u[0] + t[0], u[1] + t[1]]), radius / Math.sin(alpha / 2));
        return { before: addScaled(v, u, distance), after: addScaled(v, t, distance), center, distance,
            direction: cross(sub(v, previous), sub(next, v)) > 0 ? 'ccw' : 'cw' };
    });
    // Only a floating-point roundoff guard: reject an exhausted flat, including computed equality.
    // This does not widen any existing model/geometry tolerance or alter a radius.
    const roundoff = 32 * Number.EPSILON * Math.max(1, h, b, root, toe);
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length, length = Math.hypot(...sub(poly[j], poly[i]));
        if (!(length - fillets[i].distance - fillets[j].distance > roundoff))
            refuse(`tangencies consume ${names[i]}; a positive flat must remain`);
    }
    const loop = { segments: [], names: [] };
    for (let i = 0; i < poly.length; i++) {
        const f = fillets[i];
        if (f.distance)
            arc(loop, f.before, f.center, f.direction, corners[i]);
        line(loop, f.after, names[i]);
    }
    // Closed triangle + circular sector first moments. No tessellation or mass integration is used.
    let area = 0, mx = 0;
    const triangle = (p, q) => {
        const A = cross(p, q) / 2;
        area += A;
        mx += A * (p[0] + q[0]) / 3;
    };
    for (let i = 0; i < loop.segments.length; i++) {
        const seg = loop.segments[i], p = seg.start, q = loop.segments[(i + 1) % loop.segments.length].start;
        if (seg.kind === 'line') {
            triangle(p, q);
            continue;
        }
        if (seg.kind !== 'arc')
            refuse('a flanged section must contain only lines and circular arcs');
        const c = seg.center, u = sub(p, c), v = sub(q, c), r = Math.hypot(...u);
        const start = Math.atan2(u[1], u[0]), finish = Math.atan2(v[1], v[0]);
        let theta = finish - start;
        if (seg.direction === 'ccw' && theta <= 0)
            theta += 2 * Math.PI;
        if (seg.direction === 'cw' && theta >= 0)
            theta -= 2 * Math.PI;
        triangle(p, c);
        triangle(c, q);
        const A = r * r * theta / 2;
        area += A;
        mx += c[0] * A + r ** 3 * (Math.sin(start + theta) - Math.sin(start)) / 3;
    }
    return { outer: loop.segments, outerNames: loop.names, holes: [], holeNames: [], area: area,
        centroid: isI ? [0, 0] : [mx / area, h / 2], box: isI ? { min: [-B, -H], max: [B, H] } : { min: [0, 0], max: [b, h] },
        label: `${s.kind} ${fmt(h)} × ${fmt(b)} × ${fmt(w)}/${fmt(f)}, root ${fmt(root)}, toe ${fmt(toe)}, slope ${fmt(slope)} (flange at overhang midpoint)` };
}
function slotsOf(a, cells, open) {
    if (cells === 2)
        return [{ id: 't1', face: 'top', at: 0 }, { id: 't2', face: 'top', at: a }, { id: 'r', face: 'right', at: 0 }, { id: 'b2', face: 'bottom', at: a }, { id: 'b1', face: 'bottom', at: 0 }, { id: 'l', face: 'left', at: 0 }];
    return [{ id: 't1', face: 'top', at: 0 }, { id: 'r', face: 'right', at: 0 }, { id: 'b1', face: 'bottom', at: 0 }, { id: 'l', face: 'left', at: 0 }].slice(0, open);
}
/**
 * A 20-class T-slot extrusion's section (the tslot-20 library part's shape, D122): `size` a, `cells` 1 (a × a) or 2
 * (2a × a), a slot `opening` wo through a `lip` tl, an `undercut` wu under the lips tapering at 45° back to wo, the slot
 * `depth` ds from the face, and a core `bore` per cell; the first cell's centre at the origin. Every value is the
 * user's (the library's are estimates). Each slot is wo·ds + (wu/2 − wo/2)² of area: A = cells·a² − n·slot −
 * cells·π(bore/2)². Faces `top.0` … (the face pieces), `<slot>.lip0` … `<slot>.floor` (t1, t2, r, b2, b1, l), `core<k>`.
 */
function tslot(s) {
    const { size: a, cells, opening: wo, lip: tl, undercut: wu, depth: ds, bore } = s;
    positive(a, 'size');
    positive(wo, 'opening');
    positive(tl, 'lip');
    positive(wu, 'undercut');
    positive(ds, 'depth');
    positive(bore, 'bore');
    if (cells !== 1 && cells !== 2)
        refuse(`cells must be 1 or 2 (${cells})`);
    if (cells === 1 && !(Number.isInteger(s.openSlots) && s.openSlots >= 0 && s.openSlots <= 4))
        refuse(`openSlots must be 0 to 4 (${s.openSlots})`);
    const ho = wo / 2, hu = wu / 2, dt = tl + hu - ho;
    if (!(hu > ho))
        refuse(`the undercut ${fmt(wu)} must be wider than the opening ${fmt(wo)}`);
    if (!(dt < ds))
        refuse(`a slot ${fmt(ds)} deep has no straight part below its 45° undercut (to ${fmt(dt)})`);
    if (!(ds < a / 2 - bore / 2))
        refuse(`a slot ${fmt(ds)} deep reaches the core bore Ø${fmt(bore)} in a ${fmt(a)} section`);
    if (!(ho < a / 2 - ds) || !(hu < a / 2 - dt))
        refuse(`slots ${fmt(wo)} / ${fmt(wu)} wide and ${fmt(ds)} deep meet their neighbours in a ${fmt(a)} section`);
    const xr = a * cells - a / 2, slots = slotsOf(a, cells, s.openSlots);
    // Each face anticlockwise: its start, its direction along and inwards; the slots on it in that order.
    const faces = [
        { face: 'bottom', start: [-a / 2, -a / 2], along: [1, 0], inward: [0, 1], length: a * cells },
        { face: 'right', start: [xr, -a / 2], along: [0, 1], inward: [-1, 0], length: a },
        { face: 'top', start: [xr, a / 2], along: [-1, 0], inward: [0, -1], length: a * cells },
        { face: 'left', start: [-a / 2, a / 2], along: [0, -1], inward: [1, 0], length: a },
    ];
    const L = { segments: [], names: [] };
    const notch = [[-ho, 0, 'lip0'], [-ho, tl, 'under0'], [-hu, tl, 'taper0'], [-ho, dt, 'wall0'], [-ho, ds, 'floor'], [ho, ds, 'wall1'], [ho, dt, 'taper1'], [hu, tl, 'under1'], [ho, tl, 'lip1']];
    let slotArea = 0, Mx = 0, My = 0;
    const one = wo * ds + (hu - ho) * (hu - ho), depthBar = (wo * ds * ds / 2 + (hu - ho) * (hu - ho) * (2 * tl + dt) / 3) / one;
    for (const F of faces) {
        // A slot's centre as a distance along the face from its start.
        const on = slots.filter(q => q.face === F.face).map(q => ({ q, s: F.face === 'bottom' ? q.at + a / 2 : F.face === 'top' ? xr - q.at : a / 2 })).sort((p, q) => p.s - q.s);
        let piece = 0;
        line(L, F.start, `${F.face}.${piece++}`);
        for (const { q, s: c } of on) {
            for (const [sx, d, name] of notch)
                line(L, [F.start[0] + (c + sx) * F.along[0] + d * F.inward[0], F.start[1] + (c + sx) * F.along[1] + d * F.inward[1]], `${q.id}.${name}`);
            line(L, [F.start[0] + (c + ho) * F.along[0], F.start[1] + (c + ho) * F.along[1]], `${F.face}.${piece++}`);
            const cx = F.start[0] + c * F.along[0] + depthBar * F.inward[0], cy = F.start[1] + c * F.along[1] + depthBar * F.inward[1];
            slotArea += one;
            Mx += one * cx;
            My += one * cy;
        }
    }
    const holes = [], holeNames = [], rb = bore / 2, disk = Math.PI * rb * rb;
    for (let k = 0; k < cells; k++) {
        holes.push([{ kind: 'arc', start: [k * a + rb, 0], center: [k * a, 0], direction: 'ccw' }]);
        holeNames.push([`core${k}`]);
        Mx += disk * k * a;
    }
    const box = a * a * cells, A = box - slotArea - cells * disk;
    const centroid = [(box * (xr - a / 2) / 2 - Mx) / A, (0 - My) / A];
    return { outer: L.segments, outerNames: L.names, holes, holeNames, area: A, centroid, box: { min: [-a / 2, -a / 2], max: [xr, a / 2] },
        label: `tslot ${fmt(a)}${cells === 2 ? ` × ${fmt(2 * a)}` : ''}, ${slots.length} slot${slots.length === 1 ? '' : 's'}` };
}
/** A section kind built from its numbers; refused `[SECTION_DIMENSIONS]` where they do not make one. */
export function frameSection(spec) {
    switch (spec.kind) {
        case 'rect-tube': return rectTube(spec);
        case 'round-tube': return roundTube(spec);
        case 'angle': return angle(spec);
        case 'channel': return channel(spec);
        case 'i-beam': return flanged(spec);
        case 'tslot': return tslot(spec);
    }
}
/** The places in a section a member's line can run through: its centroid, its own origin, and its box's nine points. */
export const FRAME_ANCHORS = ['centroid', 'origin', 'bottom-left', 'bottom', 'bottom-right', 'left', 'center', 'right', 'top-left', 'top', 'top-right'];
/** An anchor's point in the section's XY, given its centroid and box. */
export function anchorPoint(anchor, centroid, box) {
    if (anchor === 'centroid')
        return centroid;
    if (anchor === 'origin')
        return [0, 0];
    const x = /left/.test(anchor) ? box.min[0] : /right/.test(anchor) ? box.max[0] : (box.min[0] + box.max[0]) / 2;
    const y = /bottom/.test(anchor) ? box.min[1] : /top/.test(anchor) ? box.max[1] : (box.min[1] + box.max[1]) / 2;
    return [x, y];
}
/** A loop's box exactly: its segments' starts and each arc's extreme points on the axes it sweeps past. */
export function loopBox(segments) {
    const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i], next = segments[(i + 1) % segments.length].start;
        take(min, max, s.start[0], s.start[1]);
        if (s.kind !== 'arc')
            continue;
        const r = Math.hypot(s.start[0] - s.center[0], s.start[1] - s.center[1]), a0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]);
        // (A loop of one arc is a whole circle: its end is its start.)
        let sweep = segments.length === 1 ? 2 * Math.PI : Math.atan2(next[1] - s.center[1], next[0] - s.center[0]) - a0;
        if (segments.length > 1) {
            if (s.direction === 'ccw' && sweep <= 0)
                sweep += 2 * Math.PI;
            if (s.direction === 'cw' && sweep >= 0)
                sweep -= 2 * Math.PI;
        }
        for (let k = -8; k <= 8; k++) {
            const q = k * Math.PI / 2, t = s.direction === 'ccw' ? q - a0 : a0 - q;
            if (t > 0 && t < Math.abs(sweep))
                take(min, max, s.center[0] + r * Math.cos(q), s.center[1] + r * Math.sin(q));
        }
    }
    return { min, max };
}
function take(min, max, x, y) { min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); }
