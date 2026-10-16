// Static/types only. No native geometry or arbitrary expression execution.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const app=resolve(import.meta.dirname,'..'), root=resolve(app,'../..');
const enginePin='d9d0aa93fdaf6700fd30282bc91656e40e59baf1';
const provider=resolve(process.env.CAD_MODEL_ROOT??root),mode=process.argv[2]??'source';assert.ok(['source','emitted'].includes(mode));
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const file=resolve(app,'docs/public/examples/modeling-dimensions.ts'),snippet=readFileSync(file,'utf8'),page=readFileSync(resolve(app,'docs/packages/cad/modeling.md'),'utf8');
for(const[,region]of page.matchAll(/^<<< .*modeling-dimensions\.ts#([^\s]+)$/gm))assert.ok(snippet.includes(`// #region ${region}\n`)&&snippet.includes(`// #endregion ${region}\n`));
for(const term of ["withBase('/examples/modeling-dimensions.ts')",'width × 0.5 + offset','3790 / 2274','4548 / 3032','3790 / 3790','32 expression-tree nodes and depth6','9 observed model calls','geometry-equivalent adapted transport replay','41,830','UNRUN'])assert.ok(page.includes(term),term);
assert.ok(!page.includes('Parameter expressions and constraints are not part'));assert.ok(page.includes('| Split | A direct XY extrusion or one/two owned serial chamfers rooted at it;'));
for(const forbidden of ['schema:','sourceVersion','solidId:','expectedRevision:','format:'])assert.ok(!snippet.includes(forbidden));
const git=p=>execFileSync('git',['show',`${enginePin}:${p}`],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
const modeling=readFileSync(resolve(provider,'packages/barocss-cad/src/modeling.ts'),'utf8');assert.equal(digest(modeling),digest(git('packages/barocss-cad/src/modeling.ts')));
const receiptText=git('packages/barocss-cad/test/modeling-dimensions-evidence/verification.json'),receipt=JSON.parse(receiptText),{source,cold}=receipt.actual;
assert.equal(receipt.observedTotalModelCalls,9);assert.equal(source.tessellations,1);assert.equal(receipt.attempts.length,2);assert.equal(source.literalPredecessorBodyParity,true);
for(const[state,expected]of [[source.baseline,[3032,3032]],[source.offset,[3790,2274]],[source.wider,[4548,3032]],[source.recovered,[3790,3790]],[cold.reopened,[3790,3790]],[cold.reedited,[4548,3032]]])assert.deepEqual([state.negativeMM3,state.positiveMM3],expected);
const entry=resolve(provider,`packages/barocss-cad/${mode==='source'?'src/index.ts':'dist/index.d.ts'}`),directory=mkdtempSync(join(tmpdir(),'cad-dimensions-doc-types-'));
try{const files=[file,resolve(app,'scripts/snippets/modeling-api.ts'),...['modeling-intersection.ts','modeling-split.ts','modeling-cardinal-split.ts','modeling-chamfer-chain.ts','modeling-chamfer-split.ts'].map(p=>resolve(app,'docs/public/examples',p))],config=join(directory,'tsconfig.json');writeFileSync(config,JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:true,types:[],paths:{'@barocss/cad':[entry]}},files}));execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p',config],{stdio:'inherit'});}finally{rmSync(directory,{recursive:true,force:true});}
console.log(JSON.stringify({ok:true,scope:'seven public example/snippet types, source/receipt pins and two stale guide corrections; no native execution',mode,typedExampleFiles:7,enginePin,engineReceiptSHA256:digest(receiptText),modelingSourceSHA256:digest(modeling),entrySHA256:digest(readFileSync(entry)),downloadSHA256:digest(snippet),nativeCampaignRun:false},null,2));
