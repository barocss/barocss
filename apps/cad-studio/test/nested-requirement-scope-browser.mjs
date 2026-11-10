import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/src/ui/NestedPartPanel.tsx', 'apps/cad-studio/src/assembly/nestedSelection.ts',
  'packages/barocss-cad-model/src/engine/occurrences.ts', 'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/chat/assembly.ts', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/team/freshness.ts', 'packages/barocss-cad-model/src/team/requirementScope.ts', 'packages/barocss-cad-model/src/engine/shopRows.ts',
  'packages/barocss-cad-model/src/assembly/looks.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { evaluatePart, partBreps } from '@barocss/cad-model/engine/evaluate';
import { readFileSync } from 'node:fs';
const loaded = await readStudioFile(readFileSync(JSON.parse(process.argv[3])));
assert.ok('doc' in loaded);
const parts = [];
for (const host of loaded.doc.instances ?? []) {
  for (const child of host.doc.instances ?? []) {
    const { doc } = child;
    const result = evaluatePart(doc, 1);
    assert.ok(result.ok);
    assert.equal(result.bodies.length, 1);
    const [{ brep }] = partBreps(doc);
    assert.ok(checkBrep(brep, { strict: true }).valid);
    const [{ volume, centroid }] = result.bodies;
    parts.push({ path: [host.id, child.id].join('/'), volume, centroid, points: brep.vertices.map(vertex => vertex.point) });
  }
}
console.log(JSON.stringify(parts));
`;
const oracleSource = String.raw`
import math, json, sys
data = json.load(sys.stdin)
for path, height, density, expected_verdict in [('p1/p1', 4, 2.7e-3, 'pass'), ('p2/p1', 7, 7.85e-3, 'fail')]:
    n = next(n for n in data['native'] if n['path'] == path)
    local = data['local'][path]
    studio = data['studio'][path]
    expected = 20 * 10 * height
    assert math.isclose(n['volume'], expected, rel_tol=0, abs_tol=1e-8)
    assert all(math.isclose(v, x, rel_tol=0, abs_tol=1e-8) for v,x in zip(n['centroid'], [10,5,height/2], strict=True))
    assert [min(p) for p in zip(*n['points'], strict=True)] == [0,0,0]
    assert [max(p) for p in zip(*n['points'], strict=True)] == [20,10,height]
    assert studio == expected
    assert local['height'] == [height, expected_verdict]
    assert math.isclose(local['mass'][0], expected * density, rel_tol=0, abs_tol=1e-8)
    for stage in ['before', 'reopened']:
        actual = data[stage][path]
        assert actual['height'] == [height, expected_verdict]
        assert math.isclose(actual['mass'][0], expected * 7.85e-3, rel_tol=0, abs_tol=1e-8)
print(json.dumps({'status':'PASS','scopeCount':2,'volumeToleranceMm3':1e-8}))
`;
const f = await createFlow({
  name: 'nested-requirement-scope', envFrozen: 'D604_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  inspectorSource, oracleSource, qualification: 'Root-scoped nested requirement evidence and desktop project Save/Open',
  limits: ['Two authored nested leaves with a reused child ID. Requirement measurements use definition coordinates with occurrence material overrides.'],
});

const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const heightCheck = { id: 'HEIGHT', source: 'Plate height maximum 5 mm', basis: 'stated', hard: true,
  check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 5, unit: 'mm' } };
const massCheck = { id: 'MASS', source: 'Plate mass maximum 20 g', basis: 'stated', hard: true,
  check: { query: { fn: 'mass' }, op: '<=', value: 20, unit: 'g' } };
const plate = (height, w = 20, d = 10) => ({
  ...empty, nextId: 2, nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] },
    { id: 'n1', kind: 'extrude', sketch: 0, height },
  ], outputs: { b1: { node: 1, side: 'solid' } },
});
const instance = (id, name, doc, position, looks) => ({ id, name, doc, position, rotation: [0, 0, 0], ...(looks ? { looks } : {}) });
const host = (height, material) => ({ ...empty, instances: [
  instance('p1', 'Leaf plate', { ...plate(height), requirements: [heightCheck, massCheck] }, [0, 0, 0], { b1: { material } }),
] });
const initial = {
  ...plate({ parameter: 'H' }, 6, 6), parameters: { H: 2 },
  requirements: [{ ...heightCheck, source: 'Root datum height maximum 2 mm', check: { ...heightCheck.check, value: 2 } }],
  instances: [
    instance('p1', 'Left module', host(4, 'al6061'), [30, 0, 8], { 'p1/b1': { material: 'steel' } }),
    instance('p2', 'Right module', host(7, 'steel'), [60, 0, 15]),
  ],
};
const button = name => f.page.getByRole('button', { name, exact: true });
const filename = 'D602-nested-scopes.bcad', project = 'D602 nested scopes';
const evidence = (part, expectedRevision) => ({ name: 'requirements', arguments: { action: 'evidence', part, ...(expectedRevision ? { expectedRevision } : {}) } });
const assembly = { name: 'assembly', arguments: { action: 'get' } };
const paths = ['p1/p1', 'p2/p1'];

async function mcp(file, label, calls) {
  const initialBytes = await readFile(file);
  const frames = [
    { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    ...calls.map((params, i) => ({ id: i + 2, method: 'tools/call', params })),
  ];
  const run = spawnSync(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', file], {
    input: frames.map(frame => JSON.stringify({ jsonrpc: '2.0', ...frame }) + '\n').join(''),
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(output, label + '-mcp.jsonl'), run.stdout ?? '');
  await writeFile(join(output, label + '-mcp.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  const responses = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(responses.map(reply => reply.id), frames.map(frame => frame.id));
  assert.equal(responses[0].result.serverInfo.version, 'barocss-cad-tools-v2');
  assert.deepEqual(await readFile(file), initialBytes);
  return responses.slice(1).map(({ result }) => ({ error: result.isError, body: JSON.parse(result.content[0].text) }));
}

function report(reply, part) {
  assert.equal(reply.error, false, JSON.stringify(reply));
  const [file] = reply.body.files;
  assert.equal(file.sha256, sha256(file.text));
  assert.equal(file.bytes, Buffer.byteLength(file.text));
  const data = JSON.parse(file.text);
  assert.equal(data.part, part);
  assert.equal(data.revision, reply.body.revision);
  return data;
}
function requireRefusal(reply, pattern) {
  assert.equal(reply.error, true, JSON.stringify(reply));
  assert.match(reply.body.error, pattern);
  assert.equal(reply.body.files, undefined);
}
function rows(data) {
  return Object.fromEntries(data.evidence.filter(row => row.requirement).map(({ result, freshness }) => {
    assert.deepEqual([result.status, freshness.state, result.run], ['ok', 'current', data.revision]);
    assert.equal(result.part ?? 'base', data.part);
    return [result.subject.toLowerCase(), [result.number, result.verdict]];
  }));
}

function checkSummary(reply) {
  assert.equal(reply.error, false, JSON.stringify(reply));
  const actual = reply.body.instances.map(({ id, bodies, volume, world_bounds, error }) => ({ id, bodies, volume, world_bounds, error }));
  assert.deepEqual(actual, [
    { id: 'p1', bodies: 1, volume: 800, world_bounds: { min: [30, 0, 8], max: [50, 10, 12] }, error: undefined },
    { id: 'p2', bodies: 1, volume: 1400, world_bounds: { min: [60, 0, 15], max: [80, 10, 22] }, error: undefined },
  ]);
  return actual;
}

async function checkStudioBounds(actual) {
  const expected = actual.map(({ id, world_bounds }) => ({ id, ...world_bounds }));
  await f.page.waitForFunction(expected => {
    const bounds = window.__studioInstanceBounds?.();
    return bounds?.length === expected.length && expected.every(({ id, min, max }) => {
      const item = bounds.find(item => item.id === id);
      return item?.min && item.max && [item.min, item.max].every((coords, index) =>
        coords.every((value, axis) => Math.abs(value - [min, max][index][axis]) < 1e-6));
    });
  }, expected);
}

async function checkBrokenHost() {
  const broken = structuredClone(initial);
  broken.instances[0].doc.instances[0].doc.nodes[1].height = 0;
  const file = join(output, 'broken-host.bcad');
  await writeFile(file, JSON.stringify(broken));
  const [listed] = await mcp(file, 'broken-host', [assembly]);
  assert.equal(listed.error, false, JSON.stringify(listed));
  const [bad, healthy] = listed.body.instances;
  assert.equal(typeof bad.error, 'string');
  assert.ok(bad.error.length > 0);
  assert.deepEqual([bad.bodies, bad.volume, bad.world_bounds], [undefined, undefined, undefined]);
  assert.deepEqual([healthy.bodies, healthy.volume, healthy.error], [1, 1400, undefined]);
  f.report.failedHost = bad.error;
}

async function selectLeaves(label) {
  const card = f.page.getByRole('complementary', { name: 'Nested part', exact: true });
  const volumes = {};
  for (const [i, name] of ['Left module', 'Right module'].entries()) {
    const path = paths[i], expected = [800, 1400][i];
    const leaf = f.page.locator(`.ol.instance.nested[data-path="${path}"]`);
    if (!(await leaf.isVisible())) await button('Show the parts of ' + name).click();
    await leaf.click();
    await card.getByTestId('nested-path').getByText(path, { exact: true }).waitFor();
    await card.getByText(expected + ' mm³', { exact: true }).waitFor();
    volumes[path] = expected;
    await f.snapshot(label + '-' + i);
  }
  return volumes;
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
  const original = join(output, filename);
  await writeFile(original, JSON.stringify(initial));
  f.phase = 'establish the current MCP boundary and the independent native geometry';
  const [listed, root, left, right, short] = await mcp(original, 'before', [assembly, evidence('base'), ...paths.map(path => evidence(path)), evidence('p1')]);
  assert.equal(listed.error, false);
  assert.deepEqual(listed.body.instances.flatMap(i => i.parts_inside.map(p => p.path)), paths);
  f.report.initialAssemblySummary = checkSummary(listed);
  const before = report(root, 'base');
  assert.deepEqual(rows(before).height, [2, 'pass']);
  const reports = [report(left, paths[0]), report(right, paths[1])];
  assert.ok(reports.every(item => item.revision === before.revision && item.documentRevision === before.documentRevision));
  assert.notEqual(reports[0].definitionRevision, reports[1].definitionRevision);
  assert.notEqual(reports[0].evidence[0].result.id, reports[1].evidence[0].result.id);
  requireRefusal(short, /OUTPUT_INPUT.*Part p1 has no requirements list/);
  const [missing, malformed] = await mcp(original, 'bad-paths', [evidence('p1/p9'), evidence('p1//p1')]);
  requireRefusal(missing, /OUTPUT_INPUT.*No part p1\/p9/);
  requireRefusal(malformed, /OUTPUT_INPUT.*Invalid occurrence path/);
  const native = await f.inspect('native-leaves', {}, original);

  const local = {}, localRevisions = [];
  for (const [i, inst] of initial.instances.entries()) {
    const file = join(output, 'isolated-host-' + i + '.bcad');
    await writeFile(file, JSON.stringify(inst.doc));
    const [current] = await mcp(file, 'isolated-host-' + i, [evidence('p1')]);
    const inner = report(current, 'p1');
    local[paths[i]] = rows(inner);
    localRevisions.push(inner.revision);
  }
  assert.notEqual(localRevisions[0], localRevisions[1]);
  const duplicate = join(output, 'ambiguous-local-host.bcad'), hostDoc = initial.instances[0].doc;
  await writeFile(duplicate, JSON.stringify({ ...hostDoc, instances: [...hostDoc.instances, ...hostDoc.instances] }));
  const [ambiguous] = await mcp(duplicate, 'ambiguous-local-host', [evidence('p1')]);
  requireRefusal(ambiguous, /OUTPUT_INPUT.*Ambiguous part p1/);

  const ambiguousRoot = structuredClone(initial);
  ambiguousRoot.instances[0].doc.instances.push(ambiguousRoot.instances[0].doc.instances[0]);
  const ambiguousFile = join(output, 'ambiguous-root.bcad');
  await writeFile(ambiguousFile, JSON.stringify(ambiguousRoot));
  const [ambiguousPath, healthy] = await mcp(ambiguousFile, 'ambiguous-root', paths.map(path => evidence(path)));
  requireRefusal(ambiguousPath, /OUTPUT_INPUT.*Ambiguous part p1\/p1/);
  assert.deepEqual(rows(report(healthy, paths[1])), rows(reports[1]));

  f.phase = 'actual Studio selects the distinct leaf paths and saves a new root revision';
  await f.newPage();
  await f.openFile(original, 2);
  await f.same(initial);
  const studio = await selectLeaves('before');
  await checkStudioBounds(f.report.initialAssemblySummary);
  await f.page.keyboard.press('Escape');
  const edited = await f.setParameter('H', 3, 'root-height-edited');
  assert.deepEqual(edited.doc.instances, initial.instances);
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ({ project, filename }) => {
    const storage = await navigator.storage.getDirectory();
    const folder = await (await storage.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await folder.getFileHandle(filename)).getFile()).text();
  }, { project, filename });
  assert.deepEqual(JSON.parse(saved), edited.doc);
  const savedFile = join(output, 'saved-opfs.bcad');
  await writeFile(savedFile, saved);

  f.phase = 'fresh Studio Open and fresh MCP retain exact identity and refusal';
  await f.newPage();
  await f.openFile(savedFile, 2);
  await f.same(edited.doc);
  assert.deepEqual(await selectLeaves('reopened'), studio);
  const [stale, staleNested, current, newLeft, newRight, reopenedAssembly] = await mcp(savedFile, 'reopened', [
    evidence('base', before.revision), evidence(paths[0], reports[0].revision), evidence('base'),
    ...paths.map(path => evidence(path)), assembly,
  ]);
  f.report.reopenedAssemblySummary = checkSummary(reopenedAssembly);
  await checkStudioBounds(f.report.reopenedAssemblySummary);
  await checkBrokenHost();
  requireRefusal(stale, /OUTPUT_STALE/);
  requireRefusal(staleNested, /OUTPUT_STALE/);
  const newRoot = report(current, 'base');
  assert.deepEqual(rows(newRoot).height, [3, 'fail']);
  const reopened = [report(newLeft, paths[0]), report(newRight, paths[1])];
  for (const [i, item] of reopened.entries()) {
    assert.equal(item.revision, newRoot.revision);
    assert.notEqual(item.revision, reports[i].revision);
    assert.equal(item.definitionRevision, reports[i].definitionRevision);
    assert.deepEqual(rows(item), rows(reports[i]));
  }
  const scoped = reports => Object.fromEntries(reports.map(item => [item.part, rows(item)]));
  await f.runOracle({ native, local, studio, before: scoped(reports), reopened: scoped(reopened) }, 'two-leaf-independent-oracle');
  f.report.observations.push({ paths, local, studio, nestedEvidence: scoped(reopened), outerMaterialOverride: initial.instances[0].looks });
  f.report.files.push({ file: original, hash: sha256(await readFile(original)) }, { file: savedFile, hash: sha256(saved) });
  assert.deepEqual(f.report.downloads, []);
});
