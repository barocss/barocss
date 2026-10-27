import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// A body's surface area from the kernel's exact surfaces (as mass properties integrate them), not the display mesh's
// triangles: a cylinder r 10 × 20 is 600π, a box 40 × 30 × 10 is 3800, the D84 pipe clamp its conformance value
// 11 019.522 (the mesh's sum reads about 0.11 % low there); mass_properties reports the same, labelled when a fallback.

const root = resolve(import.meta.dirname, '..'), evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const meshSum = (b: { mesh: { faces: { area: number }[] } }) => b.mesh.faces.reduce((t, f) => t + f.area, 0);
const extrude = (sketch: object, h: number) => withNode(withNode(emptyDoc(), sketch as never), { kind: 'extrude', sketch: 0, height: h } as never);

test('surface area exact: a cylinder r 10 × 20 — 600π to 1e-9, the mesh\'s sum below it; a box 40 × 30 × 10 — 3800; mass_properties the same', async () => {
  for (const [doc, want, curved] of [[extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, 20), 600 * Math.PI, true], [extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, 10), 3800, false]] as const) {
    const r = await evaluate(doc); assert.ok(r.ok); const b = r.bodies[0];
    assert.equal(b.areaBasis, 'exact'); assert.ok(Math.abs(b.area! - want) <= 1e-9 * want, `${b.area} vs ${want}`);
    if (curved) assert.ok(meshSum(b) < want - 1e-6, 'the mesh reads low on the curve');
    const m = JSON.parse((await dispatchTool({ doc, bodies: r.bodies } as ChatState, 'mass_properties', {}, evaluate)).content);
    assert.ok(Math.abs(m.bodies[0].area - Math.round(want * 1000) / 1000) <= 1e-3, JSON.stringify(m.bodies[0])); assert.equal(m.bodies[0].area_basis, undefined);
  }
});

test('surface area exact: the D84 pipe clamp — its conformance area 11 019.522 within 1e-4, where the display mesh\'s triangles read about 0.11 % low', async () => {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures/subd-pipe-clamp.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of calls) { const r = await dispatchTool(s, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); s = r.state; }
  const b = s.bodies[0];
  assert.equal(b.areaBasis, 'exact'); assert.ok(Math.abs(b.area! / 11019.522 - 1) <= 1e-4, String(b.area));
  assert.ok(meshSum(b) / 11019.522 < 1 - 5e-4, `the mesh ${meshSum(b)}`);
});
