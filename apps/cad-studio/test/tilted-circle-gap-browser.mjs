import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/tilted-circle-gap-browser.mjs',
  'apps/cad-studio/src/sketch/pathGap.ts',
  'apps/cad-studio/src/sketch/usePathGap.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/plane.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts',
];
const f = await createFlow({
  name: 'tilted-circle-gap', output: process.argv[2], envFrozen: 'D824_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Keep a neighboring driving dimension and native wall identity when cutting a path-length gap on a tilted sketch plane.',
  limits: ['One identified construction circle, one separate dimensioned rectangle and an authored translated +30° XY plane.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, coedgeVertices, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
const { brep } = body;
const wall = brep.faces.find(face => face.name === 'n1.side[e1]');
const loop = brep.loops.find(loop => loop.face === wall?.id && loop.kind === 'outer');
if (!loop) throw new Error('The original e1 wall is absent');
const wallCorners = loop.coedges.map(id => {
  const coedge = brep.coedges.find(edge => edge.id === id);
  const [start] = coedgeVertices(brep, coedge);
  return brep.vertices.find(vertex => vertex.id === start).point;
});
console.log(JSON.stringify({ valid: checkOutput(body).valid, count: body.bodyCount, ...massPropertiesOf(body),
  corners: brep.vertices.map(vertex => vertex.point), wall: wall.name, wallCorners }));
`,
});
const cos = Math.sqrt(3) / 2;
const plane = { origin: [0, 3.5, 7 * cos], normal: [0, 0.5, cos], xAxis: [1, 0, 0] };
const outline = { points: [[36, 36], [44, 36], [44, 42], [36, 42]], lengths: { 0: 8 }, hv: { h: [0, 2], v: [1, 3] } };
const stock = { kind: 'sketch', profile: 'rectangle', min: [36, 36], max: [44, 42], outline, sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, plane, id: 'n0' };
const circle = { kind: 'circle', c: [20, 20], r: 10, construction: true, ids: ['e5'] };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ ...stock, construction: [circle] }], outputs: {}, nextId: 1 };
const project = 'D824 tilted gap ' + randomUUID(), name = 'D824-tilted-gap.bcad';
const pick = [20, 30];
const cutEnds = [[20 + 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)], [20 - 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)]];
const world = ([u, v], depth = 0) => [u, 3.5 + cos * v + depth / 2, 7 * cos - v / 2 + cos * depth];
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const field = (parent, name) => parent.getByLabel(name, { exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const preview = () => f.page.locator('.vp-overlay .sk-path-gap');
const screen = uv => f.page.evaluate(point => window.__studioScreenOf(point), world(uv));
const onCanvas = pixel => f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel);

async function frameSketch() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const pixels = await Promise.all([pick, ...outline.points].map(screen));
    if ((await Promise.all(pixels.map(onCanvas))).every(Boolean)) return;
    const box = await f.page.locator('canvas.vp-canvas').boundingBox();
    assert.ok(box);
    await f.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await f.page.mouse.wheel(0, 400);
    await f.page.waitForTimeout(300);
  }
  assert.fail('The tilted sketch did not fit on the canvas.');
}

async function editSketch(consumed = false) {
  f.phase = 'open the tilted sketch editor';
  if (consumed) await f.openFeatureEditor(1, 'extrusion of the tilted rectangle');
  else await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  const dimension = field(f.sketchPanel(), 'Edge 1 length');
  assert.equal(Number(await dimension.inputValue()), 8);
  assert.match(await dimension.getAttribute('class'), /\blocked\b/);
}

async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await field(versions(), 'Project').isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await field(versions(), 'Project').waitFor();
}

function matchPoints(actual, expected) {
  assert.equal(actual.length, expected.length);
  const remaining = [...expected];
  for (const point of actual) {
    const index = remaining.findIndex(candidate => distance(candidate, point) < 1e-8);
    assert.ok(index >= 0, JSON.stringify(point));
    remaining.splice(index, 1);
  }
}

async function checkExtrusion(label, doc) {
  const body = await f.inspect(label, doc);
  assert.ok(body.valid);
  assert.equal(body.count, 1);
  const expected = world([40, 39], 1);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b1']);
  for (const result of [body, bodies[0]]) {
    assert.ok(Math.abs(result.volume - 96) < 1e-8);
    assert.ok(distance(result.centroid, expected) < 1e-8, JSON.stringify(result));
  }
  matchPoints(body.corners, [0, 2].flatMap(depth => outline.points.map(uv => world(uv, depth))));
  matchPoints(body.wallCorners, [0, 2].flatMap(depth => outline.points.slice(0, 2).map(uv => world(uv, depth))));
  f.report.observations.push({ label, wall: body.wall, volume: body.volume, centroid: body.centroid, corners: body.corners.length });
}

await f.run(async () => {
  f.phase = 'open and edit the identified tilted sketch';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(initial)) });
  await f.same(initial);
  await editSketch();
  f.phase = 'frame and cut on the tilted sketch plane';
  await frameSketch();
  await f.tool('Trim', 't');
  const panel = f.sketchPanel();
  const length = field(panel, 'Gap length');
  await button(panel, 'Cut circle gap').click();
  await length.fill('4');
  const pixel = await screen(pick);
  assert.ok(await onCanvas(pixel), pixel);
  await f.page.mouse.move(...pixel);
  await preview().waitFor();
  const marks = await f.page.locator('.vp-overlay .sk-path-gap-end').evaluateAll(elements => elements.map(element => {
    const point = new DOMPoint(element.cx.baseVal.value, element.cy.baseVal.value).matrixTransform(element.getScreenCTM());
    return [point.x, point.y];
  }));
  assert.equal(marks.length, 2);
  for (const [index, end] of cutEnds.entries()) assert.ok(distance(await screen(end), marks[index]) < 1);
  await f.snapshot('01-tilted-preview');
  await f.page.mouse.click(...pixel);
  await length.waitFor({ state: 'hidden' });

  const { doc: cut } = await f.finishSketch('02-kept-outline');
  const { construction, ...unchanged } = cut.nodes[0];
  assert.deepEqual(unchanged, stock);
  assert.equal(construction.length, 1);
  const [arc] = construction;
  assert.equal(arc.kind, 'polygon');
  assert.ok(arc.construction && !arc.closed && !arc.pending);
  assert.deepEqual(arc.ids, ['e7', 'e6']);
  assert.equal(arc.points.length, 2);
  assert.ok(arc.bulges[0] > 1);
  const chord = distance(world(arc.points[0]), world(arc.points[1]));
  const sweep = 4 * Math.atan(arc.bulges[0]);
  const gap = 20 * Math.asin(chord / 20);
  const retained = chord * sweep / (2 * Math.sin(sweep / 2));
  assert.ok(Math.abs(gap - 4) < 1e-5, gap);
  assert.ok(Math.abs(retained - (20 * Math.PI - 4)) < 1e-5, retained);
  f.report.observations.push({ label: 'tilted-gap', gap, retained, chord, ids: arc.ids, outlineLength: outline.lengths[0], plane });
  await f.undo();
  await f.same(initial);
  await f.redo();
  await f.same(cut);

  await f.openExtrudeHud();
  const { doc: extruded } = await f.applyExtrude({ distance: 2, previous: cut, label: '03-tilted-extrusion' });
  await checkExtrusion('original-e1-wall', extruded);
  f.phase = 'save and reopen the tilted sketch and extrusion';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await field(f.page, 'Unsaved changes').waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), extruded);
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(extruded);
  await checkExtrusion('reopened-e1-wall', extruded);
  await editSketch(true);
  await f.snapshot('04-reopened-edge-lock');
  f.report.observations.push({ label: 'tilted-project-readback', bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
