import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const sourceEdit = process.argv[3] === '--source-edit';
const sharpCandidate = process.argv[3] === '--sharp-candidate';
const points = [[2, 0], [18, 0], [20, 2], [20, 8], [18, 10], [2, 10], [0, 8], [0, 2]];
const ids = points.map((_, i) => 'e' + (i + 1));
const inset = [[2, 1], [18, 1], [19, 2], [19, 8], [18, 9], [2, 9], [1, 8], [1, 2]];
const centers = [[18, 2], [18, 8], [2, 8], [2, 2]];
const derivedIds = points.map((_, i) => 'e' + (i + 9));
const sharpIds = [0, 2, 4, 6].map(i => derivedIds[i]);
const area = (w, h, r) => w * h - (4 - Math.PI) * r * r;
const stockVolume = 10 * area(20, 10, 2);
const ringVolume = stockVolume - 10 * area(18, 8, 1);
const close = (value, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(value - expected) <= tolerance, `${value} vs ${expected}`);

const initialFiles = [
  'apps/cad-studio/test/rounded-sketch-offset-browser.mjs',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/sketch/offset.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
];
const f = await createFlow({
  name: 'rounded-sketch-offset', envFrozen: sharpCandidate ? 'D908_SOURCE_FROZEN' : sourceEdit ? 'D907_SOURCE_FROZEN' : 'D906_SOURCE_FROZEN', output: process.argv[2],
  qualification: sharpCandidate ? 'Read exact sharp-inset candidate documents and verify surviving side identity in Studio.'
    : sourceEdit ? 'Verify that a source radius edit keeps the previously copied inner loop independent.'
    : 'Measure the existing rounded-rectangle inward Offset limit and native ring persistence.',
  limits: [sharpCandidate ? 'Analytic candidate geometry is supplied as a native document, with no associative regeneration.'
    : 'One independent 20 × 10 mm rounded rectangle, R2 corners, one 10 mm native Extrude.'],
  initialFiles, requiredFrozen: initialFiles,
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { partSnapshot } from '@barocss/cad-model/engine/part';
import { profileOf } from '../../packages/barocss-cad-model/src/sketch/loops.ts';
if (process.argv[3] === '"fixture"' || process.argv[3] === '"pinned"') {
  const b = Math.tan(Math.PI / 8), points = ${JSON.stringify(points)};
  const pins = process.argv[3] === '"pinned"'
    ? { hv:{ h:[], v:[] }, rules:points.slice(1).map((at, index) => ({ kind:'fix', point:index+1, at })) } : {};
  const profile = profileOf([{ kind:'polygon', closed:true, points, ids:${JSON.stringify(ids)},
    bulges:[0,b,0,b,0,b,0,b], ...pins }]);
  assert.ok('node' in profile);
  console.log(JSON.stringify(withNode(withNode(emptyDoc(), profile.node), { kind:'extrude', sketch:0, height:10 })));
  process.exit(0);
}
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
assert.equal(outputs.length, 1);
const [{ brep }] = outputs;
assert.ok(checkBrep(brep, { strict:true }).valid);
assert.equal(brep.shells.length, 1);
assert.ok(brep.shells[0].closed);
const cylinders = brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'cylinder' ? [{ name:face.name, ...g }] : [];
});
console.log(JSON.stringify({ volume:massPropertiesOf(outputs[0]).volume, cylinders,
  faces:brep.faces.map(face => face.name), vertices:brep.vertices.map(vertex => vertex.point) }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    sketchCurves: Array.from(document.querySelectorAll('.vp-overlay .sk-shape'), element =>
      [element.getAttribute('class'), element.getAttribute('points'), element.getAttribute('d')]),
  }),
});

const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const name = sharpCandidate ? 'D908-sharp-inset-candidate.bcad' : sourceEdit ? 'D907-independent-offset.bcad' : 'D906-rounded-rectangle.bcad';

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function save(doc) {
  const project = sharpCandidate ? 'D908 sharp inset candidate' : sourceEdit ? 'D907 independent offset' : 'D906 rounded rectangle';
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(name)).getFile()).text();
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

function checkCylinders(native, radius, tags) {
  for (const [index, center] of centers.entries()) {
    const tag = tags[index * 2 + 1];
    const cylinder = native.cylinders.find(c => c.name === `n1.side[${tag}]`);
    assert.ok(cylinder, tag);
    close(cylinder.r, radius, 1e-8);
    close(cylinder.c[0], center[0], 1e-8);
    close(cylinder.c[1], center[1], 1e-8);
    close(Math.abs(cylinder.a[2]), 1, 1e-8);
  }
}

async function checkRing(label, doc, stock) {
  const sketch = doc.nodes[0];
  assert.deepEqual(doc.nodes.slice(1), stock.nodes.slice(1));
  assert.deepEqual(doc.outputs, stock.outputs);
  assert.deepEqual(sketch.segments, stock.nodes[0].segments);
  assert.deepEqual(sketch.sideTags.outer, ids);
  assert.equal(sketch.holes.length, 1);
  assert.equal(sketch.regions?.length ?? 0, 0);
  const inner = sketch.sideTags.holes[0];
  assert.equal(inner.length, 8);
  assert.equal(new Set([...ids, ...inner]).size, 16);
  const loop = sketch.holes[0];
  assert.deepEqual(loop.map(segment => segment.start), inset);
  const arcs = loop.filter(segment => segment.kind === 'arc');
  assert.equal(arcs.length, centers.length);
  arcs.forEach((segment, index) => segment.center.forEach((value, axis) => close(value, centers[index][axis], 1e-8)));
  const native = await f.inspect(label, doc);
  assert.equal(native.cylinders.length, 8);
  checkCylinders(native, 2, ids);
  checkCylinders(native, 1, inner);
  for (const [x, y] of [...points, ...inset]) for (const depth of [0, 10]) {
    assert.ok(native.vertices.some(vertex => Math.hypot(vertex[0] - x, vertex[1] - y, vertex[2] - depth) < 1e-8));
  }
  close(native.volume, ringVolume);
  close((await f.bodies()).bodies[0].volume, ringVolume);
  f.report.observations.push({ label, sideTags: sketch.sideTags, expectedVolumeMm3: ringVolume, volumeMm3: native.volume });
}

async function editOuterRadius(stock, ring) {
  const radius = 2.25, chord = Math.sqrt(8);
  // The existing numerical sketch solver uses a 1e-7 mm linear residual.
  const coordinateTolerance = 1e-7, volumeTolerance = 1e-6;
  const delta = Math.sqrt(radius * radius - 2) / Math.sqrt(2);
  const expectedCenter = [19 - delta, 1 + delta];
  const segmentArea = r => {
    const sweep = 2 * Math.asin(chord / (2 * r));
    return r * r * (sweep - Math.sin(sweep)) / 2;
  };
  const expectedVolume = ringVolume + 10 * (segmentArea(radius) - segmentArea(2));
  const check = async (label, doc) => {
    const sketch = doc.nodes[0], previous = ring.nodes[0];
    assert.deepEqual(doc.nodes.slice(1), stock.nodes.slice(1));
    assert.deepEqual(doc.outputs, stock.outputs);
    assert.equal(sketch.association, undefined);
    assert.deepEqual(sketch.holes, previous.holes);
    assert.deepEqual(sketch.sideTags, previous.sideTags);
    assert.equal(sketch.segments.length, points.length);
    for (const [index, segment] of sketch.segments.entries()) {
      const expected = previous.segments[index];
      assert.equal(segment.kind, expected.kind);
      assert.equal(segment.direction, expected.direction);
      segment.start.forEach((value, axis) => close(value, points[index][axis], coordinateTolerance));
      if (index !== 1 && segment.kind === 'arc') {
        segment.center.forEach((value, axis) => close(value, expected.center[axis], coordinateTolerance));
      }
    }
    assert.equal(sketch.outline.radii[1], radius);
    const native = await f.inspect(label, doc);
    assert.equal(native.cylinders.length, 8);
    const edited = native.cylinders.find(c => c.name === 'n1.side[e2]');
    assert.ok(edited);
    close(edited.r, radius, coordinateTolerance);
    close(edited.c[0], expectedCenter[0], coordinateTolerance);
    close(edited.c[1], expectedCenter[1], coordinateTolerance);
    close(Math.abs(edited.a[2]), 1, coordinateTolerance);
    checkCylinders(native, 1, sketch.sideTags.holes[0]);
    close(native.volume, expectedVolume, volumeTolerance);
    close((await f.bodies()).bodies[0].volume, expectedVolume, volumeTolerance);
    f.report.observations.push({ label, radiusMm: radius, centerMm: expectedCenter, expectedVolumeMm3: expectedVolume,
      coordinateToleranceMm: coordinateTolerance, volumeToleranceMm3: volumeTolerance,
      volumeMm3: native.volume, sideTags: sketch.sideTags });
  };

  f.phase = 'edit only the outer Arc 2 radius';
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  const panel = f.sketchPanel();
  const field = panel.getByLabel('Arc 2 radius', { exact: true });
  await field.fill(String(radius));
  assert.equal(await field.inputValue(), String(radius));
  assert.equal(await f.sketchAlert(), null);
  const edited = (await f.finishSketch('02-source-R2.25')).doc;
  await check('source-edit-native', edited);
  await f.undo();
  await f.same(ring);
  await f.redo();
  await f.same(edited);
  const bytes = await save(edited);
  await f.newPage();
  await open(edited, bytes);
  await check('source-edit-reopened-native', edited);
  await f.snapshot('03-source-edit-fresh-open');
}

async function verifySharpCandidates(stock) {
  const base = stock.nodes[0];
  const roundedHole = inset.map((start, index) => index % 2
    ? { kind: 'arc', start, center: centers[(index - 1) / 2], direction: 'ccw' }
    : { kind: 'line', start });
  const nativeDoc = (segments, tags) => ({ ...stock, nodes: [
    { ...base, holes: [segments], sideTags: { outer: ids, holes: [tags] } },
    stock.nodes[1],
  ] });
  const rounded = nativeDoc(roundedHole, derivedIds);
  for (const value of [1, 2, 2.5, 1]) {
    f.phase = `Open the independently authored inset ${value} mm candidate`;
    if (value === 1) {
      await open(rounded);
      await checkRing('candidate-rounded-' + f.report.observations.length, rounded, stock);
      continue;
    }
    const lo = value, hiX = 20 - value, hiY = 10 - value;
    const corners = [[lo, lo], [hiX, lo], [hiX, hiY], [lo, hiY]];
    const sharp = nativeDoc(corners.map(start => ({ kind: 'line', start })), sharpIds);
    await open(sharp);
    const check = async label => {
      const actual = await f.doc();
      assert.deepEqual(actual, sharp);
      assert.equal(actual.nodes[0].association, undefined);
      const native = await f.inspect(label, actual);
      assert.equal(native.cylinders.length, 4);
      checkCylinders(native, 2, ids);
      for (const tag of [...ids, ...sharpIds]) assert.ok(native.faces.includes(`n1.side[${tag}]`), tag);
      const retired = derivedIds.filter(tag => !sharpIds.includes(tag));
      for (const tag of retired) assert.ok(!native.faces.includes(`n1.side[${tag}]`), tag);
      assert.equal(native.faces.length, 14);
      assert.equal(native.vertices.length, 24);
      for (const [x, y] of [...points, ...corners]) for (const depth of [0, 10]) {
        assert.ok(native.vertices.some(vertex => Math.hypot(vertex[0] - x, vertex[1] - y, vertex[2] - depth) < 1e-8));
      }
      const holeArea = (hiX - lo) * (hiY - lo);
      const expectedVolume = stockVolume - 10 * holeArea;
      close(native.volume, expectedVolume);
      close((await f.bodies()).bodies[0].volume, expectedVolume);
      f.report.observations.push({ label, insetMm: value, holeAreaMm2: holeArea, volumeMm3: native.volume,
        expectedVolumeMm3: expectedVolume, survivingTags: sharpIds, retiredTags: retired });
    };
    await check('candidate-sharp-' + value);
    await f.snapshot('candidate-sharp-' + value);
    if (value === 2.5) {
      const bytes = await save(sharp);
      await f.newPage();
      await open(sharp, bytes);
      await check('candidate-sharp-reopened');
      await f.snapshot('candidate-sharp-reopened');
    }
  }
  await f.snapshot('candidate-return-rounded');
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const stock = await f.inspect('stock-fixture', {}, sourceEdit ? 'pinned' : 'fixture');
  const nativeStock = await f.inspect('stock-native', stock);
  close(nativeStock.volume, stockVolume);
  assert.equal(nativeStock.cylinders.length, 4);
  checkCylinders(nativeStock, 2, ids);
  await f.newPage();
  if (sharpCandidate) {
    await verifySharpCandidates(stock);
    return;
  }
  await open(stock);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  const panel = f.sketchPanel();
  await panel.waitFor();
  const distance = panel.getByLabel('Offset distance', { exact: true });
  const offset = async value => {
    await distance.fill(String(value));
    await button(panel, 'Offset inward').click();
  };
  if (sourceEdit) {
    await offset(1);
    const ring = (await f.finishSketch('01-independent-inset')).doc;
    await checkRing('independent-inset-native', ring, stock);
    await editOuterRadius(stock, ring);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  const before = await f.snapshot('01-stock-in-sketch');
  assert.ok(before.sketchCurves.length > 0);
  for (const [label, value] of [['02-arc-collapse', 2], ['03-past-arc-collapse', 2.5]]) {
    f.phase = `refuse inward Offset ${value} mm`;
    await offset(value);
    const refusal = await f.waitToast(/more than an arc’s radius/);
    const rejected = await f.snapshot(label);
    for (const key of ['doc', 'history', 'dirty', 'sketchCurves']) assert.deepEqual(rejected[key], before[key], key);
    f.report.observations.push({ label, insetMm: value, refusal });
    await f.dismissToasts();
  }
  f.phase = 'accept the 1 mm inward Offset and finish the ring';
  await offset(1);
  assert.deepEqual(await f.toasts(), []);
  const ring = (await f.finishSketch('04-inset-1-ring')).doc;
  await checkRing('ring-native', ring, stock);
  await f.undo();
  await f.same(stock);
  await f.redo();
  await f.same(ring);
  const bytes = await save(ring);
  await f.newPage();
  await open(ring, bytes);
  await checkRing('ring-reopened-native', ring, stock);
  await f.snapshot('05-ring-fresh-open');
  assert.deepEqual(f.report.downloads, []);
});
