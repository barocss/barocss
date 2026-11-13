import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode, variant] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && relative(repo, resolve(output)).startsWith('../'));
assert.ok(['--baseline', '--fixed'].includes(mode));
const baseline = mode === '--baseline';
const covered = variant === '--covered';
const creation = variant === '--create';
const scaled = variant === '--scaled';
const deleted = variant === '--delete-source';
const removalNotice = variant === '--removal-notice';
const units = variant === '--units';
const splitArc = variant === '--split-arc';
const tangent = variant === '--tangent';
const diagnosis = variant === '--diagnosis';
const projectStore = variant === '--project-store';
const tie = variant === '--tie';
const modelPath = join(repo, 'packages/barocss-cad/conformance/r14/starter-plate/case.json');
const { input: { document } } = JSON.parse(await readFile(modelPath, 'utf8'));
const detail = { id: 'B', view: 'top', center: [36, 16], radius: 2, scale: 5, at: [310, 85] };
const diameter = { id: 'b-diameter', kind: 'diameter', view: 'detail:B', edge: 'n1.top|n2.side0#1',
  near: [32, 16, 8], place: [44, 16], tol: { kind: 'symmetric', value: 0.15 } };
const control = { ...diameter, id: 'top-diameter', view: 'top', place: [58, 25] };
const drawing = { scope: { kind: 'part' }, sheet: 'A3', projection: 'third', scale: 2, hidden: false,
  views: ['front', 'top'], details: [detail], dimensions: creation ? [] : covered ? [{ ...diameter, place: [24, 16] }] : [diameter, control] };
if (deleted || removalNotice) {
  drawing.dimensions = drawing.dimensions.map(d => ({ ...d, sig: { k: 'curve', n: 2, p: [28, 16, 8], s: 0 } }));
}
if (splitArc || tie) {
  drawing.details = [{ ...detail, center: [32, 18], radius: 5 }];
  drawing.dimensions = [{ ...diameter, place: [32 + 12 * Math.cos(-2.2), 16 + 12 * Math.sin(-2.2)] }];
}
if (tie) drawing.dimensions = [
  { ...diameter, place: [32, 4] },
  { ...control, id: 'top-outside' },
  { ...control, id: 'top-inside', place: [32, 16] },
];
if (tangent || diagnosis) {
  drawing.details = [{ ...detail, center: [32, 10] }];
  drawing.dimensions = [{ ...diameter, place: [44, 16] }];
}
if (units || projectStore) drawing.dimensions = [
  { ...diameter, place: [24, 16] },
  control,
  { ...control, id: 'top-radius', kind: 'radius', place: [20, 25] },
];
if (projectStore) Object.assign(drawing, { units: 'inch', dual: true });
const part = covered ? {
  ...document,
  nodes: [...document.nodes,
    { id: 'n3', kind: 'sketch', profile: 'rectangle', min: [27, 10], max: [37, 22], plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
    { id: 'n4', kind: 'extrude', sketch: 3, height: 2 }],
  nextId: 5, outputs: { ...document.outputs, b4: { node: 4, side: 'solid' } },
} : document;
const doc = { ...part, drawing };
const f = await createFlow({
  name: 'detail-diameter-anchor', envFrozen: projectStore ? 'D949_SOURCE_FROZEN' : diagnosis ? 'D948_SOURCE_FROZEN' : tie ? 'D947_SOURCE_FROZEN' : tangent ? 'D946_SOURCE_FROZEN' : splitArc ? 'D945_SOURCE_FROZEN' : units ? 'D944_SOURCE_FROZEN' : removalNotice ? 'D943_SOURCE_FROZEN' : deleted ? 'D942_SOURCE_FROZEN' : scaled ? 'D941_SOURCE_FROZEN' : creation ? 'D940_SOURCE_FROZEN' : covered ? 'D939_SOURCE_FROZEN' : 'D938_SOURCE_FROZEN', output,
  qualification: 'Move an existing Detail diameter label across the source circle in desktop Studio and read the emitted SVG.',
  initialFiles: [import.meta.filename, modelPath],
  extraFrozen: ['apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'packages/barocss-cad-model/src/drawing/sheet.ts',
    'packages/barocss-cad-model/src/drawing/detail.ts', 'packages/barocss-cad-model/src/drawing/dimensions.ts',
    'packages/barocss-cad-model/src/io/svg.ts', 'packages/barocss-cad-model/src/io/dxf.ts', 'packages/barocss-cad/src/io/dxf-writer.ts',
    ...(removalNotice ? ['apps/cad-studio/src/state/useFeatureHistory.ts', 'apps/cad-studio/src/App.tsx'] : [])],
  limits: ['One native through bore, an offset detail crop and the external diameter label.'],
  oracleSource: `
import json, math, re, sys, xml.etree.ElementTree as ET
d = json.load(sys.stdin)
root = ET.fromstring(d['svg'])
ns = {'s': 'http://www.w3.org/2000/svg'}
dim = root.find(".//s:g[@data-dim='%s']" % d.get('id','b-diameter'), ns)
ink = root.find(".//s:g[@class='detail'][@data-view='detail:B']", ns)
assert ink is not None
if d.get('tangent'):
    paths = [p.attrib['d'] for p in ink.findall("s:path[@stroke-width='0.5']", ns)]
    assert dim is None and not paths
    lines = d['dxf'].splitlines()
    assert all(v.strip() != 'DIMENSION' for k,v in zip(lines[::2], lines[1::2]) if int(k) == 0)
    assert math.dist((32,16),(32,10)) == 4+2
    print(json.dumps({'status':'PASS', 'visiblePaths':paths, 'dimensionPresent':dim is not None}))
    sys.exit(0)
if d.get('hiddenOff') or d.get('deleted'):
    assert dim is None
    assert not any('A20 20 ' in p.attrib['d'] for p in ink.findall('s:path', ns))
    if d.get('hiddenOff'):
        assert ink.find("s:line[@stroke-width='0.5']", ns) is not None
    else:
        assert not ink.findall("s:path[@stroke-width='0.5']", ns)
        assert root.find(".//s:g[@data-dim='top-diameter']", ns) is None
    lines = d['dxf'].splitlines()
    assert all(v.strip() != 'DIMENSION' for k,v in zip(lines[::2], lines[1::2]) if int(k) == 0)
    print(json.dumps({'status':'PASS', 'sourceArc':'hidden' if d.get('hiddenOff') else 'deleted', 'dimension':'absent'}))
    sys.exit(0)
assert dim.attrib['data-view'] == 'detail:B'
texts = ' '.join(t.text for t in dim.findall('s:text', ns))
if d.get('units') == 'precision':
    assert re.search(r'Ø0?[.]3150(?:[^0-9]|$)', texts), texts
    assert 'Ø8' in texts
elif d.get('units') in ('inch', 'dual'):
    assert re.search(r'Ø0?[.]315(?:[^0-9]|$)', texts)
    if d['units'] == 'dual':
        assert 'Ø8' in texts
else:
    assert 'Ø8' in texts
if not d.get('creation') and d.get('units') not in ('inch', 'dual', 'precision'):
    assert '0.15' in texts
[head] = dim.findall("s:path[@fill='#000']", ns)
m = re.match(r'M([0-9.-]+) ([0-9.-]+)', head.attrib['d'])
x, y = map(float, m.groups())
eps = 0.0001
if 'tie' in d:
    assert abs(abs(x-310)-5*math.sqrt(231)/4) <= eps
    assert abs(y-101.25) <= eps
    assert abs(math.hypot(x-310,y-95)-20) <= eps
    assert abs(math.hypot(x-310,y-85)-25) <= eps
    control_center = d['tie']
    for name, count in [('top-inside',2),('top-outside',1)]:
        control = root.find(".//s:g[@data-dim='%s']" % name, ns)
        assert control.attrib['data-view'] == 'top'
        heads = control.findall("s:path[@fill='#000']", ns)
        assert len(heads) == count
        for arrow in heads:
            point = tuple(map(float,re.match(r'M([0-9.-]+) ([0-9.-]+)',arrow.attrib['d']).groups()))
            assert abs(math.dist(point,control_center)-8) <= eps
    print(json.dumps({'status':'PASS','tip':[x,y],'equalCandidates':2,'insideHeads':2,'outsideHeads':1}))
    sys.exit(0)
if 'split' in d:
    u, v = d['split']
    wanted = math.atan2(v-16, u-32)
    a = math.asin(5/16)
    points = [max(lo, min(hi, wanted + offset)) for lo, hi in [(-math.pi,-math.pi+a),(-a,0)] for offset in [-2*math.pi,0,2*math.pi]]
    best = max(points, key=lambda q: math.cos(q-wanted))
    expected = (310+20*math.cos(best), 95-20*math.sin(best))
    assert math.dist((x,y), expected) <= eps, (expected, (x,y))
    assert math.dist((x,y),(310,85)) <= 25+eps
    assert abs(math.dist((x,y),(310,95))-20) <= eps
    assert any(abs(float(line.attrib['x1'])-x) <= eps and abs(float(line.attrib['y1'])-y) <= eps for line in dim.findall('s:line', ns))
    assert len([p for p in ink.findall("s:path[@stroke-width='0.5']", ns) if 'A20 20 ' in p.attrib['d']]) >= 3
    lines = d['dxf'].splitlines()
    pairs = list(zip(map(int, lines[::2]), (s.strip() for s in lines[1::2]), strict=True))
    starts = [i for i,(k,v) in enumerate(pairs) if k == 0]
    [diameter] = [dict(pairs[i+1:j]) for i,j in zip(starts,starts[1:]) if pairs[i] == (0,'DIMENSION')]
    assert math.dist((float(diameter[15]),297-float(diameter[25])),(x,y)) <= eps
    assert abs(math.hypot(float(diameter[10])-x,297-float(diameter[20])-y)-40) <= 2*eps
    assert abs(float(diameter[42])-8) <= eps
    print(json.dumps({'status':'PASS', 'tip':[x,y], 'expected':expected, 'wantedAngle':wanted, 'tipAngle':best}))
    sys.exit(0)
if 'scaled' in d:
    scale, u, v = d['scaled']
    center = (310-4*scale, 85)
    theta = min(0.0, max(-math.acos(7/8), math.atan2(v-16, u-32)))
    expected = (center[0]+4*scale*math.cos(theta), 85-4*scale*math.sin(theta))
    assert math.dist((x,y), expected) <= eps
    assert abs(math.dist((x,y),center)-4*scale) <= eps
    assert math.dist((x,y),(310,85)) <= 2*scale+eps
    assert any(abs(float(line.attrib['x1'])-x) <= eps and abs(float(line.attrib['y1'])-y) <= eps for line in dim.findall('s:line', ns))
    assert any(('A%g %g ' % (4*scale,4*scale)) in p.attrib['d'] for p in ink.findall('s:path', ns))
    print(json.dumps({'status':'PASS', 'tip':[x,y], 'expected':expected, 'scale':scale, 'texts':texts}))
    sys.exit(0)
assert abs(math.hypot(x-290, y-85)-20) <= eps
crop = math.hypot(x-310, y-85)
if d['expectClipped']:
    assert crop > 10 + eps
else:
    assert crop <= 10 + eps
    assert x >= 307.5 - eps
    if d['opposite']:
        assert abs(x-307.5) <= eps and abs(abs(y-85)-5*math.sqrt(15)/2) <= eps
assert any(abs(float(line.attrib['x1'])-x) <= eps and abs(float(line.attrib['y1'])-y) <= eps for line in dim.findall('s:line', ns))
assert any('A20 20 ' in p.attrib['d'] for p in ink.findall('s:path', ns))
if d.get('covered'):
    assert any('A20 20 ' in p.attrib['d'] and p.get('stroke-dasharray') == '3 1.5' for p in ink.findall('s:path', ns))
if 'dxf' in d:
    lines = d['dxf'].splitlines()
    pairs = list(zip(map(int, lines[::2]), (s.strip() for s in lines[1::2]), strict=True))
    starts = [i for i, (k,v) in enumerate(pairs) if k == 0]
    dims = [dict(pairs[i+1:j]) for i,j in zip(starts, starts[1:]) if pairs[i] == (0, 'DIMENSION')]
    [detail] = [e for e in dims if abs(float(e[15])-x) <= eps and abs(297-float(e[25])-y) <= eps]
    assert int(detail[70]) & 7 == 3 and abs(float(detail[42])-8) <= eps
    assert abs(math.hypot(float(detail[10])-x, 297-float(detail[20])-y)-40) <= 2*eps
    assert abs((float(detail[10])+x)/2-290) <= eps
    assert abs((297-float(detail[20])+y)/2-85) <= eps
    if d.get('units'):
        assert len(dims) == 3
        assert sorted((int(e[70]) & 7, round(float(e[42]),6)) for e in dims) == [(3,8.0),(3,8.0),(4,4.0)]
print(json.dumps({'status':'PASS', 'tip':[x,y], 'cropDistance':crop, 'sourceRadius':20, 'texts':texts}))
`,
  snapshotExtra: () => ({ drawing: window.__studioDrawing?.() ?? null }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const locator = 'g.dimension[data-dim="b-diameter"]';
await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(60000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(() => {
      const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__detailAnchorFiles = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        if (!/\.(bcad|dxf|svg)$/.test(this.download) || !urls.has(this.href)) return click.call(this);
        void urls.get(this.href).text().then(text => window.__detailAnchorFiles.push(text));
      };
    });
    return context;
  };
  async function open(buffer) {
    await f.newPage();
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'detail-anchor.bcad', mimeType: 'application/json', buffer });
    await f.page.waitForFunction(() => window.__studioDoc?.drawing?.details?.length === 1);
    await f.ready();
    await button('Drawing').click();
    await f.page.locator(covered || creation || tangent || diagnosis ? 'g.detail[data-view="detail:B"]' : locator).waitFor();
  }
  if (creation) {
    f.phase = 'select the surviving arc and preview opposite-side placement';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const hit = (u, v) => f.page.evaluate(([x,y]) => window.__studioDrawingAt('detail:B', x, y), [u,v]);
    const pick = await hit(32 + 4 * Math.cos(-0.3), 16 + 4 * Math.sin(-0.3));
    const place = await hit(24, 16);
    const preview = f.page.locator('.dw-preview path[fill="#000"]');
    if (baseline) {
      await button('Diameter').click();
      await f.page.mouse.click(pick.x, pick.y);
      await f.page.mouse.move(place.x, place.y);
      await f.page.getByText('Click where the dimension goes · Esc cancels', { exact: true }).waitFor();
      assert.equal(await preview.count(), 0);
      await f.page.mouse.click(place.x, place.y);
      await f.changed(original);
      const state = await f.snapshot('01-invisible-source-committed');
      const [dim] = state.doc.drawing.dimensions;
      assert.match(state.drawing.dimensions.find(d => d.id === dim.id).lost, /No drawable circular arc/);
      assert.deepEqual(f.report.downloads, []);
      return;
    }
    async function begin() {
      await button('Diameter').click();
      await f.page.mouse.click(pick.x, pick.y);
      await f.page.mouse.move(place.x, place.y);
      await preview.waitFor();
      return preview.getAttribute('d');
    }
    const canceledTip = await begin();
    await f.snapshot('01-placement-preview');
    assert.deepEqual(await f.doc(), original);
    await f.page.keyboard.press('Escape');
    await preview.waitFor({ state: 'detached' });
    assert.deepEqual(await f.doc(), original);
    assert.equal(await f.page.locator('g.dimension[data-view="detail:B"]').count(), 0);
    const nextTip = await begin();
    assert.equal(nextTip, canceledTip);
    await f.page.mouse.click(place.x, place.y);
    await f.changed(original);
    const committed = await f.doc();
    const [dim] = committed.drawing.dimensions;
    assert.equal(dim.view, 'detail:B');
    assert.equal(dim.kind, 'diameter');
    assert.match(dim.edge, /^n1\.top\|n2\.side0#/);
    assert.deepEqual(dim.near, [32, 16, 8]);
    assert.deepEqual(committed, { ...original, drawing: { ...original.drawing, dimensions: [dim] } });
    const arrow = f.page.locator(`g.dimension[data-dim="${dim.id}"] path[fill="#000"]`);
    assert.equal(await arrow.getAttribute('d'), nextTip);
    const state = await f.snapshot('02-committed');
    assert.ok(Math.abs(state.drawing.dimensions.find(d => d.id === dim.id).value - 8) < 1e-9);
    const svg = await capture('Export SVG'), dxf = await capture('Export DXF');
    f.report.observations.push({ label: 'creation-output', svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg), dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
    await f.runOracle({ svg, dxf, id: dim.id, creation: true, opposite: true, expectClipped: false }, 'creation-output');
    await f.undo();
    await f.same(original);
    await f.redo();
    await f.same(committed);
    assert.equal(await arrow.getAttribute('d'), nextTip);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  async function capture(action) {
    const index = await f.page.evaluate(() => window.__detailAnchorFiles.length);
    await button(action).click();
    await f.page.waitForFunction(index => window.__detailAnchorFiles.length > index, index);
    return f.page.evaluate(index => window.__detailAnchorFiles[index], index);
  }
  async function verify(label, expectClipped, opposite = false) {
    const state = await f.snapshot(label);
    const dim = state.drawing.dimensions.find(d => d.id === diameter.id);
    assert.ok(Math.abs(dim.value - 8) < 1e-9);
    const svg = await capture('Export SVG');
    f.report.observations.push({ label, sha256: sha256(svg), bytes: Buffer.byteLength(svg) });
    const dxf = opposite ? await capture('Export DXF') : undefined;
    if (dxf) f.report.observations.push({ label: `${label}-dxf`, sha256: sha256(dxf), bytes: Buffer.byteLength(dxf) });
    return f.runOracle({ svg, dxf, expectClipped, opposite, covered }, label);
  }
  if (projectStore) {
    f.phase = 'edit inch precision in the actual drawing';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const precision = f.page.getByLabel('Decimals in inch', { exact: true });
    const panel = f.page.locator('details').filter({ has: precision }).first();
    await panel.locator('summary').first().click();
    await precision.fill('4');
    await f.changed(original);
    const current = await f.doc();
    assert.deepEqual(current, { ...original, drawing: { ...original.drawing, precision: { inch: 4 } } });
    const check = async label => {
      await f.page.locator(locator).waitFor();
      const state = await f.snapshot(label);
      assert.deepEqual(state.doc, current);
      assert.ok(Math.abs(state.drawing.dimensions.find(d => d.id === diameter.id).value - 8) < 1e-9);
      const svg = await capture('Export SVG'), dxf = await capture('Export DXF');
      f.report.observations.push({ label, svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg), dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
      await f.runOracle({ svg, dxf, units: 'precision', opposite: true, expectClipped: false }, label);
      return { svg, dxf };
    };
    const before = await check('01-precision-before-project');
    f.phase = 'save to OPFS and open the exact saved project after reload';
    await button('Model').click();
    const name = 'Detail diameter precision', file = 'detail-anchor.bcad';
    const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
    const attach = async () => {
      if (!(await versions().isVisible())) await button('Project and versions').click();
      await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(name);
      await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
      await versions().getByLabel('Project', { exact: true }).waitFor();
    };
    await attach();
    await button('Save').click();
    await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
    const saved = await f.page.evaluate(async ([name, file]) => {
      const root = await navigator.storage.getDirectory();
      const projects = await root.getDirectoryHandle('projects');
      const dir = await projects.getDirectoryHandle(name);
      return (await (await dir.getFileHandle(file)).getFile()).text();
    }, [name, file]);
    assert.deepEqual(JSON.parse(saved), current);
    f.report.observations.push({ label: 'project-save', bytes: Buffer.byteLength(saved), sha256: sha256(saved) });
    await versions().getByRole('button', { name: 'Close project', exact: true }).click();
    await f.page.reload();
    await f.ready();
    await attach();
    await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
    await f.same(current);
    await button('Drawing').click();
    assert.deepEqual(await check('02-project-reopened'), before);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (tie) {
    f.phase = 'open the equal-distance crop and read the ordinary diameter controls';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const check = async label => {
      const state = await f.snapshot(label);
      assert.deepEqual(state.doc.drawing, original.drawing);
      assert.ok(state.drawing.dimensions.every(d => Math.abs(d.value - 8) < 1e-9));
      const [left, top] = state.drawing.boxes.top;
      const svg = await capture('Export SVG');
      f.report.observations.push({ label, bytes: Buffer.byteLength(svg), sha256: sha256(svg) });
      return f.runOracle({ svg, tie: [left + 64, top + 32] }, label);
    };
    const before = await check('01-equal-distance');
    const saved = await capture('Save');
    assert.deepEqual(JSON.parse(saved), original);
    await open(Buffer.from(saved));
    await f.same(original);
    const after = await check('02-fresh-open');
    assert.deepEqual(after, before);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (tangent || diagnosis) {
    f.phase = 'open the exact point-contact-only crop';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const state = await f.snapshot('01-tangent-only');
    assert.deepEqual(state.doc, original);
    const resolved = state.drawing.dimensions.find(d => d.id === diameter.id);
    assert.ok(resolved.lost);
    if (diagnosis) {
      assert.match(resolved.lost, /No drawable circular arc/);
      await f.page.getByText(/dimension in Detail B is lost: No drawable circular arc/i).waitFor();
    }
    assert.ok(state.drawing.issues.some(i => i.code === 'DIMENSION_LOST'));
    assert.ok(state.drawing.issues.some(i => i.code === 'DETAIL_EMPTY'));
    const svg = await capture('Export SVG'), dxf = await capture('Export DXF');
    f.report.observations.push({ label: 'tangent-output', svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg), dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
    await f.runOracle({ svg, dxf, tangent: true }, 'tangent-output');
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (splitArc) {
    f.phase = 'open a Detail with two surviving intervals on one source edge';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const check = async label => {
      const state = await f.snapshot(label);
      const [dim] = state.doc.drawing.dimensions;
      assert.deepEqual(dim, { ...original.drawing.dimensions[0], place: dim.place });
      assert.ok(Math.abs(state.drawing.dimensions.find(d => d.id === dim.id).value - 8) < 1e-9);
      const svg = await capture('Export SVG'), dxf = await capture('Export DXF');
      f.report.observations.push({ label, svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg), dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
      await f.runOracle({ svg, dxf, split: dim.place, expectClipped: false }, label);
    };
    await check('01-gap-left');
    const targets = [['02-gap-right', -1], ['03-right-interior', -0.2], ['04-across-seam', 0.1]];
    let prior;
    for (const [label, angle] of targets) {
      f.phase = label;
      prior = await f.doc();
      const from = await f.page.locator(`${locator} text`).boundingBox();
      const to = await f.page.evaluate(a => window.__studioDrawingAt('detail:B', 32 + 12 * Math.cos(a), 16 + 12 * Math.sin(a)), angle);
      assert.ok(from && to);
      await f.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await f.page.mouse.down();
      await f.page.mouse.move(to.x, to.y, { steps: 8 });
      await f.page.mouse.up();
      await f.changed(prior);
      await check(label);
    }
    const moved = await f.doc();
    await f.undo();
    await f.same(prior);
    await f.redo();
    await f.same(moved);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (units) {
    f.phase = 'open a clipped diameter and ordinary diameter and radius controls';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const check = async (profile, label = profile) => {
      const state = await f.snapshot(label);
      assert.deepEqual(state.doc.drawing.dimensions, original.drawing.dimensions);
      assert.deepEqual(state.doc.nodes, original.nodes);
      assert.deepEqual(state.drawing.dimensions.map(d => d.id), ['b-diameter', 'top-diameter', 'top-radius']);
      assert.ok(state.drawing.dimensions.every((d, i) => Math.abs(d.value - [8, 8, 4][i]) < 1e-9));
      const svg = await capture('Export SVG'), dxf = await capture('Export DXF');
      f.report.observations.push({ label, svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg), dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
      return f.runOracle({ svg, dxf, units: profile, opposite: true, expectClipped: false }, label);
    };
    await check('mm');
    f.phase = 'switch to inch and dual units with the same geometry';
    await f.page.getByLabel('Drawing units', { exact: true }).selectOption('inch');
    await f.changed(original);
    const inch = await f.doc();
    assert.deepEqual(inch, { ...original, drawing: { ...original.drawing, units: 'inch' } });
    await check('inch');
    await f.page.getByLabel('Dual units', { exact: true }).check();
    await f.changed(inch);
    const dual = await f.doc();
    assert.deepEqual(dual, { ...inch, drawing: { ...inch.drawing, dual: true } });
    await check('dual', 'dual-before-save');
    await f.undo();
    await f.same(inch);
    await f.redo();
    await f.same(dual);
    const saved = await capture('Save');
    assert.deepEqual(JSON.parse(saved), dual);
    await open(Buffer.from(saved));
    await f.same(dual);
    await check('dual', 'dual-reopened');
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (removalNotice) {
    f.phase = 'delete the bore and confirm its removal notice';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const notice = f.page.getByText('Removed 2 drawing dimensions', { exact: true });
    await button('Model').click();
    await f.page.locator('.history .hs[data-node-index="2"]').click({ button: 'right' });
    await f.page.getByRole('menuitem', { name: /^Delete\b/ }).click();
    await f.changed(original);
    const removed = await f.doc();
    assert.equal(removed.drawing.dimensions.length, 0);
    await notice.waitFor();
    await f.snapshot('01-removal-notice');
    await f.undo();
    await f.same(original);
    if (!baseline) await notice.waitFor({ state: 'detached' });
    else assert.equal(await notice.count(), 1);
    await button('Drawing').click();
    await verify('02-restored', false);
    if (!baseline) {
      await f.redo();
      await f.same(removed);
      assert.equal(await notice.count(), 0);
      await f.undo();
      await f.same(original);
      f.phase = 'retain an unrelated tolerance notice across history';
      await button('Accept all suggestions').click();
      await f.changed(original);
      const unrelated = f.page.getByText(/^\d+ suggestions? accepted$/);
      await unrelated.waitFor();
      await f.undo();
      await f.same(original);
      assert.equal(await unrelated.count(), 1);
      assert.equal(await notice.count(), 0);
    }
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (deleted) {
    f.phase = 'open the source and read the current diameter';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    await verify('01-before-delete', false);
    for (const [action, suppress] of [['Suppress', true], ['Delete', false]]) {
      f.phase = `${action} the bore through Feature History`;
      await button('Model').click();
      await f.page.locator('.history .hs[data-node-index="2"]').click({ button: 'right' });
      await f.page.getByRole('menuitem', { name: new RegExp(`^${action}\\b`) }).click();
      await f.changed(original);
      if (!suppress) await f.page.getByText('Removed 2 drawing dimensions', { exact: true }).waitFor();
      await button('Drawing').click();
      const missing = await f.snapshot(`${action.toLowerCase()}-source`);
      const nodes = suppress ? [...original.nodes.slice(0, 2), { ...original.nodes[2], suppressed: true }] : original.nodes.slice(0, 2);
      assert.deepEqual(missing.doc.nodes, nodes);
      assert.deepEqual(missing.doc.drawing, { ...original.drawing, dimensions: suppress ? original.drawing.dimensions : [] });
      if (suppress) {
        assert.match(missing.drawing.dimensions.find(d => d.id === diameter.id).lost, /circle it measured is no longer/);
        assert.ok(missing.drawing.issues.some(i => i.code === 'DIMENSION_LOST'));
      }
      assert.ok(missing.drawing.issues.some(i => i.code === 'DETAIL_EMPTY'));
      assert.equal(await f.page.locator(locator).count(), 0);
      const svg = await capture('Export SVG'), dxf = await capture('Export DXF');
      const label = `${action.toLowerCase()}-output`;
      f.report.observations.push({ label, svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg), dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
      await f.runOracle({ svg, dxf, deleted: true }, label);
      f.phase = `restore the exact original bore after ${action}`;
      await button('Model').click();
      await f.undo();
      await f.same(original);
      await button('Drawing').click();
      await verify(`restored-after-${action.toLowerCase()}`, false);
    }
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (scaled) {
    f.phase = 'open the saved Detail diameter and change its scale';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    const scale = f.page.getByLabel('Detail B scale', { exact: true });
    await scale.selectOption('2');
    const reduced = { ...original, drawing: { ...original.drawing, details: [{ ...original.drawing.details[0], scale: 2 }] } };
    await f.same(reduced);
    await f.undo();
    await f.same(original);
    await f.redo();
    await f.same(reduced);
    const sites = [[44,16], [32,28], [24,16], [32,4]];
    for (const [i, [u,v]] of sites.entries()) {
      f.phase = `check source membership at label position ${i + 1}`;
      const before = await f.doc();
      if (i > 0) {
        const from = await f.page.locator(`${locator} text`).boundingBox();
        const to = await f.page.evaluate(([x,y]) => window.__studioDrawingAt('detail:B', x, y), [u,v]);
        assert.ok(from && to);
        await f.page.mouse.move(from.x+from.width/2, from.y+from.height/2);
        await f.page.mouse.down();
        await f.page.mouse.move(to.x, to.y, { steps: 8 });
        await f.page.mouse.up();
        await f.changed(before);
      }
      const state = await f.snapshot(`0${i + 1}-scale-2`);
      const [actual] = state.doc.drawing.dimensions;
      assert.ok(Math.hypot(actual.place[0]-u, actual.place[1]-v) < 1, JSON.stringify(actual.place));
      assert.deepEqual(state.doc, { ...reduced, drawing: { ...reduced.drawing,
        dimensions: [{ ...reduced.drawing.dimensions[0], place: actual.place }, reduced.drawing.dimensions[1]] } });
      assert.ok(Math.abs(state.drawing.dimensions.find(d => d.id === diameter.id).value - 8) < 1e-9);
      const svg = await capture('Export SVG');
      f.report.observations.push({ label: `scaled-${i + 1}`, bytes: Buffer.byteLength(svg), sha256: sha256(svg) });
      await f.runOracle({ svg, scaled: [2, ...actual.place] }, `scale-2-${i + 1}`);
    }
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (covered) {
    f.phase = 'open the saved covered bore with hidden lines off';
    await open(Buffer.from(JSON.stringify(doc)));
    const original = await f.doc();
    assert.equal(original.nodes.length, 5);
    assert.equal((await f.bodies()).bodies.length, 2);
    const off = async label => {
      const snapshot = await f.snapshot(label);
      assert.match(snapshot.drawing.dimensions.find(d => d.id === diameter.id).lost, /No drawable circular arc/);
      assert.ok(snapshot.drawing.issues.some(i => i.code === 'DIMENSION_LOST'));
      assert.equal(await f.page.locator(locator).count(), 0);
      await f.runOracle({ svg: await capture('Export SVG'), dxf: await capture('Export DXF'), hiddenOff: true }, label);
    };
    await off('01-hidden-off');
    f.phase = 'show hidden lines and restore the same authored diameter';
    await f.page.getByLabel('Hidden lines', { exact: true }).check();
    const shown = { ...original, drawing: { ...original.drawing, hidden: true } };
    await f.same(shown);
    await verify('02-hidden-on', false, true);
    await f.undo();
    await f.same(original);
    await off('03-undo-hidden-off');
    await f.redo();
    await f.same(shown);
    const saved = await capture('Save');
    assert.deepEqual(JSON.parse(saved), shown);
    await open(Buffer.from(saved));
    await f.same(shown);
    await verify('04-reopened-hidden-on', false, true);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  f.phase = 'open a native starter plate with the partial Top Detail';
  await open(Buffer.from(JSON.stringify(doc)));
  const source = await f.doc();
  const controlMarkup = () => f.page.locator('g.dimension[data-dim="top-diameter"]').innerHTML();
  const originalControl = await controlMarkup();
  await verify('01-original-anchor', false);
  f.phase = 'drag the label to the opposite side of the source circle';
  const from = await f.page.locator(`${locator} text`).boundingBox();
  const to = await f.page.evaluate(() => window.__studioDrawingAt('detail:B', 24, 16));
  assert.ok(from && to);
  await f.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await f.page.mouse.down();
  await f.page.mouse.move(to.x, to.y, { steps: 8 });
  const preview = await f.page.locator(`${locator} path[fill="#000"]`).getAttribute('d');
  await f.page.mouse.up();
  await f.changed(source);
  const moved = await f.doc();
  const [changed] = moved.drawing.dimensions;
  assert.ok(Math.abs(changed.place[0] - 24) < 0.3 && Math.abs(changed.place[1] - 16) < 0.3, JSON.stringify(changed.place));
  assert.deepEqual(moved, { ...source, drawing: { ...source.drawing,
    dimensions: [{ ...source.drawing.dimensions[0], place: changed.place }, source.drawing.dimensions[1]] } });
  assert.equal(await controlMarkup(), originalControl);
  assert.equal(await f.page.locator(`${locator} path[fill="#000"]`).getAttribute('d'), preview);
  await verify('02-opposite-anchor', baseline, true);
  if (!baseline) {
    f.phase = 'verify first Undo and Redo, and Save and fresh Open';
    await f.undo();
    await f.same(source);
    await verify('03-undo', false);
    await f.redo();
    await f.same(moved);
    const saved = await capture('Save');
    assert.deepEqual(JSON.parse(saved), moved);
    await open(Buffer.from(saved));
    await f.same(moved);
    await verify('04-reopened', false, true);
  }
  assert.deepEqual(f.report.downloads, []);
});
