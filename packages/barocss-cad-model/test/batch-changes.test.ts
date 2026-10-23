import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { acceptProposal, dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { canonical } from '../src/util/revision';
import { receivePersonRowFiles } from '../src/engine/rowFiles';
import { withSampleRows } from './person-file';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
async function stateOf(doc = emptyDoc()): Promise<ChatState> {
  const r = await evaluate(doc); assert.ok(r.ok);
  return { doc, bodies: r.bodies };
}
const fields = { purpose: { value: 'A shaft support', basis: 'stated', source: 'A shaft support' } };
const briefSource = `brief(${JSON.stringify(fields)})`;
const briefOp = { tool: 'set_brief', args: { fields } };

test('batch approval equals direct approval for assembly and drawing changes at L2, L3 and L4', async () => {
  const was = process.env.CAD_AUTONOMY;
  try {
    for (const level of ['2', '3', '4']) {
      process.env.CAD_AUTONOMY = level;
      for (const [tool, args, doc] of [
        ['add_part', { name: 'Shaft' }, emptyDoc()],
        ['set_drawing', { sheet: 'A3' }, rectanglePart(40, 20, 8)],
      ] as const) {
        const s = await stateOf(doc), before = canonical(s.doc);
        const direct = await runTool(s, tool, args, evaluate);
        const batch = await runTool(s, 'apply_ops', { ops: [{ tool, args }] }, evaluate);
        for (const out of [direct, batch]) {
          assert.equal(out.isError, true, `${level}: ${tool}: ${out.content}`);
          assert.equal(out.changed, false);
          assert.equal(JSON.parse(out.content).code, 'needs_approval');
          assert.equal(out.state, s);
        }
        assert.deepEqual(JSON.parse(batch.content).approval, JSON.parse(direct.content).approval);
        assert.equal(canonical(s.doc), before);
      }
    }
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
});

test('script and nested script assembly changes need approval even with an empty feature diff', async () => {
  // (O7: the fastener sizes are the sample rows, loaded as the person loads them.)
  const s = await stateOf(withSampleRows(emptyDoc()));
  const source = 'fastener({kind: "hex-bolt", size: "M6", length: "20", insert: "instance"})';
  const direct = await runTool(s, 'run_command', { command: 'fastener', values: { kind: 'hex-bolt', size: 'M6', length: '20', insert: 'instance' } }, evaluate);
  assert.equal(JSON.parse(direct.content).code, 'needs_approval', direct.content);
  for (const [name, args] of [
    ['run_script', { source }],
    ['apply_ops', { ops: [{ tool: 'run_script', args: { source } }] }],
  ] as const) {
    const out = await runTool(s, name, args, evaluate);
    assert.equal(JSON.parse(out.content).code, 'needs_approval', out.content);
    assert.deepEqual(JSON.parse(out.content).approval, JSON.parse(direct.content).approval);
    assert.equal(out.changed, false); assert.equal(out.state, s);
  }
});

test('a person-approved assembly batch saves and reopens with its part kept', async () => {
  const s = await stateOf();
  const proposal = await runTool(s, 'propose', { title: 'Add shaft', ops: [{ tool: 'add_part', args: { name: 'Shaft' } }] }, evaluate);
  assert.equal(proposal.isError, false, proposal.content);
  assert.equal(s.doc.instances?.length ?? 0, 0);
  const accepted = await acceptProposal(proposal.state, JSON.parse(proposal.content).proposal as string, evaluate);
  assert.ok('state' in accepted, JSON.stringify(accepted));
  const back = await readStudioFile(encodeStudioFile(accepted.state.doc));
  assert.ok('doc' in back);
  assert.equal(back.doc.instances?.length, 1); assert.equal(back.doc.instances?.[0].name, 'Shaft');
  assert.equal(back.doc.proposals?.[0].status, 'accepted');
  assert.ok((await evaluate(back.doc)).ok);
});

test('batch and script report document-only changes: brief, material and frame rows', async () => {
  // (Rows rule b: the section rows come from a file the person supplied in the conversation; agent-written rows are refused.)
  const rows = [{ id: 'own', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, estimate: true }];
  const rowFiles = receivePersonRowFiles('0123456789abcdef01234567', [{ name: 'sections.json', text: JSON.stringify(rows), turn: 1 }], 1);
  const s = { ...await stateOf(rectanglePart(40, 20, 8)), rowFiles };
  for (const op of [{ tool: 'set_frame_sections', args: { rows } }, { tool: 'apply_ops', args: { ops: [{ tool: 'set_frame_sections', args: { rows } }] } }]) {
    const out = await runTool(s, op.tool, op.args, evaluate);
    assert.equal(out.isError, true, out.content); assert.match(out.content, /ROWS_NOT_FROM_PERSON/); assert.equal(out.state, s);
  }
  for (const op of [briefOp, { tool: 'set_material', args: { material: 'steel' } },
    { tool: 'set_frame_sections', args: { file: rowFiles.files[0].id } }]) {
    const direct = await runTool(s, op.tool, op.args, evaluate);
    const batch = await runTool(s, 'apply_ops', { ops: [op] }, evaluate);
    assert.equal(direct.isError, false, direct.content);
    assert.equal(batch.isError, false, batch.content); assert.equal(batch.changed, true, batch.content);
    assert.deepEqual(batch.state.doc, direct.state.doc);
  }
  const script = await runTool(s, 'run_script', { source: briefSource }, evaluate);
  assert.equal(script.isError, false, script.content); assert.equal(script.changed, true);
  assert.deepEqual(script.state.doc, (await runTool(s, briefOp.tool, briefOp.args, evaluate)).state.doc);
});

test('empty, repeated and net-zero batches/scripts have no document change', async () => {
  const s = (await runTool(await stateOf(), 'set_brief', { fields }, evaluate)).state;
  for (const [name, args] of [
    ['apply_ops', { ops: [briefOp] }],
    ['run_script', { source: briefSource }],
    ['run_script', { source: 'const x = 1' }],
    ['apply_ops', { ops: [{ tool: 'set_brief', args: { fields: { purpose: { value: 'A bracket', basis: 'stated', source: 'A bracket' } } } }, briefOp] }],
  ] as const) {
    const out = await runTool(s, name, args, evaluate);
    assert.equal(out.isError, false, out.content); assert.equal(out.changed, false, out.content);
    assert.deepEqual(out.state.doc, s.doc);
  }
  const once = await runTool(s, 'apply_ops', { ops: [{ ...briefOp, opId: 'brief-1' }] }, evaluate);
  const again = await runTool(once.state, 'apply_ops', { ops: [{ ...briefOp, opId: 'brief-1' }] }, evaluate);
  assert.equal(again.changed, false); assert.equal(JSON.parse(again.content).applied[0].skipped, 'already applied');
});

test('dry runs and failures preserve document, bodies and transaction ids after document-only changes', async () => {
  const s = await stateOf(), before = canonical(s);
  for (const [name, args, error] of [
    ['apply_ops', { ops: [{ tool: 'add_part', args: { name: 'Shaft' }, opId: 'shaft' }], dryRun: true }, false],
    ['run_script', { source: briefSource, dryRun: true }, false],
    ['apply_ops', { ops: [briefOp, { tool: 'set_material', args: { material: 'unknown' } }] }, true],
    ['run_script', { source: `${briefSource}\nbox({w: -1})` }, true],
  ] as const) {
    const out = await dispatchTool(s, name, args, evaluate);
    assert.equal(out.isError, error, out.content); assert.equal(out.changed, false); assert.equal(out.state, s);
    assert.equal(canonical(s), before);
  }
});
