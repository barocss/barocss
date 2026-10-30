import { rebindDims, sketchShapes } from './cur/packages/barocss-cad-model/src/sketch/reopen';
import { profileOf } from './cur/packages/barocss-cad-model/src/sketch/loops';
import { joinOpen } from './cur/packages/barocss-cad-model/src/sketch/trim';
import { startPicking } from './cur/packages/barocss-cad-model/src/sketch/select';
import { xyPlane } from './cur/packages/barocss-cad-model/src/sketch/plane';
import { evaluateDoc } from './cur/packages/barocss-cad-model/src/engine/evaluate';
const W = { parameter: 'W' };
const J = (x: unknown) => JSON.stringify(x);
function refinish(node: any, params: any, edit?: (st: any) => any) {
  const { shape, done } = sketchShapes(node, params);
  let s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as never, 'select');
  if (edit) s = edit(s);
  const shapes = joinOpen([s.shape, ...s.done].filter(Boolean));
  const p: any = profileOf(shapes);
  if ('error' in p) return { error: p.error };
  const out: any = rebindDims(node, p.node, params);
  delete out.sideTags; return out;
}
const show = (label: string, x: any) => console.log(label.padEnd(44), J(x));
async function ev(node: any, params: any) { const doc: any = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: params, nodes: [{ ...node, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 }; const r: any = await evaluateDoc(doc, 1); return r.ok ? 'ok' : 'REFUSED ' + (r.error?.detail ?? J(r.error)); }

// A1 rectangle bound; move only the min corner vertex (polygon shape after startPicking) -> kind change
{ const P = { W: 40 }; const st = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [W, 40] };
  const r = refinish(st, P, s => ({ ...s, shape: { ...s.shape, points: s.shape.points.map((p: any, i: number) => i === 0 ? [-5, -5] : p), hv: { h: [], v: [] }, fromRectangle: false } }));
  show('A1 rect, move min corner (W edge unchanged)', r);
  const r2 = refinish(st, P, s => ({ ...s, shape: { ...s.shape, bulges: [0, 0.2, 0, 0] } }));
  show('A2 rect, bulge on far side (curve)', r2);
  // A3 add a radius (round corner) via radii? simulate: point inserted near corner
  const r3 = refinish(st, P, s => ({ ...s, shape: { ...s.shape, points: [[0,0],[40,0],[40,35],[35,40],[0,40]], bulges: [0,0,0,0,0], hv: undefined, fromRectangle: false } }));
  show('A3 rect, chamfer far corner (x=W edge kept)', r3);
  const r4 = refinish(st, P, s => ({ ...s, shape: { ...s.shape, lengths: { 1: 40 } } }));
  show('A4 rect, add a length lock', r4);
}
// B polygon: delete the bound vertex -> wrong attach?
{ const P = { X: 30 }; const X = { parameter: 'X' };
  const st = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [X, 0], [30, 20], [0, 20]] };
  show('B0 polygon stored', st);
  const r = refinish(st, P, s => ({ ...s, shape: { ...s.shape, points: [[0, 0], [30, 20], [0, 20]], bulges: [0, 0, 0] } }));
  show('B1 delete vertex 1 ([X,0])', r);
  const r2 = refinish(st, P, s => ({ ...s, shape: { ...s.shape, points: [[0, 0], [15, -5], [30, 0], [30, 20], [0, 20]], bulges: [0, 0, 0, 0, 0] } }));
  show('B2 insert vertex before [X,0]', r2);
  const st3 = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [30, 0], [X, 20], [0, 20]] };
  const r3 = refinish(st3, P, s => ({ ...s, shape: { ...s.shape, points: [[0, 0], [30, 20], [0, 20]], bulges: [0, 0, 0] } }));
  show('B3 stored [X,20] at idx2; delete idx1 -> [30,20] at idx1', r3);
  // B4: rotate start (points order shifted, same geometry)
  const r4 = refinish(st, P, s => ({ ...s, shape: { ...s.shape, points: [[30, 0], [30, 20], [0, 20], [0, 0]] } }));
  show('B4 same polygon, start rotated', r4);
  // B5: deleting bound vertex where another vertex coincides: polygon [[0,0],[X,0],[X,20],[0,20]]? delete idx1 -> idx1 becomes [30,20] -> X rebinds there
  const st5 = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [X, 0], [30, 20], [0, 20]] };
  const r5 = refinish(st5, P, s => ({ ...s, shape: { ...s.shape, points: [[0, 0], [30, 20], [0, 20]], bulges: [0, 0, 0] } }));
  show('B5 (=B1) then evaluate with X=50', r5); console.log('    eval X=50:', await ev(r5, { X: 50 }), J(sketchShapes(r5, { X: 50 }).shape && (sketchShapes(r5, { X: 50 }).shape as any).points));
}
// C regions: two regions, delete region 0; region1 shifts
{ const P = { W: 40, X: 100 }; const X = { parameter: 'X' };
  const st = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [W, 40], regions: [
    [{ kind: 'line', start: [60, 0] }, { kind: 'line', start: [X, 0] }, { kind: 'line', start: [X, 40] }, { kind: 'line', start: [60, 40] }],
    [{ kind: 'line', start: [120, 0] }, { kind: 'line', start: [140, 0] }, { kind: 'line', start: [140, 40] }, { kind: 'line', start: [120, 40] }]] };
  show('C0 unchanged finish', refinish(st, P));
  const r = refinish(st, P, s => ({ ...s, done: s.done.slice(1) }));
  show('C1 delete region 0 (X-bound)', r);
}
// D circle main with region beside: startPicking swaps -> profile change
{ const P = { R: 5 }; const R = { parameter: 'R' };
  const st = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: R, regions: [[{ kind: 'line', start: [20, -5] }, { kind: 'line', start: [40, -5] }, { kind: 'line', start: [40, 5] }, { kind: 'line', start: [20, 5] }]] };
  console.log('D eval stored:', await ev(st, P));
  const r = refinish(st, P); show('D circle(R) + region, unchanged finish', r);
}
// E line-only convex loop -> polygon (kind change)
{ const P = { W: 40 };
  const st = { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [W, 0] }, { kind: 'line', start: [W, 40] }, { kind: 'line', start: [0, 40] }] };
  console.log('E eval stored:', await ev(st, P));
  show('E line-only loop, unchanged finish', refinish(st, P));
  const stp = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [W, 0], [20, 10], [W, 40], [0, 40]] };
  console.log('E2 eval stored concave polygon:', await ev(stp, P));
  show('E2 concave polygon, unchanged finish', refinish(stp, P));
}
// F hole circle stored with start not at angle 0
{ const P = { Y: 15 }; const Y = { parameter: 'Y' };
  const st = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], holes: [[{ kind: 'arc', start: [25, Y], center: [25, 10], direction: 'ccw' }]] };
  console.log('F eval stored:', await ev(st, P));
  show('F hole arc start at 90deg bound, unchanged', refinish(st, P));
}
// G construction with Dims
{ const P = { W: 40 };
  const st = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], construction: [{ kind: 'circle', c: [W, 10], r: 3, construction: true }] };
  console.log('G eval stored:', await ev(st, P));
  const { done } = sketchShapes(st as any, P); show('G reopened construction', done);
  show('G unchanged finish (construction)', (() => { const { shape, done } = sketchShapes(st as any, P); const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as never, 'select'); return [s.shape, ...s.done].filter((x: any) => x.construction); })());
}
// H rectangle unnormalized stored min>max
{ const P = { W: 40 };
  const st = { kind: 'sketch', profile: 'rectangle', min: [W, 0], max: [0, 40] };
  console.log('H eval stored:', await ev(st, P));
  show('H min=[W,0] max=[0,40] unchanged finish', refinish(st, P));
}
// I zero / negative parameter values
{ const P = { N: -10, Z: 0 }; const N = { parameter: 'N' }, Z = { parameter: 'Z' };
  const st = { kind: 'sketch', profile: 'rectangle', min: [N, Z], max: [30, 40] };
  show('I negative/zero, unchanged', refinish(st, P));
  const st2 = { kind: 'sketch', profile: 'rectangle', min: [N, Z], max: [30, 40] };
  show('I2 user changes min y 0 -> 1e-10', refinish(st2, P, s => ({ ...s, shape: { ...s.shape, points: s.shape.points.map((p: any) => [p[0], p[1] === 0 ? 1e-10 : p[1]]) } })));
}
// J missing / non-finite
{ for (const P of [{}, { W: NaN }, { W: Infinity }, { W: '40' }]) { try { sketchShapes({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [W, 40] } as any, P as any); console.log('J', J(P), 'no throw'); } catch (e: any) { console.log('J', J(P), 'throws', e.code ?? '', e.message); } } }
// K parameter value changed while open: reopen at 40, finish with W=50
{ const st = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [W, 40] };
  const { shape, done } = sketchShapes(st as any, { W: 40 }); const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as never, 'select');
  const p: any = profileOf([s.shape]); const r: any = rebindDims(st as any, p.node, { W: 50 }); delete r.sideTags; show('K W 40->50 while open, finish', r);
  const r2: any = rebindDims(st as any, p.node, {}); delete r2.sideTags; show('K2 W deleted while open, finish', r2);
}
