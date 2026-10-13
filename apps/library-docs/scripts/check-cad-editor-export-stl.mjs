// Read-only UI / native-reference drift guard. No STL generation, geometry or browser execution.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const prefix = 'apps/library-docs/docs/packages/cad-editor/';
const guide = read(prefix + 'export-stl.md');
const index = read(prefix + 'index.md');
const chooser = read(prefix + 'choose-workspace.md');
const matrix = read(prefix + 'feature-coverage.md');
const nav = read('apps/library-docs/docs/.vitepress/config.mts');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const workspace = read('packages/barocss-cad-editor/src/react/modeling-workspace.tsx');
const stl = read('packages/barocss-cad-editor/src/modeling-stl.ts');
const model = read('apps/library-docs/docs/packages/cad/modeling.md');
const authored = read('apps/library-docs/docs/public/examples/modeling-translated-gussets.ts');
const saved = read('packages/barocss-cad/test/modeling-translation-evidence/initial.cad-model.json');
const reader = read('packages/barocss-cad-editor/src/modeling-file.ts');
const route = read('apps/cad-editor/src/app.tsx');
const must = (haystack,needle,where) => assert.ok(haystack.includes(needle), `${where}: ${needle}`);

must(route, "location.hash === '#/model'", 'CAD model route changed');
for (const phrase of [
  'Model a part','Accepted model','Output bodies','Export accepted geometry',
  'STL output','Choose an accepted output','Download STL',
  'Recover accepted model and export STL','Visible output body',
  'Save or open a model','Choose model file','Saved model data',
  'Open saved model','Download model','Replace accepted model and discard its history and pending dimensions',
  'Apply dimensions','Discard draft','Dimension changes pending',
]) {
  must(ui, phrase, 'UI label disappeared');
  must(guide, phrase, 'Manual UI label missing');
}
for (const phrase of ['FILE','Export accepted STL','Save or open a model','Output bodies']) {
  must(workspace, phrase, 'Workspace FILE/OUTPUT menu changed');
  must(guide, phrase, 'Manual navigation is stale');
}
for (const phrase of ["output.family !== 'convex-planar'", "'convex-planar'", "downloadModelingStl(result)"]) {
  must(ui, phrase === "output.family !== 'convex-planar'" ? "'convex-planar'" : phrase, 'Export family/button guard changed');
}
must(ui, "setStlOutput('')", 'Changing accepted model must clear output selection');
must(ui, 'busy || draft || !canExportStl', 'Export draft/busy refusal guard removed');
must(ui, 'session.exportStl(stlOutput', 'Accepted Worker export call changed');
must(stl, 'data.triangleCount > 40', 'STL facet bound changed');
must(stl, 'data.bytes.length > 2084', 'STL byte bound changed');
must(stl, "data.sourceFrame !== 'authored-xyz-no-axis-conversion'", 'STL coordinate basis changed');
must(reader, 'MAX_MODELING_FILE_BYTES = 262144', 'Authored file staging limit changed');
must(reader, "new TextDecoder('utf-8', { fatal: true })", 'Authored file UTF-8 rule changed');
must(authored, "accepted.exportStl('right')", 'Named STL example changed');
must(saved, '"left"', 'Measured saved two-output example changed');
must(saved, '"right"', 'Measured saved two-output example changed');

for (const fact of [
  '684 bytes', '12 facets', '[48, 0, 0]', '[88, 24, 8]',
  'Float32', 'convex-planar', 'mm convention', 'at most40 facets',
  'download-stl-from-the-model-editor',
]) {
  if (fact === 'download-stl-from-the-model-editor') {
    must(guide, '../cad/modeling#download-stl-from-the-model-editor', 'Native reference link disappeared');
  } else {
    must(model, fact === 'at most40 facets' ? 'at most40 facets' : fact, 'Native reference claim changed');
  }
}
for (const fact of [
  '684 bytes', '12 facets', '[48, 0, 0]', '[88, 24, 8]',
  '262,144-byte', '40 facets', '2,084 bytes',
  'Float32', 'convex-planar', 'stored-rational-circle-prism',
  'stored-rational-plate-hole', 'orthogonal-cell',
  'warranty', 'UNRUN',
]) must(guide, fact, 'Missing truth or refusal boundary');
for (const [page,name] of [[index,'index'],[chooser,'choose-workspace'],[matrix,'coverage']]) {
  must(page, './export-stl', name + ' entry link');
}
must(nav, "'export-stl': 'Export a convex STL'", 'Sidebar title missing');
must(nav, "'choose-workspace', 'export-stl'", 'Sidebar ordering changed');
must(guide, './browser-evidence', 'Device evidence protocol link missing');
console.log('CAD Editor named STL export UI / source / limits / navigation: static PASS only; no device or native export');
