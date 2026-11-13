import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--reopen'].includes(mode));
const reopen = mode === '--reopen';
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/drawing-section-trace-hit-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/drawing/drawing.css',
  'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/io/svg.ts',
];
const end = x => ({ edge: 'n1.side0|n1.top', at: 'end', near: [x, 0, 8] });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 12], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  drawing: {
    sheet: 'A3', scope: { kind: 'part' }, scale: 2, projection: 'third', hidden: true,
    section: { y: 6 }, title: 'Cutting plane and dimension',
    dimensions: [{ id: 'width', view: 'top', kind: 'linear', a: end(0), b: end(20),
      orient: 'horizontal', place: [10, 6] },
      ...(reopen ? [{ id: 'ordinary', view: 'front', kind: 'linear', a: end(0), b: end(20),
        orient: 'horizontal', place: [10, 13] }] : [])], views: ['front', 'top'],
    ...(reopen ? { notes: [{ id: 'n1', text: 'KEEP NOTE', at: [80, 75] }] } : {}),
  },
};
const f = await createFlow({
  name: 'drawing-section-trace-hit', output, envFrozen: reopen ? 'D933_SOURCE_FROZEN' : 'D932_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Select and drag the existing width dimension at the painted cutting-plane trace.',
  limits: ['One rectangular plate, one axial cutting plane and one width dimension on its Top view.'],
  snapshotExtra: () => ({
    box: document.querySelector('[aria-label="Drawing sheet"]')?.getAttribute('viewBox'),
    selected: [...document.querySelectorAll('[aria-label="Drawing sheet"] g.sel[data-dim]')].map(g => g.getAttribute('data-dim')),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    drawing: window.__studioDrawing?.(),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const sheet = () => f.page.locator('svg[aria-label="Drawing sheet"]');
const dimension = () => sheet().locator('g.dimension[data-dim="width"]');
const trace = () => sheet().locator('g.section[data-view][data-dim="A"]');
const cut = () => sheet().locator('g.section:not([data-view])[data-dim="A"]');

async function hitSites() {
  return sheet().evaluate(svg => {
    const trace = svg.querySelector('g.section[data-view][data-dim="A"] line');
    const dim = svg.querySelector('g.dimension[data-dim="width"]');
    const sheetPixels = svg.getBoundingClientRect();
    const line = ['x1', 'y1', 'x2', 'y2'].map(key => Number(trace.getAttribute(key)));
    const toScreen = (x, y) => new DOMPoint(x, y).matrixTransform(trace.getScreenCTM());
    const identity = element => element.closest('g[data-dim]')?.getAttribute('data-dim') ?? null;
    const hits = (x, y) => document.elementsFromPoint(x, y).map(identity).filter(Boolean);
    const painted = (x, y) => trace.isPointInStroke(new DOMPoint(x, y));
    const dimensionLines = [...dim.querySelectorAll('line')];
    const sites = [];
    for (let i = 0; i <= 600; i++) {
      const t = i / 600, x = line[0] + (line[2] - line[0]) * t, y = line[1] + (line[3] - line[1]) * t;
      const point = toScreen(x, y);
      if (point.x < sheetPixels.left + 60 || point.x > sheetPixels.right - 60 ||
        point.y < sheetPixels.top + 60 || point.y > sheetPixels.bottom - 60 || !painted(x, y)) continue;
      const stack = hits(point.x, point.y);
      const onDimension = dimensionLines.some(mark => mark.isPointInStroke(new DOMPoint(x, y)));
      sites.push({ pixel: [point.x, point.y], model: [x, y], stack, onDimension });
    }
    const overlaps = sites.filter(site => site.onDimension && site.stack.includes('width'));
    const onTrace = overlaps.filter(site => site.stack[0] === 'A');
    const overlap = onTrace[Math.floor(onTrace.length / 2)];
    const traceOnly = sites.find(site => !site.onDimension && !site.stack.includes('width'));
    return { line, overlap, traceOnly, box: svg.getAttribute('viewBox'), dimensionMarkup: dim.innerHTML, traceMarkup: trace.parentElement.innerHTML };
  });
}

async function drag(pixel, offset) {
  await f.page.mouse.move(...pixel);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await f.page.mouse.down();
  await f.page.mouse.move(pixel[0] + offset[0], pixel[1] + offset[1], { steps: 5 });
  await f.page.mouse.up();
}

async function reopenFlow() {
  const project = 'D933 section trace', file = 'D932-section-hit.bcad';
  const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const mode = name => f.page.locator('.mode').getByRole('button', { name, exact: true });
  const attach = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };

  f.phase = 'save the overlap fixture to the real browser project';
  await mode('Model').click();
  await attach();
  await button('Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const dir = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await dir.getFileHandle(file)).getFile()).arrayBuffer()));
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), source);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });

  f.phase = 'close and reload Studio, reopen the saved drawing';
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await f.page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(source);
  await mode('Drawing').click();
  await dimension().waitFor();
  await trace().waitFor();
  await cut().waitFor();
  const before = await f.snapshot('01-project-reopened');

  f.phase = 'keep ordinary dimension, Note and trace-only pan input';
  const regular = sheet().locator('g.dimension[data-dim="ordinary"] text');
  const note = sheet().locator('g.note[data-dim="n1"] text');
  await regular.click();
  assert.equal(await sheet().locator('g.dimension.sel[data-dim="ordinary"]').count(), 1);
  await note.click();
  assert.equal(await sheet().locator('g.note.sel[data-dim="n1"]').count(), 1);
  const originalSite = await hitSites();
  assert.ok(originalSite.traceOnly);
  await drag(originalSite.traceOnly.pixel, [30, 20]);
  assert.deepEqual(await f.doc(), source);
  assert.notEqual(await sheet().getAttribute('viewBox'), before.box);
  await button('Fit sheet').click();

  f.phase = 'move the overlapped dimension from the saved position';
  const overlap = (await hitSites()).overlap;
  assert.ok(overlap);
  await drag(overlap.pixel, [0, -32]);
  await f.changed(source);
  const moved = await f.snapshot('02-reopened-dimension-drag');
  assert.equal(moved.box, before.box);
  assert.deepEqual(moved.selected, ['width']);
  const expected = structuredClone(source);
  expected.drawing.dimensions[0].place = moved.doc.drawing.dimensions[0].place;
  assert.notDeepEqual(expected.drawing.dimensions[0].place, source.drawing.dimensions[0].place);
  assert.deepEqual(moved.doc, expected);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(expected);
  assert.deepEqual(f.report.downloads, []);
}

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
    await context.addInitScript(() => {
      const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__d932Exports = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        if (!this.download.endsWith('.svg') || !urls.has(this.href)) return click.call(this);
        const { download } = this;
        void urls.get(this.href).text().then(text => window.__d932Exports.push({ download, text }));
      };
    });
    return context;
  };
  await f.newPage();
  f.phase = 'open the retained rectangle and drawing';
  const buffer = Buffer.from(JSON.stringify(source));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D932-section-hit.bcad', mimeType: 'application/json', buffer });
  await f.same(source);
  await button('Drawing').click();
  await dimension().waitFor();
  await trace().waitFor();
  await cut().waitFor();
  assert.match(await dimension().textContent(), /20/);
  if (reopen) { await reopenFlow(); return; }
  const before = await f.snapshot('01-drawing-before');
  f.phase = 'find the painted overlap and exercise actual pointer input';
  const site = await hitSites();
  f.report.observations.push({ label: 'painted-hit-sites', ...site });
  await f.persist();
  assert.ok(site.overlap, 'the painted trace intersects the existing dimension');
  assert.ok(site.traceOnly, 'a separate painted trace point is available for pan');
  assert.equal(site.overlap.stack[0], 'A');
  await f.page.evaluate(() => {
    window.__d932PointerHits = [];
    document.querySelector('[aria-label="Drawing sheet"]').addEventListener('pointerdown', event => {
      window.__d932PointerHits.push(event.target.closest('g[data-dim]')?.getAttribute('data-dim') ?? null);
    });
  });
  await f.page.mouse.click(...site.overlap.pixel);
  const clicked = await f.snapshot('02-click');
  assert.deepEqual(clicked.doc, source);
  assert.equal(clicked.dirty, before.dirty);
  assert.deepEqual(clicked.history, before.history);
  assert.deepEqual([...new Set(clicked.selected)], [baseline ? 'A' : 'width']);
  // The first pointer sequence may replace the SVG children. Re-read the painted site before the drag.
  const start = await hitSites();
  assert.ok(start.overlap);
  await drag(start.overlap.pixel, [0, -32]);
  const pointerHits = await f.page.evaluate(() => window.__d932PointerHits);
  f.report.observations.push({ label: 'actual-pointer-targets', pointerHits });
  if (baseline) assert.equal(pointerHits[0], 'A');
  else assert.deepEqual(pointerHits, ['A', 'A']);
  if (baseline) {
    assert.deepEqual(await f.doc(), source);
    const panned = await f.snapshot('03-parent-pans');
    assert.notEqual(panned.box, before.box);
    return;
  }

  await f.changed(source);
  const moved = await f.snapshot('03-moved-dimension');
  assert.equal(moved.box, before.box);
  assert.deepEqual(moved.selected, ['width']);
  const [changed] = moved.doc.drawing.dimensions;
  assert.notDeepEqual(changed.place, source.drawing.dimensions[0].place);
  assert.deepEqual(moved.doc, { ...source, drawing: { ...source.drawing,
    dimensions: [{ ...source.drawing.dimensions[0], place: changed.place }] } });
  assert.equal((await hitSites()).traceMarkup, site.traceMarkup);
  assert.match(await dimension().textContent(), /20/);
  await button('Export SVG').click();
  await f.page.waitForFunction(() => window.__d932Exports.length === 1);
  const [exported] = await f.page.evaluate(() => window.__d932Exports);
  const read = await f.page.evaluate(text => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    return { width: svg.documentElement.getAttribute('width'), height: svg.documentElement.getAttribute('height'),
      dimension: svg.querySelector('g.dimension[data-dim="width"]')?.textContent,
      traceLines: svg.querySelectorAll('g.section[data-view][data-dim="A"] line').length,
      cut: svg.querySelectorAll('g.section:not([data-view])[data-dim="A"]').length };
  }, exported.text);
  assert.deepEqual(read, { width: '420mm', height: '297mm', dimension: '20', traceLines: 5, cut: 1 });
  f.report.observations.push({ label: 'emitted-svg', bytes: Buffer.byteLength(exported.text), sha256: sha256(exported.text), ...read });
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(moved.doc);
  const after = await hitSites();
  await drag(after.traceOnly.pixel, [30, 20]);
  await f.same(moved.doc);
  const panned = await f.snapshot('04-trace-only-pans');
  assert.notEqual(panned.box, moved.box);
  assert.deepEqual(panned.selected, []);
  assert.deepEqual(f.report.downloads, []);
});
