import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const drawingPath = 'apps/cad-studio/test/fixtures/dimensioned-angle-bracket.svg';
const pins = [
  'apps/cad-studio/test/dimensioned-bracket-control-browser.mjs', drawingPath, 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/server/cadDoc.ts', 'apps/cad-studio/server/cadMcp.ts',
  'packages/barocss-cad-model/src/chat/outputs.ts', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/chat/tools.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry } from '@barocss/cad';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { evaluateDoc, partBreps } from '@barocss/cad-model/engine/evaluate';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { solveShape } from '@barocss/cad-model/sketch/rules';

const path = JSON.parse(process.argv[3]);
const read = await readStudioFile(readFileSync(path));
assert.ok('doc' in read, JSON.stringify(read));
const { doc } = read;
const evaluated = evaluateDoc(doc, 1);
assert.ok(evaluated.ok && evaluated.bodies.length === 1, JSON.stringify(evaluated));
const [body] = evaluated.bodies;
const parts = partBreps(doc);
assert.deepEqual(parts.map(part => part.key), [body.key]);
const [{ brep }] = parts;
const checked = checkBrep(brep, { strict: true });
assert.ok(checked.valid, JSON.stringify(checked.issues));
assert.deepEqual(brep.bodies.map(item => item.kind), ['solid']);
assert.deepEqual(brep.shells.map(shell => shell.closed), [true]);
const sketches = doc.nodes.flatMap(node => {
  if (node.kind !== 'sketch') return [];
  const { shape } = sketchShapes(node, doc.parameters);
  assert.equal(shape?.kind, 'polygon');
  const solved = solveShape(shape);
  assert.ok(solved.ok);
  return [{ id: node.id, dof: solved.dof, lengths: shape.lengths }];
});
const cylinders = brep.faces.map(face => faceGeometry(face)).filter(face => face.kind === 'cylinder');
console.log(JSON.stringify({ key: body.key, volume: body.volume, centroid: body.centroid, sketches, cylinders, vertices: brep.vertices.map(vertex => vertex.point) }));
`;
const oracleSource = String.raw`
import json, math, sys, xml.etree.ElementTree as ET
data = json.load(sys.stdin)
drawing = ET.fromstring(data["drawing"])
labels = {t.text for t in drawing.findall(".//{http://www.w3.org/2000/svg}text")}
assert {"40 mm", "20 mm", "24 mm", "4 mm upright", "4 mm base", "28 mm", "10 mm", "Ø6 mm THRU"} <= labels

def close(actual, expected):
    assert abs(actual - expected) <= 1e-8, (actual, expected)

for label, height, diameter in [("first", 24, 8), ("corrected", 24, 6), ("saved", 26, 6)]:
    native = data["stages"][label]
    base = 40 * 20 * 4
    upright = 4 * 20 * (height - 4)
    bore = math.pi * (diameter/2)**2 * 4
    volume = base + upright - bore
    close(native["volume"], volume)
    for a, e in zip(native["centroid"], [(base*20 + upright*2 - bore*28)/volume, 10, (base*2 + upright*(height+4)/2 - bore*2)/volume], strict=True):
        close(a, e)
    for coords, limit in zip(zip(*native["vertices"], strict=True), [40, 20, height], strict=True):
        close(min(coords), 0)
        close(max(coords), limit)
    assert [(s["dof"], list(s["lengths"].values())) for s in native["sketches"]] == [(0, [40, 20]), (0, [4, 20])]
    assert native["cylinders"]
    for surface in native["cylinders"]:
        close(surface["r"], diameter/2)
        close(surface["c"][0], 28)
        close(surface["c"][1], 10)
        close(abs(surface["a"][2]), 1)
        assert surface["out"] == -1
    if label == "corrected":
        for state, z in [("opened", 24), ("undo", 24)]:
            close(data["studio"][state]["volume"], volume)
            close(data["studio"][state]["z"], z)
    if label == "saved":
        for state in ["edited", "redo", "reopened"]:
            close(data["studio"][state]["volume"], volume)
            close(data["studio"][state]["z"], height)
print(json.dumps({"status":"PASS", "nativeSamples":3, "studioSamples":5, "volumeToleranceMm3":1e-8}))
`;
const f = await createFlow({
  name: 'dimensioned-bracket-control', envFrozen: 'D597_SOURCE_FROZEN', output,
  qualification: 'Human-transcribed drawing, offline typed-tool repair and editable Studio handoff',
  initialFiles: pins, requiredFrozen: pins, inspectorSource, oracleSource,
  limits: ['One authored L bracket and one through bore. No model interpretation or external service.'],
});

const filename = 'D597-angle-bracket.bcad', project = 'D597 drawing control', part = join(f.output, filename);
const button = name => f.page.getByRole('button', { name, exact: true });
const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const ref = node => ({ node, side: 'solid' });
const rectangle = (width, depth, name) => ({
  kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, depth],
  outline: { points: [[0, 0], [width, 0], [width, depth], [0, depth]], lengths: { 0: width, 1: depth }, hv: { h: [0, 2], v: [1, 3] } },
  sideTags: { outer: ['a', 'b', 'c', 'd'].map(side => name + '-' + side) },
});
const bore = radius => ({ kind: 'hole', parent: ref(4), center: [28, 10], radius, axis: 'z' });
const nodes = [
  rectangle(40, 20, 'base'), { kind: 'extrude', sketch: 0, height: 4 },
  rectangle(4, 20, 'leg'), { kind: 'extrude', sketch: 2, height: { parameter: 'H' } },
  { kind: 'union', left: ref(1), right: ref(3) }, bore(4),
];
const measured = (id, source, query, value) => ({
  id, source, basis: 'stated', hard: true, check: { query, value, op: '==', ...(query.fn === 'count_solids' ? {} : { unit: 'mm', tol: 1e-8 }) },
});
const requirements = [
  measured('WIDTH', '40 mm', { fn: 'bbox', axis: 'x' }, 40),
  measured('DEPTH', '20 mm', { fn: 'bbox', axis: 'y' }, 20),
  measured('HEIGHT', '24 mm', { fn: 'bbox', axis: 'z' }, 24),
  measured('BORE', 'Ø6 mm THRU', { fn: 'hole_diameter', face: { feature: 5, role: 'side0' } }, 6),
  { ...measured('ONE', 'One continuous angle bracket', { fn: 'count_solids' }, 1), basis: 'assumed' },
];

async function mcp(file, label, run) {
  const child = spawn(process.execPath, [join(repo, 'apps/cad-studio/scripts/cad-mcp.mjs'), '--doc', file, '--autonomy', '4'], { stdio: 'pipe' });
  const exited = once(child, 'close'), lines = createInterface({ input: child.stdout }), iterator = lines[Symbol.asyncIterator]();
  const requests = [];
  let stderr = '', id = 0;
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => child.kill(), 35000);
  const request = async (method, params) => {
    const frame = { jsonrpc: '2.0', id: ++id, method, params };
    child.stdin.write(JSON.stringify(frame) + '\n');
    const next = await iterator.next();
    assert.equal(next.done, false, stderr);
    const response = JSON.parse(next.value);
    assert.equal(response.id, id);
    requests.push({ frame, response });
    assert.ok(!response.error, JSON.stringify(response.error));
    return response.result;
  };
  try {
    const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'D597', version: '1' } });
    assert.equal(init.serverInfo.version, 'barocss-cad-tools-v2');
    return await run(async (name, args, refused = false) => {
      const result = await request('tools/call', { name, arguments: args });
      assert.equal(result.isError, refused, JSON.stringify(result));
      const text = JSON.parse(result.content[0].text);
      if (result.structuredContent) assert.deepEqual(result.structuredContent, text);
      return text;
    });
  } finally {
    child.stdin.end();
    const [code, signal] = await exited;
    clearTimeout(timer);
    lines.close();
    await writeFile(join(f.output, label + '-mcp.json'), JSON.stringify({ requests, code, signal, stderr }, null, 2));
    assert.deepEqual([code, signal], [0, null], stderr);
  }
}

async function evidence(call, label, values) {
  const out = await call('requirements', { action: 'evidence' });
  const [file] = out.files;
  assert.equal(file.sha256, sha256(file.text));
  const report = JSON.parse(file.text);
  assert.equal(report.revision, out.revision);
  const result = Object.fromEntries(report.evidence.filter(item => item.requirement).map(({ requirement, result, freshness }) => {
    assert.equal(result.status, 'ok');
    assert.equal(freshness.state, 'current');
    assert.equal(requirement.source, requirements.find(r => r.id === requirement.id).source);
    return [requirement.id, [result.number, result.verdict]];
  }));
  assert.deepEqual(result, values);
  await writeFile(join(f.output, label + '-evidence.json'), file.text);
  return { revision: out.revision, hash: file.sha256 };
}
const expected = (height, diameter) => ({
  WIDTH: [40, 'pass'], DEPTH: [20, 'pass'], HEIGHT: [height, height === 24 ? 'pass' : 'fail'],
  BORE: [diameter, diameter === 6 ? 'pass' : 'fail'], ONE: [1, 'pass'],
});
const state = snapshot => {
  const [body] = snapshot.bodies.bodies;
  assert.equal(snapshot.bodies.bodies.length, 1);
  return { volume: body.volume, z: snapshot.doc.parameters.H };
};
async function open(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
  await f.same(JSON.parse(bytes));
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const drawing = await readFile(join(repo, drawingPath), 'utf8'), stages = {}, studio = {};
  f.report.drawingSHA256 = sha256(drawing);
  f.phase = 'typed bracket creation and measured first failure';
  await writeFile(part, JSON.stringify(empty));
  await mcp(part, 'authoring', async invoke => {
    let calls = 0;
    const call = (...args) => {
      assert.ok(++calls <= 14, 'Authoring exceeded the tool-call budget');
      return invoke(...args);
    };
    await call('features', { action: 'parameters', add: { H: 24 } });
    await call('features', { action: 'add', features: nodes });
    await call('requirements', { action: 'set', requirements });
    const failing = await call('requirements', { action: 'check' });
    assert.deepEqual(failing.summary, { pass: 4, fail: 1, unknown: 0, hard_failing: 1 });
    assert.deepEqual(failing.failures.map(item => [item.req_id, item.measured]), [['BORE', 8]]);
    f.report.firstEvidence = await evidence(call, 'first', expected(24, 8));
    const firstBytes = await readFile(part);
    stages.first = await f.inspect('first-native', {}, part);

    f.phase = 'refuse an atomic change and make one measured correction';
    const refused = await call('features', { action: 'batch', ops: [
      { tool: 'features', args: { action: 'parameters', add: { Trial: 2 } } },
      { tool: 'features', args: { action: 'edit', index: 99, feature: bore(3) } },
    ] }, true);
    assert.equal(refused.failed_op, 1);
    assert.equal(refused.kept, 'nothing was applied');
    assert.deepEqual(await readFile(part), firstBytes);
    await call('features', { action: 'edit', index: 5, feature: bore(3) });
    const corrected = await call('requirements', { action: 'check' });
    assert.deepEqual(corrected.summary, { pass: 5, fail: 0, unknown: 0, hard_failing: 0 });
    f.report.correctedEvidence = await evidence(call, 'corrected', expected(24, 6));
    f.report.authoringCalls = calls;
    stages.corrected = await f.inspect('corrected-native', {}, part);
    assert.equal(stages.first.key, stages.corrected.key);
  });
  const corrected = await readFile(part), correctedDoc = JSON.parse(corrected);
  assert.deepEqual(correctedDoc.nodes.map(node => node.kind), nodes.map(node => node.kind));
  assert.equal(correctedDoc.nodes[5].radius, 3);

  f.phase = 'actual Studio opens and edits the repaired bracket';
  await f.newPage();
  await open(corrected);
  await f.page.locator('.req.pass[aria-label="Requirement BORE"]').waitFor();
  studio.opened = state(await f.snapshot('01-corrected-open'));
  const edited = await f.setParameter('H', 26, '02-edit-height');
  await f.page.locator('.req.fail[aria-label="Requirement HEIGHT"]').waitFor();
  studio.edited = state(edited);
  assert.deepEqual(edited.doc.nodes, correctedDoc.nodes);
  await f.undo();
  await f.same(correctedDoc);
  studio.undo = state(await f.snapshot('03-undo-height'));
  await f.redo();
  await f.same(edited.doc);
  studio.redo = state(await f.snapshot('04-redo-height'));

  f.phase = 'save the edited bracket to a browser project and open the exact bytes';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByLabel('Browser project name', { exact: true }).fill(project);
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
  assert.deepEqual(JSON.parse(saved), edited.doc);
  const savedPath = join(f.output, 'saved-opfs.bcad');
  await writeFile(savedPath, saved);
  f.report.files.push({ file: savedPath, hash: sha256(saved), source: 'Actual Studio OPFS' });
  await f.newPage();
  await open(saved);
  await f.page.locator('.req.fail[aria-label="Requirement HEIGHT"]').waitFor();
  studio.reopened = state(await f.snapshot('05-reopened-height'));
  await mcp(savedPath, 'fresh', async call => {
    f.report.savedEvidence = await evidence(call, 'saved', expected(26, 6));
  });
  assert.deepEqual(await readFile(savedPath), saved);
  stages.saved = await f.inspect('saved-native', {}, savedPath);
  await f.runOracle({ drawing, stages, studio }, 'drawing-native-studio-geometry');
  assert.deepEqual(f.report.downloads, []);
});
