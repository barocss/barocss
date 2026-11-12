import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = [
  'apps/cad-studio/test/material-drag-trim-browser.mjs',
  'apps/cad-studio/src/app/sketchControls.ts',
  'apps/cad-studio/src/sketch/dragTrimPlan.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/entityIds.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
];
const f = await createFlow({
  name: 'material-drag-trim', output: process.argv[2], envFrozen: 'D877_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Drag Trim a newly drawn material line, refuse its open chain, then close and rebuild a stepped hole.',
  limits: ['One XY rectangle with two straight construction bounds, an ordinary Line target and an existing 2 mm Extrude.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [output] = evaluateCadPart(toPartDocument(doc)).outputs;
const { volume, centroid } = massPropertiesOf(output);
console.log(JSON.stringify({ id: output.id, valid: checkOutput(output).valid, volume, centroid,
  corners: output.brep.vertices.map(vertex => vertex.point) }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyDisabled: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    removed: [...document.querySelectorAll('.sk-drag-trim-interval')].map(line => line.getAttribute('points')),
  }),
});
const guide = (y, ids) => ({ kind: 'polygon', points: [[5, y], [25, y]], closed: false, bulges: [0, 0], ids, construction: true });
const outer = [[0, 0], [40, 0], [40, 40], [0, 40]];
const inner = [[10, 5], [10, 15], [15, 15], [15, 25], [10, 25], [10, 35], [30, 35], [30, 5]];
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: outer[0], max: outer[2], id: 'n0', sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
      construction: [guide(15, ['e5', 'e6']), guide(25, ['e7', 'e8'])] },
    { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const brush = () => f.page.locator('.vp-overlay .sk-drag-trim');
const cuts = () => brush().locator('.sk-drag-trim-interval');
const hoverCut = () => f.page.locator('.vp-overlay polyline.sk-trim:not(.sk-drag-trim-interval)');
const midpoint = [10, 20];
const tolerance = 1e-7;

async function open(doc, bytes, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function enterSketch() {
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [40, 40], [5, 20], [30, 5], [10, 35]]);
}

async function pixel(point) {
  const p = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), p), point);
  return p;
}

async function line(points) {
  await f.tool('Line', 'l');
  for (const point of points) await f.page.mouse.click(...await pixel(point));
}

async function hover(point) {
  await f.page.mouse.move(...await pixel(point));
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function hold() {
  await f.page.mouse.move(...await pixel([6, 20]));
  await f.page.mouse.down();
  await f.page.mouse.move(...await pixel([14, 20]));
  await brush().waitFor({ state: 'attached' });
}

function unchanged(after, before) {
  for (const key of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(after[key], before[key], key);
}

async function native(label, doc, withHole) {
  const expected = withHole ? [...outer, ...inner] : outer;
  const result = await f.inspect(label, doc);
  assert.equal(result.valid, true);
  assert.equal(result.id, 'n1');
  assert.equal(result.corners.length, expected.length * 2);
  for (const p of expected) for (const z of [0, 2]) {
    assert.ok(result.corners.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - z) < tolerance), [p, z]);
  }
  // The hole removes a 20 × 30 rectangle except for a 5 × 10 notch.
  const area = withHole ? 1600 - 600 + 50 : 1600;
  const xMoment = withHole ? 1600 * 20 - 600 * 20 + 50 * 12.5 : 1600 * 20;
  const centroid = [xMoment / area, 20, 1], volume = 2 * area;
  assert.ok(Math.abs(result.volume - volume) < tolerance, result.volume);
  assert.ok(Math.hypot(...result.centroid.map((v, i) => v - centroid[i])) < tolerance, result.centroid);
  const [body] = (await f.bodies()).bodies;
  assert.equal(body.key, 'b1');
  assert.ok(Math.abs(body.volume - volume) < tolerance, body.volume);
  f.report.observations.push({ label, ...result, expectedVolumeMm3: volume, expectedCentroidMm: centroid });
}

async function save(doc) {
  const name = 'D877-material-trim', file = name + '.bcad', project = 'D877 material Trim';
  await f.page.locator('.doc-tab input').fill(name);
  await button(f.page, 'Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });
  return { file, bytes };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const sourceBytes = Buffer.from(JSON.stringify(source));
  f.report.observations.push({ label: 'fixture', bytes: sourceBytes.length, sha256: sha256(sourceBytes) });
  await open(source, sourceBytes, 'D877-source.bcad');
  await native('native-stock', source, false);
  await enterSketch();

  f.phase = 'draw a regular line and preview its interior cut';
  await line([inner[0], inner[5]]);
  await f.tool('Trim', 't');
  await hover(midpoint);
  await hoverCut().waitFor();
  const before = await f.snapshot('01-material-line');
  await hold();
  const preview = await f.snapshot('02-held-stroke');
  unchanged(preview, before);
  assert.equal(preview.removed.length, baseline ? 0 : 1);
  if (!baseline) {
    const actual = await cuts().evaluate(line => {
      const r = line.closest('svg').getBoundingClientRect();
      return Array.from(line.points, q => [q.x + r.left, q.y + r.top]);
    });
    const expected = await Promise.all([inner[1], inner[4]].map(point => f.screenOf(point)));
    assert.equal(actual.length, 2);
    assert.ok(expected.every(q => actual.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02)), { actual, expected });
  }
  await f.page.mouse.up();
  await brush().waitFor({ state: 'detached' });
  await hover(midpoint);
  if (baseline) {
    await f.page.locator('.toast').getByText('Drag Trim needs a saved side ID for each crossed line.', { exact: false }).waitFor();
    await hoverCut().waitFor();
    const rejected = await f.snapshot('03-material-line-refused');
    unchanged(rejected, before);
    assert.deepEqual(rejected.historyDisabled, before.historyDisabled);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await hoverCut().waitFor({ state: 'detached' });
  const cut = await f.snapshot('03-material-interval-removed');
  unchanged(cut, before);
  assert.deepEqual(cut.historyDisabled, [false, true]);

  f.phase = 'refuse Finish of the open material chain and retain both draft and accepted solid';
  await f.page.locator('.topbar button.finish').click();
  await f.sketchPanel().getByRole('alert').getByText(/Close or trim the open chain from \(10, 5\) to \(10, 15\) mm/).waitFor();
  const refused = await f.snapshot('04-open-chain-refused');
  unchanged(refused, before);
  assert.deepEqual(refused.historyDisabled, cut.historyDisabled);
  await f.same(source);
  await button(f.page, 'Undo').click();
  await hover(midpoint);
  await hoverCut().waitFor();
  await button(f.page, 'Redo').click();
  await hover(midpoint);
  await hoverCut().waitFor({ state: 'detached' });

  f.phase = 'draw two connecting paths with the ordinary Line tool';
  await line(inner.slice(1, 5));
  await f.tool('Trim', 't');
  await line([...inner.slice(5), inner[0]]);
  const accepted = (await f.finishSketch('05-rebuilt-hole')).doc;
  const [profile, extrude] = accepted.nodes;
  assert.deepEqual(extrude, source.nodes[1]);
  assert.deepEqual(accepted.outputs, source.outputs);
  assert.deepEqual(profile.sideTags.outer, source.nodes[0].sideTags.outer);
  assert.deepEqual(profile.construction, source.nodes[0].construction.map(shape => ({ ...shape, pending: false })));
  assert.equal(profile.holes?.length, 1);
  const segments = profile.holes[0];
  assert.equal(segments.length, 8);
  assert.ok(segments.every(segment => segment.kind === 'line'));
  const pointKey = p => p.join(',');
  const edgeKey = (a, b) => [pointKey(a), pointKey(b)].sort().join('>');
  assert.deepEqual(segments.map((segment, i) => edgeKey(segment.start, segments[(i + 1) % segments.length].start)).sort(),
    inner.map((p, i) => edgeKey(p, inner[(i + 1) % inner.length])).sort());
  assert.equal(new Set([...profile.sideTags.outer, ...profile.sideTags.holes[0], ...profile.construction.flatMap(shape => shape.ids)]).size, 16);
  await native('native-rebuilt-hole', accepted, true);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted);
  const { file, bytes } = await save(accepted);
  await f.newPage();
  await open(accepted, bytes, file);
  await native('native-reopened-hole', accepted, true);
  await enterSketch();
  await f.snapshot('06-fresh-open-sketch');
  assert.deepEqual(f.report.downloads, []);
});
