import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D807_BASELINE === '1';
const pins = ['apps/cad-studio/test/ordinary-arc-path-gap-browser.mjs', 'apps/cad-studio/src/sketch/pathGap.ts',
  'apps/cad-studio/src/sketch/usePathGap.ts', 'packages/barocss-cad-model/src/engine/curveSource.ts'];
const f = await createFlow({
  name: 'ordinary-arc-path-gap', output, envFrozen: 'D807_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Preserve two ordinary gapped arcs through Finish refusal, Make curves and project Open.',
  limits: ['One independent ordinary semicircle in a new XY draft.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { curveLength, geometryOf } from '@barocss/cad-model/engine/direct';
import { curveDomain, evaluateCurve } from '@barocss/cad';
const { direct } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(direct.objects.map(object => {
  const curve = geometryOf(direct, object);
  if (curve.kind !== 'curve') throw Error('Expected a direct curve');
  const [lo, hi] = curveDomain(curve);
  const radii = Array.from({ length: 17 }, (_, index) => {
    const [x, y, z] = evaluateCurve(curve, lo + (hi - lo) * index / 16);
    return Math.hypot(x - 20, y - 20, z);
  });
  return { ends: [evaluateCurve(curve, lo), evaluateCurve(curve, hi)], length: curveLength(direct, object.id),
    radii: [Math.min(...radii), Math.max(...radii)] };
})));
`,
});
const a = [30, 20], b = [10, 20], apex = [20, 30];
const cutA = [20 + 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2), 0];
const cutB = [20 - 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2), 0];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const preview = () => f.page.locator('.vp-overlay .sk-path-gap');
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D807 ordinary arc gap ' + randomUUID(), name = 'Untitled.bcad';
const distance = (p, q) => Math.hypot(...p.map((coordinate, i) => coordinate - q[i]));
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
  await f.frame([a, b, apex]);
  await f.worldClick(a);
  await f.tool('Arc', 'a');
  await f.worldClick(b);
  await f.worldClick(apex);
  const radius = f.sketchPanel().getByLabel('Arc 1 radius', { exact: true });
  await radius.fill('11');
  await radius.fill('10');
  await f.tool('Trim', 't');
  const gap = button(f.sketchPanel(), 'Cut arc gap');
  if (baseline) assert.equal(await gap.count(), 0);
  else {
    f.phase = 'cut the ordinary arc at its top';
    await gap.click();
    await f.sketchPanel().getByLabel('Gap length', { exact: true }).fill('4');
    const pixel = await f.screenOf(apex);
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
    await f.page.mouse.move(...pixel);
    await preview().waitFor({ timeout: 5000 });
    await f.snapshot('01-arc-gap-preview');
    await f.page.mouse.click(...pixel);
    await preview().waitFor({ state: 'hidden' });
  }

  f.phase = 'refuse Finish and keep the ordinary arc geometry';
  await f.page.locator('.topbar button.finish').click();
  await f.sketchPanel().getByRole('alert').getByText(/Close or trim the open chain/).waitFor();
  await f.same(empty);
  await f.snapshot('02-finish-refusal');

  f.phase = 'make and inspect the native direct arcs';
  await button(f.sketchPanel(), 'Make curves').click();
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(count => window.__studioDoc.direct?.objects.length === count, baseline ? 1 : 2);
  await f.ready();
  const doc = await f.doc();
  assert.deepEqual(doc.nodes, []);
  const native = await f.inspect('ordinary-arcs-native', doc);
  const expected = baseline ? [[[...a, 0], [...b, 0]]] : [[[...a, 0], cutA], [cutB, [...b, 0]]];
  assert.equal(native.length, expected.length);
  for (const [index, ends] of expected.entries()) {
    for (const [endIndex, point] of ends.entries()) assert.ok(distance(native[index].ends[endIndex], point) < 3e-6, native[index]);
    assert.ok(Math.abs(native[index].length - (baseline ? 10 * Math.PI : 5 * Math.PI - 2)) < 1e-5, native[index]);
    assert.ok(native[index].radii.every(radius => Math.abs(radius - 10) < 2e-5), native[index]);
  }
  await f.snapshot('03-made-arcs');
  f.report.observations.push({ label: 'ordinary-arc-path', baseline, finish: 'REFUSED', native });
  if (!baseline) {
    const measuredGap = 20 * Math.asin(distance(native[0].ends[1], native[1].ends[0]) / 20);
    assert.ok(Math.abs(measuredGap - 4) < 1e-5, measuredGap);
    await f.undo();
    await f.same(empty);
    await f.redo();
    await f.same(doc);

    f.phase = 'save and reopen the exact two direct arcs';
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
    await f.snapshot('04-reopened-arcs');
    f.report.observations.push({ label: 'ordinary-arc-project', measuredGapMm: measuredGap, bytes: bytes.length, sha256: sha256(bytes) });
  }
  assert.deepEqual(f.report.downloads, []);
});
