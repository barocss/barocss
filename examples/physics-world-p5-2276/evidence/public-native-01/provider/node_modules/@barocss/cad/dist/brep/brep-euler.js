// Euler operators on a mutable B-rep (brep-core step 2). Each operator keeps the Euler–Poincaré
// relation V − E + F − (L − F) = 2(S − G) by construction, so topology built only from them is
// valid before any geometry is attached:
//
//   mvfs  +V +F +S        make vertex, face (with an empty loop anchored at the vertex), shell
//   mev   +V +E           make edge and vertex (a strut out of a loop vertex)
//   mef   +E +F           make edge and face (split a loop between two of its coedges)
//   kemr  −E +L           kill edge, make ring (split a loop into an outer part and an inner ring)
//   kfmrh −F +L +G        kill face, make ring and hole (the face's loop becomes a ring of another face)
//
// Geometry (vertex points, edge curves, face surfaces) is carried along; `toBrep()` emits the
// immutable B-rep for checkBrep and the tessellator.
import { buildBrep, lineCurve } from './brep-core.js';
import { KernelError } from '../core/barocss-error.js';
export class BrepEulerError extends KernelError {
    constructor(detail) { super('B-rep Euler operator: ' + detail, { code: 'BREP_EULER' }); this.name = 'BrepEulerError'; }
}
const fail = (detail) => { throw new BrepEulerError(detail); };
export class BrepEditor {
    prefix;
    vertices = new Map();
    edges = new Map();
    coedges = new Map();
    loops = new Map();
    faces = new Map();
    shells = new Map();
    bodies = new Map();
    counter = 0;
    constructor(prefix = 'b') {
        this.prefix = prefix;
    }
    id(kind) { return `${this.prefix}${kind}${this.counter++}`; }
    // ---- queries --------------------------------------------------------------------------------
    start(c) { const x = this.coedges.get(c), e = this.edges.get(x.edge); return x.sense === 'forward' ? e.v[0] : e.v[1]; }
    end(c) { const x = this.coedges.get(c), e = this.edges.get(x.edge); return x.sense === 'forward' ? e.v[1] : e.v[0]; }
    /** Coedges of a loop in order (empty for a loop that is only an anchor vertex). */
    loopCoedges(loop) {
        const l = this.loops.get(loop) ?? fail(`unknown loop ${loop}`), out = [];
        if (l.first === null)
            return out;
        let c = l.first;
        do {
            out.push(c);
            c = this.coedges.get(c).next;
            if (out.length > 100000)
                fail('loop does not close');
        } while (c !== l.first);
        return out;
    }
    /** Vertex ids of a loop in traversal order. */
    loopVertices(loop) { const l = this.loops.get(loop); return l.first === null ? (l.anchor ? [l.anchor] : []) : this.loopCoedges(loop).map(c => this.start(c)); }
    /** The coedge of `loop` that starts at vertex `v` (the first one when the vertex repeats). */
    outOf(loop, v) { return this.loopCoedges(loop).find(c => this.start(c) === v) ?? fail(`vertex ${v} is not on loop ${loop}`); }
    get counts() { return { V: this.vertices.size, E: this.edges.size, F: this.faces.size, L: this.loops.size, S: this.shells.size }; }
    coedge(edge, sense, loop) { const c = { id: this.id('c'), edge, sense, loop, next: '', prev: '' }; this.coedges.set(c.id, c); return c; }
    link(a, b) { a.next = b.id; b.prev = a.id; }
    // ---- operators ------------------------------------------------------------------------------
    mvfs(point) {
        const body = this.id('B'), shell = this.id('S'), face = this.id('F'), loop = this.id('L'), vertex = this.id('v');
        this.vertices.set(vertex, { id: vertex, point: [...point] });
        this.loops.set(loop, { id: loop, face, first: null, anchor: vertex });
        this.faces.set(face, { id: face, shell, outer: loop, inner: [], surface: null, sense: 'forward' });
        this.shells.set(shell, { id: shell, body, faces: [face] });
        this.bodies.set(body, { id: body, shells: [shell] });
        return { body, shell, face, loop, vertex };
    }
    /** A strut from `v` to a new vertex at `point`, inserted before coedge `before` (or into an anchor-only loop). */
    mev(loop, v, point, curve = null, before) {
        const l = this.loops.get(loop) ?? fail(`unknown loop ${loop}`);
        const vertex = this.id('v');
        this.vertices.set(vertex, { id: vertex, point: [...point] });
        const edge = this.id('e');
        this.edges.set(edge, { id: edge, v: [v, vertex], curve });
        const up = this.coedge(edge, 'forward', loop), down = this.coedge(edge, 'reversed', loop);
        if (l.first === null) {
            if (l.anchor !== v)
                fail(`vertex ${v} is not the anchor of loop ${loop}`);
            this.link(up, down);
            this.link(down, up);
            l.first = up.id;
            l.anchor = null;
        }
        else {
            const out = this.coedges.get(before ?? this.outOf(loop, v));
            if (this.start(out.id) !== v || out.loop !== loop)
                fail('mev: `before` must start at v on the loop');
            const prev = this.coedges.get(out.prev);
            this.link(prev, up);
            this.link(up, down);
            this.link(down, out);
        }
        return { vertex, edge, up: up.id, down: down.id };
    }
    /**
     * New edge from start(a) to start(b) (a, b on one loop). The new face's loop is a … prev(b)
     * closed by the new edge reversed; the old loop keeps b … prev(a) closed by the new edge forward.
     */
    mef(a, b, curve = null) {
        const ca = this.coedges.get(a) ?? fail(`unknown coedge ${a}`), cb = this.coedges.get(b) ?? fail(`unknown coedge ${b}`);
        if (ca.loop !== cb.loop || a === b)
            fail('mef: two distinct coedges of one loop required');
        const oldLoop = this.loops.get(ca.loop), oldFace = this.faces.get(oldLoop.face);
        const edge = this.id('e');
        this.edges.set(edge, { id: edge, v: [this.start(a), this.start(b)], curve });
        const face = this.id('F'), loop = this.id('L');
        const kept = this.coedge(edge, 'forward', oldLoop.id), made = this.coedge(edge, 'reversed', loop);
        const pa = this.coedges.get(ca.prev), pb = this.coedges.get(cb.prev);
        this.link(pb, made);
        this.link(made, ca);
        this.link(pa, kept);
        this.link(kept, cb);
        this.loops.set(loop, { id: loop, face, first: made.id, anchor: null });
        for (const c of this.loopCoedges(loop))
            this.coedges.get(c).loop = loop;
        oldLoop.first = kept.id;
        this.faces.set(face, { id: face, shell: oldFace.shell, outer: loop, inner: [], surface: null, sense: 'forward' });
        this.shells.get(oldFace.shell).faces.push(face);
        return { face, loop, edge, kept: kept.id, made: made.id };
    }
    /** Removes an edge whose two coedges lie on one loop; the part strictly between them becomes a new inner loop (ring). */
    kemr(edge) {
        const uses = [...this.coedges.values()].filter(c => c.edge === edge);
        if (uses.length !== 2 || uses[0].loop !== uses[1].loop)
            fail('kemr: both uses of the edge must lie on one loop');
        // c1 is the use whose following run (up to c2) becomes the ring.
        const [c1, c2] = uses[0].sense === 'forward' ? [uses[0], uses[1]] : [uses[1], uses[0]];
        const loop = this.loops.get(c1.loop), face = this.faces.get(loop.face), ring = this.id('L');
        const ringFirst = c1.next === c2.id ? null : c1.next, ringLast = c2.prev;
        const restFirst = c2.next === c1.id ? null : c2.next, restLast = c1.prev;
        const ringAnchor = this.end(c1.id), restAnchor = this.end(c2.id);
        if (ringFirst) {
            this.link(this.coedges.get(ringLast), this.coedges.get(ringFirst));
        }
        if (restFirst) {
            this.link(this.coedges.get(restLast), this.coedges.get(restFirst));
        }
        this.coedges.delete(c1.id);
        this.coedges.delete(c2.id);
        this.edges.delete(edge);
        loop.first = restFirst;
        loop.anchor = restFirst ? null : restAnchor;
        this.loops.set(ring, { id: ring, face: face.id, first: ringFirst, anchor: ringFirst ? null : ringAnchor });
        for (const c of this.loopCoedges(ring))
            this.coedges.get(c).loop = ring;
        face.inner.push(ring);
        return { ring };
    }
    /** Kills a face that has only its outer loop; that loop becomes an inner ring of `into` (a through hole). */
    kfmrh(face, into) {
        const f = this.faces.get(face) ?? fail(`unknown face ${face}`), target = this.faces.get(into) ?? fail(`unknown face ${into}`);
        if (f.inner.length)
            fail('kfmrh: the killed face must have no rings');
        this.loops.get(f.outer).face = into;
        target.inner.push(f.outer);
        this.faces.delete(face);
        const shell = this.shells.get(f.shell);
        shell.faces = shell.faces.filter(x => x !== face);
    }
    // ---- geometry and output --------------------------------------------------------------------
    setCurve(edge, curve) { (this.edges.get(edge) ?? fail(`unknown edge ${edge}`)).curve = curve; }
    setSurface(face, surface, sense) { const f = this.faces.get(face) ?? fail(`unknown face ${face}`); f.surface = surface; f.sense = sense; }
    /** The immutable B-rep. Edges without a curve get a straight line; every face needs a surface. */
    toBrep(source) {
        const vertices = [...this.vertices.values()], point = (v) => this.vertices.get(v).point;
        return buildBrep({
            source, vertices: vertices.map(v => ({ id: v.id, point: v.point })),
            edges: [...this.edges.values()].map(e => ({ id: e.id, curve: e.curve ?? lineCurve(e.id, point(e.v[0]), point(e.v[1])), vertices: e.v })),
            bodies: [...this.bodies.values()].map(b => ({ id: b.id, kind: 'solid', shells: b.shells.map(sid => {
                    const s = this.shells.get(sid);
                    return { id: sid, closed: true, faces: s.faces.map(fid => {
                            const f = this.faces.get(fid);
                            if (!f.surface)
                                fail(`face ${fid} has no surface`);
                            const loop = (lid, kind) => ({ kind, uses: this.loopCoedges(lid).map(c => { const x = this.coedges.get(c); return { edge: x.edge, sense: x.sense }; }) });
                            return { id: fid, surface: f.surface, sense: f.sense, loops: [loop(f.outer, 'outer'), ...f.inner.map(l => loop(l, 'inner'))] };
                        }) };
                }) })),
        });
    }
}
