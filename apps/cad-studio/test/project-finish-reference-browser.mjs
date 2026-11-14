import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const fileMode = process.argv.includes('--file');
const legacyMode = process.argv.includes('--legacy');
const multiMode = process.argv.includes('--multi');
const varyingMode = process.argv.includes('--varying');
const pins = [
  'apps/cad-studio/test/project-finish-reference-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'packages/barocss-cad-model/src/engine/references.ts',
];
const f = await createFlow({
  name: 'project-finish-reference', output: process.argv[2], envFrozen: varyingMode ? 'D1009_SOURCE_FROZEN' : multiMode ? 'D1008_SOURCE_FROZEN' : legacyMode ? 'D1007_SOURCE_FROZEN' : fileMode ? 'D1006_SOURCE_FROZEN' : 'D1005_SOURCE_FROZEN',
  qualification: (fileMode ? 'File' : 'Project') + ' Open admits a valid held finish repair and refuses an unusable one.',
  limits: ['Individual signed constant-radius single-edge Fillet in a browser project.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: varyingMode ? `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = evaluateCadPart(toPartDocument(doc)).outputs;
if (outputs.length !== 1) throw Error('Expected one output');
const [body] = outputs;
console.log(JSON.stringify({ valid: checkOutput(body).valid, ...massPropertiesOf(body), points: body.brep.vertices.map(vertex => vertex.point) }));
` : undefined,
  snapshotExtra: () => ({
    title: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    active: document.querySelector('li[data-active="true"]')?.textContent,
    fresh: window.__studioFresh,
  }),
});
const edge = 'n1.side1|n1.side2';
const replacement = 'n1.side2|n1.side3';
const ref = node => ({ node, side: 'solid' });
const nodes = [
  { id: 'n0', kind: 'sketch', profile: 'polygon', points: [[0, 0], [5, -2], [10, 0], [10, 9.5], [0, 9.5]] },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 6 },
  { id: 'n2', kind: 'fillet', parent: ref(1), edges: [edge], radius: 2,
    sigs: { [edge]: { k: 'line', p: [10, 10, 3], d: [0, 0, 1], s: 6 } } },
];
const doc = (nodes, output) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes, outputs: { ['b' + output]: ref(output) }, nextId: nodes.length,
});
const stock = doc(nodes.slice(0, 2), 1);
const secondEdge = 'n1.side0|n1.side3';
const secondReplacement = 'n1.side0|n1.side4';
const multiFinish = {
  id: 'n2', kind: 'chamfer', parent: ref(1), edges: [edge, secondEdge], distance: 2,
  sigs: { ...nodes[2].sigs, [secondEdge]: { k: 'line', p: [0, 0, 3], d: [0, 0, 1], s: 6 } },
};
const lost = doc(multiMode ? [...nodes.slice(0, 2), multiFinish] : legacyMode ? [...nodes.slice(0, 2), {
  ...nodes[2], edges: [replacement], sigs: { [replacement]: nodes[2].sigs[edge] },
  rematched: { [replacement]: edge },
}] : nodes, 2);
const unusable = doc([...nodes, { id: 'n3', kind: 'chamfer', parent: ref(2), edges: ['n2.face|n1.top'], distance: 1 }], 3);
const button = (name, parent = f.page) => parent.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const refs = () => f.page.getByRole('region', { name: 'References', exact: true });
const volume = (state, expected) => {
  assert.equal(state.bodies.bodies.length, 1);
  assert.ok(Math.abs(state.bodies.bodies[0].volume - expected) < 1e-7, JSON.stringify(state.bodies));
};
const project = 'D1005 project finish';
const projectOpen = name => button('Open ' + name + '.bcad', panel()).click();
async function fileOpen(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}
async function connectProject() {
  await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button('Project in this browser', panel()).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
}

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
  await f.page.evaluate(async ({ project, files }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects', { create: true });
    const folder = await projects.getDirectoryHandle(project, { create: true });
    for (const [name, doc] of Object.entries(files)) {
      const writer = await (await folder.getFileHandle(name + '.bcad', { create: true })).createWritable();
      await writer.write(JSON.stringify(doc));
      await writer.close();
    }
  }, { project, files: { stock, lost, unusable } });
  await connectProject();
  await projectOpen('stock');
  await f.same(stock);
  volume(await f.snapshot('accepted-project-stock'), 630);

  if (varyingMode) {
    const oldEdge = 'n1.side0|n1.top', newEdge = 'n1.side3|n1.top';
    const fillet = {
      id: 'n2', kind: 'fillet', parent: ref(1), edges: [oldEdge], radius: 1,
      radii: [{ at: [0, 0, 10], radius: 1, atEnd: true }, { at: [40, 0, 10], radius: 3, atEnd: true }],
      sigs: { [oldEdge]: { k: 'line', p: [20, 0, 10], d: [1, 0, 0], s: 40 } },
    };
    const make = points => doc([{ ...nodes[0], points }, { ...nodes[1], height: 10 }, fillet], 2);
    const original = make([[0, 0], [40, 0], [40, 30], [0, 30]]);
    const changed = make([[40, 0.5], [40, 30], [0, 30], [0, 0.5]]);
    const cutVolume = (1 - Math.PI / 4) * 40 * (1 + 3 + 9) / 3;
    await fileOpen('original-varying', original);
    await f.same(original);
    volume(await f.snapshot('original-varying-fillet'), 12000 - cutVolume);
    f.phase = 'open the varying Fillet with a displaced straight edge';
    await fileOpen('changed-varying', changed);
    await refs().or(f.page.getByRole('alert').filter({ hasText: 'Could not open this file' })).waitFor();
    if (await refs().count()) await f.ready();
    const opened = await f.snapshot('varying-open-result');
    assert.equal(opened.title, 'changed-varying', opened.notices.join(' '));
    volume(opened, 11800);
    assert.equal(opened.doc.nodes[2].suppressed, true);
    assert.deepEqual(opened.doc.nodes[2].edges, [oldEdge]);
    await refs().locator('summary').click();
    const pending = await refs().locator('details').textContent();
    assert.ok(pending.includes('Candidate 1: ' + newEdge));
    await button('Use candidate 1', refs()).click();
    await refs().waitFor({ state: 'hidden' });
    await f.ready();
    const confirmed = await f.snapshot('varying-confirmed');
    assert.deepEqual(confirmed.doc.nodes[2].edges, [newEdge]);
    assert.deepEqual(confirmed.doc.nodes[2].radii, fillet.radii);
    assert.deepEqual(confirmed.doc.nodes[2].sigs[newEdge].p, [20, 0.5, 10]);
    volume(confirmed, 11800 - cutVolume);
    const native = await f.inspect('varying-native', confirmed.doc);
    assert.ok(native.valid);
    assert.ok(Math.abs(native.volume - (11800 - cutVolume)) < 1e-7);
    const contacts = [[0, 1.5, 10], [0, 0.5, 9], [40, 3.5, 10], [40, 0.5, 7]];
    for (const contact of contacts) {
      assert.ok(native.points.some(point => Math.hypot(...point.map((coord, axis) => coord - contact[axis])) < 1e-8), JSON.stringify(contact));
    }
    await f.undo();
    await f.same(opened.doc);
    await refs().getByRole('button', { name: /^Use candidate 1(?: for |$)/ }).waitFor();
    await f.redo();
    await f.same(confirmed.doc);
    await f.newPage();
    await fileOpen('confirmed-varying', confirmed.doc);
    await f.same(confirmed.doc);
    assert.equal(await refs().count(), 0);
    volume(await f.snapshot('varying-reopened'), 11800 - cutVolume);

    f.phase = 'refuse the replacement when endpoint ownership is ambiguous';
    const ambiguous = { ...changed, nodes: [...changed.nodes.slice(0, 2), {
      ...fillet, radii: fillet.radii.map(radius => ({ ...radius, at: [20, 0, 10] })),
    }] };
    await fileOpen('ambiguous-varying-endpoints', ambiguous);
    await refs().waitFor();
    await f.ready();
    const held = await f.snapshot('varying-endpoint-ambiguity');
    assert.equal(held.doc.nodes[2].suppressed, true);
    assert.deepEqual(held.doc.nodes[2].edges, [oldEdge]);
    assert.match(await refs().textContent(), /Fillet endpoints cannot be matched.*Feature held/);
    assert.equal(await refs().getByRole('button', { name: /^Use candidate / }).count(), 0);
    volume(held, 11800);
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  if (multiMode) {
    f.phase = 'open an ordinary two-edge Chamfer with two displaced references';
    const old = doc([
      { ...nodes[0], points: [[0, 0], [10, 0], [10, 10], [0, 10]] }, nodes[1], multiFinish,
    ], 2);
    await fileOpen('original-chamfer', old);
    await f.same(old);
    volume(await f.snapshot('old-two-edge-chamfer'), 576);
    await fileOpen('changed-chamfer', lost);
    await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'changed-chamfer');
    const arrived = refs().or(f.page.getByText('Base part · not up to date', { exact: true }));
    await arrived.waitFor();
    if (await refs().count()) await f.ready();
    const opened = await f.snapshot('two-edges-opened');
    assert.ok(opened.fresh);
    assert.match(await refs().textContent(), /0 matched again.*2 need a choice/);
    assert.deepEqual(opened.doc.nodes[2].edges, [edge, secondEdge]);
    assert.equal(opened.doc.nodes[2].suppressed, true);
    volume(opened, 630);
    const pending = () => refs().getByRole('button', { name: /^Use candidate 1(?: for |$)/ });
    assert.equal(await pending().count(), 2);
    await pending().first().click();
    await f.page.waitForFunction(name => window.__studioDoc?.nodes?.[2]?.edges?.[0] === name, replacement);
    await f.ready();
    const partial = await f.snapshot('first-edge-confirmed-still-held');
    assert.equal(partial.doc.nodes[2].suppressed, true);
    assert.deepEqual(partial.doc.nodes[2].edges, [replacement, secondEdge]);
    assert.equal(await pending().count(), 1);
    volume(partial, 630);
    await pending().click();
    await refs().waitFor({ state: 'hidden' });
    await f.ready();
    const confirmed = await f.snapshot('both-edges-confirmed');
    assert.deepEqual(confirmed.doc.nodes[2].edges, [replacement, secondReplacement]);
    assert.equal(confirmed.doc.nodes[2].held, undefined);
    assert.equal(confirmed.doc.nodes[2].suppressed, undefined);
    // Equal setback distances form a triangle with area d² sin(angle) / 2.
    const obliqueCornerSine = 5 / Math.sqrt(29);
    volume(confirmed, 630 - 12 * (1 + obliqueCornerSine));
    await f.undo();
    await f.same(partial.doc);
    assert.equal(await pending().count(), 1);
    await f.undo();
    await f.same(opened.doc);
    assert.equal(await pending().count(), 2);
    await f.redo();
    await f.same(partial.doc);
    await f.redo();
    await f.same(confirmed.doc);
    assert.equal(await refs().count(), 0);
    await f.newPage();
    await fileOpen('partial-chamfer', partial.doc);
    await refs().waitFor();
    await f.ready();
    await f.same(partial.doc);
    assert.equal(await pending().count(), 1);
    volume(await f.snapshot('partial-chamfer-reopened'), 630);
    await fileOpen('confirmed-chamfer', confirmed.doc);
    await f.same(confirmed.doc);
    assert.equal(await refs().count(), 0);
    volume(await f.snapshot('confirmed-chamfer-reopened'), 630 - 12 * (1 + obliqueCornerSine));
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'open a changed Fillet edge directly from the project';
  if (fileMode) await fileOpen('lost', lost); else await projectOpen('lost');
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'lost');
  const arrived = refs().or(f.page.getByText('Base part · not up to date', { exact: true }));
  if (legacyMode) await f.ready(); else await arrived.waitFor();
  if (await refs().count()) await f.ready();
  const held = await f.snapshot('project-damaged-file-open');
  assert.ok(held.fresh);
  assert.equal(held.dirty, true);
  assert.equal(held.doc.nodes[2].suppressed, true);
  assert.equal(held.doc.nodes[2].rematched, undefined);
  assert.deepEqual(held.doc.nodes[2].edges, [edge]);
  assert.deepEqual(held.doc.nodes[2].sigs, nodes[2].sigs);
  if (fileMode) assert.equal(held.active, undefined); else assert.match(held.active, /lost\.bcad/);
  volume(held, 630);
  await refs().locator('summary').click();
  assert.match(await refs().locator('details').textContent(), new RegExp('Candidate 1: ' + replacement.replaceAll('|', '\\|')));
  await button('Use candidate 1', refs()).click();
  await refs().waitFor({ state: 'hidden' });
  await f.ready();
  const confirmed = await f.snapshot('project-confirmed');
  assert.deepEqual(confirmed.doc.nodes[2].edges, [replacement]);
  assert.deepEqual(confirmed.doc.nodes[2].sigs[replacement].p, [10, 9.5, 3]);
  volume(confirmed, 630 - 6 * (4 - Math.PI));
  await f.undo();
  await f.same(held.doc);
  await refs().getByRole('button', { name: /^Use candidate 1(?: for |$)/ }).waitFor();
  await f.redo();
  await f.same(confirmed.doc);

  f.phase = 'refuse an unusable repair before replacing the active document';
  const before = await f.snapshot('before-unusable-project-open');
  if (fileMode) {
    await fileOpen('unusable', unusable);
    const notice = f.page.getByRole('alert').filter({ hasText: /Could not open this file|The selected edge no longer exists|The kernel could not build this/ });
    await notice.waitFor();
    const failed = await f.snapshot('file-open-result');
    assert.match(await notice.textContent(), /Could not open this file.*unchanged/s);
    assert.equal(failed.title, before.title);
  } else {
    await projectOpen('unusable');
    await f.waitToast(/Could not open unusable.*unchanged/s);
  }
  const refused = await f.snapshot('unusable-project-refused');
  for (const key of ['doc', 'bodies', 'selection', 'history', 'title', 'dirty', 'active', 'fresh']) assert.deepEqual(refused[key], before[key], key);
  await f.undo();
  await f.same(held.doc);
  await f.redo();
  await f.same(confirmed.doc);

  f.phase = 'save confirmed project document and reopen after reload';
  const savedName = fileMode ? 'file-confirmed' : 'lost';
  if (fileMode) await f.page.locator('.doc-tab input').fill(savedName);
  await button('Save').click();
  await panel().locator('li[data-active="true"]').filter({ hasText: savedName + '.bcad' }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const saved = await f.page.evaluate(async ({ project, savedName }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(savedName + '.bcad')).getFile()).text();
  }, { project, savedName });
  assert.deepEqual(JSON.parse(saved), confirmed.doc);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await connectProject();
  await projectOpen(savedName);
  await f.same(confirmed.doc);
  assert.equal(await refs().count(), 0);
  volume(await f.snapshot('confirmed-project-reopened'), 630 - 6 * (4 - Math.PI));
  assert.deepEqual(f.report.downloads, []);
});
