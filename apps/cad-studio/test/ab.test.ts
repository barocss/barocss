import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { SYSTEM_PROMPT_JSON, toolsetOf } from '../src/chat/toolset';
import { BRIEFS, type Arm } from '../server/ab/briefs';
import { estimateTokens, oracleOf, reportAb, summarizeAb, type RunResult } from '../server/ab/harness';
import { abMain } from '../server/ab/main';

// A5.5 (O13): the A/B harness. Every brief's ideal calls pass its oracle in every variant and both arms; the oracle
// fails a wrong part; the arms read what they should; a dry run through the real chat server; the live guard.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);

test('ten briefs; every variant\'s ideal calls pass the oracle in both arms (the json arm in v1 names, the hybrid in v2)', async () => {
  assert.equal(BRIEFS.length, 10);
  assert.equal(new Set(BRIEFS.map(b => b.id)).size, 10);
  for (const b of BRIEFS) for (const [k, p] of b.variants.entries()) for (const arm of ['json', 'hybrid'] as Arm[]) {
    let s: ChatState = { doc: emptyDoc(), bodies: [] };
    const calls = b.scripted[arm](p);
    if (arm === 'json') assert.ok(calls.every(c => toolsetOf('json').tools.some(t => t.name === c.tool)), `${b.id}: v1 tools without run_script`);
    else assert.ok(calls.every(c => toolsetOf('v2').tools.some(t => t.name === c.tool)), `${b.id}: v2 tools`);
    for (const c of calls) { const r = await dispatchTool(s, c.tool, c.args, evaluate); assert.ok(!r.isError, `${b.id} ${arm} #${k} ${c.tool}: ${r.content.slice(0, 300)}`); s = r.state; }
    const o = await oracleOf(s.doc, b, k);
    assert.ok(o.pass, `${b.id} ${arm} #${k}: ${JSON.stringify(o.oracle)}`);
    // The agent's own requirements are there (it wrote them), and the oracle's are not left in the part.
    assert.ok(s.doc.requirements?.length, `${b.id} ${arm}: the agent set its requirements`);
  }
});

test('the oracle fails a wrong part: no hole, the wrong size, two solids, no part', async () => {
  const b = BRIEFS.find(x => x.id === 'block-hole')!, p = b.variants[0];
  const status = async (doc: StudioDoc) => { const o = await oracleOf(doc, b, 0); return [o.pass, o.oracle.filter(x => x.status !== 'pass').map(x => x.id)]; };
  assert.deepEqual(await status(rectanglePart(p.w, p.d, p.h)), [false, ['V']], 'no hole');
  assert.deepEqual(await status(rectanglePart(p.w + 5, p.d, p.h)), [false, ['X', 'V']], 'too wide, no hole');
  const two = withNode(withNode(rectanglePart(p.w, p.d, p.h), { kind: 'sketch', profile: 'rectangle', min: [200, 0], max: [210, 10] } as never), { kind: 'extrude', sketch: 2, height: 5 } as never);
  assert.equal((await status(two))[0], false);
  assert.equal((await status(emptyDoc()))[0], false, 'nothing built');
});

test('what each arm reads: json has no run_script, hybrid the 13 tools; the estimate grows with each turn', () => {
  assert.ok(!toolsetOf('json').tools.some(t => t.name === 'run_script'));
  assert.equal(toolsetOf('json').tools.length, toolsetOf('v1').tools.length - 1);
  assert.ok(!/run_script/.test(SYSTEM_PROMPT_JSON) && SYSTEM_PROMPT_JSON.length < toolsetOf('v1').prompt.length);
  assert.equal(toolsetOf('v2').tools.length, 13);
  const one = estimateTokens('json', 'brief', [{ args: 100, result: 1000 }]), two = estimateTokens('json', 'brief', [{ args: 100, result: 1000 }, { args: 100, result: 1000 }]);
  assert.ok(two.input > 1.4 * one.input && two.output > one.output && one.estimated);
  // (Each model turn reads the prompt and tools again: json about 4.4× hybrid a turn, 17.9k against 4.1k tokens.)
  const j = estimateTokens('json', 'brief', []), h = estimateTokens('hybrid', 'brief', []);
  assert.ok(j.input > 4 * h.input, `${j.input} vs ${h.input}`);
});

test('the summary: pass@k (any) and pass^k (all) per brief and arm; the report', () => {
  const r = (brief: string, arm: Arm, pass: boolean, calls: number): RunResult => ({ brief, arm, run: 0, variant: 0, pass, oracle: [], calls, refusals: pass ? 0 : 1, tools: [], wallMs: 10, end: 'done', tokens: { input: 100, output: 10, newInput: 50, estimated: true } });
  const s = summarizeAb([r('a', 'json', true, 4), r('a', 'json', false, 6), r('a', 'hybrid', true, 2), r('a', 'hybrid', true, 2)]);
  assert.deepEqual([s.byBrief.a.json!.passAtK, s.byBrief.a.json!.passPowK, s.byBrief.a.json!.calls, s.byBrief.a.json!.refusals], [true, false, 5, 0.5]);
  assert.deepEqual([s.byBrief.a.hybrid!.passAtK, s.byBrief.a.hybrid!.passPowK, s.byArm.hybrid!.passRate, s.byArm.json!.passRate], [true, true, 1, 0.5]);
  assert.match(reportAb([r('a', 'json', true, 4)], 'scripted'), /\| a \| json \| 1\/1 \| yes \| yes \| 4 \|/);
});

test('a dry run of the real script through the real chat server and tool server: the scripted agent, two briefs, both arms', async () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-ab-test-'));
  const child = spawn(process.execPath, [join(process.cwd(), 'scripts/ab.mjs'), '--scripted', '--briefs', 'block-hole,pcb-enclosure', '--runs', '1', '--out', out], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = ''; child.stderr.on('data', d => { err += d; });
  assert.equal(await new Promise(res => child.on('close', res)), 0, err);
  const results = JSON.parse(readFileSync(join(out, 'results.json'), 'utf8')) as RunResult[];
  assert.match(readFileSync(join(out, 'report.md'), 'utf8'), /^# A\/B dry run \(scripted agent\)/);
  assert.equal(results.length, 4);
  for (const r of results) { assert.ok(r.pass && r.end === 'done' && r.refusals === 0, JSON.stringify(r)); assert.ok(r.tokens.estimated && r.tokens.input > 0); }
  const by = (id: string, arm: Arm) => results.find(r => r.brief === id && r.arm === arm)!;
  assert.deepEqual([by('block-hole', 'json').calls, by('block-hole', 'hybrid').calls, by('pcb-enclosure', 'json').calls, by('pcb-enclosure', 'hybrid').calls], [4, 2, 13, 2]);
  assert.deepEqual(by('block-hole', 'hybrid').tools, ['model', 'requirements']);
  assert.ok(by('pcb-enclosure', 'json').tokens.input > 10 * by('pcb-enclosure', 'hybrid').tokens.input);
});

test('live runs need --live and CAD_AB_LIVE=1: refused without them (exit 2), nothing run', async () => {
  const was = process.env.CAD_AB_LIVE; delete process.env.CAD_AB_LIVE;
  const err: string[] = [], write = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (s: string) => { err.push(s); return true; };
  try {
    const paths = { mcpScript: '/nonexistent/cadMcp.mjs', scripted: '/nonexistent/claude' };
    assert.equal(await abMain(['--live'], paths), 2);
    assert.equal(await abMain([], paths), 2);
    assert.equal(await abMain(['--scripted', '--briefs', 'nope'], paths), 2);
    assert.equal(await abMain(['--scripted', '--arms', 'json,v9'], paths), 2);
  } finally { (process.stderr as { write: unknown }).write = write; if (was !== undefined) process.env.CAD_AB_LIVE = was; }
  assert.match(err.join(''), /set CAD_AB_LIVE=1 as well as --live/);
});
