// #2008 presentation-only DOM test, not a controller/native/GPU acceptance test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const repo = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const out = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-mirror-workspace-2008');
const hashes = JSON.parse(process.env.FROZEN_SOURCE_HASHES ?? '{}');
for (const path of ['packages/barocss-cad-editor/src/react/modeling-workspace.tsx', 'apps/cad-editor/flows/modeling-mirror-workspace-flow.mjs'])
  assert.equal(createHash('sha256').update(readFileSync(resolve(repo, path))).digest('hex'), hashes[path], path);
mkdirSync(out, { recursive: true });
const { JSDOM } = require('jsdom'); const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MouseEvent', 'KeyboardEvent']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react'), { createRoot } = require('react-dom/client');
const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad-editor/src/react/modeling-workspace.tsx')], bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  plugins: [{ name: 'external-ui', setup(build) { build.onResolve({ filter: /^(react(?:\/.*)?|lucide-react)$/ }, args => ({ path: require.resolve(args.path), external: true })); } }] });
writeFileSync(resolve(out, 'workspace.cjs'), built.outputFiles[0].text);
const { ModelingWorkspace } = require(resolve(out, 'workspace.cjs'));
const events = [], noop = () => {};
let props = { snapshot: { accepted: null, selection: null, drafts: {}, busy: false, disposed: false, display: null, workerReady: true, history: { canUndo: false, canRedo: false, count: 0, index: -1 } },
  viewport: null, panels: {}, panel: null, error: null, dimensionLabel: 'Edit model dimensions', canMirrorPart: true,
  canPreviewStructure: true, canApplyStructure: false, onPanel: value => events.push(['panel', value]), onCancelStructure: () => events.push(['cancel']), onPreviewStructure: () => events.push(['preview']), onApplyStructure: () => events.push(['apply']),
  onView: noop, onSelect: noop, onApply: noop, onPreview: noop, onCancelDimensions: noop, onCancelNewPart: noop, onCreatePart: noop, onCancelComputation: noop, onUndo: noop, onRedo: noop, onRetry: noop, previewContext: 'Mirror' };
const root = createRoot(document.getElementById('root')), groups = [];
const render = async patch => { props = { ...props, ...patch }; await React.act(async () => root.render(React.createElement(ModelingWorkspace, props))); };
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent === label);
const click = async b => { assert.ok(b); await React.act(async () => b.click()); };
const group = async (name, action) => { await action(); groups.push(name); console.log('PASS ' + name); };
try {
  await group('01 CREATE command opens exact Mirror panel', async () => { await render({}); await click(button('Mirror finished rail')); assert.deepEqual(events, [['panel', 'mirror-part']]); });
  await group('02 unavailable capability hides command', async () => { await render({ canMirrorPart: false }); assert.equal(button('Mirror finished rail'), undefined); });
  await group('03 preview enabled and unready Apply disabled', async () => { await render({ panel: 'mirror-part', canMirrorPart: true }); assert.equal(document.querySelector('.modeling-options h2').textContent, 'Mirror finished rail'); assert.ok(button('Apply operation').disabled); await click(button('Preview operation')); assert.deepEqual(events.at(-1), ['preview']); });
  await group('04 ready Apply callback with supplied empty panel', async () => { await render({ canApplyStructure: true }); await click(button('Apply operation')); assert.deepEqual(events.at(-1), ['apply']); });
  await group('05 busy blocks commands, apply and cancellation', async () => { const count = events.length; await render({ snapshot: { ...props.snapshot, busy: true } }); for (const label of ['Mirror finished rail', 'Preview operation', 'Apply operation', 'Cancel']) { assert.ok(button(label).disabled); await click(button(label)); } assert.equal(events.length, count); });
  await group('06 Escape closes through structural cancellation', async () => { await render({ snapshot: { ...props.snapshot, busy: false } }); await React.act(async () => document.querySelector('[data-testid="modeling-workspace"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); assert.deepEqual(events.at(-1), ['cancel']); });
} finally { await React.act(async () => root.unmount()); dom.window.close(); }
writeFileSync(resolve(out, 'result.json'), JSON.stringify({ issue: 2008, groups, events, hashes, nativeCalls: 0, controllerCalls: 0, physicalBrowser: false, scope: 'Real Workspace React component in jsdom with explicit presentation props only; no ModelingEditor/controller end-to-end or native/GPU proof.' }, null, 2) + '\n');
