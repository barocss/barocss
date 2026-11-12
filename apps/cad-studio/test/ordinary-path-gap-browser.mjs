import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D805_BASELINE === '1';
const pins = ['apps/cad-studio/test/ordinary-path-gap-browser.mjs', 'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/sketch/usePathGap.ts', 'packages/barocss-cad-model/src/engine/curveSource.ts'];
const f = await createFlow({
  name: 'ordinary-path-gap', output, envFrozen: 'D805_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Keep a gapped ordinary draft open through Finish refusal and explicitly make both direct curves.',
  limits: ['One new unconstrained line in the default XY plane.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { geometryOf, curveLength } from '@barocss/cad-model/engine/direct';
import { curveDomain, evaluateCurve } from '@barocss/cad';
const { direct } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(direct.objects.map(object => {
  const curve = geometryOf(direct, object);
  if (curve.kind !== 'curve') throw Error('Expected a direct curve');
  const [lo, hi] = curveDomain(curve);
  return { ends: [evaluateCurve(curve, lo), evaluateCurve(curve, hi)], length: curveLength(direct, object.id) };
})));
`,
});
const a = [20, 20], b = [44, 38], mid = [32, 29];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const gap = () => button(f.sketchPanel(), 'Cut line gap');
const preview = () => f.page.locator('.vp-overlay .sk-path-gap');
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D805 ordinary line gap ' + randomUUID(), name = 'Untitled.bcad';
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Line', 'l');
  await f.frame([a, mid, b]);
  await f.worldClick(a);
  await f.worldClick(b);
  await f.tool('Trim', 't');
  if (!baseline) {
    f.phase = 'cut a 4 mm gap in the ordinary line draft';
    await gap().click();
    await f.sketchPanel().getByLabel('Gap length', { exact: true }).fill('4');
    const pixel = await f.screenOf(mid);
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
    await f.page.mouse.move(...pixel);
    await preview().waitFor({ timeout: 5000 });
    await f.snapshot('00-ordinary-gap-preview');
    await f.page.mouse.click(...pixel);
    await preview().waitFor({ state: 'hidden' });
  }

  f.phase = 'refuse Finish and keep the ordinary open line';
  await f.page.locator('.topbar button.finish').click();
  await f.sketchPanel().getByRole('alert').getByText(/Close or trim the open chain/).waitFor();
  await f.same(empty);
  await f.snapshot('01-finish-refusal');

  f.phase = 'make the ordinary paths explicitly';
  await button(f.sketchPanel(), 'Make curves').click();
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(count => window.__studioDoc.direct?.objects.length === count, baseline ? 1 : 2);
  await f.ready();
  const doc = await f.doc();
  assert.deepEqual(doc.nodes, []);
  const native = await f.inspect('ordinary-line-native', doc);
  const expected = baseline
    ? [[[20, 20, 0], [44, 38, 0]]]
    : [[[20, 20, 0], [30.4, 27.8, 0]], [[33.6, 30.2, 0], [44, 38, 0]]];
  assert.equal(native.length, expected.length);
  for (const [index, ends] of expected.entries()) {
    for (const [endIndex, [x, y, z]] of ends.entries()) {
      const actual = native[index].ends[endIndex];
      assert.ok(Math.hypot(actual[0] - x, actual[1] - y, actual[2] - z) < 3e-6, actual);
    }
    assert.ok(Math.abs(native[index].length - (baseline ? 30 : 13)) < 1e-5, native[index]);
  }
  await f.snapshot('02-made-curve');
  f.report.observations.push({ label: 'ordinary-open-path', baseline, finish: 'REFUSED', native });
  if (!baseline) {
    const cutEnds = [native[0].ends[1], native[1].ends[0]];
    const distance = Math.hypot(...cutEnds[0].map((coordinate, axis) => coordinate - cutEnds[1][axis]));
    assert.ok(Math.abs(distance - 4) < 1e-5, distance);
    await f.undo();
    await f.same(empty);
    await f.redo();
    await f.same(doc);

    f.phase = 'save and reopen the exact direct curves';
    await openProject();
    await button(f.page, 'Save').click();
    await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
    await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
    const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
      const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
      const directory = await projects.getDirectoryHandle(project);
      return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
    }, [project, name]));
    assert.deepEqual(JSON.parse(bytes), doc);
    await button(versions(), 'Close project').click();
    await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
    await f.page.reload();
    await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
    await f.ready();
    await openProject();
    await button(versions(), 'Open ' + name).click();
    await f.same(doc);
    assert.equal(await preview().count(), 0);
    await f.snapshot('03-reopened-curves');
    f.report.observations.push({ label: 'ordinary-gap-project', gapMm: distance, bytes: bytes.length, sha256: sha256(bytes) });
  }
  assert.deepEqual(f.report.downloads, []);
});
