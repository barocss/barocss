// Read-only portal/navigation consistency check. This is NOT a browser/native test.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const base='apps/library-docs/docs/packages/cad-editor/';
const course=read(base+'learning-path.md'), intro=read(base+'index.md');
const nav=read('apps/library-docs/docs/.vitepress/config.mts');
assert.ok(intro.includes('./learning-path'));
const editorPages = nav.match(/p === 'cad-editor' \? \[([^\]]+)\]/)?.[1] ?? '';
for (const page of ['learning-path','first-model','round-post','mounting-plate','l-bracket']) assert.ok(editorPages.includes("'" + page + "'"));
assert.ok(nav.includes("'learning-path': 'CAD learning path'"));
for(const name of ['first-model','quickstart']) {
  assert.ok(existsSync(resolve(root,base+name+'.md')));
  assert.ok(course.includes('./'+name));
}
for(const ref of ['../cad/capabilities','../cad/modeling','../cad/quickstart','../cad/language'])
  assert.ok(course.includes(ref));
for (const page of ['round-post','mounting-plate','l-bracket']) {
  assert.ok(existsSync(resolve(root,base+page+'.md')), 'Missing adopted lesson: '+page);
  assert.ok(course.includes('](./'+page+')'), 'Missing learning path link: '+page);
}
for(const x of ['UNRUN','Certified volume unavailable','Choose model file','Open saved model','Dimension changes pending'])assert.ok(course.includes(x));
console.log('CAD learning-path adoption/link sanity PASS (static only)');
