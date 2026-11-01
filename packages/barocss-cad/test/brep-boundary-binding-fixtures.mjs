// Small independent geometry factory. The tent is exact dyadic data, not a fitted/exported oracle.
import { buildBrep, lineCurve } from '../dist/brep/brep-core.js';
export const TENT_E = 1 / 256;
export function tentSurface(e = TENT_E) {
  return { kind: 'surface', id: 'narrow_boundary_tent', degreeU: 1, degreeV: 2,
    knotsU: [0, 0, e, 2 * e, 1, 1], knotsV: [0, 0, 0, 1, 1, 1],
    controlPoints: [0, e, 2 * e, 1].map((x, i) => [0, 0.5, 1].map(y => [x, y, i === 1 ? 2 : 1])),
    weights: Array.from({ length: 4 }, () => [1, 1, 1]) };
}
export function boxInput() {
  const p = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]], edges = new Map();
  const faces = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map((q, i) => {
    const [a,b,c,d] = q, uses = [[a,b],[b,c],[c,d],[d,a]].map(([s,t]) => {
      const lo = Math.min(s,t), hi = Math.max(s,t), id = `e${lo}_${hi}`;
      if (!edges.has(id)) edges.set(id, { id, curve: lineCurve(id, p[lo], p[hi]), vertices: [`v${lo}`, `v${hi}`] });
      return { edge: id, sense: s === lo ? 'forward' : 'reversed' };
    });
    return { id: `f${i}`, name: i === 1 ? 'top' : `face${i}`, surface: { kind: 'surface', id: `s${i}`, degreeU: 1, degreeV: 1, knotsU: [0,0,1,1], knotsV: [0,0,1,1], controlPoints: [[p[a],p[d]],[p[b],p[c]]], weights: [[1,1],[1,1]] }, sense: 'forward', loops: [{kind:'outer',uses}] };
  });
  return { source: { family: 'boundary-binding-test', id: 'box' }, vertices: p.map((point,i)=>({id:`v${i}`,point})), edges:[...edges.values()], bodies:[{id:'box',kind:'solid',shells:[{id:'shell',closed:true,faces}]}] };
}
export function baselineBox() { return buildBrep(boxInput()); }
export function invalidBox() { const b = baselineBox(); b.faces.find(f=>f.name==='top').surface = tentSurface(); return b; }
export function graphSheet(surface, a, b, tolerance = 1e-7) {
  return { format:'barocss-brep',version:0,lengthUnit:'mm',source:{family:'binding-test',id:'graph'},bodies:[],shells:[],faces:[{id:'graph_face',shell:'none',surface,sense:'forward',loops:['graph_loop']}],loops:[{id:'graph_loop',face:'graph_face',kind:'outer',coedges:['use']}],coedges:[{id:'use',edge:'edge',loop:'graph_loop',sense:'forward',next:'use',prev:'use',twin:null,pcurve:null}],edges:[{id:'edge',curve:lineCurve('edge_curve',a,b),vertices:[],tolerance}],vertices:[] };
}
export function matchedBox(e = 1 / 4) {
  const b = baselineBox(), top = b.faces.find(f=>f.name==='top'); top.surface = tentSurface(e);
  for (const edge of b.edges) if (edge.vertices[0].startsWith('v4') && edge.vertices[1] === 'v5' || edge.vertices[0] === 'v6' && edge.vertices[1] === 'v7') {
    const reverse = edge.vertices[0] === 'v6', y = reverse ? 1 : 0, p = [0,e,2*e,1].map((x,i)=>[x,y,i===1?2:1]);
    edge.curve = {kind:'curve',id:edge.curve.id,degree:1,knots:[0,0,e,2*e,1,1],controlPoints:reverse?p.reverse():p,weights:[1,1,1,1]};
  }
  // Front/back support planes enclose their genuinely curved top edges, without changing the loops.
  for (const name of ['face2','face4']) { const f = b.faces.find(f=>f.name===name); f.surface = structuredClone(f.surface); for (const row of f.surface.controlPoints) for (const p of row) if (p[2] === 1) p[2] = 2; }
  return b;
}

export function withTentStep(baseline) {
  const face = baseline.split('\n').find(line => /ADVANCED_FACE\('top',/.test(line));
  if (!face) throw Error('one named top face required');
  const match = /ADVANCED_FACE\('top',\([^)]*\),#(\d+),/.exec(face); if (!match) throw Error('top surface reference required');
  const sid = match[1], surface = tentSurface(); let next = Math.max(...[...baseline.matchAll(/^#(\d+)=/gm)].map(m=>Number(m[1]))) + 1;
  const records = [], rows = surface.controlPoints.map(row => '('+row.map(p=>{ const id=next++; records.push(`#${id}=CARTESIAN_POINT('',(${p.map(x=>String(x).includes('.')?String(x):String(x)+'.').join(',')}));`); return '#'+id; }).join(',')+')');
  const replacement = `#${sid}=B_SPLINE_SURFACE_WITH_KNOTS('',1,2,(${rows.join(',')}),.UNSPECIFIED.,.F.,.F.,.F.,(2,1,1,2),(3,3),(0.,0.00390625,0.0078125,1.),(0.,1.),.UNSPECIFIED.);`;
  const regex = new RegExp('^#'+sid+'=.*;$','m'); if (!regex.test(baseline)) throw Error('top surface definition required');
  return baseline.replace(regex,replacement).replace('ENDSEC;\nEND-ISO-10303-21;',records.join('\n')+'\nENDSEC;\nEND-ISO-10303-21;');
}

/** Exact determinant-one shear of the box, with an equivalent nonconstant graph representation at its top. */
export function slopedBox() {
  const b = baselineBox(), shear = p => [p[0], p[1], p[2] + p[0]];
  for (const v of b.vertices) v.point = shear(v.point);
  for (const e of b.edges) e.curve.controlPoints = e.curve.controlPoints.map(shear);
  for (const f of b.faces) f.surface.controlPoints = f.surface.controlPoints.map(row=>row.map(shear));
  const s = tentSurface(); for (const row of s.controlPoints) for (const p of row) p[2] = 1 + p[0];
  b.faces.find(f=>f.name==='top').surface = s; return b;
}
