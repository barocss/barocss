// Planar STEP cavity bytes authored from box coordinates, without the CAD writer.
const faceCorners = [
  ['bottom', [0, 3, 2, 1], [0, 0, -1], [0, 1, 0]],
  ['top', [4, 5, 6, 7], [0, 0, 1], [1, 0, 0]],
  ['front', [0, 1, 5, 4], [0, -1, 0], [1, 0, 0]],
  ['right', [1, 2, 6, 5], [1, 0, 0], [0, 1, 0]],
  ['back', [2, 3, 7, 6], [0, 1, 0], [-1, 0, 0]],
  ['left', [3, 0, 4, 7], [-1, 0, 0], [0, -1, 0]],
];

export function stepCavityFixture(voids = [[[4, 4, 4], [6, 6, 6]]]) {
  const records = [];
  const entity = expression => { records.push(expression); return '#' + records.length; };
  const real = n => Number.isInteger(n) ? n + '.' : String(n);
  const coords = p => '(' + p.map(real).join(',') + ')';
  const point = p => entity(`CARTESIAN_POINT('',${coords(p)})`);
  const direction = p => entity(`DIRECTION('',${coords(p)})`);
  const shell = (name, lo, hi) => {
    const [a, b, c] = lo, [x, y, z] = hi;
    const points = [[a,b,c],[x,b,c],[x,y,c],[a,y,c],[a,b,z],[x,b,z],[x,y,z],[a,y,z]];
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
    const faces = faceCorners.map(([suffix, order, normal, tangent]) => {
      const uses = order.map((i, j) => use(i, order[(j + 1) % order.length]));
      const loop = entity(`EDGE_LOOP('',(${uses.join(',')}))`);
      const bound = entity(`FACE_OUTER_BOUND('',${loop},.T.)`);
      const axes = entity(`AXIS2_PLACEMENT_3D('',${point(points[order[0]])},${direction(normal)},${direction(tangent)})`);
      const plane = entity(`PLANE('',${axes})`);
      return entity(`ADVANCED_FACE('${name}-${suffix}',(${bound}),${plane},.T.)`);
    });
    return entity(`CLOSED_SHELL('${name}',(${faces.join(',')}))`);
  };

  const outer = shell('outer', [0, 0, 0], [10, 10, 10]);
  const inner = voids.map(([lo, hi], i) => shell('void-' + (i + 1), lo, hi));
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
