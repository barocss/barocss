import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),require=createRequire(root+'/package.json'),{ESLint}=require('eslint');
const {selectAppLintFiles}=await import(pathToFileURL(root+'/.github/scripts/affected-ci-run.mjs'));
const eslint=new ESLint({cwd:root});
const ignored='apps/cad-studio/handover/notes/quadratic-cut-pattern-2026-10-30/root/baseline.mjs';
assert.equal(await eslint.isPathIgnored(ignored),true);
for(const file of ['apps/cad-studio/src/App.tsx','apps/cad-studio/test/quadratic-cut-pattern-browser.mjs','packages/barocss-cad/src/features/quadratic-cut-plan.ts','packages/barocss-cad/test/quadratic-cut-pattern.test.mjs','packages/barocss-cad-model/test/quadratic-feature-pattern.test.ts','apps/library-docs/scripts/api-inventory.mjs']) assert.equal(await eslint.isPathIgnored(file),false,file);
const tracked=execFileSync('git',['ls-files','-z','--','apps'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean);
const formatter=await eslint.loadFormatter('stylish'),rows=[];let errors=0;
for(const directory of tracked.filter(p=>/^apps\/[^/]+\/package\.json$/.test(p)).map(dirname)){
 const manifest=JSON.parse(readFileSync(directory+'/package.json','utf8'));if(manifest.scripts?.lint)continue;
 const candidates=selectAppLintFiles(directory,tracked,[],true),files=[],excluded=[];
 for(const path of candidates){if(await eslint.isPathIgnored(path))excluded.push(path);else files.push(path);}
 const results=files.length?await eslint.lintFiles(files):[];const count=results.reduce((n,r)=>n+r.errorCount,0);errors+=count;
 console.log(formatter.format(results));rows.push({directory,files:files.length,excluded,errors:count});
}
writeFileSync('/tmp/d346-integration/app-lint-verification.json',JSON.stringify({status:errors?'FAIL':'PASS',errors,coverage:'Exact full-route tracked app selection for apps without declared lint; package lint scripts remain authoritative',scopeAssertions:'Archive excluded; six real source/test/config representatives remain included',rows},null,2)+'\n');
if(errors)process.exitCode=1;
