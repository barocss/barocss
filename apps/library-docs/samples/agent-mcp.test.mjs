// The agent's tools as an MCP client calls them: apps/cad-studio/scripts/cad-mcp.mjs over stdio on a .bcad file of its
// own. The Tools and cad-mcp pages include the calls between the #region markers. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const cadMcp = resolve(import.meta.dirname, '../../cad-studio/scripts/cad-mcp.mjs');
/** A 60 × 40 × 8 plate: a rectangle sketch and its extrude. */
const PLATE = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { kind: 'extrude', sketch: 0, height: 8 }],
  outputs: { b1: { node: 1, side: 'solid' } } };

/** cad-mcp on a copy of the plate: `call(name, args)` is one tools/call, its result's text parsed. */
async function session(args = []) {
  const file = join(mkdtempSync(join(tmpdir(), 'docs-mcp-')), 'plate.bcad');
  writeFileSync(file, JSON.stringify(PLATE));
  const server = spawn(process.execPath, [cadMcp, '--doc', file, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map();
  createInterface({ input: server.stdout }).on('line', line => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
  let id = 0;
  const send = (method, params) => new Promise(done => { const n = ++id; waiting.set(n, done); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'docs', version: '0' } });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const call = async (name, args) => { const r = (await send('tools/call', { name, arguments: args })).result; return { isError: r.isError, ...JSON.parse(r.content[0].text) }; };
  return { file, send, call, close: () => server.kill() };
}

test('the tool list: 13 tools under the v2 contract', async () => {
  const s = await session();
  try {
    const { result } = await s.send('tools/list', {});
    assert.deepEqual(result.tools.map(t => t.name), ['model', 'features', 'query', 'history', 'requirements', 'proposals', 'assembly', 'library', 'print', 'drawing', 'subd', 'image', 'describe']);
  } finally { s.close(); }
});

test('a query reads the part; a new feature at L2 is refused and the part kept; a bad index is refused', async () => {
  const s = await session();
  try {
    // #region l2
    // query.measure: a face by its name.
    assert.deepEqual(await s.call('query', { action: 'measure', a: 'n1.top' }),
      { isError: false, label: 'Planar face', area: 2400 });

    // A new feature at autonomy L2 (the default): refused, the part unchanged.
    const hole = await s.call('features', { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 8, x: 30, y: 20 } });
    assert.equal(hole.isError, true);
    assert.equal(hole.code, 'needs_proposal');
    assert.equal(hole.kept, 'the part is unchanged');

    // A call the part can't answer: refused with the reason.
    assert.deepEqual(await s.call('features', { action: 'delete', index: 9 }),
      { isError: true, ok: false, error: 'There is no feature 9 (features 0–1).' });
    // #endregion l2
    assert.equal(JSON.parse(readFileSync(s.file, 'utf8')).nodes.length, 2, 'the file is as it was');
  } finally { s.close(); }
});

test('at L3 the same hole applies and the file is saved at once', async () => {
  const s = await session(['--autonomy', '3']);
  try {
    // #region l3
    const hole = await s.call('features', { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 8, x: 30, y: 20 } });
    assert.equal(hole.isError, false);
    // #endregion l3
    const kinds = JSON.parse(readFileSync(s.file, 'utf8')).nodes.map(n => n.kind);
    assert.deepEqual(kinds, ['sketch', 'extrude', 'hole']);
  } finally { s.close(); }
});
