/** Node 22 focused Native Light canvas keyboard/view transport. No real browser or GPU proof. */
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const app = dirname(fileURLToPath(import.meta.url)), root = resolve(app, '../..');
const work = await mkdtemp(join(tmpdir(), 'barocss-native-light-presets-'));
let dom, failure, result;
try {
  await build({absWorkingDir: root, entryPoints: [join(app, 'src/native-light-navigation.ts'),
    join(app, 'src/native-light-view-presets.ts')], outdir: work, bundle: true,
    platform: 'node', format: 'esm', target: 'es2022', outExtension: {'.js': '.mjs'}});
  const navigation = await import(pathToFileURL(join(work, 'native-light-navigation.mjs')).href);
  const presets = await import(pathToFileURL(join(work, 'native-light-view-presets.mjs')).href);
  dom = new JSDOM('<!doctype html><html><body><canvas tabindex="0"></canvas><button>Other</button></body></html>',
    {url: 'http://localhost/material.html?workbench=lights'});
  const canvas = dom.window.document.querySelector('canvas'), other = dom.window.document.querySelector('button');
  canvas.width = 960; canvas.height = 600;
  canvas.getBoundingClientRect = () => ({left: 40, top: 30, width: 800, height: 500,
    right: 840, bottom: 530, x: 40, y: 30, toJSON: () => ({})});
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedRAF = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const savedCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  const frames = new Map(); let nextFrame = 0, state = 'ready', enabled = true, totalViews = 0;
  const busy = [], errors = [], selections = [];
  Object.defineProperty(globalThis, 'window', {value: dom.window, configurable: true});
  Object.defineProperty(globalThis, 'requestAnimationFrame', {value: fn => {const id = ++nextFrame; frames.set(id, fn); return id;}, configurable: true});
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {value: id => frames.delete(id), configurable: true});
  try {
    const authored = Object.freeze({format: 'native', display: {camera: {eye: [3, 2.5, 5], target: [0, -.5, 0],
      up: [0, 1, 0], fovYDegrees: 50, near: .01, far: 100}},
      revision: 31, source: 'unaltered CAD source'});
    let version = 1, snapshot = {accepted: authored, viewportCamera: null,
      pending: null, disposed: false, version: {generation: version}, canUndo: true, dirty: true};
    const calls = [];
    const session = {
      getSnapshot: () => snapshot,
      getStatus: () => ({state, width: 960, height: 600}),
      navigateViewportCamera: (target, expected) => {
        assert.strictEqual(expected, snapshot.version);
        assert.equal(snapshot.pending, null);
        assert.strictEqual(snapshot.accepted, authored);
        calls.push(target);
        version++;
        snapshot = {...snapshot, viewportCamera: target, version: {generation: version}};
        return Promise.resolve();
      },
    };
    const nav = navigation.createNativeLightNavigation(canvas, session, {
      mode: () => 'orbit', canNavigate: () => enabled,
      onBusy: value => busy.push(value), onError: value => errors.push(value),
      onPicked: value => selections.push(value),
    });
    const originalText = JSON.stringify(authored);
    const originalDistance = Math.hypot(...authored.display.camera.eye.map((n, i) =>
      n - authored.display.camera.target[i]));
    const press = (key, props = {}) => {
      const event = new dom.window.KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...props});
      canvas.dispatchEvent(event); return event.defaultPrevented;
    };
    const flush = async () => {
      for (const [id, fn] of [...frames]) {frames.delete(id); fn(0);}
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    };
    canvas.focus(); assert.equal(dom.window.document.activeElement, canvas);
    for (const [key, name, axis, up] of [
      ['1', 'front', 2, [0, 1, 0]], ['3', 'right', 0, [0, 1, 0]],
      ['7', 'top', 1, [0, 0, -1]],
    ]) {
      assert.equal(press(key), true, name + ' shortcut should be owned');
      assert.equal(frames.size, 1, 'One queued camera frame');
      assert.equal(press(key), false, 'Do not queue during active view');
      await flush();
      assert.equal(calls.length, ++totalViews);
      const view = snapshot.viewportCamera;
      assert(view && view.eye && view.target);
      assert.deepEqual(view.target, authored.display.camera.target);
      assert.deepEqual(view.up, up);
      assert.equal(Math.abs(view.eye[axis] - view.target[axis] - originalDistance) < 1e-9, true);
      for (let i = 0; i < 3; i++) if (i !== axis) assert.equal(view.eye[i], view.target[i]);
      for (const field of ['fovYDegrees', 'near', 'far']) assert.equal(view[field], authored.display.camera[field]);
      assert.strictEqual(snapshot.accepted, authored);
      assert.equal(snapshot.canUndo, true); assert.equal(snapshot.dirty, true);
      assert.equal(JSON.stringify(authored), originalText);
      assert.equal(nav.isActive(), false);
    }
    assert.throws(() => presets.deriveNativeLightViewPreset(authored.display.camera, 'diagonal', 1.6), /preset/i);
    assert.throws(() => presets.deriveNativeLightViewPreset(authored.display.camera, 'top', 0), /aspect/i);
    for (const props of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {repeat: true}])
      assert.equal(press('1', props), false, 'Modified/repeat input must not navigate');
    other.focus(); assert.equal(press('3'), false, 'Unfocused Canvas key must not navigate');
    canvas.focus(); enabled = false; assert.equal(press('7'), false, 'Host lock must refuse preset'); enabled = true;
    snapshot = {...snapshot, pending: 'draft'};
    assert.equal(press('1'), false, 'Pending session must refuse preset'); snapshot = {...snapshot, pending: null};
    state = 'lost'; assert.equal(press('1'), false, 'Lost device must refuse preset'); state = 'ready';
    assert.equal(press('1'), true, 'A ready workspace may request a new view');
    assert.equal(press('Escape'), true, 'Escape cancels queued preset');
    assert.equal(frames.size, 0, 'Canceled preset left queued frame');
    await flush(); assert.equal(calls.length, totalViews, 'Canceled preset presented a new camera');
    assert.equal(press('7'), true); nav.dispose();
    assert.equal(frames.size, 0, 'Disposal retained scheduled frame');
    await flush(); assert.equal(calls.length, totalViews, 'Disposed transport presented a late camera');
    assert.equal(selections.length, 0); assert.equal(errors.length, 0);
    assert.equal(busy.at(-1), false);
    result = {status: 'PASS', checks: ['front/right/top current view', 'single ACK per preset',
      'authored source/history/raw state preserved', 'modifier/focus/host/pending/loss fences',
      'Escape and disposal clear queued navigation'],
      acknowledgedViews: calls.length, leftoverFrames: frames.size};
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (savedRAF) Object.defineProperty(globalThis, 'requestAnimationFrame', savedRAF); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    if (savedCancel) Object.defineProperty(globalThis, 'cancelAnimationFrame', savedCancel); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
  }
} catch (error) {failure = error;}
finally {dom?.window.close(); await rm(work, {recursive: true, force: true});}
if (failure) throw failure;
console.log(JSON.stringify(result));
