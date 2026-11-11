// D743: nonzero Measure text in the desktop panel and the WebGPU viewport.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/measure-nonzero-text-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/ui/quantityText.ts',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'packages/barocss-cad-model/src/app/measure.ts',
];
const f = await createFlow({
  name: 'measure-nonzero-text', output, envFrozen: 'D743_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a computed nonzero Measure value displayed as zero' : 'Preserve finite nonzero Measure values in the panel and viewport',
  limits: ['Actual desktop pointer picks on native rectangular solids. The other scalar families are checked through the React component.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { measureBetween } from '@barocss/cad-model/app/measure';
import { evaluateDoc, partBreps } from '@barocss/cad-model/engine/evaluate';
const { doc } = JSON.parse(process.argv[3]);
const evaluated = evaluateDoc(doc, 1);
assert.ok(evaluated.ok);
const [a, b] = evaluated.bodies.map(body => body.mesh);
const p = { body: 0, face: a.faces.findIndex(face => face.name === 'n1.top') };
const q = { body: 1, face: b.faces.findIndex(face => face.name === 'n3.top') };
assert.ok(p.face >= 0 && q.face >= 0);
console.log(JSON.stringify({
  topZ: partBreps(doc).map(({brep}) => Math.max(...brep.vertices.map(vertex => vertex.point[2]))),
  forward: measureBetween(a, p, b, q), reverse: measureBetween(b, q, a, p),
}));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const el = document.querySelector(`button[aria-label="${name}"]`);
      return [el.disabled, el.getAttribute('data-tip')];
    }),
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
    measurement: document.querySelector('[aria-label="Measurement"]')?.textContent,
  }),
});

const fixture = gap => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [5, 0], max: [15, 10], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 10, from: gap, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const panel = () => page.getByRole('complementary', { name: 'Measurement', exact: true });
  const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label) }).locator('b');
  const open = async (name, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
  };
  const click = async world => {
    const pixel = await page.evaluate(point => window.__studioScreenOf(point), world);
    await page.mouse.click(...pixel);
  };
  const close = async () => {
    await page.keyboard.press('Escape');
    await panel().waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  };
  const check = async (name, doc, gap, options) => {
    f.phase = name;
    const { reverse = false, panelText, delta, overlay, touching = false } = options;
    const before = await f.snapshot(name + '-before');
    const raw = await f.inspect(name, {}, { doc });
    assert.deepEqual(raw.topZ, [10, 10 + gap]);
    assert.ok(Math.abs(raw.forward.distance - gap) < 2e-14);
    assert.ok(Math.abs(raw.reverse.distance - gap) < 2e-14);
    for (const [result, signed] of [[raw.forward, gap], [raw.reverse, -gap]]) {
      assert.equal(result.distance, result.normalDistance);
      assert.equal(result.angle, 0);
      assert.ok(Math.abs(result.b[2] - result.a[2] - signed) < 2e-14);
    }
    await clickModelCommand(page, 'Inspect', 'Measure');
    await panel().waitFor();
    assert.equal(await panel().locator('.measure-item').count(), 0);
    await button('Top').click();
    await f.frame([[0, 0], [15, 10]]);
    const points = [[2, 5, 10], [13, 5, 10 + gap]];
    if (reverse) points.reverse();
    await click(points[0]);
    await panel().locator('.measure-item').first().waitFor();
    if (touching) {
      await button('Front').click();
      await click([3, 0, 5]);
    } else await click(points[1]);
    await panel().getByText('BETWEEN', { exact: true }).waitFor();
    assert.deepEqual(await metric('Area').allInnerTexts(), ['100 mm²', '100 mm²']);
    assert.equal(await metric('Distance').innerText(), panelText + ' mm');
    if (touching) assert.equal(await metric('Normal distance').count(), 0);
    else assert.equal(await metric('Normal distance').innerText(), panelText + ' mm');
    assert.equal(await metric('Angle').innerText(), touching ? '90°' : '0°');
    assert.equal(await metric('ΔX ΔY ΔZ').innerText(), '0, 0, ' + delta);
    const labels = overlay ? [overlay + ' mm'] : [];
    await page.waitForFunction(expected => JSON.stringify(window.__studioOverlayTexts?.()['measure:label'] ?? []) === JSON.stringify(expected), labels);
    const after = await f.snapshot(name);
    assert.deepEqual(after.overlay, labels);
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
    f.report.observations.push({ name, gap, raw, panelText, delta, labels });
    await close();
  };

  const small = fixture(0.004);
  const smallText = baseline ? '0' : '4.00e-3';
  await open('small-gap', small);
  await check('small-forward', small, 0.004, { panelText: smallText, delta: smallText, overlay: smallText });
  await check('small-reverse', small, 0.004, { reverse: true, panelText: smallText, delta: baseline ? '0' : '-4.00e-3', overlay: smallText });
  if (baseline) return;

  const project = 'D743 Measure fixture', file = 'small-gap.bcad';
  const versions = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([name, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), small);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(small);
  await check('fresh-small', small, 0.004, { panelText: '4.00e-3', delta: '4.00e-3', overlay: '4.00e-3' });

  for (const [name, gap, options] of [
    ['threshold-control', 2 ** -31, { panelText: '4.66e-10', delta: '4.66e-10' }],
    ['different-legacy-rounding', 0.0049, { panelText: '0.01', delta: '4.90e-3', overlay: '4.90e-3' }],
    ['ordinary', 15, { panelText: '15', delta: '15', overlay: '15' }],
    ['touching', 0, { panelText: '0', delta: '0', touching: true }],
  ]) {
    const doc = fixture(gap);
    await open(name, doc);
    await check(name, doc, gap, options);
  }
  assert.deepEqual(f.report.downloads, []);
});
