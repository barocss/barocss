import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart, rebuildFromScratch } from '../src/engine/evaluate';
import { rectanglePart } from '../src/engine/doc';
import { MeshSender, MeshReceiver } from '../src/engine/meshWire';
import { rebuildReport } from '../src/team/rebuild';
import { dispatchTool } from '../src/chat/tools';
import { outputSchemaOf, validate } from '../src/chat/contract';

test('Kernel and evaluation seconds survive the actual mesh wire clone without another conversion', () => {
  const doc = rectanglePart(14, 19, 6), result = rebuildFromScratch(doc, 31); assert.ok(result.ok && result.rebuild);
  const profile = result.rebuild.profile;
  for (const p of Object.values(profile)) { assert.ok(Number.isFinite(p.wallTime) && p.wallTime >= 0); assert.equal('ms' in p, false); }
  const packed = new MeshSender().pack('evaluate', result), clone = new MeshReceiver().unpack('evaluate', structuredClone(packed.result)); assert.ok(clone.ok && clone.rebuild);
  assert.deepEqual(clone.rebuild, result.rebuild); assert.equal(clone.wallTime, result.wallTime);
  const report = rebuildReport(doc, clone)!;
  for (const f of report.features) { assert.equal(f.wallTime, profile[f.id].wallTime, 'Kernel seconds are not divided again'); assert.equal('ms' in f, false); }
  assert.equal(report.evaluationTime, result.wallTime);
  assert.equal(report.builtTime, report.features.filter(f => f.state === 'built').reduce((sum, f) => sum + f.wallTime, 0));
  assert.equal('evaluationMs' in report || 'builtMs' in report, false);
  const [id] = Object.keys(profile), controlled = { ...clone, wallTime: 2.5, rebuild: { evaluated: [id], reused: [], profile: { [id]: { wallTime: .125, calls: profile[id].calls } } } };
  const known = rebuildReport(doc, controlled)!;
  assert.deepEqual([known.evaluationTime, known.builtTime, known.features[0].wallTime], [2.5, .125, .125]);
  assert.deepEqual(result.bodies, clone.bodies, 'no body values changed by time reporting');
});

test('public rebuild tool emits canonical seconds and its schema rejects old time aliases', async () => {
  const doc = rectanglePart(14, 19, 6), r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const state = { doc, bodies: r.bodies }, tool = await dispatchTool(state, 'rebuild_report', {}, async d => evaluatePart(d, 1));
  assert.equal(tool.isError, false); assert.equal(tool.changed, false); assert.equal(tool.state.doc, doc);
  const report = JSON.parse(tool.content), schema = outputSchemaOf('rebuild_report')!;
  assert.deepEqual(validate(schema, report), []);
  assert.ok(report.features.every((f: Record<string, unknown>) => typeof f.wallTime === 'number' && !('ms' in f)));
  assert.equal('evaluationMs' in report || 'builtMs' in report, false);
  assert.ok(tool.summary.includes(`${(report.builtTime * 1000).toFixed(1)} ms`), 'human summary keeps ms with one display conversion');
  const { evaluationTime, builtTime, ...rest } = report;
  assert.ok(validate(schema, { ...rest, evaluationMs: evaluationTime * 1000, builtMs: builtTime * 1000 }).length > 0);
});
