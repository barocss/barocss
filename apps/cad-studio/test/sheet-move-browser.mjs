import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFlow, sha256 } from './flow-helper.mjs';
import { qualifyMovedFlange } from './sheet-move-flange.mjs';
import { qualifySheetRotation } from './sheet-rotate-flow.mjs';
import { qualifyMirrorBoundary } from './sheet-mirror-study.mjs';
import { qualifySheetDuplicate } from './sheet-copy-flow.mjs';

const mode = process.argv[3], mirrorReplacement = mode === '--mirror-replacement', duplicate = mode === '--duplicate';
const mirrorStudy = mode === '--mirror-study' || mirrorReplacement;
const baseline = mode === '--baseline', flange = mode === '--flange';
const rotateBaseline = mode === '--rotate-baseline', rotateFlange = mode === '--rotate-flange';
const rotate = rotateBaseline || rotateFlange || mode === '--rotate';
const fixture = 'packages/barocss-cad-model/test/fixtures/sheet-l-bracket.calls.json';
const canonical = 'packages/barocss-cad/conformance/r12/accept-l-bracket.json';
const repo = new URL('../../../', import.meta.url);
const pins = [
  'apps/cad-studio/test/sheet-move-browser.mjs',
  'apps/cad-studio/src/ui/FlatPatternDialog.tsx',
  'apps/cad-studio/src/ui/SelectionInspector.tsx',
  'packages/barocss-cad/src/part/part-transform.ts',
  'packages/barocss-cad/src/part/part-model.ts',
  fixture, canonical,
  ...(flange || rotateFlange ? ['apps/cad-studio/test/sheet-move-flange.mjs'] : []),
  ...(rotate ? ['apps/cad-studio/test/sheet-rotate-flow.mjs'] : []),
  ...(mirrorStudy ? ['apps/cad-studio/test/sheet-mirror-study.mjs'] : []),
  ...(duplicate ? ['apps/cad-studio/test/sheet-copy-flow.mjs'] : []),
];
const f = await createFlow({
  name: duplicate ? 'sheet-duplicate' : mirrorStudy ? 'sheet-mirror-boundary' : rotate ? 'sheet-rotate' : 'sheet-move', output: process.argv[2],
  envFrozen: duplicate ? 'D818_SOURCE_FROZEN' : mirrorReplacement ? 'D817_SOURCE_FROZEN' : mirrorStudy ? 'D816_SOURCE_FROZEN' : rotateFlange ? 'D815_SOURCE_FROZEN' : rotate ? 'D814_SOURCE_FROZEN' : flange ? 'D813_SOURCE_FROZEN' : 'D812_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: duplicate ? 'Duplicate a sheet and verify the copy-only thickness edit and both flats.' :
    mirrorReplacement ? 'Apply and reopen the single reflected sheet and verify legacy Mirror.' :
    mirrorStudy ? 'Compare the legacy Studio Mirror and a native single-body reflection with an asymmetric hole.' :
    rotateFlange ? 'Pick and apply a flange on the reopened rotated L-bracket, save, and edit the sheet source.' :
    rotate ? 'Rotate the D546 L-bracket about X and verify folded and aligned flat geometry.' :
    flange ? 'Pick and apply a flange on the reopened translated L-bracket, save, and edit the sheet source.' :
    'Move the D546 L-bracket and check the existing folded and flat-pattern consumers.',
  limits: [duplicate ? 'One D546 sheet, one disjoint Duplicate offset 60 mm, and a copy-only thickness edit.' :
    mirrorStudy ? 'One asymmetric L-bracket, YZ at the origin, and the current legacy Mirror plus a native control.' :
    rotate ? 'One single-body L-bracket with two through holes, explicit K, and Rotate 30° about X at the origin.' :
    'One single-body L-bracket with two through holes, explicit K, and Move by (7, -3, 11) mm.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispatchTool } from '@barocss/cad-model/chat/tools';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, flatPattern, flatPatternOf, massPropertiesOf } from '@barocss/cad';
const args = JSON.parse(process.argv[3]);
if (args.fixture) {
  const { calls } = JSON.parse(readFileSync(args.fixture, 'utf8'));
  const canonical = JSON.parse(readFileSync(args.canonical, 'utf8'));
  let state = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() };
  for (const [index, call] of calls.entries()) {
    const result = await dispatchTool(state, call.tool, call.args, async doc => evaluatePart(doc, index + 1));
    assert.equal(result.isError, false, result.content);
    state = result.state;
  }
  assert.deepEqual(toPartDocument(state.doc), canonical.input.partDocument);
  console.log(JSON.stringify(state.doc));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const part = toPartDocument(doc);
  const last = part.features.at(-1);
  if (args.reflectOnly) {
    assert.equal(last.kind, 'mirror');
    assert.equal(last.keep, true);
    part.features = [...part.features.slice(0, -1), { ...last, keep: false }];
  }
  const outputs = evaluateCadPart(part).outputs;
  function readOutput(output) {
    let flat = null, flatError = null;
    try { flat = flatPatternOf(output); }
    catch (error) { flatError = { code: error.code, message: error.message }; }
    const fixedFace = args.mirror ? output.brep.faces.find(face => face.name === 'n0.leg0.a') : undefined;
    const manualFlat = args.reflectOnly ? flatPattern(output.brep, {
      thickness: 1.5, kFactor: 0.44, fixedFace: 'n0.leg0.a',
      bendNames: [{ name: 'n0.bend1', faces: ['n0.bend1.inner', 'n0.bend1.outer'] }],
    }) : undefined;
    return {
      ...(args.mirror ? { feature: part.features.at(-1), fixedFace: fixedFace && faceGeometry(fixedFace), manualFlat } : {}),
      id: output.id, valid: checkOutput(output).valid, bodyCount: output.bodyCount,
      points: output.brep.vertices.map(vertex => vertex.point),
      faces: output.brep.faces.map(face => face.name), edges: output.brep.edges.map(edge => edge.name), sheet: output.sheet ?? null,
      mass: massPropertiesOf(output), flat, flatError,
    };
  }
  if (args.multiple) console.log(JSON.stringify(outputs.map(readOutput)));
  else {
    assert.equal(outputs.length, 1);
    console.log(JSON.stringify(readOutput(outputs[0])));
  }
}
`,
});
const offset = [7, -3, 11];
const thickness = 1.5, bendRadius = 1.5, width = 30, kFactor = 0.44, holeRadius = 2.75;
const outerRadius = bendRadius + thickness;
const horizontalVolume = width * thickness * (40 - outerRadius);
const verticalVolume = width * thickness * (30 - outerRadius);
const bendVolume = width * Math.PI * (outerRadius ** 2 - bendRadius ** 2) / 4;
const holeVolume = Math.PI * holeRadius ** 2 * thickness;
const bendCenter = outerRadius - 4 * (outerRadius ** 3 - bendRadius ** 3) / (3 * Math.PI * (outerRadius ** 2 - bendRadius ** 2));
const volume = horizontalVolume + verticalVolume + bendVolume - 2 * holeVolume;
const centroid = [
  (horizontalVolume * (40 + outerRadius) / 2 + verticalVolume * thickness / 2 + bendVolume * bendCenter -
    holeVolume * (25 + thickness / 2)) / volume,
  width / 2,
  (horizontalVolume * thickness / 2 + verticalVolume * (30 + outerRadius) / 2 + bendVolume * bendCenter -
    holeVolume * (20 + thickness / 2)) / volume,
];
const allowance = Math.PI / 2 * (bendRadius + kFactor * thickness);
const length = 70 - 2 * outerRadius + allowance;
const area = width * length - 2 * Math.PI * holeRadius ** 2;
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const flatDialog = () => f.page.getByRole('dialog', { name: 'Flat pattern', exact: true });
const flatButton = () => button(f.page, 'Show the flat pattern');
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = (duplicate ? 'D818 sheet duplicate ' : mirrorReplacement ? 'D817 reflected sheet ' : mirrorStudy ? 'D816 sheet Mirror ' : rotate ? 'D814 rotated sheet ' : 'D812 moved sheet ') + randomUUID();
const name = duplicate ? 'D818-sheet.bcad' : mirrorReplacement ? 'D817-sheet.bcad' : mirrorStudy ? 'D816-sheet.bcad' : rotate ? 'D814-sheet.bcad' : 'D812-sheet.bcad';
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b} (tolerance ${tolerance})`);
function vectorNear(a, b, tolerance) {
  assert.equal(a.length, b.length);
  a.forEach((value, index) => near(value, b[index], tolerance));
}
function checkFlat(native, expectedOrigin) {
  const { sheet, flat, flatError } = native;
  assert.ok(sheet && flat, JSON.stringify(flatError));
  assert.equal(sheet.thickness, thickness);
  assert.equal(sheet.kFactor, kFactor);
  assert.equal(sheet.bendRadius, bendRadius);
  assert.equal(sheet.bends.length, 1);
  const bend = sheet.bends[0];
  assert.ok([sheet.fixedFace, bend.inner, bend.outer].every(name => native.faces.filter(face => face === name).length === 1));
  vectorNear(bend.axis.origin, expectedOrigin);
  vectorNear(bend.axis.direction, [0, -1, 0]);
  near(bend.allowance, allowance);
  assert.equal(flat.fixedFace, sheet.fixedFace);
  assert.equal(flat.loops.length, 3);
  assert.equal(flat.bends.length, 1);
  assert.equal(flat.bends[0].direction, 'down');
  near(flat.bends[0].angle, 90);
  near(flat.area, area, 1e-12 * area);
  const flatTolerance = 1e-12 * length;
  vectorNear(flat.box.min, [0, 0], flatTolerance);
  vectorNear(flat.box.max, [width, length], flatTolerance);
  const holes = flat.loops.filter(loop => !loop.outer).map(loop => {
    assert.equal(loop.segments.length, 1);
    const [arc] = loop.segments;
    assert.equal(arc.kind, 'arc');
    near(arc.radius, holeRadius, flatTolerance);
    vectorNear(arc.start, arc.end, flatTolerance);
    return arc.center;
  }).sort((a, b) => a[1] - b[1]);
  assert.equal(holes.length, 2);
  vectorNear(holes[0], [width / 2, 10], flatTolerance);
  vectorNear(holes[1], [width / 2, length - 15], flatTolerance);
  const [flatBend] = flat.bends;
  assert.equal(flatBend.name, bend.name);
  for (const point of flatBend.centre) near(point[1], 27 + allowance / 2, flatTolerance);
  for (const point of flatBend.tangents[0]) near(point[1], 27, flatTolerance);
  for (const point of flatBend.tangents[1]) near(point[1], 27 + allowance, flatTolerance);
}
async function checkMass(label, doc, expectedCenter, id) {
  const native = await f.inspect(label, doc, {});
  assert.equal(native.id, id);
  assert.equal(native.valid, true);
  assert.equal(native.bodyCount, 1);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.equal(bodies.length, 1);
  for (const result of [native.mass, bodies[0]]) {
    near(result.volume, volume, 1e-9 * volume);
    vectorNear(result.centroid, expectedCenter);
  }
  f.report.observations.push({
    label, id, volume: native.mass.volume, centroid: native.mass.centroid,
    sheet: native.sheet, flat: native.flat && { area: native.flat.area, box: native.flat.box, bends: native.flat.bends, loopCount: native.flat.loops.length },
    flatError: native.flatError,
  });
  return native;
}
async function selectBody() {
  const row = f.page.locator('.outliner .ol-row > button.ol');
  assert.equal(await row.count(), 1);
  await row.click();
}
async function showFlat(label) {
  await flatButton().click();
  await flatDialog().waitFor();
  await flatDialog().locator('svg[aria-label]').waitFor();
  await f.snapshot(label);
  await button(flatDialog(), 'Close the flat pattern').click();
  await flatDialog().waitFor({ state: 'hidden' });
}

async function projectRoundTrip(expected) {
  async function openProject() {
    if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
    if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await button(versions(), 'Project in this browser').click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  }
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const saved = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(saved), expected);
  await button(versions(), 'Close project').click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(expected);
  return saved;
}

await f.run(async () => {
  f.phase = 'materialize the pinned D546 source and open its flat pattern';
  const seed = await f.inspect('materialize-sheet', {}, {
    fixture: fileURLToPath(new URL(fixture, repo)), canonical: fileURLToPath(new URL(canonical, repo)),
  });
  const bytes = Buffer.from(JSON.stringify(seed));
  assert.equal(sha256(bytes), 'e399b53950bf73dd5eb3e148013c6190169187dd5918e84194c8bacac44c01ab');
  if (mirrorStudy) {
    await qualifyMirrorBoundary(f, seed, { name, selectBody, showFlat, projectRoundTrip, replacement: mirrorReplacement });
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await f.same(seed);
  const original = await checkMass('original-native', seed, centroid, 'n6');
  checkFlat(original, [3, 30, 3]);
  await selectBody();
  await showFlat('01-original-flat');
  if (duplicate) {
    await qualifySheetDuplicate(f, seed, { showFlat, projectRoundTrip });
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  if (rotate) {
    const result = await qualifySheetRotation(f, seed, original, { selectBody, showFlat, projectRoundTrip, baseline: rotateBaseline });
    if (rotateFlange) await qualifyMovedFlange(f, result.doc, result.native, { selectBody, showFlat, projectRoundTrip, rotated: true });
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'move the bracket and read the resulting folded shape and flat support';
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('g');
  const move = f.page.getByRole('dialog', { name: 'Move', exact: true });
  for (const [index, axis] of [...'XYZ'].entries()) await move.getByLabel(`Δ${axis}`, { exact: true }).fill(String(offset[index]));
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button(move, 'Apply').click();
  await move.waitFor({ state: 'hidden' });
  await f.changed(seed);
  const moved = await f.doc();
  assert.deepEqual(moved.nodes.at(-1), { kind: 'translate', parent: { node: 6, side: 'solid' }, offset, id: 'n7' });
  const result = await checkMass('moved-native', moved, centroid.map((value, index) => value + offset[index]), 'n7');
  assert.equal(result.points.length, original.points.length);
  result.points.forEach((point, index) => vectorNear(point, original.points[index].map((value, axis) => value + offset[axis])));
  assert.deepEqual(result.faces, original.faces);
  await selectBody();
  if (baseline) {
    assert.equal(result.sheet, null);
    assert.equal(result.flatError.code, 'CAPABILITY');
    assert.match(result.flatError.message, /not made as sheet metal/);
    assert.equal(await flatButton().count(), 0);
    await f.snapshot('02-moved-without-flat');
  } else {
    checkFlat(result, [10, 27, 14]);
    await showFlat('02-moved-flat');
    await f.undo();
    await f.same(seed);
    await selectBody();
    await showFlat('03-undo-flat');
    await f.redo();
    await f.same(moved);
    await selectBody();
    await showFlat('04-redo-flat');

    f.phase = 'save and freshly reopen the moved bracket with its flat pattern';
    const saved = await projectRoundTrip(moved);
    const reopened = await checkMass('reopened-native', moved, centroid.map((value, index) => value + offset[index]), 'n7');
    checkFlat(reopened, [10, 27, 14]);
    await selectBody();
    await showFlat('05-reopened-flat');
    f.report.observations.push({ label: 'project-readback', bytes: saved.length, sha256: sha256(saved) });
    if (flange) await qualifyMovedFlange(f, moved, reopened, { selectBody, showFlat, projectRoundTrip });
  }
  assert.deepEqual(f.report.downloads, []);
});
