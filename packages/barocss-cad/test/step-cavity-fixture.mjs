// Planar STEP cavity bytes authored from box coordinates, without the CAD writer.
const faceCorners = [
  ['bottom', [0, 3, 2, 1], [0, 0, -1], [0, 1, 0]],
  ['top', [4, 5, 6, 7], [0, 0, 1], [1, 0, 0]],
  ['front', [0, 1, 5, 4], [0, -1, 0], [1, 0, 0]],
  ['right', [1, 2, 6, 5], [1, 0, 0], [0, 1, 0]],
  ['back', [2, 3, 7, 6], [0, 1, 0], [-1, 0, 0]],
  ['left', [3, 0, 4, 7], [-1, 0, 0], [0, -1, 0]],
];

export function stepCavityFixture(voids = [[[4, 4, 4], [6, 6, 6]]], outerHole) {
  const records = [];
  const entity = expression => { records.push(expression); return '#' + records.length; };
  const real = n => Number.isInteger(n) ? n + '.' : String(n);
  const coords = p => '(' + p.map(real).join(',') + ')';
  const point = p => entity(`CARTESIAN_POINT('',${coords(p)})`);
  const direction = p => entity(`DIRECTION('',${coords(p)})`);
  const shell = (name, lo, hi, hole) => {
    const [a, b, c] = lo, [x, y, z] = hi;
    const points = [[a,b,c],[x,b,c],[x,y,c],[a,y,c],[a,b,z],[x,b,z],[x,y,z],[a,y,z]];
    if (hole) {
      const [[ix, iy], [jx, jy]] = hole;
      points.push([ix,iy,c], [jx,iy,c], [jx,jy,c], [ix,jy,c], [ix,iy,z], [jx,iy,z], [jx,jy,z], [ix,jy,z]);
    }
    const vertices = points.map(p => entity(`VERTEX_POINT('',${point(p)})`));
    const edges = new Map();
    const use = (i, j) => {
      const [start, end] = i < j ? [i, j] : [j, i];
      const key = start + ',' + end;
      let edge = edges.get(key);
      if (!edge) {
        const delta = points[end].map((value, axis) => value - points[start][axis]), length = Math.hypot(...delta);
        const vector = entity(`VECTOR('',${direction(delta.map(value => value / length))},${real(length)})`);
        const line = entity(`LINE('',${point(points[start])},${vector})`);
        edge = entity(`EDGE_CURVE('',${vertices[start]},${vertices[end]},${line},.T.)`);
        edges.set(key, edge);
      }
      return entity(`ORIENTED_EDGE('',*,*,${edge},${i === start ? '.T.' : '.F.'})`);
    };
    const bound = (corners, type) => {
      const uses = corners.map((i, j) => use(i, corners[(j + 1) % corners.length]));
      const loop = entity(`EDGE_LOOP('',(${uses.join(',')}))`);
      return entity(`${type}('',${loop},.T.)`);
    };
    const face = (suffix, order, normal, tangent, inner) => {
      const bounds = [bound(order, 'FACE_OUTER_BOUND')];
      if (inner) bounds.push(bound(inner, 'FACE_BOUND'));
      const axes = entity(`AXIS2_PLACEMENT_3D('',${point(points[order[0]])},${direction(normal)},${direction(tangent)})`);
      const plane = entity(`PLANE('',${axes})`);
      return entity(`ADVANCED_FACE('${name}-${suffix}',(${bounds.join(',')}),${plane},.T.)`);
    };
    const innerRing = order => order.map(i => i + 8).reverse();
    const faces = faceCorners.map(([suffix, order, normal, tangent], i) => face(suffix, order, normal, tangent, hole && i < 2 ? innerRing(order) : undefined));
    if (hole) for (const [suffix, order, normal, tangent] of faceCorners.slice(2)) {
      faces.push(face('inner-' + suffix, innerRing(order), normal.map(value => -value), tangent));
    }
    return entity(`CLOSED_SHELL('${name}',(${faces.join(',')}))`);
  };

  const outer = shell('outer', [0, 0, 0], [10, 10, 10], outerHole);
  const inner = voids.map(([lo, hi, hole], i) => shell('void-' + (i + 1), lo, hi, hole));
  const wrappers = inner.map(s => entity(`ORIENTED_CLOSED_SHELL('',*,${s},.F.)`));
  const solid = wrappers.length
    ? entity(`BREP_WITH_VOIDS('box-with-cavity',${outer},(${wrappers.join(',')}))`)
    : entity(`MANIFOLD_SOLID_BREP('solid-box',${outer})`);
  const mm = entity('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
  const context = entity(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm}))REPRESENTATION_CONTEXT('',''))`);
  entity(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${solid}),${context})`);
  const text = [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('Independent cavity fixture'),'2;1');",
    "FILE_NAME('cavity.step','2026-11-12T00:00:00Z',(''),(''),'','','');",
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));", 'ENDSEC;', 'DATA;',
    ...records.map((record, i) => `#${i + 1}=${record};`), 'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n');
  return { text, outer, inner, wrappers, solid };
}
