// P1-L3's Codex harness, dry run: scripted-codex stands in for `codex exec --json` and makes its calls through the real
// cad-mcp on the run's part.bcad; the oracle is `cad-cli check` on what the run saved (the start's hard requirement:
// 64 mm along X). A pass, an oracle failure, an off-contract call, the tool-call cap and the wall clock, each recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { codexArgs, DISABLED_FEATURES, readEvents, runSeries } from '../server/liveRun/codexRun';

const root = process.cwd();
const CODEX = [process.execPath, join(root, 'test/fixtures/scripted-codex.mjs')], MCP = join(root, 'scripts/cad-mcp.mjs'), CHECK = [process.execPath, join(root, 'scripts/cad-cli.mjs'), 'check', '{doc}'];
const start = encodeStudioFile({ ...emptyDoc(), requirements: [{ id: 'R1', source: '64 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 64, tol: 0.1 } }] } as StudioDoc);
const box = (w: number) => ({ tool: 'features', args: { action: 'command', command: 'box', values: { w, d: 20, h: 10 } } });
const script = (...calls: object[]) => `script ${JSON.stringify({ calls })}`;
const BRIEF = 'Make a block 64 × 20 × 10 mm.';

test('P1-L3 harness: codex exec reaches the part through cad-mcp only — the user config ignored, the built-ins disabled, the brief on stdin', () => {
  const a = codexArgs({ dir: '/r', mcpCommand: 'node', mcpArgs: ['m.mjs', '--doc', '/r/part.bcad'], model: 'gpt-6.1-sol', effort: 'high' });
  for (const f of ['--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check']) assert.ok(a.includes(f), f);
  assert.deepEqual(a.slice(a.indexOf('-s'), a.indexOf('-s') + 2), ['-s', 'read-only']);
  assert.ok(a.includes('mcp_servers.cad.args=["m.mjs","--doc","/r/part.bcad"]'));
  for (const f of ['shell_tool', 'unified_exec', 'plugins', 'browser_use', 'computer_use']) assert.ok(DISABLED_FEATURES.includes(f) && a.includes(f), f);
  assert.equal(a.at(-1), '-');
  // (The events: a cad call counted, a refused one marked, a shell item or another server's tool off-contract, usage summed.)
  const e = readEvents([
    '{"type":"item.started","item":{"id":"1","type":"mcp_tool_call","server":"cad","tool":"query"},"t":10}', '{"type":"item.completed","item":{"id":"1","type":"mcp_tool_call","server":"cad","tool":"query","status":"completed","result":{"is_error":true}},"t":25}',
    '{"type":"item.completed","item":{"id":"2","type":"command_execution","command":"ls"}}', '{"type":"item.completed","item":{"id":"3","type":"mcp_tool_call","server":"other","tool":"x"}}',
    '{"type":"item.completed","item":{"id":"4","type":"agent_message","text":"done"}}', '{"type":"turn.completed","usage":{"input_tokens":5,"output_tokens":2}}', '{"type":"turn.completed","usage":{"input_tokens":1}}', 'not json',
  ]);
  assert.deepEqual(e.toolCalls, [{ tool: 'query', isError: true, ms: 15 }]);
  assert.deepEqual(e.offContract.map(x => x.type), ['command_execution', 'mcp_tool_call']);
  assert.deepEqual(e.usage, { input_tokens: 6, output_tokens: 2 }); assert.equal(e.turns, 2); assert.equal(e.completed, true);
});

test('P1-L3 harness, dry run: a pass, an oracle failure and an off-contract call — each judged by cad-cli check afresh on the saved part', async () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-p1l3-'));
  try {
    const { records, stopped } = await runSeries({ codex: CODEX, mcpCommand: process.execPath, mcpScript: MCP, brief: BRIEF, start, check: CHECK, out, runs: 3, scripts: [script(box(64)), script(box(50)), script({ shell: 'cat ~/.codex/config.toml' }, box(64))] });
    assert.equal(stopped, null);
    const [pass, wrong, off] = records;
    assert.equal(pass.result.pass, true, JSON.stringify(pass)); assert.equal(pass.end, 'completed'); assert.equal(pass.check.exit, 0);
    assert.deepEqual(pass.toolCalls.map(c => [c.tool, c.isError]), [['features', false]]); assert.equal(pass.turns, 1); assert.deepEqual(pass.usage, { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10 });
    assert.equal(wrong.result.pass, false); assert.equal(wrong.check.exit, 3); assert.match(wrong.result.why, /^the oracle failed afresh \(exit 3\)$/);
    assert.equal(off.result.pass, false, 'the oracle passes, but a shell call is off-contract'); assert.equal(off.check.exit, 0); assert.match(off.result.why, /^off-contract: command_execution/);
    // (Every run's brief is the same brief; only the dry run's script differs. Its records and logs are on disk.)
    assert.equal(new Set(records.map(r => r.startSha256)).size, 1);
    const saved = JSON.parse(readFileSync(join(out, 'records.json'), 'utf8'));
    assert.equal(saved.records.length, 3);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('P1-L3 harness, dry run: the tool-call cap and the wall clock end a run (its processes killed), recorded as such', async () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-p1l3-caps-'));
  try {
    const capped = await runSeries({ codex: CODEX, mcpCommand: process.execPath, mcpScript: MCP, brief: BRIEF, start, check: CHECK, out, runs: 1, maxToolCalls: 1, scripts: [script(box(64), box(64), box(64))] });
    assert.equal(capped.records[0].end, 'tool-cap', JSON.stringify(capped.records[0]));
    process.env.CAD_SCRIPTED_SLEEP_MS = '20000';
    const t0 = Date.now(), slow = await runSeries({ codex: CODEX, mcpCommand: process.execPath, mcpScript: MCP, brief: BRIEF, start, check: CHECK, out, runs: 1, wallMs: 1500, scripts: [script(box(64))] });
    assert.equal(slow.records[0].end, 'wall-clock'); assert.ok(Date.now() - t0 < 15000, 'killed, not waited out');
    assert.equal(slow.records[0].result.pass, false, 'the start, unchanged, fails its requirement');
  } finally { delete process.env.CAD_SCRIPTED_SLEEP_MS; rmSync(out, { recursive: true, force: true }); }
});
