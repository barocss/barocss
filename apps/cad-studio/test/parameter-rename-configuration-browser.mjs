// D738: test actual parameter Rename and Apply with a retained configuration key.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/parameter-rename-configuration-browser.mjs',
  'apps/cad-studio/src/ui/ParametersPanel.tsx',
  'packages/barocss-cad-model/src/engine/parameters.ts',
  'packages/barocss-cad-model/src/chat/part/features.ts',
];
const f = await createFlow({
  name: 'parameter-rename-configuration', output, envFrozen: 'D738_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce overwritten configuration data' : 'Refuse Rename before configuration data can change',
  limits: ['Actual desktop Parameters panel and a synthetic width-bound solid.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return [button.disabled, button.getAttribute('data-tip')];
    }),
  }),
  inspectorSource: `
import { renameParameter } from '@barocss/cad-model/engine/parameters';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { runTool } from '@barocss/cad-model/chat/tools';
const { doc, from, to } = JSON.parse(process.argv[3]);
let result, error;
try { result = renameParameter(doc, from, to); }
catch (cause) { error = cause.message; }
process.env.CAD_AUTONOMY = '3';
const state = { doc, bodies: [] };
const agent = await runTool(state, 'set_parameters', { rename: { [from]: to } }, async d => evaluateDoc(d, 1));
console.log(JSON.stringify({ result, error, agentError: agent.isError ? JSON.parse(agent.content).error : null, agentDoc: agent.state.doc }));
`,
  oracleSource: String.raw`
import json, math, sys
d = json.load(sys.stdin)
ref = d['doc']['nodes'][0]['max'][0]
assert ref == {'parameter':d['parameter']}, ref
assert d['doc']['parameters'][d['parameter']] == d['width']
assert d['doc']['nodes'][1]['height'] == 10
body, = d['bodies']
assert math.isclose(body['volume'], d['width']*20*10, abs_tol=1e-7, rel_tol=0), body
print(json.dumps({'status':'PASS','width':d['width'],'volume':body['volume']}))
`,
});

const fixture = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { B: 40 },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'B' }, 20], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const native = Buffer.from(JSON.stringify(fixture));

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
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
  const panel = () => page.getByRole('complementary', { name: 'Parameters panel', exact: true });
  const field = (kind, name) => panel().getByLabel(kind + ' of ' + name, { exact: true });
  const rename = async (from, to) => {
    await field('Name', from).fill(to);
    await field('Name', from).press('Enter');
  };
  const changed = (name, value) => page.waitForFunction(([name, value]) => window.__studioDoc.parameters[name] === value, [name, value]);
  const physical = (snapshot, parameter, width) => f.runOracle({
    doc: snapshot.doc, bodies: snapshot.bodies.bodies, parameter, width,
  }, snapshot.label);
  const unchanged = (after, before) => {
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  };
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D738-width.bcad', mimeType: 'application/json', buffer: native });
  await f.same(fixture);
  await f.addParameter('A', 10, 'added-a');
  await f.openParameters();
  await panel().getByLabel('Configuration name', { exact: true }).fill('Production');
  await panel().getByRole('button', { name: 'Save configuration', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.configurations?.Production?.A === 10);
  await f.ready();
  await field('Value', 'B').fill('50');
  await field('Value', 'B').press('Enter');
  await changed('B', 50);
  await f.ready();
  await panel().getByRole('button', { name: 'Delete A', exact: true }).click();
  await page.waitForFunction(() => !Object.hasOwn(window.__studioDoc.parameters, 'A'));
  await f.ready();
  const before = await f.snapshot('before-rename');
  assert.deepEqual(before.doc.configurations, { Production: { B: 40, A: 10 } });
  await physical(before, 'B', 50);

  f.phase = 'Rename B to the retained configuration key A';
  const inspected = await f.inspect('collision-model-agent', {}, { doc: before.doc, from: 'B', to: 'A' });
  await rename('B', 'A');
  if (baseline) {
    assert.deepEqual(inspected.result.configurations, { Production: { A: 10 } });
    assert.deepEqual(inspected.agentDoc, inspected.result);
    await changed('A', 50);
    await f.same(inspected.result);
    await panel().getByRole('button', { name: 'Apply Production', exact: true }).click();
    await changed('A', 10);
    await f.ready();
    const applied = await f.snapshot('parent-applied-overwritten-configuration');
    await physical(applied, 'A', 10);
    f.report.observations.push({ fixtureSHA256: sha256(native), previousWidth: 50, appliedWidth: 10 });
    return;
  }
  assert.match(inspected.error, /^\[PARAMETER_EXISTS\].*Production.*A/);
  assert.equal(inspected.agentError, inspected.error);
  assert.deepEqual(inspected.agentDoc, before.doc);
  const refusedNotice = await f.waitToast(/Production.*A/);
  assert.match(refusedNotice, /configuration/i);
  assert.equal(await field('Name', 'B').inputValue(), 'B');
  const refused = await f.snapshot('atomic-refusal');
  unchanged(refused, before);
  await f.dismissToasts();

  f.phase = 'Rename to Width, verify first Undo and Redo, then apply Production';
  const normal = await f.inspect('normal-model-agent', {}, { doc: before.doc, from: 'B', to: 'Width' });
  await rename('B', 'Width');
  await changed('Width', 50);
  await f.same(normal.result);
  assert.deepEqual(normal.agentDoc, normal.result);
  const renamed = await f.snapshot('renamed-width');
  assert.deepEqual(renamed.doc.configurations, { Production: { Width: 40, A: 10 } });
  await physical(renamed, 'Width', 50);
  await f.undo();
  await f.same(before.doc);
  await f.redo();
  await f.same(renamed.doc);
  await panel().getByRole('button', { name: 'Apply Production', exact: true }).click();
  await changed('Width', 40);
  await f.ready();
  const applied = await f.snapshot('production-applied');
  await physical(applied, 'Width', 40);

  f.phase = 'Save, close, reload and open the same local project document';
  await f.closeParameters(panel());
  const project = 'D738 configurations', fileName = 'configuration-study.bcad';
  const versions = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };
  await page.locator('.doc-tab input').fill('configuration-study');
  await attach();
  await button('Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  await page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const saved = await page.evaluate(async ({ project, fileName }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(fileName)).getFile()).text();
  }, { project, fileName });
  assert.deepEqual(JSON.parse(saved), applied.doc);
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'detached' });
  await page.reload();
  assert.equal(page.context(), f.context);
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + fileName, exact: true }).click();
  await f.same(applied.doc);
  await f.openParameters();
  const reopened = await f.snapshot('reopened-production');
  await physical(reopened, 'Width', 40);
  await rename('Width', 'A');
  await f.waitToast(/Production.*A/);
  assert.equal(await field('Name', 'Width').inputValue(), 'Width');
  unchanged(await f.snapshot('reopened-refusal'), reopened);
  await rename('Width', 'FinalWidth');
  await changed('FinalWidth', 40);
  await f.ready();
  const retry = await f.snapshot('reopened-normal-retry');
  assert.deepEqual(retry.doc.configurations, { Production: { FinalWidth: 40, A: 10 } });
  await physical(retry, 'FinalWidth', 40);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ fixtureSHA256: sha256(native), savedSHA256: sha256(saved), width: 40 });
});
