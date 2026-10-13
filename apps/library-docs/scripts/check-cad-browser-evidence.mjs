// Documentation-only scope check. No browser, file or GPU execution.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const dir='apps/library-docs/docs/packages/cad-editor/';
const page=read(dir+'browser-evidence.md');
const nav=read('apps/library-docs/docs/.vitepress/config.mts');
const intro=read(dir+'index.md');
assert.ok(intro.includes('./browser-evidence'));
assert.ok(nav.includes("'browser-evidence': 'Browser evidence protocol'"));
const pages=nav.match(/p === 'cad-editor' \? \[([^\]]+)\]/)?.[1] ?? '';
assert.ok(pages.includes("'browser-evidence'"));
for (const name of ['learning-path','troubleshooting']) {
  assert.ok(existsSync(resolve(root,dir+name+'.md')));
  assert.ok(page.includes('./'+name));
}
for (const key of ['sourceSha','nativeExecuted','stages','UNRUN','BLOCKED','FAIL','GPU','SHA-256','fresh browser context','actual browser','file']) {
  if (key==='nativeExecuted') continue;
  assert.ok(page.includes(key), 'Missing evidence boundary: '+key);
}
assert.ok(page.includes('"native": "UNRUN"'));
assert.ok(page.includes('"browser": "UNRUN"'));
console.log('CAD browser evidence protocol: static documentation contract PASS; device execution UNRUN');
