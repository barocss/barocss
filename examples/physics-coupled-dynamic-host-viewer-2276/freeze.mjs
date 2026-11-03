// Root-only hash census. Does not import any Physics, build, decoder, or observer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const [transactionReceipt,nodeNativeProof,transactionSourceProof,transactionNativeProof]=process.argv.slice(2);
assert(transactionReceipt&&nodeNativeProof&&transactionSourceProof&&transactionNativeProof,'Required: actual transaction parity receipt, clean native proof directory, transaction Source proof directory, transaction Native proof directory');
const files={},pin=p=>{const b=readFileSync(p);return {bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};
function add(p,v){p=resolve(root,p);const actual=pin(p);if(v)assert.deepEqual(actual,v,'Frozen input drift '+p);const rel=relative(root,p),inside=rel!==''&&!rel.startsWith('../')&&!isAbsolute(rel);files[inside?rel:p]=actual;}
function tree(p){for(const e of readdirSync(p,{withFileTypes:true})){assert(!e.isSymbolicLink());const f=resolve(p,e.name);if(e.isDirectory())tree(f);else add(f);}}
const evidenceRoot=realpathSync(resolve(root,'examples/physics-coupled-dynamic-host-2276/evidence'));
const transactionAuthorPath=resolve(evidenceRoot,'../TRANSACTION-AUTHOR-FREEZE-01.json');
assert.equal(pin(transactionAuthorPath).sha256,'4ea253b457686e0af89d9c3bec23dc0915cb3afa10ae07dea964d2f60b543886','Executed transaction author freeze');
add(transactionAuthorPath);const transactionAuthor=JSON.parse(readFileSync(transactionAuthorPath));
for(const[p,v]of Object.entries(transactionAuthor.files))add(resolve(root,p),v);
const transactionFreezeDirectory=resolve(evidenceRoot,'transaction-freeze-01'),transactionFrozenPath=resolve(transactionFreezeDirectory,'frozen.json'),transactionFrozen=JSON.parse(readFileSync(transactionFrozenPath));
assert.equal(transactionFrozen.format,'physics-coupled-dynamic-host-transaction-freeze');assert.deepEqual(transactionFrozen.transactionAuthorPin,pin(transactionAuthorPath));
for(const[p,v]of Object.entries(transactionFrozen.files))add(resolve(root,p),v);tree(transactionFreezeDirectory);
const prerequisiteGuards=[];
for(const stage of ['freeze','source','native','parity']){
 const guardDirectory=resolve(root,'examples/physics-world-p5-2276/evidence','coupled-dynamic-tx-'+stage+'-01'),receiptPath=resolve(guardDirectory,'result.json'),guard=JSON.parse(readFileSync(receiptPath));
 assert.equal(guard.kind,'P5B_OWNED_COMMAND_GUARD');assert.equal(guard.receiptId,'coupled-dynamic-tx-'+stage+'-01');assert.equal(guard.status,'PASS');assert.equal(guard.exit,0);assert.equal(guard.timedOut,false);assert.equal(guard.signal,null);assert.equal(guard.processClosed,true);assert.deepEqual(guard.errors,[]);
 tree(guardDirectory);prerequisiteGuards.push({stage,path:relative(root,receiptPath),...pin(receiptPath),status:guard.status,exit:guard.exit,timedOut:guard.timedOut});
}

function proofDirectory(input){const p=realpathSync(resolve(root,input));assert(p.startsWith(evidenceRoot+'/'),'Proof directory must belong to the actual dynamic host');return p;}
const prerequisite=realpathSync(resolve(root,transactionReceipt));assert(prerequisite.startsWith(evidenceRoot+'/'));assert.equal(prerequisite,resolve(dirname(prerequisite),'result.json'));
const transaction=JSON.parse(readFileSync(prerequisite));
assert.equal(transaction.status,'PASS_COUPLED_DYNAMIC_HOST_TRANSACTION_SOURCE_NATIVE_FULL_RAW_WIRE');
assert.equal(transaction.firstFailure,null);assert.equal(transaction.hiddenPublicRawEquality,'RAW_EQUAL_GENUINE_PRE_DISPOSE_CAPTURE');assert.equal(transaction.hiddenInitialPublicGetter,'NOT_RETAINED');assert.equal(transaction.normalization,'NONE');assert.equal(transaction.WorldCalls,0);assert.equal(transaction.candidateCalls,0);
const transactionDirectories={source:proofDirectory(transactionSourceProof),native:proofDirectory(transactionNativeProof)};
assert.notEqual(transactionDirectories.source,transactionDirectories.native);
const transactionSummaries={};
for(const[graph,path]of Object.entries(transactionDirectories)){
 const summaryPath=resolve(path,'summary.json'),summary=JSON.parse(readFileSync(summaryPath));
 assert.equal(summary.status,'PASS_COUPLED_DYNAMIC_HOST_AFTER_TRANSACTION_WIRE');assert.equal(summary.graph,graph);assert.equal(summary.firstFailure,null);assert.equal(summary.executionStatus,'EXECUTED_PASS');
 assert.equal(summary.hiddenPublicRawEquality,'RAW_EQUAL_GENUINE_CAPTURE');assert.equal(summary.hiddenInitialPublicGetter,'NOT_RETAINED');assert.equal(summary.hiddenInitialBefore,'SAME_MODEL_INITIAL_CONTROL_BOUND_TO_ACTUAL_CREATION_ATTEMPT_FREE_INPUT');
 assert.equal(summary.acceptedSteps,4);assert.equal(summary.observedDirectStepCalls,4);assert.equal(summary.hiddenReplayStepCalls,3);
 assert(Object.values(summary.controls).every(v=>v==='EXECUTED_PASS'),'All actual transaction controls must PASS');
 for(const[k,v]of Object.entries({worlds:4,attempts:6,applications:257,queries:41,queryPoints:37,anchorChecks:999}))assert.equal(summary.counts[k],v,'Transaction actual census '+k);
 transactionSummaries[graph]={path:relative(root,summaryPath),...pin(summaryPath),status:summary.status};
 tree(path);
}
const summaries=Object.values(transactionDirectories).map(path=>JSON.parse(readFileSync(resolve(path,'summary.json'))));
for(const key of ['controls','counts','acceptedSteps','firstFailure','observedDirectStepCalls','hiddenReplayStepCalls','hiddenPublicRawEquality','privateDiagnosticTraceAndCacheFramesVsClean'])assert.deepEqual(summaries[0][key],summaries[1][key],'Actual Source Native transaction summary parity '+key);
function selected(path){return readdirSync(path,{withFileTypes:true}).filter(e=>e.isFile()&&((e.name.endsWith('.json')&&e.name!=='summary.json'&&!e.name.endsWith('-observer-process.json')&&!e.name.endsWith('-observer.json'))||e.name.endsWith('.bcphrec2')||e.name.endsWith('.bcphrec1'))).map(e=>e.name).sort();}
const population=selected(transactionDirectories.source);assert.deepEqual(population,selected(transactionDirectories.native));assert(population.length>0);
assert.deepEqual(transaction.rows.map(row=>row.name),population,'Complete actual retained packet/wire hash population');
for(const row of transaction.rows){assert.equal(row.status,'ALL_BYTES_EQUAL');for(const path of Object.values(transactionDirectories))assert.deepEqual(pin(resolve(path,row.name)),row.pin,'Actual full parity file hash '+row.name);}
tree(dirname(prerequisite));
const nodeProof=proofDirectory(nodeNativeProof),cleanSummaryPath=resolve(nodeProof,'summary.json'),clean=JSON.parse(readFileSync(cleanSummaryPath));
assert.equal(clean.status,'PASS_COUPLED_DYNAMIC_HOST_CLEAN_THREE_CASES');assert.equal(clean.graph,'native');assert.equal(clean.firstFailure,null);
// Confirmed actual native-01 summary schema: accepted, created and attempts are top-level numbers.
for(const key of ['created','attempts','accepted'])assert.equal(clean[key],3,'Actual clean Native summary '+key);
for(const[k,v]of Object.entries({worlds:3,attempts:3,records:243,applications:192,queries:30,queryPoints:27,anchorChecks:729}))assert.equal(clean.counts[k],v,'Actual clean Native census '+k);
assert(Object.values(clean.controls).every(control=>Object.values(control).every(v=>v==='EXECUTED_PASS')));tree(nodeProof);
for(const e of readdirSync(home,{withFileTypes:true}))if(e.isFile()&&e.name!=='AUTHOR-FREEZE-01.json')add(resolve(home,e.name));tree(resolve(home,'scene'));
const oldFreeze=resolve(root,'examples/physics-coupled-lifecycle-viewer-2276/AUTHOR-FREEZE-01.json');add(oldFreeze);const old=JSON.parse(readFileSync(oldFreeze));for(const[p,v]of Object.entries(old.files))add(resolve(root,p),v);
const provider=resolve(root,'examples/physics-coupled-dynamic-host-2276/evidence/build-02'),frozen=JSON.parse(readFileSync(resolve(provider,'frozen.json'))),receipt=JSON.parse(readFileSync(resolve(provider,'result.json')));assert.equal(receipt.status,'PASS_COUPLED_DYNAMIC_HOST_STRICT_DUAL_BUILD');
for(const[p,v]of Object.entries(frozen.files))add(isAbsolute(p)?p:resolve(root,p),v);tree(provider);for(const[p,v]of Object.entries(receipt.emittedFiles))add(resolve(provider,p),v);
for(const p of [frozen.physicalObserver,frozen.coneObserver,frozen.targetObserver,frozen.goldReference])add(resolve(root,p));
const target=resolve(root,'examples/physics-coupled-dynamic-host-reference-2276/observer.py');assert.equal(pin(target).sha256,'a90cbc24442533e48316b56f23448b392a00fa922153487d24f2389d8d9173d7');add(target);
const externalToolFiles=old.externalToolFiles;for(const[p,v]of Object.entries(externalToolFiles))assert.deepEqual(pin(p),v,'Installed tool drift '+p);
writeFileSync(resolve(home,'AUTHOR-FREEZE-01.json'),JSON.stringify({format:'physics-coupled-dynamic-host-viewer-author-freeze',status:'AUTHORED_NOT_EXECUTED',files,externalToolFiles,installedCLI:old.installedCLI,transactionProvenance:{author:{path:relative(root,transactionAuthorPath),...pin(transactionAuthorPath)},generatedFreeze:{path:relative(root,transactionFrozenPath),...pin(transactionFrozenPath)},guards:prerequisiteGuards},transactionPrerequisite:{path:relative(root,prerequisite),...pin(prerequisite),status:transaction.status,proofDirectories:Object.fromEntries(Object.entries(transactionDirectories).map(([graph,path])=>[graph,relative(root,path)])),summaries:transactionSummaries,verifiedFullParityFiles:transaction.rows.length},fileScopes:{workspace:Object.keys(files).filter(p=>!isAbsolute(p)),external:Object.keys(files).filter(isAbsolute)},archivePolicy:{include:'WORKSPACE_FILES_ONLY',exclude:'ALL_ABSOLUTE_EXTERNAL_INPUT_AND_TOOL_FILES'},cleanNativeSummary:{path:relative(root,cleanSummaryPath),...pin(cleanSummaryPath),acceptedField:'accepted',accepted:clean.accepted},nodeNativeProof:relative(root,nodeProof),provider:'ACTUAL_DYNAMIC_HOST_BUILD02_NATIVE_CLOSURE',plannedCounts:{worlds:3,attempts:3,accepted:3,applications:192,queries:30,queryPoints:27,anchorChecks:729,records:243},plannedIndependentObservers:18,WorldCalls:0,compilerCalls:0,browserCalls:0,decoderCalls:0,observerCalls:0},null,2)+'\n',{flag:'wx'});
