import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use a directory outside the worktree');
const pins = [
  'apps/cad-studio/test/b09-editable-consumer-browser.mjs',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/scripts/cad-cli.mjs',
  'apps/cad-studio/scripts/cad-mcp.mjs',
  'apps/cad-studio/server/cadCli.ts',
  'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useProposalPreview.ts',
  'apps/cad-studio/src/ui/ProposalBrowser.tsx',
  'packages/barocss-cad-model/src/chat/features.ts',
  'packages/barocss-cad-model/src/chat/part/history.ts',
  'packages/barocss-cad-model/src/chat/tools.ts',
  'packages/barocss-cad-model/src/engine/container.ts',
];

const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkBrep, faceGeometry } from '@barocss/cad';
import { documentRevision } from '@barocss/cad-model/team/bundle';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, partBreps } from '@barocss/cad-model/engine/evaluate';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { commitDimension, solveShape } from '@barocss/cad-model/sketch/rules';
import { rectangleOutline } from '@barocss/cad-model/sketch/select';

const arg = JSON.parse(process.argv[3]);
if (arg.seed) {
  let shape = rectangleOutline({ kind: 'rectangle', a: [0, 0], b: [20, 10], ids: ['side-a', 'side-b', 'side-c', 'side-d'] });
  assert.ok(shape);
  for (const [key, length] of [['len0', 20], ['len1', 10]] as const) {
    const next = commitDimension(shape, key, length);
    assert.ok(next.ok);
    shape = next.shape;
  }
  const solved = solveShape(shape);
  assert.ok(solved.ok && solved.dof === 0);
  const profile = profileOf([shape]);
  assert.ok('node' in profile);
  writeFileSync(arg.seed, encodeStudioFile(withNode(emptyDoc(), profile.node)));
  console.log(JSON.stringify({ node: profile.node, dof: solved.dof }));
} else {
  const read = await readStudioFile(readFileSync(arg.file));
  assert.ok(!('error' in read), JSON.stringify(read));
  const { doc } = read, sketch = doc.nodes[0];
  assert.equal(sketch.kind, 'sketch');
  const { shape } = sketchShapes(sketch, doc.parameters);
  assert.equal(shape?.kind, 'polygon');
  const solved = solveShape(shape);
  assert.ok(solved.ok);
  const e = evaluateDoc(doc, 1);
  assert.ok(e.ok && e.bodies.length === 1);
  const body = e.bodies[0];
  const parts = partBreps(doc);
  assert.deepEqual(parts.map(part => part.key), [body.key]);
  const [{ brep }] = parts;
  const checked = checkBrep(brep, { strict: true });
  assert.ok(checked.valid, JSON.stringify(checked.issues));
  assert.deepEqual(brep.bodies.map(body => body.kind), ['solid']);
  assert.deepEqual(brep.shells.map(shell => shell.closed), [true]);
  const vertices = brep.vertices.map(vertex => vertex.point);
  const cylinders = brep.faces.map(face => faceGeometry(face)).filter(face => face.kind === 'cylinder');
  console.log(JSON.stringify({ doc, revision: documentRevision(doc), dof: solved.dof, lengths: shape.lengths, key: body.key,
    vertices, volume: body.volume, centroid: body.centroid, cylinders }));
}
`;

const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
def close(value, expected, tolerance=1e-8):
    assert abs(value - expected) <= tolerance, (value, expected, tolerance)
area = 20 * 10 - math.pi * 2**2
cx = (20 * 10 * 10 - math.pi * 2**2 * 5) / area
for row in data['stages']:
    h = row['height']
    native = row['native']
    for axis, maximum in zip(zip(*native['vertices'], strict=True), [20,10,h], strict=True):
        close(min(axis), 0)
        close(max(axis), maximum)
    assert native['dof'] == 0 and sorted(native['lengths'].values()) == [10,20], native
    close(native['volume'], area*h)
    for actual, expected in zip(native['centroid'], [cx,5,h/2], strict=True): close(actual, expected)
    assert native['cylinders']
    for cylinder in native['cylinders']:
        close(cylinder['r'], 2)
        close(cylinder['c'][0], 5)
        close(cylinder['c'][1], 5)
        close(abs(cylinder['a'][2]), 1)
        assert cylinder['out'] == -1
    for key in ['toolVolume', 'replayVolume']:
        if key in row: close(row[key], area*h, 0.0005)
    if 'bomMass' in row: close(row['bomMass'], round(area*h*0.0027, 3), 1e-9)
print(json.dumps({'status':'PASS','stages':len(data['stages']),'areaMm2':area,'centroidXmm':cx}))
`;

const f = await createFlow({
  name: 'b09-editable-consumer', envFrozen: 'D587_SOURCE_FROZEN', output,
  qualification: 'B09 v1 constrained plate authoring boundary and typed-seed consumer continuation',
  initialFiles: pins, requiredFrozen: pins, inspectorSource, oracleSource,
  limits: ['One authored constrained through-hole plate. CLI creation of the solver-authored outline is a recorded B09 v1 failure. The continuation begins with a typed Model seed.', 'The local CLI and MCP use the existing grouped tools. The actual Studio accepts the saved proposal and edits the named height.'],
});
const cliEntry = join(repo, 'apps/cad-studio/scripts/cad-cli.mjs'), mcpEntry = join(repo, 'apps/cad-studio/scripts/cad-mcp.mjs');
const path = join(f.output, 'D587-constrained-plate.bcad'), filename = 'D587-constrained-plate.bcad';
const project = 'D587 editable consumer';
const button = name => f.page.getByRole('button', { name, exact: true });
const observation = [];
const ids = ['n0', 'n1', 'n2'];
const close = (value, expected, tolerance = 1e-8) => assert.ok(Number.isFinite(value) && Math.abs(value - expected) <= tolerance, `${value} differs from ${expected}`);
const expectedVolume = h => (200 - Math.PI * 4) * h;

async function cli(label, args, input, code = 0) {
  const result = spawnSync(process.execPath, [cliEntry, ...args], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  await writeFile(join(f.output, label + '-stdout.txt'), result.stdout ?? '');
  await writeFile(join(f.output, label + '-stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, code, result.stderr + result.stdout);
  return result;
}
async function mcp(file, action) {
  const child = spawn(process.execPath, [mcpEntry, '--doc', file, '--autonomy', '4'], { stdio: 'pipe' });
  const exited = once(child, 'close'), lines = createInterface({ input: child.stdout }), iterator = lines[Symbol.asyncIterator]();
  const requests = [];
  let stderr = '', count = 0;
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => child.kill(), 40000);
  const request = async (method, params) => {
    const id = ++count, frame = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
    child.stdin.write(JSON.stringify(frame) + '\n');
    const next = await iterator.next();
    assert.equal(next.done, false, stderr);
    const response = JSON.parse(next.value);
    assert.equal(response.id, id);
    requests.push({ frame, response });
    assert.ok(!response.error, JSON.stringify(response.error));
    return response.result;
  };
  const call = async (name, args, refused = false) => {
    const result = await request('tools/call', { name, arguments: args });
    assert.equal(result.isError, refused, JSON.stringify(result));
    const text = JSON.parse(result.content[0].text);
    if (result.structuredContent) assert.deepEqual(result.structuredContent, text);
    return text;
  };
  try {
    const initialized = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'D587', version: '1' } });
    assert.equal(initialized.serverInfo.version, 'barocss-cad-tools-v2');
    return await action(call, request);
  } finally {
    child.stdin.end();
    const [code, signal] = await exited;
    clearTimeout(timer);
    lines.close();
    await writeFile(join(f.output, 'mcp-' + (++mcp.sequence) + '.json'), JSON.stringify({ requests, code, signal, stderr }, null, 2));
    assert.deepEqual([code, signal], [0, null], stderr);
  }
}
mcp.sequence = 0;
const sameBytes = async bytes => assert.deepEqual(await readFile(path), bytes);
const bind = { action: 'parameters', add: { H: 7 }, bind: [{ feature: 'n1', value: 'h', parameter: 'H' }] };
const parameters = H => ({ action: 'parameters', set: { H } });
const change = (H, opId) => ({ tool: 'features', args: parameters(H), ...(opId ? { opId } : {}) });
async function native(label, file, height, bound, extra = {}) {
  const item = await f.inspect(label, {}, { file });
  assert.deepEqual(item.doc.nodes.map(node => node.id), ids);
  assert.equal(item.dof, 0);
  assert.deepEqual(item.doc.nodes[1].height, bound ? { parameter: 'H' } : height);
  if (bound) assert.equal(item.doc.parameters.H, height);
  if (observation.length) {
    assert.deepEqual(item.doc.nodes[0], observation[0].native.doc.nodes[0]);
    assert.equal(item.key, observation[0].native.key);
  }
  observation.push({ height, native: item, ...extra });
  return item;
}
async function studioOpen(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
}
function checkStudio(snapshot, height) {
  assert.equal(snapshot.bodies.bodies.length, 1);
  close(snapshot.bodies.bodies[0].volume, expectedVolume(height));
  assert.deepEqual(snapshot.doc.nodes.map(node => node.id), ids);
  assert.deepEqual(snapshot.doc.nodes[1].height, { parameter: 'H' });
  assert.equal(snapshot.doc.parameters.H, height);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

  f.phase = 'CLI constrained part creation and failed script';
  const seedPath = join(f.output, 'typed-constrained-sketch.bcad');
  const { node } = await f.inspect('authored-sketch', {}, { seed: seedPath });
  const authored = await readFile(seedPath);
  const attempted = await cli('cli-authored-outline-refusal', ['run', '-', '-o', path], `feature(${JSON.stringify(node)})`, 1);
  assert.match(attempted.stderr, /<stdin>:1:\d+: \[REFUSED\].*unknown field "outline"/);
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  f.report.authoring = { status: 'FAIL', reason: 'The CLI feature tool refuses the authored sketch outline.' };
  f.report.files.push({ file: seedPath, hash: sha256(authored), source: 'Typed Model sketch authoring' });
  const requirements = [
    { id: 'W20', source: '20 mm width', hard: true, basis: 'stated', check: { query: { fn: 'bbox', axis: 'x' }, op: '==', value: 20, unit: 'mm', tol: 0.001 } },
    { id: 'H5-10', source: '5 to 10 mm height', hard: true, basis: 'stated', check: { query: { fn: 'bbox', axis: 'z' }, op: 'between', min: 5, max: 10, unit: 'mm' } },
  ];
  const script = [
    'feature({kind:"extrude",sketch:0,height:6})',
    'feature({kind:"hole",parent:{node:1,side:"solid"},center:[5,5],radius:2,axis:"z"})',
    `requirements(${JSON.stringify(requirements)})`,
    'brief({material:{value:"al6061",basis:"stated",source:"Use 6061 aluminium."}})',
  ].join('\n');
  const created = await cli('cli-create', ['run', '-', '--doc', seedPath, '-o', path, '--check'], script);
  assert.equal(JSON.parse(created.stdout).checks.summary.pass, 2);
  assert.deepEqual(await readFile(seedPath), authored);
  const initial = await readFile(path);
  await native('cli-file', path, 6, false);
  const bad = await cli('cli-bad-script', ['run', '-', '--doc', path, '-o', path], 'edit(node("n1"),{h:7})\nedit(node("n2"),{notAField:1})', 1);
  assert.match(bad.stderr, /<stdin>:2:\d+:.*REFUSED/);
  await sameBytes(initial);

  f.phase = 'stdio MCP inspect, revise and preserve a failed batch';
  await mcp(path, async (call, request) => {
    const listed = await request('tools/list');
    assert.ok(['features', 'model', 'proposals', 'query', 'requirements'].every(name => listed.tools.some(tool => tool.name === name)));
    const summary = await call('query', { action: 'summary' });
    assert.equal(summary.feature_count, 3);
    assert.equal(summary.bodies.length, 1);
    close(summary.bodies[0].volume, expectedVolume(6), 0.0005);
    assert.equal(summary.bodies[0].key, observation[0].native.key);
    observation[0].toolVolume = summary.bodies[0].volume;
    assert.equal((await call('requirements', { action: 'check' })).summary.pass, 2);
    await sameBytes(initial);

    await call('features', bind);
    const seven = await readFile(path);
    await native('mcp-bound-seven', path, 7, true);
    const hardRefusal = await call('features', parameters(11), true);
    assert.match(hardRefusal.error, /breaks hard requirement.*H5-10/);
    await sameBytes(seven);

    const first = change(8, 'revision-eight');
    const badOp = { tool: 'features', args: { action: 'edit', index: 99, values: { h: 1 } }, opId: 'invalid-index' };
    const dry = await call('features', { action: 'batch', dryRun: true, ops: [first] });
    assert.equal(dry.dryRun, true);
    await sameBytes(seven);
    const failed = await call('features', { action: 'batch', ops: [first, badOp] }, true);
    assert.equal(failed.failed_op, 1);
    assert.equal(failed.kept, 'nothing was applied');
    await sameBytes(seven);
    const applied = await call('features', { action: 'batch', ops: [first] });
    assert.equal(applied.applied[0].opId, 'revision-eight');
    assert.equal(applied.applied[0].skipped, undefined);
    const eight = await readFile(path);
    await native('mcp-accepted-eight', path, 8, true);
    const duplicate = await call('features', { action: 'batch', ops: [first] });
    assert.equal(duplicate.applied[0].skipped, 'already applied');
    await sameBytes(eight);

    await call('proposals', { action: 'propose', title: 'Raise the plate to 9 mm', ops: [change(9)] });
    const held = JSON.parse(await readFile(path));
    assert.equal(held.parameters.H, 8);
    assert.equal(held.proposals[0].status, 'open');
  });
  const proposed = await readFile(path);
  await mcp(path, async call => {
    const summary = await call('query', { action: 'summary' });
    assert.equal(summary.parameters.H, 8);
    close(summary.bodies[0].volume, expectedVolume(8), 0.0005);
    const { proposals } = await call('proposals', { action: 'list' });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].title, 'Raise the plate to 9 mm');
    assert.equal(proposals[0].status, 'open');
    assert.equal(proposals[0].stale, false);
  });
  await sameBytes(proposed);

  f.phase = 'actual Studio Open and proposal preview';
  await f.newPage();
  await studioOpen(proposed);
  const opened = JSON.parse(proposed);
  await f.same(opened);
  checkStudio(await f.snapshot('01-mcp-proposal-open'), 8);
  await button('Chat').first().click();
  const proposal = f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });
  await proposal.getByRole('button', { name: 'Preview', exact: true }).click();
  const volumeChange = proposal.getByLabel('Volume change');
  await volumeChange.waitFor();
  await f.page.waitForFunction(() => /\+187\.4.*mm³/.test(document.querySelector('[aria-label="Volume change"]')?.textContent ?? ''));
  await f.same(opened);
  checkStudio(await f.snapshot('02-preview-keeps-eight'), 8);
  await proposal.getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted' && window.__studioDoc?.parameters.H === 9);
  await f.ready();
  const nine = await f.snapshot('03-user-accepted-nine');
  checkStudio(nine, 9);
  assert.equal(nine.doc.proposals[0].decided.by, 'user');
  assert.equal(nine.doc.history.at(-1).kind, 'accept');
  const nineFile = join(f.output, 'accepted-nine.bcad');
  await writeFile(nineFile, JSON.stringify(nine.doc));
  await native('studio-accepted-nine-native', nineFile, 9, true);
  await button('Close chat').click();

  const ten = await f.setParameter('H', 10, '04-studio-edited-ten');
  checkStudio(ten, 10);
  await f.undo();
  await f.same(nine.doc);
  checkStudio(await f.snapshot('05-first-undo'), 9);
  await f.redo();
  await f.same(ten.doc);
  checkStudio(await f.snapshot('06-first-redo'), 10);

  f.phase = 'project Save and fresh Open of edited part';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
  const saved = Buffer.from(await f.page.evaluate(async ({ project, filename }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const handle = await (await projects.getDirectoryHandle(project)).getFileHandle(filename);
    return [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
  }, { project, filename }));
  assert.deepEqual(JSON.parse(saved), ten.doc);
  const savedPath = join(f.output, 'saved-opfs.bcad');
  await writeFile(savedPath, saved);
  f.report.files.push({ file: savedPath, hash: sha256(saved), source: 'Actual Studio OPFS' });
  await f.newPage();
  await studioOpen(saved);
  await f.same(ten.doc);
  checkStudio(await f.snapshot('07-fresh-open-ten'), 10);

  f.phase = 'independent final native and BOM checks';
  const fresh = await native('studio-saved-native', savedPath, 10, true);
  const replay = JSON.parse((await cli('cli-final-replay', ['replay', savedPath])).stdout);
  close(replay.facts.volume, expectedVolume(10), 0.0005);
  assert.equal(replay.facts.solids, 1);
  assert.deepEqual(replay.facts.bbox, { min: [0, 0, 0], max: [20, 10, 10] });
  observation.at(-1).replayVolume = replay.facts.volume;
  assert.deepEqual(Object.values(replay.verdicts).map(verdict => verdict.status), ['pass', 'pass']);
  await mcp(savedPath, async call => {
    const summary = await call('query', { action: 'summary' });
    const report = await call('query', { action: 'bom', expectedRevision: fresh.revision });
    const artifact = report.files[0];
    assert.equal(artifact.path, 'bom.json');
    assert.equal(artifact.sha256, sha256(artifact.text));
    const parsed = JSON.parse(artifact.text);
    assert.equal(parsed.bom.totalQty, 1);
    assert.deepEqual(parsed.bom.lines[0].parts, ['base']);
    assert.equal(fresh.doc.brief.material.value, 'al6061');
    const mass = await call('query', { action: 'mass' });
    assert.equal(mass.bodies[0].assumed, false);
    assert.match(mass.bodies[0].material, /6061/);
    f.report.output = { revision: fresh.revision, bomMaterial: parsed.bom.lines[0].material, bomMass: parsed.bom.totalMass };
    observation.at(-1).toolVolume = summary.bodies[0].volume;
    observation.at(-1).bomMass = parsed.bom.totalMass;
    await writeFile(join(f.output, 'bom.json'), artifact.text);
    const stale = await call('query', { action: 'bom', expectedRevision: '0'.repeat(64) }, true);
    assert.match(stale.error, /OUTPUT_STALE/);
  });
  assert.deepEqual(await readFile(savedPath), saved);
  await f.runOracle({ stages: observation }, 'b09-independent-geometry');
  assert.deepEqual(f.report.downloads, []);
});
