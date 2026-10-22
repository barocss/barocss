import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// A9-2: the manufacturability report, the print orientation and the brief are a part's own. With `part` they run on
// that placed part's document: A9's probe had p1's report name the base frame's steel and its member b0_part0, and a
// brief meant for p1 written on the base. A brief stating a process with no rules here is not judged by the studio's
// Process left from an earlier brief.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
let s: ChatState;
async function call(tool: string, args: Record<string, unknown>) {
  const r = await dispatchTool(s, tool, args, evaluate);
  assert.ok(!r.isError, `${tool}: ${r.content}`);
  s = r.state;
  return JSON.parse(r.content) as Record<string, unknown>;
}
const stated = (value: string) => ({ value, basis: 'stated', source: 'the test' });

test('A9-2: a brief and a report per part — p1 milled, the base printed; each judged by its own process; the base\'s brief untouched by p1\'s', async () => {
  s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  await call('features', { action: 'command', command: 'box', values: { w: 40, d: 30, h: 10, x: 0, y: 0, z: 0 } });
  await call('assembly', { action: 'add_part', name: 'Plate', position: [0, 0, 10] });
  await call('features', { action: 'command', part: 'p1', command: 'box', values: { w: 60, d: 40, h: 12, x: 0, y: 0, z: 0 } });
  const b1 = await call('requirements', { action: 'brief', part: 'p1', fields: { process: stated('cnc-milling'), material: stated('al6061') } });
  assert.deepEqual([b1.part, b1.process_set], ['p1', 'cnc-milling']);
  const p1 = s.doc.instances!.find(i => i.id === 'p1')!.doc;
  assert.deepEqual([p1.process, p1.brief?.process?.value, s.doc.brief, s.doc.process], ['cnc-milling', 'cnc-milling', undefined, undefined], 'on p1 only');
  await call('requirements', { action: 'brief', fields: { process: stated('fdm') } });
  const m1 = await call('query', { action: 'manufacturability', part: 'p1' }), m0 = await call('query', { action: 'manufacturability' });
  assert.deepEqual([m1.part, m1.process, m0.process], ['p1', 'cnc-milling', 'fdm']);
  // (p1's report on p1's body: its 60 × 40 × 12 box, not the base's 40 × 30 × 10.)
  const size = (m: Record<string, unknown>) => JSON.stringify((m.rules as { id: string }[]).find(r => r.id === 'size') ?? null);
  assert.match(size(m1), /60/, size(m1));
  const g = await call('requirements', { action: 'gaps', part: 'p1' });
  assert.equal((g.brief as { process: { value: string } }).process.value, 'cnc-milling');
  // (The print orientation is the part's: a printed p2's set, the base's not; the milled p1 refused, as the base would be.)
  await call('assembly', { action: 'add_part', name: 'Cover', position: [0, 0, 30] });
  await call('features', { action: 'command', part: 'p2', command: 'box', values: { w: 30, d: 30, h: 4, x: 0, y: 0, z: 0 } });
  await call('requirements', { action: 'brief', part: 'p2', fields: { process: stated('fdm') } });
  await call('print', { action: 'orient', part: 'p2' });
  assert.ok(s.doc.instances!.find(i => i.id === 'p2')!.doc.print && !s.doc.print);
  const milled = await dispatchTool(s, 'print', { action: 'orient', part: 'p1' }, evaluate);
  assert.ok(milled.isError && /"part":"p1".*CNC milling is not printing/.test(milled.content), milled.content);
  const none = await dispatchTool(s, 'query', { action: 'manufacturability', part: 'p9' }, evaluate);
  assert.ok(none.isError && JSON.parse(none.content).error === 'No part "p9"; parts: base, p1, p2.', none.content);
});

test('A9-2: a brief stating a process with no rules (sheet-metal) after an applied one (fdm) — the report says so, not fdm\'s rules', async () => {
  s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  await call('features', { action: 'command', command: 'box', values: { w: 40, d: 30, h: 10, x: 0, y: 0, z: 0 } });
  await call('requirements', { action: 'brief', fields: { process: stated('fdm') } });
  assert.equal(s.doc.process, 'fdm');
  await call('requirements', { action: 'brief', fields: { process: stated('sheet-metal') } });
  const m = await call('query', { action: 'manufacturability' }), rules = m.rules as { status: string; why: string }[];
  assert.equal(m.process, 'sheet-metal');
  assert.ok(rules.every(r => r.status === 'unknown' && r.why === 'the brief\'s process, sheet-metal, has no rules here yet: the studio\'s Process (fdm) is not judged in its place'), JSON.stringify(rules[0]));
});
