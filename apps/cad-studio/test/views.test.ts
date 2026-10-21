import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';

// Views for an agent (A2.3): one PNG sheet of exact line views with numbered faces, and its legend.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;

test('render_views: a 1000 × 1000 PNG of four views, faces numbered with a legend, highlight and section', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 20, y: 10 } }, evaluate)).state;
  const t = performance.now(), r = await runTool(s, 'render_views', { highlight: ['n1.top'] }, evaluate), ms = performance.now() - t;
  assert.ok(!r.isError, r.content);
  const out = parse(r.content), png = Buffer.from(r.images![0].data, 'base64');
  if (process.env.VIEWS_OUT) writeFileSync(process.env.VIEWS_OUT, png);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1000, 1000]);
  assert.ok(png.length < 200_000, `${png.length} bytes`);
  assert.ok(Object.values(out.legend).includes('n1.top'), JSON.stringify(out.legend));
  assert.ok(out.views.top.visible_faces.includes('n1.top') && !out.views.top.visible_faces.includes('n1.bottom'));
  assert.ok(out.views.iso.visible_faces.includes('n2.side0'), 'the bore shows in the isometric view');
  assert.ok(ms < 5000, `${ms} ms`);
  // The same again: from the cache.
  const t2 = performance.now(); await runTool(s, 'render_views', { highlight: ['n1.top'] }, evaluate); assert.ok(performance.now() - t2 < 50);
  const cut = await runTool(s, 'render_views', { section: { axis: 'y', at: 10 } }, evaluate);
  assert.ok(!cut.isError, cut.content);
  assert.ok(parse(cut.content).views.front.visible_faces.some((n: string) => n.includes('.cut')), JSON.stringify(parse(cut.content).views.front));
});
