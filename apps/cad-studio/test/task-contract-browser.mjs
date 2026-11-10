// D584. Run under the heavy gate from apps/cad-studio with D584_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an artifact directory outside the worktree');

const pins = [
  'apps/cad-studio/test/task-contract-browser.mjs',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/editInPlace.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/storage/project.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/ui/InstancePanel.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/OutlinerInstances.tsx',
  'apps/cad-studio/src/viewport/SceneViewport.tsx',
  'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/team/assembly.ts',
  'packages/barocss-cad-model/src/team/ecr.ts',
  'packages/barocss-cad-model/src/team/parts.ts',
  'packages/barocss-cad-model/src/team/taskExecution.ts',
  'packages/barocss-cad-model/src/team/taskPlan.ts',
];

const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { userToken } from '@barocss/cad-model/team/ecr';
import { interfacesRevision } from '@barocss/cad-model/team/interfaces';
import { compileTaskPlan, taskPlanImpact, type TaskRequest } from '@barocss/cad-model/team/taskPlan';
import { applyTaskDecision, bindTaskDecision, buildTaskCandidate, type TaskContext } from '@barocss/cad-model/team/taskExecution';

function success<T>(result: T | { error: { code: string; message: string } }): T {
  if (result && typeof result === 'object' && 'error' in result) assert.fail(JSON.stringify(result.error));
  return result as T;
}

const [, , , options] = process.argv;
const { approvedFile } = JSON.parse(options);
const stated = <T>(value: T, source: string) => ({ value, source, basis: 'stated' as const, said: 'verified' as const });
const brief: NonNullable<StudioDoc['brief']> = {
  version: 1,
  purpose: stated('Two independently machined housing plates', 'Make separate base and lid plates for a housing.'),
  process: stated('cnc-milling', 'CNC mill both plates.'),
  material: stated('al6061', 'Use 6061 aluminum for both plates.'),
};
const plate = (id: string, width: number, depth: number, current: number, target: number): StudioDoc => ({
  ...rectanglePart(width, depth, current),
  brief: structuredClone(brief),
  requirements: [{
    id: id + '-height', source: 'Make the ' + id + ' ' + target + ' mm high in its local Z frame.',
    basis: 'stated', said: 'verified', hard: true,
    check: { query: { fn: 'bbox', axis: 'z' }, op: '==', value: target, tol: 0.01, unit: 'mm' },
  }],
});
const doc: StudioDoc = {
  ...emptyDoc(), brief,
  instances: [
    { id: 'p1', name: 'Housing Base', position: [0, 0, 0], rotation: [0, 0, 0], doc: plate('base', 20, 10, 5, 6) },
    { id: 'p2', name: 'Housing Lid', position: [45, 0, 0], rotation: [0, 0, 0], doc: plate('lid', 12, 8, 3, 4) },
  ],
};
const baseline = structuredClone(doc);
const tasks: TaskRequest[] = doc.instances!.map((instance, i) => ({
  id: i === 0 ? 'base' : 'lid', holder: i === 0 ? 'base-worker' : 'lid-worker',
  occurrence: instance.id, feature: instance.doc.nodes[1].id!,
  capability: 'extrusion-height', units: 'mm', frame: 'part-local-z', dependsOn: [],
}));
const identity = { projectId: 'd584-housing', documentId: 'd584-assembly' };
const policyRevision = 'd584-fixture-policy';
const plan = success(compileTaskPlan(doc, { identity, policyRevision, maxTasks: 2, throughSequence: 2, tasks }));
const contract = interfacesRevision(doc);
const context: TaskContext = {
  activePlan: plan, identity, policyRevision, sequence: 1,
  leases: new Map(tasks.map(task => [task.occurrence, { part: task.occurrence, holder: task.holder, contract, until: 2 }])),
};
assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.tasks) && plan.tasks.every(Object.isFrozen));
let revision = 0;
const evaluate = async (candidate: StudioDoc) => evaluatePart(candidate, ++revision, 8, 'agent');
const assembly = await evaluate(doc);
assert.ok(assembly.ok, JSON.stringify(assembly));
const state = { doc, bodies: assembly.bodies };
const candidates = [];
for (const [i, task] of plan.tasks.entries()) {
  const result = success(await buildTaskCandidate(plan, state, {
    taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest, heightMm: i === 0 ? 6 : 4,
  }, { ...context, worker: task.holder }, evaluate));
  assert.equal(result.specRevision, plan.specRevision);
  assert.equal(result.inputDigest, task.inputDigest);
  assert.equal(result.taskId, task.id);
  assert.deepEqual(result.gates, ['lease', 'validity', 'contract', 'assembly']);
  assert.equal(result.checks.length, 1);
  assert.equal(result.checks[0].status, 'pass');
  assert.equal(result.checks[0].hard, true);
  assert.ok(Math.abs(result.checks[0].measured! - (i === 0 ? 6 : 4)) <= 1e-8);
  candidates.push(result);
}
assert.deepEqual(state.doc, baseline);
assert.notEqual(candidates[0].candidateDigest, candidates[1].candidateDigest);

const forged = bindTaskDecision(candidates[0], true, { by: 'user', at: '2026-11-10T00:00:00Z' });
assert.ok('error' in forged);
assert.equal(forged.error.code, 'TASK_DECISION_UNTRUSTED');
const decision = success(bindTaskDecision(candidates[0], true, userToken('2026-11-10T00:00:00Z')));
assert.equal(decision.candidateDigest, candidates[0].candidateDigest);
const accepted = success(await applyTaskDecision(decision, state, context, evaluate));
assert.deepEqual(accepted.decision, decision);
assert.deepEqual(state.doc, baseline);
assert.deepEqual(accepted.doc.instances![1], baseline.instances![1]);
assert.equal(accepted.doc.proposals?.length, 1);
assert.equal(accepted.doc.proposals?.[0].status, 'accepted');
assert.equal(accepted.doc.proposals?.[0].id, candidates[0].proposalId);
assert.equal(accepted.doc.proposals?.[0].decided?.by, 'user');
assert.equal(accepted.doc.history?.at(-1)?.kind, 'accept');

async function localGeometry(assembly: StudioDoc) {
  const facts = [];
  for (const instance of assembly.instances!) {
    const result = await evaluate(instance.doc);
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.bodies.length, 1);
    const [body] = result.bodies;
    facts.push({ id: instance.id, bounds: body.mesh.bounds, volume: body.volume, centroid: body.centroid });
  }
  return facts;
}

const baselineGeometry = await localGeometry(baseline);
const approvedGeometry = await localGeometry(accepted.doc);
const impact = taskPlanImpact(plan, accepted.doc, identity, policyRevision);
assert.deepEqual(impact.map(({ id, state }) => [id, state]), [['base', 'stale'], ['lid', 'current']]);
writeFileSync(approvedFile, encodeStudioFile(accepted.doc));
console.log(JSON.stringify({ plan, candidates, decision, baseline, baselineGeometry, approvedGeometry, impact }));
`;

const f = await createFlow({
  name: 'task-contract', envFrozen: 'D584_SOURCE_FROZEN', output,
  qualification: 'D584 two task candidates, one host approval, desktop Studio native Open, Save, fresh Open and local re-edit',
  initialFiles: pins, requiredFrozen: pins, inspectorSource,
  limits: [
    'Two independent upright rectangular occurrences, one hard local Z requirement per part.',
    'The bundled local test host admits the plan, evaluates both candidates and supplies a trusted approval for the base. Studio consumes the accepted native document through its existing file controls.',
    'The fresh Studio context edits the lid through Edit part after verifying the approved file. This is an ordinary Studio edit after the task approval and OPFS round trip.',
  ],
});

const tolerance = 1e-8;
const approvedName = 'D584-approved-housing.bcad';
const projectName = 'D584 task contract';
const button = name => f.page.getByRole('button', { name, exact: true });
const dirty = () => f.page.getByLabel('Unsaved changes', { exact: true });
const banner = () => f.page.getByRole('status', { name: 'Editing a part in place', exact: true });

const prism = (width, depth, height) => ({
  sizeMm: [width, depth, height],
  volumeMm3: width * depth * height,
  centroidMm: [width / 2, depth / 2, height / 2],
});
function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected}`);
}
function vector(actual, expected, label) {
  assert.equal(actual?.length, expected.length, label);
  for (const [i, value] of expected.entries()) near(actual[i], value, `${label} [${i}]`);
}
function localMass(body, expected, label) {
  near(body.volume, expected.volumeMm3, `${label} volume`);
  vector(body.centroid, expected.centroidMm, `${label} centroid`);
}
function placedBounds(facts, id, min, max) {
  const fact = facts.find(item => item.id === id);
  assert.ok(fact, id);
  vector(fact.min, min, `${id} min`);
  vector(fact.max, max, `${id} max`);
}

async function publicOpen(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: approvedName, mimeType: 'application/json', buffer: bytes });
}

async function assemblyState(label, expected, lidHeight = 3) {
  const baseRow = f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Housing Base' });
  const lidRow = f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Housing Lid' });
  await baseRow.waitFor();
  await lidRow.waitFor();
  await f.ready();
  await f.page.waitForFunction(height => {
    const items = window.__studioInstanceBounds?.();
    return items?.length === 2 && items.find(item => item.id === 'p1')?.max?.[2] === 6
      && items.find(item => item.id === 'p2')?.max?.[2] === height;
  }, lidHeight, { timeout: 60000 });
  const snapshot = await f.snapshot(label, () => ({ placed: window.__studioInstanceBounds() }));
  assert.deepEqual(snapshot.doc, expected);
  assert.deepEqual(snapshot.placed.map(item => item.id).sort(), ['p1', 'p2']);
  placedBounds(snapshot.placed, 'p1', [0, 0, 0], [20, 10, 6]);
  placedBounds(snapshot.placed, 'p2', [45, 0, 0], [57, 8, lidHeight]);
}

async function enterPart(name, expectedLocal, geometry, label) {
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).click();
  const panel = f.page.getByRole('complementary', { name: 'Instance', exact: true });
  await panel.getByRole('button', { name: 'Edit part', exact: true }).click();
  await banner().waitFor();
  assert.match(await banner().innerText(), new RegExp('Editing ' + name));
  await f.page.waitForFunction(() => !window.__studioDoc?.instances?.length && window.__studioDoc?.nodes.length === 2);
  await f.ready();
  const snap = await f.snapshot(label);
  assert.deepEqual(snap.doc, expectedLocal);
  assert.equal(snap.bodies.bodies.length, 1);
  localMass(snap.bodies.bodies[0], geometry, label);
}

async function finishPart() {
  await banner().getByRole('button', { name: 'Finish', exact: true }).click();
  await banner().waitFor({ state: 'hidden' });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  f.report.absoluteTolerance = tolerance;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) return route.abort();
        return route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  f.phase = '01 admit and verify two native candidates, then approve only the base in the host';
  const approvedFile = join(f.output, approvedName);
  const host = await f.inspect('host-task-contract', {}, { approvedFile });
  const bytes = await readFile(approvedFile);
  const accepted = JSON.parse(bytes);
  assert.equal(accepted.proposals[0].id, host.candidates[0].proposalId);
  assert.equal(host.plan.specRevision, host.decision.specRevision);
  assert.equal(host.plan.baselineDigest, host.candidates[0].baselineDigest);
  const baselinePrisms = [prism(20, 10, 5), prism(12, 8, 3)];
  const candidatePrisms = [prism(20, 10, 6), prism(12, 8, 4)];
  for (const [i, fact] of host.baselineGeometry.entries()) {
    localMass(fact, baselinePrisms[i], `baseline ${fact.id}`);
    vector(fact.bounds.min, [0, 0, 0], `baseline ${fact.id} min`);
    vector(fact.bounds.max, baselinePrisms[i].sizeMm, `baseline ${fact.id} max`);
    const approved = i === 0 ? candidatePrisms[i] : baselinePrisms[i];
    const actual = host.approvedGeometry[i];
    localMass(actual, approved, `approved ${fact.id}`);
    vector(actual.bounds.min, [0, 0, 0], `approved ${fact.id} min`);
    vector(actual.bounds.max, approved.sizeMm, `approved ${fact.id} max`);
    const candidate = host.candidates[i];
    vector(candidate.geometry.sizeMm, candidatePrisms[i].sizeMm, `candidate ${candidate.taskId} size`);
    near(candidate.geometry.volumeMm3, candidatePrisms[i].volumeMm3, `candidate ${candidate.taskId} volume`);
    vector(candidate.geometry.centroidMm, candidatePrisms[i].centroidMm, `candidate ${candidate.taskId} centroid`);
  }
  const expectedBase = structuredClone(host.baseline.instances[0]);
  expectedBase.doc.nodes[1].height = 6;
  assert.deepEqual(accepted.instances, [expectedBase, host.baseline.instances[1]]);
  f.report.files.push({ file: approvedFile, hash: sha256(bytes), source: 'trusted test host via encodeStudioFile' });
  f.report.observations.push({ label: 'host approval and independent prism comparisons', ...host });
  await f.persist();

  f.phase = '02 public Open of the exact host-approved bytes';
  await f.newPage();
  await publicOpen(bytes);
  await assemblyState('02-approved-open', accepted);
  assert.equal(await dirty().isVisible(), false);

  f.phase = '03 inspect the approved base in its local Studio edit session';
  await enterPart('Housing Base', accepted.instances[0].doc, candidatePrisms[0], '03-approved-base-local');
  await finishPart();
  await assemblyState('04-assembly-after-read', accepted);
  assert.equal(await dirty().isVisible(), false);

  f.phase = '04 save through the Studio project UI to OPFS';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(approvedName, { exact: true }).waitFor();
  await dirty().waitFor({ state: 'hidden' });
  const savedBytes = Buffer.from(await f.page.evaluate(async ({ projectName, approvedName }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const project = await projects.getDirectoryHandle(projectName);
    const handle = await project.getFileHandle(approvedName);
    return [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
  }, { projectName, approvedName }));
  assert.deepEqual(JSON.parse(savedBytes), accepted);
  const savedFile = join(f.output, 'saved-project-document.bcad');
  await writeFile(savedFile, savedBytes);
  f.report.files.push({ file: savedFile, hash: sha256(savedBytes), source: 'OPFS', semanticEquality: true, byteEquality: savedBytes.equals(bytes) });
  await assemblyState('05-project-saved', accepted);

  f.phase = '05 fresh public Open of the actual OPFS bytes';
  const previousContext = f.context;
  await f.newPage();
  assert.notEqual(f.context, previousContext);
  await publicOpen(savedBytes);
  await assemblyState('06-fresh-open', accepted);
  assert.equal(await dirty().isVisible(), false);

  f.phase = '06 re-edit only the lid with the ordinary Studio feature editor';
  await enterPart('Housing Lid', accepted.instances[1].doc, baselinePrisms[1], '07-original-lid-local');
  await f.openFeatureEditor(1, 'lid extrusion');
  const distance = f.editor().getByRole('spinbutton', { name: 'Distance', exact: true });
  assert.equal(await distance.inputValue(), '3');
  await distance.fill('4');
  const before = await f.doc();
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(before);
  await f.closeEditor();
  const editedLocal = await f.snapshot('08-edited-lid-local');
  const expected = structuredClone(accepted);
  expected.instances[1].doc.nodes[1].height = 4;
  assert.deepEqual(editedLocal.doc, expected.instances[1].doc);
  assert.equal(editedLocal.bodies.bodies.length, 1);
  localMass(editedLocal.bodies.bodies[0], candidatePrisms[1], 'edited lid');
  await finishPart();
  await assemblyState('09-lid-edit-finished', expected, 4);
  await dirty().waitFor();
  assert.deepEqual(f.report.downloads, []);
});
