// Read-only instance/display capability checks against current Viewport source. No browser/GPU.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-instance-display-diagnostics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'cad-instance-diagnostics-'));
let displayModeScope, instanceDisplayStatus, instancePickFields, snapshotInstanceIsolation;
try {
  const outfile = join(temporary, 'diagnostics.mjs');
  await build({
    stdin: { contents: 'export { displayModeScope, instanceDisplayStatus, instancePickFields, snapshotInstanceIsolation } from "./apps/cad-studio/src/viewport/Viewport.tsx";', resolveDir: root },
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  ({ displayModeScope, instanceDisplayStatus, instancePickFields, snapshotInstanceIsolation } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const defaultStatus = Object.freeze({ requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true });
const noCall = () => { throw new Error('A capability diagnosis must not draw, change geometry or pick.'); };
const bridge = Object.freeze({ setInstances: noCall, pickInstanceFace: noCall });

test('default assembly display is supported when the actual renderer can draw and identify instance faces', () => {
  assert.equal(instanceDisplayStatus(defaultStatus, bridge, true), defaultStatus);
  assert.equal(instanceDisplayStatus(defaultStatus, null, false), defaultStatus);
  assert.equal(instanceDisplayStatus(null, bridge, true), null);
});

test('an absent or incomplete bridge is diagnosed explicitly, including the default mode', () => {
  for (const renderer of [null, {}, { setInstances: noCall }, { pickInstanceFace: noCall }, { setInstances: true, pickInstanceFace: true }]) {
    const result = instanceDisplayStatus(defaultStatus, renderer, true);
    assert.equal(result.supported, false); assert.equal(result.effective, 'shaded-with-edges');
    assert.match(result.reason, /requires the renderer instance bridge/);
  }
  assert.deepEqual(defaultStatus, { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true });
});

test('all five placed-instance modes use the actual adapter capability status without a UI-only rejection', () => {
  for (const requested of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    const status = Object.freeze({ requested, effective: requested, supported: true });
    assert.equal(instanceDisplayStatus(status, bridge, true), status);
    const rejected = Object.freeze({ requested, effective: 'shaded-with-edges', supported: false, reason: 'This backend combination is unsupported.' });
    assert.equal(instanceDisplayStatus(rejected, bridge, true), rejected, 'an actual renderer rejection is never changed to support');
    const missing = instanceDisplayStatus(status, {}, true);
    assert.equal(missing.supported, false); assert.match(missing.reason, /requires the renderer instance bridge/);
  }
});

test('placed instances do not create a scope guard; Render/analysis/direct/proposal/mould/editing guards remain precise', () => {
  const instances = [{ id: 'placed-copy', bodies: [] }];
  for (const props of [{}, { instances: [] }, { instances }]) assert.equal(displayModeScope(props), undefined);
  for (const [props, reason] of [
    [{ render: {} }, /Model view/], [{ analysis: 'zebra' }, /analysis/], [{ scalarMaps: [{}] }, /analysis/],
    [{ mould: {} }, /mould/], [{ direct: [{}] }, /direct geometry/], [{ proposal: {} }, /proposal/],
    [{ instancePreview: {} }, /instance is dragged/], [{ sketch: {} }, /sketch/], [{ cage: {} }, /cage/], [{ tool: {} }, /tool/], [{ regions: [{}] }, /tool/],
  ]) assert.match(displayModeScope({ instances, ...props }), reason);
});

test('existing Views selector is the only mode control and keeps session requests separate from guarded fallback', async () => {
  const app = await readFile(resolve(root, 'apps/cad-studio/src/App.tsx'), 'utf8');
  assert.equal((app.match(/<select aria-label="CAD display mode"/g) ?? []).length, 1);
  assert.match(app, /CAD_DISPLAY_MODES\.map\(mode => <option/);
  const from = app.indexOf('const displayScopeReason ='), to = app.indexOf('  return (', from), scope = app.slice(from, to);
  assert.ok(from >= 0 && to > from);
  assert.doesNotMatch(scope, /instancesDrawn\.length\s*\|\|/);
  assert.match(scope, /instancePreview \? .*instance is dragged/);
  assert.match(scope, /assembly\.draft \? .*assembly edit/);
  assert.match(scope, /const effectiveDisplayMode: DisplayMode = displayModeReason \? 'shaded-with-edges' : displayMode/);
  assert.match(scope, /displayScopeReason \?\? null, !!sectionClip, !!instancesDrawn\.length/);
});

test('default bridge availability preserves an existing backend rejection rather than declaring it passed', () => {
  const failed = Object.freeze({ ...defaultStatus, supported: false, reason: 'Backend unavailable.' });
  assert.equal(instanceDisplayStatus(failed, bridge, true), failed);
});

test('only actual generated caps carry instanceCap and never native-face authority', () => {
  const native = Object.freeze({ id: 'part', body: 7, face: 12 });
  assert.deepEqual(instancePickFields(native), { instance: 'part', instanceFace: { body: 7, face: 12 } });
  assert.deepEqual(instancePickFields({ id: 'part', body: 7, face: -1 }), { instance: 'part' }, 'unknown provenance is not a generated cap');
  assert.deepEqual(instancePickFields({ id: 'part', body: 7, face: -1, cap: true }), { instance: 'part', instanceCap: { body: 7 } });
  assert.deepEqual(instancePickFields({ id: 'part', body: 7, face: 12, cap: true }), { instance: 'part', instanceCap: { body: 7 } }, 'an explicit cap flag suppresses native-face authority');
  assert.deepEqual(native, { id: 'part', body: 7, face: 12 });
});

test('isolation snapshots only selected visible placed instances and survives later selection changes', () => {
  const selected = ['hidden', 'placed-b', 'placed-a', 'placed-b', 'unevaluated', 'empty'];
  const body = Object.freeze({}), bodies = Object.freeze([body]);
  const placed = Object.freeze([Object.freeze({ id: 'placed-a', bodies }), Object.freeze({ id: 'placed-b', bodies }), Object.freeze({ id: 'empty', bodies: Object.freeze([]) })]);
  const snapshot = snapshotInstanceIsolation(selected, placed);
  assert.deepEqual(snapshot, ['placed-b', 'placed-a']);
  assert.notEqual(snapshot, selected);
  selected.splice(0, selected.length);
  assert.deepEqual(snapshot, ['placed-b', 'placed-a'], 'clearing selection does not restore or replace the snapshot');
  assert.equal(placed[0].bodies, bodies); assert.equal(placed[1].bodies, bodies);
  assert.equal(snapshotInstanceIsolation(selected, placed), undefined);
  assert.equal(snapshotInstanceIsolation(['hidden', 'unevaluated', 'empty'], placed), undefined);
});

test('isolation stays session-only with one Display toggle, empty-selection restore and document replacement reset', async () => {
  const app = await readFile(resolve(root, 'apps/cad-studio/src/App.tsx'), 'utf8');
  assert.match(app, /const \[isolatedInstances, setIsolatedInstances\] = useState<readonly string\[\] \| undefined>\(\)/);
  assert.match(app, /const isolationSelection = snapshotInstanceIsolation\(instanceSel, instancesPlaced\)/);
  // (G-R13: the toggle lives in the Display popover's card, beside the display mode, the notice closing it.)
  const views = app.slice(app.indexOf('aria-label="Display"'), app.indexOf('{displayModeNotice && <span'));
  assert.ok(views.length > 0 && !app.slice(app.indexOf('aria-label="Views"')).includes("'Isolate selection'"), 'one toggle, in the Display card only');
  assert.equal((views.match(/aria-label=\{isolatedInstances \? 'Restore view' : 'Isolate selection'\}/g) ?? []).length, 1);
  assert.match(views, /disabled=\{!isolatedInstances && !!isolationReason\}/, 'restore remains enabled without selected visible instances or in an unsupported scope');
  assert.match(views, /setIsolatedInstances\(current => current \? undefined : isolationSelection\)/);
  assert.match(app, /isolatedInstances=\{displayScopeReason \? undefined : isolatedInstances\}/);
  const replace = app.slice(app.indexOf('const replaceDoc ='), app.indexOf('const writeFile ='));
  assert.match(replace, /setIsolatedInstances\(undefined\)/, 'New/Open must not reuse the previous document isolation IDs');
  assert.doesNotMatch(app, /(?:doc\.|localStorage\.(?:getItem|setItem)\(['"])[iI]solatedInstances/);
});

test('Viewport forwards the snapshot to view state, suspends it under existing guards and schedules state updates', async () => {
  const source = await readFile(resolve(root, 'apps/cad-studio/src/viewport/Viewport.tsx'), 'utf8');
  assert.match(source, /isolatedInstances\?: readonly string\[\]/);
  assert.match(source, /isolatedInstances: displayModeScope\(propsRef\.current\) \? undefined : propsRef\.current\.isolatedInstances/);
  assert.match(source, /setState\(viewState\(\)\); request\(\); \}, \[[^\]]*props\.isolatedInstances/);
  assert.match(displayModeScope({ render: {}, isolatedInstances: ['placed'] }), /Model view/);
  assert.equal(displayModeScope({ isolatedInstances: ['placed'], instances: [{ id: 'placed', bodies: [] }] }), undefined);
});
