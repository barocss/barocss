// D757: preview a live edge for a lost drawing dimension before confirming it.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const guards = mode === '--guards';
const pins = [
  'apps/cad-studio/test/drawing-reference-candidate-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/ReferenceDecisions.tsx',
  'apps/cad-studio/src/ui/drawing/referenceCandidate.ts',
  'packages/barocss-cad-model/src/engine/references.ts', 'packages/barocss-cad-model/src/drawing/dimensions.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { drawingInputs } from '@barocss/cad-model/chat/drawing';
import { resolveDimension } from '@barocss/cad-model/drawing/dimensions';
import { emptyDoc, prefixDoc, type ModelNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { captureSignatures, verifyReferences } from '@barocss/cad-model/engine/references';

const box = (sketch: number, ymin: number, ymax: number): ModelNode[] => [
  { kind: 'sketch', profile: 'rectangle', min: [0, ymin], max: [40, ymax] },
  { kind: 'extrude', sketch, height: 20 },
];
const document = (nodes: ModelNode[]) => prefixDoc({ ...emptyDoc(), nodes }, nodes.length);
const old = document(box(0, 15, 45));
const current = document([old.nodes[0], { ...old.nodes[1], suppressed: true }, ...box(2, -20, 10), ...box(4, 20, 50)]);
const input = (doc: typeof old) => {
  const result = drawingInputs(doc);
  if (typeof result === 'string') assert.fail(result);
  return result;
};
const native = (doc: typeof old) => {
  const result = evaluateDoc(doc, 0);
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.bodies;
};
const lineAt = (i: ReturnType<typeof input>, y: number) => {
  const endsAt = (p: readonly number[], x: number) => Math.hypot(p[0] - x, p[1] - y, p[2] - 20) < 1e-9;
  const edge = i.views.top.edges.find(e => e.kind === 'line' && e.ends?.some(p => endsAt(p, 0)) && e.ends.some(p => endsAt(p, 40)) && e.pieces.some(p => p.visible));
  assert.ok(edge, 'Top edge at y=' + y);
  return edge.name;
};
const oldName = lineAt(input(old), 15);
const after = input(current);
const nominal = [10, 20].map(y => ({ name: lineAt(after, y), y }));
const bName = lineAt(after, 50);
const dimension = {
  id: 'd1', kind: 'linear' as const, view: 'top' as const, orient: 'vertical' as const, place: [50, 32] as [number, number],
  a: { edge: oldName, at: 'end' as const, near: [0, 15, 20] as [number, number, number] },
  b: { edge: bName, at: 'end' as const, near: [40, 50, 20] as [number, number, number] },
};
const drawing = { sheet: 'A4' as const, projection: 'third' as const, hidden: true, title: 'Drawing reference candidates', dimensions: [dimension] };
const signed = captureSignatures({ ...old, drawing }, native(old));
const fixture = captureSignatures({ ...current, drawing: signed.drawing }, native(current));
const checked = await verifyReferences(fixture, native(current), async d => evaluateDoc(d, 0));
assert.equal(checked.changes.length, 0);
assert.equal(checked.problems.length, 1);
assert.equal(checked.problems[0].name, oldName);
const candidates = checked.problems[0].candidates.map(name => {
  const candidate = nominal.find(x => x.name === name);
  assert.ok(candidate, 'The candidate is one of the two current Top edges: ' + name);
  return candidate;
});
assert.deepEqual(candidates.map(x => x.y).sort((a, b) => a - b), [10, 20]);
const lost = resolveDimension(after.views, dimension);
assert.ok(!lost.ok);
console.log(JSON.stringify({ fixture, oldName, candidates, reason: lost.reason }));
`;
const f = await createFlow({
  name: 'drawing-reference-candidate', output, envFrozen: 'D757_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins, inspectorSource,
  qualification: baseline ? 'Reproduce the unresolved candidate preview refusal' : 'Inspect two live projected candidates and change the reference only after confirmation',
  limits: ['One straight endpoint reference and two unique visible Top edges in an ordinary desktop drawing.'],
  snapshotExtra: () => ({
    dimensions: window.__studioDrawing?.()?.dimensions ?? [],
    notice: document.querySelector('[aria-label="Reference preview"]')?.textContent ?? null,
    overlay: document.querySelector('[aria-label="Reference candidate preview"]')?.innerHTML ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyActions: ['Undo', 'Redo'].map(label => document.querySelector('button[aria-label="' + label + '"]')?.disabled),
  }),
});

function holdProjection() {
  const post = Worker.prototype.postMessage, onMessage = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  let armed = false, request, deliver;
  Worker.prototype.postMessage = function (message, ...args) {
    if (armed && message?.type === 'drawing') {
      armed = false;
      request = { worker: this, id: message.id };
    }
    return Reflect.apply(post, this, [message, ...args]);
  };
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: true, get: onMessage.get,
    set(callback) {
      onMessage.set.call(this, callback && function (event) {
        if (request?.worker === this && event.data?.id === request.id && event.data.drawing?.ok) {
          deliver = () => callback.call(this, event);
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d757Projection = {
    arm() { armed = true; },
    held: () => !!deliver,
    release() { const run = deliver; request = deliver = null; run(); },
  };
}

await f.run(async () => {
  const source = await f.inspect('fixture', {});
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    if (guards) await context.addInitScript(holdProjection);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const modeButton = name => page.locator('.mode').getByRole('button', { name, exact: true });
  const refs = page.getByRole('region', { name: 'References', exact: true });
  const status = page.getByRole('status', { name: 'Reference preview', exact: true });
  const overlay = page.locator('g[aria-label="Reference candidate preview"]');

  if (guards) {
    const preview = () => refs.getByRole('button', { name: 'Preview candidate 1', exact: true }).click();
    const open = async (name, drawing) => {
      const bytes = Buffer.from(JSON.stringify({ ...source.fixture, drawing: { ...drawing, title: name } }));
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
      await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: bytes });
      await page.waitForFunction(title => window.__studioDoc?.drawing?.title === title, name);
      await f.ready();
      f.report.observations.push({ name, sha256: sha256(bytes) });
    };
    const drawing = source.fixture.drawing, dimension = drawing.dimensions[0];
    const continuation = { ...drawing, sheets: [{ id: 'S2', name: 'Continuation', views: ['right'] }] };
    const tab = name => page.getByRole('tab', { name, exact: true });
    f.phase = 'Hold a real Drawing projection and retire the preview when the sheet changes';
    await open('Sheet guard', continuation);
    await page.evaluate(() => window.__d757Projection.arm());
    await preview();
    await page.waitForFunction(() => window.__d757Projection.held());
    await status.filter({ hasText: 'the current sheet is not ready' }).waitFor();
    const busy = await f.snapshot('projection-busy');
    assert.equal(busy.overlay, null);
    await tab('Continuation').click();
    await status.waitFor({ state: 'detached' });
    await page.evaluate(() => window.__d757Projection.release());
    await tab('Sheet 1').click();
    await page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => d.lost));
    assert.equal(await overlay.count(), 0);
    await preview();
    await overlay.waitFor({ state: 'attached' });
    await tab('Continuation').click();
    await tab('Sheet 1').click();
    assert.equal(await overlay.count(), 0);
    await f.same(busy.doc);

    f.phase = 'Replace the document and refuse a dimension ID shared with a continuation';
    await preview();
    await overlay.waitFor({ state: 'attached' });
    const duplicate = { ...dimension, view: 'right', a: { ...dimension.b, near: [0, 50, 20] } };
    await open('Duplicate guard', { ...continuation, dimensions: [dimension, duplicate] });
    await status.waitFor({ state: 'detached' });
    assert.equal(await overlay.count(), 0);
    await preview();
    await status.filter({ hasText: 'the dimension ID is not unique' }).waitFor();
    const duplicated = await f.snapshot('ambiguous-dimension-refusal');
    assert.equal(duplicated.overlay, null);
    assert.equal(duplicated.doc.drawing.dimensions.length, 2);

    f.phase = 'Refuse a candidate when the original dimension view is hidden';
    await open('Hidden view guard', { ...drawing, views: ['front', 'top'], dimensions: [{ ...dimension, view: 'right' }] });
    await preview();
    await status.filter({ hasText: 'the dimension view is not shown' }).waitFor();
    const hidden = await f.snapshot('hidden-view-refusal');
    assert.equal(hidden.overlay, null);
    assert.equal(hidden.doc.drawing.dimensions[0].view, 'right');

    f.phase = 'Show a resolved marked dimension through the existing action';
    const { name, y } = source.candidates[0];
    const live = { ...dimension, a: { ...dimension.a, edge: name, was: source.oldName, sig: { ...dimension.a.sig, p: [20, y, 20] } } };
    await open('Resolved dimension guard', { ...drawing, dimensions: [live] });
    await refs.getByRole('button', { name: 'Show dimension', exact: true }).click();
    await status.filter({ hasText: 'Dimension highlighted for inspection' }).waitFor();
    const shown = await f.snapshot('show-resolved-dimension');
    assert.equal(shown.overlay, null);
    assert.equal(shown.dimensions[0].value, 50 - y);
    assert.equal(await page.locator('svg g.dimension.sel[data-dim="d1"]').count(), 1);
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'Open a native drawing with one lost endpoint and two current candidates';
  const file = 'drawing-reference-candidates.bcad', bytes = Buffer.from(JSON.stringify(source.fixture));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'Drawing reference candidates');
  await refs.getByRole('button', { name: 'Preview candidate 2', exact: true }).waitFor();
  await f.ready();
  f.report.observations.push({ sourceSHA256: sha256(bytes), candidates: source.candidates, lostReason: source.reason });
  const original = await f.snapshot('original-unresolved-dimension');
  assert.equal(original.doc.drawing.dimensions[0].a.edge, source.oldName);
  assert.match(await refs.textContent(), /1 need a choice/);

  f.phase = 'Ask to preview the first candidate in Drawing';
  await refs.getByRole('button', { name: 'Preview candidate 1', exact: true }).click();
  await status.waitFor();
  await page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => d.lost));
  if (baseline) {
    const refused = await f.snapshot('parent-blocks-unresolved-candidate');
    assert.deepEqual(refused.doc, original.doc);
    assert.deepEqual(refused.dimensions, [{ id: 'd1', lost: source.reason }]);
    assert.match(refused.notice, /the dimension has no resolved display on this sheet/);
    assert.equal(refused.overlay, null);
    return;
  }

  const checkCandidate = async index => {
    const candidate = source.candidates[index - 1];
    await overlay.waitFor({ state: 'attached' });
    await status.filter({ hasText: 'Candidate ' + index + ' highlighted' }).waitFor();
    const state = await f.snapshot('candidate-' + index);
    assert.deepEqual(state.doc, original.doc);
    assert.deepEqual(state.historyActions, original.historyActions);
    assert.equal(state.dirty, original.dirty);
    assert.deepEqual(state.dimensions, [{ id: 'd1', lost: source.reason }]);
    assert.match(state.notice, new RegExp('Candidate ' + index, 'i'));
    assert.ok(state.notice.includes(source.reason));
    const endpoints = await overlay.evaluate((group, y) => {
      const svg = group.ownerSVGElement, matrix = svg.getScreenCTM();
      const projected = [0, 40].map(x => window.__studioDrawingAt('top', x, y));
      const edges = [...group.querySelectorAll('line')].map(line => [[line.x1.baseVal.value, line.y1.baseVal.value], [line.x2.baseVal.value, line.y2.baseVal.value]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix).toJSON()));
      return { projected, edges };
    }, candidate.y);
    assert.equal(endpoints.edges.length, 1);
    const byX = (a, b) => a.x - b.x;
    endpoints.edges[0].sort(byX).forEach((end, i) => {
      const expected = endpoints.projected.sort(byX)[i];
      assert.ok(Math.hypot(end.x - expected.x, end.y - expected.y) < 0.01, JSON.stringify(endpoints));
    });
    return state.overlay;
  };
  const first = await checkCandidate(1);
  await refs.getByRole('button', { name: 'Preview candidate 2', exact: true }).click();
  assert.notEqual(await checkCandidate(2), first);

  f.phase = 'Cancel and reopen inspection without committing a candidate';
  await page.keyboard.press('Escape');
  await overlay.waitFor({ state: 'detached' });
  await status.waitFor({ state: 'detached' });
  await refs.getByRole('button', { name: 'Preview candidate 2', exact: true }).click();
  await overlay.waitFor({ state: 'attached' });
  await button('Collapse the browser').click();
  await overlay.waitFor({ state: 'detached' });
  await button('Expand the browser').click();
  await status.waitFor({ state: 'detached' });

  f.phase = 'Inspect the same edge in Model and then explicitly repair the reference';
  await refs.getByRole('button', { name: 'Preview candidate 2', exact: true }).click();
  await overlay.waitFor({ state: 'attached' });
  await refs.getByRole('button', { name: 'Preview in model', exact: true }).nth(1).click();
  await overlay.waitFor({ state: 'detached' });
  await f.same(original.doc);
  const model = await f.snapshot('candidate-in-model');
  assert.equal(model.selection.selection.edges.length, 1);
  await modeButton('Drawing').click();
  await status.waitFor({ state: 'detached' });
  await refs.getByRole('button', { name: 'Use candidate 2', exact: true }).click();
  await f.changed(original.doc);
  await page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => Number.isFinite(d.value)));
  const applied = await f.snapshot('explicit-reference-repair');
  assert.equal(applied.doc.drawing.dimensions[0].a.edge, source.candidates[1].name);
  assert.equal(applied.dimensions[0].value, 50 - source.candidates[1].y);
  assert.equal(applied.overlay, null);
  await button('Undo').click();
  await f.same(original.doc);
  await button('Redo').click();
  await f.same(applied.doc);
  assert.equal(applied.dirty, true);
  assert.equal(applied.historyActions[0], false);

  f.phase = 'Read the repaired endpoint after project Save and fresh Open';
  const project = 'D757 drawing reference';
  const panel = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await panel().isVisible())) await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await panel().getByLabel('Project', { exact: true }).waitFor();
  };
  await modeButton('Model').click();
  await attach();
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), applied.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(applied.doc);
  await modeButton('Drawing').click();
  await page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => Number.isFinite(d.value)));
  const reopened = await f.snapshot('fresh-open-repaired-dimension');
  assert.deepEqual(reopened.dimensions, applied.dimensions);
  assert.equal(reopened.overlay, null);
  assert.equal(reopened.dirty, false);
  assert.deepEqual(f.report.downloads, []);
});
