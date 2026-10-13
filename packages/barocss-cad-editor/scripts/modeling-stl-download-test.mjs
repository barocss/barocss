// Eight focused transfer/download/UI groups. Genuine #1890 bytes; no native execution.
// React is mounted in jsdom with a controlled controller/display and browser APIs.
// A simulated anchor click does not establish physical browser download acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const esbuild = require('esbuild');
const fixtureDir = resolve(root, 'packages/barocss-cad/test/modeling-stl-evidence');
const transferBytes = readFileSync(resolve(fixtureDir, 'baseline-transfer.json'));
const capture = JSON.parse(transferBytes);
const expectedHashes = {
  transfer: 'bedaa0789d86a310fe6ba25fc163f3063bdebceadc2f3223c8938663584ec92d',
  left: '69d3626394ef2dbad8e2ba0d87cdee39b74d4e20bf2fd60e22fef3a5a5a82f1d',
  right: 'c2a8c63ec1a0ff9ea8d1cded0737bc0cb9e79ceeea9f689eeefcedb5430f7d6e',
  provider: 'cb84c053368fdc9a8dd1af63c824fc36bf40af8413207f9e6f893009b7854090',
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const binding = outputName => ({ outputName, solidId: capture.outputIdentities[outputName].solidId,
  revision: 0, acceptedTaskToken: 'accepted_stl_test', requestTaskToken: 'request_stl_test' });
function transfer(outputName = 'right') {
  const original = capture.exports[outputName];
  return { ...binding(outputName), format: original.format, lengthUnit: original.lengthUnit,
    sourceFrame: original.details.report.sourceFrame, bytes: [...original.bytes], byteLength: original.byteLength,
    triangleCount: original.triangleCount, maximumVertexDisplacementMM: original.maximumVertexDisplacementMM };
}
async function bundle(entryPoint, plugins = []) {
  const built = await esbuild.build({ entryPoints: [resolve(root, entryPoint)], bundle: true,
    platform: 'node', format: 'cjs', jsx: 'automatic', write: false, plugins,
    external: ['react', 'react/jsx-runtime'], logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const { validateModelingStlExport: validate, downloadModelingStl: download } = await bundle(
  'packages/barocss-cad-editor/src/modeling-stl.ts');
const groups = [];
async function group(name, run) {
  await run(); groups.push(name);
  console.log(JSON.stringify({ group: groups.length, name, status: 'PASS' }));
}

await group('pinned genuine left/right files and immutable exact transfer', () => {
  assert.equal(transferBytes.length, 760265);
  assert.equal(hash(transferBytes), expectedHashes.transfer);
  assert.equal(hash(readFileSync(resolve(fixtureDir, 'verification.json'))), expectedHashes.provider);
  const fields = ['outputName', 'solidId', 'revision', 'acceptedTaskToken', 'requestTaskToken', 'format',
    'lengthUnit', 'sourceFrame', 'bytes', 'byteLength', 'triangleCount', 'maximumVertexDisplacementMM'].sort();
  for (const outputName of ['left', 'right']) {
    const input = transfer(outputName), result = validate(input, binding(outputName));
    const file = readFileSync(resolve(fixtureDir, `baseline-${outputName}.stl`));
    assert.equal(hash(file), expectedHashes[outputName]);
    assert.deepEqual(Buffer.from(result.bytes), file);
    assert.deepEqual(Reflect.ownKeys(result).sort(), fields);
    assert.deepEqual(result, input); assert.notEqual(result.bytes, input.bytes);
    assert.equal(result.byteLength, 684); assert.equal(result.triangleCount, 12);
    assert.equal(result.format, 'binary-stl'); assert.equal(result.lengthUnit, 'mm');
    assert.equal(result.sourceFrame, 'authored-xyz-no-axis-conversion');
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.bytes));
    input.bytes[100] ^= 1; assert.deepEqual(Buffer.from(result.bytes), file);
    assert.throws(() => { result.bytes[0] = 0; }, TypeError);
  }
  assert.notDeepEqual(capture.exports.left.bytes, capture.exports.right.bytes);
});

await group('malformed header count facets and dense uint8 controls', () => {
  const controls = [
    ['wrong header', v => { v.bytes[0] ^= 1; }],
    ['nonzero header padding', v => { v.bytes[79] = 1; }],
    ['encoded count mismatch', v => { v.bytes[80] = 13; }],
    ['declared count mismatch', v => { v.triangleCount = 13; }],
    ['truncated', v => { v.bytes.pop(); }],
    ['trailing byte', v => { v.bytes.push(0); }],
    ['oversized count', v => { v.triangleCount = 41; v.byteLength = 2134; v.bytes.length = 2134; }],
    ['sparse array', v => { delete v.bytes[100]; }],
    ['non-integer byte', v => { v.bytes[100] = 0.5; }],
    ['negative byte', v => { v.bytes[100] = -1; }],
    ['overflow byte', v => { v.bytes[100] = 256; }],
    ['typed byte array', v => { v.bytes = Uint8Array.from(v.bytes); }],
    ['extra byte property', v => { v.bytes.extra = 1; }],
    ['attribute byte', v => { v.bytes[132] = 1; }],
    ['nonfinite vertex', v => { v.bytes.splice(96, 4, 0, 0, 128, 127); }],
    ['collapsed facet', v => { v.bytes.splice(108, 12, ...v.bytes.slice(96, 108)); }],
    ['opposite normal', v => { v.bytes[95] ^= 128; }],
    ['nonfinite loss', v => { v.maximumVertexDisplacementMM = Infinity; }],
    ['negative loss', v => { v.maximumVertexDisplacementMM = -1; }],
    ['wrong units', v => { v.lengthUnit = 'inch'; }],
    ['converted frame', v => { v.sourceFrame = 'viewer-y-up'; }],
  ];
  for (const [name, mutate] of controls) {
    const value = transfer(); mutate(value);
    assert.throws(() => validate(value, binding('right')), undefined, name);
  }
});

await group('own-data getter symbol identity and filename refusal', () => {
  let getterReads = 0;
  for (const field of ['bytes', 'outputName', 'maximumVertexDisplacementMM']) {
    const value = transfer();
    Object.defineProperty(value, field, { enumerable: true, get() { getterReads++; throw Error('getter executed'); } });
    assert.throws(() => validate(value, binding('right')));
  }
  const byteAccessor = transfer();
  Object.defineProperty(byteAccessor.bytes, '100', { enumerable: true, get() { getterReads++; return 0; } });
  assert.throws(() => validate(byteAccessor, binding('right'))); assert.equal(getterReads, 0);
  const symbolic = transfer(); symbolic[Symbol('extra')] = 1;
  assert.throws(() => validate(symbolic, binding('right')));
  const symbolBytes = transfer(); symbolBytes.bytes[Symbol('extra')] = 1;
  assert.throws(() => validate(symbolBytes, binding('right')));
  const hidden = transfer(); Object.defineProperty(hidden, 'solidId', { enumerable: false });
  assert.throws(() => validate(hidden, binding('right')));
  const inherited = Object.assign(Object.create({ extra: 1 }), transfer());
  assert.throws(() => validate(inherited, binding('right')));
  for (const [field, replacement] of [['outputName', 'left'], ['solidId', 'wrong_solid'], ['revision', 1],
    ['acceptedTaskToken', 'stale_accepted'], ['requestTaskToken', 'stale_request']]) {
    assert.throws(() => validate({ ...transfer(), [field]: replacement }, binding('right')), undefined, field);
  }
  for (const outputName of ['../right', 'right.stl', 'a/b', 'a\\b', '', 'a'.repeat(49), '__proto__', 'constructor']) {
    const expected = { ...binding('right'), outputName };
    assert.throws(() => validate({ ...transfer(), outputName }, expected), undefined, outputName);
  }
});

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.invalid/' });
const globals = new Map();
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}
for (const name of ['window', 'document', 'HTMLElement', 'HTMLAnchorElement', 'Event', 'MouseEvent', 'navigator']) {
  setGlobal(name, dom.window[name]);
}
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
setGlobal('ResizeObserver', class { observe() {} disconnect() {} });
const NativeBlob = globalThis.Blob;
const blobs = [], anchors = [], clicks = [], createdUrls = [], revokedUrls = [];
const liveUrls = new Set(['blob:unrelated-owner']);
let clickFailure = null;
setGlobal('Blob', class extends NativeBlob {
  constructor(...args) { super(...args); blobs.push(this); }
});
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;
URL.createObjectURL = blob => {
  assert.ok(blob instanceof NativeBlob);
  const url = `blob:stl-test-${createdUrls.length + 1}`; createdUrls.push(url); liveUrls.add(url); return url;
};
URL.revokeObjectURL = url => { revokedUrls.push(url); liveUrls.delete(url); };
const originalCreateElement = document.createElement.bind(document);
document.createElement = (tag, ...args) => {
  const element = originalCreateElement(tag, ...args);
  if (tag === 'a') anchors.push(element);
  return element;
};
const originalClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  clicks.push({ href: this.href, filename: this.download, attached: this.isConnected });
  if (clickFailure) throw clickFailure;
};
const unrelatedAnchor = originalCreateElement('a'); unrelatedAnchor.href = 'blob:unrelated-owner';
document.body.append(unrelatedAnchor);
const counts = () => ({ blobs: blobs.length, anchors: anchors.length, clicks: clicks.length,
  creates: createdUrls.length, revokes: revokedUrls.length });
function assertSingleDownload(before, outputName) {
  for (const [key, count] of Object.entries(counts())) assert.equal(count, before[key] + 1, key);
  assert.equal(clicks.at(-1).filename, `${outputName}.stl`); assert.equal(clicks.at(-1).attached, true);
  assert.equal(clicks.at(-1).href, createdUrls.at(-1)); assert.equal(revokedUrls.at(-1), createdUrls.at(-1));
  assert.equal(anchors.at(-1).isConnected, false); assert.equal(unrelatedAnchor.isConnected, true);
  assert.deepEqual([...liveUrls], ['blob:unrelated-owner']);
}
let reactRoot;
try {
  await group('one owned Blob URL anchor click and successful cleanup', async () => {
    const before = counts(); download(validate(transfer(), binding('right')));
    assertSingleDownload(before, 'right'); assert.equal(blobs.at(-1).type, 'model/stl');
    assert.equal(hash(Buffer.from(await blobs.at(-1).arrayBuffer())), expectedHashes.right);
    const after = counts();
    assert.throws(() => download({ ...transfer(), outputName: '../right' }));
    assert.deepEqual(counts(), after, 'invalid filename must create no resources');
    let getterReads = 0; const accessor = transfer();
    Object.defineProperty(accessor, 'outputName', { enumerable: true, get() { getterReads++; return 'right'; } });
    assert.throws(() => download(accessor)); assert.equal(getterReads, 0);
    assert.deepEqual(counts(), after, 'own-data admission must happen before creating resources');
  });
  await group('throwing click cleans only its own anchor and URL', async () => {
    const before = counts(), refusal = Error('controlled click failure'); clickFailure = refusal;
    assert.throws(() => download(validate(transfer('left'), binding('left'))), error => error === refusal);
    clickFailure = null; assertSingleDownload(before, 'left');
    assert.equal(hash(Buffer.from(await blobs.at(-1).arrayBuffer())), expectedHashes.left);
  });

  const React = require('react'), { createRoot } = require('react-dom/client');
  const { act } = React;
  const accepted = { source: 'model', documentId: 'stl_ui_model', revision: 0,
    parameters: structuredClone(capture.parameters), features: structuredClone(capture.features),
    outputs: ['left', 'right'].map(name => ({ name, ...capture.outputIdentities[name],
      volumeMM3: { numerator: String(capture.summary.volumesMM3[name]), denominator: '1' } })) };
  let snapshot = { accepted, authoredText: capture.text, display: null, faceSelection: null,
    drafts: {}, selection: 1, generation: 1, busy: false, disposed: false, error: null,
    workerReady: true, history: { index: 0, count: 1, canUndo: false, canRedo: false } };
  let listener = () => {}, exportRefusal = null, nullExport = false, sessionCount = 0;
  const exportCalls = [], otherCalls = [];
  const session = {
    getSnapshot() { return snapshot; },
    subscribe(next) { listener = next; return () => { listener = () => {}; }; },
    async example(...args) { otherCalls.push(['example', ...args]); },
    async exportStl(...args) {
      exportCalls.push(args); if (exportRefusal) throw exportRefusal;
      if (nullExport) return null;
      return validate(transfer(args[0]), binding(args[0]));
    },
    dispose() { otherCalls.push(['dispose']); },
  };
  setGlobal('__modelingStlUiTest', {
    controller() { sessionCount++; return session; },
    display() { return { aspect() { return 1; }, resize() {}, dispose() {} }; },
  });
  const mocks = [{ name: 'controlled-controller-and-display', setup(build) {
    build.onResolve({ filter: /(?:modeling-controller|prism-feature-display)\.js$/ }, args => ({ path: args.path, namespace: 'controlled' }));
    build.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: args.path.includes('modeling-controller')
      ? 'export const createCadEditorModelingController = globalThis.__modelingStlUiTest.controller;'
      : 'export const createPrismFeatureDisplay = globalThis.__modelingStlUiTest.display;' }));
    build.onResolve({ filter: /^\.\/ui\/(button|input|label)\.js$/ }, args => ({ path: args.path, namespace: 'host-ui' }));
    build.onLoad({ filter: /.*/, namespace: 'host-ui' }, args => {
      const [name, tag] = args.path.includes('button') ? ['Button', 'button'] : args.path.includes('input') ? ['Input', 'input'] : ['Label', 'label'];
      return { contents: `import {createElement} from 'react'; export function ${name}({variant, size, ...props}) { return createElement('${tag}', props); }` };
    });
    build.onResolve({ filter: /^@barocss\/(cad|gpu|viewer|cad-interop)(\/|$)/ }, args => { throw Error(`Unexpected native/render import: ${args.path}`); });
  } }];
  const { CadEditorModeling } = await bundle('packages/barocss-cad-editor/src/react/modeling-editor.tsx', mocks);
  const container = document.getElementById('root'); reactRoot = createRoot(container);
  await act(async () => { reactRoot.render(React.createElement(CadEditorModeling)); });
  const buttons = () => [...container.querySelectorAll('button')];
  const button = label => buttons().find(node => node.textContent === label);
  const chooser = () => {
    const label = [...container.querySelectorAll('label')].find(node => node.textContent === 'STL output');
    assert.ok(label, 'actual component must label its STL chooser');
    const select = document.getElementById(label.htmlFor); assert.equal(select?.tagName, 'SELECT'); return select;
  };
  const choose = async value => { await act(async () => { const select = chooser(); select.value = value;
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }); };
  const click = async node => { assert.ok(node, 'button exists'); await act(async () => { node.click(); }); };
  const update = async fields => { await act(async () => { snapshot = { ...snapshot, ...fields }; listener(); }); };
  const preserved = () => structuredClone({ accepted: snapshot.accepted, authoredText: snapshot.authoredText,
    display: snapshot.display, faceSelection: snapshot.faceSelection, selection: snapshot.selection,
    generation: snapshot.generation, history: snapshot.history, drafts: snapshot.drafts });

  await group('mounted React explicit chooser routes genuine right and left bytes', async () => {
    assert.equal(sessionCount, 1); assert.deepEqual(otherCalls, [['example']]);
    assert.equal(chooser().value, '', 'screen or output order must not silently select STL');
    assert.equal(button('Download STL')?.disabled, true);
    for (const name of ['left', 'right']) {
      const option = [...chooser().options].find(node => node.value === name);
      assert.ok(option); assert.equal(option.disabled, false); assert.match(option.textContent, /convex-planar/);
    }
    const beforeState = preserved();
    for (const name of ['right', 'left']) {
      await choose(name); assert.equal(button('Download STL').disabled, false);
      const before = counts(); await click(button('Download STL')); assertSingleDownload(before, name);
      assert.deepEqual(exportCalls.at(-1), [name, snapshot.generation, false]);
      assert.equal(hash(Buffer.from(await blobs.at(-1).arrayBuffer())), expectedHashes[name]);
    }
    assert.deepEqual(preserved(), beforeState); assert.deepEqual(otherCalls, [['example']]);
    assert.match(container.textContent, /Float32/i); assert.match(container.textContent, /millimetre|millimeter|\bmm\b/i);
    assert.match(container.textContent, /maximum vertex displacement/i);
  });

  await group('mounted React busy draft unsupported legacy and missing-output guards', async () => {
    const before = counts(), callsBefore = exportCalls.length;
    for (const fields of [{ busy: true }, { busy: false, drafts: { width: '42' } }]) {
      await update(fields); assert.equal(button('Download STL').disabled, true);
      assert.ok(chooser().matches(':disabled')); await click(button('Download STL'));
    }
    await update({ drafts: {}, busy: false });
    for (const family of ['stored-rational-plate-hole', 'stored-rational-circle-prism', 'orthogonal-cell']) {
      await update({ accepted: { ...accepted, outputs: accepted.outputs.map(output => ({ ...output, family })) } });
      for (const name of ['left', 'right']) assert.equal([...chooser().options].find(option => option.value === name).disabled, true);
      assert.equal(button('Download STL').disabled, true); await click(button('Download STL'));
    }
    await update({ accepted: { ...accepted, source: 'legacy' } });
    for (const name of ['left', 'right']) assert.equal([...chooser().options].find(option => option.value === name).disabled, true);
    assert.equal(button('Download STL').disabled, true);
    await update({ accepted: { ...accepted, outputs: accepted.outputs.filter(output => output.name === 'right') } });
    assert.equal(button('Download STL').disabled, true, 'removed selected left output must not route elsewhere');
    await update({ accepted: null });
    assert.ok(!button('Download STL') || button('Download STL').disabled);
    assert.deepEqual(counts(), before); assert.equal(exportCalls.length, callsBefore);
    await update({ accepted, generation: 2 });
  });

  await group('mounted React explicit recovery intent and honest refusal without download', async () => {
    await choose('right'); await update({ workerReady: false });
    const label = 'Recover accepted model and export STL';
    assert.equal(button('Download STL'), undefined); assert.ok(button(label));
    assert.match(container.textContent, /rebuild|reconstruct/i);
    const beforeState = preserved(), before = counts();
    await click(button(label)); assertSingleDownload(before, 'right');
    assert.deepEqual(exportCalls.at(-1), ['right', snapshot.generation, true]);
    assert.deepEqual(preserved(), beforeState);
    exportRefusal = Error('controlled native STL loss refusal');
    const beforeRefusal = counts(); await click(button(label));
    assert.deepEqual(counts(), beforeRefusal); assert.match(container.querySelector('[role="alert"]').textContent, /controlled native STL loss refusal/);
    assert.deepEqual(preserved(), beforeState); exportRefusal = null;
    nullExport = true; const beforeNull = counts(); await click(button(label));
    assert.deepEqual(counts(), beforeNull, 'canceled/refused null result must never download');
    assert.deepEqual(preserved(), beforeState); nullExport = false;
    await update({ workerReady: true });
    assert.equal(button(label), undefined); assert.ok(button('Download STL'));
    assert.equal(sessionCount, 1); assert.deepEqual(otherCalls, [['example']]);
  });
  await act(async () => { reactRoot.unmount(); }); reactRoot = null;
} finally {
  if (reactRoot) { const { act } = require('react'); await act(async () => { reactRoot.unmount(); }); }
  HTMLAnchorElement.prototype.click = originalClick;
  document.createElement = originalCreateElement;
  URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl;
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 8);
console.log(JSON.stringify({ status: 'PASS', groups, nativeCalls: 0,
  fixtureHashes: expectedHashes,
  boundary: 'Actual helper and mounted React; controlled controller/display/DOM URLs/clicks. Physical browser download and native execution UNRUN.' }));
