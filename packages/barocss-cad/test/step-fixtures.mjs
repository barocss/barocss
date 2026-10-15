// STEP files written the way other systems (OCCT-based ones in particular) write them: analytic
// surfaces (CYLINDRICAL_SURFACE, CONICAL_SURFACE, SPHERICAL_SURFACE), full circles as closed edges,
// periodic faces bounded by a seam edge used twice, SEAM_CURVE and SURFACE_CURVE wrappers, poles as
// the ends of a seam. Used to test importStep against files it did not write.

function writer() {
  const lines = []; let n = 0;
  const e = s => { lines.push(`#${++n}=${s};`); return `#${n}`; };
  const r = x => { const s = String(Object.is(x, -0) ? 0 : x); return /[.e]/i.test(s) ? s.replace('e', 'E') : s + '.'; };
  const pt = p => e(`CARTESIAN_POINT('',(${p.map(r).join(',')}))`), dir = d => e(`DIRECTION('',(${d.map(r).join(',')}))`);
  const ax = (o, z = [0, 0, 1], x = [1, 0, 0]) => e(`AXIS2_PLACEMENT_3D('',${pt(o)},${dir(z)},${dir(x)})`);
  const vtx = p => e(`VERTEX_POINT('',${pt(p)})`);
  const line = (p, d) => e(`LINE('',${pt(p)},${e(`VECTOR('',${dir(d)},1.)`)})`);
  const edge = (a, b, curve, same = true) => e(`EDGE_CURVE('',${a},${b},${curve},${same ? '.T.' : '.F.'})`);
  const oe = (ed, fwd) => e(`ORIENTED_EDGE('',*,*,${ed},${fwd ? '.T.' : '.F.'})`);
  const loop = (...oes) => e(`EDGE_LOOP('',(${oes.join(',')}))`);
  const face = (bounds, surface, same, name = '') => e(`ADVANCED_FACE('${name}',(${bounds.join(',')}),${surface},${same ? '.T.' : '.F.'})`);
  const outer = l => e(`FACE_OUTER_BOUND('',${l},.T.)`), inner = l => e(`FACE_BOUND('',${l},.T.)`);
  const finish = (faces, name) => {
    const shell = e(`CLOSED_SHELL('',(${faces.join(',')}))`), solid = e(`MANIFOLD_SOLID_BREP('${name}',${shell})`);
    const mm = e(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`);
    const ctx = e(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm}))REPRESENTATION_CONTEXT('',''))`);
    e(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${solid}),${ctx})`);
    return ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('f.stp','',(''),(''),'','','');", "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));", 'ENDSEC;', 'DATA;',
      '/* written as OCCT writes it */', ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n');
  };
  return { e, pt, dir, ax, vtx, line, edge, oe, loop, face, outer, inner, finish };
}

/** A cylinder about z: two discs bounded by closed circles, a wall with a seam at x = r. */
export function cylinderStep(r = 5, h = 10) {
  const w = writer();
  const v0 = w.vtx([r, 0, 0]), v1 = w.vtx([r, 0, h]);
  const c0 = w.edge(v0, v0, w.e(`SURFACE_CURVE('',${w.e(`CIRCLE('',${w.ax([0, 0, 0])},${r}.)`)},(),.CURVE_3D.)`)), c1 = w.edge(v1, v1, w.e(`CIRCLE('',${w.ax([0, 0, h])},${r}.)`));
  const seam = w.edge(v0, v1, w.e(`SEAM_CURVE('',${w.line([r, 0, 0], [0, 0, 1])},(),.PCURVE_S1.)`));
  const wall = w.face([w.outer(w.loop(w.oe(c0, true), w.oe(seam, true), w.oe(c1, false), w.oe(seam, false)))], w.e(`CYLINDRICAL_SURFACE('',${w.ax([0, 0, 0])},${r}.)`), true, 'wall');
  const top = w.face([w.outer(w.loop(w.oe(c1, true)))], w.e(`PLANE('',${w.ax([0, 0, h])})`), true, 'top');
  const bottom = w.face([w.outer(w.loop(w.oe(c0, false)))], w.e(`PLANE('',${w.ax([0, 0, 0])})`), false, 'bottom');
  return w.finish([wall, top, bottom], 'cylinder');
}

/** A box a × b × h with a through hole of radius r at its centre (the hole's wall faces inwards). */
export function holedBoxStep(a = 40, b = 30, h = 10, r = 4) {
  const w = writer(), P = (x, y, z) => w.vtx([x, y, z]), cx = a / 2, cy = b / 2;
  const V = [P(0, 0, 0), P(a, 0, 0), P(a, b, 0), P(0, b, 0), P(0, 0, h), P(a, 0, h), P(a, b, h), P(0, b, h)];
  const C = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [0, 0, h], [a, 0, h], [a, b, h], [0, b, h]];
  const L = (i, j) => w.edge(V[i], V[j], w.line(C[i], C[j].map((x, k) => x - C[i][k]).map((x, _, d) => x / Math.hypot(...d))));
  const bot = [L(0, 1), L(1, 2), L(2, 3), L(3, 0)], top = [L(4, 5), L(5, 6), L(6, 7), L(7, 4)], up = [L(0, 4), L(1, 5), L(2, 6), L(3, 7)];
  const hv0 = w.vtx([cx + r, cy, 0]), hv1 = w.vtx([cx + r, cy, h]);
  const hc0 = w.edge(hv0, hv0, w.e(`CIRCLE('',${w.ax([cx, cy, 0])},${r}.)`)), hc1 = w.edge(hv1, hv1, w.e(`CIRCLE('',${w.ax([cx, cy, h])},${r}.)`));
  const seam = w.edge(hv0, hv1, w.e(`SEAM_CURVE('',${w.line([cx + r, cy, 0], [0, 0, 1])},(),.PCURVE_S1.)`));
  const plane = (o, z, x) => w.e(`PLANE('',${w.ax(o, z, x)})`);
  const faces = [
    w.face([w.outer(w.loop(w.oe(bot[0], false), w.oe(bot[3], false), w.oe(bot[2], false), w.oe(bot[1], false))), w.inner(w.loop(w.oe(hc0, true)))], plane([0, 0, 0], [0, 0, -1], [1, 0, 0]), true, 'bottom'),
    w.face([w.outer(w.loop(w.oe(top[0], true), w.oe(top[1], true), w.oe(top[2], true), w.oe(top[3], true))), w.inner(w.loop(w.oe(hc1, false)))], plane([0, 0, h], [0, 0, 1], [1, 0, 0]), true, 'top'),
    w.face([w.outer(w.loop(w.oe(bot[0], true), w.oe(up[1], true), w.oe(top[0], false), w.oe(up[0], false)))], plane([0, 0, 0], [0, -1, 0], [1, 0, 0]), true, 'front'),
    w.face([w.outer(w.loop(w.oe(bot[1], true), w.oe(up[2], true), w.oe(top[1], false), w.oe(up[1], false)))], plane([a, 0, 0], [1, 0, 0], [0, 1, 0]), true, 'right'),
    w.face([w.outer(w.loop(w.oe(bot[2], true), w.oe(up[3], true), w.oe(top[2], false), w.oe(up[2], false)))], plane([a, b, 0], [0, 1, 0], [-1, 0, 0]), true, 'back'),
    w.face([w.outer(w.loop(w.oe(bot[3], true), w.oe(up[0], true), w.oe(top[3], false), w.oe(up[3], false)))], plane([0, b, 0], [-1, 0, 0], [0, -1, 0]), true, 'left'),
    // The hole's wall: material outside, so its normal points at the axis (same_sense false).
    w.face([w.outer(w.loop(w.oe(hc0, false), w.oe(seam, true), w.oe(hc1, true), w.oe(seam, false)))], w.e(`CYLINDRICAL_SURFACE('',${w.ax([cx, cy, 0])},${r}.)`), false, 'hole'),
  ];
  return w.finish(faces, 'holed box');
}

/** A cone frustum about z: radius R at z = 0 to radius R − h·tan α at z = h, its wall with a seam. */
export function frustumStep(R = 10, h = 6, alphaDeg = 30) {
  const w = writer(), t = Math.tan(alphaDeg * Math.PI / 180), r1 = R - h * t;
  const v0 = w.vtx([R, 0, 0]), v1 = w.vtx([r1, 0, h]);
  const c0 = w.edge(v0, v0, w.e(`CIRCLE('',${w.ax([0, 0, 0])},${R})`)), c1 = w.edge(v1, v1, w.e(`CIRCLE('',${w.ax([0, 0, h])},${r1})`));
  const d = [r1 - R, 0, h], l = Math.hypot(...d), seam = w.edge(v0, v1, w.e(`SEAM_CURVE('',${w.line([R, 0, 0], d.map(x => x / l))},(),.PCURVE_S1.)`));
  // CONICAL_SURFACE: radius r1 at its placement on top, the axis pointing down (the radius grows along it).
  const wall = w.face([w.outer(w.loop(w.oe(c0, true), w.oe(seam, true), w.oe(c1, false), w.oe(seam, false)))], w.e(`CONICAL_SURFACE('',${w.ax([0, 0, h], [0, 0, -1], [1, 0, 0])},${r1},${alphaDeg * Math.PI / 180})`), true, 'cone');
  const top = w.face([w.outer(w.loop(w.oe(c1, true)))], w.e(`PLANE('',${w.ax([0, 0, h])})`), true, 'top');
  const bottom = w.face([w.outer(w.loop(w.oe(c0, false)))], w.e(`PLANE('',${w.ax([0, 0, 0])})`), false, 'bottom');
  return w.finish([wall, top, bottom], 'frustum');
}

/** A sphere: one face bounded by a seam from pole to pole, used twice. */
export function sphereStep(r = 5) {
  const w = writer(), s = w.vtx([0, 0, -r]), n = w.vtx([0, 0, r]);
  const seam = w.edge(s, n, w.e(`SEAM_CURVE('',${w.e(`CIRCLE('',${w.ax([0, 0, 0], [0, -1, 0], [1, 0, 0])},${r}.)`)},(),.PCURVE_S1.)`));
  const f = w.face([w.outer(w.loop(w.oe(seam, true), w.oe(seam, false)))], w.e(`SPHERICAL_SURFACE('',${w.ax([0, 0, 0])},${r}.)`), true, 'ball');
  return w.finish([f], 'sphere');
}
