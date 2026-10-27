// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-device-recovery-failure-browser.test.mjs
// GPU_DEVICE_RECOVERY_EVIDENCE_DIR saves the first error and screenshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/',import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/',import.meta.url));

test('recovery failure is reported and a device arriving after dispose is destroyed', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req,res) => {
    if (req.url === '/') { res.setHeader('Content-Type','text/html'); res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{background:#222;color:#eee;font:16px sans-serif}canvas{width:128px;height:128px}</style><p>Device recovery failure checks</p>'); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const file = resolve(base,'.'+(base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!file.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type','text/javascript'); res.end(await readFile(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  let browser,page,evidence; const errors = [];
  try {
    if (process.env.GPU_DEVICE_RECOVERY_EVIDENCE_DIR) { await mkdir(process.env.GPU_DEVICE_RECOVERY_EVIDENCE_DIR,{ recursive: true }); evidence = await mkdtemp(join(process.env.GPU_DEVICE_RECOVERY_EVIDENCE_DIR,'device-recovery-')); t.diagnostic(`evidence: ${evidence}`); }
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const { chromium } = createRequire(join(process.env.PW_DIR,'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    page.on('pageerror',error => errors.push(String(error))); page.on('console',message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const { createViewer } = await import('/viewer/index.js');
      const bound = (promise,label) => Promise.race([promise,new Promise((_,reject) => setTimeout(() => reject(new Error(`${label} timed out`)),15000))]);
      const outcome = async promise => { try { await bound(promise,'operation'); return { code: 'OK' }; } catch (e) { return { code: e.code ?? null, message: e.message }; } };
      const adapter = await navigator.gpu.requestAdapter(); let proto = Object.getPrototypeOf(adapter);
      while (proto && !Object.getOwnPropertyDescriptor(proto,'requestDevice')) proto = Object.getPrototypeOf(proto);
      if (!proto) throw new Error('GPUAdapter requestDevice descriptor is unavailable');
      const descriptor = Object.getOwnPropertyDescriptor(proto,'requestDevice'), native = descriptor.value;
      const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = 128; document.body.append(c); return c; };
      const run = async mode => {
        const c = canvas(), reports = [], callbacks = [], originals = Object.getOwnPropertyDescriptor(c,'getContext');
        const viewer = await createViewer(c,{ controls: false, autoResize: false, pixelRatio: 1, onRequestRender: () => {}, onError: message => reports.push(message) });
        viewer.onRecover = () => callbacks.push({ type: 'success' });
        viewer.onRecoverError = error => callbacks.push({ type: 'failure', code: error.code, message: error.message, cause: error.cause?.code ?? null });
        const oldDevice = viewer.computeDevice, nativeContext = c.getContext;
        let acquired = null, destroyCalls = 0, getContextCalls = 0, release, ready, rejectReady;
        const gate = new Promise(resolve => { release = resolve; });
        const gotDevice = new Promise((resolve,reject) => { ready = resolve; rejectReady = reject; });
        Object.defineProperty(proto,'requestDevice',{ ...descriptor, value: function (...args) {
          return Reflect.apply(native,this,args).then(device => {
            acquired = device; const destroy = device.destroy;
            Object.defineProperty(device,'destroy',{ configurable: true, value: function (...a) { destroyCalls++; return Reflect.apply(destroy,this,a); } });
            ready(); return gate.then(() => device);
          }, error => { rejectReady(error); throw error; });
        } });
        Object.defineProperty(c,'getContext',{ configurable: true, value: function (...args) {
          if (args[0] === 'webgpu') { getContextCalls++; if (mode === 'context-null') return null; }
          return Reflect.apply(nativeContext,this,args);
        } });
        try {
          viewer.loseDeviceForTesting(); await bound(oldDevice.lost,'original device loss');
          const recovery = viewer.recovery;
          if (!recovery) throw new Error('viewer did not begin recovery');
          await bound(gotDevice,'replacement requestDevice');
          if (mode === 'late-dispose') viewer.dispose();
          release();
          await bound(recovery,'recovery');
          const replacementLoss = await bound(acquired.lost,'replacement device destruction');
          const status = { ready: viewer.ready, computeDeviceNull: viewer.computeDevice === null,
            destroyCalls, getContextCalls, replacementReason: replacementLoss.reason, callbacks, reports };
          if (mode === 'context-null') { status.frame = await outcome(viewer.frame()); status.capture = await outcome(viewer.capture()); }
          return status;
        } finally {
          release(); Object.defineProperty(proto,'requestDevice',descriptor);
          if (originals) Object.defineProperty(c,'getContext',originals); else delete c.getContext;
          viewer.dispose(); c.remove();
        }
      };
      const syncFailure = async mode => {
        const c = canvas(), reports = [], callbacks = [], unhandled = [];
        const sentinel = new Error('unconfigure sentinel'), callbackSentinel = new Error(`callback sentinel ${mode}`);
        const viewer = await createViewer(c,{ controls: false, autoResize: false, pixelRatio: 1, onRequestRender: () => {}, onError: message => {
          reports.push(message); if (mode === 'onError') throw callbackSentinel;
        } });
        viewer.onRecover = () => callbacks.push({ type: 'success' });
        viewer.onRecoverError = error => {
          callbacks.push({ type: 'failure', code: error.code, sameCause: error.cause === sentinel });
          if (mode === 'onRecoverError') throw callbackSentinel;
        };
        const context = c.getContext('webgpu'), ownUnconfigure = Object.getOwnPropertyDescriptor(context,'unconfigure');
        let calls = 0;
        Object.defineProperty(context,'unconfigure',{ configurable: true, value: () => { calls++; throw sentinel; } });
        const onUnhandled = event => { unhandled.push(String(event.reason)); event.preventDefault(); };
        globalThis.addEventListener('unhandledrejection',onUnhandled);
        try {
          const oldDevice = viewer.computeDevice; viewer.loseDeviceForTesting(); await bound(oldDevice.lost,'original loss');
          // Let the browser dispatch any unhandled rejection before inspecting state.
          await new Promise(resolve => setTimeout(resolve,100));
          return { calls, ready: viewer.ready, computeDeviceNull: viewer.computeDevice === null, recoveryCleared: viewer.recovery === null,
            callbacks, reports, unhandled, frame: await outcome(viewer.frame()), capture: await outcome(viewer.capture()) };
        } finally {
          globalThis.removeEventListener('unhandledrejection',onUnhandled);
          if (ownUnconfigure) Object.defineProperty(context,'unconfigure',ownUnconfigure); else delete context.unconfigure;
          viewer.dispose(); c.remove();
        }
      };
      const successCallback = async mode => {
        const c = canvas(), reports = [], unhandled = [];
        let armed = false, requests = 0, recoverCalls = 0, failureCalls = 0, recovered;
        const reachedRecover = new Promise(resolve => { recovered = resolve; });
        const viewer = await createViewer(c,{ controls: false, autoResize: false, pixelRatio: 1,
          onRequestRender: () => { if (armed) { requests++; if (mode === 'onRequestRender') throw new Error(`callback sentinel ${mode}`); } },
          onError: message => reports.push(message) });
        viewer.onRecover = () => { recoverCalls++; recovered(); if (mode === 'onRecover') throw new Error(`callback sentinel ${mode}`); };
        viewer.onRecoverError = () => { failureCalls++; };
        const onUnhandled = event => { unhandled.push(String(event.reason)); event.preventDefault(); };
        globalThis.addEventListener('unhandledrejection',onUnhandled);
        try {
          const oldDevice = viewer.computeDevice; armed = true; viewer.loseDeviceForTesting();
          await bound(oldDevice.lost,'original loss'); await bound(reachedRecover,'successful recovery callback');
          await new Promise(resolve => setTimeout(resolve,100));
          return { ready: viewer.ready, replacement: viewer.computeDevice !== null && viewer.computeDevice !== oldDevice,
            recoveryCleared: viewer.recovery === null, requests, recoverCalls, failureCalls, reports, unhandled };
        } finally { globalThis.removeEventListener('unhandledrejection',onUnhandled); armed = false; viewer.dispose(); c.remove(); }
      };
      const disposeDuringRequest = async () => {
        const c = canvas(), reports = [], unhandled = [];
        let armed = false, requests = 0, recoverCalls = 0, failureCalls = 0, reached;
        const requested = new Promise(resolve => { reached = resolve; });
        const viewer = await createViewer(c,{ controls: false, autoResize: false, pixelRatio: 1,
          onRequestRender: () => { if (armed) { requests++; reached(); viewer.dispose(); } }, onError: message => reports.push(message) });
        viewer.onRecover = () => { recoverCalls++; }; viewer.onRecoverError = () => { failureCalls++; };
        const onUnhandled = event => { unhandled.push(String(event.reason)); event.preventDefault(); };
        globalThis.addEventListener('unhandledrejection',onUnhandled);
        try {
          const oldDevice = viewer.computeDevice; armed = true; viewer.loseDeviceForTesting();
          await bound(oldDevice.lost,'original loss'); await bound(requested,'recovery render request');
          await new Promise(resolve => setTimeout(resolve,100));
          return { ready: viewer.ready, computeDeviceNull: viewer.computeDevice === null, requests, recoverCalls, failureCalls, reports, unhandled };
        } finally { globalThis.removeEventListener('unhandledrejection',onUnhandled); armed = false; viewer.dispose(); c.remove(); }
      };
      return { contextNull: await run('context-null'), lateDispose: await run('late-dispose'),
        synchronous: await syncFailure('none'), throwingOnError: await syncFailure('onError'), throwingOnRecoverError: await syncFailure('onRecoverError'),
        throwingOnRequestRender: await successCallback('onRequestRender'), throwingOnRecover: await successCallback('onRecover'),
        disposeDuringRequest: await disposeDuringRequest() };
    });
    result.errors = errors; t.diagnostic(JSON.stringify(result));
    if (evidence) { await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n'); await page.screenshot({ path: join(evidence,'result.png'), fullPage: true }); }
    const failure = result.contextNull;
    assert.equal(failure.ready,false); assert.equal(failure.computeDeviceNull,true); assert.equal(failure.getContextCalls,1);
    assert.equal(failure.destroyCalls,1); assert.equal(failure.replacementReason,'destroyed');
    assert.equal(failure.callbacks.length,1); assert.equal(failure.callbacks[0].type,'failure');
    assert.equal(failure.callbacks[0].code,'DEVICE_LOST'); assert.equal(failure.callbacks[0].cause,'NO_CONTEXT');
    assert.equal(failure.reports.length,1); assert.equal(failure.frame.code,'DEVICE_LOST'); assert.equal(failure.capture.code,'DEVICE_LOST');
    const late = result.lateDispose;
    assert.equal(late.ready,false); assert.equal(late.computeDeviceNull,true); assert.equal(late.getContextCalls,0);
    assert.equal(late.destroyCalls,1); assert.equal(late.replacementReason,'destroyed'); assert.deepEqual(late.callbacks,[]); assert.deepEqual(late.reports,[]);
    for (const name of ['synchronous','throwingOnError','throwingOnRecoverError']) {
      const item = result[name]; assert.equal(item.calls,1,name); assert.equal(item.ready,false,name); assert.equal(item.computeDeviceNull,true,name);
      assert.equal(item.recoveryCleared,true,name); assert.equal(item.reports.length,1,name);
      assert.deepEqual(item.callbacks,[{ type: 'failure', code: 'DEVICE_LOST', sameCause: true }],name);
      assert.deepEqual(item.unhandled,[],name); assert.equal(item.frame.code,'DEVICE_LOST',name); assert.equal(item.capture.code,'DEVICE_LOST',name);
    }
    for (const name of ['throwingOnRequestRender','throwingOnRecover']) {
      const item = result[name]; assert.equal(item.ready,true,name); assert.equal(item.replacement,true,name); assert.equal(item.recoveryCleared,true,name);
      assert.equal(item.requests,1,name); assert.equal(item.recoverCalls,1,name); assert.equal(item.failureCalls,0,name);
      assert.deepEqual(item.reports,[],name); assert.deepEqual(item.unhandled,[],name);
    }
    assert.deepEqual(result.disposeDuringRequest,{ ready: false, computeDeviceNull: true, requests: 1, recoverCalls: 0, failureCalls: 0, reports: [], unhandled: [] });
    const unexpected = errors.filter(message => !message.includes('callback sentinel'));
    assert.deepEqual(unexpected,[]); assert.equal(errors.length,4,'all deliberately thrown callback errors are reported');
  } catch (error) {
    if (evidence) { await writeFile(join(evidence,'first-error.json'),JSON.stringify({ name: error.name, message: error.message, stack: error.stack, errors },null,2)+'\n'); if (page && !page.isClosed()) await page.screenshot({ path: join(evidence,'failure.png'), fullPage: true }).catch(() => {}); }
    throw error;
  } finally { if (browser) await browser.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
});
