// Root-only private geometry experiment; no World, normal/position solver or compiler.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cpSync,copyFileSync,existsSync,mkdirSync,openSync,readSync,closeSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const here=import.meta.dirname,root=resolve(here,'../..'),id=process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id??'')&&process.argv.length===3);
const out=join(here,'evidence',id);mkdirSync(out);
const capture=join(here,'evidence/capture-479-01'),buildPath=join(root,'examples/physics-anisotropic-inertia-2276/evidence/public-build-02/result.json');
const bankPath=join(root,'examples/physics-box-contact-features-2276/cases.json');
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const deadline=Date.now()+170000,frozen={},copies=[],reports={},parity={};
let charged=0,phase='authenticate',graph=null,failure=null,integrity='NOT_RUN';
function pin(path){const fd=openSync(path,'r'),h=createHash('sha256'),b=Buffer.alloc(65536);let bytes=0;try{let n;while((n=readSync(fd,b,0,b.length,null))){h.update(b.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}return{bytes,sha256:h.digest('hex')};}
function freeze(path,sha){const p=pin(path);if(sha)assert.equal(p.sha256,sha);frozen[relative(root,path)]=p;}
function time(){assert.ok(Date.now()<deadline,'one170s includes allchildren/auth');}
function charge(n){charged+=n;assert.ok(charged<=16*1024*1024,'16MiB aggregate private evidence including both closures');}
function put(name,value){const b=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)+'\n');assert.ok(b.length<=2*1024*1024);charge(b.length);writeFileSync(join(out,name),b,{flag:'wx'});}
function inventory(dir){const r={};function walk(at){for(const e of readdirSync(at,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const p=join(at,e.name);if(e.isDirectory())walk(p);else r[relative(dir,p)]=pin(p);}}walk(dir);return r;}
function words(value){const list=[];let nodes=0;function visit(x,d){assert.ok(++nodes<=262144&&d<=32);if(typeof x==='number'){assert.ok(Number.isFinite(x)&&list.length<65536);const b=Buffer.alloc(8);b.writeDoubleLE(x);list.push(b);}else if(Array.isArray(x))for(const v of x)visit(v,d+1);else if(x&&typeof x==='object')for(const k of Object.keys(x))visit(x[k],d+1);}visit(value,0);return Buffer.concat(list).toString('hex');}
function packet(data){return{format:'repair-479-v1',data,numericWordsF64leHex:words(data)};}
function restore(p){const b=Buffer.from(p.numericWordsF64leHex,'hex');assert.ok(b.length<=512*1024);let at=0,nodes=0;function visit(x,d){assert.ok(++nodes<=262144&&d<=32);if(typeof x==='number'){assert.ok(at+8<=b.length);const n=b.readDoubleLE(at);at+=8;assert.ok(Number.isFinite(n)&&n===x);return n;}if(Array.isArray(x))return x.map(v=>visit(v,d+1));if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v,d+1)]));return x;}const r=visit(p.data,0);assert.equal(at,b.length);return r;}
function same(a,b,label){assert.deepEqual(a,b,label);assert.equal(words(a),words(b),label+' ALLwords');}
function simple(body){return{id:body.id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[...body.halfExtentsM]},positionM:[...body.positionM],orientation:[...body.orientationXYZW],velocityMps:[0,0,0],angularVelocityRadps:[0,0,0],inverseMass:1,inverseInertiaLocal:[1,1,1],sensor:false,restitution:0,frictionStatic:0,frictionDynamic:0};}
function geometryValue(value){if(value===null)return null;const{conditioning,...rest}=value;return rest;}
function call(fn,a,b,observe=false){const before=structuredClone([a,b]);let value=null,error=null,trace=null;
  if(observe){assert.equal(globalThis.__repair479Originals,undefined);globalThis.__repair479Originals={originals:[]};}
  try{value=fn(a,b);}catch(e){error={name:e.name,code:e.code??null,message:e.message};}
  finally{if(observe){trace=structuredClone(globalThis.__repair479Originals);delete globalThis.__repair479Originals;}}
  same([a,b],before,'private input retained');return observe?{value,error,trace}:{value,error};}
function reference(label,data,oracle='repair-oracle.py'){const p=packet(data),wire=Buffer.from(JSON.stringify(p)+'\n');assert.ok(wire.length<=2*1024*1024);put(graph+'-'+label+'-request.json',p);time();reports[graph].referenceCalls++;
  const child=spawnSync(python,['-B',join(here,oracle)],{cwd:root,input:wire,encoding:'utf8',timeout:Math.max(1,Math.floor(deadline-Date.now())),maxBuffer:65536});
  put(graph+'-'+label+'.stdout',Buffer.from(child.stdout??''));put(graph+'-'+label+'.stderr',Buffer.from(child.stderr??''));
  assert.ok(child.status===0&&!child.signal&&!child.error&&!(child.stderr??'').length);const reply=JSON.parse(child.stdout);assert.equal(reply.ok,true,JSON.stringify(reply));assert.equal(reply.resolved,true);assert.equal(reply.executionFailure,false);return reply;}
try{
  for(const p of [import.meta.filename,join(here,'REPAIR-479-CONTRACT.md'),join(here,'repair-oracle.py'),join(here,'bank-resolution-oracle.py'),join(capture,'result.json'),join(capture,'actual-479.json'),join(capture,'witness-audit.stdout'),buildPath,bankPath,process.execPath,python,
    '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Python'])freeze(p);
  const paid=JSON.parse(readFileSync(join(capture,'result.json'),'utf8')),build=JSON.parse(readFileSync(buildPath,'utf8')),bank=JSON.parse(readFileSync(bankPath,'utf8'));
  assert.equal(paid.status,'CONTACT_479_SOURCE_REFUSAL_CAPTURED_AND_AUDITED');assert.equal(paid.failure,null);assert.equal(paid.sourceIntegrity,'PASS');
  assert.equal(build.status,'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');assert.equal(build.firstFailure,null);
  assert.equal(bank.cases.length,20);assert.equal(bank.cases.filter(c=>c.populationGroup==='original-P4-32').flatMap(c=>c.expectedOriginalPoints).length,32);
  for(const[p,expected]of Object.entries(bank.pins))freeze(resolve(root,p),expected.sha256);
  for(const map of [build.sourcePins,build.nativePins])for(const[p,sha]of Object.entries(map))freeze(resolve(root,p),sha);
  const actual=restore(JSON.parse(readFileSync(join(capture,'actual-479.json'),'utf8'))),context=actual.observer.faceContext;
  assert.equal(actual.observer.faceFailure.site,'ROUNDING_EXHAUSTED');assert.equal(actual.observer.facePoint.roundingStep,16);
  const{a,b,selection,faceA,faceB}=context;assert.equal(context.candidates.length,2);
  put('inputs.json',{frozen,caseId:'actual-long-three-479',plannedPerGraph:{geometryCalls:42,regressionCases:20,originalRows:32,referenceCalls:3,worldCalls:0},copiesTrusted:false});
  for(const g of ['source','native']){
    graph=g;time();const original=dirname(g==='source'?build.sourceEntry:build.nativeEntry),files=inventory(original),copy=join(out,g+'-private-provider');charge(Object.values(files).reduce((n,p)=>n+p.bytes,0));cpSync(original,copy,{recursive:true});
    if(!existsSync(join(copy,'package.json'))){const p=join(dirname(original),'package.json');freeze(p);charge(pin(p).bytes);copyFileSync(p,join(copy,'package.json'));}
    const path=join(copy,'stack/face-contact.js'),before=readFileSync(path,'utf8');let after=before;const changes=[
      ['const candidates = poly.map(p => {','const projected = poly.map(p => {'],
      ['}).filter(p => p.separation <= WITNESS_TOLERANCE_M);','});\n    const candidates = projected.filter(p => p.separation <= WITNESS_TOLERANCE_M);'],
      ['const interior = scale(candidates.reduce((sum, p) => add(sum, scale(add(p.r, p.p), .5)), [0, 0, 0]), 1 / candidates.length);',
       'const interior = scale(projected.reduce((sum, p) => add(sum, scale(add(p.r, p.p), .5)), [0, 0, 0]), 1 / projected.length);'],
      ['    const interior = scale(projected.reduce',
       '    if(globalThis.__repair479Originals)Object.assign(globalThis.__repair479Originals,{a:structuredClone(a),b:structuredClone(b),selection:structuredClone(selection),faceA,faceB,normal:planeNormalAtoB});\n    const interior = scale(projected.reduce'],
      ['const original = point(`${prefix}:${i}`, isA ? p.r : p.p, isA ? p.p : p.r, planeNormalAtoB);',
       'const original = point(`${prefix}:${i}`, isA ? p.r : p.p, isA ? p.p : p.r, planeNormalAtoB);\n            if(globalThis.__repair479Originals)globalThis.__repair479Originals.originals.push(structuredClone(original));']];
    for(const[needle,replacement]of changes){assert.equal(after.split(needle).length,2);after=after.replace(needle,replacement);}charge(Math.max(0,Buffer.byteLength(after)-Buffer.byteLength(before)));writeFileSync(path,after);
    const copied=inventory(copy);copies.push({path:copy,pins:copied});put(g+'-transform.json',{original,files,copy,changes,changedFile:'stack/face-contact.js',beforeSHA256:createHash('sha256').update(before).digest('hex'),afterSHA256:pin(path).sha256,copied});
    const oldFace=await import(pathToFileURL(join(original,'stack/face-contact.js'))),newFace=await import(pathToFileURL(path)),oldGeometry=await import(pathToFileURL(join(original,'stack/geometry.js'))),newGeometry=await import(pathToFileURL(join(copy,'stack/geometry.js'))),
      strict=await import(pathToFileURL(join(copy,'stack/strict-line.js'))),pointAPI=await import(pathToFileURL(join(original,'stack/witness.js')));
    const report=reports[g]={geometryCalls:0,referenceCalls:0,regressionCases:0,originalPointRows:0,newFaceResolutions:0,diagnosticPointConstructorCalls:0,nativeCheckContexts:0,nativeCheckMethods:0};
    phase=g+'-original-refusal';report.geometryCalls++;const old=call((x,y)=>oldFace.faceContact(x,y,selection),a,b);assert.equal(old.value,null);assert.equal(old.error?.code,'NUMERIC_LIMIT');assert.equal(old.error?.message,'private feature contact requires valid box witnesses');put(g+'-original-refusal.json',old);
    phase=g+'-candidate';report.geometryCalls++;const result=call((x,y)=>newFace.faceContact(x,y,selection),a,b);put(g+'-candidate.json',packet({a,b,selection,result}));assert.equal(result.error,null);const geometry=result.value;
    assert.equal(geometry.points.length,2);same(geometry.selection,selection,'same actual SAT selection');
    assert.equal(geometry.conditioning.strictLineCertified,true);assert.ok(geometry.conditioning.boundaryRoundingMaximumSteps<=16);
    assert.ok(geometry.conditioning.exactRationalOperations>0&&geometry.conditioning.exactRationalOperations<=200000);
    assert.ok(geometry.conditioning.exactIntegerOperations>0&&geometry.conditioning.exactIntegerOperations<=2000000);assert.ok(geometry.conditioning.exactPeakIntegerBits>0&&geometry.conditioning.exactPeakIntegerBits<=16384);
    assert.deepEqual(strict.STRICT_LINE_LIMITS,{rationalOperations:200000,integerOperations:2000000,integerBits:16384,roundingSteps:16});
    const originals=context.candidates.map((p,i)=>{report.diagnosticPointConstructorCalls++;const key=actual.observer.facePoint.original.key.replace(/:\d+$/,':'+i);return pointAPI.point(key,p.r,p.p,geometry.planeNormalAtoB);});
    const test=new strict.StrictLineContext(a,b,geometry.planeNormalAtoB);report.nativeCheckContexts++;const checks=[];
    for(const[p,i]of geometry.points.map((p,i)=>[p,i])){assert.equal(p.key,originals[i].key);const c={key:p.key,check:test.check(p.midpointM),selectedFaceBounds:test.selectedFaceBounds(p.midpointM,faceA,faceB),onFaceA:test.onFace(0,faceA,p.witnessAM),onFaceB:test.onFace(1,faceB,p.witnessBM),
      movementA:test.movementWithin(originals[i].witnessAM,p.witnessAM),movementB:test.movementWithin(originals[i].witnessBM,p.witnessBM),movementMidpoint:test.movementWithin(originals[i].midpointM,p.midpointM)};report.nativeCheckMethods+=7;assert.ok(Object.values(c).every(x=>typeof x==='string'||x===true));checks.push(c);}
    const bad=new strict.StrictLineContext(a,b,geometry.planeNormalAtoB);report.nativeCheckContexts++;report.nativeCheckMethods++;assert.equal(bad.check(actual.observer.facePoint.original.midpointM),false);
    const data={mode:'positive',a,b,faceA,faceB,normal:geometry.planeNormalAtoB,originals,oldPoint:actual.observer.facePoint.original,geometry,checks,nativeStats:test.stats(),limits:strict.STRICT_LINE_LIMITS};
    report.positiveReference=reference('positive-reference',data);
    const controlRows=[];controlRows.push({name:'old-bad-midpoint',point:actual.observer.facePoint.original,faceA,faceB,original:originals[0],expected:'strictLine'});
    const wrongFace={axis:0,side:1};report.nativeCheckMethods++;assert.equal(test.selectedFaceBounds(geometry.points[0].midpointM,wrongFace,faceB),false);
    controlRows.push({name:'wrong-named-face',point:geometry.points[0],faceA:wrongFace,faceB,original:originals[0],expected:'selectedFaceBounds'});
    const shiftedA=[...geometry.points[0].witnessAM];shiftedA[1]+=1e-11;report.diagnosticPointConstructorCalls++;const shifted=pointAPI.point(geometry.points[0].key,shiftedA,geometry.points[0].witnessBM,geometry.planeNormalAtoB);
    report.nativeCheckMethods++;assert.equal(test.onFace(0,faceA,shifted.witnessAM),false);controlRows.push({name:'witness-plane-1e-11',point:shifted,faceA,faceB,original:originals[0],expected:'witnessFace'});
    const displacedA=geometry.points[0].witnessAM.map((x,i)=>x-(i===0?2e-12:0)),displacedB=geometry.points[0].witnessBM.map((x,i)=>x-(i===0?2e-12:0));report.diagnosticPointConstructorCalls++;
    const moved=pointAPI.point(geometry.points[0].key,displacedA,displacedB,geometry.planeNormalAtoB);report.nativeCheckMethods++;assert.equal(test.movementWithin(originals[0].witnessAM,moved.witnessAM),false);
    controlRows.push({name:'movement-over-1e-12',point:moved,faceA,faceB,original:originals[0],expected:'movement'});
    report.controlsReference=reference('controls-reference',{...data,mode:'controls',controls:controlRows});
    phase=g+'-fixed20-regression';const regression=[];
    for(const c of bank.cases){const left=simple(c.a),right=simple(c.b);report.geometryCalls++;const oldResult=call(oldGeometry.featureContact,left,right);report.geometryCalls++;const newResult=call(newGeometry.featureContact,left,right,true);
      put(g+'-regression-'+c.id+'.json',packet({caseId:c.id,left,right,old:oldResult,candidate:newResult}));
      let resolutionProof=null;
      if(oldResult.error===null){assert.equal(newResult.error,null,'old success retained '+c.id);same(geometryValue(oldResult.value),geometryValue(newResult.value),'fixed20 old-success complete points '+c.id);}
      else if(oldResult.error.code!=='NUMERIC_LIMIT'||newResult.error!==null){same(oldResult.error,newResult.error,'fixed20 invalid or retained refusal '+c.id);}
      else{
        const value=newResult.value,t=newResult.trace;assert.ok(value&&value.family==='face','no uncertified edge resolution');
        assert.ok(t&&t.originals.length===value.points.length&&t.originals.length>=1&&t.originals.length<=4);
        same(t.a,left,'actual resolution A provenance');same(t.b,right,'actual resolution B provenance');same(t.selection,value.selection,'actual resolution SAT selection');
        const ctx=new strict.StrictLineContext(left,right,value.planeNormalAtoB);report.nativeCheckContexts++;const nativeChecks=[];
        for(let i=0;i<value.points.length;i++){
          const p=value.points[i],original=t.originals[i];assert.equal(p.key,original.key);
          const proof={key:p.key,check:ctx.check(p.midpointM),selectedFaceBounds:ctx.selectedFaceBounds(p.midpointM,t.faceA,t.faceB),
            onFaceA:ctx.onFace(0,t.faceA,p.witnessAM),onFaceB:ctx.onFace(1,t.faceB,p.witnessBM),movementA:ctx.movementWithin(original.witnessAM,p.witnessAM),
            movementB:ctx.movementWithin(original.witnessBM,p.witnessBM),movementMidpoint:ctx.movementWithin(original.midpointM,p.midpointM)};
          report.nativeCheckMethods+=7;nativeChecks.push(proof);
        }
        resolutionProof={checks:nativeChecks,stats:ctx.stats(),limits:strict.STRICT_LINE_LIMITS};put(g+'-resolution-native-'+c.id+'.json',packet({caseId:c.id,oldRefusal:oldResult.error,trace:t,geometry:value,resolutionProof}));
        assert.ok(nativeChecks.every(p=>Object.values(p).every(x=>typeof x==='string'||x===true)),'new resolution native certificate');
        const cnd=value.conditioning;assert.ok(cnd.strictLineCertified&&cnd.boundaryRoundingMaximumSteps<=16);
        assert.ok(cnd.exactRationalOperations>0&&cnd.exactRationalOperations<=200000&&cnd.exactIntegerOperations>0&&cnd.exactIntegerOperations<=2000000&&cnd.exactPeakIntegerBits>0&&cnd.exactPeakIntegerBits<=16384);
        report.newFaceResolutions++;
      }
      if(c.populationGroup==='original-P4-32'){assert.ok(newResult.value);assert.equal(newResult.value.points.length,c.expectedOriginalPoints.length);for(const expected of c.expectedOriginalPoints){const p=newResult.value.points.find(p=>p.key===expected.id);assert.ok(p);same(p.midpointM,expected.pointM,'original32 midpoint '+expected.id);report.originalPointRows++;}}
      regression.push({caseId:c.id,left,right,old:oldResult,candidate:newResult,resolutionProof});report.regressionCases++;}
    put(g+'-regression.json',packet({regression}));report.bankReference=reference('bank-resolution-reference',{mode:'bank',rows:regression,limits:strict.STRICT_LINE_LIMITS},'bank-resolution-oracle.py');
    assert.equal(report.geometryCalls,42);assert.equal(report.regressionCases,20);assert.equal(report.originalPointRows,32);assert.equal(report.referenceCalls,3);parity[g]={geometry,checks,regression:regression.map(r=>({caseId:r.caseId,error:r.candidate.error,geometry:geometryValue(r.candidate.value),resolutionProof:r.resolutionProof})),reference:report.positiveReference,controls:report.controlsReference,bank:report.bankReference};
  }
  same(parity.source,parity.native,'complete Source and genuine Native dependency geometry parity');
}catch(error){failure={phase,graph,name:error?.name??typeof error,message:String(error?.message??error),stack:error?.stack??null};process.exitCode=1;}
finally{try{for(const[path,expected]of Object.entries(frozen))assert.deepEqual(pin(resolve(root,path)),expected,'input changed '+path);for(const copy of copies)assert.deepEqual(inventory(copy.path),copy.pins,'private copy changed');time();integrity='PASS';}
  catch(error){integrity='FAIL';failure??={phase:'final-authentication',message:error.message};process.exitCode=1;}
  put('result.json',{status:failure?'PRIVATE_REPAIR_479_NO_GO':'PRIVATE_REPAIR_479_SOURCE_NATIVE_GEOMETRY_CONFIRMED',failure,reports,sourceIntegrity:integrity,worldCalls:0,normalSolverCalls:0,positionSolverCalls:0,compilerCalls:0,
    productionAdopted:false,public479:'NOT_RUN',nativeWorld479:'NOT_RUN',identityScope:'UNTRUSTED_PRIVATE_COPIES',chargedBeforeFinalReceiptBytes:charged});}
