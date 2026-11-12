import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2);
const name = 'large-sketch-length';
const project = 'D857 driving line length';
const pins = [
  'apps/cad-studio/src/ui/InlineSketchDimension.tsx',
  'apps/cad-studio/src/viewport/studioSketchViewportActions.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts',
  'packages/barocss-cad-model/src/sketch/settle.ts',
  'packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts',
];
const f = await createFlow({
  name, output, envFrozen: 'D857_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Measure current driving line edits on independently solvable XY profiles',
  limits: ['Existing line lengths on two straight XY triangle fixtures, existing Extrude, desktop Studio and local project Save.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { solveShape } from '@barocss/cad-model/sketch/rules';
const { shape, height } = JSON.parse(process.argv[3]);
const solved = solveShape(shape);
assert.ok(solved.ok, JSON.stringify(solved));
const profile = profileOf([shape]);
assert.ok('node' in profile, JSON.stringify(profile));
const source = withNode(withNode(emptyDoc(), profile.node), { kind:'extrude', sketch:0, height });
const bytes = encodeStudioFile(source);
const read = await readStudioFile(bytes);
assert.ok(!('error' in read), JSON.stringify(read));
console.log(JSON.stringify({ doc:read.doc, base64:Buffer.from(bytes).toString('base64'), rank:solved.rank, dof:solved.dof }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    constraints: [...document.querySelectorAll('.cons-row .kv')].map(row => row.textContent),
    dimensions: [...document.querySelectorAll('.dim[data-dim]')].map(mark => [mark.getAttribute('data-dim'), mark.textContent]),
  }),
});

const linear = 1e-7;
const angular = 1e-9;
const height = 6;
const angle = 37 * Math.PI / 180;
const angleTriangle = {
  label: 'angle-triangle',
  edge: 2,
  from: 30,
  to: 35,
  afterOpen: 31.125,
  invalid: 0.0005,
  points: length => [[0, 0], [40, 0], [length * Math.cos(angle), length * Math.sin(angle)]],
  lengths: length => ({ 0: 40, 2: length }),
  hv: { h: [0], v: [] },
  rules: [{ kind: 'angle', a: 0, b: 2, value: 37 }],
  check: points => {
    near(Math.hypot(...points[1]), 40, linear);
    near(Math.atan2(points[2][1], points[2][0]), angle, angular);
  },
};
// A and B are fixed. C is the upper intersection of the two circles centred at A and B.
const base = 4;
const radius = 128;
const circleTriangle = {
  label: 'circle-intersection-triangle',
  edge: 2,
  from: 131.95,
  to: 124.05,
  intermediate: 128,
  afterOpen: 124.04,
  invalid: 132.05,
  refusal: /Bounded local solve did not meet fixed residual tolerances; this is not an inconsistency proof/,
  points: length => {
    const x = (length ** 2 + base ** 2 - radius ** 2) / (2 * base);
    return [[0, 0], [base, 0], [x, Math.sqrt(length ** 2 - x ** 2)]];
  },
  lengths: length => ({ 1: radius, 2: length }),
  hv: { h: [], v: [] },
  rules: [{ kind: 'fix', point: 1, at: [base, 0] }],
  // Independent distances plus positive winding select the upper branch. Near the ends of
  // the triangle inequality, a radial residual is not a Cartesian residual of the same size.
  check: points => near(Math.hypot(points[1][0] - base, points[1][1]), 0, linear),
};
const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const near = (actual, expected, tolerance) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected} (±${tolerance})`);
};
const doubleArea = points => points.reduce((sum, [x, y], i) => {
  const [u, v] = points[(i + 1) % points.length];
  return sum + x * v - y * u;
}, 0);

async function open(bytes) {
  const control = button(f.page, 'Open');
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), control.click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: bytes });
}
async function edit() {
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}
function dim(case_) {
  return f.page.locator(`.vp-overlay .dim[data-dim="len${case_.edge}"] .dim-text`);
}
async function setLength(case_, from, value) {
  await dim(case_).dblclick();
  const input = f.page.getByLabel(`Length of edge ${case_.edge + 1}`, { exact: true });
  assert.equal(await input.inputValue(), String(from));
  await input.fill(String(value));
  const started = performance.now();
  await input.press('Enter');
  await input.waitFor({ state: 'hidden' });
  f.report.observations.push({ label: case_.label + '-commit', from, requested: value, inputToResultMs: performance.now() - started,
    alert: await f.sketchAlert() });
}
async function expectLength(case_, value) {
  await dim(case_).dblclick();
  const input = f.page.getByLabel(`Length of edge ${case_.edge + 1}`, { exact: true });
  assert.equal(await input.inputValue(), String(value));
  await input.press('Escape');
  await input.waitFor({ state: 'hidden' });
}
function verifyPart(state, case_, value, source) {
  const [node] = state.doc.nodes;
  const expected = case_.points(value);
  assert.equal(node.kind, 'sketch');
  assert.equal(node.profile, 'polygon');
  assert.deepEqual(node.outline.lengths, case_.lengths(value));
  assert.deepEqual(node.outline.rules, case_.rules);
  assert.deepEqual(node.outline.hv, case_.hv);
  assert.deepEqual(node.outline.points, node.points);
  assert.deepEqual(node.sideTags, source.nodes[0].sideTags);
  assert.deepEqual(state.doc.nodes.slice(1), source.nodes.slice(1));
  assert.deepEqual(state.doc.outputs, source.outputs);
  assert.deepEqual(state.doc.parameters, source.parameters);
  for (const [index, point] of node.points.entries()) {
    if (!case_.intermediate || index < 2) {
      near(Math.hypot(...point.map((c, axis) => c - expected[index][axis])), 0, linear);
    }
    if (index in node.outline.lengths) {
      const b = node.points[(index + 1) % node.points.length];
      near(Math.hypot(b[0] - point[0], b[1] - point[1]), node.outline.lengths[index], linear);
    }
  }
  assert.ok(doubleArea(node.points) > 0);
  case_.check(node.points);
  assert.equal(state.bodies.bodies.length, 1);
  const actualProfileVolume = height * doubleArea(node.points) / 2;
  near(state.bodies.bodies[0].volume, actualProfileVolume, 1e-6);
  f.report.observations.push({ label: state.label, value, expectedPoints: expected, actualPoints: node.points,
    nominalVolume: height * doubleArea(expected) / 2, actualProfileVolume, actualVolume: state.bodies.bodies[0].volume });
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
    const directory = await projects.getDirectoryHandle(project);
    const file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name + '.bcad']));
  assert.deepEqual(JSON.parse(bytes), await f.doc());
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

async function sketchFields() {
  return f.sketchPanel().getByRole('group', { name: 'Outline points', exact: true }).locator('input').evaluateAll(
    inputs => inputs.map(input => [input.getAttribute('aria-label'), input.value, input.classList.contains('locked')]),
  );
}

async function qualify(case_) {
  const { label, from, to, invalid } = case_;
  f.phase = label + ' source profile';
  const shape = { kind: 'polygon', closed: true, points: case_.points(from), lengths: case_.lengths(from), hv: case_.hv, rules: case_.rules };
  const fixture = await f.inspect(label, {}, { shape, height });
  const source = fixture.doc;
  const seed = Buffer.from(fixture.base64, 'base64');
  f.report.observations.push({ label, sourceSHA256: sha256(seed), rank: fixture.rank, dof: fixture.dof });
  await f.newPage();
  await open(seed);
  await f.same(source);
  const initial = await f.snapshot(label + '-source');
  verifyPart(initial, case_, from, source);
  await edit();
  await f.frame(case_.intermediate ? [...case_.points(from), ...case_.points(case_.intermediate), ...case_.points(to)] : case_.points(from));

  f.phase = label + ' invalid length retains the settled profile';
  const before = await sketchFields();
  await setLength(case_, from, invalid);
  if (case_.intermediate) {
    assert.ok(invalid > base + radius, 'The independent triangle inequality makes this case impossible');
    assert.ok(await f.sketchAlert());
  } else {
    assert.match(await f.sketchAlert(), /A dimension must be greater than 0/);
  }
  await f.page.keyboard.press('Meta+z');
  await expectLength(case_, from);
  await f.same(source);
  assert.deepEqual(await sketchFields(), before);
  const refused = await f.snapshot(label + '-invalid-refused');
  assert.deepEqual(refused.history, initial.history);
  assert.equal(refused.dirty, false);
  assert.deepEqual(refused.bodies, initial.bodies);

  f.phase = label + ' direct length edit';
  await setLength(case_, from, to);
  if (case_.intermediate) {
    assert.ok(Math.abs(base - radius) < to && to < base + radius, 'The independent triangle inequality admits the target');
    assert.match(await f.sketchAlert(), case_.refusal);
    await f.same(source);
    assert.deepEqual(await sketchFields(), before);
    await expectLength(case_, from);
    const direct = await f.snapshot(label + '-feasible-direct-refused');
    assert.deepEqual(direct.history, initial.history);
    assert.equal(direct.dirty, false);
    assert.deepEqual(direct.bodies, initial.bodies);

    f.phase = label + ' manual intermediate then the exact original target';
    await setLength(case_, from, case_.intermediate);
    assert.equal(await f.sketchAlert(), null);
    await expectLength(case_, case_.intermediate);
    const intermediate = await sketchFields();
    const y = intermediate.find(([field]) => field === 'Point 3 Y')[1];
    near(Number(y), case_.points(case_.intermediate)[2][1], 0.0001);
    await f.snapshot(label + '-manual-intermediate');
    await setLength(case_, case_.intermediate, to);
    assert.equal(await f.sketchAlert(), null);
    const finalFields = await sketchFields();
    await f.page.keyboard.press('Meta+z');
    assert.deepEqual(await sketchFields(), intermediate);
    await f.page.keyboard.press('Meta+Shift+z');
    assert.deepEqual(await sketchFields(), finalFields);
  }
  assert.equal(await f.sketchAlert(), null);
  await expectLength(case_, to);
  await f.same(source);
  const accepted = await f.finishSketch(label + '-final');
  verifyPart(accepted, case_, to, source);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted.doc);
  const bytes = await save();
  await f.newPage();
  await open(bytes);
  await f.same(accepted.doc);
  verifyPart(await f.snapshot(label + '-fresh-open'), case_, to, source);
  await edit();
  await expectLength(case_, to);
  await setLength(case_, to, case_.afterOpen);
  assert.equal(await f.sketchAlert(), null);
  const edited = await f.finishSketch(label + '-reedit-after-open');
  verifyPart(edited, case_, case_.afterOpen, source);
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
  await qualify(angleTriangle);
  await qualify(circleTriangle);
});
