import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryText } from '../src/app/recovery';
import { parameterUses, renameParameter } from '../src/ui/ParametersPanel';
import { meshInMM } from '@barocss/cad-model/engine/meshImport';
import type { ModelNode, StudioDoc } from '../src/engine/doc';

// PERF3 B13 (D82): what an edit writes out and copies, measured against the code it replaces (kept here as the reference).

test('B13 recovery copy: the same text as writing out the whole document, after edits too; a copy past the limit is not tried', () => {
  const mesh = { kind: 'mesh', name: 'm "quoted" ü', unit: 'mm', positions: Array.from({ length: 3000 }, (_, i) => i / 7), indices: Array.from({ length: 3000 }, (_, i) => i % 1000), skipped: undefined } as unknown as ModelNode;
  const sketch = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] } as unknown as ModelNode;
  const doc = { format: 'barocss-cad-model', version: 3, nodes: [mesh, sketch], parameters: { w: 10 }, note: 'a "nodes":[] inside a string', history: [{ nodes: [] }] } as unknown as StudioDoc;
  const whole = (d: StudioDoc, at = 5) => JSON.stringify({ fileName: 'Part ✓', savedAt: at, doc: d });
  assert.equal(recoveryText('Part ✓', 5, doc, Infinity), whole(doc));
  const edited = { ...doc, nodes: [mesh, { ...sketch, max: [12, 10] } as unknown as ModelNode] } as StudioDoc;
  assert.equal(recoveryText('Part ✓', 6, edited, Infinity), whole(edited, 6));
  assert.equal(recoveryText('Part ✓', 6, { ...edited, nodes: [] } as StudioDoc, Infinity), whole({ ...edited, nodes: [] } as StudioDoc, 6));
  // Past the limit: null (a node too long, or all of it together).
  assert.equal(recoveryText('Part ✓', 7, doc, 1000), null);
  assert.equal(recoveryText('Part ✓', 7, { ...doc, nodes: [sketch, sketch, sketch] } as StudioDoc, 150), null);
  assert.ok(recoveryText('Part ✓', 7, { ...doc, nodes: [sketch] } as StudioDoc, 1000));
});

// (The rename as it was: the whole node list written out and read back with a reviver.)
const renameBefore = (nodes: readonly ModelNode[], from: string, to: string | number): ModelNode[] =>
  JSON.parse(JSON.stringify(nodes), (_k, v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && v.parameter === from ? (typeof to === 'number' ? to : { parameter: to }) : v) as ModelNode[];
const usesBefore = (nodes: readonly ModelNode[], name: string) => nodes.filter(n => JSON.stringify(n).includes(`{"parameter":${JSON.stringify(name)}}`)).length;

test('B13 parameters: a rename copies only the nodes that use the parameter (the rest the same objects), with the result the round trip gave; the use count the same', () => {
  const big = { kind: 'mesh', name: 'm', unit: 'mm', positions: Array.from({ length: 30000 }, (_, i) => i), indices: [0, 1, 2] } as unknown as ModelNode;
  const nodes = [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'w' }, 10] },
    big,
    { kind: 'extrude', sketch: 0, height: { parameter: 'h' }, extra: { deep: [{ parameter: 'w' }, { parameter: 'w', other: 1 }] } },
    { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [5, 5], radius: { parameter: 'r' } },
  ] as unknown as ModelNode[];
  for (const [from, to] of [['w', 'width'], ['w', 12], ['h', 'height'], ['none', 'x']] as const) {
    const after = renameParameter(nodes, from, to);
    assert.deepEqual(after, renameBefore(nodes, from, to), `${from} → ${to}`);
    for (let i = 0; i < nodes.length; i++) if (usesBefore([nodes[i]], from) === 0) assert.equal(after[i], nodes[i], `node ${i} kept`);
  }
  assert.equal(renameParameter(nodes, 'w', 'x')[1], big);
  for (const name of ['w', 'h', 'r', 'none']) assert.equal(parameterUses(nodes, name), usesBefore(nodes, name), name);
});

// (The weld as it was: each corner keyed by its rounded coordinates as text.)
function weldBefore(mesh: { positions: ArrayLike<number>; indices: number[] | null; float32?: boolean }, k: number) {
  const P = mesh.positions, n = P.length / 3, positions: number[] = [], seen = new Map<string, number>(), remap: number[] = [];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) {
    const p = [0, 1, 2].map(a => mesh.float32 ? Math.fround(P[3 * v + a] * k) : P[3 * v + a] * k), key = p.map(x => Math.round(x * 1e6)).join(',');
    let i = seen.get(key); if (i === undefined) { i = positions.length / 3; positions.push(...p); seen.set(key, i); p.forEach((x, a) => { lo[a] = Math.min(lo[a], x); hi[a] = Math.max(hi[a], x); }); }
    remap.push(i);
  }
  const indices = mesh.indices ? mesh.indices.map(i => remap[i]) : remap;
  return { positions, indices, size: [0, 1, 2].map(a => Math.round((hi[a] - lo[a]) * 1000) / 1000) };
}

test('B13 opening a mesh: the weld gives the vertices and corners the text-keyed weld gave — repeated corners, near ones, −0, a NaN, single precision, other units', () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P: number[] = [];
  for (let t = 0; t < 3000; t++) for (let c = 0; c < 3; c++) {
    const r = rnd();
    // (Corners on a coarse grid repeat; some a hair apart, some at −0.)
    if (r < 0.6) P.push(Math.floor(rnd() * 20) * 0.5, Math.floor(rnd() * 20) * 0.5, Math.floor(rnd() * 20) * 0.5);
    else if (r < 0.8) P.push(3 + 4e-7 * rnd(), 2, 1);
    else if (r < 0.82) P.push(-0, 0, -0);
    else P.push(rnd() * 100, rnd() * 100 - 50, rnd() * 1e3);
  }
  P.push(NaN, 1, 2, NaN, 1, 2, 0, 0, 0);
  for (const [unit, k] of [['mm', 1], ['cm', 10], ['in', 25.4]] as const) for (const float32 of [false, true]) {
    const want = weldBefore({ positions: P, indices: null, float32 }, k), got = meshInMM({ positions: P, indices: null, float32 }, unit);
    assert.deepEqual(got, want, `${unit} ${float32}`);
  }
  const I = Array.from({ length: 300 }, (_, i) => (i * 7) % (P.length / 3));
  assert.deepEqual(meshInMM({ positions: P, indices: I }, 'mm'), weldBefore({ positions: P, indices: I }, 1));
});
