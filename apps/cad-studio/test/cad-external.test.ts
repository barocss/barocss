import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { meshInMM, readMeshFile } from '@barocss/cad-model/engine/meshImport';
import { meshNodeBlobs } from '@barocss/cad-model/engine/blobs';
import { encodeStudioFile, isContainer, readStudioFile } from '@barocss/cad-model/engine/container';
import { TOOLS_V2 } from '@barocss/cad-model/chat/toolset';
import { docStore, mcpOptions, notLocalModel, openModel } from '../server/cadDoc';
import { serveMcp } from '../server/cadMcp';
import { cliMain } from '../server/cadCli';

// A5.4 (O12): the external MCP server (`cad-mcp --doc`) and the CLI (`cad-cli`). The server is spawned as a client
// would (the real script, stdio), runs a script, saves; a second session reopens the file and finds the same part.

const root = process.cwd(), dir = () => mkdtempSync(join(tmpdir(), 'cad-ext-'));
const PLATE = 'const p = box({w: 80, d: 40, h: 8})\nfor (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) }';
const PLATE_MM3 = 80 * 40 * 8 - 3 * Math.PI * 2.5 ** 2 * 8;

/** A spawned cad-mcp: requests answered in order, then closed. */
function client(args: string[], preload?: string) {
  const child = spawn(process.execPath, [...(preload ? ['--import', preload] : []), join(root, 'scripts/cad-mcp.mjs'), ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map<number, { resolve: (m: Record<string, any>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let id = 0, stderr = '', closing = false, failure: Error | null = null, closePromise: Promise<number> | undefined;
  const fail = (e: Error) => {
    failure ??= e;
    for (const pending of waiting.values()) { clearTimeout(pending.timer); pending.reject(e); }
    waiting.clear();
  };
  const onError = (e: Error) => fail(e);
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => { if (!closing) fail(new Error(`cad-mcp exited before close (${code ?? signal}): ${stderr}`)); };
  const onStderr = (d: Buffer) => { stderr += d; };
  child.on('error', onError); child.on('exit', onExit); child.stdin.on('error', onError); child.stderr.on('data', onStderr);
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let m: Record<string, any>;
    try { m = JSON.parse(line); } catch { fail(new Error(`cad-mcp sent invalid JSON: ${line}`)); return; }
    const pending = waiting.get(m.id);
    if (pending) { waiting.delete(m.id); clearTimeout(pending.timer); pending.resolve(m); }
  });
  const closed = new Promise<number>(resolve => child.once('close', code => {
    fail(new Error(`cad-mcp closed (${code}): ${stderr}`));
    lines.close(); child.off('error', onError); child.off('exit', onExit); child.stdin.off('error', onError); child.stderr.off('data', onStderr);
    resolve(code ?? -1);
  }));
  const request = (method: string, params?: unknown) => new Promise<Record<string, any>>((resolve, reject) => {
    if (failure || closing) { reject(failure ?? new Error('cad-mcp client is closing')); return; }
    const n = ++id, timer = setTimeout(() => { waiting.delete(n); reject(new Error(`cad-mcp ${method} #${n} timed out after 30 s: ${stderr}`)); }, 30_000);
    waiting.set(n, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n', error => { if (error) fail(error); });
  });
  const call = async (name: string, args: object = {}) => (await request('tools/call', { name, arguments: args })).result as { content: { text: string }[]; isError: boolean; structuredContent?: unknown };
  const close = () => closePromise ??= (async () => {
    const before = failure; closing = true;
    if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const code = await Promise.race([closed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`cad-mcp close timed out after 10 s: ${stderr}`)), 10_000); })]);
      if (before) throw before;
      return code;
    } catch (error) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        const killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
        let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([closed, new Promise<never>((_, reject) => {
            cleanupTimer = setTimeout(() => {
              child.kill('SIGKILL'); child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
              reject(new Error(`cad-mcp did not close after forced termination: ${stderr}`));
            }, 4_000);
          })]);
        } finally { clearTimeout(killTimer); clearTimeout(cleanupTimer); }
      }
      throw error;
    } finally { clearTimeout(timer); }
  })();
  return { request, call, close, stderr: () => stderr };
}
const facts = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text).facts;

test('cad-mcp --doc: spawned as a client would, a script run and saved; a second session reopens the same part', async () => {
  const d = dir(), part = join(d, 'part.bcad');
  const a = client(['--doc', part]);
  try {
    const init = (await a.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })).result!;
    assert.equal(init.serverInfo.version, 'barocss-cad-tools-v2');
    assert.deepEqual(((await a.request('tools/list')).result!.tools as { name: string }[]).map(t => t.name), TOOLS_V2.map(t => t.name));
    assert.ok(!existsSync(part), 'a new part: no file until the first change');
    const built = await a.call('model', { source: PLATE });
    assert.equal(built.isError, false, built.content[0].text);
    assert.ok(existsSync(part), 'saved on the change');
    const saved = readFileSync(part);
    // A read changes nothing on disk.
    await a.call('query', { action: 'summary' });
    assert.deepEqual(readFileSync(part), saved);
    const before = facts(built);
    assert.equal(await a.close(), 0, a.stderr());
    assert.ok(!readdirSync(d).some(f => f.endsWith('.tmp')), 'no temporary file left');
    // Reopened: the same features and facts; the file as it was.
    const read = await readStudioFile(new Uint8Array(readFileSync(part)));
    assert.ok('doc' in read && read.doc.nodes.length === 5, JSON.stringify(read).slice(0, 200));
    const b = client(['--doc', part]);
    try {
      await b.request('initialize', { protocolVersion: '2025-06-18' });
      const again = JSON.parse((await b.call('query', { action: 'summary' })).content[0].text);
      assert.deepEqual(again.facts, before);
      assert.ok(Math.abs(again.facts.volume - PLATE_MM3) < 0.01);
      assert.equal(await b.close(), 0);
      assert.deepEqual(readFileSync(part), saved, 'reopening without a change leaves the file as it was');
    } finally { await b.close(); }
  } finally { await a.close(); }
});

test('cad-mcp on a container with mesh blobs: a change saved with its blobs, the file read back whole', async () => {
  const m = meshInMM(readMeshFile('block-cm.stl', new Uint8Array(readFileSync(join(root, '../../packages/barocss-cad-model/test/fixtures/block-cm.stl')))), 'cm');
  const node = await meshNodeBlobs({ kind: 'mesh' as const, name: 'block', unit: 'cm', representation: 'facets' as const }, m.positions, m.indices);
  const d = dir(), part = join(d, 'mesh.bcad');
  writeFileSync(part, encodeStudioFile(withNode(emptyDoc(), node)));
  const c = client(['--doc', part, '--autonomy', '4']);
  try {
    await c.request('initialize', {});
    const r = await c.call('model', { source: 'box({w: 10, d: 10, h: 10, x: 200, y: 0, z: 0})' });
    assert.equal(r.isError, false, r.content[0].text);
    assert.equal(await c.close(), 0, c.stderr());
    const bytes = new Uint8Array(readFileSync(part));
    assert.ok(isContainer(bytes), 'still a container, its blobs inside');
    const back = await readStudioFile(bytes);
    assert.ok('doc' in back, JSON.stringify(back));
    assert.deepEqual(back.doc.nodes.map(n => n.kind), ['mesh', 'sketch', 'extrude']);
  } finally { await c.close(); }
});

test('cad-mcp options: local .bcad files only, the flags, the usage', async () => {
  assert.match(notLocalModel('https://example.com/a.bcad')!, /not a local file/);
  assert.match(notLocalModel('file:///tmp/a.bcad')!, /not a local file/);
  assert.match(notLocalModel('/tmp/a.step')!, /not a \.bcad/);
  assert.equal(notLocalModel('C:\\parts\\a.bcad'), null);
  assert.equal(notLocalModel('/tmp/a.bcad'), null);
  assert.deepEqual(mcpOptions(['--doc', 'a.bcad', '--autonomy', '3']), { doc: resolve('a.bcad'), autonomy: '3' });
  // (--toolset went with v1, O105: refused as any unknown option.)
  for (const bad of [[], ['--doc'], ['--doc', 'a.step'], ['--toolset', 'v2', '--doc', 'a.bcad'], ['--autonomy', '9', '--doc', 'a.bcad'], ['--what']]) assert.ok('error' in mcpOptions(bad), JSON.stringify(bad));
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
  input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'model', arguments: { source: 'box({w: 5, d: 5, h: 5})' } } }) + '\n');
  input.end(); await served; await new Promise(r => setImmediate(r));
  const r = replies[0].result;
  assert.equal(r.isError, true);
  assert.match(r.content.at(-1).text, /^Not saved: .*ENOENT/);
});

const plateBytes = (height: number) => Buffer.from(encodeStudioFile(rectanglePart(80, 40, height)));
const summary = { action: 'summary' };
const heightEdit = (h: number) => ({ action: 'edit', index: 1, values: { h } });

test('D708 external MCP rejects equal-size, equal-time changes and labels the retained unsaved model', async () => {
  const d = dir(), part = join(d, 'part.bcad'), initial = plateBytes(8), newer = plateBytes(9);
  const time = new Date('2026-11-11T01:02:03Z');
  writeFileSync(part, initial); utimesSync(part, time, time);
  const stat = statSync(part);
  const stale = client(['--doc', part]);
  try {
    await stale.request('initialize', {});
    assert.equal(facts(await stale.call('query', summary)).volume, 25600);
    assert.deepEqual(readFileSync(part), initial);
    writeFileSync(part, newer); utimesSync(part, time, time);
    const after = statSync(part);
    assert.deepEqual([after.ino, after.size, after.mtimeMs], [stat.ino, stat.size, stat.mtimeMs]);
    const rejected = await stale.call('features', heightEdit(7));
    assert.equal(rejected.isError, true, JSON.stringify(rejected));
    assert.match(rejected.content.at(-1)!.text, /^Not saved: \[STORAGE_CHANGED\].*Reopen/);
    assert.equal(rejected.structuredContent, undefined);
    assert.deepEqual(readFileSync(part), newer);
    const read = await stale.call('query', summary);
    assert.equal(read.isError, false);
    assert.equal(facts(read).volume, 22400);
    assert.match(read.content.at(-1)!.text, /^Unsaved session model: \[STORAGE_CHANGED\]/);
    assert.equal(read.structuredContent, undefined);
    assert.equal((await stale.call('features', heightEdit(6))).isError, true);
    assert.deepEqual(readFileSync(part), newer);
    writeFileSync(part, initial);
    assert.equal((await stale.call('features', heightEdit(5))).isError, true, 'restoring the old bytes does not reset a conflicted session');
    assert.deepEqual(readFileSync(part), initial);
    writeFileSync(part, newer);
  } finally { assert.equal(await stale.close(), 0); }
  const fresh = client(['--doc', part]);
  try {
    await fresh.request('initialize', {});
    const initialRead = await fresh.call('query', summary);
    assert.equal(facts(initialRead).volume, 28800);
    assert.equal(initialRead.content.length, 1);
    for (const h of [10, 11]) {
      const edit = await fresh.call('features', heightEdit(h));
      assert.equal(edit.isError, false, JSON.stringify(edit));
      const disk = readFileSync(part);
      assert.deepEqual(JSON.parse(disk.toString()), rectanglePart(80, 40, h));
      assert.equal(facts(await fresh.call('query', summary)).volume, 80 * 40 * h);
      assert.deepEqual(readFileSync(part), disk);
    }
  } finally { assert.equal(await fresh.close(), 0); }
  assert.deepEqual(readdirSync(d), ['part.bcad']);
});

test('D708 external MCP preserves an intervening creation, removal, and byte-identical replacement', async () => {
  for (const kind of ['create', 'remove', 'replace'] as const) {
    const d = dir(), part = join(d, 'part.bcad'), bytes = plateBytes(8);
    if (kind !== 'create') writeFileSync(part, bytes);
    const stale = client(['--doc', part]);
    try {
      await stale.request('initialize', {});
      if (kind === 'create') writeFileSync(part, bytes);
      else if (kind === 'remove') unlinkSync(part);
      else {
        const next = join(d, 'replacement');
        writeFileSync(next, bytes);
        assert.notEqual(statSync(part).ino, statSync(next).ino);
        renameSync(next, part);
      }
      const result = kind === 'create'
        ? await stale.call('model', { source: 'box({w: 10, d: 10, h: 10})' })
        : await stale.call('features', heightEdit(7));
      assert.equal(result.isError, true, kind);
      assert.match(result.content.at(-1)!.text, /\[STORAGE_CHANGED\]/);
      if (kind === 'remove') assert.equal(existsSync(part), false);
      else assert.deepEqual(readFileSync(part), bytes);
      assert.deepEqual(readdirSync(d), kind === 'remove' ? [] : ['part.bcad']);
    } finally { assert.equal(await stale.close(), 0); }
  }
});

test('D708 a failed native encode retains the expected disk state', async () => {
  const d = dir(), part = join(d, 'part.bcad'), bytes = plateBytes(8);
  writeFileSync(part, bytes);
  const store = docStore(part), { doc } = await store.open();
  const state = { doc: { ...doc, instances: 'invalid' } as unknown as StudioDoc, changed: true, version: 1 };
  assert.match(store.save(state, 'change') ?? '', /DRAWING_OPTIONS/);
  assert.deepEqual(readFileSync(part), bytes);
  assert.deepEqual(readdirSync(d), ['part.bcad']);
  assert.equal(store.save({ ...state, doc: rectanglePart(80, 40, 9) }, 'change'), null);
  assert.deepEqual(readFileSync(part), plateBytes(9));
});

function savePreload(d: string, part: string, mode: 'write' | 'rename' | 'barrier'): string {
  const file = join(d, 'preload.mjs');
  writeFileSync(file, `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const part = ${JSON.stringify(part)}, mode = ${JSON.stringify(mode)};
const ready = ${JSON.stringify(join(d, 'at-rename'))}, release = ${JSON.stringify(join(d, 'release'))};
const { openSync, writeFileSync, renameSync } = fs;
let temporary, injected = false;
fs.openSync = function(path, flags, ...args) {
  const fd = openSync(path, flags, ...args);
  if (typeof path === 'string' && path.endsWith('.tmp') && flags === 'wx') temporary = fd;
  return fd;
};
fs.writeFileSync = function(path, ...args) {
  if (mode === 'write' && !injected && path === temporary) { injected = true; throw new Error('injected temporary write'); }
  return writeFileSync(path, ...args);
};
fs.renameSync = function(from, to) {
  if (!injected && to === part && from.endsWith('.tmp')) {
    injected = true;
    if (mode === 'rename') throw new Error('injected rename');
    if (mode === 'barrier') {
      writeFileSync(ready, '');
      const timer = new Int32Array(new SharedArrayBuffer(4)), until = Date.now() + 15000;
      while (!fs.existsSync(release)) {
        if (Date.now() >= until) throw new Error('save barrier expired');
        Atomics.wait(timer, 0, 0, 10);
      }
    }
  }
  return renameSync(from, to);
};
syncBuiltinESMExports();
`);
  return file;
}

test('D708 external MCP preserves prior bytes and retries after temporary write and rename failures', async () => {
  for (const stage of ['write', 'rename'] as const) {
    const d = dir(), part = join(d, 'part.bcad'), bytes = plateBytes(8);
    writeFileSync(part, bytes);
    const session = client(['--doc', part], savePreload(d, part, stage));
    try {
      await session.request('initialize', {});
      const failed = await session.call('features', heightEdit(9));
      assert.equal(failed.isError, true, stage);
      assert.match(failed.content.at(-1)!.text, /Not saved: injected/);
      assert.deepEqual(readFileSync(part), bytes);
      assert.deepEqual(readdirSync(d).sort(), ['part.bcad', 'preload.mjs']);
      const retry = await session.call('features', heightEdit(10));
      assert.equal(retry.isError, false, JSON.stringify(retry));
      assert.deepEqual(readFileSync(part), plateBytes(10));
    } finally { assert.equal(await session.close(), 0); }
  }
});

test('D708 two external MCP processes cannot replace the same target during one guarded save', async () => {
  const d = dir(), part = join(d, 'part.bcad');
  writeFileSync(part, plateBytes(8));
  const first = client(['--doc', part], savePreload(d, part, 'barrier')), second = client(['--doc', part]);
  const release = join(d, 'release');
  let saving: ReturnType<typeof first.call> | undefined;
  try {
    await Promise.all([first.request('initialize', {}), second.request('initialize', {})]);
    saving = first.call('features', heightEdit(9));
    // Hold the first process after validation and before rename, while the second calls the real server.
    const ready = join(d, 'at-rename'), until = Date.now() + 10000;
    while (!existsSync(ready) && Date.now() < until) await delay(20);
    assert.ok(existsSync(ready));
    assert.deepEqual(readFileSync(part), plateBytes(8));
    const busy = await second.call('features', heightEdit(7));
    assert.equal(busy.isError, true, JSON.stringify(busy));
    assert.match(busy.content.at(-1)!.text, /\[STORAGE_BUSY\]/);
    assert.deepEqual(readFileSync(part), plateBytes(8));
    writeFileSync(release, '');
    assert.equal((await saving).isError, false);
    assert.deepEqual(readFileSync(part), plateBytes(9));
    const stale = await second.call('features', heightEdit(6));
    assert.equal(stale.isError, true);
    assert.match(stale.content.at(-1)!.text, /\[STORAGE_CHANGED\]/);
    assert.deepEqual(readFileSync(part), plateBytes(9));
    assert.deepEqual(readdirSync(d).sort(), ['at-rename', 'part.bcad', 'preload.mjs', 'release']);
  } finally {
    if (!existsSync(release)) writeFileSync(release, '');
    await saving?.catch(() => {});
    assert.deepEqual(await Promise.all([first.close(), second.close()]), [0, 0]);
  }
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
  assert.ok(r.json.ok && r.json.calls === 5 && Math.abs(r.json.facts.volume - PLATE_MM3) < 0.01, r.out);
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
  assert.equal(two.code, 0, two.err); assert.equal(two.json.wrote.length, 3); assert.ok(two.json.wrote.slice(0, 2).every((p: string) => /two-b\d+\.stl$/.test(p)));
  // (O9: the STLs' source beside them, naming both.)
  assert.match(two.json.wrote[2], /two\.source\.json$/);
  // Usage: exit 2.
  for (const args of [[], ['run'], ['run', script, '-o', join(d, 'x.step')], ['run', script, '--stl'], ['frobnicate'], ['check']]) assert.equal((await cli(args)).code, 2, JSON.stringify(args));
  assert.equal((await cli(['help'])).code, 0);
});

test('cad-cli STL precision refusal leaves existing outputs and writes no partial set', async () => {
  const d = dir(), input = join(d, 'precision.bcad'), output = join(d, 'precision.stl');
  const existing = join(d, 'precision-b1.stl');
  writeFileSync(existing, 'existing output');
  const first = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] });
  const ordinary = withNode(first, { kind: 'extrude', sketch: 0, height: 1, from: -4 });
  const second = withNode(ordinary, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] });
  const witness = withNode(second, { kind: 'extrude', sketch: 2, height: 1 / 4096, from: 9999 });
  writeFileSync(input, encodeStudioFile(witness));
  const result = await cli(['run', '-', '--doc', input, '--stl', output], 'box({w: 2, d: 2, h: 1, x: 20})');
  assert.equal(result.code, 1);
  assert.match(result.err, /STL_FLOAT32_COLLAPSE/);
  assert.deepEqual(readdirSync(d).sort(), ['precision-b1.stl', 'precision.bcad']);
  assert.equal(readFileSync(existing, 'utf8'), 'existing output');
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
