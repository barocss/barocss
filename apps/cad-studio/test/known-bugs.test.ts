import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// Known bugs, kept as repros (O81): each a `todo` test — it runs, reports, and does not fail the suite until it is fixed;
// then it passes and its `todo` comes off.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);

test('a hole on a boss\'s top after the boss was united into a shell cuts it (fixtures/hole-after-union.calls.json; for the kernel lane)', { todo: 'refused "misses the target" (O80)' }, async () => {
  const { calls } = JSON.parse(readFileSync(join(process.cwd(), 'test/fixtures/hole-after-union.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const c of calls) { const r = await dispatchTool(s, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); s = r.state; }
  const bore = s.bodies[0].mesh.faces.find(f => f.exact?.kind === 'cylinder' && Math.abs((f.exact as { r: number }).r - 1.25) < 1e-9);
  assert.ok(bore, 'the Ø2.5 bore');
});
