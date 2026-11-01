// Hand-authored Part21 primitives. Expected geometry is literal; no production writer/evaluator oracle.
import { cylinderStep } from './step-fixtures.mjs';
const real = n => Number.isInteger(n) ? `${n}.` : String(n);
function units(text, unit) { return unit === 'cm' ? text.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT(.CENTI.,.METRE.)') : text; }
function append(text, records) { return text.replace('ENDSEC;\nEND-ISO-10303-21;', records.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;'); }
export function cylinderOffsetStep({ baseRadius = 10, distance = 2, height = 10, boundaryRadius = baseRadius + distance, selfIntersect = 'F', unit = 'mm' } = {}) {
  const text = cylinderStep(boundaryRadius, height).replace(/(\d+\.\d+)\.(?=[,)])/g, '$1'), match = /^#(\d+)=CYLINDRICAL_SURFACE\('',(#\d+),[^;]+;$/m.exec(text);
  if (!match) throw Error('one cylinder basis required');
  const id = Math.max(...[...text.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1]))) + 1;
  return units(append(text.replace(match[0], `#${match[1]}=OFFSET_SURFACE('',#${id},${real(distance)},.${selfIntersect}.);`), [`#${id}=CYLINDRICAL_SURFACE('',${match[2]},${real(baseRadius)});`]), unit);
}
/** Literal4x3x2 box; only top is an offset plane, basez1 +distance1. */
export function planeOffsetStep({ distance = 1, baseHeight = 1, boundaryHeight = 2, selfIntersect = 'F', unit = 'mm' } = {}) {
  const records = []; let id = 0;
  const e = s => { records.push(`#${++id}=${s};`); return `#${id}`; };
  const pt = p => e(`CARTESIAN_POINT('',(${p.map(real).join(',')}))`), dir = p => e(`DIRECTION('',(${p.map(real).join(',')}))`);
  const ax = (o, z, x) => e(`AXIS2_PLACEMENT_3D('',${pt(o)},${dir(z)},${dir(x)})`);
  const p = [[0,0,0],[4,0,0],[4,3,0],[0,3,0],[0,0,boundaryHeight],[4,0,boundaryHeight],[4,3,boundaryHeight],[0,3,boundaryHeight]];
  const vertices = p.map(q => e(`VERTEX_POINT('',${pt(q)})`)), edges = new Map();
  const qfaces = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  const normals = [[0,0,-1],[0,0,1],[0,-1,0],[1,0,0],[0,1,0],[-1,0,0]], xs = [[1,0,0],[1,0,0],[1,0,0],[0,1,0],[-1,0,0],[0,-1,0]], names = ['bottom','top','front','right','back','left'];
  const faces = qfaces.map((q, fi) => {
    const uses = q.map((a, i) => {
      const b = q[(i + 1) % 4], lo = Math.min(a, b), hi = Math.max(a, b), key = `${lo}/${hi}`;
      if (!edges.has(key)) {
        const d = p[hi].map((x, k) => x - p[lo][k]), curve = e(`LINE('',${pt(p[lo])},${e(`VECTOR('',${dir(d)},1.)`)})`);
        edges.set(key, e(`EDGE_CURVE('',${vertices[lo]},${vertices[hi]},${curve},.T.)`));
      }
      return e(`ORIENTED_EDGE('',*,*,${edges.get(key)},.${a === lo ? 'T' : 'F'}.)`);
    });
    const loop = e(`EDGE_LOOP('',(${uses.join(',')}))`), bound = e(`FACE_OUTER_BOUND('',${loop},.T.)`);
    const origin = fi === 1 ? [0,0,baseHeight] : p[q[0]], base = e(`PLANE('',${ax(origin, normals[fi], xs[fi])})`);
    const surface = fi === 1 ? e(`OFFSET_SURFACE('',${base},${real(distance)},.${selfIntersect}.)`) : base;
    return e(`ADVANCED_FACE('${names[fi]}',(${bound}),${surface},.T.)`);
  });
  const solid = e(`MANIFOLD_SOLID_BREP('offset plane box',${e(`CLOSED_SHELL('',(${faces.join(',')}))`)})`), mm = e('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
  const context = e(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm}))REPRESENTATION_CONTEXT('',''))`);
  e(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${solid}),${context})`);
  return units(["ISO-10303-21;",'HEADER;',"FILE_DESCRIPTION((''),'2;1');","FILE_NAME('offset plane.stp','',(''),(''),'','','');","FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));",'ENDSEC;','DATA;',...records,'ENDSEC;','END-ISO-10303-21;',''].join('\n'), unit);
}
export function unsupportedOffsetStep() {
  return cylinderOffsetStep().replace(/CYLINDRICAL_SURFACE\('',(#\d+),10\.\)/, "SPHERICAL_SURFACE('',$1,10.)");
}
