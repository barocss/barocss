import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, statfsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// Each stage is launched sequentially by a live, bounded process-group supervisor.
// No fixture generation, native smoke call, automatic retry, or detached child.
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const [flag, stage, outputArg, fixtureArg] = process.argv.slice(2);
assert.equal(flag, '--stage');
assert.ok(['source', 'owned', 'emitted', 'cold', 'refusals'].includes(stage));
assert.equal(process.versions.node, '22.23.3');
assert.ok(process.execArgv.includes('--max-old-space-size=2048'));
assert.ok(process.env.CAD_MEMBERSHIP_SUPERVISED === '1', 'Use the bounded acceptance supervisor');
const output = resolve(outputArg), fixture = resolve(fixtureArg), started = performance.now();
const HASH = 'f0bf98cd9f87fe1c16eda73412fa6e3daed938590c0e1a240a19cced22c8bfd3';
const values = ['classifyPairedRoofDifferenceBodyWorldPoints', 'validatePairedRoofDifferenceBodyWorldPoints', 'PairedRoofDifferenceBodyWorldPointError', 'PairedRoofDifferenceBodyWorldPointDiagnosticCode'];
const types = ['PairedRoofDifferenceBodyWorldPointQuery', 'PairedRoofDifferenceBodyWorldPointOptions', 'PairedRoofDifferenceBodyWorldPointResult', 'PairedRoofDifferenceBodyWorldPointReport'];
const roles = ['roof', 'floor', 'band', 'yMin', 'xMin', 'xMax'];
const points = [[0,-1/4,1/32],[0,-1/4,3/32],[0,-1/4,1/16],[0,-1/4,-1/32],[0,-1/4,5/32],[0,-1/4,0],[0,-1/4,1/8],[0,0,1/32],[0,-1/2,3/32],[-1,0,33/32],[1/2,0,11/32],[0,-1/2,0],[-1,-1/2,1],[-2,-1/2,0],[-1,2,1],[-0,-0,-0]];
// Literal analytical expectations, independent of the candidate predicate/proof.
const oracle = {
  W: ['I','I','I','O','O','floor','roof','band','yMin','xMin','xMax','floor,yMin','floor,yMin,xMin','O','O','floor,band'],
  L: ['I','O','roof','O','O','floor','O','band','O','xMin','O','floor,yMin','floor,yMin,xMin','O','O','floor,band'],
  U: ['O','I','floor','O','O','O','roof','O','yMin','O','xMax','O','O','O','O','O'],
};
const queries = () => points.map((pointMM, i) => ({queryId: `q${String(i+1).padStart(2,'0')}`, pointMM: [...pointMM]}));
function json(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value,-0) ? '-0' : JSON.stringify(value); }
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(json).join(',') + ']';
  return '{' + Object.entries(value).map(([k,v]) => JSON.stringify(k)+':'+json(v)).join(',') + '}';
}
const copy = value => JSON.parse(json(value));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const load = name => JSON.parse(readFileSync(resolve(output, name+'.json'),'utf8'));
const attempts = [], artifacts = [];
const population = { directClassifierCalls: 0, ownedValidatorCalls: 0, classifierEntries: 0, completeParentValidationAttempts: 0 };
function save(name, value, emergency = false) {
  const text = json(value)+'\n', disk = statfsSync(output);
  if (!emergency) assert.ok(Number(disk.bavail)*Number(disk.bsize)-Buffer.byteLength(text)>=128*1024*1024, 'RESOURCE_INCONCLUSIVE: disk reserve');
  writeFileSync(resolve(output,name+'.json'),text);
  const receipt = {name,bytes:Buffer.byteLength(text),sha256:hash(text)};
  if (!name.endsWith('attempts')) artifacts.push(receipt);
  return receipt;
}
function errorRecord(e, depth=0) { return {name:e?.name??null,code:e?.code??null,message:String(e?.message??e).slice(0,4096),context:e?.context??null,cause:e?.cause && depth<12 ? errorRecord(e.cause,depth+1):null}; }
function call(name, owned, parent, fn) {
  population[owned?'ownedValidatorCalls':'directClassifierCalls']++; population.classifierEntries++;
  const item={name,owned,expectedParentValidationAttempts:parent,observedParentValidationAttempts:null,outcome:'attempted',elapsedMS:0}; attempts.push(item); save(stage+'-attempts',{population,attempts},true);
  const begin=performance.now();
  try { const result=fn(); item.outcome='returned'; item.observedParentValidationAttempts=(owned?result:result.report).directCounts.bodyValidationCount; population.completeParentValidationAttempts+=item.observedParentValidationAttempts; assert.equal(item.observedParentValidationAttempts,parent); return result; }
  catch(e) { item.outcome='threw'; item.error=errorRecord(e); if(item.observedParentValidationAttempts===null && Number.isInteger(e?.context?.directCounts?.bodyValidationCount)){item.observedParentValidationAttempts=e.context.directCounts.bodyValidationCount;population.completeParentValidationAttempts+=item.observedParentValidationAttempts;} throw e; }
  finally { item.elapsedMS=performance.now()-begin; save(stage+'-attempts',{population,attempts},true); }
}
function noAliases(a,b) {
  const all=new WeakSet(); const collect=v=>{if(v && typeof v==='object'){all.add(v); Object.values(v).forEach(collect);}};
  const check=v=>{if(v && typeof v==='object'){assert.ok(!all.has(v),'caller alias'); Object.values(v).forEach(check);}}; collect(a); check(b);
}
function exactExports(text) {
  const names=[...text.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]\.\/paired-roof-difference-body-world-points\.js['"]/g)].flatMap(m=>m[1].split(',').map(s=>s.trim().replace(/^type\s+/, '')).filter(Boolean));
  assert.deepEqual(names.sort(),[...values,...types].sort());
}
async function sourceAPI() {
  const sourceRoot=resolve(repo,'packages/barocss-cad/src'), dest=resolve(output,'source-api'); mkdirSync(dest);
  writeFileSync(resolve(dest,'package.json'),'{"type":"module"}\n');
  const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??repo,'package.json')), ts=require('typescript');
  const queue=[resolve(sourceRoot,'index.ts')], seen=new Set(), graph=[];
  exactExports(readFileSync(queue[0],'utf8'));
  while(queue.length) {
    const path=queue.pop(); if(seen.has(path))continue; seen.add(path); assert.ok(path.startsWith(sourceRoot+'/'));
    const text=readFileSync(path,'utf8'), transformed=ts.transpileModule(text,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,isolatedModules:true}});
    assert.equal((transformed.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
    const imports=ts.preProcessFile(transformed.outputText,true,true).importedFiles.map(i=>i.fileName);
    for(const spec of imports){assert.ok(spec.startsWith('./')&&spec.endsWith('.js'));queue.push(resolve(dirname(path),spec.replace(/\.js$/,'.ts')));}
    const name=relative(sourceRoot,path).replace(/\.ts$/,'.js'); writeFileSync(resolve(dest,name),transformed.outputText);
    graph.push({path,sha256:hash(text),emitted:name,emittedSHA256:hash(transformed.outputText)});
  }
  save('source-api-metafile',{inProcess:true,transpiler:'typescript.transpileModule',version:ts.version,graph});
  return import(pathToFileURL(resolve(dest,'index.js')).href);
}
function verify(result, body, key) {
  assert.deepEqual(result.request.body,body); noAliases(body,result);
  assert.equal(result.classifications.length,16); assert.equal(result.proof.queries.length,16);
  assert.deepEqual(body.faces.map(f=>f.role),roles);
  const expectedCounts={inside:0,outside:0,boundary:0};
  oracle[key].forEach((expect,i)=>{
    const c=result.classifications[i], p=result.proof.queries[i], expectedRoles=expect==='I'||expect==='O'?[]:expect.split(',');
    const status=expect==='I'?'inside':expect==='O'?'outside':'boundary'; expectedCounts[status]++;
    assert.equal(c.queryId,`q${String(i+1).padStart(2,'0')}`); assert.equal(c.status,status); assert.equal(c.bodyId,body.body.id); assert.equal(c.materialCertificateId,body.body.materialCertificateId);
    assert.deepEqual(c.boundaryFaces,expectedRoles.map(role=>{const face=body.faces.find(f=>f.role===role);return {parentField:'request.body',role,faceId:face.id,supportRef:face.supportRef};}));
    assert.deepEqual(p.classification,c);
  });
  const d=result.report.directCounts;
  for(const [name,n] of Object.entries({bodyValidationCount:1,queryCount:16,yRoofEvaluationCount:15,zLowerEvaluationCount:14,zUpperEvaluationCount:14,querySignComparisonCount:90,curveD0Count:0,curveD1Count:0,surfaceD0Count:0,surfaceD1Count:0,sourceCompilationCount:0,rootSolveCount:0,rationalFloatConversionCount:0}))assert.equal(d[name],n,name);
  assert.deepEqual(result.report.classificationCounts,expectedCounts);
  const x=result.proof.queries[13], y=result.proof.queries[14];
  assert.equal(x.decision,'outside-x'); for(const f of ['originalUB','yRoof','y','zLower','zUpper','z'])assert.equal(x[f],null);
  assert.equal(y.decision,'outside-y');for(const f of ['zLower','zUpper','z'])assert.equal(y[f],null);
  for(const n of result.request.queries[15].pointMM)assert.ok(Object.is(n,-0));
  assert.deepEqual(result.proof.queries[15].pointExact,Array.from({length:3},()=>({numerator:'0',denominator:'1'})));
  if(key==='U')assert.equal(result.proof.queries[15].decision,'outside-z');
  assert.deepEqual(result.report.inheritedCounts.body,body.report);
}
try {
  const fixtureBytes=readFileSync(fixture);assert.equal(fixtureBytes.length,4877768);assert.equal(hash(fixtureBytes),HASH);
  const split=JSON.parse(fixtureBytes.toString('utf8')), bodies={W:split.request.whole,L:split.outputs[0],U:split.outputs[1]};
  const api=stage==='source'?await sourceAPI():await import(pathToFileURL(resolve(stage==='emitted'||stage==='cold'?repo:output,stage==='emitted'||stage==='cold'?'packages/barocss-cad/dist/index.js':'source-api/index.js')).href);
  assert.deepEqual(Object.keys(api).filter(n=>/PairedRoofDifferenceBodyWorldPoint/.test(n)).sort(),[...values].sort());
  for(const name of values)assert.equal(typeof api[name],name.endsWith('Code')?'object':'function');
  assert.deepEqual(Object.keys(api.PairedRoofDifferenceBodyWorldPointDiagnosticCode).sort(),['INPUT','IDENTITY','PARENT','BINDING','DOMAIN','BUDGET','FILE','OWNED'].sort());
  if(stage==='emitted'){exactExports(readFileSync(resolve(repo,'packages/barocss-cad/dist/index.d.ts'),'utf8'));save('public-surface',{values,types,sourceAndEmittedExact:true});}
  const classify=api.classifyPairedRoofDifferenceBodyWorldPoints, validate=api.validatePairedRoofDifferenceBodyWorldPoints;
  const opts={evaluationId:'world_points',maximumQueries:16};
  if(stage==='source'||stage==='emitted'||stage==='cold') {
    for(const key of stage==='source'?['W','L','U']:['W']) {
      const body=copy(bodies[key]), qs=queries(), options=copy(opts), before=json({body,queries:qs,options});
      const result=call(key,false,1,()=>classify(body,qs,options)); verify(result,bodies[key],key);
      assert.equal(json({body,queries:qs,options}),before); noAliases({body,qs,options},result);
      save(stage+'-'+key+'-result',result);
      if(stage==='source'&&key==='W') {
        const original=json(result);body.body.id='changed_caller';qs[0].pointMM[0]=99;options.evaluationId='changed_caller';assert.equal(json(result),original);
        const retainedBody=json(result.request.body), retainedProof=json(result.proof), other=json(result.classifications[11]);
        result.classifications[5].boundaryFaces[0].supportRef.sourceId='changed_returned';result.classifications[5].status='outside';
        assert.equal(json(result.request.body),retainedBody);assert.equal(json(result.proof),retainedProof);assert.equal(json(result.classifications[11]),other);
        save('retention',{callerMutationIsolated:true,returnedClassificationAndSupportRefMutationIsolated:true,completeParentEqual:true,signedZeroPreserved:true,getterControl:'refusals'});
      }
      if(stage!=='source')assert.equal(readFileSync(resolve(output,stage+'-W-result.json'),'utf8'),readFileSync(resolve(output,'source-W-result.json'),'utf8'));
    }
    if(stage==='source') {
      const lower=load('source-L-result'),upper=load('source-U-result');
      assert.equal(lower.classifications[2].boundaryFaces[0].faceId,bodies.L.faces[0].id);assert.equal(upper.classifications[2].boundaryFaces[0].faceId,bodies.U.faces[1].id);
      assert.equal(bodies.L.faces[0].orientation,'forward');assert.equal(bodies.U.faces[1].orientation,'reverse');
      save('shared-interface',{lower:lower.classifications[2],upper:upper.classifications[2],oppositeInheritedOrientations:true});
    }
  } else if(stage==='owned') {
    const result=load('source-W-result'),before=json(result);
    const report=call('owned-valid',true,1,()=>validate(result));assert.deepEqual(report,result.report);noAliases(result,report);assert.equal(json(result),before);
    save('owned-report',report);report.evaluationId='changed_report';assert.equal(json(result),before);
    const altered=copy(result);assert.equal(altered.proof.queries[0].zLower.numerator,'0');altered.proof.queries[0].zLower.numerator='1';
    assert.throws(()=>call('owned-altered',true,1,()=>validate(altered)),e=>{assert.equal(e.code,'OWNED');assert.ok(e.cause);save('owned-refusal',errorRecord(e));return true;});
  } else {
    let getterCalls=0;const cases=[
      ['forged-parent','PARENT',1,b=>{b.body.solid=false;}],
      ['request-body-getter','INPUT',0,b=>{Object.defineProperty(b,'request',{enumerable:true,get(){getterCalls++;throw Error('getter invoked');}});}],
      ['duplicate-id','IDENTITY',0,(_b,q)=>{q[1].queryId=q[0].queryId;}],
      ['seventeen','BUDGET',0,(_b,q)=>{q.push({queryId:'q17',pointMM:[0,0,0]});}],
      ['nan','INPUT',0,(_b,q)=>{q[0].pointMM[0]=NaN;}],['infinity','INPUT',0,(_b,q)=>{q[0].pointMM[0]=Infinity;}],
      ['range','DOMAIN',0,(_b,q)=>{q[0].pointMM[0]=10001;}],['sparse','INPUT',0,(_b,q)=>{delete q[1];}],
      ['cycle','INPUT',0,(b)=>{b.request=b;}],['options-extra','INPUT',0,(_b,_q,o)=>{o.extra=true;}],['short-point','INPUT',0,(_b,q)=>{q[0].pointMM.pop();}],
    ];
    const receipts=[];
    for(const [name,code,parent,mutate]of cases){const b=copy(bodies.W),q=queries(),o=copy(opts);mutate(b,q,o);let returned=false;
      assert.throws(()=>{const value=call(name,false,parent,()=>classify(b,q,o));returned=true;return value;},e=>{assert.equal(e.code,code);assert.equal(e.name,'PairedRoofDifferenceBodyWorldPointError');assert.ok(e.message.startsWith('Paired roof difference Body World points: '));assert.ok(e.message.length<=1024);assert.equal(e.context.directCounts.bodyValidationCount,parent);receipts.push({name,returned,error:errorRecord(e)});return true;});
    }
    assert.equal(getterCalls,0);save('refusal-receipts',{getterCalls,receipts});
  }
  assert.equal(hash(readFileSync(fixture)),HASH);save(stage+'-stage-receipt',{success:true,stage,population,attempts,elapsedMS:performance.now()-started,fixtureSHA256:HASH,artifacts});
} catch(error) {save(stage+'-first-failure',{success:false,stage,error:errorRecord(error),population,attempts,elapsedMS:performance.now()-started},true);process.exitCode=1;}
