/** Software-only private release behavior; not a WebGPU device witness. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import './qualified-face-dispose-completeness.test.mjs';
import './qualified-face-handoff.test.mjs';

const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('viewport.ts', source, ts.ScriptTarget.ES2022, true);
const functions = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'release');
assert.equal(functions.length, 1);
const code = ts.transpileModule(functions[0].getText(parsed) + '\nexport { release };',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { release } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('all peer GPU handles are attempted even when first buffer and texture refuse', () => {
  const calls = [], refusedBuffer = new Error('buffer'), refusedTexture = new Error('texture');
  const resource = {
    buffers: [
      { destroy() { calls.push('b1'); throw refusedBuffer; } },
      { destroy() { calls.push('b2'); } },
    ],
    textures: [
      { destroy() { calls.push('t1'); throw refusedTexture; } },
      { destroy() { calls.push('t2'); } },
    ],
    pipeline: {}, group: {},
  };
  assert.doesNotThrow(() => release(resource));
  assert.deepEqual(calls, ['b1', 'b2', 't1', 't2']);
  assert.equal(resource.buffers.length, 0);
  assert.equal(resource.textures.length, 0);
  assert.equal(resource.pipeline, null);
  assert.equal(resource.group, null);
  release(resource);
  assert.deepEqual(calls, ['b1', 'b2', 't1', 't2'], 'idempotent after teardown');
});

test('empty and null resources are safe', () => {
  assert.doesNotThrow(() => release(null));
  const resource = { buffers: [], textures: [], pipeline: null, group: null };
  assert.doesNotThrow(() => release(resource));
});
