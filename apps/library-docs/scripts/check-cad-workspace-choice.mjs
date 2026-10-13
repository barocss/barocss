import './check-cad-editor-export-stl.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const page=read('apps/library-docs/docs/packages/cad-editor/choose-workspace.md');
const index=read('apps/library-docs/docs/packages/cad-editor/index.md');
const nav=read('apps/library-docs/docs/.vitepress/config.mts');
const host=read('apps/cad-editor/README.md');
const editor=read('packages/barocss-cad-editor/README.md');
for(const item of ['#/model','Modeling examples','Named dimensions','Apply dimensions','Download model','Choose model file','Open saved model','New Boolean extrusion','Curve/Surface','UNRUN']) {
 if(item==='UNRUN') continue;
 assert.ok(page.includes(item),'Missing workspace instruction: '+item);
}
assert.ok(host.includes('New Boolean extrusion'),'Host source drift: Boolean workbench');
assert.ok(editor.includes('#/model'),'Model route source drift');
for(const item of ['cad.model()','Choose model file','Open saved model'])assert.ok(editor.includes(item),'Editor source drift: '+item);
assert.ok(page.includes('not')||page.includes('Not'));
assert.ok(index.includes('./choose-workspace'));
assert.ok(nav.includes("'choose-workspace': 'Choose a CAD workspace'"));
assert.ok(nav.includes("'feature-coverage', 'choose-workspace'"));
console.log('CAD workspace-choice source labels/navigation PASS; browser validation UNRUN');
