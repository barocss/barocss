import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const mode = process.argv[3], fixed = mode === '--fixed';
const mirrored = mode === '--mirrored' || mode === '--mirrored-baseline' || mode === '--mirrored-source-edit';
const mirroredBaseline = mode === '--mirrored-baseline';
const measureArea = mode === '--measure-area';
const sourceMeasure = mode === '--source-measure' || measureArea;
const sourceEdit = mode === '--source-edit' || mode === '--source-edit-baseline' || mode === '--mirrored-source-edit' || sourceMeasure;
const sourceEditBaseline = mode === '--source-edit-baseline';
const pins = [
  'apps/cad-studio/test/line-arc-round-browser.mjs',
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/app/sketchControls.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'packages/barocss-cad-model/src/sketch/corner.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
  'packages/barocss-cad-model/src/sketch/entityIds.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
  ...(fixed || mirrored || sourceEdit ? ['packages/barocss-cad-model/src/sketch/internal/pinnedLineArcRound.ts'] : []),
  ...(sourceMeasure ? ['apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
    'apps/cad-studio/src/ui/MeasurementInspector.tsx', 'packages/barocss-cad-model/src/app/measure.ts',
    'packages/barocss-cad-model/src/engine/mesh.ts'] : []),
  ...(measureArea ? ['packages/barocss-cad-model/src/engine/nativeCylinderArea.ts'] : []),
];
const f = await createFlow({
  name: 'line-arc-round', output: process.argv[2],
  envFrozen: measureArea ? 'D894_SOURCE_FROZEN' : sourceMeasure ? 'D893_SOURCE_FROZEN'
    : sourceEdit ? 'D892_SOURCE_FROZEN' : mirrored ? 'D891_SOURCE_FROZEN' : 'D890_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: measureArea ? 'Verify analytic native wall area and the display-mesh fallback in Measure.'
    : sourceMeasure ? 'Measure the two named cylindrical faces of a pinned round across source-radius changes.'
    : sourceEdit ? 'Edit the source radius of a pinned round and verify native contacts and history.'
    : mirrored ? 'Verify a clockwise pinned line–arc Round and its native XZ extrusion.'
    : fixed ? 'Round a pinned finite line–circular-arc corner and verify its native producer.'
    : 'Measure the finite line–circular-arc Round boundary and the existing straight-corner control.',
  limits: [mirrored ? 'One reflected convex XZ outline with a native R20 arc and a 10 mm Extrude.'
    : 'One convex closed XY outline with one native R20 quarter arc and a 10 mm Extrude. The admitted fixture pins both carriers.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { cylinderPart, emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { partSnapshot } from '@barocss/cad-model/engine/part';
import { profileOf } from '../../packages/barocss-cad-model/src/sketch/loops.ts';
if (process.argv[3] === '"cylinder"') {
  console.log(JSON.stringify(cylinderPart(5, 10)));
  process.exit(0);
}
if (['"fixture"', '"pinned"', '"mirrored"'].includes(process.argv[3])) {
  const reflected = process.argv[3] === '"mirrored"', pinned = process.argv[3] !== '"fixture"';
  const points = reflected ? [[0,20],[40,20],[20,0],[0,0]] : [[0,pinned ? 20 : 0],[40,20],[20,40],[0,40]];
  const profile = profileOf([{
    kind: 'polygon', closed: true, points,
    bulges: [0, (reflected ? -1 : 1) * (Math.SQRT2 - 1), 0, 0], radii: {1:20}, tangents:[2], hv:{h:pinned ? [0,2] : [2],v:[3]}, ids: ['e1','e2','e3','e4'],
    ...(pinned ? { rules: [{ kind:'fix', point:2, at:points[2] }] } : {}),
  }]);
  assert.ok('node' in profile);
  const plane = { origin:[0,5,0],normal:[0,-1,0],xAxis:[1,0,0] };
  const sketch = reflected ? { ...profile.node, plane } : profile.node;
  console.log(JSON.stringify(withNode(withNode(emptyDoc(), sketch), {kind:'extrude',sketch:0,height:10})));
  process.exit(0);
}
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [output] = partSnapshot(doc).outputs;
assert.ok(output && checkBrep(output.brep, { strict:true }).valid);
assert.ok(output.brep.shells.every(shell => shell.closed));
const cylinders = output.brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'cylinder' ? [{ name: face.name, ...g }] : [];
});
const displayFaces = process.argv[3] === '"measure"'
  ? bodyMesh(output.brep, 0).faces.map(({ index, name, area, nativeArea }) => ({ index, name, area, nativeArea })) : undefined;
console.log(JSON.stringify({ volume: massPropertiesOf(output).volume, faces: output.brep.faces.map(face => face.name), cylinders,
  vertices: output.brep.vertices.map(vertex => vertex.point), displayFaces }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    roundError: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null,
    outlineInputs: Array.from(document.querySelectorAll('[aria-label="Outline points"] input'), input => ({
      label: input.getAttribute('aria-label'), value: input.value,
    })),
  }),
});

const file = 'D890-line-arc-round.bcad';
const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const outlinePoints = [[0, 0], [40, 20], [20, 40], [0, 40]];
const workingPlane = { origin: [0, 5, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const reflect = ([x, y]) => [x, 40 - y];
const toWorld = ([x, y]) => [x, 5, y];

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function edit(node = 1) {
  await f.openFeatureEditor(node);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Select', 's');
  if (!mirrored) await f.frame(outlinePoints);
}

async function applyRound(corner, radius) {
  if (mirrored) {
    const hit = await f.page.evaluate(point => {
      const pixel = window.__studioScreenOf(point);
      return pixel && document.elementFromPoint(...pixel)?.closest('canvas.vp-canvas') ? pixel : null;
    }, toWorld(corner));
    assert.ok(hit, JSON.stringify(corner));
    await f.page.mouse.click(...hit);
  } else await f.worldClick(corner);
  await setRoundRadius(radius);
}

async function setRoundRadius(radius) {
  const panel = f.sketchPanel().getByRole('group', { name: 'Round the corner', exact: true });
  await panel.getByLabel('Corner radius', { exact: true }).fill(String(radius));
  await button(panel, 'Round the corner').click();
}

async function cancel() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Escape');
  if (await f.sketchPanel().isVisible()) await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
}

async function save(doc) {
  const project = 'D890 finite Round';
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(name)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

function independentRound(radius, sourceRadius = 20) {
  const source = [20, 40 - sourceRadius];
  const y = 20 + radius - source[1], inner = sourceRadius - radius;
  const x = Math.sqrt(inner ** 2 - y ** 2);
  const fillet = [20 + x, 20 + radius];
  const a = [fillet[0], 20], b = [20 + sourceRadius * x / inner, source[1] + sourceRadius * y / inner];
  const angle = Math.atan2(y, x);
  const polygon = [[0, 20], a, b, [20, 40], [0, 40]];
  const cross = ([ax, ay], [bx, by]) => ax * by - ay * bx;
  const chordArea = polygon.reduce((sum, point, i) => sum + cross(point, polygon[(i + 1) % polygon.length]), 0) / 2;
  const arcArea = (r, sweep) => r * r * (sweep - Math.sin(sweep)) / 2;
  return { fillet, source, polygon,
    volume: 10 * (chordArea + arcArea(radius, Math.PI / 2 + angle) + arcArea(sourceRadius, Math.PI / 2 - angle)) };
}

async function checkRound(label, doc, original, radius, sourceRadius = 20) {
  const expected = independentRound(radius, sourceRadius);
  const sketch = doc.nodes[0];
  const local = mirrored ? reflect : point => point;
  assert.deepEqual(doc.nodes.slice(1), original.nodes.slice(1));
  assert.deepEqual(doc.outputs, original.outputs);
  assert.deepEqual(sketch.sideTags.outer, ['e1', 'e5', 'e2', 'e3', 'e4']);
  assert.deepEqual(sketch.outline.radii, { 1: radius, 2: sourceRadius });
  assert.deepEqual(sketch.outline.tangents, [1, 2, 3]);
  assert.deepEqual(sketch.outline.hv, { h: [0, 3], v: [4] });
  assert.deepEqual(sketch.outline.rules, [{ kind: 'fix', point: 3, at: local([20, 40]) }]);
  const point = (actual, wanted) => wanted.forEach((value, i) => near(actual[i], value));
  assert.equal(sketch.segments.length, 5);
  sketch.segments.forEach((segment, i) => point(segment.start, local(expected.polygon[i])));
  const native = await f.inspect(label, doc, ...(sourceMeasure ? ['measure'] : []));
  assert.equal(native.cylinders.length, 2);
  for (const [i, tag, center, r] of [[1, 'e5', expected.fillet, radius], [2, 'e2', expected.source, sourceRadius]]) {
    assert.equal(sketch.segments[i].kind, 'arc');
    assert.equal(sketch.segments[i].direction, mirrored ? 'cw' : 'ccw');
    point(sketch.segments[i].center, local(center));
    const cylinder = native.cylinders.find(face => face.name === `n1.side[${tag}]`);
    assert.ok(cylinder);
    if (mirrored) {
      near(cylinder.c[0], center[0]);
      near(cylinder.c[2], local(center)[1]);
    } else point(cylinder.c, center);
    near(cylinder.r, r);
    point(cylinder.a, mirrored ? [0, 1, 0] : [0, 0, 1]);
  }
  if (mirrored) assert.deepEqual(sketch.plane, workingPlane);
  if (mirrored || sourceEdit) {
    for (const [x, y] of expected.polygon.map(local)) {
      for (const depth of [0, 10]) {
        const expectedVertex = mirrored ? [x, 5 - depth, y] : [x, y, depth];
        assert.ok(native.vertices.some(vertex => Math.hypot(...vertex.map((value, i) => value - expectedVertex[i])) < 1e-8),
          `Missing cap vertex ${expectedVertex}`);
      }
    }
  }
  assert.ok(['e1', 'e3', 'e4'].every(tag => native.faces.includes(`n1.side[${tag}]`)));
  near(native.volume, expected.volume, 1e-7);
  near((await f.bodies()).bodies[0].volume, expected.volume, 1e-7);
  f.report.observations.push({ label, radiusMm: radius, sourceRadiusMm: sourceRadius, expectedVolumeMm3: expected.volume, volumeMm3: native.volume,
    sideTags: sketch.sideTags.outer, nativeCylinders: native.cylinders, lineContactMm: local(expected.polygon[1]), sourceContactMm: local(expected.polygon[2]) });
  return native;
}

async function frameMeasure() {
  const view = f.page.getByRole('group', { name: 'Views', exact: true });
  await button(view, 'Right').click();
  await f.page.locator('.views button[title="Frame all (F)"]').click();
  const filter = button(f.page, 'Selection filter');
  for (let attempt = 0; attempt < 4 && !(await filter.innerText()).trim().endsWith('Faces'); attempt++) await filter.click();
  assert.match((await filter.innerText()).trim(), /Faces$/);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function measureWall(label, doc, face, world, radius, nativeArea) {
  f.phase = `${label}: select and measure ${face.name}`;
  const pixel = await f.page.evaluate(point => {
    const at = window.__studioScreenOf(point);
    return at && document.elementFromPoint(...at)?.closest('canvas.vp-canvas') ? at : null;
  }, world);
  assert.ok(pixel, JSON.stringify(world));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(index => {
    const faces = window.__studioSelection?.selection.faces;
    return faces?.length === 1 && faces[0].body === 0 && faces[0].face === index;
  }, face.index, { timeout: 5000 });
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  const panel = f.page.getByLabel('Measurement', { exact: true });
  const item = panel.locator('.measure-item');
  await item.getByText('Curved face', { exact: true }).waitFor();
  const metric = label => item.locator('.kv').filter({ hasText: new RegExp(`^${label}`) }).locator('b');
  assert.equal(await metric('Radius').innerText(), `${radius} mm`);
  const areaText = await metric('Area').innerText();
  if (measureArea) {
    if (nativeArea === undefined) {
      assert.equal(face.nativeArea, undefined);
      assert.match(areaText, /^\d+(?:\.\d+)? mm² \(mesh\)$/);
      near(Number.parseFloat(areaText), face.area, 0.005);
    } else {
      near(face.nativeArea, nativeArea, 1e-8);
      assert.match(areaText, /^\d+(?:\.\d+)? mm²$/);
      near(Number.parseFloat(areaText), nativeArea, 0.005);
    }
  }
  const measurement = await item.innerText();
  await f.same(doc);
  await f.snapshot(label);
  f.report.observations.push({ label, face: face.name, displayIndex: face.index, world, pixel, radiusMm: radius,
    expectedNativeAreaMm2: nativeArea, nativeAreaMm2: face.nativeArea, meshAreaMm2: face.area, areaText, measurement });
  await button(panel, 'Done measuring').click();
  await panel.waitFor({ state: 'hidden' });
}

async function measureRound(label, doc, original, sourceRadius) {
  const native = await checkRound(`${label}-native`, doc, original, 4, sourceRadius);
  const expected = independentRound(4, sourceRadius);
  const join = expected.polygon[2], c = expected.source;
  const angle = Math.atan2(join[1] - c[1], join[0] - c[0]);
  await frameMeasure();
  for (const [tag, center, radius, start, end] of [
    ['e5', expected.fillet, 4, -Math.PI / 2, angle],
    ['e2', c, sourceRadius, angle, Math.PI / 2],
  ]) {
    const name = `n1.side[${tag}]`;
    const face = native.displayFaces.find(face => face.name === name);
    assert.ok(face, name);
    const midpoint = (start + end) / 2;
    const world = [center[0] + radius * Math.cos(midpoint), center[1] + radius * Math.sin(midpoint), 5];
    await measureWall(`${label}-measure-${tag}`, doc, face, world, radius, 10 * radius * (end - start));
  }
}

async function checkAreaFallback() {
  const doc = await f.inspect('merged-cylinder-fixture', {}, 'cylinder');
  const native = await f.inspect('merged-cylinder-native', doc, 'measure');
  near(native.volume, 250 * Math.PI, 1e-7);
  assert.ok(native.cylinders.length > 1, 'The fixture must have several native cylinder members.');
  const names = new Set(native.cylinders.map(face => face.name.replace(/#\d+$/, '')));
  assert.equal(names.size, 1);
  const face = native.displayFaces.find(face => names.has(face.name));
  assert.ok(face);
  await open(doc);
  await frameMeasure();
  await measureWall('merged-wall-mesh-area', doc, face, [Math.sqrt(24), 1, 5], 5);
}

async function checkSourceEdit() {
  const doc = await f.inspect('source-radius-fixture', {}, mirrored ? 'mirrored' : 'pinned');
  const panel = () => f.sketchPanel();
  const radius = () => panel().getByLabel('Arc 3 radius', { exact: true });
  const alert = () => panel().getByRole('alert');
  async function enterInline(value, reference = false) {
    const chip = reference
      ? f.page.locator('g.dim:not(.driving) .dim-text').getByText('R16', { exact: true })
      : f.page.locator('g.dim[data-dim="rad2"] .dim-text');
    await chip.dblclick();
    const input = f.page.locator('.dim-editor input');
    await input.fill(String(value));
    await input.press('Enter');
    await input.waitFor({ state: 'hidden' });
  }
  await f.newPage();
  await open(doc);
  await edit();
  await applyRound([40, 20], 4);
  const r20 = (await f.finishSketch('01-pinned-fillet-source-R20')).doc;
  if (sourceMeasure) await measureRound('source-R20', r20, doc, 20);
  else await checkRound('source-R20-native', r20, doc, 4);

  f.phase = 'edit the retained source radius using the outline panel';
  await edit();
  await radius().fill('16');
  if (sourceEditBaseline && await alert().count()) {
    const refused = await f.snapshot('02-parent-source-R16-refused');
    await f.same(r20);
    assert.equal(await radius().inputValue(), '20');
    f.report.observations.push({ label: 'source-edit-baseline', outcome: 'REFUSED', refusal: refused.roundError });
    await cancel();
    await f.same(r20);
    return;
  }
  assert.equal(await radius().inputValue(), '16');
  await radius().press('Enter');
  assert.equal(await alert().count(), 0);
  await panel().getByText(/^Fully defined/).waitFor();
  const r16 = (await f.finishSketch('02-pinned-fillet-source-R16')).doc;
  if (sourceMeasure) {
    await measureRound('source-R16', r16, doc, 16);
    await f.undo();
    await f.same(r20);
    await f.redo();
    await f.same(r16);
    const saved = await save(r16);
    await f.newPage();
    await open(r16, saved);
    await measureRound('reopened-source-R16', r16, doc, 16);
    await edit();
    await enterInline(18);
    assert.equal(await radius().inputValue(), '18');
    const r18 = (await f.finishSketch('03-pinned-fillet-source-R18')).doc;
    await measureRound('source-R18', r18, doc, 18);
    if (measureArea) await checkAreaFallback();
    return;
  }
  if (sourceEditBaseline) {
    try {
      await checkRound('source-R16-parent-native', r16, doc, 4, 16);
      f.report.observations.push({ label: 'source-edit-baseline', outcome: 'EXACT' });
    } catch (error) {
      const native = await f.inspect('source-R16-parent-observed', r16);
      f.report.observations.push({ label: 'source-edit-baseline', outcome: 'GEOMETRY_MISMATCH',
        reason: error.message, outline: r16.nodes[0].outline, native });
      return;
    }
  } else {
    await checkRound('source-R16-native', r16, doc, 4, 16);
    await f.undo();
    await f.same(r20);
    await f.redo();
    await f.same(r16);
    const saved = await save(r16);
    await f.newPage();
    await open(r16, saved);
    await checkRound('source-R16-reopened-native', r16, doc, 4, 16);
  }

  f.phase = 'refuse the exact source-radius limit and keep both previous arcs';
  await edit();
  const before = await f.snapshot('03-before-source-limit');
  await radius().fill('10');
  if (sourceEditBaseline && !await alert().count()) {
    const accepted = await f.snapshot('04-parent-source-limit-accepted');
    await f.same(r16);
    assert.equal(await radius().inputValue(), '10');
    f.report.observations.push({ label: 'source-limit-baseline', outcome: 'ACCEPTED_DRAFT', dirty: accepted.dirty });
    await cancel();
    await f.same(r16);
    return;
  }
  await alert().waitFor();
  const refused = await f.snapshot('04-source-limit-refused');
  assert.equal(await radius().inputValue(), '16');
  assert.equal(await panel().getByLabel('Arc 2 radius', { exact: true }).inputValue(), '4');
  assert.deepEqual(refused.doc, before.doc);
  assert.deepEqual(refused.history, before.history);
  assert.deepEqual(refused.outlineInputs, before.outlineInputs);
  assert.equal(refused.dirty, before.dirty);
  if (sourceEditBaseline) {
    f.report.observations.push({ label: 'source-limit-baseline', outcome: 'REFUSED', refusal: refused.roundError });
    await cancel();
    await f.same(r16);
    return;
  }

  await cancel();
  await f.same(r16);
  await edit();
  assert.equal(await alert().count(), 0);
  f.phase = 'refuse the same limit in the on-canvas field, then recover at R18';
  await enterInline(10);
  await alert().waitFor();
  assert.equal(await radius().inputValue(), '16');
  assert.equal(await panel().getByLabel('Arc 2 radius', { exact: true }).inputValue(), '4');
  const inlineRefused = await f.snapshot('05-inline-source-limit-refused');
  assert.deepEqual(inlineRefused.doc, before.doc);
  assert.deepEqual(inlineRefused.history, before.history);
  assert.deepEqual(inlineRefused.outlineInputs, before.outlineInputs);
  assert.equal(inlineRefused.dirty, before.dirty);

  f.phase = 'clear the source lock, then refuse an invalid replacement';
  await radius().fill('');
  assert.equal(await radius().evaluate(field => field.classList.contains('locked')), false);
  assert.equal(await alert().count(), 0);
  const unlocked = await f.snapshot('06-source-unlocked');
  await radius().fill('10');
  await alert().waitFor();
  assert.equal(await radius().evaluate(field => field.classList.contains('locked')), false);
  const relockRefused = await f.snapshot('07-source-limit-relock-refused');
  assert.deepEqual(relockRefused.doc, before.doc);
  assert.deepEqual(relockRefused.history, before.history);
  assert.deepEqual(relockRefused.outlineInputs, unlocked.outlineInputs);
  assert.equal(relockRefused.dirty, before.dirty);

  f.phase = 're-lock the source at R18 in the on-canvas field';
  await enterInline(18, true);
  assert.equal(await radius().inputValue(), '18');
  assert.equal(await radius().evaluate(field => field.classList.contains('locked')), true);
  assert.equal(await alert().count(), 0);
  await panel().getByText(/^Fully defined/).waitFor();
  const r18 = (await f.finishSketch('08-pinned-fillet-source-R18')).doc;
  await checkRound('source-R18-native', r18, doc, 4, 18);
  await f.undo();
  await f.same(r16);
  await f.redo();
  await f.same(r18);
}

async function checkMirrored() {
  const doc = await f.inspect('mirrored-source-fixture', {}, 'mirrored');
  const bytes = Buffer.from(JSON.stringify(doc));
  assert.deepEqual(doc.nodes[0].plane, workingPlane);
  assert.equal(doc.nodes[0].segments[1].direction, 'cw');
  const original = await f.inspect('mirrored-source-native', doc);
  near(original.volume, 10 * (400 + 100 * Math.PI));
  assert.equal(original.cylinders.length, 1);
  near(original.cylinders[0].r, 20);
  f.report.observations.push({ label: 'mirrored-source', bytes: bytes.length, sha256: sha256(bytes), volumeMm3: original.volume, plane: workingPlane });
  await f.newPage();
  await open(doc, bytes);
  await edit();
  f.phase = 'apply the pinned clockwise Round on the XZ plane';
  await applyRound([40, 20], 3);
  if (mirroredBaseline) {
    await f.sketchPanel().getByRole('alert').waitFor();
    await f.same(doc);
    const refused = await f.snapshot('01-clockwise-round-refused');
    f.report.observations.push({ label: 'mirrored-baseline', refusal: refused.roundError });
    await cancel();
    await f.same(doc);
    return;
  }
  await f.sketchPanel().getByLabel('Arc 3 radius', { exact: true }).waitFor();
  assert.equal(await f.sketchPanel().getByRole('alert').count(), 0);
  const r3 = (await f.finishSketch('01-clockwise-R3')).doc;
  await checkRound('clockwise-R3-native', r3, doc, 3);
  const radius = () => f.sketchPanel().getByLabel('Arc 2 radius', { exact: true });
  await edit();
  await radius().fill('4');
  await radius().press('Enter');
  assert.equal(await radius().inputValue(), '4');
  const r4 = (await f.finishSketch('02-clockwise-R4')).doc;
  const nativeR4 = await checkRound('clockwise-R4-native', r4, doc, 4);
  await f.undo();
  await f.same(r3);
  await f.redo();
  await f.same(r4);

  f.phase = 'save and reopen the clockwise branch, then test refusal and a valid edit';
  const saved = await save(r4);
  await f.newPage();
  await open(r4, saved);
  assert.deepEqual(await checkRound('clockwise-R4-reopened-native', r4, doc, 4), nativeR4);
  await edit();
  await radius().fill('10');
  await f.sketchPanel().getByRole('alert').waitFor();
  assert.equal(await radius().inputValue(), '4');
  await f.same(r4);
  await f.snapshot('03-clockwise-exact-limit-refused');
  await radius().fill('5');
  await radius().press('Enter');
  assert.equal(await radius().inputValue(), '5');
  const r5 = (await f.finishSketch('04-clockwise-R5')).doc;
  await checkRound('clockwise-R5-native', r5, doc, 5);
  assert.deepEqual(f.report.downloads, []);
}

async function checkFixed() {
  const doc = await f.inspect('pinned-source-fixture', {}, 'pinned');
  const bytes = Buffer.from(JSON.stringify(doc));
  const native = await f.inspect('pinned-source-native', doc);
  near(native.volume, 10 * (400 + 100 * Math.PI));
  f.report.observations.push({ label: 'pinned-source', bytes: bytes.length, sha256: sha256(bytes), volumeMm3: native.volume });
  await f.newPage();
  await open(doc, bytes);
  await edit();
  f.phase = 'refuse an oversized first radius, then apply the finite R3';
  await applyRound([40, 20], 12);
  await f.sketchPanel().getByRole('alert').waitFor();
  await f.same(doc);
  await f.snapshot('01-oversized-round-refused');
  const round = f.sketchPanel().getByRole('group', { name: 'Round the corner', exact: true });
  await round.getByLabel('Corner radius', { exact: true }).fill('3');
  await button(round, 'Round the corner').focus();
  await f.page.keyboard.down('Enter');
  await round.waitFor({ state: 'hidden' });
  await f.page.keyboard.down('Enter');
  await f.page.keyboard.up('Enter');
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await f.sketchPanel().isVisible(), true, 'Repeated Enter must leave the round in the draft');
  await f.same(doc);
  await f.sketchPanel().getByLabel('Arc 3 radius', { exact: true }).waitFor();
  assert.equal(await f.sketchPanel().getByRole('alert').count(), 0);
  const r3 = (await f.finishSketch('02-native-R3')).doc;
  await checkRound('round-R3-native', r3, doc, 3);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(r3);

  f.phase = 'change the first radius through the ordinary sketch dimension';
  await edit();
  const radius = () => f.sketchPanel().getByLabel('Arc 2 radius', { exact: true });
  await radius().fill('4');
  await radius().press('Enter');
  assert.equal(await radius().inputValue(), '4');
  const r4 = (await f.finishSketch('03-native-R4')).doc;
  const nativeR4 = await checkRound('round-R4-native', r4, doc, 4);
  await f.undo();
  await f.same(r3);
  await f.redo();
  await f.same(r4);

  f.phase = 'save, reopen, refuse the exact degenerate limit, then edit to R5';
  const saved = await save(r4);
  await f.newPage();
  await open(r4, saved);
  assert.deepEqual(await checkRound('round-R4-reopened-native', r4, doc, 4), nativeR4);
  await edit();
  await radius().fill('10');
  await f.sketchPanel().getByRole('alert').waitFor();
  assert.equal(await radius().inputValue(), '4');
  await f.same(r4);
  await f.snapshot('04-oversized-radius-edit-refused');
  await radius().fill('5');
  await radius().press('Enter');
  assert.equal(await radius().inputValue(), '5');
  const r5 = (await f.finishSketch('05-native-R5')).doc;
  await checkRound('round-R5-native', r5, doc, 5);
  await f.undo();
  await f.same(r4);
  await f.redo();
  await f.same(r5);

  f.phase = 'refuse the pinned outline when its stored sketch is attached to a body';
  const attached = {
    ...doc, nextId: 4,
    nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [-30, -20], max: [-10, 0], id: 'n0' },
      { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
      { ...doc.nodes[0], id: 'n2', on: { node: 1, side: 'solid' } },
      { ...doc.nodes[1], id: 'n3', sketch: 2 },
    ],
    outputs: { ...doc.outputs, b3: { node: 3, side: 'solid' } },
  };
  await open(attached);
  await edit(3);
  await applyRound([40, 20], 3);
  await f.sketchPanel().getByRole('alert').getByText('Round a line and arc on one independent outline.').waitFor();
  await f.same(attached);
  await f.snapshot('06-stored-attached-outline-refused');
  await cancel();
  await f.same(attached);

  f.phase = 'reserve safe side IDs for the round and existing construction';
  const construction = { kind: 'polygon', construction: true, closed: false, points: [[2, 25], [6, 25]] };
  for (const [label, sibling] of [
    ['07-no-safe-construction-ids', construction],
    ['08-no-safe-joined-construction-ids', { ...construction, points: [[2, 25], [6, 25], [6, 29], [2, 25]], ids: ['e6', 'e7', 'e8', 'e9'] }],
  ]) {
    const crowded = { ...doc, nodes: [{ ...doc.nodes[0],
      sideTags: { outer: ['e1', 'e2', 'e3', `e${Number.MAX_SAFE_INTEGER - 1}`] },
      construction: [sibling],
    }, doc.nodes[1]] };
    await open(crowded);
    await edit();
    await applyRound([40, 20], 3);
    await f.sketchPanel().getByRole('alert').getByText('This sketch has no available side IDs for the round and its other shapes.').waitFor();
    await f.same(crowded);
    await f.snapshot(label);
    await cancel();
    await f.same(crowded);
  }
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(30000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  if (sourceEdit) {
    await checkSourceEdit();
    return;
  }
  if (mirrored) {
    await checkMirrored();
    return;
  }
  if (fixed) {
    await checkFixed();
    return;
  }
  const doc = await f.inspect('source-fixture', {}, 'fixture');
  const bytes = Buffer.from(JSON.stringify(doc));
  const native = await f.inspect('source-native', doc);
  near(native.volume, 10 * (800 + 100 * Math.PI));
  assert.equal(native.cylinders.length, 1);
  near(native.cylinders[0].r, 20);
  assert.deepEqual(doc.nodes[0].sideTags.outer, ['e1', 'e2', 'e3', 'e4']);
  await f.newPage();
  await open(doc, bytes);

  f.phase = 'observe current Round refusal at the line–arc corner';
  await edit();
  const before = await f.snapshot('01-line-arc-before');
  await applyRound([40, 20], 3);
  await f.sketchPanel().getByRole('alert').waitFor();
  const refusal = await f.snapshot('02-line-arc-refused');
  assert.deepEqual(refusal.doc, before.doc);
  assert.deepEqual(refusal.history, before.history);
  assert.equal(refusal.dirty, before.dirty);
  await cancel();
  await f.same(doc);

  f.phase = 'verify the supported line–line corner on the same outline';
  await edit();
  await applyRound([0, 40], 2);
  assert.equal(await f.sketchPanel().getByRole('alert').count(), 0);
  const accepted = (await f.finishSketch('03-line-line-control')).doc;
  const result = await f.inspect('line-line-control-native', accepted);
  near(result.volume, 10 * (796 + 101 * Math.PI));
  const radii = result.cylinders.map(cylinder => cylinder.r).sort((a, b) => a - b);
  assert.equal(radii.length, 2);
  near(radii[0], 2);
  near(radii[1], 20);
  assert.deepEqual(accepted.nodes[0].sideTags.outer, ['e1', 'e2', 'e3', 'e5', 'e4']);
  assert.deepEqual(accepted.nodes.slice(1), doc.nodes.slice(1));
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(accepted);
  f.report.observations.push({ label: 'line-arc-round-baseline', sourceSHA256: sha256(bytes),
    originalVolumeMm3: native.volume, refusal: refusal.roundError, controlVolumeMm3: result.volume, nativeFaces: result.faces });
  assert.deepEqual(f.report.downloads, []);
});
