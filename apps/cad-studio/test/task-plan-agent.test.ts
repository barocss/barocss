import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { annotationsOf, outputSchemaOf, validate } from '@barocss/cad-model/chat/contract';
import { dispatchTool, runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { digestOf } from '@barocss/cad-model/util/digest';
import { serveMcp } from '../server/cadMcp';
import { deriveLocalRunPlan } from '../server/taskRun/localPlan';
import { assemblyIdentityDoc, fixtureDoc } from './task-run-fixture';

const occurrences = ['p1', 'p2'];
const call = { action: 'plan_tasks', occurrences };
const noEvaluation = async () => { throw new Error('Planning must not evaluate or dispatch'); };

test('D617 chat and CLI derive the same targets without changing the working document', async () => {
  const doc = fixtureDoc(), state: ChatState = { doc, bodies: [] };
  const expectedRevision = digestOf(doc);
  const result = await runTool(state, 'requirements', { ...call, expectedRevision }, noEvaluation);
  assert.equal(result.isError, false, result.content);
  assert.equal(result.changed, false);
  assert.equal(result.state.doc, doc);
  assert.equal(digestOf(doc), expectedRevision);
  const data = JSON.parse(result.content);
  const cli = deriveLocalRunPlan(doc, '/native/housing.bcad', 'a'.repeat(64), occurrences);
  assert.deepEqual(data, { revision: expectedRevision, status: 'ready', occurrences, issues: [],
    tasks: cli.plan.tasks.map(task => ({ occurrence: task.occurrence, feature: task.feature, field: 'height' })),
    targets: cli.targets });
  assert.deepEqual(validate(outputSchemaOf('inspect_local_task_plan')!, data), []);
  assert.equal(annotationsOf('inspect_local_task_plan').readOnlyHint, true);
});

test('D617 blocked plans expose the affected occurrence and never synthesize its target', async () => {
  const doc = fixtureDoc(), state: ChatState = { doc, bodies: [] };
  doc.instances![1].doc.requirements![0].basis = 'ambiguous';
  const expectedRevision = digestOf(doc);
  const result = await dispatchTool(state, 'requirements', call, noEvaluation);
  assert.equal(result.changed, false);
  assert.equal(result.state, state);
  assert.equal(digestOf(doc), expectedRevision);
  assert.equal(result.isError, false);
  const data = JSON.parse(result.content);
  assert.equal(data.revision, expectedRevision);
  assert.equal(data.status, 'blocked');
  assert.deepEqual(data.occurrences, occurrences);
  assert.deepEqual(data.targets.map((row: { id: string }) => row.id), ['p1']);
  assert.deepEqual(data.issues, [{ code: 'TASK_REQUIRED_UNKNOWN', occurrence: 'p2',
    message: 'p2 has unresolved design inputs: requirement:height:ambiguous.', inputs: ['requirement:height:ambiguous'] }]);
  assert.deepEqual(validate(outputSchemaOf('inspect_local_task_plan')!, data), []);
  assert.throws(() => deriveLocalRunPlan(doc, '/native/housing.bcad', 'a'.repeat(64), occurrences), /unresolved design inputs/);

  const missing = await dispatchTool(state, 'requirements', { ...call, occurrences: ['p1', 'absent'] }, noEvaluation);
  const denied = JSON.parse(missing.content);
  assert.equal(denied.status, 'blocked');
  assert.deepEqual(denied.tasks, []);
  assert.deepEqual(denied.targets, []);
  assert.equal(denied.issues[0].code, 'BAD_TASK');
});

test('D617 refuses stale or malformed revision pins and invalid scope arguments', async () => {
  const doc = fixtureDoc(), previous = digestOf(doc);
  doc.instances![1].doc.requirements![0].check.value = 5;
  const state: ChatState = { doc, bodies: [] }, revision = digestOf(doc);
  const stale = await dispatchTool(state, 'requirements', { ...call, expectedRevision: previous }, noEvaluation);
  assert.equal(stale.isError, true);
  assert.equal(stale.state, state);
  assert.deepEqual(JSON.parse(stale.content), { ok: false, error: '[OUTPUT_STALE] The model changed. Read the local task plan again.', revision });
  const fresh = await dispatchTool(state, 'requirements', { ...call, expectedRevision: revision }, noEvaluation);
  assert.deepEqual(JSON.parse(fresh.content).targets.map((row: { heightMm: number }) => row.heightMm), [6, 5]);
  for (const input of [
    { ...call, expectedRevision: 'wrong' },
    { ...call, occurrences: ['p1', 'p1'] },
    { ...call, occurrences: [] },
    { ...call, occurrences: ['p1', 2] },
    { ...call, dispatch: true },
    { ...call, part: 'p1' },
  ]) {
    const result = await dispatchTool(state, 'requirements', input, noEvaluation);
    assert.equal(result.isError, true, result.content);
    assert.equal(result.changed, false);
    assert.equal(result.state, state);
  }
});

test('D617 MCP preserves authored IDs in both formats and does not write the plan', async () => {
  const doc = fixtureDoc();
  doc.instances![1].doc.requirements![0].id = 'check_spec';
  const input = new PassThrough(), output = new PassThrough(), lines = createInterface({ input: output });
  const replies = lines[Symbol.asyncIterator]();
  const served = serveMcp({
    open: async () => ({ doc, changed: false, version: 0 }),
    save: () => { assert.fail('Planning cannot write a file'); },
  }, input, output);
  try {
    input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'requirements', arguments: call } }) + '\n');
    const response = await replies.next();
    assert.equal(response.done, false);
    const { result } = JSON.parse(response.value);
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, JSON.parse(result.content[0].text));
    assert.equal(result.structuredContent.targets[1].requirementId, 'check_spec');
    assert.deepEqual(validate(outputSchemaOf('inspect_local_task_plan')!, result.structuredContent), []);
  } finally {
    input.end();
    await served;
    output.end();
    lines.close();
  }
});

test('D705 MCP plans against each ID exactly as discovered, including a distinct literal action name', async () => {
  for (const collision of [false, true]) {
    const doc = assemblyIdentityDoc(collision ? 'collision' : 'single');
    const input = new PassThrough(), output = new PassThrough(), lines = createInterface({ input: output });
    const replies = lines[Symbol.asyncIterator]();
    const served = serveMcp({
      open: async () => ({ doc, changed: false, version: 0 }),
      save: () => { assert.fail('Discovery and planning cannot write state'); },
    }, input, output);
    let id = 0;
    const callTool = async (name: string, args: Record<string, unknown>) => {
      input.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }) + '\n');
      const reply = await replies.next();
      assert.equal(reply.done, false);
      const { result } = JSON.parse(reply.value);
      assert.equal(result.isError, false, result.content[0].text);
      const body = JSON.parse(result.content[0].text);
      if (name === 'requirements') assert.deepEqual(result.structuredContent, body);
      return body;
    };
    try {
      const discovery = await callTool('assembly', { action: 'get' });
      const ids = discovery.instances.map((instance: { id: string }) => instance.id);
      const occurrences = collision ? ids.slice(0, 3) : ids;
      const report = await callTool('requirements', { action: 'plan_tasks', occurrences });
      assert.equal(report.status, 'ready', JSON.stringify(report));
      const expected = collision ? ['check_spec', 'p2', 'requirements.check'] : ['check_spec', 'p2'];
      assert.deepEqual(report.tasks, expected.map(occurrence => ({ occurrence, feature: 'n1', field: 'height' })));
      assert.deepEqual(report.targets, [
        { id: 'check_spec', requirementId: 'set_requirements', currentHeightMm: 5, heightMm: 6, toleranceMm: 0.001 },
        { id: 'p2', requirementId: 'height', currentHeightMm: 3, heightMm: 4, toleranceMm: 0.001 },
        ...(collision ? [{ id: 'requirements.check', requirementId: 'get_assembly', currentHeightMm: 2, heightMm: 9, toleranceMm: 0.001 }] : []),
      ]);
      if (collision) {
        const nested = discovery.instances[3].parts_inside[0].path;
        const detail = await callTool('assembly', { action: 'get', faces_of: nested });
        assert.ok(detail.instances[3].faces.some((face: { name: string }) => face.name === 'n1.top'));
        const refused = await callTool('requirements', { action: 'plan_tasks', occurrences: [nested, 'p2'] });
        assert.equal(refused.status, 'blocked');
        assert.deepEqual(refused.tasks, []);
        assert.equal(refused.issues[0].code, 'BAD_TASK');
      }
    } finally {
      input.end();
      await served;
      output.end();
      lines.close();
    }
  }
});
