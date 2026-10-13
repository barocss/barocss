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
assert.ok(nav.includes("['learning-path', 'first-model']"));
assert.ok(nav.includes("'learning-path': 'CAD learning path'"));
for(const name of ['first-model','quickstart']) {
  assert.ok(existsSync(resolve(root,base+name+'.md')));
  assert.ok(course.includes('./'+name));
}
for(const ref of ['../cad/capabilities','../cad/modeling','../cad/quickstart','../cad/language'])
  assert.ok(course.includes(ref));
for(const [name,pr] of [['Round post',1746],['Mounting plate',1754],['L-bracket',1757]]) {
  assert.ok(course.includes(name));
  assert.ok(course.includes('https://github.com/barocss/barocss/pull/'+pr));
  assert.ok(!course.includes('](./'+(name==='Round post'?'round-post':name==='Mounting plate'?'mounting-plate':'l-bracket')+')'), 'Pending lesson falsely linked as local adopted route');
}
for(const x of ['UNRUN','Certified volume unavailable','Choose model file','Open saved model','Dimension changes pending'])assert.ok(course.includes(x));
console.log('CAD learning-path adoption/link sanity PASS (static only)');
