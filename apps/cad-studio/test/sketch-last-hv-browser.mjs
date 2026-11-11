// D747: keep the last removed H/V constraint out of the actual reopened sketch.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-last-hv-browser.mjs',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'packages/barocss-cad-model/src/sketch/loops.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
];
const f = await createFlow({
  name: 'sketch-last-hv', output, envFrozen: 'D747_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce an erased H/V relation after reopening' : 'Preserve an explicitly empty H/V recipe',
  limits: ['Ordinary convex straight outline with one horizontal constraint and an existing Extrude.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { settleShape } from '@barocss/cad-model/sketch/settle';
const points = [[0,0],[40,0],[36,21],[3,23]], open = { kind:'polygon', points, closed:false, bulges:[0,0,0,0] };
const settled = settleShape({...open,closed:true}, open);
assert.equal(settled.error, null);
const built = profileOf([settled.shape]);
assert.ok('node' in built);
const doc = withNode(withNode(emptyDoc(), built.node), { kind:'extrude', sketch:0, height:8 });
console.log(JSON.stringify({ doc }));
`,
  snapshotExtra: () => ({
    constraints: [...document.querySelectorAll('[aria-label="Constraints"] button[aria-label]')].map(button => button.getAttribute('aria-label')),
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

const original = [[0, 0], [40, 0], [36, 21], [3, 23]];
const edited = [[0, 0], [44, 0], [36, 21], [3, 23]];
const none = { h: [], v: [] };
const horizontal = { h: [0], v: [] };
const volume = (points, height = 8) => height * points.reduce((sum, [x, y], index) => {
  const [u, v] = points[(index + 1) % points.length];
  return sum + x * v - y * u;
}, 0) / 2;

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
  const panel = () => f.sketchPanel();
  const h = () => panel().getByRole('button', { name: 'Remove Horizontal edge 1', exact: true });
  const dof = async expected => {
    await page.waitForFunction(n => document.querySelector('.sk-panel .solver')?.textContent.includes(n + ' DOF'), expected);
    assert.equal(await h().count(), expected === 5 ? 1 : 0);
  };
  const reopen = async expected => {
    await f.openFeatureEditor(1);
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await panel().waitFor();
    await dof(expected);
  };
  const cancel = async doc => {
    await page.keyboard.press('Escape');
    await panel().waitFor({ state: 'hidden' });
    await f.same(doc);
  };
  const authored = (state, points, hv, source) => {
    const sketch = state.doc.nodes[0];
    assert.equal(sketch.profile, 'polygon');
    assert.deepEqual(sketch.points, points);
    assert.deepEqual(sketch.outline?.hv, hv);
    if (hv) {
      assert.deepEqual(sketch.outline.points, points);
      assert.equal(sketch.outline.bulges, undefined);
    }
    assert.deepEqual(sketch.sideTags, source.nodes[0].sideTags);
    assert.deepEqual(sketch.plane, source.nodes[0].plane);
    assert.deepEqual(state.doc.nodes.slice(1), source.nodes.slice(1));
    assert.deepEqual(state.doc.outputs, source.outputs);
    assert.deepEqual(state.doc.parameters, source.parameters);
    assert.equal(state.bodies.bodies.length, 1);
    assert.ok(Math.abs(state.bodies.bodies[0].volume - volume(points)) < 1e-7);
  };

  f.phase = 'Open the original constrained outline and existing Extrude';
  const { doc: source } = await f.inspect('source-outline', {}, {});
  const sourceBytes = Buffer.from(JSON.stringify(source));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'last-horizontal.bcad', mimeType: 'application/json', buffer: sourceBytes });
  await f.same(source);
  authored(await f.snapshot('original-constrained-part'), original, horizontal, source);
  f.report.observations.push({ sourceSHA256: sha256(sourceBytes), independentVolume: volume(original) });
  await reopen(5);
  await h().click();
  await dof(6);
  assert.deepEqual(await f.doc(), source);
  await f.snapshot('removed-before-finish');
  const removed = await f.finishSketch('removed-accepted');
  authored(removed, original, baseline ? undefined : none, source);
  await reopen(baseline ? 5 : 6);
  await f.snapshot('removed-reopened');
  await cancel(removed.doc);
  if (baseline) return;

  f.phase = 'Keep the recipe and geometry through Undo and Redo';
  await f.undo();
  await f.same(source);
  await reopen(5);
  await cancel(source);
  await f.redo();
  await f.same(removed.doc);
  await reopen(6);
  await cancel(removed.doc);

  const project = 'D747 constraint fixture', file = 'last-horizontal.bcad';
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
  assert.deepEqual(JSON.parse(saved), removed.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(removed.doc);
  authored(await f.snapshot('fresh-open-removed'), original, none, source);

  f.phase = 'Reapply Horizontal explicitly and remove it again before editing';
  await reopen(6);
  await f.frame([[0, 0], [40, 23]]);
  await f.worldClick([20, 0]);
  await panel().getByRole('button', { name: 'Horizontal', exact: true }).click();
  await dof(5);
  await f.snapshot('explicit-horizontal-reapplied');
  await h().click();
  await dof(6);
  await panel().getByLabel('Point 2 X', { exact: true }).fill('44');
  await dof(6);
  const modified = await f.finishSketch('coordinate-edit-and-native-volume');
  authored(modified, edited, none, source);
  await reopen(6);
  assert.equal(Number(await panel().getByLabel('Point 2 X', { exact: true }).inputValue()), 44);
  await cancel(modified.doc);
  assert.deepEqual(f.report.downloads, []);
});
