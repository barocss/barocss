import { curveDomain, evaluateCurve } from '../core/math.js';
import { dot } from '../core/vec3.js';
import { KernelError } from '../core/barocss-error.js';
import { massPropertiesOf } from '../part/part-model.js';
/** A cut list refused: its message starts with `[CODE]`. */
export class CutListError extends KernelError {
    constructor(detail) { super(detail.slice(0, 1024), { code: /^\[([A-Z][A-Z0-9_]+)\]/.exec(detail)?.[1] ?? 'CUT_LIST' }); this.name = 'CutListError'; }
}
const PLANE_KINDS = new Set(['square', 'through', 'mitre', 'butt']);
/** An end's angles from square: its plane's normal against the section's x, y and the line u. */
function endCut(e, m) {
    const base = { end: e.end, kind: e.kind, point: e.point, ...(e.gap !== undefined ? { gap: e.gap } : {}), ...(e.notch ? { notch: e.notch } : {}), ...(e.with !== undefined ? { with: e.with } : {}) };
    if (!e.plane)
        return { ...base, mitre: e.kind === 'square' || e.kind === 'through' ? 0 : null, bevel: e.kind === 'square' || e.kind === 'through' ? 0 : null };
    const axis = m.curve ? (e.end === 'start' ? m.curve.startTangent : m.curve.endTangent) : m.axis;
    let x = m.xAxis, y = m.yAxis;
    if (m.curve && e.end === 'end') {
        const n = m.curve.axis, a = Math.acos(Math.max(-1, Math.min(1, dot(m.curve.startTangent, m.curve.endTangent)))), sign = dot(n, [m.curve.startTangent[1] * m.curve.endTangent[2] - m.curve.startTangent[2] * m.curve.endTangent[1], m.curve.startTangent[2] * m.curve.endTangent[0] - m.curve.startTangent[0] * m.curve.endTangent[2], m.curve.startTangent[0] * m.curve.endTangent[1] - m.curve.startTangent[1] * m.curve.endTangent[0]]) < 0 ? -1 : 1;
        const rotate = (v) => { const c = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]]; return [0, 1, 2].map(i => v[i] * Math.cos(a) + sign * c[i] * Math.sin(a) + n[i] * dot(n, v) * (1 - Math.cos(a))); };
        x = rotate(x);
        y = rotate(y);
    }
    const n = e.plane.normal, nu = Math.abs(dot(n, axis));
    return { ...base, mitre: Math.atan2(Math.abs(dot(n, x)), nu) * 180 / Math.PI, bevel: Math.atan2(Math.abs(dot(n, y)), nu) * 180 / Math.PI };
}
/** Where an end lies along the centroidal line (mm past its start), or null where it is no plane. */
function endAt(e, m, which) {
    const c0 = m.centroidLine.start, u = m.axis;
    if (!e || e.kind === 'square')
        return which ? m.length : 0;
    if (e.kind === 'through')
        return which ? m.length + (e.extended ?? 0) : -(e.extended ?? 0);
    if (!e.plane)
        return null;
    // The line c0 + s·u meets the plane n·(x − o) = 0.
    const n = e.plane.normal, o = e.plane.origin, nu = dot(n, u);
    return (dot(n, [o[0] - c0[0], o[1] - c0[1], o[2] - c0[2]])) / nu;
}
/** A body's extent along a direction: its vertices, and its curved edges at 64 points each. */
function extentAlong(brep, u) {
    let lo = Infinity, hi = -Infinity;
    for (const v of brep.vertices) {
        const s = dot(v.point, u);
        lo = Math.min(lo, s);
        hi = Math.max(hi, s);
    }
    for (const e of brep.edges) {
        if (e.curve.degree === 1 && e.curve.controlPoints.length === 2)
            continue;
        const [a, b] = curveDomain(e.curve);
        for (let k = 1; k < 64; k++) {
            const s = dot(evaluateCurve(e.curve, a + (b - a) * k / 64), u);
            lo = Math.min(lo, s);
            hi = Math.max(hi, s);
        }
    }
    return hi - lo;
}
/** A frame member's output as a piece to cut; refused `[NOT_A_MEMBER]` for a body that is no member. */
export function cutPiece(output, options) {
    const m = output.member;
    if (!m)
        throw new CutListError(`[NOT_A_MEMBER] ${output.id} is not a frame member`);
    // (The volume when the caller has it already: the body's own mass, worked out once.)
    const ends = m.ends ?? [], start = ends.find(e => e.end === 'start'), end = ends.find(e => e.end === 'end'), volume = (typeof options === 'object' ? options?.volume : undefined) ?? massPropertiesOf(output).volume;
    const s0 = endAt(start, m, 0), s1 = endAt(end, m, 1), planar = s0 !== null && s1 !== null && ends.every(e => PLANE_KINDS.has(e.kind) || (e.kind === 'trim' && !!e.plane));
    const square = (which, point) => ({ end: which, kind: 'square', point });
    return {
        id: output.id, ...(m.curve ? { curve: m.curve } : {}), section: m.section, area: m.area, mirrored: !!m.mirrored, reversible: m.reversible ?? false,
        axisLength: m.curve?.developedLength ?? (planar ? s1 - s0 : volume / m.area), fromVolume: m.curve ? ends.some(e => (e.angle ?? 0) !== 0 || e.kind === 'trim' || e.kind === 'cope') : !planar, longPoint: m.curve?.developedLength ?? extentAlong(output.brep, m.axis), volume: volume,
        ends: [endCut(start ?? square('start', m.frame?.from ?? 0), m), endCut(end ?? square('end', m.frame?.to ?? 0), m)],
    };
}
const r6 = (x) => x === null ? 'n' : (Math.round(x * 1e6) / 1e6).toFixed(6);
/** An end as a cut, for telling pieces apart: a through end is cut square. */
const endKey = (e) => `${e.kind === 'through' ? 'square' : e.kind}:${r6(e.mitre)}:${r6(e.bevel)}${e.gap ? `:gap${r6(e.gap)}` : ''}${e.notch ? `:${JSON.stringify(e.notch)}` : ''}`;
/**
 * The cut list of pieces (FR4a, D127): identical pieces on one row — the same section (mirrored apart), axis length and
 * long point to 1e-6 mm, and end cuts (kind, mitre and bevel to 1e-6°; as an unordered pair where the piece is reversible,
 * in order where it is not); a piece with an end that is no plane also by its volume (to 1e-3 mm³). In first-seen
 * order; pieces of different materials apart. Mass (g) by each piece's density, else `density` (g/cm³), the caller's.
 */
export function cutList(pieces, options) {
    const rhoOf = (p) => p.density ?? options.density;
    for (const r of [options.density, ...pieces.map(rhoOf)])
        if (!(r > 0) || !Number.isFinite(r))
            throw new CutListError(`[DENSITY] a density above 0 g/cm³ is needed (${r})`);
    const rows = [];
    for (const p of pieces) {
        const ends = [endKey(p.ends[0]), endKey(p.ends[1])], pair = p.reversible ? [...ends].sort().join('|') : ends.join('|'), rho = rhoOf(p), material = p.material ?? options.material;
        const curveKey = p.curve ? [p.curve.kind, r6(p.curve.radius), r6(p.curve.angle), ...p.curve.straightLengths.map(r6)].join(':') : '';
        const key = [curveKey, p.section, p.mirrored, material ?? '', rho, r6(p.axisLength), r6(p.longPoint), pair, p.fromVolume ? (Math.round(p.volume * 1e3) / 1e3).toFixed(3) : ''].join('#');
        const hit = rows.find(r => r.key === key);
        if (hit) {
            hit.row.pieces.push(p.id);
            continue;
        }
        const mass = rho * (p.fromVolume ? p.volume : p.area * p.axisLength) * 1e-3;
        rows.push({ key, row: { item: rows.length + 1, section: p.section, mirrored: p.mirrored, ...(material ? { material } : {}), pieces: [p.id], axisLength: p.axisLength, fromVolume: p.fromVolume, longPoint: p.longPoint, ends: p.ends, mass } });
    }
    const out = rows.map(({ row }) => ({ ...row, quantity: row.pieces.length, totalMass: row.mass * row.pieces.length }));
    return {
        rows: out, density: options.density, ...(options.material ? { material: options.material } : {}),
        totals: { quantity: out.reduce((n, r) => n + r.quantity, 0), axisLength: out.reduce((n, r) => n + r.axisLength * r.quantity, 0), mass: out.reduce((n, r) => n + r.totalMass, 0) },
    };
}
/** A cut list as CSV (RFC 4180 quoting; lengths in mm to 1e-3, angles to 1e-3°, mass shown in kg to 1e-6, a person's unit for a cut list). */
export function cutListCsv(list) {
    const q = (s) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const n = (x, d) => x === null ? '' : String(Math.round(x * 10 ** d) / 10 ** d);
    const originalCut = (e) => e.kind === 'square' || e.kind === 'through' ? 'square' : e.mitre === null ? e.kind : `${e.kind} ${n(e.mitre, 3)}°${e.bevel ? ` / bevel ${n(e.bevel, 3)}°` : ''}`;
    const cut = (e) => originalCut(e) + (e.gap ? ` / gap ${n(e.gap, 3)} mm` : '') + (e.notch ? e.notch.kind === 'holesaw' ? ` / holesaw diameter ${n(e.notch.diameter, 3)} mm offset ${n(e.notch.offset, 3)} mm` : ` / v depth ${n(e.notch.depth, 3)} mm angle ${n(e.notch.angle, 3)}°` : '');
    const lines = ['item,quantity,section,material,axis length (mm),long point (mm),start cut,end cut,mass each (kg),mass (kg),pieces'];
    for (const r of list.rows)
        lines.push([String(r.item), String(r.quantity), q(r.section + (r.mirrored ? ' (mirrored)' : '')), q(r.material ?? list.material ?? ''), n(r.axisLength, 3) + (r.fromVolume ? ' (by volume)' : ''), n(r.longPoint, 3), q(cut(r.ends[0])), q(cut(r.ends[1])), n(r.mass / 1000, 6), n(r.totalMass / 1000, 6), q(r.pieces.join(' '))].join(','));
    lines.push(['total', String(list.totals.quantity), '', '', n(list.totals.axisLength, 3), '', '', '', '', n(list.totals.mass / 1000, 6), ''].join(','));
    return lines.join('\n') + '\n';
}
