import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';

// Observation (A2.1): facts after every change, what changed, and a face's or edge's detail on request.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;

test('facts after a change: solids, volume, mass, centroid, box, counts, and what changed', async () => {
  const s = await stateOf(rectanglePart(40, 20, 8));
  const summary = parse((await runTool(s, 'get_part_summary', {}, evaluate)).content).facts;
  assert.deepEqual(summary, { built: true, solids: 1, volume_mm3: 6400, mass_g: 17.28, centroid: [20, 10, 4], materials: [{ body: 'b1', material: 'Aluminium 6061', assumed: true }], mass_assumed: true, bbox: { min: [0, 0, 0], max: [40, 20, 8] }, faces: 6, edges: 12, vertices: 8 });
  const r = await runTool(s, 'run_command', { command: 'hole', faces: [{ feature: 1, role: 'top' }], values: { d: 8, x: 20, y: 10 } }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = parse(r.content), hole = Math.PI * 16 * 8;
  assert.ok(Math.abs(out.facts.volume_mm3 - (6400 - hole)) < 1e-3);
  assert.ok(Math.abs(out.change.volume_mm3 + hole) < 2e-3, JSON.stringify(out.change));
  assert.equal(out.change.faces, 1, 'the bore'); assert.equal(out.change.bbox, undefined, 'the box is the same');
  assert.ok(out.change.edges > 0);
});

test('inspect: a face with its neighbours and maker, a round face with its axis, an edge with its faces', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 20, y: 10 } }, evaluate)).state;
  const r = parse((await runTool(s, 'inspect', { faces: [{ feature: 1, role: 'top' }, { feature: 2, role: 'side0' }], edges: [{ between: [{ feature: 1, role: 'top' }, { normal: [1, 0, 0] }] }] }, evaluate)).content);
  const [top, bore] = r.faces, [edge] = r.edges;
  assert.deepEqual([top.kind, top.normal, top.made_by], ['plane', [0, 0, 1], '1: Extrude 8']);
  assert.ok(top.adjacent.includes('n2.side0') && top.adjacent.length === 5, JSON.stringify(top.adjacent));
  assert.deepEqual([bore.kind, bore.radius, bore.axis.direction.map(Math.abs)], ['curved', 4, [0, 0, 1]]);
  assert.ok(bore.made_by.startsWith('2: '));
  assert.deepEqual([edge.line, edge.chord_mm, edge.faces.length], ['along y', 20, 2]);
});

// The A2 conformance cases (conformance/a2): a document, one tool call, and the facts before and after.
const a2 = join(process.cwd(), 'conformance', 'a2');
for (const file of readdirSync(a2).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a2, file), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const s = await stateOf(read.doc), before = parse((await runTool(s, 'get_part_summary', {}, evaluate)).content).facts;
    const r = await runTool(s, c.input.call.tool, c.input.call.args, evaluate); assert.ok(!r.isError, r.content);
    const out = parse(r.content), near = (a: unknown, b: unknown): boolean => Array.isArray(b) ? (b as unknown[]).every((x, k) => near((a as unknown[])[k], x)) : Math.abs((a as number) - (b as number)) <= c.expect.tolerance;
    for (const [k, v] of Object.entries(c.expect.before)) assert.ok(near(before[k], v), `before ${k}: ${before[k]} vs ${v}`);
    for (const [k, v] of Object.entries(c.expect.after)) assert.ok(near(out.facts[k], v), `after ${k}: ${out.facts[k]} vs ${v}`);
    for (const [k, v] of Object.entries(c.expect.change)) assert.ok(near(out.change[k], v), `change ${k}: ${out.change[k]} vs ${v}`);
  });
}

test('response format: concise keeps facts and change only; detailed lists every body; a body\'s faces and edges come in pages', async () => {
  const s = await stateOf(rectanglePart(80, 40, 8));
  let r = parse((await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 4, x: 10, y: 10 }, response_format: 'concise' }, evaluate)).content);
  assert.equal(r.bodies, undefined); assert.ok(r.facts && r.change);
  r = parse((await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 4, x: 10, y: 10 }, response_format: 'detailed' }, evaluate)).content);
  assert.ok(r.bodies[0].faces.length > 0);
  // A plate with a row of 30 holes: over 60 faces, listed a page at a time.
  let doc = s.doc;
  for (let k = 0; k < 30; k++) doc = withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, center: [4 + 2.4 * k, 20], radius: 0.5 });
  const big = await stateOf(doc), key = big.bodies[0].key;
  const p1 = parse((await runTool(big, 'get_part_summary', { body: key }, evaluate)).content).bodies[0];
  const p2 = parse((await runTool(big, 'get_part_summary', { body: key, page: 2 }, evaluate)).content).bodies[0];
  assert.deepEqual([p1.page.page, p2.page.page, p1.page.pages >= 2], [1, 2, true]);
  assert.notDeepEqual(p1.faces.map((f: { name: string }) => f.name), p2.faces.map((f: { name: string }) => f.name));
  const concise = parse((await runTool(big, 'get_part_summary', { response_format: 'concise' }, evaluate)).content);
  assert.equal(concise.bodies[0].faces, undefined); assert.deepEqual(Object.keys(concise.features[0]), ['index', 'label']);
});
