// P3: parameters, construction ids, mismatched sideTags, every NodeExtras field, an outside (region) circle, regions.
import { part, sketch, evaluateDoc, editFields, outlineFields, dimensioned, nodeOf, poly, sketchShapes, type SketchNode, type StudioDoc, type ModelNode, type SketchShape } from './common';

const RECT: [number, number][] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const log = (...a: unknown[]) => console.log(...a.map(x => typeof x === 'string' ? x : JSON.stringify(x)));

// (a) Parameters: bind an outline dimension; get/set through the parameter-aware wrapper.
{
  const main = dimensioned(RECT, [['len0', 60], ['len1', 30]]);
  const node = { ...nodeOf([main]), id: 'n0' } as ModelNode;
  const nodes: ModelNode[] = [node, { kind: 'extrude', sketch: 0, height: 5, id: 'n1' } as ModelNode];
  const params = { w: 70, h: 30 };
  const f = editFields(nodes, 1, params).find(x => x.key === 'olen0') as unknown as { get: Function; set: Function; param: Function; bind: Function };
  log('(a) get', f.get(nodes), 'param', f.param(nodes), 'set 65 ->', ((f.set(nodes, 65)[0]) as SketchNode).outline?.lengths);
  log('(a) bind w ->', f.bind(nodes, 'w') === null ? 'null (refused)' : 'bound', ' bind h (same value as len1? no, olen0=60) ->', f.bind(nodes, 'h') === null ? 'null' : 'bound');
  const f1 = editFields(nodes, 1, params).find(x => x.key === 'olen1') as unknown as { bind: Function };
  log('(a) olen1 bind h (already 30) ->', f1.bind(nodes, 'h') === null ? 'null (refused)' : JSON.stringify(f1.bind(nodes, 'h')[0]).slice(0, 200));
}

// (b) Construction shapes with ids colliding with loop ids; and a construction shape with no ids.
{
  const main = dimensioned(RECT, [['len0', 60], ['len1', 30]]);
  const c1 = { kind: 'polygon', points: [[-5, -5], [70, -5]], closed: false, construction: true, ids: ['e1'] } as unknown as SketchShape;
  const c2 = { kind: 'circle', c: [30, 15], r: 40, construction: true } as unknown as SketchShape;
  const node = { ...nodeOf([main, poly([[10, 10], [20, 10], [20, 20], [10, 20]])]), id: 'n0', construction: [c1, c2] } as unknown as SketchNode;
  const nodes: ModelNode[] = [node as ModelNode];
  const next = (outlineFields(nodes, 0, '').find(x => x.key === 'olen0') as { set: Function }).set(nodes, 64)[0] as SketchNode;
  log('(b) sideTags before', node.sideTags, 'after', next.sideTags, 'construction same', JSON.stringify(next.construction) === JSON.stringify(node.construction), 'holes', next.holes?.length, 'regions', next.regions?.length ?? 0);
}

// (c) sideTags whose outer length does not match the loop (corrupt / older shape): what comes out.
{
  const main = dimensioned(RECT, [['len0', 60], ['len1', 30]]);
  const node = { ...nodeOf([main, poly([[10, 10], [20, 10], [20, 20], [10, 20]])]), id: 'n0' } as SketchNode;
  const bad = { ...node, sideTags: { ...node.sideTags!, outer: ['e1', 'e2', 'e3'] } } as SketchNode;
  const nodes: ModelNode[] = [bad as ModelNode];
  const next = (outlineFields(nodes, 0, '').find(x => x.key === 'olen0') as { set: Function }).set(nodes, 64)[0] as SketchNode;
  log('(c) mismatched outer tags', bad.sideTags, '->', next.sideTags);
}

// (d) Every NodeExtras field + plane/on/construction survive; nothing else leaks from the old node.
{
  const main = dimensioned(RECT, [['len0', 60], ['len1', 30]]);
  const extras = { id: 'n7', suppressed: true, rematched: { 'n7.side[e1]': 'n7.side[e9]' }, sigs: { x: { kind: 'face' } }, held: 'because', bought: false };
  const node = { ...nodeOf([main]), ...extras, on: { node: 0, side: 'solid' }, plane: { origin: [0, 0, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] }, association: { kind: 'planar-face-outline-inset', version: 1, source: { node: 0, side: 'solid' }, sourceFeature: 'n0', face: 'n0.top', insetMM: 2 } } as unknown as SketchNode;
  const nodes: ModelNode[] = [node as ModelNode];
  const next = (outlineFields(nodes, 0, '').find(x => x.key === 'olen0') as { set: Function }).set(nodes, 64)[0] as Record<string, unknown>;
  const kept = Object.keys(node).filter(k => JSON.stringify((node as unknown as Record<string, unknown>)[k]) === JSON.stringify(next[k]));
  const lost = Object.keys(node).filter(k => !(k in next));
  log('(d) keys kept identical:', kept, ' keys lost:', lost, ' new keys:', Object.keys(next).filter(k => !(k in node)));
}

// (e) A circle attached to the outline but OUTSIDE it (a region), plus a separately drawn region drawn first.
{
  const main = dimensioned(RECT, [['len0', 60], ['len1', 30]], { circles: [{ c: [80, 15], r: 4 }] });
  const other = poly([[-30, 0], [-10, 0], [-10, 10], [-30, 10]]);
  const node = { ...nodeOf([other, main]), id: 'n0' } as SketchNode;
  const kinds = (n: SketchNode) => (n.regions ?? []).map(l => l.length === 1 ? 'circle' : `poly${l.length}`);
  log('(e) main profile', node.profile, 'outer tags', node.sideTags?.outer, 'regions', kinds(node), node.sideTags?.regions);
  const nodes: ModelNode[] = [node as ModelNode];
  const f = outlineFields(nodes, 0, '').find(x => x.key === 'olen0') as { set: Function } | undefined;
  if (!f) log('(e) no olen0 field — main is not the outline:', node.outline ? 'has outline' : 'no outline');
  else { const next = f.set(nodes, 64)[0] as SketchNode; log('(e) after: regions', kinds(next), next.sideTags?.regions); }
}
