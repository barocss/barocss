import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// Known bugs, kept as repros (O81): each a `todo` test — it runs, reports, and does not fail the suite until it is fixed;
// then it passes and its `todo` comes off.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);

// (Fixed, D148: the hole's depth now from the picked face's plane — the kernel's `hole` takes the face by name.)
test('a hole on a boss\'s top after the boss was united into a shell cuts it (fixtures/hole-after-union.calls.json; fixed in D148)', async () => {
  const { calls } = JSON.parse(readFileSync(join(resolve(import.meta.dirname, '..'), 'test/fixtures/hole-after-union.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const c of calls) { const r = await dispatchTool(s, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); s = r.state; }
  const bore = s.bodies[0].mesh.faces.find(f => f.exact?.kind === 'cylinder' && Math.abs((f.exact as { r: number }).r - 1.25) < 1e-9);
  assert.ok(bore, 'the Ø2.5 bore');
  // Coaxial with the boss (its centre at (15, 20)), 10 deep from the boss's top at z 14: the material taken π·1.25²·10.
  const c = (bore!.exact as { c: number[] }).c; assert.ok(Math.abs(c[0] - 15) < 1e-9 && Math.abs(c[1] - 20) < 1e-9, JSON.stringify(c));
  const before = await evaluate({ ...s.doc, nodes: s.doc.nodes.slice(0, -1) }), v0 = before.ok ? before.bodies[0].volumeMM3! : NaN, v1 = s.bodies[0].volumeMM3!;
  assert.ok(Math.abs(v0 - v1 - Math.PI * 1.25 ** 2 * 10) <= 1e-6 * v0, `${v0 - v1} vs ${Math.PI * 1.25 ** 2 * 10}`);
});
