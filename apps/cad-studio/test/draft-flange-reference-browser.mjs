import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/draft-flange-reference-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/ui/ReferenceDecisions.tsx',
  'packages/barocss-cad-model/src/engine/references.ts',
  'packages/barocss-cad-model/src/engine/rematch.ts',
];
const f = await createFlow({
  name: 'draft-flange-reference', output: process.argv[2], envFrozen: 'D1001_SOURCE_FROZEN',
  qualification: 'Compare Draft and Flange reference retention, refusal and repair in desktop Studio.',
  limits: ['A Draft on a generated Split cap and a full-width Flange on one rectangular sheet.'],
  initialFiles: pins, requiredFrozen: pins,
});
const ref = (node, side = 'solid') => ({ node, side });
const node = (index, kind, props) => ({ id: 'n' + index, kind, ...props });
const sketch = (index, min, max) => node(index, 'sketch', { profile: 'rectangle', min, max });
const nativeDoc = (nodes, outputs) => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes, outputs, nextId: nodes.length });
const cap = 'n2.cut.side1';
const rim = 'n1.side1|n1.top';
const topCandidate = 'n1.top|n3.side3';
const bottomCandidate = 'n1.bottom|n3.side3';
const draft = at => nativeDoc([
  sketch(0, [0, 0], [60, 30]),
  node(1, 'extrude', { sketch: 0, height: 10 }),
  node(2, 'split', { parent: ref(1), axis: 'x', normal: [Math.sign(at), 0, 0], at }),
  node(3, 'draft', { parent: ref(2, 'negative'), faces: [cap], angle: 10, pull: 'z', neutral: 0,
    sigs: { [cap]: { k: 'plane', p: [24, 15, 5], d: [1, 0, 0], s: 300 } } }),
], { b2_positive: ref(2, 'positive'), b3: ref(3) });
const flange = x => nativeDoc([
  sketch(0, [0, 0], [80, 50]),
  node(1, 'sheet-base', { sketch: 0, thickness: 1.5, bendRadius: 1.5, kFactor: 0.44 }),
  sketch(2, [x, -5], [x + 12, 55]),
  node(3, 'extrude', { sketch: 2, height: 4, from: -1 }),
  node(4, 'difference', { parent: ref(1), tool: ref(3) }),
  node(5, 'sheet-flange', { parent: ref(4), edges: [rim], length: 20,
    sigs: { [rim]: { k: 'line', p: [80, 25, 1.5], d: [0, 1, 0], s: 50 } } }),
], { b5: ref(5) });
const button = (name, parent = f.page) => parent.getByRole('button', { name, exact: true });
const field = name => f.editor().getByRole('spinbutton', { name, exact: true });
const refs = () => f.page.getByRole('region', { name: 'References', exact: true });

async function open(name, doc) {
  f.phase = 'Open ' + name;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(name => document.querySelector('.doc-tab input')?.value === name, name.replace(/\.bcad$/, ''));
  await f.ready();
}

function volumes(state, expected) {
  assert.deepEqual(state.bodies.bodies.map(body => body.key).sort(), Object.keys(expected).sort());
  for (const body of state.bodies.bodies) {
    assert.ok(Math.abs(body.volume - expected[body.key]) < 1e-7, JSON.stringify({ body, expected }));
  }
}

async function acceptEdit(label, index, name, value, before, after, expected) {
  await f.openFeatureEditor(index, label);
  await field(name).fill(String(value));
  const applied = await f.applyEditor(before, label);
  assert.deepEqual(applied.doc, after);
  assert.equal(await refs().count(), 0);
  volumes(applied, expected);
  await f.undo();
  await f.same(before);
  await f.redo();
  await f.same(after);
}

async function refuseEdit(label, index, fields, referenceName) {
  await f.openFeatureEditor(index, label);
  const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
  const buttonsBefore = await history();
  const before = await f.snapshot(label + '-before');
  for (const [name, value] of fields) await field(name).fill(value);
  await button('Apply', f.editor()).click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.ok((await error.textContent()).includes(referenceName), await error.textContent());
  const after = await f.snapshot(label);
  for (const key of ['doc', 'bodies', 'selection', 'history']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(await history(), buttonsBefore);
  assert.equal(await refs().count(), 0);
}

async function details() {
  await refs().locator('summary').click();
  return refs().locator('details').textContent();
}

const draftVolume = at => ({ b2_positive: (60 - at) * 300, b3: 30 * (at * 10 - 50 * Math.tan(Math.PI / 18)) });
const flangeVolume = width => 50 * (1.5 * (width - 3 + 20 - 3) + Math.PI / 4 * (3 ** 2 - 1.5 ** 2));

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  await open('draft-start.bcad', draft(24));
  await f.same(draft(24));
  volumes(await f.snapshot('draft-x24'), draftVolume(24));
  await acceptEdit('draft-x30', 2, 'At', 30, draft(24), draft(30), draftVolume(30));
  await refuseEdit('draft-reversed-refused', 2, [['Normal X', '-1'], ['At', '-30']], cap);

  await f.newPage();
  await open('draft-lost-cap.bcad', draft(-30));
  await refs().waitFor();
  assert.match(await refs().textContent(), /0 matched again.*1 need a choice.*Reference missing.*Feature held/);
  assert.ok((await details()).includes(cap));
  const heldDraft = await f.snapshot('draft-open-held');
  assert.equal(heldDraft.doc.nodes[3].suppressed, true);
  assert.deepEqual(heldDraft.doc.nodes[3].faces, [cap]);
  volumes(heldDraft, { b2_positive: 9000, b3: 9000 });

  await f.newPage();
  await open('flange-start.bcad', flange(82));
  await f.same(flange(82));
  volumes(await f.snapshot('flange-start'), { b5: flangeVolume(80) });
  await acceptEdit('flange-disjoint-cutter-move', 3, 'Corner X', 83, flange(82), flange(83), { b5: flangeVolume(80) });
  await refuseEdit('flange-rim-removal-refused', 3, [['Corner X', '79.5']], rim);

  await f.newPage();
  await open('flange-unique-match.bcad', flange(79.5));
  await refs().waitFor();
  assert.match(await refs().textContent(), /1 matched again.*0 need a choice/);
  assert.ok((await details()).includes(rim + ' → ' + topCandidate));
  const matched = await f.snapshot('flange-matched-again');
  assert.deepEqual(matched.doc.nodes[5].rematched, { [topCandidate]: rim });
  volumes(matched, { b5: flangeVolume(79.5) });
  await button('Confirm reference', refs()).click();
  await refs().waitFor({ state: 'hidden' });
  await f.ready();
  const confirmedMatch = await f.snapshot('flange-match-confirmed');
  assert.deepEqual(confirmedMatch.doc.nodes[5].sigs[topCandidate].p, [79.5, 25, 1.5]);
  volumes(confirmedMatch, { b5: flangeVolume(79.5) });

  await f.newPage();
  await open('flange-two-candidates.bcad', flange(70));
  await refs().waitFor();
  assert.match(await refs().textContent(), /0 matched again.*1 need a choice.*Choose a reference.*Feature held/);
  const shown = await details();
  assert.ok(shown.includes(rim));
  assert.ok(shown.includes('Candidate 1: ' + topCandidate));
  assert.ok(shown.includes('Candidate 2: ' + bottomCandidate));
  const held = await f.snapshot('flange-open-held');
  assert.equal(held.doc.nodes[5].suppressed, true);
  volumes(held, { b5: 5250 });

  await button('Use candidate 1', refs()).click();
  await refs().waitFor({ state: 'hidden' });
  await f.ready();
  const confirmed = await f.snapshot('flange-candidate-confirmed');
  assert.deepEqual(confirmed.doc.nodes[5].edges, [topCandidate]);
  assert.deepEqual(confirmed.doc.nodes[5].sigs[topCandidate].p, [70, 25, 1.5]);
  volumes(confirmed, { b5: flangeVolume(70) });
  await f.undo();
  await f.same(held.doc);
  const undone = await f.snapshot('flange-confirmation-undone');
  assert.deepEqual(undone.bodies.bodies, held.bodies.bodies);
  assert.equal(await details(), shown);
  await f.redo();
  await f.same(confirmed.doc);
  assert.equal(await refs().count(), 0);

  f.phase = 'save and reopen the confirmed Flange';
  const projectName = 'D1001 confirmed Flange';
  const fileName = 'flange-two-candidates.bcad';
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const openProject = async () => {
    await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
    await button('Project in this browser', versions).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  await openProject();
  await button('Save').click();
  await versions.locator('li[data-active="true"]').filter({ hasText: fileName }).waitFor();
  const bytes = await f.page.evaluate(async ({ projectName, fileName }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(projectName);
    return (await (await folder.getFileHandle(fileName)).getFile()).text();
  }, { projectName, fileName });
  assert.deepEqual(JSON.parse(bytes), confirmed.doc);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button('Open ' + fileName, versions).click();
  await f.same(confirmed.doc);
  assert.equal(await refs().count(), 0);
  volumes(await f.snapshot('flange-project-reopened'), { b5: flangeVolume(70) });
  assert.deepEqual(f.report.downloads, []);
});
