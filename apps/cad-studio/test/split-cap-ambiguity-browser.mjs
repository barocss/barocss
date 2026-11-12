import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);

const cap = 'n5.cut.side1';
const source = { node: 5, side: 'negative' };
const sibling = { node: 5, side: 'positive' };
const nodes = [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30] },
  { kind: 'extrude', sketch: 0, height: 10 },
  { kind: 'sketch', profile: 'rectangle', min: [28, 5], max: [52, 12] },
  { kind: 'extrude', sketch: 2, height: 10 },
  { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
  { kind: 'split', parent: { node: 4, side: 'solid' }, axis: 'x', normal: [1, 0, 0], at: 24 },
  { kind: 'shell', parent: source, thickness: 2, open: [cap], sigs: {
    [cap]: { k: 'plane', p: [24, 15, 5], d: [1, 0, 0], s: 300 },
  } },
].map((node, index) => ({ ...node, id: 'n' + index }));
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', nodes, outputs: { b5_positive: sibling, b6: { node: 6, side: 'solid' } }, parameters: {}, nextId: 7 };
const filename = 'split-cap-ambiguity.bcad';
const input = join(output, filename);
await writeFile(input, JSON.stringify(initial));
const pins = ['apps/cad-studio/test/split-cap-ambiguity-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/documentFile.ts', 'apps/cad-studio/src/ui/ReferenceDecisions.tsx',
  'packages/barocss-cad-model/src/engine/references.ts', 'packages/barocss-cad-model/src/engine/rematch.ts',
  'packages/barocss-cad/src/part/part-model.ts', 'packages/barocss-cad/src/part/part-shell.ts'];
const f = await createFlow({
  name: 'split-cap-ambiguity', envFrozen: 'D791_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'A Split cap consumed by Shell has two descendants after a public plane edit. The edit refuses and the raw file holds Shell.',
  limits: ['One axis-aligned box, one asymmetric through-notch, one stored Split cap role and a direct 2 mm Shell.'],
  snapshotExtra: () => ({
    historyActions: ['Undo', 'Redo'].map(label => {
      const button = document.querySelector(`button[aria-label="${label}"]`);
      return { disabled: button?.disabled, title: button?.title };
    }),
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
try {
  const result = evaluateCadPart(toPartDocument(doc));
  console.log(JSON.stringify(result.outputs.map(body => {
    const { volume, centroid } = massPropertiesOf(body), { brep } = body;
    const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
    const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
    const coedges = new Map(brep.coedges.map(use => [use.id, use]));
    const caps = brep.faces.filter(face => /^n5\\.cut\\.side1(?:#\\d+)?$/.test(face.name ?? '')).map(face => {
      const geometry = faceGeometry(face);
      const outer = brep.loops.find(loop => loop.face === face.id && loop.kind === 'outer');
      const corners = outer.coedges.map(id => {
        const use = coedges.get(id), edge = edges.get(use.edge);
        return vertices.get(edge.vertices[use.sense === 'forward' ? 0 : 1]);
      });
      return { name: face.name, geometry, corners };
    });
    return { id: body.id, volume, centroid, valid: checkOutput(body).valid, caps };
  })));
} catch (error) {
  console.log(JSON.stringify({ code: error.code, feature: error.feature, message: error.message }));
}
`,
});
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${a} versus ${b}`);
const at = (doc, cut) => {
  const next = structuredClone(doc);
  next.nodes[5].at = cut;
  return next;
};
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D791 Split cap ambiguity ' + randomUUID();
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
async function submitSplit(cut) {
  await f.openFeatureEditor(5, 'Split plane at ' + cut);
  await f.editor().getByRole('spinbutton', { name: 'At', exact: true }).fill(String(cut));
  await button(f.editor(), 'Apply').click();
}
async function checkUnique(label, expected, cut) {
  f.phase = label;
  await f.same(expected);
  const state = await f.snapshot(label);
  const results = await f.inspect(label + '-native', state.doc);
  const shell = results.find(body => body.id === 'n6');
  assert.ok(results.every(body => body.valid));
  const volume = 144 * cut + 312;
  const cx = (72 * cut * cut + 312) / volume;
  const shown = state.bodies.bodies.find(body => body.key === 'b6');
  for (const body of [shell, shown]) {
    near(body.volume, volume);
    near(body.centroid[0], cx);
    near(body.centroid[1], 15);
    near(body.centroid[2], 5);
  }
  near(results.find(body => body.id === 'n5/1').volume, 300 * (60 - cut) - 1680);
  assert.deepEqual(state.doc.nodes[6].open, [cap]);
  assert.equal(state.doc.nodes[6].held, undefined);
  f.report.observations.push({ label, cut, volume, centroid: [cx, 15, 5] });
  return state;
}

await f.run(async () => {
  await f.newPage();
  await f.openFile(input, 7);
  await checkUnique('01-original-one-cap', initial, 24);
  await submitSplit(26);
  const accepted = at(initial, 26);
  await checkUnique('02-same-cap-after-edit', accepted, 26);

  f.phase = 'save the accepted state and verify project Open after reload';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const saved = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, filename]));
  assert.deepEqual(JSON.parse(saved), accepted);
  await writeFile(join(output, 'saved-one-cap.bcad'), saved);
  f.report.observations.push({ savedBytes: saved.length, savedSHA256: sha256(saved) });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), accepted);
  await openProject();
  await button(versions(), 'Open ' + filename).click();
  const before = await checkUnique('03-reopened-one-cap', accepted, 26);

  const ambiguous = at(accepted, 30);
  const prefix = { ...ambiguous, nodes: ambiguous.nodes.slice(0, 6), outputs: { b5_negative: source, b5_positive: sibling } };
  const rawParts = await f.inspect('04-two-native-cap-descendants', prefix);
  const rawNegative = rawParts.find(body => body.id === 'n5/0');
  assert.equal(rawNegative.valid, true);
  near(rawNegative.volume, 8860);
  near(rawParts.find(body => body.id === 'n5/1').volume, 7460);
  const faces = rawNegative.caps.map(({ name, geometry, corners }) => {
    assert.equal(geometry.kind, 'plane');
    assert.deepEqual(geometry.n, [1, 0, 0]);
    for (const point of corners) near(point[0], 30);
    assert.equal(corners.length, 4);
    const ys = corners.map(point => point[1]), zs = corners.map(point => point[2]);
    return { name, spanY: [Math.min(...ys), Math.max(...ys)], area: (Math.max(...ys) - Math.min(...ys)) * (Math.max(...zs) - Math.min(...zs)) };
  }).sort((a, b) => a.spanY[0] - b.spanY[0]);
  assert.deepEqual(faces.map(face => [face.spanY, face.area]), [[[0, 5], 50], [[12, 30], 180]]);
  assert.deepEqual(faces.map(face => face.name).sort(), [cap + '#1', cap + '#2']);

  const nativeAttempt = await f.inspect('04-shell-with-two-caps', ambiguous);
  f.report.observations.push({ nativeCapDescendants: faces, nativeAmbiguity: Array.isArray(nativeAttempt) ?
    { status: 'ACCEPTED', volumes: nativeAttempt.map(body => body.volume) } : nativeAttempt });

  await submitSplit(30);
  f.phase = 'compare the public X30 edit against the accepted X26 state';
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[5]?.at === 30 || !!document.querySelector('.node-editor .hud-error'));
  await f.ready();
  const live = await f.snapshot('04-live-two-cap-outcome');
  const refused = live.doc.nodes[5].at === 26;
  if (refused) {
    assert.deepEqual(live.doc, accepted);
    assert.deepEqual(live.bodies.bodies, before.bodies.bodies);
    assert.deepEqual(live.history, before.history);
    assert.deepEqual(live.historyActions, before.historyActions);
    await f.editor().locator('.hud-error').getByText('Kernel detail', { exact: true }).click();
    assert.match(await f.editor().locator('.hud-error').innerText(), /n5\.cut\.side1.*ambiguous|ambiguous.*n5\.cut\.side1/i);
    await f.snapshot('05-live-typed-refusal');
  }

  f.phase = 'cold File Open of the exact X30 input with the original cap name';
  const staleFile = join(output, 'ambiguous-two-cap.bcad');
  await writeFile(staleFile, JSON.stringify(ambiguous));
  await f.newPage();
  await f.openFile(staleFile, 7);
  if (refused) await f.page.waitForFunction(() => {
    const shell = window.__studioDoc?.nodes?.[6];
    return shell?.held || shell?.rematched;
  });
  if (refused) await f.page.getByRole('region', { name: 'References', exact: true }).getByText(/Reference ambiguous/).waitFor();
  const cold = await f.snapshot('06-cold-two-cap');
  const held = cold.doc.nodes[6];
  f.report.observations.push({ refused, liveVolumes: live.bodies.bodies.map(body => body.volume), coldOpen: held, coldVolumes: cold.bodies.bodies.map(body => body.volume) });
  assert.ok(refused, 'The live edit must refuse a stored Split cap with two native faces');
  assert.equal(nativeAttempt.feature, 'n6');
  assert.equal(nativeAttempt.code, 'REFERENCE');
  assert.deepEqual(cold.doc.nodes.slice(0, 6), ambiguous.nodes.slice(0, 6));
  assert.deepEqual(held.open, [cap]);
  assert.equal(held.suppressed, true);
  assert.equal(held.rematched, undefined);
  assert.match(held.held, /ambiguous|multiple/i);
  assert.deepEqual(cold.doc.outputs, accepted.outputs);
  near(cold.bodies.bodies.find(body => body.key === 'b6').volume, 8860);
  near(cold.bodies.bodies.find(body => body.key === 'b5_positive').volume, 7460);
  assert.deepEqual(f.report.downloads, []);
});
