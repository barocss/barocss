import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/hole-history-centre-browser.mjs',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
];
const f = await createFlow({
  name: 'hole-history-centre',
  output: process.argv[2],
  envFrozen: 'D1000_SOURCE_FROZEN',
  qualification: 'Open, edit, Undo and Redo a native through hole on each coordinate axis in Studio History.',
  limits: ['One through hole per part in ordinary rectangular stock. The Z file omits the optional axis.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const ref = node => ({ node, side: 'solid' });
const stockSize = [40, 30, 20];
const radius = 2;
const initialCentre = [12, 7];
const editedCentre = [12, 9];
const cases = [
  { axis: 'x', labels: ['Centre Y', 'Centre Z'], cutLength: 40, cutCentre: ([a, b]) => [20, a, b] },
  { axis: 'y', labels: ['Centre X', 'Centre Z'], cutLength: 30, cutCentre: ([a, b]) => [a, 15, b] },
  { labels: ['Centre X', 'Centre Y'], cutLength: 20, cutCentre: ([a, b]) => [a, b, 10] },
];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });

function checkMass(state, test, centre) {
  assert.equal(state.bodies.bodies.length, 1);
  const [{ volume, centroid }] = state.bodies.bodies;
  const stockVolume = stockSize.reduce((a, b) => a * b);
  const removedVolume = Math.PI * radius ** 2 * test.cutLength;
  const expectedVolume = stockVolume - removedVolume;
  const cutCentre = test.cutCentre(centre);
  const expectedCentroid = stockSize.map((length, index) =>
    (stockVolume * length / 2 - removedVolume * cutCentre[index]) / expectedVolume);
  const volumeError = Math.abs(volume - expectedVolume);
  const centroidError = Math.hypot(...centroid.map((value, index) => value - expectedCentroid[index]));
  f.report.observations.push({ label: state.label, volume, centroid, volumeError, centroidError });
  assert.ok(volumeError < 1e-7, `${state.label}: volume error ${volumeError}`);
  assert.ok(centroidError < 1e-8, `${state.label}: centroid error ${centroidError}`);
}

await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = options => newContext({ ...options, acceptDownloads: false });
  await f.newPage();
  for (const test of cases) {
    const axis = test.axis ?? 'legacy-z';
    const node = { id: 'n2', kind: 'hole', parent: ref(1), center: initialCentre, radius, ...(test.axis && { axis: test.axis }) };
    const doc = {
      format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
      nodes: [
        { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: stockSize.slice(0, 2) },
        { id: 'n1', kind: 'extrude', sketch: 0, height: stockSize[2] },
        node,
      ],
      outputs: { b2: ref(2) }, nextId: 3,
    };
    f.phase = `Open ${axis} through hole`;
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
    await chooser.setFiles({ name: `hole-${axis}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
    await f.openFeatureEditor(2, axis);
    const fields = (await f.editorFields()).filter(field => field.label.startsWith('Centre '));
    f.report.observations.push({ label: `${axis}-fields`, fields });
    checkMass(await f.snapshot(`${axis}-editor`), test, initialCentre);
    assert.deepEqual(fields, test.labels.map((label, index) => ({ label, value: String(initialCentre[index]), disabled: false })));

    await f.editor().getByRole('spinbutton', { name: test.labels[1], exact: true }).fill(String(editedCentre[1]));
    const edited = await f.applyEditor(doc, `${axis}-edited`);
    assert.deepEqual(edited.doc, { ...doc, nodes: [...doc.nodes.slice(0, 2), { ...node, center: editedCentre }] });
    checkMass(edited, test, editedCentre);

    await f.undo();
    await f.same(doc);
    checkMass(await f.snapshot(`${axis}-undo`), test, initialCentre);
    await f.redo();
    await f.same(edited.doc);
    checkMass(await f.snapshot(`${axis}-redo`), test, editedCentre);
  }
  assert.deepEqual(f.report.downloads, []);
});
