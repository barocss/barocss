/** #1922 structural GL2 teardown receipt; no browser, driver or pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { QualifiedFaceSceneError } from '../dist/index.js';

const source = await readFile(new URL('../src/qualified-face-scene-renderer.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('qualified-face-scene-renderer.ts', source, ts.ScriptTarget.ES2022, true);
const klass = parsed.statements.find(node => ts.isClassDeclaration(node)
  && node.name?.text === 'QualifiedFaceSceneRenderer');
assert.ok(klass, 'Extract the production QualifiedFaceSceneRenderer');
const names = ['free', 'release', 'dispose', 'getScene', 'live'];
const methods = names.map(name => {
  const matches = klass.members.filter(node => ts.isMethodDeclaration(node)
    && node.name?.getText(parsed) === name);
  assert.equal(matches.length, 1, `Exactly one production ${name} method is required`);
  return matches[0].getText(parsed);
});
const dataSource = await readFile(new URL('../src/gpu-data.ts', import.meta.url), 'utf8');
const dataParsed = ts.createSourceFile('gpu-data.ts', dataSource, ts.ScriptTarget.ES2022, true);
const freeze = dataParsed.statements.find(node => ts.isFunctionDeclaration(node)
  && node.name?.text === 'freezeGpuData');
assert.ok(freeze, 'Extract the production freezeGpuData implementation');
const snippet = `${freeze.getText(dataParsed).replace(/^export\s+/, '')}
class TeardownHarness { ${methods.join('\n')} }
globalThis.TeardownHarness = TeardownHarness;`;
const emitted = ts.transpileModule(snippet, {
  compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { AggregateError, QualifiedFaceSceneError, structuredClone };
vm.runInNewContext(emitted, context, { timeout: 2000 });

function fixture({ failures = {}, lost = false, foreignBindings = false } = {}) {
  const subject = new context.TeardownHarness(), calls = [];
  const handle = name => ({ name });
  const draws = [
    { vao: handle('vao-a'), buffers: [handle('buffer-a1'), handle('buffer-a2')] },
    { vao: handle('vao-b'), buffers: [handle('buffer-b1'), handle('buffer-b2')] },
  ];
  const target = {
    program: handle('program'), draws,
    framebuffer: handle('framebuffer'), color: handle('texture'), depth: handle('renderbuffer'),
  };
  const step = name => {
    calls.push(name);
    if (Object.hasOwn(failures, name)) throw failures[name];
  };
  const gl = {
    CURRENT_PROGRAM: 'program-binding', VERTEX_ARRAY_BINDING: 'vao-binding',
    READ_FRAMEBUFFER: 'read', READ_FRAMEBUFFER_BINDING: 'read-binding',
    DRAW_FRAMEBUFFER: 'draw', DRAW_FRAMEBUFFER_BINDING: 'draw-binding',
    isContextLost() { step('context-query'); return lost; },
    getParameter(binding) {
      step(`query:${binding}`);
      if (foreignBindings) return handle(`foreign:${binding}`);
      return {
        'program-binding': target.program, 'vao-binding': draws[0].vao,
        'read-binding': target.framebuffer, 'draw-binding': target.framebuffer,
      }[binding];
    },
    useProgram(value) { assert.equal(value, null); step('unbind:program'); },
    bindVertexArray(value) { assert.equal(value, null); step('unbind:vao'); },
    bindFramebuffer(binding, value) { assert.equal(value, null); step(`unbind:${binding}`); },
    deleteProgram(value) { step(`delete:${value.name}`); },
    deleteVertexArray(value) { step(`delete:${value.name}`); },
    deleteBuffer(value) { step(`delete:${value.name}`); },
    deleteFramebuffer(value) { step(`delete:${value.name}`); },
    deleteTexture(value) { step(`delete:${value.name}`); },
    deleteRenderbuffer(value) { step(`delete:${value.name}`); },
  };
  subject.gl = gl;
  subject.accepted = target;
  subject.disposed = false;
  subject.unavailable = false;
  subject.onLoss = () => {};
  subject.canvas = {
    removeEventListener(type, callback) {
      assert.equal(type, 'webglcontextlost');
      assert.equal(callback, subject.onLoss);
      step('listener');
    },
  };
  subject.counts = { programs: 1, shaders: 0, vaos: 2, buffers: 4,
    framebuffers: 1, textures: 1, renderbuffers: 1 };
  subject.cpuScene = {
    format: 'barocss-gpu-qualified-face-scene', version: 0,
    profile: 'source-qualified-forward-face-v0', sourceVersion: 0,
    basis: 'authored-xyz-matches-rhyup',
    assets: [{ sourceId: 'original-a', source: 'original source A', face: { id: 'face-a' }, color: [1, 0, 0] },
      { sourceId: 'original-b', source: 'original source B', face: { id: 'face-b' }, color: [0, 1, 0] }],
    camera: { eye: [0, 0, 3] }, mmToSceneUnit: 0.01, translate: [0, 0, 0], background: [0, 0, 0],
  };
  return { subject, target, draws, calls };
}

const deletions = ['program', 'vao-a', 'buffer-a1', 'buffer-a2', 'vao-b',
  'buffer-b1', 'buffer-b2', 'framebuffer', 'texture', 'renderbuffer'].map(name => `delete:${name}`);
function assertRetired({ subject, target, draws, calls }, expectedFailures = []) {
  assert.equal(subject.disposed, true);
  assert.equal(subject.accepted, null);
  for (const name of ['program', 'framebuffer', 'color', 'depth']) assert.equal(target[name], null);
  assert.equal(target.draws.length, 0);
  for (const draw of draws) {
    assert.equal(draw.vao, null);
    assert.equal(draw.buffers.length, 0);
  }
  assert.deepEqual(calls.filter(name => name.startsWith('delete:')), deletions,
    'Every owned handle gets exactly one deletion attempt');
  const priorCalls = calls.slice();
  assert.equal(subject.dispose(), undefined);
  assert.deepEqual(calls, priorCalls, 'Terminal disposal never retries uncertain deletion');
  const expectedCounts = { programs: 0, shaders: 0, vaos: 0, buffers: 0,
    framebuffers: 0, textures: 0, renderbuffers: 0 };
  for (const name of expectedFailures) {
    if (name === 'program') expectedCounts.programs++;
    else if (name.startsWith('vao-')) expectedCounts.vaos++;
    else if (name.startsWith('buffer-')) expectedCounts.buffers++;
    else if (name === 'framebuffer') expectedCounts.framebuffers++;
    else if (name === 'texture') expectedCounts.textures++;
    else if (name === 'renderbuffer') expectedCounts.renderbuffers++;
  }
  assert.deepEqual(subject.counts, expectedCounts, 'Only successful deletes decrement counters');
}
function cleanupError(subject) {
  let result;
  try { subject.dispose(); } catch (error) { result = error; }
  assert.ok(result instanceof QualifiedFaceSceneError);
  assert.equal(result.code, 'GPU');
  assert.equal(result.message, 'Qualified Face disposal cleanup refused');
  assert.ok(result.cause instanceof AggregateError);
  return result;
}

test('qualified Face dispose releases both draw owners and every resource kind once', () => {
  const data = fixture();
  assert.equal(data.subject.dispose(), undefined);
  assertRetired(data);
  assert.deepEqual(data.calls.filter(name => name.startsWith('unbind:')),
    ['unbind:program', 'unbind:vao', 'unbind:read', 'unbind:draw']);
});

test('program, VAO, buffer and texture cleanup failures preserve exact causes and continue', () => {
  const errors = [new Error('program refused'), { refusal: 'vao' }, new Error('buffer refused'), 'texture refused'];
  const names = ['program', 'vao-a', 'buffer-a1', 'texture'];
  const failures = Object.fromEntries(names.map((name, index) => [`delete:${name}`, errors[index]]));
  const data = fixture({ failures });
  assert.deepEqual(Array.from(cleanupError(data.subject).cause.errors), errors);
  assertRetired(data, names);
});

test('undefined deletion and listener causes survive aggregation without replacing peers', () => {
  const bufferFailure = new Error('second buffer refused');
  const data = fixture({ failures: { listener: undefined, 'delete:program': undefined,
    'delete:buffer-b2': bufferFailure } });
  assert.deepEqual(Array.from(cleanupError(data.subject).cause.errors), [undefined, undefined, bufferFailure]);
  assertRetired(data, ['program', 'buffer-b2']);
});

test('listener and binding-query failures still attempt all resource deletions', () => {
  const listener = new Error('listener refused'), query = new Error('binding query refused');
  const data = fixture({ failures: { listener, 'query:program-binding': query } });
  assert.deepEqual(Array.from(cleanupError(data.subject).cause.errors), [listener, query]);
  assertRetired(data);
  assert.ok(data.calls.includes('query:vao-binding'));
  assert.ok(data.calls.includes('query:read-binding'));
  assert.ok(data.calls.includes('query:draw-binding'));
});

test('unbind failures continue through later bindings and preserve a nested original aggregate', () => {
  const original = new AggregateError([new Error('driver detail')], 'original driver aggregate');
  const data = fixture({ failures: { 'unbind:program': original, 'unbind:vao': undefined } });
  assert.deepEqual(Array.from(cleanupError(data.subject).cause.errors), [original, undefined]);
  assert.ok(data.calls.includes('unbind:read') && data.calls.includes('unbind:draw'));
  assertRetired(data);
});

test('context-loss query failure does not prevent deleting owned handles', () => {
  const cause = new Error('context query refused');
  const data = fixture({ failures: { 'context-query': cause } });
  assert.deepEqual(Array.from(cleanupError(data.subject).cause.errors), [cause]);
  assertRetired(data);
});

test('lost context skips binding work while retiring all owned handles', () => {
  const data = fixture({ lost: true });
  assert.equal(data.subject.dispose(), undefined);
  assert.equal(data.calls.some(name => name.startsWith('query:') || name.startsWith('unbind:')), false);
  assertRetired(data);
});

test('foreign program, VAO and framebuffer bindings remain untouched', () => {
  const data = fixture({ foreignBindings: true });
  data.subject.dispose();
  assert.equal(data.calls.some(name => name.startsWith('unbind:')), false);
  assertRetired(data);
});

test('CPU authority stays independently readable after failed disposal; live operations refuse', () => {
  const data = fixture({ failures: { 'delete:texture': new Error('texture refused') } });
  const before = data.subject.getScene();
  cleanupError(data.subject);
  const after = data.subject.getScene();
  assert.deepEqual(after, before);
  assert.notEqual(after, before);
  assert.notEqual(after.assets, before.assets);
  assert.notEqual(after.assets[0].face, before.assets[0].face);
  assert.ok(Object.isFrozen(after) && Object.isFrozen(after.assets) && Object.isFrozen(after.assets[0].face));
  data.subject.cpuScene.assets[0].source = 'mutated backing authority';
  assert.equal(after.assets[0].source, 'original source A');
  assert.throws(() => data.subject.live(), error => error instanceof QualifiedFaceSceneError && error.code === 'DISPOSED');
  assertRetired(data, ['texture']);
});

test('ordinary candidate release retains its prior fail-fast contract', () => {
  const cause = new Error('candidate program refused');
  const data = fixture({ failures: { 'delete:program': cause } });
  assert.throws(() => data.subject.release(data.target), error => error === cause);
  assert.deepEqual(data.calls.filter(name => name.startsWith('delete:')), ['delete:program']);
  assert.equal(data.subject.disposed, false);
  assert.equal(data.subject.accepted, data.target);
  assert.equal(data.subject.counts.programs, 1);
  assert.notEqual(data.target.program, null);
  assert.equal(data.target.draws.length, 2);
});
