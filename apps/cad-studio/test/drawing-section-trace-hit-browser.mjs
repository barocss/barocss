import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--reopen', '--annotations', '--detached-views', '--ownership', '--annotation-keys-baseline', '--annotation-keys-fixed', '--annotation-identity-baseline', '--annotation-identity-fixed', '--note-sheet-baseline', '--note-sheet-fixed', '--note-escape-baseline', '--note-escape-fixed', '--annotation-overlap'].includes(mode));
const reopen = mode === '--reopen';
const baseline = mode === '--baseline';
const overlap = mode === '--annotation-overlap';
const annotations = overlap || mode === '--annotations';
const detachedViews = mode === '--detached-views';
const ownership = mode === '--ownership';
const noteEscape = mode.startsWith('--note-escape-');
const noteSheet = noteEscape || mode.startsWith('--note-sheet-');
const annotationIdentity = mode.startsWith('--annotation-identity-');
const annotationKeys = noteSheet || annotationIdentity || mode.startsWith('--annotation-keys-');
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
    ...(detachedViews || ownership ? {
      sections: [{ id: 'A', view: 'front', at: 6, removed: { at: [295, 95], scale: 2 } }],
      details: [{ id: 'B', view: 'top', center: [2, 6], radius: 4, scale: 3, at: [302, 165] }],
    } : { section: { y: 6 } }),
    ...(annotationKeys ? { sheets: [{ id: 'S2', views: ['right'] }] } : {}),
    ...(ownership ? { sheets: [{ id: 'S2', scale: 2, views: ['section:A', 'detail:B'] }] } : {}),
    title: 'Cutting plane and dimension',
    dimensions: [{ id: 'width', view: 'top', kind: 'linear', a: end(0), b: end(20),
      orient: 'horizontal', place: [10, 6] },
      ...(reopen ? [{ id: 'ordinary', view: 'front', kind: 'linear', a: end(0), b: end(20),
        orient: 'horizontal', place: [10, 13] }] : [])], views: annotationKeys ? ['front', 'top', 'right'] : ['front', 'top'],
    ...(reopen ? { notes: [{ id: 'n1', text: 'KEEP NOTE', at: [80, 75] }] } : {}),
    ...(annotationKeys ? { notes: [{ id: annotationIdentity ? 'width' : 'n1', text: 'KEEP NOTE', at: [80, 75] }, { id: 'n2', text: 'OTHER SHEET', at: [90, 80], ...(noteSheet ? { leader: { view: 'right', at: [6, 4] } } : { sheet: 'S2' }) }] } : {}),
    ...(annotations || annotationKeys ? {
      datumTargets: [{ id: 'target-1', kind: 'line', letter: 'B', number: 1, view: 'top', line: { from: [2, 6], to: [8, 6] }, place: [-12, 6] }],
      frames: [{ id: 'frame-1', view: 'top', characteristic: 'flatness', value: 0.07, datums: [], place: [14, 6] }],
    } : {}),
  },
};
const f = await createFlow({
  name: 'drawing-section-trace-hit', output, envFrozen: overlap ? 'D988_SOURCE_FROZEN' : noteEscape ? 'D987_SOURCE_FROZEN' : noteSheet ? 'D986_SOURCE_FROZEN' : annotationIdentity ? 'D985_SOURCE_FROZEN' : annotationKeys ? 'D984_SOURCE_FROZEN' : ownership ? 'D955_SOURCE_FROZEN' : detachedViews ? 'D954_SOURCE_FROZEN' : annotations ? 'D953_SOURCE_FROZEN' : reopen ? 'D933_SOURCE_FROZEN' : 'D932_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: overlap ? 'Delete the visible annotation selected where it overlaps the cutting-plane trace.' : noteEscape ? 'Cancel a Drawing Note draft with Escape and keep explicit text commits.' : noteSheet ? 'Preserve second-sheet Note ownership when removing a leader or duplicating.' : annotationIdentity ? 'Select and delete the correct kind when a Note and dimension share an ID.' : annotationKeys ? 'Keyboard-select and delete only the current Drawing annotation.' : ownership ? 'Clear section-trace selection across sheet tabs and document Open.' : detachedViews ? 'Drag and cancel a removed section and a detail on the sectioned sheet.' : annotations ? 'Select a datum target and a standalone frame where each crosses the painted cutting-plane trace.'
    : 'Select and drag the existing width dimension at the painted cutting-plane trace.',
  limits: [ownership ? 'Two sectioned plates reuse Section A and dimension width IDs across files; Section A spans two sheets.' : detachedViews ? 'One removed section and one circular detail on the same sheet.' : annotations ? 'One line datum target and one standalone flatness frame on the Top view of one sectioned plate.'
    : 'One rectangular plate, one axial cutting plane and one width dimension on its Top view.'],
  snapshotExtra: () => ({
    box: document.querySelector('[aria-label="Drawing sheet"]')?.getAttribute('viewBox'),
    selected: [...document.querySelectorAll('[aria-label="Drawing sheet"] g.sel[data-dim]')].map(g => g.getAttribute('data-dim')),
    selectedTargets: [...document.querySelectorAll('[aria-label="Drawing sheet"] g.sel[data-datum-target]')].map(g => g.getAttribute('data-datum-target')),
    selectedFrames: [...document.querySelectorAll('[aria-label="Drawing sheet"] g.sel[data-standalone-frame]')].map(g => g.getAttribute('data-standalone-frame')),
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

async function annotationFlow(initial) {
  const target = sheet().locator('g[data-datum-target="target-1"]');
  const frame = sheet().locator('g[data-standalone-frame="frame-1"]');
  const loaded = await f.doc();
  const before = await f.snapshot('01-annotations');
  const sectionMarkup = await trace().innerHTML();
  const svgBefore = await exportSvg();
  await sheet().evaluate(svg => {
    window.__d953PointerHits = [];
    svg.addEventListener('pointerdown', ({ target }) => {
      const mark = target.closest('g.section,g[data-datum-target],g[data-standalone-frame]');
      window.__d953PointerHits.push(mark?.getAttribute('data-dim') ?? mark?.getAttribute('data-datum-target') ??
        mark?.getAttribute('data-standalone-frame') ?? null);
    });
  });
  const cases = [
    { label: 'datum-target', group: target, attr: 'data-datum-target', id: 'target-1', selection: 'selectedTargets' },
    { label: 'standalone-frame', group: frame, attr: 'data-standalone-frame', id: 'frame-1', selection: 'selectedFrames' },
  ];
  for (const [index, { label, group, attr, id, selection }] of cases.entries()) {
    f.phase = `select the ${label} in the actual drawing`;
    await group.waitFor();
    const beforePick = overlap ? await f.snapshot(`before-${label}-selection`) : before;
    const site = await sheet().evaluate((svg, { attr, id }) => {
      const target = svg.querySelector(`g[${attr}="${id}"]`);
      const trace = svg.querySelector('g.section[data-view][data-dim="A"] line');
      const matrix = trace.getScreenCTM();
      const values = ['x1', 'y1', 'x2', 'y2'].map(k => Number(trace.getAttribute(k)));
      for (let i = 0; i <= 1200; i++) {
        const t = i / 1200, x = values[0] + t * (values[2] - values[0]), y = values[1] + t * (values[3] - values[1]);
        if (!trace.isPointInStroke(new DOMPoint(x, y))) continue;
        const p = new DOMPoint(x, y).matrixTransform(matrix);
        const stack = document.elementsFromPoint(p.x, p.y);
        const interactive = stack.map(element => element.closest('g[data-datum-target],g[data-standalone-frame],g[data-dim]')).filter(Boolean);
        if (interactive.includes(target) && interactive.find(g => !g.classList.contains('section')) === target) {
          return { x: p.x, y: p.y, traceFirst: interactive[0].classList.contains('section') };
        }
      }
      return null;
    }, { attr, id });
    assert.ok(site, `painted trace overlaps the ${label}`);
    if (!overlap) assert.equal(site.traceFirst, index === 0);
    await f.page.mouse.click(site.x, site.y);
    const pointerHit = await f.page.evaluate(index => window.__d953PointerHits[index], index);
    assert.equal(pointerHit, site.traceFirst ? 'A' : id);
    const selected = await f.snapshot(`02-${label}`);
    assert.deepEqual(selected[selection], [id]);
    assert.deepEqual(selected.selected, []);
    assert.deepEqual(selected[selection === 'selectedTargets' ? 'selectedFrames' : 'selectedTargets'], []);
    assert.equal(selected.box, before.box);
    assert.equal(selected.dirty, beforePick.dirty);
    assert.deepEqual(selected.history, beforePick.history);
    assert.deepEqual(selected.doc, loaded);
    f.report.observations.push({ label, paintedOverlap: site, pointerHit });
    if (overlap) {
      await f.page.keyboard.press('Delete');
      await f.changed(loaded);
      const expected = structuredClone(loaded);
      if (label === 'datum-target') delete expected.drawing.datumTargets;
      else delete expected.drawing.frames;
      await f.same(expected);
      assert.equal(await group.count(), 0);
      await f.snapshot(`03-${label}-deleted-only`);
      await f.undo();
      await f.same(loaded);
      await f.redo();
      await f.same(expected);
      await f.undo();
      await f.same(loaded);
    }
  }
  assert.equal(await trace().innerHTML(), sectionMarkup);
  assert.equal(await exportSvg(), svgBefore);
  f.report.observations.push({ label: 'unchanged-svg', bytes: Buffer.byteLength(svgBefore), sha256: sha256(svgBefore) });
  assert.deepEqual(await f.doc(), initial);
  assert.deepEqual(f.report.downloads, []);
}

async function detachedViewFlow() {
  const original = await f.doc();
  const detail = sheet().locator('g.detail[data-view="detail:B"]');
  await detail.waitFor();
  const groups = [
    { label: 'removed-section', locator: cut(), selector: 'g.section:not([data-view])[data-dim="A"]',
      start: original.drawing.sections[0].removed.at, move: (doc, at) => { doc.drawing.sections[0].removed.at = at; } },
    { label: 'detail', locator: detail, selector: 'g.detail[data-view="detail:B"]',
      start: original.drawing.details[0].at, move: (doc, at) => { doc.drawing.details[0].at = at; } },
  ];
  const sectionMarkup = await trace().innerHTML();
  const widthMarkup = await dimension().innerHTML();
  const before = await f.snapshot('01-detached-views');
  const beforeSvg = await exportSvg();
  const expectedKeys = () => f.page.evaluate(() =>
    ['Undo', 'Redo'].map(name => !document.querySelector(`button[aria-label="${name}"]`)?.disabled));
  const originalKeys = await expectedKeys();
  const siteAt = at => sheet().evaluate((svg, at) => {
    const ctm = svg.getScreenCTM();
    const p = new DOMPoint(...at).matrixTransform(ctm);
    return { pixel: [p.x, p.y], scale: ctm.a };
  }, at);
  for (const { label, locator, selector, start, move } of groups) {
    const site = await siteAt(start);
    const delta = [34, -23];
    const at = start.map((value, axis) => Math.round((value + delta[axis] / site.scale) * 10) / 10);
    const expected = structuredClone(original);
    move(expected, at);
    const oldMarkup = await locator.innerHTML();
    const other = groups.find(group => group.label !== label);
    const otherMarkup = await other.locator.innerHTML();
    const begin = async () => {
      await f.page.mouse.move(...site.pixel);
      await f.page.mouse.down();
      await f.page.mouse.move(site.pixel[0] + delta[0], site.pixel[1] + delta[1], { steps: 5 });
      await f.page.waitForFunction(({ selector, oldMarkup }) =>
        document.querySelector(selector)?.innerHTML !== oldMarkup, { selector, oldMarkup });
      assert.deepEqual(await f.doc(), original, 'preview is not committed');
      assert.equal(await other.locator.innerHTML(), otherMarkup);
    };
    f.phase = `drag the ${label} using the desktop pointer`;
    await begin();
    await f.page.mouse.up();
    await f.ready();
    const moved = await f.snapshot(`02-${label}-moved`);
    assert.deepEqual(moved.doc, expected);
    assert.equal(moved.box, before.box);
    assert.deepEqual(moved.selected, []);
    assert.equal(await trace().innerHTML(), sectionMarkup);
    assert.equal(await dimension().innerHTML(), widthMarkup);
    const movedSvg = await exportSvg();
    assert.notEqual(movedSvg, beforeSvg);
    await f.undo();
    assert.deepEqual(await f.doc(), original);
    assert.equal(await exportSvg(), beforeSvg);
    await f.redo();
    assert.deepEqual(await f.doc(), expected);
    await f.undo();
    assert.deepEqual(await f.doc(), original);

    f.phase = `cancel a live ${label} preview with Escape`;
    const historyBeforeCancel = await expectedKeys();
    await begin();
    await f.page.keyboard.press('Escape');
    await f.page.mouse.up();
    await f.ready();
    const canceled = await f.snapshot(`03-${label}-canceled`);
    assert.deepEqual(canceled.doc, original, 'Escape and pointer-up must leave the document unchanged');
    assert.deepEqual(await expectedKeys(), historyBeforeCancel);
    assert.equal(canceled.box, before.box);
    assert.equal(await locator.innerHTML(), oldMarkup);
    assert.equal(await exportSvg(), beforeSvg);
    f.report.observations.push({ label, at, originalKeys, historyBeforeCancel, movedSvgSHA256: sha256(movedSvg) });
  }
  assert.deepEqual(f.report.downloads, []);
}

async function openDrawingFile(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function ownershipFlow() {
  const original = await f.doc();
  const tab = index => f.page.getByRole('tab', { name: `Sheet ${index}`, exact: true });
  const active = async index => assert.equal(await tab(index).getAttribute('aria-selected'), 'true');
  const selection = async () => sheet().locator('g.sel[data-dim]').evaluateAll(groups =>
    groups.map(group => group.getAttribute('data-dim')));
  const overlapOnActiveSheet = async value => {
    assert.match(await dimension().textContent(), new RegExp(`\\b${value}\\b`));
    const sites = await hitSites();
    assert.ok(sites.overlap, 'painted section trace overlaps the active width');
    await f.page.mouse.click(...sites.overlap.pixel);
    assert.deepEqual([...new Set(await selection())], ['width']);
    return sites.overlap.pixel;
  };
  f.phase = 'select the width through the Section A trace on Sheet 1';
  await active(1);
  await cut().waitFor({ state: 'detached' });
  const before = await f.snapshot('01-sheet-1');
  const svg1 = await exportSvg();
  const first = await overlapOnActiveSheet(20);

  f.phase = 'switch to the sheet with the same Section A cut result';
  await tab(2).click();
  await cut().waitFor();
  await trace().waitFor({ state: 'detached' });
  await dimension().waitFor({ state: 'detached' });
  await active(2);
  const otherSheet = await f.snapshot('02-sheet-2');
  assert.deepEqual(otherSheet.selected, []);
  assert.deepEqual(otherSheet.doc, original);
  assert.equal(otherSheet.dirty, before.dirty);
  const svg2 = await exportSvg();
  assert.notEqual(svg2, svg1);
  assert.match(svg1, /SEE SHEET 2/);
  assert.match(svg2, /FROM SHEET 1/);

  f.phase = 'pan blank paper without carrying selection or committing an edit';
  const blank = await sheet().evaluate(svg => {
    const pixel = new DOMPoint(85, 75).matrixTransform(svg.getScreenCTM());
    return { pixel: [pixel.x, pixel.y], target: document.elementFromPoint(pixel.x, pixel.y)?.getAttribute('class') };
  });
  assert.equal(blank.target, 'dw-sheet');
  await drag(blank.pixel, [28, 17]);
  const panned = await f.snapshot('03-blank-paper-pan');
  assert.notEqual(panned.box, otherSheet.box);
  assert.deepEqual(panned.selected, []);
  assert.deepEqual(panned.doc, original);
  assert.equal(await exportSvg(), svg2);

  f.phase = 'return to Sheet 1, then open another document with the same IDs';
  await tab(1).click();
  await button('Fit sheet').click();
  await trace().waitFor();
  const returned = await f.snapshot('04-returned-sheet-1');
  assert.deepEqual(returned.selected, []);
  assert.deepEqual(returned.doc, original);
  assert.equal(await exportSvg(), svg1);
  await overlapOnActiveSheet(20);
  const replacement = structuredClone(source);
  replacement.nodes[0].max[0] = 24;
  replacement.drawing.title = 'Another sectioned plate';
  replacement.drawing.dimensions[0].b = end(24);
  replacement.drawing.dimensions[0].place = [12, 6];
  await openDrawingFile('D955-another-plate.bcad', replacement);
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'Another sectioned plate');
  await f.ready();
  if (!(await sheet().isVisible())) await button('Drawing').click();
  await dimension().waitFor();
  await trace().waitFor();
  await active(1);
  const swapped = await f.snapshot('05-replacement');
  assert.deepEqual(swapped.selected, []);
  assert.deepEqual(swapped.doc, replacement);
  assert.match(await dimension().textContent(), /24/);
  const newSvg = await exportSvg();
  assert.notEqual(newSvg, svg1);
  const second = await overlapOnActiveSheet(24);
  assert.deepEqual(await f.doc(), replacement);
  assert.equal(await exportSvg(), newSvg);
  await f.snapshot('06-replacement-selected');
  f.report.observations.push({ label: 'ownership', first, second, widthsMM: [20, 24],
    firstSheetSvgSHA256: sha256(svg1), secondSheetSvgSHA256: sha256(svg2), replacementSvgSHA256: sha256(newSvg) });
  assert.deepEqual(f.report.downloads, []);
}

async function noteEscapeFlow() {
  const page = f.page;
  const original = await f.doc();
  const tab = index => page.getByRole('tab', { name: `Sheet ${index}`, exact: true });
  const note = page.getByRole('button', { name: /^OTHER SHEET/ });
  const text = page.getByLabel('Note text', { exact: true });
  await tab(2).click();
  await note.press('Enter');
  const history = async () => [await button('Undo').isEnabled(), await button('Redo').isEnabled()];
  const before = await history();
  f.phase = 'cancel an edited second-sheet Note with Escape';
  await text.fill('DO NOT APPLY');
  await text.press('Escape');
  if (mode.endsWith('baseline')) {
    await f.changed(original);
    assert.equal((await f.doc()).drawing.notes.find(n => n.id === 'n2').text, 'DO NOT APPLY');
    await f.snapshot('escape-committed-note-text');
    assert.fail('Escape committed the Note text and wrote a history entry');
  }
  await f.same(original);
  assert.equal(await text.inputValue(), 'OTHER SHEET');
  assert.equal(await note.getAttribute('aria-pressed'), 'true');
  assert.ok(await note.evaluate(element => document.activeElement === element));
  assert.deepEqual(await history(), before);
  await f.snapshot('escaped-note-edit-kept-original');

  f.phase = 'commit a later edit using Command+Enter and undo it';
  await text.fill('CONFIRMED NOTE');
  await text.press('Meta+Enter');
  await f.changed(original);
  const changed = await f.doc();
  assert.deepEqual(changed.drawing.notes, original.drawing.notes.map(n =>
    n.id === 'n2' ? { ...n, text: 'CONFIRMED NOTE' } : n));
  await f.undo();
  await f.same(original);
  await f.redo();
  await f.same(changed);
  await tab(1).click();
  assert.deepEqual(await sheet().locator('g.note text').allTextContents(), ['KEEP NOTE']);
  await tab(2).click();
  assert.deepEqual(await sheet().locator('g.note text').allTextContents(), ['CONFIRMED NOTE']);
  await f.snapshot('confirmed-note-edit-redone');
}

async function noteSheetFlow() {
  const page = f.page;
  const original = await f.doc();
  const notes = () => sheet().locator('g.note').evaluateAll(groups => groups.map(group => group.textContent));
  const sheetTab = index => page.getByRole('tab', { name: `Sheet ${index}`, exact: true });
  const noteRow = () => page.getByRole('button', { name: /^OTHER SHEET/ });
  await sheetTab(2).click();
  await noteRow().press('Enter');
  f.phase = 'remove the leader from the second-sheet Note';
  await button('Remove leader').click();
  await f.changed(original);
  const detached = await f.doc();
  const note = detached.drawing.notes.find(n => n.id === 'n2');
  assert.equal(note.leader, undefined);
  if (mode.endsWith('baseline')) {
    assert.equal(note.sheet, undefined);
    await sheetTab(1).click();
    assert.ok((await notes()).includes('OTHER SHEET'));
    await f.snapshot('leader-removal-moved-note-to-sheet-one');
    assert.fail('Removing the leader moved the Note from Sheet 2 to Sheet 1');
  }
  assert.deepEqual(note, { id: 'n2', text: 'OTHER SHEET', at: [90, 80], sheet: 'S2' });
  assert.deepEqual(await notes(), ['OTHER SHEET']);
  await f.undo();
  await f.same(original);
  await f.redo();
  await f.same(detached);
  await f.undo();
  await f.same(original);

  f.phase = 'duplicate a led Note without changing its sheet or replacing another Note';
  await noteRow().press('Enter');
  await button('Duplicate note').click();
  await f.changed(original);
  const copied = await f.doc();
  const duplicate = copied.drawing.notes.find(n => !original.drawing.notes.some(before => before.id === n.id));
  assert.ok(duplicate);
  assert.deepEqual(duplicate.leader, original.drawing.notes[1].leader);
  assert.equal(duplicate.text, 'OTHER SHEET');
  assert.deepEqual(copied.drawing.notes.filter(n => n.id !== duplicate.id), original.drawing.notes);
  assert.deepEqual(await notes(), ['OTHER SHEET', 'OTHER SHEET']);
  await f.snapshot('second-sheet-note-duplicate');
  await f.undo();
  await f.same(original);
  await f.redo();
  await f.same(copied);

  f.phase = 'duplicate a Note after removing its leader on Sheet 2';
  await f.undo();
  await f.same(original);
  await noteRow().press('Enter');
  await button('Remove leader').click();
  await f.same(detached);
  await noteRow().press('Enter');
  await button('Duplicate note').click();
  await f.changed(detached);
  const freeCopy = await f.doc();
  const added = freeCopy.drawing.notes.find(n => !detached.drawing.notes.some(before => before.id === n.id));
  assert.ok(added);
  assert.equal(added.sheet, 'S2');
  assert.equal(added.leader, undefined);
  await sheetTab(1).click();
  assert.deepEqual(await notes(), ['KEEP NOTE']);
  await sheetTab(2).click();
  assert.deepEqual(await notes(), ['OTHER SHEET', 'OTHER SHEET']);
  await f.snapshot('second-sheet-free-note-duplicate');
  await f.undo();
  await f.same(detached);
  await f.redo();
  await f.same(freeCopy);
}

async function annotationIdentityFlow() {
  const page = f.page;
  const original = await f.doc();
  const note = sheet().locator('g.note[data-dim="width"]');
  const mark = dimension();
  const widthRow = page.getByRole('button', { name: /20.*horizontal · top/ });
  const noteRow = page.getByRole('button', { name: /^KEEP NOTE/ });
  const selected = () => sheet().locator('g.sel[data-dim="width"]').evaluateAll(
    groups => groups.map(group => group.getAttribute('class')));
  f.phase = 'select width by keyboard with a same-ID Note present';
  await widthRow.press('Enter');
  await mark.locator('text').waitFor();
  if (mode.endsWith('baseline')) {
    assert.deepEqual(await selected(), ['dimension sel', 'note sel']);
    await page.keyboard.press('Delete');
    await f.changed(original);
    assert.equal((await f.doc()).drawing.dimensions.length, 1);
    assert.equal((await f.doc()).drawing.notes.some(n => n.id === 'width'), false);
    await f.snapshot('same-id-dimension-deleted-note');
    assert.fail('The dimension and Note shared selection and Delete removed the Note');
  }
  assert.deepEqual(await selected(), ['dimension sel']);
  await page.keyboard.press('Delete');
  await f.changed(original);
  const withoutDimension = await f.doc();
  assert.equal(withoutDimension.drawing.dimensions.length, 0);
  assert.deepEqual(withoutDimension.drawing.notes, original.drawing.notes);
  await f.undo();
  await f.same(original);
  await mark.waitFor();

  f.phase = 'select the Note on the sheet with its same-ID dimension visible';
  const pixel = await note.locator('text').evaluate(text => {
    const r = text.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.click(...pixel);
  await page.getByLabel('Note text', { exact: true }).waitFor();
  assert.deepEqual(await selected(), ['note sel']);
  assert.equal(await noteRow.getAttribute('aria-pressed'), 'true');
  assert.equal(await widthRow.getAttribute('aria-pressed'), 'false');
  await f.snapshot('same-id-note-only-selected');
  await page.keyboard.press('Delete');
  await f.changed(original);
  const withoutNote = await f.doc();
  assert.deepEqual(withoutNote.drawing.dimensions, original.drawing.dimensions);
  assert.deepEqual(withoutNote.drawing.notes, original.drawing.notes.filter(n => n.id !== 'width'));
  assert.deepEqual(withoutNote.drawing.frames, original.drawing.frames);
  assert.deepEqual(withoutNote.drawing.datumTargets, original.drawing.datumTargets);
  await f.undo();
  await f.same(original);
  await f.redo();
  await f.same(withoutNote);
  await f.snapshot('same-id-note-deletion-redone');
}

async function annotationKeyboardFlow() {
  const page = f.page;
  const original = await f.doc();
  const target = page.getByRole('button', { name: /^Target B1/ });
  const frame = page.getByRole('button', { name: /^Frame 1 · flatness/ });
  const width = page.getByRole('button', { name: /20.*horizontal · top/ });
  const note = page.getByRole('button', { name: /^KEEP NOTE/ });
  const checkPicked = async ({ dim = [], targets = [], frames = [] }) => {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const picked = await sheet().locator('g.sel').evaluateAll(groups => ({
      dim: groups.filter(group => group.matches('g.dimension')).map(group => group.getAttribute('data-dim')),
      targets: groups.filter(group => group.hasAttribute('data-datum-target')).map(group => group.getAttribute('data-datum-target')),
      frames: groups.filter(group => group.hasAttribute('data-standalone-frame')).map(group => group.getAttribute('data-standalone-frame')),
    }));
    assert.deepEqual(picked, { dim, targets, frames });
  };
  f.phase = 'select B1 and then the width row using only the keyboard';
  await frame.press('Enter');
  await target.press('Space');
  if (mode.endsWith('baseline')) {
    await checkPicked({ targets: ['target-1'] });
    await width.press('Enter');
    await checkPicked({ targets: ['target-1'] });
    await page.keyboard.press('Delete');
    await f.changed(original);
    const lost = await f.doc();
    assert.equal(lost.drawing.datumTargets?.length ?? 0, 0);
    assert.equal(lost.drawing.dimensions[0].id, 'width');
    await f.snapshot('width-key-deleted-prior-target');
    assert.fail('The width row ignored Enter, so Delete removed the previously selected B1 target');
  }
  await checkPicked({ targets: ['target-1'] });
  await width.press('Enter');
  await checkPicked({ dim: ['width'] });
  await width.press('Space');
  await checkPicked({ dim: ['width'] });
  await page.keyboard.press('Delete');
  await f.changed(original);
  const noWidth = await f.doc();
  assert.equal(noWidth.drawing.dimensions.length, 0);
  assert.deepEqual(noWidth.drawing.datumTargets, original.drawing.datumTargets);
  assert.deepEqual(noWidth.drawing.frames, original.drawing.frames);
  assert.deepEqual(noWidth.drawing.notes, original.drawing.notes);
  await f.undo();
  await f.same(original);
  await dimension().waitFor();

  f.phase = 'select a Note from the keyboard and delete only that Note';
  await width.press('Enter');
  await note.press('Space');
  await checkPicked({});
  await page.getByLabel('Note text', { exact: true }).waitFor();
  await page.keyboard.press('Delete');
  await f.changed(original);
  const noNote = await f.doc();
  assert.deepEqual(noNote.drawing.notes, original.drawing.notes.filter(n => n.id !== 'n1'));
  assert.deepEqual(noNote.drawing.dimensions, original.drawing.dimensions);
  assert.deepEqual(noNote.drawing.frames, original.drawing.frames);
  assert.deepEqual(noNote.drawing.sheets, original.drawing.sheets);
  await f.snapshot('note-key-deleted-only-current-note');
  await f.undo();
  await f.same(original);
  await f.redo();
  await f.same(noNote);
  assert.deepEqual(f.report.downloads, []);
}

async function exportSvg() {
  const count = await f.page.evaluate(() => window.__d932Exports.length);
  await button('Export SVG').click();
  await f.page.waitForFunction(count => window.__d932Exports.length > count, count);
  return f.page.evaluate(count => window.__d932Exports[count].text, count);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
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
  await openDrawingFile('D932-section-hit.bcad', source);
  if (annotations || annotationKeys) {
    await f.page.waitForFunction(() => window.__studioDoc?.drawing?.datumTargets?.length === 1);
    await f.ready();
    assert.deepEqual(await f.doc(), source);
  } else if (detachedViews || ownership) {
    await f.page.waitForFunction(() => window.__studioDoc?.drawing?.details?.[0]?.id === 'B');
    await f.ready();
    assert.deepEqual(await f.doc(), source);
  } else await f.same(source);
  await button('Drawing').click();
  await dimension().waitFor();
  await trace().waitFor();
  if (!ownership) await cut().waitFor();
  assert.match(await dimension().textContent(), /20/);
  if (noteEscape) { await noteEscapeFlow(); return; }
  if (noteSheet) { await noteSheetFlow(); return; }
  if (annotationIdentity) { await annotationIdentityFlow(); return; }
  if (annotationKeys) { await annotationKeyboardFlow(); return; }
  if (annotations) { await annotationFlow(source); return; }
  if (detachedViews) { await detachedViewFlow(); return; }
  if (ownership) { await ownershipFlow(); return; }
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
