/** G8: the three device error scopes share one deadline (was up to 3 × 10 s). Software-only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('webgpu-primitive-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const bounded = file.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'bounded').getText(file);
let scoped = null;
file.forEachChild(function visit(node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(file) === 'scoped') scoped = node.getText(file);
  else node.forEachChild(visit);
});
assert.ok(scoped, 'private scoped method present');
const script = ts.transpileModule(`
class PrimitiveBackendError extends Error { constructor(code, message) { super(message); this.code = code; } }
const wrap = (code, message, cause) => Object.assign(new Error(message), { code, cause });
const WAIT_MS = 10000;
${bounded}
class Viewport { constructor(device) { this.device = device; this.lived = 0; } live() { this.lived++; } ${scoped.replace(/^private\s+/, '')} }
globalThis.__Viewport = Viewport;
`, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
  const timers = new Map(); let created = 0;
  const context = { Promise, Error, AggregateError,
    setTimeout(callback) { const id = ++created; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(script, context, { timeout: 2000 });
  return { Viewport: context.__Viewport, timers, get created() { return created; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('three hung error scopes wait on a single deadline', async () => {
  const h = harness(); const pops = [];
  const device = { pushErrorScope() {}, popErrorScope() { pops.push(1); return new Promise(() => {}); } };
  const view = new h.Viewport(device);
  const pending = view.scoped(async () => 'drawn'); let error = null; pending.catch(e => { error = e; });
  await flush();
  assert.equal(pops.length, 3, 'all scopes popped at once');
  assert.equal(h.timers.size, 1, 'one shared timer');
  [...h.timers.values()][0](); h.timers.clear(); await flush();
  assert.match(String(error?.message), /Device error scope exceeded10s/);
  assert.equal(h.created, 1, 'no second or third 10 s wait after the first expiry');
});

test('scope results keep their meaning: a validation error refuses, clean scopes return the result', async () => {
  const run = async (results) => {
    const h = harness(), queue = [...results];
    const device = { pushErrorScope() {}, popErrorScope() { return Promise.resolve(queue.shift()); } };
    const view = new h.Viewport(device);
    try { return { value: await view.scoped(async () => 'drawn'), lived: view.lived }; } catch (e) { return { error: e.message }; }
  };
  assert.deepEqual(await run([null, null, null]), { value: 'drawn', lived: 1 });
  assert.match((await run([{ message: 'bad pipeline' }, null, null])).error, /Actual GPU error: bad pipeline/);
});
