import assert from 'node:assert/strict';

// An import may not access browser globals. Restore Node's globals before constructor probes.
const browserNames = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'];
const descriptors = new Map(browserNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let browserGlobalReads = 0;
let createCanvas2DApplication;
try {
  for (const name of browserNames) Object.defineProperty(globalThis, name, { configurable: true,
    get() { browserGlobalReads++; throw new Error(`Browser global read during import: ${name}`); } });
  ({ createCanvas2DApplication } = await import(new URL('../../../dist/index.js', import.meta.url)));
} finally {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
assert.equal(browserGlobalReads, 0);
assert.equal(typeof createCanvas2DApplication, 'function');

function setup() {
  const counts = { contextRequests: 0, listenerAdds: 0, listenerRemoves: 0,
    schedulerRequests: 0, schedulerCancels: 0, accessorReads: 0 };
  const canvas = { width: 17, height: 19,
    getContext() { counts.contextRequests++; return null; },
    addEventListener() { counts.listenerAdds++; }, removeEventListener() { counts.listenerRemoves++; } };
  const scheduler = {
    requestFrame() { counts.schedulerRequests++; throw new Error('A refused constructor must not request a frame'); },
    cancelFrame() { counts.schedulerCancels++; },
  };
  const options = { contextId: 'ApplicationProbe',
    renderer: { logicalSize: { width: 80, height: 50 }, dpr: 2 }, scheduler, autoStart: false };
  const accessor = (object, key) => Object.defineProperty(object, key, { enumerable: true, configurable: true,
    get() { counts.accessorReads++; throw new Error('Option accessor must not execute'); } });
  return { counts, canvas, scheduler, options, accessor };
}
const refusals = [];
function beforeContext(label, change, code) {
  const test = setup();
  const options = change(test);
  assert.throws(() => createCanvas2DApplication(test.canvas, options), error => error?.code === code, label);
  assert.deepEqual(test.counts, { contextRequests: 0, listenerAdds: 0, listenerRemoves: 0,
    schedulerRequests: 0, schedulerCancels: 0, accessorReads: 0 }, label);
  assert.deepEqual([test.canvas.width, test.canvas.height], [17, 19], label);
  refusals.push({ label, code });
}
beforeContext('null outer options', () => null, 'INVALID_SCENE');
beforeContext('array outer options', () => [], 'INVALID_SCENE');
beforeContext('missing required renderer', test => {
  const { renderer: _renderer, ...options } = test.options; return options;
}, 'INVALID_SCENE');
beforeContext('custom outer prototype', test => Object.assign(Object.create({ inherited: true }), test.options), 'INVALID_SCENE');
beforeContext('unknown outer field', test => ({ ...test.options, stage: {} }), 'INVALID_SCENE');
beforeContext('unknown outer symbol', test => ({ ...test.options, [Symbol('extra')]: true }), 'INVALID_SCENE');
beforeContext('outer context accessor', test => test.accessor(test.options, 'contextId'), 'INVALID_SCENE');
beforeContext('outer renderer accessor', test => test.accessor(test.options, 'renderer'), 'INVALID_SCENE');
beforeContext('invalid context ID', test => ({ ...test.options, contextId: 'bad context' }), 'INVALID_SCENE');
beforeContext('nonboolean autoStart', test => ({ ...test.options, autoStart: 1 }), 'INVALID_SCENE');
beforeContext('renderer unknown field', test => ({ ...test.options,
  renderer: { ...test.options.renderer, unknown: true } }), 'INVALID_SIZE');
beforeContext('renderer invalid logical size', test => ({ ...test.options,
  renderer: { ...test.options.renderer, logicalSize: { width: 0, height: 50 } } }), 'INVALID_SIZE');
beforeContext('renderer invalid DPR', test => ({ ...test.options,
  renderer: { ...test.options.renderer, dpr: 0 } }), 'INVALID_SIZE');
beforeContext('renderer invalid deviation', test => ({ ...test.options,
  renderer: { ...test.options.renderer, maxDeviationDevicePx: 5 } }), 'INVALID_SIZE');
beforeContext('renderer invalid background', test => ({ ...test.options,
  renderer: { ...test.options.renderer, backgroundColor: [2, 0, 0, 1] } }), 'INVALID_SCENE');
beforeContext('scheduler missing cancel function', test => ({ ...test.options,
  scheduler: { requestFrame: test.scheduler.requestFrame } }), 'INVALID_SCENE');
beforeContext('scheduler unknown field', test => ({ ...test.options,
  scheduler: { ...test.scheduler, extra: true } }), 'INVALID_SCENE');
beforeContext('scheduler request accessor', test => ({ ...test.options,
  scheduler: test.accessor({ ...test.scheduler }, 'requestFrame') }), 'INVALID_SCENE');
assert.equal(typeof globalThis.requestAnimationFrame, 'undefined');
assert.equal(typeof globalThis.cancelAnimationFrame, 'undefined');
beforeContext('default scheduler unavailable in Node', test => {
  const { scheduler: _scheduler, ...options } = test.options; return options;
}, 'UNSUPPORTED_FEATURE');

const lateFailures = [];
for (const autoStart of [false, true]) {
  const test = setup(); test.options.autoStart = autoStart;
  assert.throws(() => createCanvas2DApplication(test.canvas, test.options),
    error => error?.code === 'WEBGL_UNAVAILABLE');
  assert.deepEqual(test.counts, { contextRequests: 1, listenerAdds: 0, listenerRemoves: 0,
    schedulerRequests: 0, schedulerCancels: 0, accessorReads: 0 });
  assert.deepEqual([test.canvas.width, test.canvas.height], [17, 19]);
  lateFailures.push({ autoStart, code: 'WEBGL_UNAVAILABLE', ...test.counts });
}

console.log(JSON.stringify({ scope: 'compiled import and constructor refusal before a real WebGL context',
  browserGlobalReads, refusals, lateFailures,
  noScheduledCallbacksOnFailedConstruction: true,
  tickerDisposalObserved: false, positiveApplicationTested: false,
  renderTimingTested: false, frameRetentionTested: false, gpuTested: false, browserTested: false }));
