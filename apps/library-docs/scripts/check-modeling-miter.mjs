// Static/types only; the committed provider receipt supplies measured geometry.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const app=resolve(import.meta.dirname,'..'), root=resolve(app,'../..');
const enginePin='a7bec3dd9f280b827200e2a6e34fc5bafed26e49';
const provider=resolve(process.env.CAD_MODEL_ROOT??root),mode=process.argv[2]??'source';assert.ok(['source','emitted'].includes(mode));
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const file=resolve(app,'docs/public/examples/modeling-miter.ts'),snippet=readFileSync(file,'utf8'),page=readFileSync(resolve(app,'docs/packages/cad/modeling.md'),'utf8');
for(const[,region]of page.matchAll(/^<<< .*modeling-miter\.ts#([^\s]+)$/gm))assert.ok(snippet.includes(`// #region ${region}\n`)&&snippet.includes(`// #endregion ${region}\n`));
for(const term of ["withBase('/examples/modeling-miter.ts')",'coordinate-sum threshold in millimeters, not perpendicular distance','2304 / 3840','3840 / 2304','3072 / 3072','3008 / 3008','8 model calls and 2 baseline tessellations','49,139-byte two-body baseline transport','mocked Worker','UNRUN'])assert.ok(page.includes(term),term);
assert.ok(!page.includes('Oblique planes and repeated/nested splits remain unsupported.'));assert.ok(page.includes("or fixed `plane: 'x+y'`"));
for(const forbidden of ['schema:','sourceVersion','solidId:','expectedRevision:','format:'])assert.ok(!snippet.includes(forbidden));
const git=p=>execFileSync('git',['show',`${enginePin}:${p}`],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
const modeling=readFileSync(resolve(provider,'packages/barocss-cad/src/modeling.ts'),'utf8');assert.equal(digest(modeling),digest(git('packages/barocss-cad/src/modeling.ts')));
const receiptText=git('packages/barocss-cad/test/modeling-miter-evidence/verification.json'),receipt=JSON.parse(receiptText),{source,cold}=receipt.actual;
assert.equal(receipt.attempts.length,1);assert.equal(receipt.attempts[0].modelCalls,8);assert.equal(source.tessellations,2);
for(const[state,expected]of [[source.baseline,[2304,3840]],[source.moved,[3840,2304]],[source.recovered,[3072,3072]],[cold.reopened,[3072,3072]],[cold.reedited,[2304,3840]],[source.chamferParent,[3008,3008]]])assert.deepEqual([state.negativeMM3,state.positiveMM3],expected);
assert.equal(source.refusal.code,'SELECTION');assert.equal(source.refusal.cause.sectionDimension,-1);assert.equal(source.tangent.sectionDimension,1);assert.equal(source.futureReuseAfterRefusal,true);
const entry=resolve(provider,`packages/barocss-cad/${mode==='source'?'src/index.ts':'dist/index.d.ts'}`),directory=mkdtempSync(join(tmpdir(),'cad-miter-doc-types-'));
try{const files=[file,resolve(app,'scripts/snippets/modeling-api.ts'),...['modeling-intersection.ts','modeling-split.ts','modeling-cardinal-split.ts','modeling-chamfer-chain.ts','modeling-chamfer-split.ts','modeling-dimensions.ts'].map(p=>resolve(app,'docs/public/examples',p))],config=join(directory,'tsconfig.json');writeFileSync(config,JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',skipLibCheck:true,types:[],paths:{'@barocss/cad':[entry]}},files}));execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p',config],{stdio:'inherit'});}finally{rmSync(directory,{recursive:true,force:true});}
console.log(JSON.stringify({ok:true,scope:'eight public example/snippet types, provider receipt pins, fixed-miter versus arbitrary-plane guide boundary; no native execution',mode,typedExampleFiles:8,enginePin,engineReceiptSHA256:digest(receiptText),modelingSourceSHA256:digest(modeling),entrySHA256:digest(readFileSync(entry)),downloadSHA256:digest(snippet),nativeCampaignRun:false},null,2));
