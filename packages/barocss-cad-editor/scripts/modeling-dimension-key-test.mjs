// Small, source-bundled keyboard guard test. No CAD, Worker, React, GPU or browser.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({
  entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/modeling-dimension-key.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const url = 'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64');
const { modelingDimensionCommand: choose } = await import(url);
const event = {
  key: 'Enter', repeat: false, isComposing: false, keyCode: 13,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
};
const state = { accepted: true, draftCount: 2, busy: false, disposed: false };
let checks = 0;
function verify(e, s, expected) { assert.equal(choose(e, s), expected); checks++; }
verify(event, state, 'apply');
verify({ ...event, key: 'Escape', keyCode: 27 }, state, 'discard');
verify({ ...event, key: 'Tab', keyCode: 9 }, state, null);
verify({ ...event, key: 'Enter', keyCode: 229 }, state, null);
verify({ ...event, key: 'Enter', isComposing: true }, state, null);
verify({ ...event, key: 'Escape', keyCode: 229 }, state, null);
verify({ ...event, key: 'Escape', isComposing: true }, state, null);
verify({ ...event, repeat: true }, state, null);
for (const key of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
  verify({ ...event, [key]: true }, state, null);
  verify({ ...event, key: 'Escape', [key]: true }, state, null);
}
verify(event, { ...state, draftCount: 0 }, null);
verify(event, { ...state, busy: true }, null);
verify(event, { ...state, disposed: true }, null);
verify(event, { ...state, accepted: false }, null);
verify({ ...event, key: 'Escape' }, { ...state, draftCount: 0 }, null);
verify({ ...event, key: 'Enter', keyCode: 0 }, state, 'apply');
verify(event, { ...state, draftCount: 1 }, 'apply');
// A second identical key has no built-in debouncing; host rechecks the
// controller's synchronous busy/draft state after the first invocation.
verify(event, { ...state, busy: true }, null);
console.log(JSON.stringify({ status: 'PASS', checks, tier: 'pure keyboard intent only; browser/React/GPU UNRUN' }));
