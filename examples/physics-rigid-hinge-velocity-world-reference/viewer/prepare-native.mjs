import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildConsumer,here,root} from './bundle.mjs';
import {closure,hash} from './source-freeze.mjs';
const source=JSON.parse(await readFile(resolve(here,'source-ledger.json'))),emitted=JSON.parse(await readFile(resolve(here,'emitted-ledger.json')));
assert.equal(hash(JSON.stringify(await closure())),source.closureSha256,'Consumer/provider source changed');
assert.equal(source.providerClosureSha256,emitted.providerClosureSha256,'Actual provider build/source correspondence');
for(const row of emitted.entries){const b=await readFile(resolve(root,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(hash(b),row.sha256,row.path);}
const out=resolve(here,'evidence/native-freeze');await mkdir(out,{recursive:true});const reports=[];
for(const mode of ['source','compiled']){const b=await buildConsumer(mode,'app.mjs','browser');await writeFile(resolve(out,mode+'-bundle.js'),b.bytes);await writeFile(resolve(out,mode+'-import-audit.json'),JSON.stringify(b.audit,null,2)+'\n');reports.push({...b.audit});}
const probe=await build({entryPoints:[resolve(here,'resource-probe.mjs')],bundle:true,write:false,format:'iife',globalName:'HingeProbe',target:'es2022'});await writeFile(resolve(out,'resource-probe.js'),probe.outputFiles[0].contents);
const report={resourceProbe:{bytes:probe.outputFiles[0].contents.length,sha256:hash(probe.outputFiles[0].contents)},head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,sourceLedgerSha256:hash(await readFile(resolve(here,'source-ledger.json'))),emittedLedgerSha256:hash(await readFile(resolve(here,'emitted-ledger.json'))),sourceClosureSha256:source.closureSha256,emittedClosureSha256:emitted.emittedClosureSha256,reports};
await writeFile(resolve(here,'bundle-receipts.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({head:report.head,modes:reports.map(a=>({mode:a.mode,source:a.ownSourceCount,dist:a.ownDistCount,bytes:a.bundleBytes,sha256:a.bundleSha256}))}));
