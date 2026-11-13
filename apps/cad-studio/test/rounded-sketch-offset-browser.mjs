import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const sourceEdit = process.argv[3] === '--source-edit';
const nestedOffset = process.argv[3] === '--nested-offset';
const insetRefusals = process.argv[3] === '--inset-refusals';
const detachedSourceEdit = process.argv[3] === '--detached-source-edit';
const widthInset = process.argv[3] === '--width-inset';
const drawnInset = detachedSourceEdit || widthInset || process.argv[3] === '--drawn-inset';
const authorInset = process.argv[3] === '--author-inset';
const detachInset = process.argv[3] === '--detach-inset';
const editInset = process.argv[3] === '--edit-inset';
const dependentInset = process.argv[3] === '--dependent-inset';
const storedInset = dependentInset || insetRefusals || drawnInset || authorInset || detachInset || editInset || process.argv[3] === '--stored-inset';
const plannedInset = process.argv[3] === '--planned-inset';
const lostCorner = process.argv[3] === '--lost-corner';
const sharpCandidate = plannedInset || lostCorner || process.argv[3] === '--sharp-candidate';
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
  ...(storedInset ? [
    'apps/cad-studio/src/files/documentFile.ts',
    'apps/cad-studio/src/engine/engine.worker.ts',
    'packages/barocss-cad-model/src/engine/migrate.ts',
    'packages/barocss-cad-model/src/sketch/internal/roundedInsetRecipe.ts',
  ] : []),
  ...(editInset || detachInset || authorInset || drawnInset ? [
    'apps/cad-studio/src/App.tsx',
    'apps/cad-studio/src/ui/NodeEditor.tsx',
    'packages/barocss-cad-model/src/app/editFields.ts',
  ] : []),
  ...(authorInset || drawnInset ? ['apps/cad-studio/src/app/roundedInsetCommand.ts'] : []),
  ...(plannedInset ? ['packages/barocss-cad-model/src/sketch/internal/roundedRectangleInset.ts'] : []),
  ...(lostCorner ? [
    'apps/cad-studio/src/files/documentFile.ts',
    'packages/barocss-cad-model/src/engine/references.ts',
    'packages/barocss-cad/src/blend/edge-finish.ts',
  ] : []),
];
const f = await createFlow({
  name: 'rounded-sketch-offset', envFrozen: nestedOffset ? 'D1099_SOURCE_FROZEN' : dependentInset ? 'D999_SOURCE_FROZEN' : insetRefusals ? 'D919_SOURCE_FROZEN' : detachedSourceEdit ? 'D918_SOURCE_FROZEN' : widthInset ? 'D917_SOURCE_FROZEN' : drawnInset ? 'D916_SOURCE_FROZEN' : authorInset ? 'D915_SOURCE_FROZEN' : detachInset ? 'D914_SOURCE_FROZEN' : editInset ? 'D913_SOURCE_FROZEN' : storedInset ? 'D912_SOURCE_FROZEN' : plannedInset ? 'D910_SOURCE_FROZEN' : lostCorner ? 'D909_SOURCE_FROZEN' : sharpCandidate ? 'D908_SOURCE_FROZEN' : sourceEdit ? 'D907_SOURCE_FROZEN' : 'D906_SOURCE_FROZEN', output: process.argv[2],
  qualification: nestedOffset ? 'Refuse a third nested outline at Offset and retain the valid ring draft.'
    : dependentInset ? 'Qualify the stored linked inset boundary for a retired dependent finish edge.' : insetRefusals ? 'Retain the accepted solid through malformed linked-inset files and Delete.'
    : detachedSourceEdit ? 'Edit the former source after detach without changing the independent solid.'
    : widthInset ? 'Edit the width of a drawn linked inset source without changing its radius or identity.'
    : drawnInset ? 'Draw and round all four source corners in desktop Studio.'
    : authorInset ? 'Author a linked inset and direct Extrude together from one finished sketch.'
    : detachInset ? 'Detach a rounded inset into the exact ordinary sketch at the same feature ID.'
    : editInset ? 'Edit a loaded rounded inset through its direct Extrude editor.'
    : storedInset ? 'Open and validate a versioned rounded inset through File and Project.'
    : plannedInset ? 'Generate bounded inset plans from one source and verify their native Studio readback.'
    : lostCorner ? 'Measure the existing cold Open rematch for a Fillet whose signed inner arc is absent.'
    : sharpCandidate ? 'Read exact sharp-inset candidate documents and verify surviving side identity in Studio.'
    : sourceEdit ? 'Verify that a source radius edit keeps the previously copied inner loop independent.'
    : 'Measure the existing rounded-rectangle inward Offset limit and native ring persistence.',
  limits: [storedInset ? 'One stored recipe with a native rounded XY source and one direct Extrude.'
    : plannedInset ? 'Plans are generated outside Studio. Studio reads their native documents without a persisted recipe.'
    : sharpCandidate ? 'Analytic candidate geometry is supplied as a native document, with no associative regeneration.'
    : 'One independent 20 × 10 mm rounded rectangle, R2 corners, one 10 mm native Extrude.'],
  initialFiles, requiredFrozen: initialFiles,
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { partSnapshot, toPartDocument } from '@barocss/cad-model/engine/part';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { captureSignatures } from '@barocss/cad-model/engine/references';
import { profileOf } from '../../packages/barocss-cad-model/src/sketch/loops.ts';
${plannedInset ? "import { planRoundedRectangleInset } from '../../packages/barocss-cad-model/src/sketch/internal/roundedRectangleInset.ts';" : ''}
${plannedInset ? `
const args = JSON.parse(process.argv[3] ?? 'null');
const [requested, inset] = Array.isArray(args) ? args : [];
if (requested === 'inset-plan') {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const b = Math.tan(Math.PI / 8), ids = ${JSON.stringify(ids)};
  const source = { kind:'polygon', closed:true, points:${JSON.stringify(points)}, ids, bulges:[0,b,0,b,0,b,0,b] };
  const mapped = new Map(ids.map((id, index) => [id, ${JSON.stringify(derivedIds)}[index]]));
  const result = planRoundedRectangleInset(source, inset, mapped);
  if ('error' in result) { console.log(JSON.stringify(result)); process.exit(0); }
  const profile = profileOf([source, result.shape]);
  assert.ok('node' in profile, JSON.stringify(profile));
  const sketch = { ...profile.node, id:doc.nodes[0].id };
  console.log(JSON.stringify({ doc:{ ...doc, nodes:[sketch, doc.nodes[1]] }, retiredIds:result.retiredIds }));
  process.exit(0);
}
` : ''}
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
if (process.argv[3] === '"lowered"') {
  console.log(JSON.stringify(toPartDocument(doc)));
  process.exit(0);
}
if (process.argv[3] === '"corner-fillet"') {
  const parent = evaluatePart(doc, 1);
  assert.ok(parent.ok, JSON.stringify(parent));
  const name = 'n1.side[e10]|n1.top';
  const edge = parent.bodies[0].mesh.edges.find(edge => edge.names.includes(name));
  assert.ok(edge, JSON.stringify(parent.bodies[0].mesh.edges.map(edge => edge.names)));
  const feature = { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [name], radius: 0.2 };
  const signed = captureSignatures(withNode(doc, feature), parent.bodies);
  assert.ok(signed.nodes[2].sigs?.[name]);
  console.log(JSON.stringify(signed));
  process.exit(0);
}
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
    title: document.querySelector('.doc-tab input')?.value ?? null,
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
    sketchCurves: Array.from(document.querySelectorAll('.vp-overlay .sk-shape'), element =>
      [element.getAttribute('class'), element.getAttribute('points'), element.getAttribute('d')]),
  }),
});

const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const name = drawnInset ? 'D916-rounded-inset.bcad' : authorInset ? 'D915-rounded-inset.bcad' : detachInset ? 'D914-rounded-inset.bcad' : editInset ? 'D913-rounded-inset.bcad' : storedInset ? 'D912-rounded-inset.bcad' : plannedInset ? 'D910-planned-inset.bcad' : lostCorner ? 'D909-missing-inset-corner.bcad' : sharpCandidate ? 'D908-sharp-inset-candidate.bcad' : sourceEdit ? 'D907-independent-offset.bcad' : 'D906-rounded-rectangle.bcad';

async function chooseFile(doc, filename = name, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
}
async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  await chooseFile(doc, name, bytes);
  await f.same(doc);
}

async function save(doc) {
  const project = drawnInset ? 'D916 rounded inset' : authorInset ? 'D915 rounded inset' : detachInset ? 'D914 rounded inset' : editInset ? 'D913 rounded inset' : storedInset ? 'D912 rounded inset' : plannedInset ? 'D910 planned inset' : lostCorner ? 'D909 missing inset corner' : sharpCandidate ? 'D908 sharp inset candidate' : sourceEdit ? 'D907 independent offset' : 'D906 rounded rectangle';
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
  const produced = async (value, analytic, retired) => {
    if (!plannedInset) return analytic;
    const planned = await f.inspect('inset-plan-' + value + '-' + f.report.observations.length, stock, ['inset-plan', value]);
    assert.ok('doc' in planned, JSON.stringify(planned));
    assert.deepEqual(planned.doc.nodes[0].sideTags, analytic.nodes[0].sideTags);
    assert.deepEqual(planned.retiredIds, retired);
    assert.deepEqual(planned.doc.nodes[0].holes[0].map(segment => segment.start), analytic.nodes[0].holes[0].map(segment => segment.start));
    return planned.doc;
  };
  if (lostCorner) {
    const sharp = nativeDoc([[2.5, 2.5], [17.5, 2.5], [17.5, 7.5], [2.5, 7.5]].map(start => ({ kind: 'line', start })), sharpIds);
    await verifyLostCorner(rounded, sharp);
    return;
  }
  const retired = derivedIds.filter(tag => !sharpIds.includes(tag));
  for (const value of [1, 2, 2.5, 1]) {
    f.phase = `Open the ${value} mm inset ${plannedInset ? 'plan' : 'analytic candidate'}`;
    if (value === 1) {
      const doc = await produced(value, rounded, []);
      await open(doc);
      await checkRing('candidate-rounded-' + f.report.observations.length, doc, stock);
      continue;
    }
    const lo = value, hiX = 20 - value, hiY = 10 - value;
    const corners = [[lo, lo], [hiX, lo], [hiX, hiY], [lo, hiY]];
    const sharp = await produced(value, nativeDoc(corners.map(start => ({ kind: 'line', start })), sharpIds), retired);
    await open(sharp);
    const check = async label => {
      const actual = await f.doc();
      assert.deepEqual(actual, sharp);
      assert.equal(actual.nodes[0].association, undefined);
      const native = await f.inspect(label, actual);
      assert.equal(native.cylinders.length, 4);
      checkCylinders(native, 2, ids);
      for (const tag of [...ids, ...sharpIds]) assert.ok(native.faces.includes(`n1.side[${tag}]`), tag);
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
  if (plannedInset) {
    for (const value of [1.995, 5]) {
      const rejected = await f.inspect('inset-plan-refused-' + value, stock, ['inset-plan', value]);
      assert.equal(typeof rejected.error, 'string');
      f.report.observations.push({ label: 'private-plan-refusal', insetMm: value, refusal: rejected.error });
    }
  }
}

async function verifyLostCorner(rounded, sharp) {
  const signed = await f.inspect('signed-rounded-fixture', rounded, 'corner-fillet');
  const stored = signed.nodes[2], [edge] = stored.edges;
  assert.match(edge, /side\[e10\]/);
  assert.ok(stored.sigs[edge]);
  const finished = await f.inspect('rounded-fillet-native', signed);
  const radius = stored.radius, c = radius * radius * (1 - Math.PI / 4);
  const m = radius ** 3 * (5 / 6 - Math.PI / 4);
  const innerPerimeter = 2 * (16 + 6) + 2 * Math.PI;
  const expected = ringVolume - innerPerimeter * c - 2 * Math.PI * m;
  close(finished.volume, expected);
  assert.ok(finished.faces.some(face => face.startsWith('n2.face')));
  await open(signed);
  close((await f.bodies()).bodies[0].volume, expected);
  await f.snapshot('01-rounded-fillet-control');

  const missing = { ...signed, nodes: [...sharp.nodes, stored] };
  f.phase = 'Open the sharp candidate with the signed missing-arc Fillet';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(missing)) });
  const replacement = 'n1.side[e2]|n1.top';
  await f.page.waitForFunction(([replacement, edge]) =>
    window.__studioDoc?.nodes?.[2]?.rematched?.[replacement] === edge, [replacement, edge], { timeout: 15000 });
  await f.ready();
  const rematched = await f.doc();
  assert.deepEqual(rematched.nodes.slice(0, 2), sharp.nodes);
  assert.deepEqual(rematched.nodes[2], {
    ...stored, edges: [replacement], sigs: { [replacement]: stored.sigs[edge] }, rematched: { [replacement]: edge },
  });
  const panel = f.page.getByRole('region', { name: 'References', exact: true });
  await panel.waitFor();
  await panel.getByText('Technical details', { exact: true }).click();
  const notice = await panel.innerText();
  assert.match(notice, /e10/);
  assert.match(notice, /e2/);
  const sharpNative = await f.inspect('sharp-rematched-native', rematched);
  const sharpBase = stockVolume - 10 * 75;
  const outerPerimeter = 2 * (16 + 6) + 4 * Math.PI;
  const expectedSharp = sharpBase - outerPerimeter * c + 2 * Math.PI * m;
  close(sharpNative.volume, expectedSharp);
  assert.ok(sharpNative.faces.some(face => face.startsWith('n2.face')));
  assert.equal(sharpNative.faces.some(face => face.includes('side[e10]')), false);
  close((await f.bodies()).bodies[0].volume, expectedSharp);
  await f.snapshot('02-sharp-corner-marked-rematch');

  const bytes = await save(rematched);
  await f.newPage();
  await open(rematched, bytes);
  assert.deepEqual(await f.inspect('sharp-rematched-reopened-native', rematched), sharpNative);
  await f.snapshot('03-sharp-rematched-fresh-open');
  await open(signed);
  assert.deepEqual(await f.inspect('original-rounded-restored', signed), finished);
  await f.snapshot('04-original-rounded-open');
  f.report.observations.push({ label: 'signed-missing-corner', edge, replacement, notice, refSignature: stored.sigs[edge],
    roundedVolumeMm3: finished.volume, expectedRoundedVolumeMm3: expected, unfilletedSharpVolumeMm3: sharpBase,
    sharpVolumeMm3: sharpNative.volume, expectedSharpVolumeMm3: expectedSharp });
}

async function verifyInsetDependencyBoundary(candidate, check) {
  const initial = candidate(1), sharp = candidate(2.5);
  const edge = 'n2.side[e10]|n2.top';
  const buttonNamed = name => button(f.page, name);
  f.phase = 'open the supported rounded linked inset';
  await open(initial);
  const rounded = await check('supported-rounded', initial, 1);
  assert.ok(rounded.faces.includes('n2.side[e10]'));
  await f.openFeatureEditor(2, 'linked inset');
  await f.editor().getByRole('spinbutton', { name: 'Inset distance', exact: true }).fill('2.5');
  await button(f.editor(), 'Apply').click();
  const accepted = await check('supported-sharp', sharp, 2.5);
  assert.equal(accepted.faces.includes('n2.side[e10]'), false);

  for (const kind of ['fillet', 'chamfer']) {
    f.phase = 'open a linked inset with an authored ' + kind + ' on the retired arc';
    const feature = { id: 'n3', kind, parent: { node: 2, side: 'solid' }, edges: [edge],
      ...(kind === 'fillet' ? { radius: 0.2 } : { distance: 0.2 }),
      sigs: { [edge]: { k: 'curve', p: [18.5, 1.5, 10], s: Math.sqrt(2) } } };
    const proposed = { ...sharp, nodes: [...sharp.nodes, feature], outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4 };
    await f.dismissToasts();
    const before = await f.snapshot(kind + '-before-refusal');
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), buttonNamed('Open').click()]);
    await chooser.setFiles({ name: kind + '-retired-inset.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposed)) });
    await f.waitToast(/retired inset side.*cannot be rematched/i);
    const after = await f.snapshot(kind + '-retired-edge-refused');
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection', 'title']) {
      assert.deepEqual(after[key], before[key], key);
    }
    assert.equal(await f.page.getByRole('region', { name: 'References', exact: true }).count(), 0);
  }
  assert.deepEqual(f.report.downloads, []);
}

async function verifyStoredInset(stock) {
  const sideMap = Object.fromEntries(ids.map((id, i) => [id, derivedIds[i]]));
  const recipe = { kind: 'rounded-rectangle-inset', version: 1, sourceSketch: 0, sourceFeature: 'n0', insetMM: 1, sideMap, id: 'n1' };
  const candidate = distance => ({ ...stock,
    nodes: [stock.nodes[0], { ...recipe, insetMM: distance }, { kind: 'extrude', sketch: 1, height: 10, id: 'n2' }],
    outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
  });
  const check = async (label, doc, distance) => {
    await f.same(doc);
    const body = await f.inspect(label, doc);
    const r = Math.max(2 - distance, 0);
    const expected = stockVolume - 10 * area(20 - 2 * distance, 10 - 2 * distance, r);
    close(body.volume, expected);
    close((await f.bodies()).bodies[0].volume, expected);
    assert.equal(body.cylinders.length, r > 0 ? 8 : 4);
    assert.equal(body.faces.length, r > 0 ? 18 : 14);
    const names = (r > 0 ? derivedIds : sharpIds).map(id => `n2.side[${id}]`);
    for (const side of [...ids.map(id => `n2.side[${id}]`), ...names]) assert.ok(body.faces.includes(side), side);
    for (const id of derivedIds.filter(id => !sharpIds.includes(id))) {
      assert.equal(body.faces.includes(`n2.side[${id}]`), r > 0);
    }
    f.report.observations.push({ label, insetMm: distance, volumeMm3: body.volume, expectedVolumeMm3: expected, derivedFaces: names });
    return body;
  };
  if (dependentInset) {
    await verifyInsetDependencyBoundary(candidate, check);
    return;
  }
  if (insetRefusals) {
    await verifyInsetRefusals(candidate, check);
    return;
  }
  if (authorInset) {
    await verifyInsetAuthoring(stock, candidate, check);
    return;
  }
  if (detachInset) {
    await verifyInsetDetach(candidate, check);
    return;
  }
  if (editInset) {
    await verifyInsetEdits(stock, candidate, check);
    return;
  }
  for (const [index, distance] of [1, 2, 2.5, 1].entries()) {
    f.phase = `Open stored recipe at ${distance} mm`;
    const doc = candidate(distance);
    await open(doc);
    await check('stored-inset-' + index, doc, distance);
  }
  const rounded = candidate(1), sharp = candidate(2.5);
  const history = f.page.getByRole('group', { name: 'History', exact: true });
  await history.getByRole('button', { name: 'Sketch · rounded inset', exact: true }).waitFor();
  await f.openFeatureEditor(2);
  assert.equal(await button(f.editor(), 'Edit sketch').count(), 0);
  await f.closeEditor();
  const before = await f.snapshot('01-stored-rounded');

  const wrong = structuredClone(sharp);
  wrong.nodes[1].sourceFeature = 'n9';
  const missingArc = structuredClone(sharp);
  missingArc.nodes.push({ kind: 'fillet', id: 'n3', parent: { node: 2, side: 'solid' }, radius: 0.2, edges: ['n2.side[e10]|n2.top'] });
  missingArc.nextId = 4;
  missingArc.outputs = { b3: { node: 3, side: 'solid' } };
  const nativeInvalid = smallInset(candidate(0.02));
  const unchanged = async (label, previous, reason) => {
    await f.waitToast(reason);
    const after = await f.snapshot(label);
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection', 'title']) assert.deepEqual(after[key], previous[key], key);
    await f.dismissToasts();
  };
  f.phase = 'refuse a wrong source and a missing arc on File Open';
  await chooseFile(wrong, 'wrong-source.bcad');
  await unchanged('02-wrong-source-refused', before, /rounded rectangle inset.*source/i);
  await chooseFile(missingArc, 'retired-corner.bcad');
  await unchanged('03-retired-corner-refused', before, /retired.*e10|e10.*retired/i);
  await chooseFile(nativeInvalid, 'native-invalid-inset.bcad');
  await unchanged('03b-native-invalid-refused', before, /loop encloses no area/i);

  f.phase = 'check prepared valid and invalid recipes through Project Open';
  const project = 'D912 rounded inset candidates';
  await f.page.evaluate(async ([project, valid, invalid]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects', { create: true });
    const folder = await projects.getDirectoryHandle(project, { create: true });
    for (const [name, doc] of [['sharp.bcad', valid], ['retired.bcad', invalid]]) {
      const handle = await folder.getFileHandle(name, { create: true });
      const writer = await handle.createWritable();
      await writer.write(JSON.stringify(doc));
      await writer.close();
    }
  }, [project, sharp, missingArc]);
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  const beforeProject = await f.snapshot('04-before-project-refusal');
  await button(panel, 'Open retired.bcad').click();
  await unchanged('05-project-retired-refused', beforeProject, /retired.*e10|e10.*retired/i);
  await button(panel, 'Open sharp.bcad').click();
  await check('stored-project-sharp', sharp, 2.5);
  await f.undo();
  await f.same(rounded);
  await f.redo();
  await f.same(sharp);
  await f.snapshot('06-project-sharp');
  const savedName = await f.page.locator('.doc-tab input').inputValue() + '.bcad';
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(savedName, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const saved = Buffer.from(await f.page.evaluate(async ([project, filename]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(filename)).getFile()).text();
  }, [project, savedName]));
  assert.deepEqual(JSON.parse(saved), sharp);
  f.report.files.push({ bytes: saved.length, sha256: sha256(saved) });
  await f.newPage();
  await open(sharp, saved);
  await check('stored-saved-fresh-open', sharp, 2.5);
  await f.snapshot('07-stored-fresh-open');
}

function smallInset(doc) {
  const point = ([x, y]) => [9990 + x / 40, 9990 + y / 40];
  const [source, ...rest] = doc.nodes;
  return { ...doc, nodes: [{ ...source, segments: source.segments.map(segment => ({
    ...segment, start: point(segment.start),
    ...(segment.kind === 'arc' ? { center: point(segment.center) } : {}),
  })) }, ...rest] };
}

async function verifyInsetRefusals(candidate, check) {
  const rounded = candidate(1), sharp = candidate(2.5);
  await open(rounded);
  await f.openFeatureEditor(2);
  await f.editor().getByRole('spinbutton', { name: 'Inset distance', exact: true }).fill('2.5');
  await button(f.editor(), 'Apply').click();
  await f.changed(rounded);
  await f.undo();
  await f.same(rounded);
  await f.page.locator('.ol-row button.ol[title="Double-click to rename"]').click();
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies[0] === 0);
  const before = await f.snapshot('00-accepted-with-redo');
  assert.deepEqual(before.historyControls, [false, false]);
  const unchanged = after => {
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection', 'title']) assert.deepEqual(after[key], before[key], key);
  };
  const refusal = async (label, change, reason) => {
    f.phase = label;
    const bad = structuredClone(sharp);
    change(bad);
    await chooseFile(bad, label + '.bcad');
    const notice = await f.waitToast(reason);
    unchanged(await f.snapshot(label));
    f.report.observations.push({ label, notice });
    await f.dismissToasts();
  };
  await refusal('01-missing-source', doc => doc.nodes.shift(), /stored recipe is malformed/i);
  await refusal('02-self-reference', doc => { doc.nodes[1].sourceSketch = 1; doc.nodes[1].sourceFeature = 'n1'; }, /stored recipe is malformed/i);
  await refusal('03-forward-reference', doc => { doc.nodes[1].sourceSketch = 2; doc.nodes[1].sourceFeature = 'n2'; }, /stored recipe is malformed/i);
  await refusal('04-duplicate-source-id', doc => { doc.nodes[2].id = 'n0'; }, /distinct explicit feature ID/i);
  await refusal('05-compound-source', doc => { doc.nodes[0].regions = [doc.nodes[0].segments]; }, /standalone numeric XY/i);
  await refusal('06-direct-arc-dependent', doc => {
    doc.nodes.push({ kind: 'chamfer', id: 'n3', parent: { node: 2, side: 'solid' }, distance: 0.2, edges: ['n2.side[e10]|n2.top'] });
  }, /e10.*retired inset side/i);
  await refusal('07-nested-inset-dependent', doc => {
    doc.nodes.push({ ...doc.nodes[1], id: 'n3', sourceSketch: 1, sourceFeature: 'n1' });
  }, /only one direct Extrude/i);
  await refusal('08-unsupported-constraint', doc => {
    doc.nodes[0].outline = { rules: [{ kind: 'coincident', point: 0, arc: 1 }] };
  }, /stored Round outline.*must match/i);
  await refusal('09-zero-distance', doc => { doc.nodes[1].insetMM = 0; }, /stored recipe is malformed/i);
  await refusal('10-reversed-arc', doc => { doc.nodes[0].segments[1].direction = 'cw'; }, /alternating native straight sides and CCW/i);
  await refusal('11-disconnected-source', doc => { doc.nodes[0].segments[2].start[1] += 0.5; }, /same source circle/i);
  await refusal('12-ambiguous-output', doc => { doc.outputs.b0 = { node: 0, side: 'solid' }; }, /stored output/i);
  await refusal('13-concave-source', doc => {
    const source = doc.nodes[0];
    source.segments = [[0, 0], [20, 0], [20, 4], [8, 4], [8, 10], [0, 10]].map(start => ({ kind: 'line', start }));
  }, /eight alternating native straight sides and CCW/i);
  await refusal('14-crossing-source', doc => {
    const source = doc.nodes[0];
    source.segments = [[0, 0], [20, 10], [0, 10], [20, 0]].map(start => ({ kind: 'line', start }));
  }, /eight alternating native straight sides and CCW/i);
  await refusal('15-mismatched-tangency', doc => { doc.nodes[0].segments[1].center = [17.75, 2.25]; }, /CCW tangent rounded rectangle/i);
  f.phase = 'Delete a body with a live linked source';
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Delete');
  await f.waitToast(/deleting a feature in this stored recipe document is not supported/i);
  await f.ready();
  unchanged(await f.snapshot('16-linked-delete-refused'));
  await f.dismissToasts();
  await f.redo();
  await check('17-redo-after-refusals', sharp, 2.5);
  await f.undo();
  await check('18-undo-after-refusals', rounded, 1);
}

function holdInsetCheck() {
  const worker = Worker.prototype, send = worker.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'verifyStoredInsets') {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && target.id === event.data?.id) {
          held = event.data;
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__holdInset = {
    arm() { armed = true; held = undefined; },
    held: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

async function verifyInsetEdits(stock, candidate, check) {
  const editor = () => f.editor().getByRole('spinbutton', { name: 'Inset distance', exact: true });
  const openEditor = async expected => {
    await f.openFeatureEditor(2, 'rounded inset Extrude');
    assert.deepEqual(await f.editorFields(), [
      { label: 'Source width', value: String(expected === 0.005 ? 0.5 : 20), disabled: false },
      { label: 'Inset distance', value: String(expected), disabled: false },
    ]);
    assert.equal(await button(f.editor(), 'Edit sketch').count(), 0);
    assert.equal(await button(f.editor(), 'Delete feature').count(), 0);
  };
  const apply = async distance => {
    f.phase = 'Apply inset distance ' + distance;
    await editor().fill(String(distance));
    await button(f.editor(), 'Apply').click();
  };
  const selected = async () => {
    await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
    assert.deepEqual((await f.page.evaluate(() => window.__studioSelection.selection)).bodies, [0]);
  };
  const valid = async (from, to, label) => {
    await openEditor(from);
    await apply(to);
    await check(label, candidate(to), to);
    await f.editor().waitFor({ state: 'hidden' });
    await selected();
    await f.snapshot(label);
  };
  const unchanged = (after, before) => {
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection', 'title']) assert.deepEqual(after[key], before[key], key);
  };
  const refuse = async (distance, reason, label) => {
    const before = await f.snapshot(label + '-before');
    await apply(distance);
    await f.waitToast(reason);
    await f.ready();
    unchanged(await f.snapshot(label), before);
    await f.dismissToasts();
    await f.closeEditor();
  };
  await open(candidate(1));
  await f.page.locator('.ol-row button.ol[title="Double-click to rename"]').click();
  await selected();
  await check('01-open-rounded', candidate(1), 1);
  await openEditor(1);
  const beforeBlank = await f.snapshot('02-editor');
  await editor().fill('2');
  await editor().fill('');
  assert.ok(await button(f.editor(), 'Apply').isDisabled());
  await editor().press('Enter');
  unchanged(await f.snapshot('03-blank-retains-part'), beforeBlank);
  await button(f.editor(), 'Reset').click();
  assert.equal(await editor().inputValue(), '1');
  await f.closeEditor();
  await valid(1, 2, '04-exact-corner-collapse');
  await valid(2, 2.5, '05-sharp-inset');
  await f.undo();
  await check('06-undo-to-collapse', candidate(2), 2);
  await openEditor(2);
  await refuse(1.995, /minimum offset radius/i, '07-floor-refused');
  await openEditor(2);
  await refuse(5, /closes the rectangle/i, '08-closure-refused');
  await f.redo();
  await check('09-redo-sharp', candidate(2.5), 2.5);
  const saved = await save(candidate(2.5));
  await f.newPage();
  await open(candidate(2.5), saved);
  await check('10-saved-sharp-fresh-open', candidate(2.5), 2.5);
  await f.page.locator('.ol-row button.ol[title="Double-click to rename"]').click();
  await valid(2.5, 1, '11-restored-arc-identities');
  await f.undo();
  await check('12-undo-to-saved-sharp', candidate(2.5), 2.5);
  await f.redo();
  await check('13-redo-to-restored', candidate(1), 1);

  f.phase = 'Open a small translated inset for a native-only refusal';
  await open(smallInset(candidate(0.005)));
  await openEditor(0.005);
  await refuse(0.02, /loop encloses no area/i, '14-native-only-refused');

  f.phase = 'Replace the document while a valid inset reply is held';
  await open(candidate(1));
  await openEditor(1);
  await f.page.evaluate(() => window.__holdInset.arm());
  await apply(2.5);
  await f.page.waitForFunction(() => window.__holdInset.held()?.ok === true);
  await open(stock);
  const replacement = await f.snapshot('15-replacement-before-late-reply');
  await f.page.evaluate(() => window.__holdInset.release());
  const after = await f.snapshot('16-replacement-after-late-reply');
  unchanged(after, replacement);
  assert.deepEqual(after.notices, replacement.notices);
}

async function verifyInsetDetach(candidate, check) {
  const outline = '.ol-row button.ol[title="Double-click to rename"]';
  const openEditor = () => f.openFeatureEditor(2, 'rounded inset Extrude');
  const detach = () => button(f.editor(), 'Detach inset');
  let last;
  for (const [label, distance] of [['rounded', 1], ['sharp', 2.5]]) {
    f.phase = 'Open the ' + label + ' inset before detach';
    const linked = candidate(distance);
    await open(linked);
    const native = await check(label + '-linked', linked, distance);
    const lowered = await f.inspect(label + '-linked-lowering', linked, 'lowered');
    await f.page.locator(outline).click();
    await openEditor();
    if (distance === 1) {
      await f.editor().getByRole('spinbutton', { name: 'Inset distance', exact: true }).fill('2');
      assert.ok(await detach().isDisabled());
      await button(f.editor(), 'Reset').click();
    }
    await f.snapshot(label + '-before-detach');
    f.phase = 'Detach the ' + label + ' inset';
    await detach().click();
    await f.changed(linked);
    await f.editor().waitFor({ state: 'hidden' });
    const detached = await f.doc();
    const sketch = detached.nodes[1];
    assert.deepEqual(detached, { ...linked, nodes: [linked.nodes[0], sketch, linked.nodes[2]] });
    assert.equal(sketch.kind, 'sketch');
    assert.equal(sketch.id, linked.nodes[1].id);
    assert.ok(!('association' in sketch) && !('sideMap' in sketch));
    assert.deepEqual(await check(label + '-detached', detached, distance), native);
    assert.deepEqual(await f.inspect(label + '-detached-lowering', detached, 'lowered'), lowered);
    assert.deepEqual((await f.page.evaluate(() => window.__studioSelection.selection)).bodies, [0]);
    await f.snapshot(label + '-after-detach');

    await f.undo();
    assert.deepEqual(await check(label + '-undo-restores-link', linked, distance), native);
    await openEditor();
    await detach().waitFor();
    await f.closeEditor();
    await f.redo();
    assert.deepEqual(await check(label + '-redo-detaches', detached, distance), native);
    await openEditor();
    assert.equal(await detach().count(), 0);
    await button(f.editor(), 'Edit sketch').waitFor();
    await f.closeEditor();
    last = { detached, native, distance };
  }
  const saved = await save(last.detached);
  await f.newPage();
  await open(last.detached, saved);
  assert.deepEqual(await check('detached-fresh-open', last.detached, last.distance), last.native);
  await openEditor();
  assert.equal(await detach().count(), 0);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.finishSketch('detached-sketch-editable');
  await f.same(last.detached);
}

async function verifyInsetAuthoring(stock, candidate, check) {
  const source = { ...stock, nodes: [stock.nodes[0]], outputs: {}, nextId: 1 };
  f.phase = 'Open only the finished source sketch';
  await open(source);
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  const sketch = browser.getByRole('button', { name: 'Sketch 1', exact: true });
  await sketch.click();
  await f.page.waitForFunction(() => window.__studioSelection?.selection.sketches?.includes(0));
  await f.snapshot('01-selected-source');

  f.phase = 'Start Linked inset extrude from Create';
  await button(f.page, 'Create').click();
  await button(f.page, 'Linked inset extrude').click();
  const hud = f.page.getByRole('dialog', { name: 'Linked inset extrude', exact: true });
  const inset = hud.getByRole('spinbutton', { name: 'Inset distance', exact: true });
  const height = hud.getByRole('spinbutton', { name: 'Extrude distance', exact: true });
  const apply = button(hud, 'Apply');
  await inset.fill('5');
  await hud.getByText(/closes the rectangle/i).waitFor({ state: 'attached' });
  assert.ok(await apply.isDisabled());
  assert.deepEqual(await f.doc(), source);
  assert.deepEqual((await f.bodies()).bodies, []);
  await f.snapshot('02-refused-creation');

  f.phase = 'Apply one linked inset and Extrude';
  await inset.fill('2.5');
  assert.equal(await height.inputValue(), '10');
  await hud.getByText('preview', { exact: true }).waitFor();
  await apply.click();
  const actual = await f.changed(source).then(() => f.doc());
  const expected = candidate(2.5);
  assert.deepEqual(actual, expected);
  await check('03-created-sharp', actual, 2.5);
  await f.snapshot('03-created-sharp');
  await f.undo();
  await f.same(source);
  assert.deepEqual((await f.bodies()).bodies, []);
  await f.snapshot('04-single-undo');
  await f.redo();
  await check('05-single-redo', actual, 2.5);
  const saved = await save(actual);
  await f.newPage();
  await open(actual, saved);
  await check('06-authored-fresh-open', actual, 2.5);
  await f.snapshot('06-authored-fresh-open');
}

async function drawInsetSource() {
  const blank = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
  await open(blank);
  await button(f.page.getByRole('group', { name: 'Model commands', exact: true }), 'Sketch').click();
  const panel = f.sketchPanel();
  await panel.waitFor();
  await f.frame([[0, 0], [20, 10]]);
  await f.worldClick([0, 0]);
  await f.worldClick([20, 10]);
  await f.tool('Select', 's');
  await f.page.mouse.move(310, 570);
  await f.page.mouse.wheel(0, -800);
  await f.page.waitForTimeout(450);
  await f.frame([[0, 0], [20, 10]]);
  const round = panel.getByRole('group', { name: 'Round the corner', exact: true });
  for (const [index, corner] of [[0, 0], [20, 0], [20, 10], [0, 10]].entries()) {
    f.phase = 'Round corner ' + (index + 1);
    await f.worldClick(corner);
    await round.getByLabel('Corner radius', { exact: true }).fill('2');
    await button(round, 'Round the corner').click();
    await f.snapshot('round-' + (index + 1));
  }
  f.phase = 'Finish the drawn rounded source';
  const { doc } = await f.finishSketch('drawn-source');
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.nodes[0].segments.length, 8);
  assert.equal(doc.nodes[0].segments.filter(segment => segment.kind === 'arc').length, 4);
  assert.ok(doc.nodes[0].outline);
  f.report.observations.push({ label: 'drawn-rounded-source', source: doc.nodes[0] });
  return doc;
}

async function verifyDrawnInset(source) {
  const [sketch] = source.nodes;
  assert.equal(sketch.segments[0].kind, 'arc');
  assert.deepEqual(sketch.outline.hv, { h: [1, 5], v: [3, 7] });
  assert.deepEqual(sketch.outline.radii, { 0: 2, 2: 2, 4: 2, 6: 2 });
  const sideMap = Object.fromEntries(sketch.sideTags.outer.map((id, i) => [id, derivedIds[i]]));
  const expected = distance => ({ ...source, nodes: [sketch,
    { kind: 'rounded-rectangle-inset', version: 1, sourceSketch: 0, sourceFeature: 'n0', insetMM: distance, sideMap, id: 'n1' },
    { kind: 'extrude', sketch: 1, height: 10, id: 'n2' }], outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3 });
  const check = async (label, distance) => {
    const doc = expected(distance);
    const actual = await f.doc();
    assert.deepEqual(actual, doc);
    await f.ready();
    const native = await f.inspect(label, actual);
    const r = Math.max(2 - distance, 0);
    const volume = stockVolume - 10 * area(20 - 2 * distance, 10 - 2 * distance, r);
    close(native.volume, volume);
    close((await f.bodies()).bodies[0].volume, volume);
    assert.equal(native.cylinders.length, r > 0 ? 8 : 4);
    assert.equal(native.faces.length, r > 0 ? 18 : 14);
    for (const [i, id] of sketch.sideTags.outer.entries()) {
      assert.ok(native.faces.includes(`n2.side[${id}]`), id);
      assert.equal(native.faces.includes(`n2.side[${sideMap[id]}]`), r > 0 || sketch.segments[i].kind === 'line', sideMap[id]);
    }
    f.report.observations.push({ label, distance, volume: native.volume, expectedVolume: volume });
    await f.snapshot(label);
  };
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  await browser.getByRole('button', { name: 'Sketch 1', exact: true }).click();
  f.phase = 'Create linked inset from the drawn sketch';
  await button(f.page, 'Create').click();
  await button(f.page, 'Linked inset extrude').click();
  const hud = f.page.getByRole('dialog', { name: 'Linked inset extrude', exact: true });
  await hud.getByText('preview', { exact: true }).waitFor();
  await button(hud, 'Apply').click();
  await f.changed(source);
  await check('drawn-linked-rounded', 1);
  await f.openFeatureEditor(2);
  await f.editor().getByRole('spinbutton', { name: 'Inset distance', exact: true }).fill('2.5');
  await button(f.editor(), 'Apply').click();
  await f.changed(expected(1));
  await check('drawn-linked-sharp', 2.5);
  if (detachedSourceEdit) {
    await verifyDetachedSourceEdit(expected(2.5));
    return;
  }
  if (widthInset) {
    await verifySourceWidth(expected(2.5));
    return;
  }
  await f.undo();
  await check('drawn-undo-rounded', 1);
  await f.redo();
  await f.changed(expected(1));
  await check('drawn-redo-sharp', 2.5);
  const saved = await save(expected(2.5));
  await f.newPage();
  await chooseFile(expected(2.5), name, saved);
  await f.changed(source);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes[1]?.kind === 'rounded-rectangle-inset');
  await check('drawn-sharp-fresh-open', 2.5);
  const damaged = structuredClone(expected(2.5));
  damaged.nodes[0].outline.radii[0] = 3;
  await chooseFile(damaged, 'inconsistent-round-outline.bcad');
  await f.waitToast(/stored Round outline.*must match/i);
  await check('drawn-outline-mismatch-refused', 2.5);
}

async function verifySourceWidth(original) {
  const editor = () => f.editor().getByRole('spinbutton', { name: 'Source width', exact: true });
  const applyWidth = async width => {
    f.phase = 'Apply source width ' + width;
    await f.openFeatureEditor(2);
    await editor().fill(String(width));
    await button(f.editor(), 'Apply').click();
  };
  const expectGeometry = async (label, doc, width) => {
    await f.same(doc);
    const native = await f.inspect(label, doc);
    const volume = 10 * (area(width, 10, 2) - area(width - 5, 5, 0));
    close(native.volume, volume);
    close((await f.bodies()).bodies[0].volume, volume);
    assert.equal(native.faces.length, 14);
    assert.equal(native.cylinders.length, 4);
    const [source, recipe] = doc.nodes;
    for (const [i, [cx, cy]] of [[2, 2], [width - 2, 2], [width - 2, 8], [2, 8]].entries()) {
      const tag = source.sideTags.outer[i * 2];
      const cylinder = native.cylinders.find(c => c.name === `n2.side[${tag}]`);
      assert.ok(cylinder, tag);
      close(cylinder.r, 2);
      close(cylinder.c[0], cx);
      close(cylinder.c[1], cy);
    }
    for (const [i, id] of source.sideTags.outer.entries()) {
      assert.equal(native.faces.includes(`n2.side[${recipe.sideMap[id]}]`), i % 2 === 1);
    }
    for (const z of [0, 10]) for (const [x, y] of [[2.5, 2.5], [width - 2.5, 2.5], [width - 2.5, 7.5], [2.5, 7.5]]) {
      assert.ok(native.vertices.some(vertex => Math.hypot(vertex[0] - x, vertex[1] - y, vertex[2] - z) < 1e-8), `${x},${y},${z}`);
    }
    f.report.observations.push({ label, width, volume: native.volume, expectedVolume: volume });
    await f.snapshot(label);
  };
  const wider = structuredClone(original), [source] = wider.nodes;
  for (const [i, x] of [[2, 22], [3, 24], [4, 24], [5, 22]]) source.segments[i].start[0] = source.outline.points[i][0] = x;
  for (const i of [2, 4]) source.segments[i].center[0] = 22;

  await applyWidth(24);
  await f.changed(original);
  await expectGeometry('width-24', wider, 24);
  await f.undo();
  await expectGeometry('width-undo-20', original, 20);

  await f.openFeatureEditor(2);
  const before = await f.snapshot('width-before-refusal');
  await editor().fill('5');
  await button(f.editor(), 'Apply').click();
  await f.waitToast(/closes the rectangle/i);
  await f.ready();
  const after = await f.snapshot('width-5-refused');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection', 'title']) assert.deepEqual(after[key], before[key], key);
  await f.dismissToasts();
  await f.closeEditor();
  await f.redo();
  await expectGeometry('width-redo-24', wider, 24);
  const saved = await save(wider);
  await f.newPage();
  await open(wider, saved);
  await expectGeometry('width-24-fresh-open', wider, 24);
  await applyWidth(20);
  await f.changed(wider);
  await expectGeometry('width-post-open-20', original, 20);
}

async function verifyDetachedSourceEdit(linked) {
  await f.openFeatureEditor(2);
  await button(f.editor(), 'Detach inset').click();
  await f.changed(linked);
  await f.editor().waitFor({ state: 'hidden' });
  const detached = await f.doc();
  const solid = await f.inspect('detached-original-solid', detached);
  close(solid.volume, stockVolume - 750);
  const accepted = await f.bodies();

  f.phase = 'Edit the former source independently';
  const history = f.page.getByRole('group', { name: 'History', exact: true });
  await button(history, 'Sketch · outline').click();
  await f.editor().waitFor();
  const radius = f.editor().getByRole('spinbutton', { name: 'Radius of arc 1', exact: true });
  assert.equal(await radius.inputValue(), '2');
  await radius.fill('2.25');
  await button(f.editor(), 'Apply').click();
  await f.changed(detached);
  const edited = await f.doc();
  assert.equal(edited.nodes[0].outline.radii[0], 2.25);
  assert.notDeepEqual(edited.nodes[0].segments, detached.nodes[0].segments);
  assert.equal(edited.nodes[0].id, detached.nodes[0].id);
  assert.deepEqual(edited.nodes[0].sideTags, detached.nodes[0].sideTags);
  assert.deepEqual(edited, { ...detached, nodes: [edited.nodes[0], ...detached.nodes.slice(1)] });
  assert.deepEqual(await f.inspect('detached-after-source-edit', edited), solid);
  assert.deepEqual(await f.bodies(), accepted);
  await f.snapshot('detached-source-radius-edited');

  await f.undo();
  await f.same(detached);
  await f.undo();
  await f.same(linked);
  await f.redo();
  await f.same(detached);
  await f.redo();
  await f.same(edited);
  assert.deepEqual(await f.inspect('detached-after-redo', edited), solid);
  const saved = await save(edited);
  await f.newPage();
  await open(edited, saved);
  assert.deepEqual(await f.inspect('detached-edited-fresh-open', edited), solid);
  await f.snapshot('detached-edited-fresh-open');
  f.report.observations.push({ label: 'former-source-independent', radiusBefore: 2, radiusAfter: 2.25, solidVolumeMm3: solid.volume });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    if (editInset) await context.addInitScript(holdInsetCheck);
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(30000);
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
  if (drawnInset) {
    await verifyDrawnInset(await drawInsetSource());
    return;
  }
  if (storedInset) {
    await verifyStoredInset(stock);
    return;
  }
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
  if (nestedOffset) {
    const before = await f.snapshot('01-stock');
    await offset(1);
    const draft = await f.snapshot('02-ring-draft');
    assert.equal(draft.sketchCurves.length, 2);
    assert.deepEqual(draft.doc, before.doc);
    f.phase = 'refuse the third nested outline at Offset';
    await offset(0.5);
    const attempted = await f.snapshot('03-nested-offset-attempt');
    assert.equal(attempted.sketchCurves.length, 2, 'a rejected Offset leaves the two existing outlines');
    const refusal = await f.waitToast(/inside a hole/);
    f.report.observations.push({ label: 'nested-refusal', refusal });
    for (const key of ['doc', 'history', 'historyControls', 'dirty', 'sketchCurves']) assert.deepEqual(attempted[key], draft[key], key);
    await f.dismissToasts();
    await f.undo();
    const undone = await f.snapshot('04-one-undo-restores-stock');
    assert.deepEqual(undone.sketchCurves, before.sketchCurves);
    await f.redo();
    const redone = await f.snapshot('05-redo-restores-ring');
    assert.deepEqual(redone.sketchCurves, draft.sketchCurves);
    const ring = (await f.finishSketch('06-valid-ring')).doc;
    await checkRing('valid-ring-native', ring, stock);
    await f.undo();
    await f.same(stock);
    await f.redo();
    await f.same(ring);
    const bytes = await save(ring);
    await f.newPage();
    await open(ring, bytes);
    await checkRing('valid-ring-reopened-native', ring, stock);
    return;
  }
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
