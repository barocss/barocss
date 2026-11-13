import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const baseline = mode === '--baseline';
const cross = process.argv[4] === '--cross-hole';
const crossFixture = 'packages/barocss-cad/conformance/r14/tol-cross-hole-geometric/case.json';
const sample = 'packages/barocss-cad-model/samples/rows/fastener-sizes.json';
const pins = [
  'apps/cad-studio/test/drawing-tolerance-overlap-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'packages/barocss-cad-model/test/chat-drawing.test.ts',
  'packages/barocss-cad-model/src/chat/drawing.ts',
  'packages/barocss-cad-model/src/drawing/issues.ts',
  'packages/barocss-cad-model/src/drawing/sheet.ts', sample,
  ...(cross ? [crossFixture, 'packages/barocss-cad-model/test/tolerance.test.ts'] : []),
];
const f = await createFlow({
  name: 'drawing-tolerance-overlap', output, envFrozen: cross ? 'D935_SOURCE_FROZEN' : 'D934_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Open the accepted tolerance drawing and inspect its actual drawing warning.',
  oracleSource: cross ? `
import json, math, sys
d = json.load(sys.stdin)
marks = d['target']['marks']
[line] = [m for m in marks if m.get('role') == 'dimension']
[frame] = [m for m in marks if m.get('role') == 'frame']
[x0, y], [x1, other_y] = line['a'], line['b']
left, top, right, bottom = d['layout']['views']['right']['box']
xs, ys = zip(*frame['points'])
assert y == other_y and math.isclose(x1 - x0, 15, abs_tol=1e-8)
assert math.isclose(x0, left, abs_tol=1e-8)
assert math.isclose(x1, (left + right) / 2, abs_tol=1e-8)
assert math.isclose(bottom - top, 30, abs_tol=1e-8)
assert math.isclose(max(ys) - min(ys), 5.17, abs_tol=1e-8)
assert [m['text'] for m in marks if m['kind'] == 'text'] == ['15']
if d['baseline']:
    assert top < y < bottom
    assert x0 < min(xs) < max(xs) < x1 and min(ys) < y < max(ys)
else:
    heads = [m for m in marks if m.get('head')]
    assert [m['head']['tip'] for m in heads] == [line['a'], line['b']]
    assert math.isclose(top - y, 8, abs_tol=1e-8)
    assert top - max(p[1] for m in heads for p in m['points']) > 0.25
    assert y - max(ys) - 0.25 > 1.2
    [leader] = [m for m in marks if m.get('role') == 'leader']
    assert leader['a'] == line['b']
    assert 1.2 <= math.hypot(leader['b'][0] - min(xs), leader['b'][1] - max(ys)) <= 1.4
print(json.dumps({'status':'PASS', 'rulerMM':15, 'rulerY':y, 'rightViewTop':top, 'boxY':[min(ys), max(ys)]}))
` : `
import json, math, sys
d = json.load(sys.stdin)
marks = d['target']['marks']
[line] = [m for m in marks if m.get('role') == 'dimension']
[frame] = [m for m in marks if m.get('role') == 'frame']
[line_x, line_y] = line['a']
assert line['b'][0] == line_x
assert math.isclose(abs(line_y - line['b'][1]), 12, abs_tol=1e-8)
xs, ys = zip(*frame['points'])
assert math.isclose(max(xs) - min(xs), 5.17, abs_tol=1e-8)
assert math.isclose((min(ys) + max(ys))/2, (line_y + line['b'][1])/2, abs_tol=1e-8)
assert math.isclose(line_x, d['layout']['views']['top']['box'][0] - 10, abs_tol=1e-8)
half_stroke = 0.125
if d['baseline']:
    assert min(xs) < line_x < max(xs)
else:
    [lower_head, upper_head] = [m for m in marks if m.get('head')]
    head_x = max(p[0] for m in [lower_head, upper_head] for p in m['points'])
    assert min(xs) - half_stroke - head_x >= 1.2 - 1e-8
    assert d['layout']['views']['top']['box'][0] - max(xs) - half_stroke >= 1.2 - 1e-8
print(json.dumps({'status':'PASS', 'rulerX':line_x, 'rulerLength':12, 'boxX':[min(xs), max(xs)]}))
`,
  limits: cross
    ? ['The exact 60 × 30 × 30 mm block with an Ø8 cross-hole and a plain-mm geometric tolerance drawing.']
    : ['The exact existing 100 × 40 × 10 mm plate, four-hole pattern and local fastener-size fixture.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptProposal, runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { drawingInputs } from '@barocss/cad-model/chat/drawing';
import { loadPersonRows } from '@barocss/cad-model/chat/rows';
import { drawingIssues, issueContext, textBox } from '@barocss/cad-model/drawing/issues';
import { acceptAll } from '@barocss/cad-model/drawing/tolerance';
import { holeCallout } from '@barocss/cad-model/drawing/callout';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { fastenerSizesOf } from '@barocss/cad-model/engine/fastenerSizeRows';
import { readDrawing } from '@barocss/cad-model/drawing/types';
import { rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { brepsFor, evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { receivePersonRowFiles } from '@barocss/cad-model/engine/rowFiles';

const { rowPath, crossFixture } = JSON.parse(process.argv[3]);
const conformance = crossFixture ? JSON.parse(readFileSync(crossFixture, 'utf8')) : null;
const files = receivePersonRowFiles('0123456789abcdef01234567', [{ name: 'fastener-sizes.json', text: readFileSync(rowPath, 'utf8'), turn: 1 }], 1);
const loaded = loadPersonRows(conformance?.input.document ?? withNode(rectanglePart(100, 40, 10), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 12], radius: 3.3,
  pattern: { count: 4, step: [20, 0] } }), 'fastener-sizes', files.files[0].id, undefined, files);
assert.ok('doc' in loaded);
if (conformance) {
  const native = brepsFor(conformance.input.document);
  assert.ok('breps' in native);
  const projected = projectViews(native.breps, native.prefixes);
  assert.ok(projected.ok);
  const input = { views: projected.views, settings: conformance.input.drawing, fastenerSizes: fastenerSizesOf(loaded.doc),
    callout: (edge: string) => holeCallout(loaded.doc.nodes, edge), meta: { title: 't', date: 'd' } };
  const outcome = acceptAll(input), doc = { ...loaded.doc, drawing: readDrawing(outcome.settings) };
  const ctx = issueContext({ ...input, settings: outcome.settings }), issues = drawingIssues(ctx);
  const id = 'd4';
  const target = ctx.sheet.groups.find(group => group.role === 'dimension' && group.id === id);
  assert.ok(target);
  console.log(JSON.stringify({ doc, issues, target, groups: ctx.sheet.groups, layout: ctx.layout }));
  process.exit(0);
}
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const result = await evaluate(loaded.doc);
assert.ok(result.ok);
const state: ChatState = { doc: loaded.doc, bodies: result.bodies };
const proposal = await runTool(state, 'propose', { title: 'Drawing: dimensions and tolerances', plan: 'Auto layout and dimensions, then geometric tolerancing.',
  ops: [{ tool: 'auto_dimension', args: {} }, { tool: 'accept_tolerances', args: { mode: 'geometric' } }] }, evaluate);
assert.ok(!proposal.isError && !proposal.state.doc.drawing);
const accepted = await acceptProposal(proposal.state, 'P1', evaluate);
assert.ok(!('error' in accepted));
const doc = accepted.state.doc, input = drawingInputs(doc);
assert.ok(typeof input !== 'string');
const ctx = issueContext(input);
const issues = drawingIssues(ctx);
const group = ctx.sheet.groups.find(g => g.role === 'dimension' && g.marks.some(m => m.kind === 'text' && m.text === '12'));
assert.ok(group);
const texts = group.marks.filter(m => m.kind === 'text').map(mark => ({ mark, box: textBox(mark) }));
console.log(JSON.stringify({ doc, issues, target: group, texts, groups: ctx.sheet.groups, layout: ctx.layout }));
`,
  snapshotExtra: () => ({
    drawing: window.__studioDrawing?.() ?? null,
    issues: [...document.querySelectorAll('.dw-issue')].map(node => node.textContent),
  }),
});

const button = name => f.page.getByRole('button', { name, exact: true });
await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  f.phase = 'build the existing local approved drawing fixture';
  const native = await f.inspect('approved-proposal', {}, {
    rowPath: join(f.repo, sample), crossFixture: cross ? join(f.repo, crossFixture) : null,
  });
  if (cross) {
    assert.equal(native.target.view, 'right');
    const dimension = native.doc.drawing.dimensions.find(d => d.id === 'd4');
    assert.equal(dimension.basic, true);
    assert.equal(dimension.orient, 'horizontal');
    assert.equal(dimension.place[1], baseline ? 6 : 38);
    assert.deepEqual(dimension.a.near, [60, 0, 0]);
    assert.ok(dimension.b.near.every((coordinate, i) => Math.abs(coordinate - [60, 15, 15][i]) < 1e-8));
    assert.deepEqual(native.doc.drawing.datums.map(d => d.letter), ['A', 'B', 'C']);
    assert.deepEqual(native.doc.drawing.frames, [{ id: 'frame-d6', dim: 'd6', characteristic: 'position', value: 0.2, datums: ['A', 'B', 'C'] }]);
  } else {
    assert.equal(native.target.view, 'top');
    const dimension = native.doc.drawing.dimensions.find(d => d.id === native.target.id);
    assert.equal(dimension.basic, true);
    assert.deepEqual(dimension.place, [-10, 6]);
    assert.equal(dimension.tol, undefined);
  }
  await f.runOracle({ target: native.target, layout: native.layout, baseline }, 'paper-mm-clearance');
  const issue = native.issues.find(item => item.code === 'TEXT_OVER_LINES' && item.dims?.includes(native.target.id));
  assert.equal(!!issue, baseline);
  const seed = Buffer.from(JSON.stringify(native.doc));
  f.report.observations.push({ label: 'exact-approval', sha256: sha256(seed), bytes: seed.length, dimensionId: native.target.id, issue: issue ?? null });

  await f.newPage();
  f.phase = 'open the accepted drawing and compare current desktop diagnostics';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'approved-drawing.bcad', mimeType: 'application/json', buffer: seed });
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 3);
  await f.ready();
  const current = await f.doc();
  assert.deepEqual(current.nodes, native.doc.nodes);
  assert.deepEqual(current.drawing, native.doc.drawing);
  await button('Drawing').click();
  await f.page.waitForFunction(id => window.__studioDrawing?.()?.dimensions.some(d => d.id === id), native.target.id);
  const snapshot = await f.snapshot(baseline ? '01-warning-baseline' : '01-current-drawing');
  if (cross) {
    assert.equal(snapshot.issues.some(text => text.includes('The text of dimension 15 lies over lines of the drawing.')), baseline);
    assert.match(await f.page.locator('g.dimension[data-dim="d4"]').textContent(), /15/);
    assert.equal(snapshot.doc.drawing.frames[0].value, 0.2);
  } else {
    assert.equal(snapshot.issues.some(text => text.includes('The text of dimension 12 lies over lines of the drawing.')), baseline);
    assert.match(await f.page.locator(`g.dimension[data-dim="${native.target.id}"]`).textContent(), /12/);
    assert.equal(snapshot.doc.drawing.frames[0].value, 0.6);
  }
  assert.deepEqual(f.report.downloads, []);
});
