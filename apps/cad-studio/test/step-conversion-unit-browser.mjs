// D723: STEP unit admission through desktop Open and Add reference.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/step-conversion-unit-browser.mjs',
  'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'packages/barocss-cad-model/src/engine/stepUnits.ts',
  'packages/barocss-cad-model/src/chat/references.ts',
];
const f = await createFlow({
  name: 'step-conversion-unit', output, envFrozen: 'D723_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a mis-scaled STEP solid in desktop Studio' : 'Refuse unsupported STEP length conversions before dispatch',
  limits: ['Locally generated analytic and AP242 mesh-only boxes, normal Open and reference routes, local OPFS native Save.'],
  snapshotExtra: () => ({
    bounds: [...(document.querySelector('[aria-label="Selection"]')?.querySelectorAll('.kv') ?? [])]
      .find(element => element.textContent.startsWith('Bounds'))?.querySelector('b')?.textContent,
  }),
  inspectorSource: `
import { evaluateCadPart, exportStep, facetBrepFromTriangles, tessellateBrep } from '@barocss/cad';
import { stepLengthUnit } from '@barocss/cad-model/engine/stepUnits';
import { isRefusal } from '@barocss/cad-model/engine/refusal';
const { source } = JSON.parse(process.argv[3]);
if (source) {
  try { console.log(JSON.stringify({ unit: stepLengthUnit(source) })); }
  catch (error) { console.log(JSON.stringify({ notRead: isRefusal(error, 'NOT_READ'), message: error.message })); }
} else {
  const { outputs: [{ brep }] } = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'sketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 3] },
    { id: 'box', kind: 'extrude', sketch: 'sketch', height: 4 },
  ] });
  const { positions, indices } = tessellateBrep(brep);
  const mesh = facetBrepFromTriangles(positions, indices, { id: 'box' });
  console.log(JSON.stringify({ solid: exportStep(brep), mesh: exportStep(mesh, { meshes: 'tessellated' }) }));
}
`,
});

function withLengthConversion(text, name) {
  const mm = /^(#\d+)=\(LENGTH_UNIT\(\)NAMED_UNIT\(\*\)SI_UNIT\(\.MILLI\.,\.METRE\.\)\);$/m.exec(text)[1];
  const next = Math.max(...[...text.matchAll(/^#(\d+)=/gm)].map(match => Number(match[1]))) + 1;
  const [dimensions, measure, unit] = [next, next + 1, next + 2].map(id => '#' + id);
  const context = 'GLOBAL_UNIT_ASSIGNED_CONTEXT((';
  assert.ok(text.includes(context + mm + ','));
  const conversion = [
    `${dimensions}=DIMENSIONAL_EXPONENTS(1.,0.,0.,0.,0.,0.,0.);`,
    `${measure}=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),${mm});`,
    `${unit}=(CONVERSION_BASED_UNIT('${name}',${measure}) LENGTH_UNIT() NAMED_UNIT(${dimensions}));`,
  ].join('\n');
  const source = text.replace(context + mm + ',', context + unit + ',').replace(/\nENDSEC;\s*END-ISO-10303-21;/, `\n${conversion}\nENDSEC;\nEND-ISO-10303-21;`);
  assert.ok(source.includes(context + unit + ',') && source.includes(conversion));
  return { source, mm, unit, measure, sha256: sha256(source) };
}

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
    await context.addInitScript(() => {
      const NativeWorker = window.Worker;
      const reads = [];
      window.__d723Reads = reads;
      const hold = window.__d723Hold = { armed: false, received: false, release: null, delivered: false };
      window.Worker = class extends NativeWorker {
        set onmessage(listener) {
          super.onmessage = listener ? event => {
            if (hold.armed && Object.hasOwn(event.data ?? {}, 'meshes')) {
              hold.armed = false;
              hold.received = true;
              hold.release = () => { listener.call(this, event); hold.delivered = true; };
              return;
            }
            listener.call(this, event);
          } : null;
        }
        get onmessage() { return super.onmessage; }
        postMessage(request, options) {
          if (request.type === 'stepMeshes' || request.type === 'diagnose' || request.type === 'part' && request.slot === 'read') reads.push(request.type);
          return super.postMessage(request, options);
        }
      };
    });
    return context;
  };
  await f.newPage();
  let page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const makeFile = async (name, source) => {
    const file = join(output, name + '.step');
    await writeFile(file, source);
    return file;
  };
  const open = async file => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
  };
  const opened = async (source, units) => {
    await f.waitToast(new RegExp('STEP opened.*1 solid, in ' + units));
    await page.waitForFunction(expected => window.__studioDoc.nodes[0]?.step === expected, source);
    await f.ready();
  };
  const solidGeometry = (state, factor) => {
    const body = state.bodies.bodies[0];
    assert.equal(state.bodies.bodies.length, 1);
    assert.ok(Math.abs(body.volume - 24 * factor ** 3) < 1e-7, JSON.stringify(body));
    assert.ok(state.bounds, 'Studio shows body bounds');
    const sizes = state.bounds.split(' × ').map(Number);
    assert.ok(sizes.every((v, axis) => Math.abs(v - (axis + 2) * factor) < 1e-4), JSON.stringify(sizes));
    return { volume: body.volume, sizes };
  };
  const workerReads = () => page.evaluate(() => window.__d723Reads.slice());
  const chrome = () => page.evaluate(() => ({
    title: document.querySelector('.doc-tab input')?.value,
    dirty: Boolean(document.querySelector('[aria-label="Unsaved changes"]')),
    history: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
  }));
  const references = () => page.getByLabel('Add reference', { exact: true });
  const refused = /STEP declares an unsupported conversion-based length unit.*CUSTOM_INCH/i;
  const sources = await f.inspect('source-boxes', {}, {});
  assert.match(sources.mesh, /TRIANGULATED_FACE/);
  assert.doesNotMatch(sources.mesh, /ADVANCED_FACE/);
  const inch = withLengthConversion(sources.solid, 'INCH');
  const custom = withLengthConversion(sources.solid, 'CUSTOM_INCH');
  assert.equal(custom.source.replace("'CUSTOM_INCH'", "'INCH'"), inch.source);
  const customFile = await makeFile('custom-inch', custom.source);
  const route = await f.inspect('conversion-adapter', {}, { source: custom.source });
  f.report.observations.push({ graph: { mm: custom.mm, conversion: custom.unit, factor: custom.measure, value: 25.4 }, inchSha256: inch.sha256, customSha256: custom.sha256, route });

  f.phase = 'Open the supported inch solid';
  await open(await makeFile('inch-solid', inch.source));
  await opened(inch.source, 'inches');
  const inchOpened = await f.snapshot('inch-solid');
  assert.equal(inchOpened.doc.nodes[1].factor, 25.4);
  f.report.observations.push({ inch: solidGeometry(inchOpened, 25.4) });
  await f.dismissToasts();
  if (baseline) {
    f.phase = 'Reproduce acceptance of the same shape at millimetre scale';
    assert.deepEqual(route.unit, { name: 'millimetres', to: 1, declared: true });
    await open(customFile);
    await opened(custom.source, 'millimetres');
    const wrong = await f.snapshot('baseline-custom-inch-accepted-as-mm');
    assert.equal(wrong.doc.nodes.length, 1);
    f.report.observations.push({ wronglyAccepted: solidGeometry(wrong, 1), requiredVolume: 24 * 25.4 ** 3 });
    return;
  }
  assert.equal(route.notRead, true);
  assert.match(route.message, refused);

  const add = async (name, source) => references().setInputFiles(await makeFile(name, source));
  f.phase = 'Establish an accepted millimetre reference and a Redo entry';
  await add('accepted-mm-reference', sources.solid);
  await page.waitForFunction(() => window.__studioDoc.references?.references?.length === 1);
  await f.ready();
  assert.equal((await f.doc()).references.references[0].source.step, sources.solid);

  const row = page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol').first();
  await row.dblclick();
  const name = page.getByRole('textbox', { name: 'Body name', exact: true });
  const beforeRename = await f.doc();
  await name.fill('Inch control');
  await name.press('Enter');
  await f.changed(beforeRename);
  await f.undo();
  await f.same(beforeRename);
  await row.click();
  const accepted = await f.snapshot('accepted-with-reference-and-redo');
  assert.deepEqual(accepted.selection.selection.bodies, [0]);
  const controls = await chrome();
  assert.equal(controls.history[1].disabled, false);
  const reads = await workerReads();
  assert.ok(reads.includes('stepMeshes') && reads.includes('part'));

  const unchanged = async label => {
    const state = await f.snapshot(label);
    assert.deepEqual(state.doc, accepted.doc);
    assert.deepEqual(state.bodies.bodies, accepted.bodies.bodies);
    assert.deepEqual(state.selection.selection, accepted.selection.selection);
    assert.deepEqual(state.history, accepted.history);
    assert.deepEqual(await chrome(), controls);
    assert.deepEqual(await workerReads(), reads);
    assert.ok(state.notices.every(notice => !/STEP opened/.test(notice)));
  };

  f.phase = 'Reject unsupported conversion in the solid Open and reference routes';
  await open(customFile);
  await f.waitToast(/Could not open this file.*CUSTOM_INCH/);
  await f.waitToast(refused);
  await unchanged('custom-solid-refused');
  await f.dismissToasts();
  await references().setInputFiles(customFile);
  await f.waitToast(/Reference not changed.*CUSTOM_INCH/);
  await f.waitToast(refused);
  await unchanged('custom-reference-refused');
  await f.dismissToasts();

  f.phase = 'Reject unsupported conversion on a mesh-only source before the worker';
  const customMesh = withLengthConversion(sources.mesh, 'CUSTOM_INCH');
  await open(await makeFile('custom-mesh', customMesh.source));
  await f.waitToast(refused);
  await unchanged('custom-mesh-refused');
  await f.dismissToasts();

  f.phase = 'Save the accepted document into a local Studio project';
  const project = 'D723 STEP length units';
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  const files = panel.getByRole('list', { name: 'Project documents', exact: true });
  await files.getByText('inch-solid.bcad', { exact: true }).waitFor();
  const saved = await page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return (await (await dir.getFileHandle('inch-solid.bcad')).getFile()).text();
  }, project);
  assert.deepEqual(JSON.parse(saved), accepted.doc);
  assert.ok(!saved.includes('CUSTOM_INCH'));
  const nativePath = join(output, 'inch-solid.bcad');
  await writeFile(nativePath, saved);

  await f.newPage();
  page = f.page;
  await open(nativePath);
  await f.same(accepted.doc);
  const reopened = await f.snapshot('fresh-native-inch');
  f.report.observations.push({ nativeSHA256: sha256(saved), reopened: solidGeometry(reopened, 25.4), customMeshSHA256: customMesh.sha256 });
  assert.equal(reopened.doc.nodes.filter(node => node.kind === 'scale').length, 1);

  f.phase = 'Open the supported AP242 mesh and continue with a supported reference';
  const mesh = withLengthConversion(sources.mesh, 'INCH');
  await open(await makeFile('inch-mesh', mesh.source));
  await opened(mesh.source, 'inches');
  const meshOpened = await f.snapshot('inch-mesh');
  assert.equal(meshOpened.doc.nodes[1].factor, 25.4);
  const meshReads = await workerReads();
  assert.ok(meshReads.includes('stepMeshes') && meshReads.includes('diagnose') && meshReads.includes('part'));
  f.report.observations.push({ mesh: solidGeometry(meshOpened, 25.4), meshReads });
  await add('supported-mm-reference', sources.solid);
  await page.waitForFunction(() => window.__studioDoc.references?.references?.length === 1);
  const recovered = await f.snapshot('supported-reference-after-recovery');
  assert.equal(recovered.doc.references.references[0].source.step, sources.solid);
  assert.deepEqual(recovered.doc.nodes, meshOpened.doc.nodes);
  f.phase = 'Cancel an Open with a real STEP mesh reply waiting to arrive';
  const slow = await makeFile('held-inch-solid', inch.source);
  const working = page.getByLabel('Working', { exact: true });
  const arm = async () => {
    await page.evaluate(() => Object.assign(window.__d723Hold, { armed: true, received: false, delivered: false }));
    await open(slow);
    await page.waitForFunction(() => window.__d723Hold.received);
    await working.getByRole('button', { name: 'Cancel the computation', exact: true }).waitFor();
  };
  const deliver = async () => {
    await page.evaluate(() => window.__d723Hold.release());
    await page.waitForFunction(() => window.__d723Hold.delivered);
    await f.ready();
  };
  await f.dismissToasts();
  await arm();
  await working.getByRole('button', { name: 'Cancel the computation', exact: true }).click();
  await deliver();
  await f.same(recovered.doc);
  const cancelled = await f.snapshot('cancelled-late-step-reply');
  assert.deepEqual(cancelled.history, recovered.history);
  assert.ok(cancelled.notices.every(notice => !/STEP opened/.test(notice)));

  f.phase = 'Open a native part before the previous STEP reply arrives';
  await arm();
  await open(nativePath);
  await f.same(accepted.doc);
  await deliver();
  const replaced = await f.snapshot('native-open-before-late-step-reply');
  assert.deepEqual(replaced.doc, accepted.doc);
  assert.ok(replaced.notices.every(notice => !/STEP opened/.test(notice)));
  solidGeometry(replaced, 25.4);
  assert.deepEqual(f.report.downloads, []);
});
