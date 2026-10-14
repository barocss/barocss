// Ten finite ownership controls against the actual CAD display implementation.
// DOM, mount and renderer are explicit doubles; no native, GPU or browser runs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/modeling-preview-display');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const result = await require('esbuild').build({
  entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/prism-feature-display.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'explicit-gpu-boundary-double', setup(build) {
    build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu-boundary-double', namespace: 'mock-gpu' }));
    build.onLoad({ filter: /.*/, namespace: 'mock-gpu' }, () => ({ contents: `
      const forbidden = () => { throw new Error('Unexpected GPU boundary execution'); };
      export const mountEngineScene = forbidden, prepareEngineScene = forbidden;
      export const prepareEngineCameraRay = forbidden, raycastEngineScene = forbidden;
    `, loader: 'js' }));
  } }],
});
writeFileSync(resolve(output, 'display.mjs'), result.outputFiles[0].text);
const { createPrismFeatureDisplay } = await import(pathToFileURL(resolve(output, 'display.mjs')));
const scene = { scene: { geometries: [{}] }, canvasLabel: 'Mock modeling candidate' };
const controls = [];
const originalRatio = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true, writable: true });

function harness(jobs) {
  const h = { width: 300, height: 200, children: [], canvases: [], renderers: [], events: [],
    maxChildren: 0, maxAllocated: 0, failSize: false, failMount: false, failAppend: false, sizeReads: 0 };
  const host = {
    getBoundingClientRect() {
      h.sizeReads++;
      if (h.failSize) throw new Error('mock size refusal');
      return { width: h.width, height: h.height };
    },
    appendChild(canvas) {
      h.children.push(canvas); canvas.parentNode = host;
      h.maxChildren = Math.max(h.maxChildren, h.children.length);
      assert.ok(h.children.length <= 2, 'at most accepted plus one temporary canvas');
      if (h.failAppend) throw new Error('mock append refusal after insertion');
      return canvas;
    },
    ownerDocument: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        const id = h.canvases.length + 1;
        const style = { visibility: '', set cssText(value) {
          assert.match(value, /visibility:hidden/); this.visibility = 'hidden';
        } };
        const canvas = { id, width: 0, height: 0, style, attrs: {}, parentNode: null, removeCalls: 0, failRemove: false,
          setAttribute(key, value) { this.attrs[key] = value; },
          remove() {
            this.removeCalls++; h.events.push(`remove:${id}`);
            if (this.failRemove) throw new Error('mock remove refusal');
            const index = h.children.indexOf(this);
            if (index >= 0) h.children.splice(index, 1);
            this.parentNode = null;
          },
        };
        h.canvases.push(canvas);
        h.maxAllocated = Math.max(h.maxAllocated, h.children.length + 1);
        assert.ok(h.children.length + 1 <= 2, 'retire the previous slot before canvas allocation');
        return canvas;
      },
    },
  };
  const mount = (canvas, mountedScene, viewport) => {
    h.events.push(`mount:${canvas.id}`);
    if (h.failMount) throw new Error('mock mount refusal');
    assert.ok(mountedScene === scene.scene || mountedScene.geometries.length === 0);
    canvas.width = viewport.width; canvas.height = viewport.height;
    const renderer = { canvas, camera: Object.freeze({ canvasId: canvas.id }), resizeCalls: [], disposeCalls: 0,
      failResize: false, failDispose: false,
      resize(width, height) {
        this.resizeCalls.push({ width, height }); h.events.push(`resize:${canvas.id}`);
        if (this.failResize) throw new Error('mock resize refusal');
        canvas.width = width; canvas.height = height;
      },
      dispose() {
        this.disposeCalls++; h.events.push(`dispose:${canvas.id}`);
        if (this.failDispose) throw new Error('mock renderer cleanup refusal');
      },
    };
    h.renderers.push(renderer);
    return renderer;
  };
  h.display = createPrismFeatureDisplay(host, mount);
  h.prepare = async (preview = true, input = scene) => {
    const promise = preview ? h.display.preparePreview(input) : h.display.prepare(input);
    const job = jobs.at(-1); assert.equal(job.ran, false); job.run();
    return promise;
  };
  h.accept = async () => {
    const candidate = await h.prepare(false); candidate.commit(); candidate.dispose();
    return { candidate, canvas: h.children[0], renderer: h.renderers.at(-1) };
  };
  return h;
}

async function control(name, run) {
  const jobs = [], originalTimer = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 0, 'only the display preparation yield is scheduled');
    const job = { ran: false, run() { assert.equal(this.ran, false); this.ran = true; callback(); } };
    jobs.push(job); return jobs.length;
  };
  try {
    await run(jobs);
    assert.equal(jobs.every(job => job.ran), true, 'all finite preparation yields settled');
    controls.push(name);
    console.log(JSON.stringify({ ok: true, control: controls.length, name }));
  } catch (cause) {
    const failure = { ok: false, control: name, completed: controls, message: cause.message, stack: cause.stack };
    try { writeFileSync(resolve(output, 'first-failure.json'), JSON.stringify(failure, null, 2) + '\n', { flag: 'wx' }); }
    catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; }
    throw cause;
  } finally { globalThis.setTimeout = originalTimer; }
}

try {
  await control('ordinary prepare/commit and empty result compatibility', async jobs => {
    const h = harness(jobs), candidate = await h.prepare(false);
    assert.equal(h.children.length, 1); assert.equal(h.children[0].style.visibility, 'hidden');
    candidate.commit(); const accepted = h.children[0]; candidate.dispose(); candidate.dispose();
    assert.equal(accepted.style.visibility, 'visible'); assert.equal(accepted.removeCalls, 0);
    assert.equal(accepted.attrs['aria-label'], scene.canvasLabel);
    assert.throws(() => candidate.commit(), /stale/);
    const empty = await h.prepare(false, { scene: { geometries: [] } }); empty.commit(); empty.dispose();
    assert.equal(h.children.length, 1); assert.equal(h.children[0].attrs['aria-label'], 'Empty subtraction result');
    assert.equal(h.renderers[0].disposeCalls, 1); assert.equal(accepted.removeCalls, 1);
    h.display.dispose(); assert.equal(h.children.length, 0);
  });

  await control('reversible show retains accepted canvas, renderer and camera identity', async jobs => {
    const h = harness(jobs), accepted = await h.accept(), camera = accepted.renderer.camera;
    const acceptedResizeCount = accepted.renderer.resizeCalls.length;
    const preview = await h.prepare(), canvas = h.children[1], renderer = h.renderers[1];
    preview.show(); preview.show();
    assert.deepEqual(h.children, [accepted.canvas, canvas]);
    assert.equal(accepted.canvas.style.visibility, 'hidden'); assert.equal(canvas.style.visibility, 'visible');
    assert.equal(accepted.renderer.disposeCalls, 0); assert.equal(accepted.renderer.resizeCalls.length, acceptedResizeCount);
    assert.equal(accepted.renderer.camera, camera); assert.equal(renderer.resizeCalls.length, 1);
    preview.dispose(); preview.dispose();
    assert.deepEqual(h.children, [accepted.canvas]); assert.equal(accepted.canvas.style.visibility, 'visible');
    assert.equal(renderer.disposeCalls, 1); assert.equal(canvas.removeCalls, 1);
    assert.throws(() => preview.show(), /stale/); assert.throws(() => preview.commit(), /stale/);
    h.display.dispose();
  });

  await control('visible-only resize and unconditional restore despite size/resize refusal', async jobs => {
    const h = harness(jobs), accepted = await h.accept(), preview = await h.prepare();
    preview.show(); const renderer = h.renderers[1], acceptedResizeCount = accepted.renderer.resizeCalls.length;
    h.width = 600; h.height = 400; h.display.resize();
    assert.deepEqual(h.display.dimensions(), { width: 600, height: 400 });
    assert.equal(accepted.renderer.resizeCalls.length, acceptedResizeCount);
    assert.equal(accepted.canvas.width, 300); assert.equal(accepted.canvas.height, 200);
    renderer.failResize = true; h.width = 700;
    assert.throws(() => h.display.resize(), /resize refusal/);
    assert.deepEqual(h.display.dimensions(), { width: 600, height: 400 });
    accepted.renderer.failResize = true; h.failSize = true;
    const reads = h.sizeReads; preview.dispose();
    assert.equal(h.sizeReads, reads); assert.equal(accepted.canvas.style.visibility, 'visible');
    assert.deepEqual(h.display.dimensions(), { width: 300, height: 200 });
    assert.equal(accepted.renderer.resizeCalls.length, acceptedResizeCount);
    h.failSize = false;
    assert.throws(() => h.display.resize(), /resize refusal/);
    assert.deepEqual(h.display.dimensions(), { width: 300, height: 200 });
    accepted.renderer.failResize = false; h.width = 10000; h.height = 0; globalThis.devicePixelRatio = 3;
    h.display.resize(); assert.deepEqual(h.display.dimensions(), { width: 2048, height: 1 });
    globalThis.devicePixelRatio = 1; h.display.dispose();
  });

  await control('promotion keeps the exact preview and cleans accepted resources only after swap', async jobs => {
    const h = harness(jobs), accepted = await h.accept(), preview = await h.prepare();
    const canvas = h.children[1], renderer = h.renderers[1]; preview.show();
    const originalDispose = accepted.renderer.dispose;
    accepted.renderer.dispose = function () {
      assert.equal(canvas.style.visibility, 'visible');
      assert.equal(accepted.canvas.style.visibility, 'hidden');
      assert.deepEqual(h.display.dimensions(), { width: 500, height: 350 });
      originalDispose.call(this);
    };
    h.width = 500; h.height = 350; preview.commit(); preview.dispose();
    assert.deepEqual(h.children, [canvas]); assert.equal(h.renderers.length, 2);
    assert.equal(accepted.renderer.disposeCalls, 1); assert.equal(renderer.disposeCalls, 0);
    assert.equal(h.events.lastIndexOf(`resize:${canvas.id}`) < h.events.lastIndexOf(`dispose:${accepted.canvas.id}`), true);
    assert.throws(() => preview.commit(), /stale/); assert.throws(() => preview.show(), /stale/);
    h.display.dispose(); assert.equal(renderer.disposeCalls, 1);
  });

  await control('new prepare retires hidden and shown candidates before allocation', async jobs => {
    const h = harness(jobs), accepted = await h.accept();
    const first = await h.prepare(), firstCanvas = h.children[1];
    const second = await h.prepare(), secondCanvas = h.children[1];
    assert.equal(firstCanvas.removeCalls, 1); assert.equal(h.renderers[1].disposeCalls, 1);
    assert.throws(() => first.show(), /stale/); first.dispose();
    assert.deepEqual(h.children, [accepted.canvas, secondCanvas]); second.show();
    const thirdPromise = h.display.preparePreview(scene), thirdCanvas = h.children[1];
    assert.equal(secondCanvas.removeCalls, 1); assert.equal(accepted.canvas.style.visibility, 'visible');
    assert.equal(thirdCanvas.style.visibility, 'hidden');
    second.dispose(); assert.deepEqual(h.children, [accepted.canvas, thirdCanvas]);
    jobs.at(-1).run(); const third = await thirdPromise; third.show();
    assert.equal(h.maxChildren, 2); assert.equal(h.maxAllocated, 2);
    assert.throws(() => second.commit(), /stale/); third.dispose(); h.display.dispose();
  });

  await control('cancel unresolved prepare then replace immediately; old yield resolves last', async jobs => {
    const h = harness(jobs), accepted = await h.accept();
    let cancelled = false, oldExposed = false;
    const old = h.display.preparePreview(scene).then(candidate => {
      if (cancelled) candidate.dispose(); else oldExposed = true;
    });
    const oldRefusal = assert.rejects(old, /stale/), oldJob = jobs.at(-1), oldCanvas = h.children[1];
    // Model controller cancellation while its await has no candidate handle yet.
    cancelled = true;
    const nextPromise = h.display.preparePreview(scene), nextJob = jobs.at(-1), nextCanvas = h.children[1];
    assert.equal(oldCanvas.removeCalls, 1); assert.deepEqual(h.children, [accepted.canvas, nextCanvas]);
    nextJob.run(); const next = await nextPromise; next.show();
    oldJob.run(); await oldRefusal;
    assert.equal(oldExposed, false); assert.deepEqual(h.children, [accepted.canvas, nextCanvas]);
    assert.equal(nextCanvas.style.visibility, 'visible'); assert.equal(oldCanvas.removeCalls, 1);
    assert.equal(h.events.includes(`mount:${oldCanvas.id}`), false);
    assert.equal(h.renderers.length, 2); assert.equal(h.maxAllocated, 2);
    next.dispose(); assert.equal(accepted.canvas.style.visibility, 'visible'); h.display.dispose();
  });

  await control('pre-swap show/commit refusals preserve ownership and prior visibility', async jobs => {
    const h = harness(jobs), accepted = await h.accept(), preview = await h.prepare();
    const canvas = h.children[1], renderer = h.renderers[1];
    h.failSize = true; assert.throws(() => preview.show(), /size refusal/);
    assert.throws(() => preview.commit(), /size refusal/); h.failSize = false;
    renderer.failResize = true;
    assert.throws(() => preview.show(), /resize refusal/); assert.throws(() => preview.commit(), /resize refusal/);
    assert.equal(accepted.canvas.style.visibility, 'visible'); assert.equal(canvas.style.visibility, 'hidden');
    assert.equal(accepted.renderer.disposeCalls, 0); assert.equal(accepted.canvas.removeCalls, 0);
    renderer.failResize = false; preview.show(); renderer.failResize = true;
    assert.throws(() => preview.commit(), /resize refusal/);
    assert.equal(accepted.canvas.style.visibility, 'hidden'); assert.equal(canvas.style.visibility, 'visible');
    assert.equal(accepted.renderer.disposeCalls, 0);
    preview.dispose(); assert.equal(accepted.canvas.style.visibility, 'visible');
    assert.deepEqual(h.display.dimensions(), { width: 300, height: 200 }); h.display.dispose();
  });

  await control('post-swap cleanup errors are nonfatal and failed detach blocks a third canvas', async jobs => {
    const h = harness(jobs), accepted = await h.accept(), preview = await h.prepare();
    const canvas = h.children[1]; preview.show(); accepted.renderer.failDispose = true;
    assert.doesNotThrow(() => preview.commit());
    assert.deepEqual(h.children, [canvas]); assert.equal(accepted.renderer.disposeCalls, 1);
    assert.equal(accepted.canvas.removeCalls, 1); assert.equal(canvas.style.visibility, 'visible');
    const next = await h.prepare(), nextCanvas = h.children[1]; canvas.failRemove = true;
    assert.doesNotThrow(() => next.commit()); next.dispose();
    assert.equal(nextCanvas.style.visibility, 'visible'); assert.equal(canvas.style.visibility, 'hidden');
    const allocated = h.canvases.length;
    await assert.rejects(h.display.preparePreview(scene), /could not remove/);
    assert.equal(h.canvases.length, allocated); assert.equal(h.children.length, 2);
    canvas.failRemove = false; const final = await h.prepare();
    assert.equal(h.children.length, 2); assert.equal(h.maxAllocated, 2);
    assert.equal(h.renderers[1].disposeCalls, 1);
    final.dispose(); h.display.dispose(); assert.equal(h.children.length, 0);
  });

  await control('mount and append failures clean only their candidate and retain accepted', async jobs => {
    const h = harness(jobs), accepted = await h.accept();
    h.failMount = true; await assert.rejects(h.prepare(), /mount refusal/); h.failMount = false;
    assert.deepEqual(h.children, [accepted.canvas]); assert.equal(accepted.canvas.style.visibility, 'visible');
    h.failAppend = true; await assert.rejects(h.display.preparePreview(scene), /append refusal/); h.failAppend = false;
    assert.deepEqual(h.children, [accepted.canvas]); assert.equal(accepted.renderer.disposeCalls, 0);
    const preview = await h.prepare(); preview.show(); h.renderers.at(-1).failDispose = true;
    preview.dispose(); assert.deepEqual(h.children, [accepted.canvas]);
    assert.equal(accepted.canvas.style.visibility, 'visible'); h.display.dispose();
  });

  await control('whole-display disposal invalidates shown and unresolved handles idempotently', async jobs => {
    const h = harness(jobs); await h.accept(); const preview = await h.prepare(); preview.show();
    h.renderers[0].failDispose = true; h.renderers[1].failDispose = true;
    h.display.dispose(); h.display.dispose(); preview.dispose();
    assert.equal(h.children.length, 0); assert.ok(h.renderers.every(renderer => renderer.disposeCalls === 1));
    assert.throws(() => preview.show(), /stale/); assert.throws(() => preview.commit(), /stale/);
    await assert.rejects(h.display.preparePreview(scene), /disposed/);
    const pendingHost = harness(jobs); await pendingHost.accept();
    const pending = pendingHost.display.preparePreview(scene), refusal = assert.rejects(pending, /stale/);
    const canvas = pendingHost.children[1]; pendingHost.display.dispose();
    jobs.at(-1).run(); await refusal;
    assert.equal(canvas.removeCalls, 1); assert.equal(pendingHost.children.length, 0);
    assert.equal(pendingHost.renderers.length, 1);
  });

  const receipt = { ok: true, controls: controls.length, cases: controls,
    evidence: 'Actual prism-feature-display implementation; explicit DOM/mount/renderer/GPU-boundary doubles; finite controlled yields; no native/GPU/browser execution or pixel claim' };
  assert.equal(controls.length, 10);
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} finally {
  if (originalRatio) Object.defineProperty(globalThis, 'devicePixelRatio', originalRatio);
  else delete globalThis.devicePixelRatio;
}
