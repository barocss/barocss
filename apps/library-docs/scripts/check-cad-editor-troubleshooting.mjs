// Read-only contract check: no CAD execution, browser, or GPU testing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const page=read('apps/library-docs/docs/packages/cad-editor/troubleshooting.md');
const ui=read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const fileReader=read('packages/barocss-cad-editor/src/modeling-file.ts');
const nav=read('apps/library-docs/docs/.vitepress/config.mts');
const intro=read('apps/library-docs/docs/packages/cad-editor/index.md');
const model=read('apps/library-docs/docs/packages/cad/modeling.md');
for (const label of ['Accepted model','Dimension changes pending','Apply dimensions','Discard draft',
 'Computing native geometry in a dedicated worker','Cancel computation','Undo','Redo',
 'Load example','Replace accepted model and discard its history and pending dimensions',
 'Visible output body','Choose one output to inspect','Save or open a model','Choose model file',
 'Saved model data','Open saved model','Download model']) {
 assert.ok(ui.includes(label), 'Changed UI text: '+label);
 assert.ok(page.includes(label), 'Guide missing UI text: '+label);
}
assert.ok(fileReader.includes('MAX_MODELING_FILE_BYTES = 262144'));
assert.ok(fileReader.includes("new TextDecoder('utf-8', { fatal: true })"));
for (const claim of ['Certified volume unavailable','stored-rational-circle-prism',
 'stored-rational-plate-hole','convex-planar','orthogonal-cell']) {
 assert.ok(page.includes(claim), 'Guide missing qualification: '+claim);
 assert.ok(model.includes(claim), 'Modeling reference missing qualification: '+claim);
}
assert.ok(nav.includes("['first-model', 'troubleshooting']"));
assert.ok(nav.includes("'troubleshooting': 'Modeling troubleshooting'"));
assert.ok(intro.includes('./troubleshooting'));
assert.ok(page.includes('UNRUN here'));
console.log('CAD troubleshooting documentation source-label PASS (static only)');
