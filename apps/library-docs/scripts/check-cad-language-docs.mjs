import assert from 'node:assert/strict';
import { createMarkdownRenderer } from 'vitepress';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const docs=resolve(app,'docs'), root=resolve(app,'../..');
const renderer=await createMarkdownRenderer(docs);
const pages=['language','language-workflows','serial-part-v2','capabilities','guides','api'].map(name=>resolve(docs,'packages/cad',`${name}.md`));
const rendered=new Map();
function render(page){if(!rendered.has(page)){const html=renderer.render(readFileSync(page,'utf8'),{path:page,relativePath:page.slice(docs.length+1)});rendered.set(page,html);}return rendered.get(page);}
let links=0,anchors=0,includes=0,downloads=0,sourceLinks=0;
const dynamicAnchors=[];
for(const page of pages){
  const text=readFileSync(page,'utf8'), html=render(page);
  assert.ok(html.includes('<h1'),page);
  for(const m of text.matchAll(/^<<< ([^\n{#]+)(?:#[^\n{]+)?(?:\{[^}]*\})?$/gm)){assert.ok(existsSync(resolve(dirname(page),m[1])),m[1]);includes++;}
  for(const m of text.replace(/```[\s\S]*?```/g,'').matchAll(/\]\(([^)]+)\)/g)){
    const href=m[1];
    if(href.startsWith('https://github.com/barocss/barocss/blob/')){
      const [,sha,path]=href.match(/\/blob\/([^/]+)\/(.*)/);execFileSync('git',['cat-file','-e',`${sha}:${path.split('#')[0]}`],{cwd:root});sourceLinks++;continue;
    }
    if(/^(https?:|mailto:)/.test(href))continue;
    const [path,anchor]=href.split('#');let target=path?(path.startsWith('/')?resolve(docs,`.${path}`):resolve(dirname(page),path)):page;
    if(!target.endsWith('.md'))target=existsSync(target+'.md')?target+'.md':resolve(target,'index.md');
    assert.ok(existsSync(target),href);links++;
    if(anchor && ['/playground','/examples/language'].includes(path)){dynamicAnchors.push(href);continue;}
    if(anchor){assert.ok(render(target).includes(`id="${decodeURIComponent(anchor)}"`),`Missing rendered anchor ${href}`);anchors++;}
  }
  for(const m of text.matchAll(/withBase\('(\/examples\/[^']+)'\)/g)){const file=resolve(docs,'public',`.${m[1]}`);assert.ok(existsSync(file),file);downloads++;}
  if(page.endsWith('serial-part-v2.md')){for(const word of ['openSerialPart','setSerialParameter','selectedParentSolidId','Download complete serial-part-v2.json'])assert.ok(html.includes(word),`Unrendered serial-part input ${word}`);}
  if(page.endsWith('language-workflows.md')){for(const word of ['@model','scaleLength','control-points'])assert.ok(html.includes(word),`Unrendered input ${word}`);}
}
console.log(JSON.stringify({scope:'isolated VitePress Markdown render and local target/anchor/blob checks; not full VitePress build or browser',pages:pages.length,renderedTargets:rendered.size,links,anchors,includes,downloads,sourceLinks,dynamicAnchorsNotChecked:dynamicAnchors},null,2));
