import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const baseline = mode === '--baseline';
const cross = process.argv[4] === '--cross-hole';
const row = process.argv[4] === '--row-geometric';
const crossFixture = 'packages/barocss-cad/conformance/r14/tol-cross-hole-geometric/case.json';
const rowFixture = 'packages/barocss-cad/conformance/r14/tol-row-geometric/case.json';
const fixture = cross ? crossFixture : row ? rowFixture : null;
const sample = 'packages/barocss-cad-model/samples/rows/fastener-sizes.json';
const pins = [
  'apps/cad-studio/test/drawing-tolerance-overlap-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'packages/barocss-cad-model/test/chat-drawing.test.ts',
  'packages/barocss-cad-model/src/chat/drawing.ts',
  'packages/barocss-cad-model/src/drawing/issues.ts',
  'packages/barocss-cad-model/src/drawing/sheet.ts', sample,
  ...(fixture ? [fixture, 'packages/barocss-cad-model/test/tolerance.test.ts'] : []),
  ...(row ? ['apps/cad-studio/src/ui/drawing/TolerancingList.tsx', 'packages/barocss-cad-model/src/io/svg.ts'] : []),
];
const f = await createFlow({
  name: 'drawing-tolerance-overlap', output, envFrozen: row ? 'D936_SOURCE_FROZEN' : cross ? 'D935_SOURCE_FROZEN' : 'D934_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Open the accepted tolerance drawing and inspect its actual drawing warning.',
  oracleSource: row ? `
import json, math, sys, xml.etree.ElementTree as ET
d = json.load(sys.stdin)
marks = d['target']['marks']
[line] = [m for m in marks if m.get('role') == 'dimension']
[frame] = [m for m in marks if m.get('role') == 'frame']
[x0, y], [x1, other_y] = line['a'], line['b']
xs, ys = zip(*frame['points'])
top = d['layout']['views']['top']['box'][1]
close = lambda a, b: math.isclose(a, b, abs_tol=1e-8)
assert close(x1 - x0, 20) and y == other_y
assert close(top - y, 18)
assert close((min(xs) + max(xs))/2, (x0 + x1)/2)
assert close(max(ys) - min(ys), 5.17)
if d['baseline']:
    assert min(ys) < y < max(ys)
else:
    heads = [m for m in marks if m.get('head')]
    assert [m['head']['tip'] for m in heads] == [line['a'], line['b']]
    assert close(min(ys) - 0.125 - max(p[1] for m in heads for p in m['points']), 1.2)
    assert max(ys) + 0.125 + 1.2 < top
    assert not any(m.get('role') == 'leader' for m in marks)
    root = ET.fromstring(d['svg'])
    ns = {'s': 'http://www.w3.org/2000/svg'}
    assert root.attrib['width'] == '297mm' and root.attrib['height'] == '210mm'
    group = root.find(".//s:g[@data-dim='d2']", ns)
    assert group.attrib['class'] == 'dimension' and group.attrib['data-view'] == 'top'
    assert group.find('s:text', ns).text == '20'
    lines = group.findall('s:line', ns)
    assert len(lines) == 3 and any(float(s.attrib['y1']) == y == float(s.attrib['y2']) and close(float(s.attrib['x2'])-float(s.attrib['x1']), 20) for s in lines)
    [polygon] = group.findall('s:polyline', ns)
    svg_ys = [float(p.split(',')[1]) for p in polygon.attrib['points'].split()]
    assert close(min(svg_ys), min(ys)) and close(max(svg_ys), max(ys))
print(json.dumps({'status':'PASS', 'rulerMM':20, 'rulerY':y, 'topViewY':top, 'boxY':[min(ys), max(ys)]}))
` : cross ? `
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
  limits: row ? ['The exact hole-row geometric tolerance drawing and its locally recorded M6 rows.'] : cross
    ? ['The exact 60 × 30 × 30 mm block with an Ø8 cross-hole and a plain-mm geometric tolerance drawing.']
    : ['The exact existing 100 × 40 × 10 mm plate, four-hole pattern and local fastener-size fixture.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync, writeSync } from 'node:fs';
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

const { rowPath, fixture, targetId, settings: currentSettings } = JSON.parse(process.argv[3]);
const conformance = fixture ? JSON.parse(readFileSync(fixture, 'utf8')) : null;
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
  const initial = { ...loaded.doc, drawing: readDrawing(input.settings) };
  const settings = currentSettings ?? acceptAll(input).settings;
  const doc = { ...loaded.doc, drawing: readDrawing(settings) };
  const ctx = issueContext({ ...input, settings }), issues = drawingIssues(ctx);
  const target = ctx.sheet.groups.find(group => group.role === 'dimension' && group.id === targetId);
  assert.ok(target);
  writeSync(1, JSON.stringify({ doc, initial, issues, target, groups: ctx.sheet.groups, layout: ctx.layout }));
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
    if (row && !baseline) await context.addInitScript(() => {
      const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__toleranceSvg = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        if (!this.download.endsWith('.svg') || !urls.has(this.href)) return click.call(this);
        void urls.get(this.href).text().then(svg => window.__toleranceSvg.push(svg));
      };
    });
    return context;
  };
  f.phase = 'build the existing local approved drawing fixture';
  const fixtureInputs = { rowPath: join(f.repo, sample), fixture: fixture && join(f.repo, fixture), targetId: row ? 'd2' : 'd4' };
  const native = await f.inspect('approved-proposal', {}, fixtureInputs);
  if (row) {
    await f.newPage();
    f.phase = 'open the original hole-row document';
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'hole-row-geometric.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(native.initial)) });
    await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 4);
    await f.ready();
    assert.deepEqual((await f.doc()).drawing, native.initial.drawing);
    await button('Drawing').click();
    const accept = button('Accept all suggestions');
    await accept.waitFor();
    await f.snapshot('01-before-accept-all');
    f.phase = 'accept all geometric tolerances and read Studio diagnostics';
    await accept.click();
    await f.page.waitForFunction(() => window.__studioDoc?.drawing?.frames?.length === 2);
    const current = await f.snapshot('02-after-accept-all');
    const actual = await f.inspect('accepted-in-studio', {}, { ...fixtureInputs, settings: current.doc.drawing });
    assert.deepEqual(actual.doc.drawing, current.doc.drawing);
    assert.deepEqual(current.doc.nodes, native.initial.nodes);
    assert.deepEqual(current.drawing.issues.filter(i => i.code === 'TEXT_OVER_LINES').map(i => i.dims), baseline ? [['d2']] : []);
    assert.deepEqual(current.doc.drawing.datums.map(d => d.letter), ['A', 'B', 'C']);
    assert.deepEqual(current.doc.drawing.frames.map(d => [d.dim, d.value, d.datums]), [['d7', 0.3, ['A', 'B', 'C']], ['d8', 0.6, ['A', 'B', 'C']]]);
    assert.deepEqual(current.drawing.dimensions.filter(d => d.id === 'd7' || d.id === 'd8').map(d => d.text), ['M6×1 × 12 DEEP', '4× Ø6.6 THRU']);
    const original = native.initial.drawing.dimensions.find(d => d.id === 'd2');
    assert.deepEqual(current.doc.drawing.dimensions.find(d => d.id === 'd2'), { ...original, basic: true });
    let svg;
    if (!baseline) {
      f.phase = 'read the actual SVG and verify the acceptance history';
      await button('Export SVG').click();
      await f.page.waitForFunction(() => window.__toleranceSvg.length === 1);
      [svg] = await f.page.evaluate(() => window.__toleranceSvg);
      f.report.observations.push({ label: 'emitted-svg', bytes: Buffer.byteLength(svg), sha256: sha256(svg) });
      await f.undo();
      await f.same(native.initial);
      await f.redo();
      await f.same(current.doc);
    }
    await f.runOracle({ target: actual.target, layout: actual.layout, baseline, svg }, 'row-paper-mm-clearance');
    assert.deepEqual(f.report.downloads, []);
    return;
  }
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
