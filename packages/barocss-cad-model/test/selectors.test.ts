import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { resolveEdge, resolveFace } from '../src/chat/names';
import { readStudioDoc } from '../src/engine/migrate';

// Selectors (A1.2): a face or edge said by what it is, resolved to its persistent name.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const box = (doc: StudioDoc, x: number, w: number, h: number) => withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + w, w] }), { kind: 'extrude', sketch: doc.nodes.length, height: h });

test('selectors: a feature’s face by role, the flat face facing a direction, the edge two faces share', async () => {
  const s = await stateOf(rectanglePart(40, 20, 8)), { nodes } = s.doc;
  assert.deepEqual(resolveFace(nodes, s.bodies, { feature: 1, role: 'top' }), ['n1.top']);
  assert.deepEqual(resolveFace(nodes, s.bodies, { feature: 'n1', role: 'bottom' }), ['n1.bottom']);
  assert.match(resolveFace(nodes, s.bodies, { feature: 1, role: 'side' }) as string, /fits 4 faces: n1\.side\d, n1\.side\d, n1\.side\d, n1\.side\d; name one/);
  assert.equal((resolveFace(nodes, s.bodies, { feature: 1, role: 'side', all: true }) as string[]).length, 4);
  assert.deepEqual(resolveFace(nodes, s.bodies, { normal: [0, 0, 1] }), ['n1.top']);
  assert.deepEqual(resolveFace(nodes, s.bodies, { normal: [0, 0, -2] }), ['n1.bottom']);
  const east = resolveFace(nodes, s.bodies, { normal: [1, 0, 0] }) as string[];
  assert.equal(east.length, 1);
  const f = s.bodies[0].mesh.faces.find(x => x.name === east[0])!;
  assert.ok(Math.abs(f.centroid[0] - 40) < 1e-9, 'the face at x = 40');
  const edge = resolveEdge(nodes, s.bodies, { between: [{ feature: 1, role: 'top' }, { normal: [1, 0, 0] }] }) as string[];
  assert.deepEqual(edge, [[east[0], 'n1.top'].sort().join('|')]);
  // Refusals say why and what there is.
  assert.match(resolveFace(nodes, s.bodies, { feature: 7, role: 'top' }) as string, /no feature 7/);
  assert.match(resolveFace(nodes, s.bodies, { feature: 1, role: 'cap' }) as string, /feature n1 has no face "cap" \(its faces: /);
  assert.match(resolveFace(nodes, s.bodies, { normal: [1, 1, 0] }) as string, /no flat face faces/);
  assert.match(resolveEdge(nodes, s.bodies, { between: [{ normal: [0, 0, 1] }, { normal: [0, 0, -1] }] }) as string, /share no edge/);
});

test('selectors: the same direction on two bodies is refused with both, narrowed by "on"', async () => {
  const s = await stateOf(box(box(emptyDoc(), 0, 10, 5), 20, 10, 5)), { nodes } = s.doc;
  assert.match(resolveFace(nodes, s.bodies, { normal: [0, 0, 1] }) as string, /fits 2 faces: n1\.top, n3\.top/);
  assert.deepEqual(resolveFace(nodes, s.bodies, { normal: [0, 0, 1], on: 'b3' }), ['n3.top']);
  assert.match(resolveFace(nodes, s.bodies, { normal: [0, 0, 1], on: 'b9' }) as string, /no body b9/);
});

test('selectors in the tools: a fillet on edges said by their faces, a measure between faces said by direction; each reports its name', async () => {
  const s = await stateOf(rectanglePart(40, 20, 8));
  let r = await runTool(s, 'run_command', { command: 'fillet', edges: [{ between: [{ feature: 1, role: 'top' }, { normal: [1, 0, 0] }] }], values: { radius: 2 } }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = parse(r.content);
  assert.deepEqual(out.resolved.map((x: { names: string[] }) => x.names.length), [1]);
  assert.ok(Math.abs(r.state.bodies[0].volume! - (40 * 20 * 8 - (4 - Math.PI) * 20)) < 1e-3);
  r = await runTool(s, 'measure', { a: { feature: 1, role: 'top' }, b: { normal: [0, 0, -1] } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(parse(r.content).normal_distance, 8); assert.deepEqual(parse(r.content).resolved.map((x: { names: string[] }) => x.names[0]), ['n1.top', 'n1.bottom']);
  r = await runTool(s, 'select', { faces: [{ feature: 1, role: 'side', all: true }] }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal(parse(r.content).selected.faces.length, 4);
  r = await runTool(s, 'run_command', { command: 'fillet', edges: [{ between: [{ feature: 1, role: 'side' }, { feature: 1, role: 'top' }] }], values: { radius: 1 } }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /fits 4 faces/);
});

// The selector conformance cases (conformance/a1, those with "selectors").
const a1 = join(resolve(import.meta.dirname, '..'), 'conformance', 'a1');
for (const file of readdirSync(a1).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a1, file), 'utf8'));
  if (!c.input.selectors) continue;
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const s = await stateOf(read.doc);
    for (const x of c.input.selectors) {
      const r = x.face ? resolveFace(s.doc.nodes, s.bodies, x.face) : resolveEdge(s.doc.nodes, s.bodies, x.edge);
      if (x.error) { assert.equal(typeof r, 'string', JSON.stringify(x)); assert.ok((r as string).includes(x.error), `${r} ⊅ ${x.error}`); }
      else assert.deepEqual(r, x.names, JSON.stringify(x));
    }
  });
}
