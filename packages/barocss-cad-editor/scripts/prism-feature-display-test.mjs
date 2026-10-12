// Mock canvas/renderer protocol, not a browser or GPU test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/prism-display'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/prism-feature-display.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts') } });
writeFileSync(resolve(output, 'display.mjs'), bundle.outputFiles[0].text);
const { createPrismFeatureDisplay } = await import(pathToFileURL(resolve(output, 'display.mjs')));
let width = 300, height = 200, failMount = false, failResize = false, disposed = 0;
const children = [], renderers = [], mountedCounts = [];
const host = { getBoundingClientRect: () => ({ width, height }), appendChild: c => children.push(c),
  ownerDocument: { createElement: () => ({ width: 0, height: 0, style: {}, setAttribute() {}, remove() { const i = children.indexOf(this); if (i >= 0) children.splice(i, 1); } }) } };
const mount = (canvas, _scene, size) => {
  if (failMount) throw new Error('mock mount refusal');
  mountedCounts.push(_scene.geometries.length);
  canvas.width = size.width; canvas.height = size.height;
  const renderer = { resize(w, h) { assert.equal(typeof w, 'number'); assert.equal(typeof h, 'number'); if (failResize) throw new Error('mock resize refusal'); canvas.width = w; canvas.height = h; }, dispose() { disposed++; } };
  renderers.push(renderer); return renderer;
};
const display = createPrismFeatureDisplay(host, mount), scene = { scene: { geometries: [{}] } };
let candidate = await display.prepare(scene); assert.equal(children.length, 1); assert.notEqual(children[0].style.visibility, 'visible');
candidate.commit(); candidate.dispose(); assert.equal(children.length, 1); const first = children[0]; assert.equal(first.style.visibility, 'visible');
failMount = true; await assert.rejects(display.prepare(scene), /mount refusal/); assert.deepEqual(children, [first]); failMount = false;
candidate = await display.prepare(scene); failResize = true; assert.throws(() => candidate.commit(), /resize refusal/); candidate.dispose(); assert.deepEqual(children, [first]);
width = 600; height = 400; assert.throws(() => display.resize(), /resize refusal/); assert.deepEqual(display.dimensions(), { width: 300, height: 200 });
failResize = false; display.resize(); assert.deepEqual(display.dimensions(), { width: 600, height: 400 });
candidate = await display.prepare(scene); candidate.commit(); candidate.dispose(); assert.equal(children.length, 1); assert.notEqual(children[0], first); assert.equal(disposed, 2);
const stale = display.prepare(scene); display.dispose(); await assert.rejects(stale, /stale/); assert.equal(children.length, 0); assert.equal(disposed, 3);
const emptyDisplay = createPrismFeatureDisplay(host, mount); candidate = await emptyDisplay.prepare({ scene: { geometries: [] } }); candidate.commit(); candidate.dispose();
assert.equal(mountedCounts.at(-1), 0);
width = 200; height = 100; failResize = true; assert.throws(() => emptyDisplay.resize(), /resize refusal/);
assert.deepEqual(emptyDisplay.dimensions(), { width: 600, height: 400 }); failResize = false; emptyDisplay.resize(); assert.deepEqual(emptyDisplay.dimensions(), { width: 200, height: 100 }); emptyDisplay.dispose(); assert.equal(children.length, 0);
console.log(JSON.stringify({ ok: true, cases: ['stage/swap', 'mount refusal', 'commit resize refusal', 'resize rollback pick dimensions', 'replacement disposal', 'dispose while staging', 'empty resize'], evidence: 'mock DOM/renderer lifecycle only; no browser/GPU pixels' }));
