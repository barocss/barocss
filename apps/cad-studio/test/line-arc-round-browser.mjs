import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixed = process.argv[3] === '--fixed';
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
  ...(fixed ? ['packages/barocss-cad-model/src/sketch/internal/pinnedLineArcRound.ts'] : []),
];
const f = await createFlow({
  name: 'line-arc-round', output: process.argv[2], envFrozen: 'D890_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: fixed ? 'Round a pinned finite line–circular-arc corner and verify its native producer.'
    : 'Measure the finite line–circular-arc Round boundary and the existing straight-corner control.',
  limits: ['One convex closed XY outline with one native R20 quarter arc and a 10 mm Extrude. The admitted fixture pins both carriers.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { partSnapshot } from '@barocss/cad-model/engine/part';
import { profileOf } from '../../packages/barocss-cad-model/src/sketch/loops.ts';
if (process.argv[3] === '"fixture"' || process.argv[3] === '"pinned"') {
  const pinned = process.argv[3] === '"pinned"';
  const profile = profileOf([{
    kind: 'polygon', closed: true, points: [[0,pinned ? 20 : 0],[40,20],[20,40],[0,40]],
    bulges: [0, Math.SQRT2 - 1, 0, 0], radii: {1:20}, tangents:[2], hv:{h:pinned ? [0,2] : [2],v:[3]}, ids: ['e1','e2','e3','e4'],
    ...(pinned ? { rules: [{ kind:'fix', point:2, at:[20,40] }] } : {}),
  }]);
  assert.ok('node' in profile);
  console.log(JSON.stringify(withNode(withNode(emptyDoc(), profile.node), {kind:'extrude',sketch:0,height:10})));
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
console.log(JSON.stringify({ volume: massPropertiesOf(output).volume, faces: output.brep.faces.map(face => face.name), cylinders }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    roundError: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null,
  }),
});

const file = 'D890-line-arc-round.bcad';
const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const outlinePoints = [[0, 0], [40, 20], [20, 40], [0, 40]];

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
  await f.frame(outlinePoints);
}

async function applyRound(corner, radius) {
  await f.worldClick(corner);
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

function independentRound(radius) {
  const x = Math.sqrt(400 - 40 * radius);
  const fillet = [20 + x, 20 + radius], source = [20, 20];
  const a = [fillet[0], 20], b = [20 + 20 * x / (20 - radius), 20 + 20 * radius / (20 - radius)];
  const angle = Math.atan2(radius, x);
  const polygon = [[0, 20], a, b, [20, 40], [0, 40]];
  const cross = ([ax, ay], [bx, by]) => ax * by - ay * bx;
  const chordArea = polygon.reduce((sum, point, i) => sum + cross(point, polygon[(i + 1) % polygon.length]), 0) / 2;
  const arcArea = (r, sweep) => r * r * (sweep - Math.sin(sweep)) / 2;
  return { fillet, source, polygon, volume: 10 * (chordArea + arcArea(radius, Math.PI / 2 + angle) + arcArea(20, Math.PI / 2 - angle)) };
}

async function checkRound(label, doc, original, radius) {
  const expected = independentRound(radius);
  const sketch = doc.nodes[0];
  assert.deepEqual(doc.nodes.slice(1), original.nodes.slice(1));
  assert.deepEqual(doc.outputs, original.outputs);
  assert.deepEqual(sketch.sideTags.outer, ['e1', 'e5', 'e2', 'e3', 'e4']);
  assert.deepEqual(sketch.outline.radii, { 1: radius, 2: 20 });
  assert.deepEqual(sketch.outline.tangents, [1, 2, 3]);
  assert.deepEqual(sketch.outline.hv, { h: [0, 3], v: [4] });
  assert.deepEqual(sketch.outline.rules, [{ kind: 'fix', point: 3, at: [20, 40] }]);
  const point = (actual, wanted) => wanted.forEach((value, i) => near(actual[i], value));
  assert.equal(sketch.segments.length, 5);
  sketch.segments.forEach((segment, i) => point(segment.start, expected.polygon[i]));
  const native = await f.inspect(label, doc);
  for (const [i, tag, center, r] of [[1, 'e5', expected.fillet, radius], [2, 'e2', expected.source, 20]]) {
    assert.equal(sketch.segments[i].kind, 'arc');
    assert.equal(sketch.segments[i].direction, 'ccw');
    point(sketch.segments[i].center, center);
    const cylinder = native.cylinders.find(face => face.name === `n1.side[${tag}]`);
    assert.ok(cylinder);
    point(cylinder.c, center);
    near(cylinder.r, r);
    assert.deepEqual(cylinder.a, [0, 0, 1]);
  }
  assert.ok(['e1', 'e3', 'e4'].every(tag => native.faces.includes(`n1.side[${tag}]`)));
  near(native.volume, expected.volume, 1e-7);
  near((await f.bodies()).bodies[0].volume, expected.volume, 1e-7);
  f.report.observations.push({ label, radiusMm: radius, expectedVolumeMm3: expected.volume, volumeMm3: native.volume,
    sideTags: sketch.sideTags.outer, nativeCylinders: native.cylinders, lineContactMm: expected.polygon[1], sourceContactMm: expected.polygon[2] });
  return native;
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
