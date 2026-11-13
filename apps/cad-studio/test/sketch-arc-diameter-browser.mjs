// D718: drive the same canonical sketch radius through Radius and Diameter inputs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const radius = 6.123456;
const nextRadius = 8;
const pins = [
  'apps/cad-studio/test/sketch-arc-diameter-browser.mjs',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  ...(baseline ? [] : ['apps/cad-studio/src/ui/InlineSketchDimension.tsx']),
  'apps/cad-studio/src/ui/constraints.css',
  'apps/cad-studio/src/viewport/studioSketchViewportActions.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
];
const f = await createFlow({
  name: 'sketch-arc-diameter', output, envFrozen: 'D718_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Existing arc Radius and circle Diameter controls' : 'Arc Radius and Diameter editing on desktop',
  limits: ['Closed planar sketch, existing inline edit, native extrusion.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { partBreps } from '@barocss/cad-model/engine/evaluate';
import { brepMassProperties, checkBrep, curveDomain, curveEvaluator } from '@barocss/cad';
import { readFileSync } from 'node:fs';

const { name, radius, sense, major, accepted, file } = JSON.parse(process.argv[3]);
if (accepted || file) {
  const reopened = file ? await readStudioFile(readFileSync(file)) : { doc: accepted };
  assert.ok('doc' in reopened, JSON.stringify(reopened));
  const parts = partBreps(reopened.doc);
  assert.equal(parts.length, 1);
  const { brep } = parts[0];
  const checked = checkBrep(brep, { strict:true });
  assert.ok(checked.valid, JSON.stringify(checked.issues));
  assert.deepEqual(brep.bodies.map(body => body.kind), ['solid']);
  assert.deepEqual(brep.shells.map(shell => shell.closed), [true]);
  const edges = brep.edges.filter(edge => edge.curve.degree === 2).map(edge => {
    const [lo,hi] = curveDomain(edge.curve);
    const evaluate = curveEvaluator(edge.curve);
    return Array.from({length:9}, (_,i) => evaluate(lo+(hi-lo)*i/8));
  });
  console.log(JSON.stringify({edges,volume:brepMassProperties(brep,1).volume,doc:reopened.doc}));
  process.exit(0);
}
const shape = { kind:'polygon',closed:true,points:[[0,0],[40,0],[40,2*radius],[0,2*radius]],
  bulges:[0,1,0,0],lengths:{0:40},radii:{1:radius},hv:{h:[0,2],v:[3]},tangents:[1,2],ids:['e0','e1','e2','e3'] };
if (name === 'circle') {
  shape.points = [[0,0],[40,0],[40,30],[0,30]];
  shape.bulges = [0,0,0,0];
  shape.hv = {h:[0,2],v:[1,3]};
  delete shape.tangents;
  delete shape.radii;
  shape.circles = [{c:[20,15],r:radius}];
  shape.circleIds = ['e4'];
}
let height = 2;
if (sense) {
  height = 7;
  const minorSweep = 2*Math.asin(4/radius);
  const sweep = sense*(major ? 2*Math.PI-minorSweep : minorSweep);
  Object.assign(shape,{points:[[-4,0],[4,0]],bulges:[Math.tan(sweep/4),0],radii:{0:radius},
    ids:['e0','e1'],hv:{h:[],v:[]},rules:[{kind:'fix',point:1,at:[4,0]}]});
  delete shape.tangents;
  delete shape.lengths;
  if (name === 'reference') delete shape.radii;
  if (name === 'equal-radius') {
    shape.bulges[1] = shape.bulges[0];
    shape.equalRadii = [[0,1]];
  }
}
const profile = profileOf([shape]);
assert.ok('node' in profile, JSON.stringify(profile));
const doc = withNode(withNode(emptyDoc(), profile.node), {kind:'extrude',sketch:0,height});
const bytes = encodeStudioFile(doc);
const opened = await readStudioFile(bytes);
assert.ok(!('error' in opened), JSON.stringify(opened));
console.log(JSON.stringify({doc:opened.doc,bytes:Buffer.from(bytes).toString('base64')}));
`,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const button = name => f.page.getByRole('button', { name, exact: true });
  const inline = () => f.page.locator('input.dim-edit');
  const open = async (path, doc, discardDraft = false) => {
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(path);
    if (discardDraft) {
      await f.page.getByRole('dialog', { name: 'Discard sketch changes?', exact: true })
        .getByRole('button', { name: 'Discard changes', exact: true }).click();
    }
    await f.same(doc);
  };
  const fixture = async (name, options = {}) => {
    const record = await f.inspect(name, {}, { name, radius, ...options });
    const path = join(output, name + '.bcad');
    await writeFile(path, Buffer.from(record.bytes, 'base64'));
    return { ...record, path };
  };
  const editSketch = async () => {
    await f.openFeatureEditor(1);
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
  };
  const openField = async (key, value) => {
    await f.page.locator(`g.dim[data-dim="${key}"] .dim-text`).dblclick();
    assert.equal(await inline().inputValue(), String(value), key);
  };
  const confirm = async value => {
    await inline().fill(String(value));
    await inline().press('Enter');
    await inline().waitFor({ state: 'detached' });
    assert.equal(await f.sketchAlert(), null);
  };
  const volume = (state, expected) => {
    assert.equal(state.bodies.bodies.length, 1);
    assert.ok(Math.abs(state.bodies.bodies[0].volume - expected) < 1e-8,
      `Volume ${state.bodies.bodies[0].volume} differs from ${expected}`);
  };
  const arcVolume = r => 2 * (80 * r + Math.PI * r ** 2 / 2);
  const diameter = () => button('Diameter (Ø)');
  const radiusMode = () => button('Radius (R)');
  const closeField = async key => {
    await inline().press(key);
    await inline().waitFor({ state: 'detached' });
  };
  const historyTips = () => Promise.all(['Undo', 'Redo'].map(name => button(name).getAttribute('data-tip')));
  const switchToDiameter = async expected => {
    await diameter().click();
    assert.equal(await diameter().getAttribute('aria-pressed'), 'true');
    assert.match(await inline().getAttribute('aria-label'), /^Diameter of arc/);
    assert.match(await inline().getAttribute('title'), /mm/);
    if (expected !== undefined) assert.equal(await inline().inputValue(), String(expected));
  };

  const arc = await fixture('arc');
  await f.newPage();
  await open(arc.path, arc.doc);
  volume(await f.snapshot('arc-authored'), arcVolume(radius));
  await editSketch();
  await openField('rad1', radius);
  if (baseline) assert.equal(await button('Diameter (Ø)').count(), 0);
  await confirm(nextRadius);
  const fromRadius = await f.finishSketch('arc-from-radius');
  const editedArc = fromRadius.doc.nodes[0].outline;
  assert.equal(editedArc.radii[1], nextRadius);
  assert.deepEqual(editedArc.tangents, [1, 2]);
  volume(fromRadius, arcVolume(nextRadius));

  const circle = await fixture('circle');
  await f.newPage();
  await open(circle.path, circle.doc);
  await editSketch();
  await openField('cdia0', radius * 2);
  assert.equal(await button('Diameter (Ø)').count(), 0);
  await confirm(nextRadius * 2);
  const circleAfter = await f.finishSketch('circle-diameter');
  assert.equal(circleAfter.doc.nodes[0].outline.circles[0].r, nextRadius);
  volume(circleAfter, 2 * (40 * 30 - Math.PI * nextRadius ** 2));
  if (baseline) return;

  f.phase = 'Confirm the original arc in both modes without adding history';
  await f.newPage();
  await open(arc.path, arc.doc);
  const initialTips = await historyTips();
  await editSketch();
  await openField('rad1', radius);
  assert.equal(await radiusMode().getAttribute('aria-pressed'), 'true');
  await switchToDiameter(radius * 2);
  await f.snapshot('arc-diameter-mode');
  await radiusMode().click();
  assert.equal(await inline().inputValue(), String(radius));
  await switchToDiameter(radius * 2);
  await closeField('Enter');
  await openField('rad1', radius);
  await inline().press('Tab');
  assert.equal(await radiusMode().evaluate(element => element === document.activeElement), true);
  await radiusMode().press('Tab');
  assert.equal(await diameter().evaluate(element => element === document.activeElement), true);
  await diameter().press('Space');
  assert.equal(await inline().inputValue(), String(radius * 2));
  await diameter().press('Tab');
  await inline().waitFor({ state: 'detached' });
  await openField('rad1', radius);
  await switchToDiameter(radius * 2);
  await inline().fill('16');
  await closeField('Escape');
  await openField('rad1', radius);
  await switchToDiameter(radius * 2);
  await inline().fill('');
  await radiusMode().click();
  assert.equal(await inline().inputValue(), '');
  await switchToDiameter('');
  await closeField('Escape');
  assert.deepEqual((await f.finishSketch('arc-mode-only')).doc, arc.doc);
  assert.deepEqual(await historyTips(), initialTips);
  assert.equal(await f.page.locator('[aria-label="Unsaved changes"]').count(), 0);

  f.phase = 'Refuse invalid diameters and apply one exact edit';
  await editSketch();
  for (const value of ['', '0', '-16', '0.001', '1e999']) {
    await openField('rad1', radius);
    await switchToDiameter(radius * 2);
    await inline().fill('');
    if (value === '1e999') {
      await inline().pressSequentially(value);
      assert.equal(await inline().inputValue(), '');
    } else {
      await inline().fill(value);
    }
    await closeField('Enter');
    assert.match(await f.sketchAlert(), /greater than 0/);
  }
  await openField('rad1', radius);
  await switchToDiameter(radius * 2);
  await confirm(nextRadius * 2);
  await openField('rad1', nextRadius);
  await closeField('Escape');
  await f.page.keyboard.press('Meta+z');
  await openField('rad1', radius);
  await closeField('Escape');
  await f.page.keyboard.press('Meta+Shift+z');
  await openField('rad1', nextRadius);
  await closeField('Escape');
  const fromDiameter = await f.finishSketch('arc-from-diameter');
  assert.deepEqual(fromDiameter.doc, fromRadius.doc);
  assert.deepEqual(fromDiameter.doc.nodes[0].sideTags, arc.doc.nodes[0].sideTags);
  volume(fromDiameter, arcVolume(nextRadius));
  await f.undo();
  await f.same(arc.doc);
  await f.redo();
  await f.same(fromDiameter.doc);

  f.phase = 'Save and reopen the native radius through the Studio project';
  const project = 'D718 Arc radius';
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('arc.bcad', { exact: true }).waitFor();
  const bytes = Buffer.from(await f.page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return [...new Uint8Array(await (await (await dir.getFileHandle('arc.bcad')).getFile()).arrayBuffer())];
  }, project));
  assert.deepEqual(JSON.parse(bytes.toString()), fromDiameter.doc);
  const savedPath = join(output, 'studio-saved.bcad');
  await writeFile(savedPath, bytes);
  const savedNative = await f.inspect('saved-native', {}, { file: savedPath });
  assert.deepEqual(savedNative.doc, fromDiameter.doc);
  checkNativeArc(savedNative, { a: [40, 0], b: [40, 16], center: [40, 8], radius: 8, height: 2,
    sweep: Math.PI, volume: arcVolume(8) });
  f.report.observations.push({ nativeSha256: createHash('sha256').update(bytes).digest('hex'), savedVolume: savedNative.volume });
  await f.newPage();
  await open(savedPath, fromDiameter.doc);
  volume(await f.snapshot('fresh-open'), arcVolume(nextRadius));
  await editSketch();
  await openField('rad1', nextRadius);
  assert.equal(await radiusMode().getAttribute('aria-pressed'), 'true');
  await switchToDiameter(16);
  await inline().fill('10');
  await open(arc.path, arc.doc, true);
  await inline().waitFor({ state: 'detached' });
  await editSketch();
  await openField('rad1', radius);
  assert.equal(await radiusMode().getAttribute('aria-pressed'), 'true');
  await closeField('Escape');

  for (const sense of [1, -1]) for (const major of [false, true]) {
    const name = (sense > 0 ? 'ccw' : 'cw') + (major ? '-major' : '-minor');
    f.phase = `Verify ${name} through native Extrude`;
    const fixed = await fixture(name, { radius: 6, sense, major });
    await f.newPage();
    await open(fixed.path, fixed.doc);
    await editSketch();
    await openField('rad0', 6);
    if (name === 'ccw-minor') {
      await switchToDiameter(12);
      await inline().fill('7.8');
      await closeField('Enter');
      assert.ok(await f.sketchAlert(), 'fixed chord refuses a diameter shorter than the chord');
      await openField('rad0', 6);
    }
    await switchToDiameter(12);
    await confirm(16);
    const after = await f.finishSketch(name);
    const outline = after.doc.nodes[0].outline;
    assert.deepEqual(outline.radii, { 0: 8 });
    assert.deepEqual(outline.rules, fixed.doc.nodes[0].outline.rules);
    assert.deepEqual(after.doc.nodes[0].sideTags, fixed.doc.nodes[0].sideTags);
    const sweep = sense * (major ? 5 * Math.PI / 3 : Math.PI / 3);
    const expectedVolume = 7 * 32 * (Math.abs(sweep) - Math.sin(Math.abs(sweep)));
    volume(after, expectedVolume);
    const native = await f.inspect(name + '-native', {}, { accepted: after.doc });
    const nativeArc = checkNativeArc(native, { a: [-4, 0], b: [4, 0], center: [0, sense * (major ? -1 : 1) * Math.sqrt(48)],
      radius: 8, height: 7, sweep, volume: expectedVolume });
    f.report.observations.push({ name, ...nativeArc });
  }

  f.phase = 'Preserve the equal-radius constraint and retire the old editor when the arc changes';
  const equal = await fixture('equal-radius', { radius: 6, sense: 1, major: false });
  await f.newPage();
  await open(equal.path, equal.doc);
  await editSketch();
  await openField('rad0', 6);
  await switchToDiameter(12);
  await inline().fill('15');
  const secondArc = f.page.locator('g.dim:not(.driving) .dim-text').getByText('R6', { exact: true });
  await secondArc.dblclick();
  assert.match(await inline().getAttribute('aria-label'), /Radius of arc 2/);
  assert.equal(await radiusMode().getAttribute('aria-pressed'), 'true');
  assert.ok(Math.abs(Number(await inline().inputValue()) - 6) < 1e-10);
  await closeField('Escape');
  await openField('rad0', 6);
  await switchToDiameter(12);
  await confirm(16);
  const equalAfter = await f.finishSketch('equal-radius');
  const outline = equalAfter.doc.nodes[0].outline;
  assert.deepEqual(outline.radii, { 0: 8 });
  assert.deepEqual(outline.equalRadii, [[0, 1]]);
  assert.deepEqual(equalAfter.doc.nodes[0].sideTags, equal.doc.nodes[0].sideTags);
  const equalNative = await f.inspect('equal-radius-native', {}, { accepted: equalAfter.doc });
  const sweep = Math.PI / 3;
  const expectedVolume = 7 * 64 * (sweep - Math.sin(sweep));
  volume(equalAfter, expectedVolume);
  for (const sign of [1, -1]) {
    const center = [0, sign * Math.sqrt(48)];
    const edges = equalNative.edges.filter(points => points.every(([x, y]) => Math.abs(Math.hypot(x - center[0], y - center[1]) - 8) < 1e-8));
    const measured = checkNativeArc({ ...equalNative, edges }, { a: [-4 * sign, 0], b: [4 * sign, 0], center, radius: 8,
      height: 7, sweep, volume: expectedVolume });
    f.report.observations.push({ name: 'equal-radius', sign, ...measured });
  }

  f.phase = 'Promote an existing reference arc in diameter mode';
  const reference = await fixture('reference', { radius: 6, sense: 1, major: false });
  await f.newPage();
  await open(reference.path, reference.doc);
  await editSketch();
  await f.page.locator('g.dim:not(.driving) .dim-text').getByText('R6', { exact: true }).dblclick();
  assert.match(await inline().getAttribute('title'), /Enter adds it as a driving dimension/);
  await switchToDiameter();
  assert.ok(Math.abs(Number(await inline().inputValue()) - 12) < 1e-10);
  await closeField('Enter');
  const promoted = await f.finishSketch('reference-promoted');
  assert.deepEqual(Object.keys(promoted.doc.nodes[0].outline.radii), ['0']);
  assert.ok(Math.abs(promoted.doc.nodes[0].outline.radii[0] - 6) < 1e-10);
});

// Sample exact native boundary curves. Reorient each piece by endpoint continuity from the authored start.
function checkNativeArc(native, expected) {
  const close = (value, wanted, tolerance) => assert.ok(Math.abs(value - wanted) < tolerance,
    `Native value ${value} differs from ${wanted} by more than ${tolerance}`);
  const linear = 1e-8;
  const angular = 1e-8;
  close(native.volume, expected.volume, 1e-7);
  let radiusError = 0, centerError = 0;
  const byHeight = [0, expected.height].map(z => {
    const pieces = native.edges.filter(points => points.every(point => Math.abs(point[2] - z) < linear));
    assert.ok(pieces.length > 0, 'both caps must contain native rational arc edges');
    const ordered = [];
    let current = expected.a;
    const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    while (pieces.length) {
      const index = pieces.findIndex(piece => distance(piece[0], current) < linear || distance(piece.at(-1), current) < linear);
      assert.ok(index >= 0, 'the native arc is contiguous from the authored start');
      const [piece] = pieces.splice(index, 1);
      if (distance(piece[0], current) >= linear) piece.reverse();
      ordered.push(...piece.slice(ordered.length ? 1 : 0));
      current = piece.at(-1);
    }
    close(distance(current, expected.b), 0, linear);
    const center = circumcenter(ordered[0], ordered[Math.floor(ordered.length / 2)], ordered.at(-1));
    const offset = distance(center, expected.center);
    close(offset, 0, linear);
    centerError = Math.max(centerError, offset);
    const relative = ordered.map(([x, y]) => [x - expected.center[0], y - expected.center[1]]);
    let sweep = 0;
    for (const [i, p] of relative.entries()) {
      const length = Math.hypot(...p);
      close(length, expected.radius, linear);
      radiusError = Math.max(radiusError, Math.abs(length - expected.radius));
      if (!i) continue;
      const q = relative[i - 1];
      sweep += Math.atan2(q[0] * p[1] - q[1] * p[0], q[0] * p[0] + q[1] * p[1]);
    }
    close(sweep, expected.sweep, angular);
    return sweep;
  });
  return { sweep: byHeight, radiusError, centerError, nativeVolume: native.volume, analyticVolume: expected.volume };
}

function circumcenter(a, b, c) {
  const x = b[0] - a[0], y = b[1] - a[1], u = c[0] - a[0], v = c[1] - a[1];
  const b2 = x * x + y * y, c2 = u * u + v * v, denominator = 2 * (x * v - y * u);
  assert.ok(Math.abs(denominator) > 1e-8, 'arc witnesses are noncollinear');
  return [a[0] + (v * b2 - y * c2) / denominator, a[1] + (x * c2 - u * b2) / denominator];
}
