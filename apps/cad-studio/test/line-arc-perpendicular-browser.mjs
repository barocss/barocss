import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const refuseSavedRule = mode === '--refuse-saved-rule';
const name = 'line-arc-perpendicular';
const project = 'D859 line arc constraint';
const pins = [
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
  'packages/barocss-cad-model/src/sketch/terms.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
];
const f = await createFlow({
  name, output, envFrozen: refuseSavedRule ? 'D860_SOURCE_FROZEN' : 'D859_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: refuseSavedRule ? 'Refuse a stored perpendicular arc reference without changing the accepted part'
    : 'Measure the current shared-endpoint line and arc perpendicular selection boundary',
  limits: ['One clockwise R8 circular arc in a closed XY outline. Current Studio admission, line–line control and native file ownership.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { partBreps } from '@barocss/cad-model/engine/evaluate';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { applyConstraint, solveShape, type Polygon } from '@barocss/cad-model/sketch/rules';

if (process.argv[3] === '"native"') {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const parts = partBreps(doc);
  assert.equal(parts.length, 1);
  const brep = parts[0].brep;
  assert.ok(checkBrep(brep, { strict:true }).valid);
  assert.ok(brep.shells.every(shell => shell.closed));
  console.log(JSON.stringify({ names:brep.faces.map(face => face.name),
    cylinders:brep.faces.map(faceGeometry).filter(g => g.kind === 'cylinder') }));
  process.exit(0);
}
if (process.argv[3] === '"legacy"') {
  const shape: Polygon = { kind:'polygon', closed:true, points:[[0,0],[20,0],[20,10],[0,10]],
    bulges:[0,Math.tan(Math.PI/8),0,0], hv:{h:[],v:[]}, rules:[{kind:'perpendicular',a:0,b:1}] };
  const built = profileOf([shape]);
  assert.ok('node' in built);
  const doc = withNode(withNode(emptyDoc(),built.node),{kind:'extrude',sketch:0,height:6});
  const bytes = encodeStudioFile(doc);
  const loaded = await readStudioFile(bytes);
  const solved = solveShape(shape);
  assert.ok(solved.ok);
  console.log(JSON.stringify({doc:loaded.doc, error:loaded.error, bytes:Buffer.from(bytes).toString('base64'), dof:solved.dof}));
  process.exit(0);
}
const shape: Polygon = { kind:'polygon', closed:true, points:[[0,0],[12,0],[20,8],[0,8]],
  bulges:[0,-Math.tan(Math.PI/8),0,0], radii:{1:8}, hv:{h:[],v:[]} };
const solve = solveShape(shape);
assert.ok(solve.ok);
const line = {kind:'edge',i:0} as const, arc = {kind:'edge',i:1} as const, left = {kind:'edge',i:3} as const;
const forward = applyConstraint(shape,[line,arc],'perpendicular');
const reversed = applyConstraint(shape,[arc,line],'perpendicular');
const control = applyConstraint(shape,[line,left],'perpendicular');
assert.deepEqual(forward,reversed);
assert.ok(!forward.ok && control.ok);
const built = profileOf([shape]);
assert.ok('node' in built);
const doc = withNode(withNode(emptyDoc(),built.node),{kind:'extrude',sketch:0,height:6});
const bytes = encodeStudioFile(doc);
const loaded = await readStudioFile(bytes);
assert.ok(!('error' in loaded));
console.log(JSON.stringify({ doc:loaded.doc, bytes:Buffer.from(bytes).toString('base64'),
  refusal:forward.reason, initialDof:solve.dof, controlDof:control.report.dof }));
`,
  snapshotExtra: () => ({
    picked: document.querySelector('.cons-sel')?.textContent ?? null,
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    constraintRows: [...document.querySelectorAll('.cons-row .kv')].map(row => row.textContent),
    perpendicularTitle: document.querySelector('button[aria-label="Perpendicular"]')?.title ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

const line = [6, 0], arc = [20 - 8 / Math.SQRT2, 8 / Math.SQRT2], left = [0, 4], top = [9, 8];
const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const volume = 6 * (160 - 16 * Math.PI);

async function open(bytes, filename = name + '.bcad') {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
}
async function edit() {
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Select', 's');
  await f.frame([line, arc, left, top]);
}
async function pickPair(first, second, text) {
  await f.worldClick(first);
  await f.page.keyboard.down('Shift');
  await f.worldClick(second);
  await f.page.keyboard.up('Shift');
  assert.equal(await f.sketchPanel().locator('.cons-sel').textContent(), text);
}
function validateGeometry(state, source, hasRule) {
  const [node] = state.doc.nodes;
  const [first, curved, next] = node.segments;
  assert.equal(curved.kind, 'arc');
  assert.equal(curved.direction, 'cw');
  assert.deepEqual(node.segments, source.nodes[0].segments);
  assert.deepEqual(node.sideTags, source.nodes[0].sideTags);
  assert.deepEqual(node.outline.rules, hasRule ? [{ kind: 'perpendicular', a: 0, b: 3 }] : undefined);
  assert.deepEqual(state.doc.nodes.slice(1), source.nodes.slice(1));
  assert.deepEqual(state.doc.outputs, source.outputs);

  const u = curved.start.map((coord, i) => coord - first.start[i]);
  const radial = curved.start.map((coord, i) => coord - curved.center[i]);
  const tangent = [-radial[1], radial[0]];
  const chord = next.start.map((coord, i) => coord - curved.start[i]);
  const cosine = v => (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
  near(Math.hypot(...radial), 8, 1e-7);
  near(cosine(tangent), 0, 1e-9);
  near(cosine(chord), Math.SQRT1_2, 1e-9);
  assert.equal(state.bodies.bodies.length, 1);
  near(state.bodies.bodies[0].volume, volume, 1e-6);
  f.report.observations.push({ label: state.label, normalizedTangentDot: cosine(tangent), normalizedChordDot: cosine(chord),
    expectedVolume: volume, nativeVolume: state.bodies.bodies[0].volume });
}
async function save() {
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByLabel('Versions panel', { exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(name + '.bcad', { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    const file = await (await folder.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name + '.bcad']));
  assert.deepEqual(JSON.parse(bytes), await f.doc());
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(8000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const fixture = await f.inspect('source-fixture', {});
  const bytes = Buffer.from(fixture.bytes, 'base64'), source = fixture.doc;
  f.report.observations.push({ label: 'fixture', sha256: sha256(bytes), modelRefusal: fixture.refusal, dof: fixture.initialDof, controlDof: fixture.controlDof });
  await f.newPage();
  await open(bytes);
  await f.same(source);
  const initial = await f.snapshot('01-current-native-part');
  validateGeometry(initial, source, false);
  const native = await f.inspect('native-original', source, 'native');
  assert.equal(native.cylinders.length, 1);
  near(native.cylinders[0].r, 8, 1e-7);
  await edit();
  const perpendicular = () => button(f.sketchPanel(), 'Perpendicular');

  f.phase = 'select the shared endpoint pair in both orders';
  await pickPair(line, arc, 'Picked edge 1, arc 2');
  assert.equal(await perpendicular().isDisabled(), true);
  assert.equal(await perpendicular().getAttribute('title'), fixture.refusal);
  const refused = await f.snapshot('02-line-then-arc-current-refusal');
  assert.deepEqual(refused.history, initial.history);
  assert.deepEqual(refused.bodies, initial.bodies);
  assert.equal(refused.dirty, false);
  assert.match(refused.solver, new RegExp(fixture.initialDof + ' DOF'));
  await pickPair(arc, line, 'Picked arc 2, edge 1');
  assert.equal(await perpendicular().isDisabled(), true);
  await f.snapshot('03-arc-then-line-current-refusal');
  await f.page.keyboard.press('Meta+z');
  assert.equal(await f.sketchAlert(), null);
  await f.same(source);

  f.phase = 'apply the existing perpendicular relation between two actual straight edges';
  await pickPair(line, left, 'Picked edge 1, edge 4');
  assert.equal(await perpendicular().isEnabled(), true);
  await perpendicular().click();
  const remove = () => button(f.sketchPanel(), 'Remove Perpendicular edge 1 ⊥ edge 4');
  await remove().waitFor();
  const applied = await f.snapshot('04-straight-edge-control');
  assert.match(applied.solver, new RegExp(fixture.controlDof + ' DOF'));
  await f.page.keyboard.press('Meta+z');
  await remove().waitFor({ state: 'detached' });
  await f.page.keyboard.press('Meta+Shift+z');
  await remove().waitFor();
  const accepted = await f.finishSketch('05-finished-straight-edge-control');
  validateGeometry(accepted, source, true);
  assert.deepEqual(await f.inspect('native-control', accepted.doc, 'native'), native);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted.doc);

  if (refuseSavedRule) {
    f.phase = 'refuse the exact legacy bytes while retaining the current dirty draft and history';
    const legacy = await f.inspect('synthetic-arc-rule', {}, 'legacy');
    const synthetic = Buffer.from(legacy.bytes, 'base64');
    assert.equal(sha256(synthetic), 'efddc24c79d2c0c9e163699d79ba406e265c85c095f31a4c49cd8f79dc52bed2');
    assert.match(legacy.error, /^\[BAD_REFERENCE\] Sketch 1, perpendicular constraint 1 needs two different straight edges/);
    await edit();
    await pickPair(line, arc, 'Picked edge 1, arc 2');
    const before = await f.snapshot('06-before-refused-open');
    assert.equal(before.dirty, true);
    await open(synthetic, 'inert-perpendicular.bcad');
    const notice = await f.waitToast(/Could not open this file.*two different straight edges/);
    assert.match(notice, /BAD_REFERENCE/);
    await f.same(accepted.doc);
    const after = await f.snapshot('07-stored-arc-rule-refused');
    for (const field of ['doc', 'bodies', 'history', 'dirty', 'picked', 'solver', 'constraintRows']) {
      assert.deepEqual(after[field], before[field], field);
    }
    await f.dismissToasts();
    await f.page.keyboard.press('Escape');
    await f.page.keyboard.press('Escape');
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.undo();
    await f.same(source);
    await f.redo();
    await f.same(accepted.doc);
  }

  const saved = await save();

  await f.newPage();
  await open(saved);
  await f.same(accepted.doc);
  validateGeometry(await f.snapshot(refuseSavedRule ? '08-fresh-open' : '06-fresh-open'), source, true);
  await edit();
  await remove().waitFor();
  await pickPair(line, arc, 'Picked edge 1, arc 2');
  assert.equal(await perpendicular().isDisabled(), true);
  await f.snapshot(refuseSavedRule ? '09-reopen-line-arc-boundary' : '07-reopen-line-arc-boundary');
  if (refuseSavedRule) return;

  f.phase = 'observe current reader behavior on a synthetic stored arc reference';
  const legacy = await f.inspect('synthetic-arc-rule', {}, 'legacy');
  const synthetic = Buffer.from(legacy.bytes, 'base64');
  await f.newPage();
  await open(synthetic);
  await f.same(legacy.doc);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await button(f.sketchPanel(), 'Remove Perpendicular edge 1 ⊥ edge 2').waitFor();
  const state = await f.snapshot('08-synthetic-rule-row-without-solver-relation');
  assert.match(state.solver, new RegExp(legacy.dof + ' DOF'));
  const [first, curved] = state.doc.nodes[0].segments;
  const legacyLine = curved.start.map((value, i) => value - first.start[i]);
  const radial = curved.start.map((value, i) => value - curved.center[i]);
  const tangent = [-radial[1], radial[0]];
  const dot = Math.abs(legacyLine[0] * tangent[0] + legacyLine[1] * tangent[1]) / (Math.hypot(...legacyLine) * Math.hypot(...tangent));
  near(dot, Math.SQRT1_2, 1e-9);
  near(state.bodies.bodies[0].volume, 6 * (200 + 25 * (Math.PI / 2 - 1)), 1e-6);
  f.report.observations.push({ label: 'synthetic-legacy-reader', sha256: sha256(synthetic), normalizedTangentDot: dot, displayedDof: legacy.dof });
});
