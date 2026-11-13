import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { installD523PlacedReplyScheduler } from './placed-worker-reply-scheduler.mjs';

const mode = process.argv[3];
const fixed = mode === '--fixed';
const quarterTurn = mode === '--quarter-turn' || mode === '--quarter-turn-baseline';
const quarterTurnFixed = mode === '--quarter-turn';
const sourceRevision = mode === '--source-revision';
const lifecycle = mode === '--lifecycle';
const rotationLimits = mode === '--rotation-limits';

const pins = [
  'apps/cad-studio/test/placed-edge-snap-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/modelSketchSnaps.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
  ...(fixed || quarterTurn || sourceRevision || lifecycle || rotationLimits ? [
    'apps/cad-studio/src/viewport/placedBoxSnap.ts',
    'apps/cad-studio/src/viewport/placedSketchSnaps.ts',
    'apps/cad-studio/src/viewport/SceneViewport.tsx',
    'apps/cad-studio/test/placed-worker-reply-scheduler.mjs',
  ] : []),
  ...(sourceRevision || lifecycle ? ['packages/barocss-cad-model/src/assembly/definitions.ts'] : []),
];
const f = await createFlow({
  name: 'placed-edge-snap', output: process.argv[2],
  envFrozen: rotationLimits ? 'D1115_SOURCE_FROZEN' : lifecycle ? 'D885_SOURCE_FROZEN' : sourceRevision ? 'D884_SOURCE_FROZEN'
    : quarterTurn ? 'D883_SOURCE_FROZEN' : fixed ? 'D882_SOURCE_FROZEN' : 'D881_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: lifecycle ? 'Reject stale placed snaps after hiding, evaluation failure, removal, New and same-ID Open.'
    : sourceRevision ? 'Check placed snap ownership through an accepted source revision with the same occurrence and body keys.'
    : quarterTurn ? 'Check +90 degree Z placed box End and Middle against independent world coordinates.'
    : fixed ? 'Consume current translated box endpoints and midpoints with stale and hidden occurrence controls.'
    : 'Measure placed edge snap availability and the accepted root sketch coordinates.',
  limits: [lifecycle ? 'Native rectangular extrusions, one zero-height revision and same-ID desktop document replacement.'
    : sourceRevision ? 'One revised native box and one independent sibling in desktop Studio.'
    : quarterTurn
    ? 'A +90 degree Z box and an unrotated sibling sharing one native definition in desktop Studio.'
    : 'Two top-level static translated native boxes with a shared source and a separate native root box in desktop Studio.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { placedDoc } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const read = (part: typeof doc) => evaluateCadPart(toPartDocument(part)).outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, volume: massPropertiesOf(output).volume,
  corners: output.brep.vertices.map(vertex => vertex.point),
  edges: output.brep.edges.filter(edge => edge.curve.degree === 1 && edge.curve.controlPoints.length === 2)
    .map(edge => edge.vertices.map(id => output.brep.vertices.find(vertex => vertex.id === id)?.point)),
}));
console.log(JSON.stringify({ root: read(doc), placed: doc.instances.map(instance => ({
  id: instance.id, bodies: read(placedDoc(instance, doc)),
})) }));
`,
  snapshotExtra: () => ({
    snap: document.querySelector('.vp-overlay .sk-osnap text')?.textContent ?? null,
    occurrence: document.querySelector('.vp-overlay .sk-osnap')?.getAttribute('data-snap-occurrence') ?? null,
    instanceBounds: window.__studioInstanceBounds?.() ?? [],
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

const part = (min, max) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min, max, id: 'n0', sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } },
    { kind: 'extrude', sketch: 0, height: 6, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
});
const definition = part([0, 0], [20, 12]);
const root = part([-24.75, -9.5], [-4.75, 2.5]);
const instances = [
  { id: 'left', name: 'Left box', doc: definition, position: [10.25, 14.25, 0], rotation: [0, 0, 0] },
  { id: 'right', name: 'Right box', doc: definition, position: [55.75, 34.25, 0], rotation: [0, 0, 0] },
];
const source = { ...root, instances };
const endAt = [10.25, 14.25], middleAt = [65.75, 34.25];
const firstPointer = [10.30, 14.30], secondPointer = [65.79, 34.30];
const expectedGrid = [[10, 14], [66, 34]];
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const cue = () => f.page.locator('.vp-overlay .sk-osnap text');
const close = (p, q) => p.length === q.length && Math.hypot(...p.map((value, i) => value - q[i])) < 1e-8;

function checkBox(body, lo, hi, volume) {
  assert.equal(body.valid, true);
  assert.ok(Math.abs(body.volume - volume) < 1e-8);
  assert.equal(body.corners.length, 8);
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    assert.ok(body.corners.some(p => close(p, [x, y, z])), [x, y, z]);
  }
}

function checkInstances(read) {
  assert.deepEqual(read.map(item => item.id), instances.map(instance => instance.id));
  for (const [i, placed] of read.entries()) {
    assert.equal(placed.bodies.length, 1);
    const [body] = placed.bodies;
    const [x, y, z] = instances[i].position;
    checkBox(body, [x, y, z], [x + 20, y + 12, z + 6], 1440);
    const witness = [[x, y, z], [x + 20, y, z]];
    assert.ok(body.edges.some(edge => witness.every(p => edge.some(q => close(p, q)))));
  }
}

async function pixel(point, height = 0) {
  const p = await f.page.evaluate(world => {
    const at = window.__studioScreenOf(world);
    return at && document.elementFromPoint(...at)?.closest('canvas.vp-canvas') ? at : null;
  }, [...point, height]);
  assert.ok(p, point);
  return p;
}

async function hover(point, expected, occurrence = null, height = 0) {
  const p = await pixel(point, height);
  await f.page.mouse.move(...p);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (expected) {
    await cue().waitFor();
    assert.equal(await cue().textContent(), expected);
    assert.equal(await f.page.locator('.vp-overlay .sk-osnap').getAttribute('data-snap-occurrence'), occurrence);
  } else await cue().waitFor({ state: 'hidden' });
  return p;
}

async function markAt(point) {
  const expected = await pixel(point);
  const actual = await f.page.locator('.vp-overlay .sk-osnap').evaluate(mark => {
    const symbol = mark.firstElementChild, rect = mark.closest('svg').getBoundingClientRect();
    if (symbol instanceof SVGPolygonElement) {
      const apex = symbol.points.getItem(0);
      return [rect.left + apex.x, rect.top + apex.y + 7];
    }
    const { x, y, width, height } = symbol.getBBox();
    return [rect.left + x + width / 2, rect.top + y + height / 2];
  });
  assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.02, JSON.stringify({ actual, expected }));
}

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D881-placed-snap.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().length === 2);
}

async function begin() {
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
}

async function draftCorner() {
  return Promise.all(['x', 'y'].map(async axis =>
    Number(await f.sketchPanel().locator(`#sk-${axis}`).inputValue())));
}

async function cancel() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
}

async function save(doc) {
  const file = 'D881-placed-snap.bcad', project = 'D882 placed snaps';
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

async function occurrenceControls() {
  await f.page.locator('.ol.instance').filter({ hasText: 'Left box' }).first().click();
  const panel = f.page.getByRole('complementary', { name: 'Instance', exact: true });
  await panel.waitFor();
  return panel;
}

async function movedOccurrence(solid) {
  f.phase = 'hold the genuine Worker reply after a public left placement edit';
  const panel = await occurrenceControls();
  await f.page.evaluate(() => window.__d523Placed.arm({ onlyPlaced: true }));
  const field = panel.getByLabel('Instance X', { exact: true }).first();
  await field.fill('35.25');
  await field.press('Enter');
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].position[0] === 35.25);
  await f.page.waitForFunction(() => {
    const run = window.__d523Placed.snapshot();
    return run.claimed && run.events.some(event => event.kind === 'native-event-held' && event.id === run.claimed.id && event.resultOK);
  });
  const claim = await f.page.evaluate(() => {
    const run = window.__d523Placed.snapshot();
    return { id: run.claimed.id, translation: run.claimed.place.t, held: run.events.some(e => e.kind === 'native-event-held' && e.id === run.claimed.id && e.resultOK) };
  });
  assert.deepEqual(claim.translation, [35.25, 14.25, 0]);
  assert.equal(claim.held, true);
  f.report.observations.push({ label: 'held-original-placed-worker-reply', ...claim });
  const moved = await f.doc();
  assert.deepEqual(moved.instances[1], solid.instances[1]);
  assert.deepEqual(moved.nodes, solid.nodes);
  await f.ready();
  const newPointer = [35.30, 14.30];
  await begin();
  await f.frame([firstPointer, newPointer, secondPointer]);
  await hover(firstPointer, null);
  await hover(newPointer, null);
  await hover(secondPointer, 'Middle', 'right');
  const pending = await f.snapshot('08-pending-left-keeps-only-current-right');
  assert.equal(pending.instanceBounds.find(item => item.id === 'left')?.min[0], 10.25);
  await f.page.mouse.click(...await hover(firstPointer, null));
  const pendingCorner = await draftCorner();
  assert.deepEqual(pendingCorner, expectedGrid[0]);
  await f.same(moved);
  f.report.observations.push({ label: 'pending-left-grid-corner', at: pendingCorner });
  await cancel();
  await begin();
  await f.frame([firstPointer, newPointer, secondPointer]);
  await f.page.evaluate(() => window.__d523Placed.release());
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().find(item => item.id === 'left')?.min[0] === 35.25);
  await hover(firstPointer, null);
  await hover(newPointer, 'End', 'left');
  await hover(secondPointer, 'Middle', 'right');
  await f.snapshot('09-current-left-replaces-old-source');

  f.phase = 'consume the moved endpoint while retaining the right midpoint';
  await f.page.mouse.click(...await hover(newPointer, 'End', 'left'));
  await f.page.mouse.click(...await hover(secondPointer, 'Middle', 'right'));
  const sketched = (await f.finishSketch('10-moved-left-consumer')).doc;
  assert.deepEqual(sketched.nodes.at(-1).min, [35.25, 14.25]);
  assert.deepEqual(sketched.nodes.at(-1).max, middleAt);
  assert.deepEqual(sketched.instances, moved.instances);
  await f.openExtrudeHud();
  const extruded = (await f.applyExtrude({ distance: 2, previous: sketched, label: '11-moved-left-consumer' })).doc;
  const result = await f.inspect('moved-native', extruded);
  checkBox(result.root.find(body => body.id === 'n3'), [35.25, 14.25, 0], [...middleAt, 2], 1220);
  assert.deepEqual(extruded.instances, moved.instances);
  assert.deepEqual(extruded.nodes.slice(0, 2), solid.nodes);

  f.phase = 'hide the left occurrence through its public panel';
  await button(await occurrenceControls(), 'Hide').click();
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].hidden === true);
  await f.ready();
  await begin();
  const leftMiddle = [45.30, 14.30], rightEnd = [55.80, 34.30];
  await f.frame([leftMiddle, rightEnd]);
  await hover(leftMiddle, null);
  await hover(rightEnd, 'End', 'right');
  await f.snapshot('12-hidden-left-keeps-current-right');
  await cancel();
}

async function checkRotationLimits() {
  const place = angle => ({ ...source, instances: [{ ...instances[0], rotation: [0, 0, angle] }, instances[1]] });
  const supportText = 'Placed box End and Middle snaps support exact 90° Z rotations.';
  const at = (angle, x) => [endAt[0] + x * Math.cos(angle * Math.PI / 180), endAt[1] + x * Math.sin(angle * Math.PI / 180)];
  await f.newPage();
  for (const angle of [89.999, 90]) {
    f.phase = 'compare placed snap support at ' + angle + ' degrees';
    const doc = place(angle);
    await open(doc);
    await begin();
    const end = at(angle, 20), middle = at(angle, 10);
    await f.frame([end, middle, middleAt]);
    await hover(end, angle === 90 ? 'End' : null, angle === 90 ? 'left' : null);
    await hover(middle, angle === 90 ? 'Middle' : null, angle === 90 ? 'left' : null);
    await hover(middleAt, 'Middle', 'right');
    const disclosure = f.sketchPanel().locator('details.sk-object-snaps');
    await disclosure.locator('summary').click();
    const support = disclosure.getByText(supportText, { exact: true });
    await f.snapshot('placed-rotation-' + angle);
    assert.equal(await support.isVisible(), angle === 89.999, 'the support limit must be visible only for the unsupported rotation');
    if (angle === 89.999) {
      const left = (await f.inspect('near-quarter-turn-native', doc)).placed[0].bodies[0];
      assert.ok(left.valid && Math.abs(left.volume - 1440) < 1e-8);
      assert.ok(left.corners.some(point => close(point, [...end, 0])));
    }
    await cancel();
    await f.same(doc);
  }
}

async function checkQuarterTurn() {
  const shared = part([0, 0], [10, 12]);
  const placed = [
    { ...instances[0], doc: shared, position: [20.25, 30.5, 0], rotation: [0, 0, 90] },
    { ...instances[1], doc: shared, position: [55.75, 54.25, 0] },
  ];
  const doc = { ...root, instances: placed };
  const fixture = Buffer.from(JSON.stringify(doc));
  const a = [20.25, 30.5], b = [20.25, 40.5], mid = [20.25, 35.5], siblingMid = [60.75, 54.25];
  const [aPointer, bPointer, midPointer, siblingPointer] = [a, b, mid, siblingMid].map(([x, y]) => [x + 0.05, y + 0.05]);
  const bounds = [
    { id: 'left', min: [8.25, 30.5, 0], max: [20.25, 40.5, 6] },
    { id: 'right', min: [55.75, 54.25, 0], max: [65.75, 66.25, 6] },
  ];
  f.phase = 'read the rotated native box and check the independent world edge';
  const original = await f.inspect('quarter-turn-source-native', doc);
  assert.equal(original.placed.length, 2);
  for (const [i, occurrence] of original.placed.entries()) {
    assert.equal(occurrence.id, bounds[i].id);
    assert.equal(occurrence.bodies.length, 1);
    checkBox(occurrence.bodies[0], bounds[i].min, bounds[i].max, 720);
  }
  assert.ok(original.placed[0].bodies[0].edges.some(edge => [a, b].every(p => edge.some(q => close([...p, 0], q)))));
  f.report.observations.push({ label: 'quarter-turn-fixture', bytes: fixture.length, sha256: sha256(fixture), localEdge: [[0, 0, 0], [10, 0, 0]], worldEdge: [a, b], worldMidpoint: mid });
  await f.newPage();
  await open(doc, fixture);
  const before = await f.snapshot('01-quarter-turn-boxes');
  assert.deepEqual(before.instanceBounds.map(({ id, min, max }) => ({ id, min, max })), bounds);

  f.phase = 'consume the rotated midpoint as a temporary Rectangle corner';
  const scenePoints = [[-24.75, -9.5], aPointer, bPointer, midPointer, siblingPointer];
  await begin();
  await f.frame(scenePoints);
  await hover([-24.70, -9.45], 'End');
  await hover(siblingPointer, 'Middle', 'right');
  await hover(bPointer, quarterTurnFixed ? 'End' : null, quarterTurnFixed ? 'left' : null);
  if (quarterTurnFixed) await markAt(b);
  await f.snapshot('02-quarter-turn-far-end');
  const middleHit = await hover(midPointer, quarterTurnFixed ? 'Middle' : null, quarterTurnFixed ? 'left' : null);
  if (quarterTurnFixed) await markAt(mid);
  await f.snapshot('03-quarter-turn-midpoint');
  await f.page.mouse.click(...middleHit);
  const middleCorner = await draftCorner();
  assert.deepEqual(middleCorner, quarterTurnFixed ? mid : [20, 36]);
  await f.same(doc);
  await cancel();

  f.phase = 'finish a root Rectangle from the rotated endpoint and sibling midpoint';
  await begin();
  await f.frame(scenePoints);
  const endHit = await hover(aPointer, quarterTurnFixed ? 'End' : null, quarterTurnFixed ? 'left' : null);
  if (quarterTurnFixed) await markAt(a);
  await f.snapshot('04-quarter-turn-near-end');
  await f.page.mouse.click(...endHit);
  await f.page.mouse.click(...await hover(siblingPointer, 'Middle', 'right'));
  const sketched = (await f.finishSketch('05-quarter-turn-rectangle')).doc;
  const min = quarterTurnFixed ? a : [20, 31], max = siblingMid;
  assert.deepEqual(sketched.nodes.at(-1).min, min);
  assert.deepEqual(sketched.nodes.at(-1).max, max);
  assert.deepEqual(sketched.nodes.slice(0, 2), root.nodes);
  assert.deepEqual(sketched.instances, placed);
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: sketched, label: '06-quarter-turn-consumer' })).doc;
  const result = await f.inspect('quarter-turn-consumer-native', solid);
  const volume = quarterTurnFixed ? 1923.75 : 1894.875;
  checkBox(result.root.find(body => body.id === 'n3'), [...min, 0], [...max, 2], volume);
  assert.deepEqual(result.placed, original.placed);
  assert.deepEqual(result.root.find(body => body.id === 'n1'), original.root[0]);
  assert.deepEqual(solid.instances, placed);
  assert.ok(Math.abs((await f.bodies()).bodies.find(body => body.key === 'b3').volume - volume) < 1e-8);
  f.report.observations.push({ label: 'quarter-turn-consumer', rootEnd: 'PASS', siblingMiddle: 'PASS', rotatedEnd: quarterTurnFixed ? 'PASS' : 'FAIL',
    rotatedMiddle: quarterTurnFixed ? 'PASS' : 'FAIL', storedMiddleMm: middleCorner, storedCornersMm: [min, max], volumeMm3: volume });
  if (quarterTurnFixed) {
    await f.undo();
    await f.same(sketched);
    await f.redo();
    await f.same(solid);
    const bytes = await save(solid);
    await f.newPage();
    await open(solid, bytes);
    assert.deepEqual(await f.inspect('quarter-turn-reopened-native', solid), result);
    await f.snapshot('07-quarter-turn-fresh-open');
  }
  assert.deepEqual(f.report.downloads, []);
}

async function checkSourceRevision() {
  const left = { ...instances[0], part: { id: 'left-definition', rev: 'A' } };
  const right = { ...instances[1], part: { id: 'right-definition', rev: 'A' } };
  const doc = { ...root, instances: [left, right] };
  const wider = part([0, 0], [34, 12]), file = 'left-revision-B.bcad';
  const bytes = Buffer.from(JSON.stringify(wider));
  const oldEnd = [30.25, 14.25], newEnd = [44.25, 14.25], newMid = [27.25, 14.25];
  const pointer = ([x, y]) => [x + 0.05, y + 0.05];
  const points = [[-24.75, -9.5], pointer(oldEnd), pointer(newEnd), pointer(newMid), secondPointer];
  const original = await f.inspect('revision-A-native', doc);
  checkInstances(original.placed);
  await f.newPage();
  await open(doc);
  f.report.observations.push({ label: 'revision-fixtures', assemblySHA256: sha256(Buffer.from(JSON.stringify(doc))),
    revisionBytes: bytes.length, revisionSHA256: sha256(bytes), oldEnd, newEnd, newMid });

  async function offer() {
    const panel = await occurrenceControls();
    await panel.getByLabel('New revision file', { exact: true }).setInputFiles({ name: file, mimeType: 'application/json', buffer: bytes });
    const waiting = panel.getByRole('status', { name: 'Revision waiting', exact: true });
    await button(waiting, 'Accept Rev B').waitFor();
    const pending = await f.doc();
    assert.deepEqual(pending.instances, [left, right]);
    assert.deepEqual(pending.nodes, doc.nodes);
    assert.deepEqual(pending.pendingParts['left-definition'].doc, wider);
    return { panel, waiting, pending };
  }

  f.phase = 'offer a new revision and keep the accepted A source';
  const { waiting, pending } = await offer();
  await begin();
  await f.frame(points);
  await hover(pointer(oldEnd), 'End', 'left');
  await markAt(oldEnd);
  await hover(pointer(newEnd), null);
  await hover(secondPointer, 'Middle', 'right');
  await f.same(pending);
  await f.snapshot('01-offered-revision-keeps-A-snaps');
  await cancel();
  await occurrenceControls();
  await button(waiting, 'Keep Rev A').click();
  await f.same(doc);

  f.phase = 'accept B while holding its genuine placed Worker reply';
  const offered = await offer();
  await f.page.evaluate(() => window.__d523Placed.arm({ onlyPlaced: true }));
  await button(offered.waiting, 'Accept Rev B').click();
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].part.rev === 'B');
  await f.page.waitForFunction(() => {
    const run = window.__d523Placed.snapshot();
    return run.claimed && run.events.some(event => event.kind === 'native-event-held' && event.id === run.claimed.id && event.resultOK);
  });
  const claim = await f.page.evaluate(() => {
    const run = window.__d523Placed.snapshot();
    return { id: run.claimed.id, translation: run.claimed.place.t };
  });
  assert.deepEqual(claim.translation, left.position);
  const revised = await f.doc();
  assert.deepEqual(revised.instances[0], { ...left, doc: wider, part: { ...left.part, rev: 'B', source: file } });
  assert.deepEqual(revised.instances[1], right);
  assert.deepEqual(revised.nodes, doc.nodes);
  assert.equal(revised.pendingParts, undefined);
  await f.ready();
  await begin();
  await f.frame(points);
  await hover(pointer(oldEnd), null);
  await hover(pointer(newEnd), null);
  await hover(secondPointer, 'Middle', 'right');
  const stale = await f.snapshot('02-accepted-B-with-A-mesh-still-visible');
  assert.equal(stale.instanceBounds.find(item => item.id === 'left')?.max[0], oldEnd[0]);
  await f.page.mouse.click(...await hover(pointer(oldEnd), null));
  const pendingCorner = await draftCorner();
  assert.deepEqual(pendingCorner, [30, 14]);
  await f.same(revised);
  f.report.observations.push({ label: 'held-revision-B-worker-reply', ...claim, oldDisplayedEnd: oldEnd, pendingCorner });
  await cancel();

  f.phase = 'release B and consume only its current coordinates';
  await f.page.evaluate(() => window.__d523Placed.release());
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().find(item => item.id === 'left')?.max[0] === 44.25);
  await begin();
  await f.frame(points);
  await hover(pointer(oldEnd), null);
  await hover(pointer(newMid), 'Middle', 'left');
  await markAt(newMid);
  await f.snapshot('03-revision-B-middle');
  const first = await hover(pointer(newEnd), 'End', 'left');
  await markAt(newEnd);
  await f.snapshot('04-revision-B-end');
  await f.page.mouse.click(...first);
  await f.page.mouse.click(...await hover(secondPointer, 'Middle', 'right'));
  const sketched = (await f.finishSketch('05-revision-B-rectangle')).doc;
  assert.deepEqual(sketched.nodes.at(-1).min, newEnd);
  assert.deepEqual(sketched.nodes.at(-1).max, middleAt);
  assert.deepEqual(sketched.instances, revised.instances);
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: sketched, label: '06-revision-B-consumer' })).doc;
  const result = await f.inspect('revision-B-native', solid);
  checkBox(result.placed[0].bodies[0], left.position, [44.25, 26.25, 6], 2448);
  assert.deepEqual(result.placed[1], original.placed[1]);
  assert.deepEqual(result.root.find(body => body.id === 'n1'), original.root[0]);
  checkBox(result.root.find(body => body.id === 'n3'), [...newEnd, 0], [...middleAt, 2], 860);
  assert.deepEqual(solid.instances, revised.instances);
  f.report.observations.push({ label: 'revision-B-consumer', storedCornersMm: [newEnd, middleAt], volumeMm3: 860 });
  await f.undo();
  await f.same(sketched);
  await f.redo();
  await f.same(solid);
  const saved = await save(solid);
  await f.newPage();
  await open(solid, saved);
  assert.deepEqual(await f.inspect('revision-B-reopened-native', solid), result);
  await f.snapshot('07-revision-B-fresh-open');
  assert.deepEqual(f.report.downloads, []);
}

async function checkLifecycle() {
  const left = { ...instances[0], part: { id: 'left-definition', rev: 'A' } };
  const right = { ...instances[1], part: { id: 'right-definition', rev: 'A' } };
  const doc = { ...root, instances: [left, right] };
  const invalid = { ...definition, nodes: [definition.nodes[0], { ...definition.nodes[1], height: 0 }] };
  const replacementEnd = [35.25, 14.25], replacementPointer = [35.30, 14.30];
  const replacement = { ...doc, instances: [{ ...left, position: [...replacementEnd, 0] }, right] };
  const points = [[-24.75, -9.5], firstPointer, replacementPointer, secondPointer];
  await f.newPage();
  await open(doc);

  f.phase = 'hide the body of one occurrence through its Appearance Details';
  await begin();
  await f.frame(points);
  await hover(firstPointer, 'End', 'left');
  await hover(secondPointer, 'Middle', 'right');
  await cancel();
  const appearance = (await occurrenceControls()).getByRole('group', { name: 'Appearance (this occurrence)', exact: true });
  await button(appearance, 'Details').click();
  await appearance.getByRole('checkbox', { name: 'Visible', exact: true }).uncheck();
  await f.changed(doc);
  const hidden = await f.doc();
  assert.equal(hidden.instances[0].looks.b1.hidden, true);
  assert.equal(hidden.instances[0].hidden, undefined);
  assert.deepEqual(hidden.instances[1], right);
  await begin();
  await f.frame(points);
  await hover(firstPointer, null);
  await hover(secondPointer, 'Middle', 'right');
  await f.snapshot('01-hidden-body-only');
  await cancel();
  await f.undo();
  await f.same(doc);

  f.phase = 'hold an original failed placed Worker reply for an accepted revision';
  const panel = await occurrenceControls();
  await panel.getByLabel('New revision file', { exact: true }).setInputFiles({
    name: 'zero-height-revision.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)),
  });
  const waiting = panel.getByRole('status', { name: 'Revision waiting', exact: true });
  await button(waiting, 'Accept Rev B').waitFor();
  const offered = await f.doc();
  assert.deepEqual(offered.pendingParts['left-definition'].doc, invalid);
  await f.page.evaluate(() => window.__d523Placed.arm({ onlyPlaced: true }));
  await button(waiting, 'Accept Rev B').click();
  await f.page.waitForFunction(() => window.__studioDoc.instances[0].part.rev === 'B');
  const bad = await f.doc();
  assert.deepEqual(bad.instances[0].doc, invalid);
  assert.deepEqual(bad.instances[1], right);
  const failure = await (await f.page.waitForFunction(() => {
    const { claimed, events } = window.__d523Placed.snapshot();
    return claimed && events.find(event => event.kind === 'native-event-held' && event.key === claimed.key && event.id === claimed.id);
  })).jsonValue();
  assert.equal(failure.resultOK, false);
  assert.match(failure.errorDetail, /height must not be zero/i);
  await begin();
  await f.frame(points);
  await hover(firstPointer, null);
  await hover(secondPointer, 'Middle', 'right');
  const pending = await f.snapshot('02-failed-reply-pending-old-mesh');
  assert.equal(pending.instanceBounds.find(item => item.id === 'left')?.min[0], 10.25);
  await f.page.evaluate(() => window.__d523Placed.release());
  assert.ok(await f.page.evaluate(({ key, id }) => window.__d523Placed.snapshot().events.some(event =>
    event.kind === 'client-callback-reached' && event.delivery === 'held-original-event' && event.key === key && event.id === id), failure));
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().map(item => item.id).join(',') === 'right');
  await hover(firstPointer, null);
  await hover(secondPointer, 'Middle', 'right');
  await f.page.mouse.click(...await hover(firstPointer, null));
  const failedCorner = await draftCorner();
  assert.deepEqual(failedCorner, expectedGrid[0]);
  await f.same(bad);
  await f.snapshot('03-failed-reply-grid-corner');
  f.report.observations.push({ label: 'failed-native-reply', ...failure, gridCorner: failedCorner });
  await cancel();
  await f.undo();
  await f.same(offered);
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().some(item => item.id === 'left' && item.min[0] === 10.25));

  f.phase = 'remove the recovered occurrence and open a new blank part';
  await button(await occurrenceControls(), 'Remove').click();
  await f.page.waitForFunction(() => window.__studioDoc.instances.length === 1 && window.__studioDoc.instances[0].id === 'right');
  await begin();
  await f.frame(points);
  await hover(firstPointer, null);
  await hover(secondPointer, 'Middle', 'right');
  await f.snapshot('04-removed-left');
  await cancel();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0 && !window.__studioDoc.instances?.length);
  await f.ready();
  await begin();
  await f.frame([firstPointer, secondPointer]);
  await hover(firstPointer, null);
  await hover(secondPointer, null);
  const empty = await f.snapshot('05-new-blank-part');
  assert.deepEqual(empty.instanceBounds, []);
  await cancel();

  f.phase = 'open reused IDs and send a double Finish click for one snapped profile';
  await open(doc);
  await begin();
  await f.frame(points);
  await hover(firstPointer, 'End', 'left');
  await f.snapshot('05a-old-cue-before-direct-open');
  await open(replacement);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  assert.equal(await cue().count(), 0);
  await begin();
  await f.frame(points);
  await hover(firstPointer, null);
  const next = await hover(replacementPointer, 'End', 'left');
  await markAt(replacementEnd);
  await f.snapshot('06-same-id-current-only');
  await f.page.mouse.click(...next);
  await f.page.mouse.click(...await hover(secondPointer, 'Middle', 'right'));
  const finish = await f.page.locator('.topbar button.finish').boundingBox();
  assert.ok(finish);
  await f.page.mouse.dblclick(finish.x + finish.width / 2, finish.y + finish.height / 2);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.ready();
  const accepted = (await f.snapshot('07-same-id-one-finish')).doc;
  assert.equal(accepted.nodes.length, 3);
  assert.deepEqual(accepted.nodes[2].min, replacementEnd);
  assert.deepEqual(accepted.nodes[2].max, middleAt);
  assert.deepEqual(accepted.instances, replacement.instances);
  await f.undo();
  await f.same(replacement);
  await f.redo();
  await f.same(accepted);
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: accepted, label: '08-same-id-consumer' })).doc;
  const native = await f.inspect('same-id-native', solid);
  checkBox(native.placed[0].bodies[0], [...replacementEnd, 0], [55.25, 26.25, 6], 1440);
  checkBox(native.root.find(body => body.id === 'n3'), [...replacementEnd, 0], [...middleAt, 2], 1220);
  assert.deepEqual(solid.instances, replacement.instances);
  f.report.observations.push({ label: 'same-id-native-consumer', storedCornersMm: [replacementEnd, middleAt], volumeMm3: 1220, finishedSketches: 1 });

  f.phase = 'move the source after Finish and keep the stored profile as a coordinate snapshot';
  const field = (await occurrenceControls()).getByLabel('Instance X', { exact: true }).first();
  await field.fill('38.25');
  await field.press('Enter');
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().some(item => item.id === 'left' && item.min[0] === 38.25));
  const moved = await f.doc();
  assert.deepEqual(moved.nodes, solid.nodes);
  assert.deepEqual(moved.instances[0], { ...solid.instances[0], position: [38.25, 14.25, 0] });
  assert.deepEqual(moved.instances[1], solid.instances[1]);
  const movedNative = await f.inspect('same-id-after-source-move', moved);
  assert.deepEqual(movedNative.root, native.root);
  assert.deepEqual(movedNative.placed[1], native.placed[1]);
  checkBox(movedNative.placed[0].bodies[0], [38.25, 14.25, 0], [58.25, 26.25, 6], 1440);
  await f.snapshot('09-finished-geometry-keeps-original-snap-coordinates');
  assert.deepEqual(f.report.downloads, []);
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
    if (fixed || sourceRevision || lifecycle) await context.addInitScript(installD523PlacedReplyScheduler);
    return context;
  };

  if (lifecycle) {
    await checkLifecycle();
    return;
  }
  if (sourceRevision) {
    await checkSourceRevision();
    return;
  }
  if (quarterTurn) {
    await checkQuarterTurn();
    return;
  }
  if (rotationLimits) {
    await checkRotationLimits();
    return;
  }

  const fixture = Buffer.from(JSON.stringify(source));
  const original = await f.inspect('source-native', source);
  assert.equal(original.root.length, 1);
  checkBox(original.root[0], [-24.75, -9.5, 0], [-4.75, 2.5, 6], 1440);
  checkInstances(original.placed);
  f.report.observations.push({ label: 'fixture', bytes: fixture.length, sha256: sha256(fixture) });
  await f.newPage();
  await open(source, fixture);
  const before = await f.snapshot('01-current-placed-boxes');
  assert.deepEqual(before.instanceBounds.map(item => ({ id: item.id, min: item.min, max: item.max })), [
    { id: 'left', min: [10.25, 14.25, 0], max: [30.25, 26.25, 6] },
    { id: 'right', min: [55.75, 34.25, 0], max: [75.75, 46.25, 6] },
  ]);

  f.phase = 'compare root and placed endpoints and midpoints at the current working plane';
  await begin();
  const scenePoints = [[-24.75, -9.5], [-14.75, -9.5], firstPointer, secondPointer];
  await f.frame(scenePoints);
  await hover([-24.70, -9.45], 'End');
  await f.snapshot('02-root-end');
  await hover([-14.70, -9.45], 'Middle');
  await f.snapshot('03-root-middle');
  await hover([20.29, 14.30], fixed ? 'Middle' : null, fixed ? 'left' : null);
  await hover([55.80, 34.30], fixed ? 'End' : null, fixed ? 'right' : null);
  await f.snapshot(fixed ? '04-placed-current-sources' : '04-placed-controls-no-cue');
  if (fixed) {
    f.phase = 'exclude disabled snap kinds, off-plane edges and the exploded view';
    const options = f.sketchPanel().locator('details.sk-object-snaps');
    await options.locator('summary').click();
    const endpoint = button(options, 'Endpoint');
    await endpoint.click();
    await hover(firstPointer, null);
    await hover(secondPointer, 'Middle', 'right');
    await endpoint.click();
    await options.locator('summary').click();
    const offset = f.sketchPanel().getByLabel('Plane offset', { exact: true });
    await offset.fill('3');
    await f.frame(scenePoints);
    await hover(firstPointer, null, null, 3);
    await hover(secondPointer, null, null, 3);
    await offset.fill('0');
    await f.frame(scenePoints);
    const explode = button(f.page, 'Explode');
    await explode.click();
    await hover(firstPointer, null);
    await hover(secondPointer, null);
    await f.snapshot('04a-explode-excludes-placed-snaps');
    for (let i = 0; i < 3; i++) await explode.click();
    await hover(firstPointer, 'End', 'left');
  }
  const first = await hover(firstPointer, fixed ? 'End' : null, fixed ? 'left' : null);
  if (fixed) await markAt(endAt);
  await f.page.mouse.click(...first);
  const second = await hover(secondPointer, fixed ? 'Middle' : null, fixed ? 'right' : null);
  if (fixed) await markAt(middleAt);
  await f.page.mouse.click(...second);
  const accepted = (await f.finishSketch(fixed ? '05-root-rectangle-from-placed-snaps' : '05-root-rectangle-falls-to-grid')).doc;
  assert.deepEqual(accepted.instances, instances);
  assert.deepEqual(accepted.nodes.slice(0, 2), root.nodes);
  const [min, max] = fixed ? [endAt, middleAt] : expectedGrid;
  const expectedVolume = fixed ? 2220 : 2240;
  assert.equal(accepted.nodes[2].profile, 'rectangle');
  assert.deepEqual(accepted.nodes[2].min, min);
  assert.deepEqual(accepted.nodes[2].max, max);

  f.phase = 'evaluate the coordinates the root Extrude actually consumed';
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: accepted, label: fixed ? '06-placed-snap-consumer' : '06-grid-consumer' })).doc;
  const proof = await f.inspect('accepted-native', solid);
  assert.deepEqual(solid.instances, instances);
  assert.deepEqual(proof.placed, original.placed);
  assert.deepEqual(proof.root.find(body => body.id === 'n1'), original.root[0]);
  checkBox(proof.root.find(body => body.id === 'n3'), [...min, 0], [...max, 2], expectedVolume);
  const body = (await f.bodies()).bodies.find(body => body.key === 'b3');
  assert.ok(Math.abs(body.volume - expectedVolume) < 1e-8);
  await f.undo();
  await f.same(accepted);
  await f.redo();
  await f.same(solid);
  f.report.observations.push({
    label: fixed ? 'placed-snap-fixed' : 'placed-snap-baseline', rootEnd: 'PASS', rootMiddle: 'PASS',
    placedEnd: fixed ? 'PASS' : 'FAIL', placedMiddle: fixed ? 'PASS' : 'FAIL',
    wanted: [endAt, middleAt], stored: [min, max], wantedVolumeMm3: 2220, storedVolumeMm3: expectedVolume,
  });
  if (fixed) {
    const bytes = await save(solid);
    await f.newPage();
    await open(solid, bytes);
    const reopened = await f.inspect('reopened-native', solid);
    assert.deepEqual(reopened, proof);
    await f.snapshot('07-fresh-open-with-accepted-geometry');
    await open(source);
    await movedOccurrence(source);
  }
  assert.deepEqual(f.report.downloads, []);
});
