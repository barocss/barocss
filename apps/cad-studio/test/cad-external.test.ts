import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { emptyDoc, withNode } from '../src/engine/doc';
import { meshInMM, readMeshFile } from '@barocss/cad-model/engine/meshImport';
import { meshNodeBlobs } from '../src/engine/blobs';
import { encodeStudioFile, isContainer, readStudioFile } from '../src/engine/container';
import { TOOLS } from '../src/chat/tools';
import { TOOLS_V2 } from '../src/chat/toolset';
import { docStore, mcpOptions, notLocalModel, openModel } from '../server/cadDoc';
import { serveMcp } from '../server/cadMcp';
import { cliMain } from '../server/cadCli';

// A5.4 (O12): the external MCP server (`cad-mcp --doc`) and the CLI (`cad-cli`). The server is spawned as a client
// would (the real script, stdio), runs a script, saves; a second session reopens the file and finds the same part.

const root = process.cwd(), dir = () => mkdtempSync(join(tmpdir(), 'cad-ext-'));
const PLATE = 'const p = box({w: 80, d: 40, h: 8})\nfor (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) }';
const PLATE_MM3 = 80 * 40 * 8 - 3 * Math.PI * 2.5 ** 2 * 8;

/** A spawned cad-mcp: requests answered in order, then closed. */
function client(args: string[]) {
  const child = spawn(process.execPath, [join(root, 'scripts/cad-mcp.mjs'), ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map<number, (m: Record<string, any>) => void>(); let id = 0, stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  createInterface({ input: child.stdout }).on('line', line => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
  const request = (method: string, params?: unknown) => new Promise<Record<string, any>>(res => { const n = ++id; waiting.set(n, res); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const call = async (name: string, args: object = {}) => (await request('tools/call', { name, arguments: args })).result as { content: { text: string }[]; isError: boolean };
  const close = () => new Promise<number>(res => { child.on('close', c => res(c ?? -1)); child.stdin.end(); });
  return { request, call, close, stderr: () => stderr };
}
const facts = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text).facts;

test('cad-mcp --doc: spawned as a client would, a script run and saved; a second session reopens the same part', async () => {
  const d = dir(), part = join(d, 'part.bcad');
  const a = client(['--doc', part]);
  const init = (await a.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })).result!;
  assert.equal(init.serverInfo.version, 'barocss-cad-tools-v1');
  assert.equal(((await a.request('tools/list')).result!.tools as unknown[]).length, TOOLS.length);
  assert.ok(!existsSync(part), 'a new part: no file until the first change');
  const built = await a.call('run_script', { source: PLATE });
  assert.equal(built.isError, false, built.content[0].text);
  assert.ok(existsSync(part), 'saved on the change');
  const saved = readFileSync(part);
  // A read changes nothing on disk.
  await a.call('get_part_summary', {});
  assert.deepEqual(readFileSync(part), saved);
  const before = facts(built);
  assert.equal(await a.close(), 0, a.stderr());
  assert.ok(!readdirSync(d).some(f => f.endsWith('.tmp')), 'no temporary file left');
  // Reopened: the same features and facts; the file as it was.
  const read = await readStudioFile(new Uint8Array(readFileSync(part)));
  assert.ok('doc' in read && read.doc.nodes.length === 5, JSON.stringify(read).slice(0, 200));
  const b = client(['--doc', part, '--toolset', 'v2']);
  await b.request('initialize', { protocolVersion: '2025-06-18' });
  assert.equal(((await b.request('tools/list')).result!.tools as unknown[]).length, TOOLS_V2.length);
  const again = JSON.parse((await b.call('query', { action: 'summary' })).content[0].text);
  assert.deepEqual(again.facts, before);
  assert.ok(Math.abs(again.facts.volume_mm3 - PLATE_MM3) < 0.01);
  assert.equal(await b.close(), 0);
  assert.deepEqual(readFileSync(part), saved, 'reopening without a change leaves the file as it was');
});

test('cad-mcp on a container with mesh blobs: a change saved with its blobs, the file read back whole', async () => {
  const m = meshInMM(readMeshFile('block-cm.stl', new Uint8Array(readFileSync(join(root, 'test/fixtures/block-cm.stl')))), 'cm');
  const node = await meshNodeBlobs({ kind: 'mesh' as const, name: 'block', unit: 'cm', representation: 'facets' as const }, m.positions, m.indices);
  const d = dir(), part = join(d, 'mesh.bcad');
  writeFileSync(part, encodeStudioFile(withNode(emptyDoc(), node)));
  const c = client(['--doc', part, '--autonomy', '4']);
  await c.request('initialize', {});
  const r = await c.call('run_script', { source: 'box({w: 10, d: 10, h: 10, x: 200, y: 0, z: 0})' });
  assert.equal(r.isError, false, r.content[0].text);
  assert.equal(await c.close(), 0, c.stderr());
  const bytes = new Uint8Array(readFileSync(part));
  assert.ok(isContainer(bytes), 'still a container, its blobs inside');
  const back = await readStudioFile(bytes);
  assert.ok('doc' in back, JSON.stringify(back));
  assert.deepEqual(back.doc.nodes.map(n => n.kind), ['mesh', 'sketch', 'extrude']);
});

test('cad-mcp options: local .bcad files only, the flags, the usage', async () => {
  assert.match(notLocalModel('https://example.com/a.bcad')!, /not a local file/);
  assert.match(notLocalModel('file:///tmp/a.bcad')!, /not a local file/);
  assert.match(notLocalModel('/tmp/a.step')!, /not a \.bcad/);
  assert.equal(notLocalModel('C:\\parts\\a.bcad'), null);
  assert.equal(notLocalModel('/tmp/a.bcad'), null);
  assert.deepEqual(mcpOptions(['--doc', 'a.bcad', '--toolset', 'v2', '--autonomy', '3']), { doc: resolve('a.bcad'), toolset: 'v2', autonomy: '3' });
  for (const bad of [[], ['--doc'], ['--doc', 'a.step'], ['--toolset', 'v3', '--doc', 'a.bcad'], ['--autonomy', '9', '--doc', 'a.bcad'], ['--what']]) assert.ok('error' in mcpOptions(bad), JSON.stringify(bad));
  assert.ok('usage' in mcpOptions(['--help']) && !('error' in mcpOptions(['--help'])));
  // The real script: a usage error exits 2 and says why on stderr, nothing on stdout.
  const child = spawn(process.execPath, [join(root, 'scripts/cad-mcp.mjs'), '--doc', 'x.step'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = ''; child.stdout.on('data', x => { out += x; }); child.stderr.on('data', x => { err += x; });
  assert.equal(await new Promise(res => child.on('close', res)), 2);
  assert.equal(out, ''); assert.match(err, /not a \.bcad model file/);
  assert.ok('error' in await openModel(join(dir(), 'missing.bcad')), 'a missing file is refused where a part must exist');
});

test('a change the file cannot take is said so: the call is an error and the part stays changed in the session only', async () => {
  const d = dir(), part = join(d, 'gone', 'part.bcad');
  const input = new PassThrough(), output = new PassThrough(), served = serveMcp(docStore(part), input, output);
  const replies: Record<string, any>[] = []; createInterface({ input: output }).on('line', l => replies.push(JSON.parse(l)));
  input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_script', arguments: { source: 'box({w: 5, d: 5, h: 5})' } } }) + '\n');
  input.end(); await served; await new Promise(r => setImmediate(r));
  const r = replies[0].result;
  assert.equal(r.isError, true);
  assert.match(r.content.at(-1).text, /^Not saved: .*ENOENT/);
});

/** cliMain with its output captured. */
async function cli(args: string[], stdin?: string) {
  let out = '', err = '';
  const w = (f: (s: string) => void) => ({ write: (s: string) => { f(s); return true; } }) as unknown as NodeJS.WritableStream;
  const code = await cliMain(args, { stdout: w(s => { out += s; }), stderr: w(s => { err += s; }), ...(stdin !== undefined ? { stdin: async () => stdin } : {}) });
  return { code, out, err, json: out.trim().startsWith('{') ? JSON.parse(out) : undefined };
}

test('cad-cli run: a script to .bcad, STEP and STL; check; refusals write nothing; exit codes', async () => {
  const d = dir(), script = join(d, 'plate.cad.js');
  writeFileSync(script, `${PLATE}\nrequirements([{id: "R1", source: "80 long", hard: true, check: {op: "==", query: {fn: "bbox", axis: "x"}, value: 80, tol: 0.1}}])`);
  const r = await cli(['run', script, '-o', join(d, 'plate.bcad'), '--step', join(d, 'plate.step'), '--stl', join(d, 'plate.stl'), '--check']);
  assert.equal(r.code, 0, r.err);
  assert.ok(r.json.ok && r.json.calls === 5 && Math.abs(r.json.facts.volume_mm3 - PLATE_MM3) < 0.01, r.out);
  assert.deepEqual([r.json.checks.summary.pass, r.json.checks.summary.hard_failing], [1, 0]);
  assert.match(readFileSync(join(d, 'plate.step'), 'latin1'), /^ISO-10303-21;/);
  const stl = readFileSync(join(d, 'plate.stl'));
  assert.equal(stl.length, 84 + 50 * stl.readUInt32LE(80), 'a binary STL, its size from its triangle count');
  // The saved part checked again: a failing hard requirement exits 3.
  assert.equal((await cli(['check', join(d, 'plate.bcad')])).code, 0);
  const wide = join(d, 'wide.cad.js');
  writeFileSync(wide, 'box({w: 90, d: 40, h: 8})\nrequirements([{id: "R1", source: "80 long", hard: true, check: {op: "==", query: {fn: "bbox", axis: "x"}, value: 80, tol: 0.1}}])');
  const w = await cli(['run', wide, '-o', join(d, 'wide.bcad'), '--check']);
  assert.deepEqual([w.code, w.json.ok, w.json.checks.summary.hard_failing], [3, false, 1]);
  assert.equal((await cli(['check', join(d, 'wide.bcad')])).code, 3);
  // A refused line: file:line:col, exit 1, nothing written.
  const bad = await cli(['run', '-', '-o', join(d, 'bad.bcad')], 'const a = box({w: 5, d: 5, h: 5})\nbox({w: 1, d: 1, h: 1, q: 2})');
  assert.equal(bad.code, 1); assert.match(bad.err, /^cad-cli: <stdin>:2:4: \[REFUSED\] Box has no value "q"/);
  assert.ok(!existsSync(join(d, 'bad.bcad')));
  // On a base part (--doc), a dry run writes nothing.
  const more = await cli(['run', '-', '--doc', join(d, 'plate.bcad'), '-o', join(d, 'more.bcad')], 'cylinder({r: 3, h: 4, x: 120, y: 0})');
  assert.equal(more.code, 0, more.err); assert.equal(more.json.facts.solids, 2);
  const dry = await cli(['run', '-', '--doc', join(d, 'plate.bcad'), '-o', join(d, 'dry.bcad'), '--dry-run'], 'cylinder({r: 3, h: 4, x: 120, y: 0})');
  assert.equal(dry.code, 0); assert.ok(dry.json.dryRun && !existsSync(join(d, 'dry.bcad')));
  // Several bodies: one STL each.
  const two = await cli(['run', '-', '--stl', join(d, 'two.stl')], 'box({w: 5, d: 5, h: 5})\nbox({w: 5, d: 5, h: 5, x: 20})');
  assert.equal(two.code, 0, two.err); assert.equal(two.json.wrote.length, 2); assert.ok(two.json.wrote.every((p: string) => /two-b\d+\.stl$/.test(p)));
  // Usage: exit 2.
  for (const args of [[], ['run'], ['run', script, '-o', join(d, 'x.step')], ['run', script, '--stl'], ['frobnicate'], ['check']]) assert.equal((await cli(args)).code, 2, JSON.stringify(args));
  assert.equal((await cli(['help'])).code, 0);
});

test('cad-cli spawned: the real script runs a file and writes the part', async () => {
  const d = dir(), script = join(d, 'p.cad.js'); writeFileSync(script, PLATE);
  const child = spawn(process.execPath, [join(root, 'scripts/cad-cli.mjs'), 'run', script, '-o', join(d, 'p.bcad')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', x => { out += x; });
  assert.equal(await new Promise(res => child.on('close', res)), 0);
  assert.equal(JSON.parse(out).calls, 4);
  const back = await readStudioFile(new Uint8Array(readFileSync(join(d, 'p.bcad'))));
  assert.ok('doc' in back && back.doc.nodes.length === 5);
});
