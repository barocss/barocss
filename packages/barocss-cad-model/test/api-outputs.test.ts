// P1 milestone 3, cad-model's facade: a part's manufacturing inputs (process and pull, casting inputs, drawing settings,
// dimensions, bought, a body's name) and its outputs (the drawing and its files, the manufacturability report, the CAM package, the
// BOM and the purchase list). Each equals what the agent's own tools write or reply for the same calls; refusals keep
// the core's codes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { part, assembly, Location, BarocssError } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { runTool, type ChatState } from '../src/chat/tools';
import { bodiesOf } from '../src/api/core';
import { runDrawingTool } from '../src/chat/drawing';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 0);
const RULES = { name: 'casting-rules.json', text: readFileSync(join(import.meta.dirname, '../samples/rows/casting-rules.json'), 'utf8') };
/** The agent's tool on a document: its reply (content, parsed when JSON) and the document it leaves. */
async function agent(doc: StudioDoc, tool: string, args: Record<string, unknown>): Promise<{ doc: StudioDoc; content: unknown }> {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const s: ChatState = { doc, bodies: doc.nodes.length ? bodiesOf(doc) : [] }, r = await runTool(s, tool, args, evaluate);
    assert.ok(!r.isError, `${tool}: ${r.content}`);
    let content: unknown = r.content;
    try { content = JSON.parse(r.content); } catch { /* text */ }
    return { doc: r.state.doc, content };
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
}
// (A die-cast bracket: a block with a bored hole, its bore machined; and a turned pin.)
const bracket = () => part('bracket').box({ w: 40, d: 30, h: 12 }).hole(b => b.faces().facing('+z'), { d: 8, x: 20, y: 15 }).material('a356');
const pin = () => part('pin').cylinder({ r: 4, h: 30 }).material('steel');

test('process and casting: the Library panel\'s Process and Pull, and what set_casting writes', async () => {
  const p = bracket().process('die-casting', { pull: [0, 0, 1] });
  assert.equal(p.doc.process, 'die-casting');
  assert.deepEqual(p.doc.mould, { version: 1, pull: [0, 0, 1] });
  const o = { machined: ['n2.side0', 'n1.bottom'], allowance: 1.5, shrink: 0.006, gate: [0, 15, 6] as [number, number, number] };
  const cast = p.casting(o), tool = await agent(p.doc, 'set_casting', o);
  assert.equal(JSON.stringify(cast.doc), JSON.stringify(tool.doc));
  assert.equal(p.process(null).doc.process, undefined);
  assert.throws(() => p.process('forging'), e => e instanceof BarocssError && e.code === 'VALUE');
  assert.throws(() => p.process('die-casting', { pull: [1, 1, 0] }), e => e instanceof BarocssError && e.code === 'VALUE');
  assert.throws(() => p.casting({ machined: ['n9.top'] }), e => e instanceof BarocssError && e.code === 'CASTING_FACE');
  assert.throws(() => p.casting({ shrink: 0.5 }), e => e instanceof BarocssError && e.code === 'CASTING_SHRINK');
});

// (A drawing change is the person's to approve on the agent's side — proposed, then applied: the tool's own write is
// what applying it runs, runDrawingTool.)
const drawn = (doc: StudioDoc, tool: string, args: Record<string, unknown>): StudioDoc => { const r = runDrawingTool(doc, tool, args); assert.ok(!('error' in r), JSON.stringify(r)); return (r as { doc: StudioDoc }).doc; };
test('the drawing: set_drawing and auto_dimension write what the tools write; its issues are drawing_issues\' reply, its files SVG, DXF and PDF', async () => {
  const p = pin().process('cnc-turning').drawingSettings({ title: 'pin', sheet: 'A4' }).autoDimension();
  const doc = drawn(drawn(pin().process('cnc-turning').doc, 'set_drawing', { title: 'pin', sheet: 'A4' }), 'auto_dimension', {});
  assert.equal(JSON.stringify(p.doc.drawing), JSON.stringify(doc.drawing));
  const d = p.drawing(), issues = (await agent(p.doc, 'drawing_issues', {})).content as { sheet: unknown; issues: unknown[] };
  assert.deepEqual({ sheet: d.sheet, issues: d.issues }, issues);
  assert.ok((d.sheet.dimensions as string[]).length > 0);
  assert.match(d.svg, /^<\?xml[^]*<svg[^]*<title>pin<\/title>/);
  assert.match(d.dxf, /SECTION[^]*ENTITIES/);
  assert.equal(new TextDecoder().decode(d.pdf.slice(0, 5)), '%PDF-');
  assert.throws(() => p.drawingSettings({ sheet: 'B5' as 'A4' }), e => e instanceof BarocssError);
});

test('manufacturability: check_printability\'s report; the CAM package: output_cam_package\'s refusal, its code kept', async () => {
  const cast = bracket().loadRows('casting-rules', RULES).process('die-casting', { pull: [0, 0, 1] }).casting({ machined: ['n2.side0'], gate: [0, 15, 6] });
  const r = await cast.manufacturability(), tool = (await agent(cast.doc, 'check_printability', {})).content;
  assert.deepEqual(JSON.parse(JSON.stringify(r)), tool);
  assert.equal(r.process, 'die-casting');
  assert.ok(r.rules.some(x => x.id === 'draft'));
  // (No stock is built in: without a person's stock list the package is refused, typed.)
  await assert.rejects(pin().process('cnc-turning').camPackage(), e => e instanceof BarocssError && e.code === 'STOCK_NONE_LOADED');
});

test('the BOM and the purchase list: output_bom\'s and output_purchase_csv\'s replies; a bought spring listed bought; a body named', async () => {
  const spring = part('spring').spring({ type: 'compression', d: 1, D: 8, n: 4, p: 3, ends: 'closed-ground', hand: 'right', x: 0, y: 0, z: 0 }).material('steel').bought();
  const a = assembly('kit', bracket().named('bracket')).addPart('pin', pin(), { at: Location.at([60, 0, 0]) }).addPart('spring', spring, { at: Location.at([0, 60, 0]) });
  const bom = await a.bom(), tool = (await agent(a.doc, 'output_bom', {})).content as Record<string, unknown>;
  assert.deepEqual(JSON.parse(JSON.stringify(bom.bom)), tool.bom);
  // (The studio's Rename on the base part's body: its look's name. The BOM names the base's own bodies by key still — PG-10.)
  assert.deepEqual(Object.values(a.doc.bodies ?? {}).map(b => b.name), ['bracket']);
  const csv = await a.purchaseCsv(), text = ((csv.files as { text: string }[])[0]).text;
  assert.equal(text, (((await agent(a.doc, 'output_purchase_csv', {})).content as { files: { text: string }[] }).files[0].text));
  assert.match(text, /spring/);
  assert.doesNotMatch(text, /bracket/);
  assert.throws(() => spring.bought(true, ['n99']), e => e instanceof BarocssError && e.code === 'FEATURE_UNKNOWN');
});
