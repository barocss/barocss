import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixed = process.argv[3] === '--fixed';
const relink = process.argv[3] === '--relink';
const pins = [
  'apps/cad-studio/test/associative-inset-relink-baseline-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  ...(fixed || relink ? ['apps/cad-studio/src/files/documentFile.ts', 'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
    'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/engine/engine.worker.ts', 'apps/cad-studio/src/engine/client.ts'] : []),
  ...(relink ? [
    'apps/cad-studio/src/sketch/useInsetRelink.ts', 'apps/cad-studio/src/ui/InsetSourceReview.tsx',
    'apps/cad-studio/src/app/midpointSketch.ts', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
    'packages/barocss-cad-model/src/app/associativeInsetRelink.ts',
  ] : []),
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad-model/src/engine/references.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
];
const f = await createFlow({
  name: relink ? 'associative-inset-relink' : 'associative-inset-relink-baseline',
  output: process.argv[2], envFrozen: relink ? 'D870_SOURCE_FROZEN' : fixed ? 'D868_SOURCE_FROZEN' : 'D867_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: relink ? 'Preview, replace and persist the earlier native source of one existing linked inset.'
    : fixed ? 'Keep the working document during failed associative inset File and Project Open.'
    : 'Measure the current linked inset, separate source and target, and invalid binding refusal in desktop Studio.',
  limits: ['Two earlier axial native rectangular solids and one 2 mm linked inset.',
    relink ? 'The linked sketch feeds one final independent straight Extrude.' : 'A prepared candidate file measures the existing reader and evaluator.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    name: document.querySelector('.doc-tab input')?.value ?? null,
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { referencesOf } from '@barocss/cad-model/engine/references';
import { resolveAssociativeSketch, toPartDocument } from '@barocss/cad-model/engine/part';
const text = readFileSync(process.argv[2], 'utf8'), read = readStudioDoc(text);
if ('error' in read) { console.log(JSON.stringify({ stage: 'read', error: read.error })); process.exit(0); }
try {
  const { doc } = read, sketch = resolveAssociativeSketch(doc, 4), outputs = evaluateCadPart(toPartDocument(doc)).outputs;
  console.log(JSON.stringify({
    stage: 'accepted', sketch, sketchRefs: referencesOf(doc, true).refs.filter(ref => ref.node === 4),
    outputs: outputs.map(output => ({
      id: output.id, valid: checkOutput(output).valid, volume: massPropertiesOf(output).volume,
      corners: output.brep.vertices.map(vertex => vertex.point),
    })),
  }));
} catch (error) {
  console.log(JSON.stringify({ stage: 'resolve', error: error instanceof Error ? error.message : String(error) }));
}
`,
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [100, 0], max: [160, 24], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const firstSource = { node: 1, side: 'solid' };
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= 1e-8, `${a} vs ${b}`);

async function chooseFile(name, doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
}

async function open(name, doc) {
  await chooseFile(name, doc);
  await f.same(doc);
}

function association(id, node) {
  return { kind: 'planar-face-outline-inset', version: 1, source: { node, side: 'solid' }, sourceFeature: id, face: id + '.top', insetMM: 2 };
}

function expectedCorners(x, width, inset, z) {
  return [x + inset, x + width - inset].flatMap(u => [inset, 24 - inset].map(v => [u, v, z]));
}

async function verify(label, doc, x, width, id, sourceIndex, bodyZ = 8) {
  await f.same(doc);
  const read = await f.inspect(label, doc);
  assert.equal(read.stage, 'accepted', read.error);
  assert.deepEqual(read.sketch.association, association(id, sourceIndex));
  assert.deepEqual(read.sketch.on, firstSource);
  assert.deepEqual(read.sketchRefs, []);
  assert.deepEqual(read.outputs.map(body => body.id), ['n1', 'n3', 'n5']);
  const [a, b, ring] = read.outputs;
  assert.ok(read.outputs.every(body => body.valid));
  near(a.volume, 40 * 24 * 8);
  near(b.volume, (sourceIndex === 3 ? width : 60) * 24 * bodyZ);
  const area = width * 24 - (width - 4) * 20;
  near(ring.volume, area * 4);
  near((await f.bodies()).bodies.find(body => body.key === 'b5').volume, area * 4);
  for (const z of [bodyZ, bodyZ + 4]) for (const inset of [0, 2]) for (const corner of expectedCorners(x, width, inset, z)) {
    assert.ok(ring.corners.some(point => Math.hypot(...point.map((value, axis) => value - corner[axis])) <= 1e-8), corner);
  }
  f.report.observations.push({ label, area, ...read });
  return read;
}

function holdWorkerReply(type) {
  const worker = Worker.prototype, send = worker.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === type) {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && target.id === event.data?.id) {
          held = event.data;
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__insetCheck = {
    arm() { armed = true; held = undefined; },
    held: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

function unchanged(after, before) {
  for (const key of ['doc', 'name', 'bodies', 'history', 'dirty', 'controls', 'selection']) assert.deepEqual(after[key], before[key], key);
}

async function observeBadOpen(label, before, damaged) {
  await f.waitToast(/BAD_REFERENCE.*source feature binding/i);
  const after = await f.snapshot(label);
  if (fixed) {
    unchanged(after, before);
    assert.equal(after.bodies.fresh, true);
    assert.ok(after.notices.some(notice => /your part is unchanged/i.test(notice)));
    await f.dismissToasts();
    return;
  }
  assert.deepEqual(after.doc, damaged);
  assert.equal(after.bodies.fresh, false);
  assert.deepEqual(after.bodies.bodies, before.bodies.bodies);
  assert.equal(after.dirty, false);
  assert.notEqual(after.name, before.name);
  f.report.observations.push({ label, oldDirty: before.dirty, oldName: before.name, newDirty: after.dirty,
    newName: after.name, oldVolumes: before.bodies.bodies.map(body => body.volume), fresh: after.bodies.fresh });
  await f.undo();
  await f.same(before.doc);
  await f.dismissToasts();
}

async function putProjectFiles(files) {
  const project = 'D867 invalid ' + randomUUID();
  await f.page.evaluate(async ([project, files]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects', { create: true });
    const folder = await projects.getDirectoryHandle(project, { create: true });
    for (const [name, doc] of Object.entries(files)) {
      const file = await folder.getFileHandle(name, { create: true });
      const writer = await file.createWritable();
      await writer.write(JSON.stringify(doc));
      await writer.close();
    }
  }, [project, files]);
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  if (!(await versions.isVisible())) await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  for (const name of Object.keys(files)) {
    await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  }
  return versions;
}

async function replaceSource(original) {
  const review = f.page.getByRole('complementary', { name: 'Inset source replacement', exact: true });
  const replace = button(f.editor(), 'Replace inset source');
  const apply = button(review, 'Apply source');
  const pickTop = async (x, body) => {
    const point = await f.page.evaluate(x => {
      const xy = window.__studioScreenOf([x, 12, 8]);
      return xy && document.elementFromPoint(...xy)?.closest('canvas.vp-canvas') ? xy : null;
    }, x);
    assert.ok(point, `No viewport point for x=${x}`);
    await f.page.mouse.click(...point);
    await f.page.waitForFunction(body => {
      const faces = window.__studioSelection.selection.faces;
      return faces.length === 1 && faces[0].body === body;
    }, body);
  };
  const pickA = () => pickTop(20, 0);
  const pickB = () => pickTop(130, 1);
  const arm = () => f.page.evaluate(() => window.__insetCheck.arm());
  const waitHeld = () => f.page.waitForFunction(() => window.__insetCheck.held()?.preview?.association?.face === 'n3.top');
  const release = () => f.page.evaluate(() => window.__insetCheck.release());
  const waitApply = () => f.page.waitForFunction(() => {
    const button = [...(document.querySelector('[aria-label="Inset source replacement"]')?.querySelectorAll('button') ?? [])]
      .find(button => button.textContent === 'Apply source');
    return button && !button.disabled;
  });

  await button(f.page.locator('.views'), 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.openFeatureEditor(5, 'linked ring');
  await pickB();
  const before = await f.snapshot('03-before-replacement');

  f.phase = 'keep the current document while an empty Distance field is edited';
  const distance = f.editor().getByRole('spinbutton', { name: 'Distance', exact: true });
  await distance.fill('');
  assert.equal(await replace.isDisabled(), true);
  await button(f.editor(), 'Reset').click();
  assert.equal(await distance.inputValue(), '4');
  unchanged(await f.snapshot('04-draft-reset'), before);

  f.phase = 'preview the new source and cancel without writing the model';
  await replace.click();
  await waitApply();
  await review.getByText('n1.top → n3.top', { exact: true }).waitFor();
  await review.getByText('Target · n1', { exact: true }).waitFor();
  await review.getByText(/Plane origin \(mm\) · .*, 8$/).waitFor();
  await review.getByText('Normal · 0, 0, 1', { exact: true }).waitFor();
  await review.getByText('Extrude · 1280 mm³', { exact: true }).waitFor();
  const painted = await review.getByRole('img', { name: 'Resolved ring preview', exact: true }).evaluate(canvas => {
    const { width, height } = canvas, context = canvas.getContext('2d');
    const rgba = context.getImageData(0, 0, width, height).data;
    return { width, height, pixels: rgba.filter((value, index) => index % 4 === 3 && value > 0).length,
      centerAlpha: rgba[(width * Math.floor(height / 2) + Math.floor(width / 2)) * 4 + 3] };
  });
  assert.ok(painted.pixels > 100);
  assert.equal(painted.centerAlpha, 0);
  f.report.observations.push({ label: 'visible-preview', ...painted });
  unchanged(await f.snapshot('05-exact-preview'), before);
  assert.equal(await replace.isDisabled(), true);
  await f.page.keyboard.press('Escape');
  await review.waitFor({ state: 'hidden' });
  unchanged(await f.snapshot('06-escaped-preview'), before);

  f.phase = 'refuse the original source and retire a delayed preview on repick';
  await pickA();
  const sourceA = await f.snapshot('07-original-face-selected');
  await replace.click();
  await f.waitToast(/already the linked face/i);
  unchanged(await f.snapshot('08-original-face-refused'), sourceA);
  await f.dismissToasts();
  await pickB();
  await arm();
  await replace.click();
  await waitHeld();
  assert.equal(await apply.isDisabled(), true);
  await pickA();
  await review.waitFor({ state: 'hidden' });
  await release();
  unchanged(await f.snapshot('09-late-preview-after-repick'), sourceA);
  assert.equal(await review.count(), 0);

  f.phase = 'retire a delayed preview on successful File Open with the same feature IDs';
  await pickB();
  await arm();
  await replace.click();
  await waitHeld();
  await open('D870-same-identities.bcad', seed);
  const opened = await f.snapshot('10-newly-opened');
  await release();
  unchanged(await f.snapshot('11-late-preview-after-open'), opened);
  assert.equal(await review.count(), 0);
  await open('D870-original.bcad', original);
  await button(f.page.locator('.views'), 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.openFeatureEditor(5, 'reopened linked ring');

  f.phase = 'apply one reviewed replacement, then Undo and Redo';
  await pickB();
  await replace.click();
  await waitApply();
  await apply.click();
  const candidate = structuredClone(original);
  candidate.nodes[4].association = association('n3', 3);
  await verify('native-replaced-source', candidate, 100, 60, 'n3', 3);
  const adopted = await f.snapshot('12-applied-source');
  assert.equal(adopted.dirty, true);
  assert.equal(adopted.editor, null);
  await f.undo();
  await verify('native-undo', original, 0, 40, 'n1', 1);
  await f.redo();
  await verify('native-redo', candidate, 100, 60, 'n3', 3);

  f.phase = 'save through Studio to a local project and open the bytes in a fresh context';
  const name = 'D870-linked-ring', file = name + '.bcad', project = 'D870 relink ' + randomUUID();
  await f.page.locator('.doc-tab input').fill(name);
  await button(f.page, 'Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await f.page.locator('[aria-label="Unsaved changes"]').waitFor({ state: 'hidden' });
  const saved = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(saved), candidate);
  f.report.observations.push({ label: 'project-save', bytes: saved.length, sha256: sha256(saved) });
  await f.newPage();
  await chooseFile(file, candidate, saved);
  await verify('native-fresh-file-open', candidate, 100, 60, 'n3', 3);

  f.phase = 'edit the new source and rebuild the same linked ring';
  await f.openFeatureEditor(3, 'replacement stock width');
  await f.editor().getByLabel('Width', { exact: true }).fill('64');
  const edited = await f.applyEditor(candidate, '13-replacement-width-64');
  assert.deepEqual(edited.doc.nodes[4], candidate.nodes[4]);
  assert.deepEqual(edited.doc.nodes[5], candidate.nodes[5]);
  await verify('native-linked-width-edit', edited.doc, 100, 64, 'n3', 3);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(30000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    if (fixed || relink) await context.addInitScript(holdWorkerReply, relink ? 'insetRelink' : 'verifyStoredInsets');
    return context;
  };
  await f.newPage();
  await open('D867-inset-source.bcad', seed);
  f.report.observations.push({ label: 'fixture', sha256: sha256(JSON.stringify(seed)) });

  f.phase = 'select the original top face and start the existing linked inset';
  await button(f.page.locator('.views'), 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const p = await f.page.evaluate(() => {
    const xy = window.__studioScreenOf([20, 12, 8]);
    return xy && document.elementFromPoint(...xy)?.closest('canvas.vp-canvas') ? xy : null;
  });
  assert.ok(p);
  await f.page.mouse.click(...p);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await button(f.sketchPanel(), 'Link face outline + inset').click();
  await f.sketchPanel().getByText(/Linked face outline and inset/).waitFor();
  const linked = (await f.finishSketch('01-linked-original')).doc;
  assert.deepEqual(linked.nodes[4].association, association('n1', 1));
  assert.deepEqual(linked.nodes[4].on, firstSource);

  f.phase = 'consume the existing linked ring in an independent Extrude';
  await f.openExtrudeHud();
  const applied = await f.applyExtrude({ distance: 4, previous: linked, label: '02-original-ring' });
  const original = applied.doc;
  assert.deepEqual(original.nodes[5], { kind: 'extrude', sketch: 4, height: 4, id: 'n5' });
  await verify('native-original', original, 0, 40, 'n1', 1);

  if (relink) {
    await replaceSource(original);
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'inspect the existing editor for an explicit replacement control';
  await f.openFeatureEditor(5, 'linked ring source');
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().getByText(/Linked face outline and inset/).waitFor();
  assert.equal(await f.sketchPanel().getByRole('button', { name: /re-link|reconnect|replace source/i }).count(), 0);
  assert.equal(await f.sketchPanel().getByRole('button', { name: 'Link face outline + inset', exact: true }).count(), 0);
  await f.snapshot('03-existing-linked-editor');
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(original);

  f.phase = 'measure a prepared v1 source replacement with the old on target retained';
  const replacement = structuredClone(original);
  replacement.nodes[4].association = association('n3', 3);
  assert.deepEqual({ ...replacement.nodes[4], association: original.nodes[4].association }, original.nodes[4]);
  await open('D867-prepared-replacement.bcad', replacement);
  await verify('native-replacement', replacement, 100, 60, 'n3', 3);
  await f.snapshot('04-prepared-replacement');

  f.phase = 'edit the original replacement body through its ordinary feature editor';
  await f.openFeatureEditor(3, 'replacement stock width');
  const width = f.editor().getByLabel('Width', { exact: true });
  assert.equal(Number(await width.inputValue()), 60);
  await width.fill('64');
  const edited = await f.applyEditor(replacement, '05-replacement-width-64');
  assert.deepEqual(edited.doc.nodes[4], replacement.nodes[4]);
  assert.deepEqual(edited.doc.nodes[5], replacement.nodes[5]);
  await verify('native-edited-replacement', edited.doc, 100, 64, 'n3', 3);
  await f.undo();
  await f.same(replacement);
  await f.redo();
  await f.same(edited.doc);

  f.phase = 'open a wrong stable source identity without promoting its saved geometry';
  const damaged = structuredClone(edited.doc);
  damaged.nodes[4].association.sourceFeature = 'n1';
  const refusal = await f.inspect('native-invalid-binding', damaged);
  assert.ok(refusal.stage !== 'accepted' && /BAD_REFERENCE/i.test(refusal.error), JSON.stringify(refusal));
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  await button(browser, 'Extrude 8').first().click();
  const before = await f.snapshot('06-before-bad-loose-open');
  assert.deepEqual(before.selection.selection.bodies, [0]);
  assert.equal(before.dirty, true);
  await chooseFile('D867-wrong-inset-source.bcad', damaged);
  await observeBadOpen(fixed ? '07-loose-open-refuses' : '07-bad-loose-open-adopted', before, damaged);

  f.phase = 'measure the same failed binding through Project Open';
  const projectFile = 'D867-project-wrong-inset-source.bcad', healthyFile = 'D868-project-healthy-inset.bcad';
  const files = fixed ? { [projectFile]: damaged, [healthyFile]: replacement } : { [projectFile]: damaged };
  const versions = await putProjectFiles(files);
  const beforeProject = await f.snapshot('08-before-bad-project-open');
  if (fixed) assert.equal(beforeProject.dirty, true);
  await button(versions, 'Open ' + projectFile).click();
  await observeBadOpen(fixed ? '09-project-open-refuses' : '09-bad-project-open-adopted', beforeProject, damaged);
  f.report.observations.push({ label: 'invalid-binding', ...refusal });

  if (fixed) {
    f.phase = 'confirm failed Opens left no Undo entry';
    await f.undo();
    await f.same(replacement);
    await f.redo();
    await f.same(edited.doc);
    f.phase = 'hold an invalid File Open reply and open a valid project file';
    await f.page.evaluate(() => window.__insetCheck.arm());
    await chooseFile('D868-late-invalid-inset.bcad', damaged);
    await f.page.waitForFunction(() => /BAD_REFERENCE/.test(window.__insetCheck.held()?.error ?? ''));
    await f.same(edited.doc);
    await button(versions, 'Open ' + healthyFile).click();
    await f.same(replacement);
    const accepted = await f.snapshot('10-valid-project-open');
    await f.page.evaluate(async () => {
      window.__insetCheck.release();
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const late = await f.snapshot('11-stale-invalid-open-ignored');
    unchanged(late, accepted);
    assert.ok(late.notices.every(notice => !/source feature binding/.test(notice)));
    await verify('native-current-after-late-reply', replacement, 100, 60, 'n3', 3);
  }
  assert.deepEqual(f.report.downloads, []);
});
