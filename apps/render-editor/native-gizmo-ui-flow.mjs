/** Node 22 controlled DOM event reproduction, not a browser or GPU acceptance run. */
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
// Run the adopted focused camera-keyboard regression before allocating Gizmo DOM globals.
// A rejection propagates through this existing pnpm test command; no checks are skipped.
await import('./native-light-view-presets-flow.mjs');
const app = dirname(fileURLToPath(import.meta.url)), workspace = resolve(app, '../..');
// Resolve peer React imports through this app's installed pnpm node_modules, not /tmp.
const output = await mkdtemp(join(app, 'node_modules', '.barocss-native-gizmo-ui-'));
const dom = new JSDOM('<!doctype html><body></body>', {url: 'http://localhost/material.html'});
const saved = new Map(), frames = new Map(), captures = new Map(), observers = new Set();
let frameId = 0, result, failure, failed = false;
const cleanupErrors = []; let cleanup;
const install = (name, value) => {saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});};
const controls = {
  flushFrames() {const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(0);},
  resize() {for (const observer of [...observers]) observer.callback([], observer);},
  pendingFrames: () => frames.size, captures: () => captures.size, observers: () => observers.size,
};
try {
  for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'HTMLCanvasElement', 'Event', 'MouseEvent', 'KeyboardEvent']) install(name, dom.window[name]);
  install('IS_REACT_ACT_ENVIRONMENT', true);
  install('requestAnimationFrame', callback => {const id = ++frameId; frames.set(id, callback); return id;});
  install('cancelAnimationFrame', id => {frames.delete(id);});
  install('ResizeObserver', class {constructor(callback) {this.callback = callback;} observe() {observers.add(this);} disconnect() {observers.delete(this);} unobserve() {observers.delete(this);}});
  // Fresh jsdom-only prototypes, discarded with this realm; never patch browser/shared dependencies.
  dom.window.Element.prototype.setPointerCapture = function (id) {captures.set(id, this);};
  dom.window.Element.prototype.hasPointerCapture = function (id) {return captures.get(id) === this;};
  dom.window.Element.prototype.releasePointerCapture = function (id) {
    if (captures.get(id) !== this) return; captures.delete(id);
    const event = new dom.window.Event('lostpointercapture', {bubbles: true}); Object.defineProperty(event, 'pointerId', {value: id}); this.dispatchEvent(event);
  };
  const source = await readFile(join(app, 'public/reference-panel.barocad'), 'utf8'), sourceSha256 = createHash('sha256').update(source).digest('hex');
  assert.equal(sourceSha256, '8d3c423e8031bfa76d1606a982819b5e9a8d28c4915d4de2a86879f2f8d0af20');
  const built = await build({entryPoints: [join(app, 'src/native-gizmo-ui-flow.tsx')], outfile: join(output, 'flow.mjs'), absWorkingDir: workspace,
    bundle: true, platform: 'node', format: 'esm', metafile: true, external: ['react', 'react-dom', 'react-dom/*']});
  const inputs = Object.keys(built.metafile.inputs);
  for (const path of ['apps/render-editor/src/native-scene-gizmo.tsx', 'apps/render-editor/src/native-scene-host.ts', 'packages/barocss-render-editor/src/gizmo-surface.tsx', 'packages/barocss-render-editor/src/native-scene-gizmo.ts']) assert(inputs.includes(path), 'Actual implementation missing: ' + path);
  const api = await import(pathToFileURL(join(output, 'flow.mjs')).href);
  result = await api.runNativeGizmoUiFlow(source, controls);
  assert.equal(result.checks.length, 10); assert.equal(result.sourceRetained, true);
  delete result.canonicalSeed;
  result.sourceSha256 = sourceSha256; result.sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: workspace, encoding: 'utf8'}).trim();
  result.bundleSha256 = createHash('sha256').update(await readFile(join(output, 'flow.mjs'))).digest('hex');
  result.inputSha256 = Object.fromEntries(await Promise.all(inputs.map(async path => [path, createHash('sha256').update(await readFile(resolve(workspace, path))).digest('hex')])));
  if (process.env.BAROCSS_GIZMO_METAFILE) await writeFile(process.env.BAROCSS_GIZMO_METAFILE, JSON.stringify(built.metafile, null, 2) + '\n');
 } catch (error) {failure = error; failed = true;}
finally {
  cleanup = {frames: frames.size, captures: captures.size, observers: observers.size, bodyChildren: dom.window.document.body.children.length};
  try {dom.window.close();} catch (error) {cleanupErrors.push(error);}
  for (const [name, descriptor] of saved) {
    try {if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);}
    catch (error) {cleanupErrors.push(error);}
  }
  try {await rm(output, {recursive: true, force: true});} catch (error) {cleanupErrors.push(error);}
}
if (failed) {
  process.stderr.write(JSON.stringify({status: 'FAIL', message: String(failure), cleanupErrors: [...(failure?.gizmoCleanupErrors ?? []), ...cleanupErrors.map(String)], cleanup}) + '\n');
  throw failure;
}
if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Native gizmo launcher cleanup failed');
assert.deepEqual(cleanup, {frames: 0, captures: 0, observers: 0, bodyChildren: 0});
process.stdout.write(JSON.stringify({status: 'PASS', ...result, cleanup}) + '\n');
