import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an artifact directory outside the worktree');
const pins = [
  'apps/cad-studio/test/candidate-atomicity-browser.mjs',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/storage/project.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/team/candidates.ts',
  'packages/barocss-cad-model/src/team/team.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { CandidateBoard, inProcessReopen } from '@barocss/cad-model/team/candidates';

const [, , , options] = process.argv;
const { approvedFile } = JSON.parse(options);
let rev = 0;
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, ++rev);
const reopen = inProcessReopen(evaluate);
const held = new Map<number, { enter: () => void; entered: Promise<void>; release: () => void; resume: Promise<void> }>();
for (const height of [6, 7]) {
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const resume = new Promise<void>(resolve => { release = resolve; });
  held.set(height, { enter, entered, release, resume });
}
const doc = rectanglePart(20, 10, 5);
const start = await evaluate(doc);
assert.ok(start.ok);
const board = new CandidateBoard({ doc, bodies: start.bodies }, async candidate => evaluate(candidate), async bytes => {
  const read = await readStudioFile(bytes);
  assert.ok(!('error' in read));
  const node = read.doc.nodes[1];
  assert.equal(node.kind, 'extrude');
  const gate = held.get(Number(node.height))!;
  gate.enter();
  await gate.resume;
  return reopen(bytes);
});
const initial = board.save();
for (const [id, height] of [['A', 6], ['B', 7]] as const) {
  assert.ok(board.start({ operationId: 'start-' + id, candidate: id, patch: {
    ops: [{ tool: 'edit_feature', args: { index: 1, values: { h: height } } }],
  } }).ok);
  assert.equal((await board.run('run-' + id, id)).evidence?.facts.volume, 200 * height);
}
const a = board.accept('accept-A', 'A'), b = board.accept('accept-B', 'B');
await Promise.all([...held.values()].map(gate => gate.entered));
assert.equal((await board.accept('accept-A', 'A')).code, 'OPERATION_PENDING');
assert.equal(board.cancel('accept-A', 'B').code, 'OPERATION_CONFLICT');
held.get(6)!.release();
const accepted = await a;
assert.ok(accepted.ok);
held.get(7)!.release();
const late = await b;
assert.equal(late.code, 'STALE_BASE');
assert.equal(board.statusOf('A'), 'accepted');
assert.equal(board.statusOf('B'), 'built');
assert.deepEqual([board.state.token, board.volume()], [1, 1200]);
const approved = board.save();
assert.ok(board.undo('undo-A').ok);
assert.deepEqual(board.save(), initial);
assert.equal(board.undo('extra-undo').code, 'NOTHING_TO_UNDO');
assert.ok(board.redo('redo-A').ok);
assert.deepEqual(board.save(), approved);
assert.deepEqual([board.state.token, board.volume()], [3, 1200]);
writeFileSync(approvedFile, approved);
console.log(JSON.stringify({ initial: JSON.parse(Buffer.from(initial).toString()), approved: board.state, accepted, late, trace: board.outcomes }));
`;

const f = await createFlow({
  name: 'candidate-atomicity', envFrozen: 'D585_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, inspectorSource,
  qualification: 'D585 native CandidateBoard overlap and desktop Studio round trip of its single winner',
  limits: [
    'The test host drives CandidateBoard with a deterministic replay barrier. Studio uses its public file and feature controls.',
    'One 20 x 10 mm rectangle with a literal height. No live provider or parallel process publication.',
  ],
});
const fileName = 'D585-board-winner.bcad', projectName = 'D585 accepted document';
const button = name => f.page.getByRole('button', { name, exact: true });
const dirty = () => f.page.getByLabel('Unsaved changes', { exact: true });

async function open(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: fileName, mimeType: 'application/json', buffer: bytes });
}
async function check(label, expected, height) {
  await f.same(expected);
  const snapshot = await f.snapshot(label);
  assert.equal(snapshot.doc.nodes[1].height, height);
  assert.equal(snapshot.bodies.bodies.length, 1);
  const [body] = snapshot.bodies.bodies;
  assert.ok(Math.abs(body.volume - 200 * height) < 1e-8);
  const centroid = [10, 5, height / 2];
  assert.ok(body.centroid?.length === centroid.length);
  for (const [axis, want] of centroid.entries()) assert.ok(Math.abs(body.centroid[axis] - want) < 1e-8);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  f.phase = 'native board replay overlap';
  const approvedFile = join(f.output, fileName);
  const host = await f.inspect('host-board', {}, { approvedFile });
  const bytes = await readFile(approvedFile), expected = JSON.parse(bytes);
  assert.deepEqual(expected, host.approved.doc);
  assert.equal(host.initial.nodes[1].height, 5);
  assert.equal(host.approved.token, 3);
  assert.equal(host.accepted.volume, 1200);
  assert.equal(host.late.code, 'STALE_BASE');
  f.report.files.push({ source: 'CandidateBoard.save', file: approvedFile, hash: sha256(bytes) });
  f.report.observations.push({ label: 'native host', ...host });

  f.phase = 'public Open of the accepted file';
  await f.newPage();
  await open(bytes);
  await check('01-board-winner', expected, 6);
  assert.equal(await dirty().isVisible(), false);

  f.phase = 'project Save of the accepted file';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  const saved = Buffer.from(await f.page.evaluate(async ({ projectName, fileName }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const project = await projects.getDirectoryHandle(projectName);
    return [...new Uint8Array(await (await (await project.getFileHandle(fileName)).getFile()).arrayBuffer())];
  }, { projectName, fileName }));
  assert.deepEqual(saved, bytes);
  const savedFile = join(f.output, 'project-saved.bcad');
  await writeFile(savedFile, saved);
  f.report.files.push({ source: 'OPFS', file: savedFile, hash: sha256(saved), byteEquality: true });

  f.phase = 'fresh Open of the project bytes';
  await f.newPage();
  await open(saved);
  await check('02-fresh-open', expected, 6);

  await f.openFeatureEditor(1, 'accepted extrusion');
  const distance = f.editor().getByRole('spinbutton', { name: 'Distance', exact: true });
  assert.equal(await distance.inputValue(), '6');
  await distance.fill('8');
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  const edited = structuredClone(expected);
  edited.nodes[1].height = 8;
  await check('03-re-edited', edited, 8);
  await f.undo();
  await check('04-first-undo', expected, 6);
  await f.redo();
  await check('05-first-redo', edited, 8);
  assert.deepEqual(f.report.downloads, []);
});
