import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { withLook } from '../src/app/bodies';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline } from '../src/team/baseline';
import { userToken } from '../src/team/ecr';
import { boxCage } from '../src/app/primitives';
import { dispatchTool, TOOLS, type ChatState } from '../src/chat/tools';
import { annotationsOf, breakingChanges, outputSchemaOf, validate, type ContractEntry, type JsonSchema } from '../src/chat/contract';

// A5.1 (O9): the tool layer's contract. Every handler classified; the breaking-change rules (the v2 list is frozen by
// them in tools-v2.json, toolset.test.ts); every read handler's result matching its output schema; the MCP server
// listing the v2 tools and returning them. (O105: the handlers' own list, v1, and its tools-v1.json are gone.)

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);

test('every handler is classified, nothing reaches outside the document, read handlers change nothing', () => {
  for (const t of TOOLS) {
    const a = annotationsOf(t.name);
    assert.equal(a.openWorldHint, false, t.name);
    if (a.readOnlyHint) assert.ok(!a.destructiveHint && a.idempotentHint, t.name);
  }
  assert.throws(() => annotationsOf('a_new_tool'), /does not classify/);
  // The read tools are exactly those the dispatcher never reports as changing the document (spot-checked by running them below).
  assert.deepEqual(TOOLS.filter(t => annotationsOf(t.name).readOnlyHint && !outputSchemaOf(t.name)).map(t => t.name), ['get_image_layers'], 'a read tool without a fixed result shape');
});

test('the breaking-change rules: removals and narrowing break, additions do not', () => {
  const base: ContractEntry[] = [{ name: 't', annotations: { title: 'T', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, input: { type: 'object', properties: { a: { type: 'string', enum: ['x', 'y'] } }, required: [] }, output: { type: 'object', properties: { r: { type: 'number' } }, required: ['r'] } }];
  const edit = (f: (e: ContractEntry) => void) => { const c = JSON.parse(JSON.stringify(base)); f(c[0]); return breakingChanges(base, c); };
  assert.deepEqual(breakingChanges(base, []), ['t: removed']);
  assert.match(edit(e => { (e.input as JsonSchema).properties!.a.enum = ['x']; }).join(), /enum narrowed/);
  assert.match(edit(e => { (e.input as JsonSchema).required = ['a']; }).join(), /newly required/);
  assert.match(edit(e => { delete (e.input as JsonSchema).properties!.a; }).join(), /a: removed/);
  assert.match(edit(e => { (e.output as JsonSchema).required = []; }).join(), /no longer required/);
  assert.match(edit(e => { e.annotations.readOnlyHint = false; }).join(), /no longer read only/);
  assert.deepEqual(edit(e => { (e.input as JsonSchema).properties!.b = { type: 'number' }; (e.input as JsonSchema).properties!.a.enum!.push('z'); (e.output as JsonSchema).properties!.q = { type: 'string' }; }), [], 'additions are compatible');
});

test('every read tool’s result matches its output schema and changes nothing', async () => {
  let doc: StudioDoc = { ...starterDoc(), requirements: [{ id: 'R1', source: '64 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 64, tol: 0.1 } }] } as StudioDoc;
  const r = await evaluate(doc); assert.ok(r.ok);
  let s: ChatState = { doc, bodies: r.bodies };
  const calls: [string, object][] = [['get_part_summary', {}], ['measure', { a: 'n1.top' }], ['measure', { a: 'n1.top', b: 'n1.bottom' }], ['mass_properties', {}], ['interference', {}], ['section', { axis: 'z', at: 4 }], ['wall_thickness', {}], ['draft', {}], ['check_spec', {}], ['diff', {}], ['list_proposals', {}], ['inspect', { faces: ['n1.top'] }], ['select', { faces: ['n1.top'] }], ['checkpoint', { name: 'a' }], ['drawing_issues', {}], ['tolerance_suggestions', {}], ['get_assembly', {}], ['list_library', {}], ['check_printability', {}], ['render_views', {}], ['get_joints', {}], ['forward_kinematics', {}], ['link_inertia', {}], ['export_urdf', {}], ['export_mjcf', {}], ['sweep_path', { to: {} }], ['gravity_torques', {}], ['motion_torques', { to: {}, profile: 'trapezoid' }], ['size_actuators', { to: {}, profile: 'trapezoid' }], ['get_brief', {}], ['get_references', {}], ['get_drafts', {}], ['standards_lookup', {}], ['standards_lookup', { table: 'fasteners-metric-coarse', row: 'M6', field: 'tap' }]];
  const seen = new Set<string>();
  for (const [name, args] of calls) {
    const out = await dispatchTool(s, name, args, evaluate);
    assert.ok(!out.isError, `${name}: ${out.content.slice(0, 200)}`);
    assert.equal(out.changed, false, `${name} changes nothing`); assert.equal(out.state.doc, s.doc, `${name}: the document as it was`);
    assert.deepEqual(validate(outputSchemaOf(name)!, JSON.parse(out.content)), [], name);
    if (name === 'checkpoint') s = out.state;
    seen.add(name);
  }
  doc = withNode(starterDoc(), { kind: 'subd', cage: boxCage(20, 20, 20, 1, [0, 0, 0]) } as never);
  const r2 = await evaluate(doc); assert.ok(r2.ok);
  for (const [name, args] of [['subd_cage', { index: 3 }], ['subd_select', { index: 3, what: 'faces', normal: [0, 0, 1] }]] as const) {
    const out = await dispatchTool({ doc, bodies: r2.bodies }, name, args, evaluate);
    assert.ok(!out.isError, out.content); assert.deepEqual(validate(outputSchemaOf(name)!, JSON.parse(out.content)), [], name); seen.add(name);
  }
  // (A frame's cut list, FR4a: on a two-member frame.)
  const fr = withNode(starterDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } } as never);
  const r3 = await evaluate(fr); assert.ok(r3.ok);
  const cl = await dispatchTool({ doc: fr, bodies: r3.bodies }, 'cut_list', {}, evaluate);
  assert.ok(!cl.isError && !cl.changed, cl.content); assert.deepEqual(validate(outputSchemaOf('cut_list')!, JSON.parse(cl.content)), [], 'cut_list'); seen.add('cut_list');
  // (Its welds, FRd1: the L's one mitre.)
  const wl = await dispatchTool({ doc: fr, bodies: r3.bodies }, 'weld_list', {}, evaluate);
  assert.ok(!wl.isError && !wl.changed, wl.content); assert.deepEqual(validate(outputSchemaOf('weld_list')!, JSON.parse(wl.content)), [], 'weld_list'); seen.add('weld_list');
  // (A hole–shaft fit, D155: two classes at a size from a test table.)
  const fitted = { ...fr, fits: { version: 1 as const, tables: [{ id: 't', rows: [{ class: 'H7', overMM: 10, upToMM: 18, upperUM: 18, lowerUM: 0, estimate: true }, { class: 'g6', overMM: 10, upToMM: 18, upperUM: -6, lowerUM: -17, estimate: true }] }] } };
  const fc = await dispatchTool({ doc: fitted, bodies: r3.bodies }, 'fit_clearance', { hole_class: 'H7', shaft_class: 'g6', size: 12 }, evaluate);
  assert.ok(!fc.isError && !fc.changed, fc.content); assert.deepEqual(validate(outputSchemaOf('fit_clearance')!, JSON.parse(fc.content)), [], 'fit_clearance'); seen.add('fit_clearance');
  // Every read tool with an output schema was run here.
  // (A keep-out to check, A6.3.)
  const withK = await dispatchTool(s, 'add_keepout', { box: { frame: { origin: [100, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [5, 5, 5] } }, evaluate);
  assert.ok(!withK.isError, withK.content);
  const kc = await dispatchTool(withK.state, 'check_keepouts', {}, evaluate);
  assert.ok(!kc.isError && !kc.changed, kc.content); assert.deepEqual(validate(outputSchemaOf('check_keepouts')!, JSON.parse(kc.content)), [], 'check_keepouts'); seen.add('check_keepouts');
  // (The output tools, through the dispatcher: a plate, a placed part on the document's stock, an approved baseline.)
  const evalDoc = async (d: StudioDoc) => evaluateDoc(d, 1), plate = rectanglePart(20, 15, 4);
  const stocked: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [{ id: 'shop', kind: 'block', size: [30, 25, 10], source: 'a test stock' }] }, instances: [{ id: 'p1', name: 'plate', doc: plate, position: [0, 0, 0], rotation: [0, 0, 0], grounded: true }] };
  const pe = await evalDoc(plate); assert.ok(pe.ok);
  const looked = withLook(plate, pe.bodies[0], { material: 'al6061' }), view = await bomView(looked, evalDoc), draft = draftBaseline(looked, deriveBom(view), view);
  const review = await moveBaseline(draft.doc, draft.baseline.id, 'review', userToken('test'));
  const approved = (await moveBaseline(review.doc, draft.baseline.id, 'approved', userToken('test'), evalDoc)).doc;
  for (const [name, d, args] of [['output_bom', plate, {}], ['output_purchase_csv', plate, { withMade: true }], ['output_clearance', plate, {}], ['output_print_layers', plate, { layerMM: 1 }], ['output_cam_package', stocked, { part: 'p1' }], ['output_bundle', approved, {}]] as [string, StudioDoc, object][]) {
    const out = await dispatchTool({ doc: d, bodies: [] }, name, args, evalDoc);
    assert.ok(!out.isError && !out.changed, `${name}: ${out.content.slice(0, 200)}`); assert.equal(out.state.doc, d, `${name}: the document as it was`);
    assert.deepEqual(validate(outputSchemaOf(name)!, JSON.parse(out.content)), [], name); seen.add(name);
  }
  assert.deepEqual(TOOLS.filter(t => outputSchemaOf(t.name) && !seen.has(t.name)).map(t => t.name), []);
});

