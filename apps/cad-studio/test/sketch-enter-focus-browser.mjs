import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(mode === '--baseline' || mode === '--fixed');
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-enter-focus-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
];
const f = await createFlow({
  name: 'sketch-enter-focus', output, envFrozen: 'D865_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a focused Browser Enter activating global Finish.' : 'Keep native focused Enter and explicit workspace Finish separate.',
  limits: ['Trusted desktop Chrome keydown and click events, one Browser body and two ordinary Rectangle sketches.'],
  snapshotExtra: () => ({
    fields: Object.fromEntries([...document.querySelectorAll('.sk-panel label')].flatMap(label => {
      const text = label.querySelector('span')?.textContent, input = label.querySelector('input');
      return text && input ? [[text, input.value]] : [];
    })),
    focus: document.activeElement?.getAttribute('aria-label') ?? null,
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    keys: window.__d865Keys,
    clicks: window.__d865Clicks,
  }),
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const browser = () => f.page.getByRole('complementary', { name: 'Browser', exact: true });
const finishButton = () => f.page.locator('.topbar button.finish');

function instrument() {
  window.__d865Keys = [];
  window.__d865Clicks = [];
  window.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target, name = target.getAttribute?.('aria-label') ?? null, tag = target.tagName;
    setTimeout(() => window.__d865Keys.push({ key: event.key, name, tag, trusted: event.isTrusted, prevented: event.defaultPrevented }), 0);
  }, true);
  window.addEventListener('click', event => {
    const target = event.target.closest?.('button');
    if (!target) return;
    const name = target.getAttribute('aria-label') ?? (target.matches('.finish') ? 'Finish sketch' : target.textContent.trim());
    window.__d865Clicks.push({ name, trusted: event.isTrusted, keyboard: event.detail === 0 });
  }, true);
}

async function rectangle(z) {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill(String(z));
  await f.tool('Rectangle', 'r');
  for (const point of [[2, 2, z], [8, 6, z]]) {
    const p = await f.page.evaluate(point => {
      const p = window.__studioScreenOf(point);
      return p && document.elementFromPoint(...p)?.closest('canvas.vp-canvas') ? p : null;
    }, point);
    assert.ok(p);
    await f.page.mouse.move(...p);
    await f.page.mouse.click(...p);
  }
  await f.sketchPanel().getByLabel(/Width/).waitFor();
}

async function activate(control, key) {
  await control.focus();
  assert.ok(await control.evaluate(element => document.activeElement === element));
  await f.page.keyboard.press(key);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

function checkSketch(doc, index, z) {
  const node = doc.nodes[index];
  assert.equal(node.kind, 'sketch');
  assert.equal(node.profile, 'rectangle');
  assert.deepEqual(node.min, [2, 2]);
  assert.deepEqual(node.max, [8, 6]);
  assert.deepEqual(node.plane.origin, [0, 0, z]);
  assert.deepEqual(node.plane.normal, [0, 0, 1]);
  assert.equal(node.on, undefined);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(instrument);
    return context;
  };
  await f.newPage();
  const bytes = Buffer.from(JSON.stringify(seed));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D865-enter-focus.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(seed);
  f.report.observations.push({ label: 'fixture', bytes: bytes.length, sha256: sha256(bytes) });

  f.phase = 'focus Browser Hide body with an unsaved rectangle draft';
  await rectangle(3);
  const before = await f.snapshot('01-before-enter');
  assert.deepEqual(before.doc, seed);
  assert.equal(before.fields.Width, '6');
  assert.equal(before.fields.Height, '4');
  await activate(button(browser(), 'Hide body'), 'Enter');

  if (baseline) {
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.changed(seed);
    const wrong = await f.snapshot('02-enter-finished-instead');
    assert.equal(wrong.doc.nodes.length, 3);
    checkSketch(wrong.doc, 2, 3);
    await button(browser(), 'Hide body').waitFor();
    assert.equal(wrong.clicks.some(event => event.name === 'Hide body' && event.keyboard), false);
    assert.deepEqual(wrong.keys.at(-1), { key: 'Enter', name: 'Hide body', tag: 'BUTTON', trusted: true, prevented: true });
    return;
  }

  await button(browser(), 'Show body').waitFor();
  await f.ready();
  const hidden = await f.snapshot('02-enter-hides-only');
  assert.deepEqual(hidden.doc.nodes, seed.nodes);
  assert.deepEqual(hidden.doc.outputs, seed.outputs);
  assert.equal(hidden.doc.bodies.b1.hidden, true);
  assert.deepEqual(hidden.fields, before.fields);
  assert.deepEqual(hidden.history, before.history);
  assert.ok(hidden.clicks.some(event => event.name === 'Hide body' && event.keyboard && event.trusted));
  assert.deepEqual(hidden.keys.at(-1), { key: 'Enter', name: 'Hide body', tag: 'BUTTON', trusted: true, prevented: false });

  f.phase = 'native Enter shows the body without consuming the rectangle draft';
  await activate(button(browser(), 'Show body'), 'Enter');
  await button(browser(), 'Hide body').waitFor();
  await f.ready();
  const shown = await f.snapshot('03-enter-shows-only');
  assert.deepEqual(shown.doc, seed);
  assert.ok(shown.clicks.some(event => event.name === 'Show body' && event.keyboard && event.trusted));
  assert.deepEqual(shown.fields, before.fields);

  f.phase = 'the explicit Finish button owns its Enter';
  await activate(finishButton(), 'Enter');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.changed(shown.doc);
  const finished = await f.snapshot('04-explicit-finish');
  assert.equal(finished.doc.nodes.length, 3);
  checkSketch(finished.doc, 2, 3);
  assert.equal(finished.clicks.filter(event => event.name === 'Finish sketch' && event.keyboard && event.trusted).length, 1);
  await f.undo();
  await f.same(shown.doc);
  await f.redo();
  await f.same(finished.doc);

  f.phase = 'workspace Enter still finishes a second sketch exactly once';
  await rectangle(5);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Enter');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.changed(finished.doc);
  const keyboard = await f.snapshot('05-workspace-finish');
  assert.equal(keyboard.doc.nodes.length, 4);
  checkSketch(keyboard.doc, 3, 5);
  assert.equal(keyboard.keys.at(-1).tag, 'BODY');
  assert.equal(keyboard.keys.at(-1).prevented, true);

  f.phase = 'Enter on the explicit Apply button accepts one Extrude';
  await f.openExtrudeHud();
  await f.hud().getByLabel('Distance', { exact: true }).fill('2');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await activate(button(f.hud(), 'Apply'), 'Enter');
  await f.hud().waitFor({ state: 'hidden' });
  await f.changed(keyboard.doc);
  const extruded = await f.snapshot('06-explicit-apply');
  assert.equal(extruded.doc.nodes.length, 5);
  assert.deepEqual(extruded.doc.nodes[4], { kind: 'extrude', sketch: 3, height: 2, id: 'n4' });
  assert.ok(Math.abs(extruded.bodies.bodies.find(body => body.key === 'b4').volume - 48) < 1e-9);
  assert.equal(extruded.clicks.filter(event => event.name === 'Apply' && event.keyboard && event.trusted).length, 1);
  await f.undo();
  await f.same(keyboard.doc);
  await f.redo();
  await f.same(extruded.doc);
  assert.deepEqual(f.report.downloads, []);
});
