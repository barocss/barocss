import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = process.argv[2];
const pins = ['apps/cad-studio/test/arc-extension-source-edit-browser.mjs', 'apps/cad-studio/src/sketch/arcExtension.ts',
  'apps/cad-studio/src/sketch/useArcExtensionSnap.ts', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts'];
const f = await createFlow({
  name: 'arc-extension-source-edit', output, envFrozen: 'D801_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Retire the original circular guide and acquire only the current terminal after Trim.',
  limits: ['One open CCW construction arc and one crossing line, one XY to XZ plane change, and a separate ordinary snap competition fixture.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
}))));
`,
});
const arc = { kind: 'polygon', points: [[30, 20], [20, 30]], closed: false,
  bulges: [Math.SQRT2 - 1, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const cutLine = { kind: 'polygon', points: [[26, 26], [26, 32]], closed: false,
  bulges: [0, 0], pending: false, construction: true, ids: ['e7', 'e8'] };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [34, 36], max: [39, 41], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
    construction: [arc, cutLine], id: 'n0' },
], outputs: {}, nextId: 1 };
const oldTerminal = arc.points[1], newTerminal = [26, 28], trimPick = [22.8, 29.6], farCorner = [25, 35];
const competingArc = { ...arc, points: [[20, 0], [10, 10]] };
const competition = { ...initial, nodes: [{ ...initial.nodes[0], construction: [competingArc,
  { kind: 'circle', c: [3, 5], r: 3, construction: true, ids: ['e7'] },
  { ...cutLine, points: [[1, 4], [2, 10]], ids: ['e8', 'e9'] },
] }] };
const onCompetitionCircle = degrees => {
  const angle = degrees * Math.PI / 180;
  return [10 + 10 * Math.cos(angle), 10 * Math.sin(angle)];
};
const oldDirection = 160 * Math.PI / 180;
const oldAim = [20 + 10.7 * Math.cos(oldDirection), 20 + 10.7 * Math.sin(oldDirection)];
const newAim = [20, 30.8];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const guide = () => f.page.locator('.vp-overlay .sk-arc-extension');
const mark = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Extension' });
const extension = () => button(f.sketchPanel(), 'Arc extension snap');
const settle = () => f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function hover(point) {
  const pixel = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), { point, pixel });
  await f.page.mouse.move(...pixel);
  await settle();
  return pixel;
}
async function begin() {
  await extension().click();
  await f.sketchPanel().getByRole('status').getByText('Pick the arc end.').waitFor();
}
async function arm(terminal) {
  await begin();
  await f.worldClick(terminal);
  await guide().waitFor({ timeout: 5000 });
}

await f.run(async () => {
  await f.newPage();
  const file = join(output, 'trim-source.bcad');
  await writeFile(file, JSON.stringify(initial));
  await f.openFile(file, 1);
  const opened = await f.doc();
  assert.deepEqual(opened.nodes, initial.nodes);
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([oldAim, oldTerminal, newTerminal, trimPick, newAim, farCorner]);

  f.phase = 'retire the guide before trimming the source';
  await arm(oldTerminal);
  await hover(oldAim);
  await mark().waitFor({ timeout: 5000 });
  await f.snapshot('01-old-guide');
  await f.same(opened);
  await f.tool('Trim', 't');
  await guide().waitFor({ state: 'hidden' });
  await f.worldClick(trimPick);
  await f.tool('Rectangle', 'r');
  await hover(oldAim);
  assert.equal(await mark().count(), 0);

  f.phase = 'reject the old terminal and acquire the new terminal';
  await begin();
  await f.worldClick(oldTerminal);
  assert.equal(await guide().count(), 0);
  await f.worldClick(newTerminal);
  await guide().waitFor({ timeout: 5000 });
  await hover(oldAim);
  assert.equal(await mark().count(), 0);
  const hit = await hover(newAim);
  await mark().waitFor({ timeout: 5000 });
  const drawn = await mark().locator('rect').evaluate(element => {
    const box = element.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  });
  const expected = await f.screenOf(oldTerminal);
  assert.ok(Math.hypot(drawn[0] - expected[0], drawn[1] - expected[1]) < 1);
  await f.snapshot('02-new-guide');
  await f.page.mouse.click(...hit);
  await guide().waitFor({ state: 'hidden' });
  await f.worldClick(farCorner);
  const placed = await f.finishSketch('03-edited-source');
  const sketch = placed.doc.nodes[0];
  assert.deepEqual(sketch.regions[0].map(segment => segment.start), [[20, 30], [25, 30], [25, 35], [20, 35]]);
  assert.equal(sketch.construction.length, 2);
  assert.deepEqual(sketch.construction.find(shape => shape.bulges[0] === 0), cutLine);
  const trimmed = sketch.construction.find(shape => shape.bulges[0] > 0);
  assert.deepEqual(trimmed.points, [arc.points[0], newTerminal]);
  assert.ok(Math.abs(4 * Math.atan(trimmed.bulges[0]) - Math.atan2(4, 3)) < 1e-8);
  assert.equal(trimmed.ids[0], arc.ids[0]);
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(placed.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: placed.doc, label: '04-native-solid' });
  const [native] = await f.inspect('trimmed-extension-native', solid.doc);
  assert.equal(native.valid, true);
  assert.ok(Math.abs(native.volume - 100) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 100) < 1e-8);

  f.phase = 'retire an armed guide on plane change';
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  const plane = f.sketchPanel().getByLabel('Sketch plane', { exact: true });
  const a = [45, -8], b = [61, -8], bend = [53, -14];
  await plane.selectOption('xy');
  await f.frame([a, b, bend]);
  await f.tool('Line', 'l');
  await button(f.page, 'Construction').click();
  await f.worldClick(a);
  await f.tool('Arc', 'a');
  await f.worldClick(b);
  await f.worldClick(bend);
  await f.tool('Rectangle', 'r');
  await button(f.page, 'Construction').click();
  await arm(b);
  await plane.selectOption('xz');
  await guide().waitFor({ state: 'hidden' });
  assert.equal(await extension().getAttribute('aria-pressed'), 'false');
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(solid.doc);
  await f.snapshot('05-plane-retirement');
  f.report.observations.push({ label: 'trimmed-extension', oldTerminal, newTerminal, trimPick, trimmed, storedCorner: oldTerminal, volumeMm3: 100 });

  f.phase = 'prioritize ordinary snaps while the extension is also in reach';
  const competitionFile = join(output, 'competition.bcad');
  await writeFile(competitionFile, JSON.stringify(competition));
  await f.openFile(competitionFile, 1);
  await f.same(competition);
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([...competingArc.points, onCompetitionCircle(176), onCompetitionCircle(160), onCompetitionCircle(135), [7, 12]]);
  await arm(competingArc.points[1]);
  const ordinary = f.page.locator('.vp-overlay .sk-osnap text');
  const competitors = [
    { degrees: 176, label: 'Origin', point: [0, 0] },
    { degrees: 160, label: 'End', point: [1, 4] },
    { degrees: 135, label: 'Quadrant', point: [3, 8] },
  ];
  let quadrantClick;
  for (const { degrees, label, point } of competitors) {
    const pixel = await hover(onCompetitionCircle(degrees));
    const projected = await f.screenOf(point);
    const reach = Math.hypot(pixel[0] - projected[0], pixel[1] - projected[1]);
    assert.ok(reach > 1 && reach < 8, { label, reach });
    assert.equal(await ordinary.textContent(), label);
    assert.equal(await guide().count(), 1);
    f.report.observations.push({ label: 'ordinary-priority', degrees, ordinary: label, reachPx: reach });
    if (label === 'Quadrant') quadrantClick = pixel;
  }
  await f.snapshot('06-quadrant-priority');
  await f.page.mouse.click(...quadrantClick);
  await guide().waitFor({ state: 'hidden' });
  await f.worldClick([7, 12]);
  const prioritized = await f.finishSketch('07-ordinary-placement');
  assert.deepEqual(prioritized.doc.nodes[0].regions[0].map(segment => segment.start),
    [[3, 8], [7, 8], [7, 12], [3, 12]]);
  assert.deepEqual(f.report.downloads, []);
});
