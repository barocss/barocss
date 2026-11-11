// D739: use real plane inputs and picks, then inspect saved and native extrusion coordinates.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-plane-precision-browser.mjs',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/App.tsx',
  'packages/barocss-cad-model/src/sketch/plane.ts',
  'packages/barocss-cad-model/src/app/faceProfile.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
];
const f = await createFlow({
  name: 'sketch-plane-precision', output, envFrozen: 'D739_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce loss of sketch plane coordinates' : 'Keep authored sketch plane origins and native offsets',
  limits: ['Ordinary XY offsets and axis-aligned native faces. Native vertices are read independently of viewport mesh positions.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { evaluateDoc, partBreps } from '@barocss/cad-model/engine/evaluate';
const { doc } = JSON.parse(process.argv[3]);
const view = evaluateDoc(doc, 1);
assert.ok(view.ok, JSON.stringify(view));
const outputs = partBreps(doc).map(({ key, brep }) => {
  const body = view.bodies.find(item => item.key === key);
  assert.ok(body);
  return { key, vertices: brep.vertices.map(v => v.point), volume: body.volume,
    faces: body.mesh.faces.map(({ name, centroid, normal, exact }) => ({ name, centroid, normal, exact })) };
});
console.log(JSON.stringify({ outputs }));
`,
});

const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0.0004, 0], max: [40.0004, 20], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8.0004, id: 'n1' },
  ], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const sourceBytes = Buffer.from(JSON.stringify(source));
const offsets = [
  { label: 'positive-small', offset: 0.0004, parentLevel: 0 },
  { label: 'positive-next', offset: 0.0006, parentLevel: 0.001 },
  { label: 'negative-small', offset: -0.0004, parentLevel: 0 },
  { label: 'zero', offset: 0, parentLevel: 0 },
  { label: 'normal-offset', offset: 12.5, parentLevel: 12.5 },
  ...(!baseline ? [{ label: 'below-label-precision', offset: 0.00004, parentLevel: 0 }] : []),
];
const faces = [
  { label: 'native-top', view: 'Top', axis: 2, sign: 1, level: 8.0004, parentLevel: 8, pick: [10, 8, 8.0004], a: [4, 4, 8.0004], b: [16, 11, 8.0004], area: 84 },
  { label: 'native-right', view: 'Right', axis: 0, sign: 1, level: 40.0004, parentLevel: 40, pick: [40.0004, 10, 4], a: [40.0004, 4, 1], b: [40.0004, 16, 5], area: 48 },
  { label: 'native-left', view: 'Left', axis: 0, sign: -1, level: 0.0004, parentLevel: 0, pick: [0.0004, 10, 4], a: [0.0004, 4, 1], b: [0.0004, 16, 5], area: 48 },
];
const near = (value, expected, tolerance = 1e-9) => assert.ok(Math.abs(value - expected) <= tolerance, `${value} != ${expected}`);
const span = (body, axis) => [Math.min(...body.vertices.map(p => p[axis])), Math.max(...body.vertices.map(p => p[axis]))];

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
  const mode = name => f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name, exact: true });
  const clickWorld = async point => {
    const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
    assert.ok(pixel?.length === 2 && pixel.every(Number.isFinite));
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.vp-canvas'), pixel));
    await f.page.mouse.click(...pixel);
  };
  const inspect = (label, doc) => f.inspect(label, {}, { doc });
  const draw = async (a, b, label) => {
    await clickWorld(a);
    await clickWorld(b);
    await f.sketchPanel().locator('#sk-width').waitFor();
    return f.finishSketch(label);
  };
  const checkNative = async (label, extruded, index, axis, level, sign, volume) => {
    const target = Object.entries(extruded.doc.outputs).find(([, ref]) => ref.node === index);
    assert.ok(target);
    const [key] = target;
    const result = await inspect(label, extruded.doc), body = result.outputs.find(output => output.key === key);
    assert.ok(body);
    const expected = [level, level + sign * 3].sort((a, b) => a - b);
    span(body, axis).forEach((v, i) => near(v, expected[i]));
    near(body.volume, volume, 1e-7);
    near(extruded.bodies.bodies.find(body => body.key === key).volume, volume, 1e-7);
    return span(body, axis);
  };
  const save = async doc => {
    const project = 'D739 plane precision', name = 'offset-plane.bcad';
    await f.page.locator('.doc-tab input').fill('offset-plane');
    await button('Project and versions').click();
    const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
    await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await button('Save').click();
    await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
    const saved = await f.page.evaluate(async ([project, name]) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
      return (await (await dir.getFileHandle(name)).getFile()).text();
    }, [project, name]);
    assert.deepEqual(JSON.parse(saved), doc);
    const path = join(output, name);
    await writeFile(path, saved);
    const reopened = await f.freshOpen(path, doc, 'fresh-offset-plane');
    f.report.files.push({ name, sha256: sha256(saved) });
    return reopened;
  };

  for (const { label, offset, parentLevel } of offsets) {
    f.phase = label;
    await f.newPage();
    await button('New part').click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    await mode('Sketch').click();
    const input = f.sketchPanel().getByLabel('Plane offset', { exact: true });
    await input.fill(String(offset));
    const shown = await input.inputValue();
    const level = baseline ? parentLevel : offset;
    if (!baseline) assert.equal(Number(shown), offset);
    await f.frame([[0, 0], [12, 7]]);
    const sketch = await draw([0, 0, level], [12, 7, level], label + '-sketch');
    const plane = sketch.doc.nodes[0].plane;
    assert.equal(plane === undefined, level === 0);
    if (plane) near(plane.origin[2], level);
    await f.openExtrudeHud();
    const part = await f.applyExtrude({ distance: 3, previous: sketch.doc, label });
    const nativeSpan = await checkNative(label, part, 1, 2, level, 1, 252);
    f.report.observations.push({ label, offset, shown, storedLevel: plane?.origin[2] ?? 0, nativeSpan });
    if (!baseline && label === 'positive-small') {
      await f.undo();
      await f.same(sketch.doc);
      await f.redo();
      await f.same(part.doc);
      await f.openFeatureEditor(1);
      await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
      await f.sketchPanel().waitFor();
      await f.finishSketch('reopened-finish');
      await f.same(part.doc);
      const saved = await save(part.doc);
      await checkNative('fresh-offset-plane', saved, 1, 2, offset, 1, 252);
    }
  }

  for (const { label, view, axis, sign, level, parentLevel, pick, a, b, area } of faces) {
    f.phase = label;
    await f.newPage();
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'native-face-source.bcad', mimeType: 'application/json', buffer: sourceBytes });
    await f.same(source);
    if (view === 'Left') {
      await button('View cube directions').click();
      await f.page.getByRole('menuitem', { name: 'Left', exact: true }).click();
    } else await button(view).click();
    await f.page.waitForTimeout(450);
    await clickWorld(pick);
    await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
    const selected = (await f.page.evaluate(() => window.__studioSelection.selection.faces))[0];
    const input = await inspect(label + '-source', source);
    const body = input.outputs[0], face = body.faces[selected.face];
    const normal = [0, 0, 0];
    normal[axis] = sign;
    assert.deepEqual(face.normal, normal);
    assert.equal(face.exact?.kind, 'plane');
    near(face.exact.o[axis], level);
    near(face.centroid[axis], level, 1e-5);
    near(span(body, axis)[sign < 0 ? 0 : 1], level);
    await mode('Sketch').click();
    const planeField = f.sketchPanel().getByLabel('Sketch plane', { exact: true });
    assert.equal(await planeField.inputValue(), 'face');
    const expected = baseline ? parentLevel : level;
    const sketch = await draw(a, b, label + '-sketch');
    const plane = sketch.doc.nodes[2].plane;
    near(plane.origin[axis], expected);
    assert.deepEqual(plane.normal, normal);
    await f.openExtrudeHud();
    const part = await f.applyExtrude({ distance: 3, previous: sketch.doc, label });
    const nativeSpan = await checkNative(label, part, 3, axis, expected, sign, area * 3);
    f.report.observations.push({ label, face: face.name, normal, inputNativeLevel: level, displayLevel: face.centroid[axis],
      storedLevel: plane.origin[axis], nativeSpan, sourceSHA256: sha256(sourceBytes) });
  }
  assert.deepEqual(f.report.downloads, []);
});
