import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {here,root,bundle,verifyFreeze} from './bundle.mjs';
import {loadArchive,PARENT,rawState,digest,requireArchive} from './archive.mjs';
import {prepareFrames} from './frames.mjs';
import {joinRows,transition,pairKey} from './coverage.mjs';
import {comparePair,pairAgrees,compareCoverage} from './compare.mjs';
import {controls} from './controls.mjs';
import {runReferenceControls} from './reference-controls.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
import {compareSolutions} from '../physics-rigid-coupled-position-reference/compare.mjs';
const out=resolve(process.argv[2]??resolve(here,'evidence/native'));await mkdir(out,{recursive:true});
let pairOracle,coverageOracle,linear;const reports=[],audits=[],controlRows=[];
const save=async(name,value)=>writeFile(resolve(out,name),gzipSync(JSON.stringify(value)));
function describeThrown(e){try{if(e instanceof Error)return {name:e.name,message:e.message,stack:e.stack};}catch{return {name:'ThrownValue',message:'Error metadata is unavailable'};}return {name:'ThrownValue',message:'Unexpected non-Error exception'};}
try{
  const frozen=await verifyFreeze(),emittedLedgerBytes=await readFile(resolve(out,'emitted-pre-consumer.json')),emittedLedger=JSON.parse(emittedLedgerBytes);
  const measuredSource=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  assert.equal(emittedLedger.node,process.version);assert.equal(emittedLedger.preConsumer,true);assert.equal(emittedLedger.buildExit,0);assert.equal(emittedLedger.strictTypesExit,0);assert.equal(emittedLedger.measuredSource,measuredSource);
  assert.ok(Array.isArray(emittedLedger.emitted)&&emittedLedger.emitted.length>0,'published emitted ledger must contain files');
  const emittedPaths=new Set();
  for(const row of emittedLedger.emitted){
    assert.ok(row&&typeof row.path==='string'&&/^packages\/barocss-(physics|cad)\/dist\//.test(row.path)&&!row.path.split('/').includes('..')&&!emittedPaths.has(row.path),'invalid or duplicate emitted path');
    emittedPaths.add(row.path);assert.ok(Number.isInteger(row.bytes)&&row.bytes>=0&&typeof row.sha256==='string','invalid emitted file metadata');
    const bytes=await readFile(resolve(root,row.path));assert.equal(bytes.length,row.bytes,'emitted byte count: '+row.path);assert.equal(digest(bytes),row.sha256,'emitted hash: '+row.path);
  }
  const emittedLedgerSha256=digest(emittedLedgerBytes);
  const input=await loadArchive(resolve(here,'../physics-rigid-coupled-position-world'));
  pairOracle=observer(resolve(here,'../physics-rigid-feature-penetration-diagnostic/geometry-reference.py'));coverageOracle=observer(resolve(here,'coverage-reference.py'));linear=observer(resolve(here,'../physics-rigid-coupled-position-reference/linear-reference.py'));
  for(const graph of PARENT.graphs){
    const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));
    const originalControls=await controls(m,pairOracle,input,here),independentControls=await runReferenceControls(request=>coverageOracle.ask(request));controlRows.push({graph,originalControls,independentControls});await save(graph+'-controls.json.gz',{originalControls,independentControls});
    for(const scene of PARENT.scenes){
      const row=input.rows.find(r=>r.graph===graph&&r.scene===scene),prepared=prepareFrames(m,row),frames=[];
      for(const frame of prepared.frames){
        const before=structuredClone(frame.bodies),observations=[];
        for(const [a,b]of prepared.pairs){const aa=frame.bodies[a],bb=frame.bodies[b],actual=m.inspectPair(aa,bb),reference=await pairOracle.ask({a:aa,b:bb}),compared=comparePair(actual,reference);observations.push({aId:aa.id,bId:bb.id,group:bb.id==='floor'?'floor':'dynamic',actual,reference,compared});}
        assert.deepEqual(frame.bodies,before,'read-only frame observation');assert.equal(observations.length,36);
        const dynamic=observations.filter(o=>o.group==='dynamic'),floor=observations.filter(o=>o.group==='floor'),maxDynamic=Math.max(...dynamic.map(o=>o.reference.normalized.depthM)),maxFloor=Math.max(...floor.map(o=>o.reference.normalized.depthM));
        const maximumDynamicPairs=dynamic.filter(o=>Math.abs(o.reference.normalized.depthM-maxDynamic)<=1e-12).map(o=>[o.aId,o.bId]);
        let parentAggregate=null;
        if(frame.role!=='pre-coupled-working'){const metric=row.report.observations[frame.stepIndex].metrics;parentAggregate={dynamicDifferenceM:Math.abs(metric.maxPairPenetrationM-maxDynamic),floorDifferenceM:Math.abs(metric.maxFloorPenetrationM-maxFloor)};parentAggregate.agrees=parentAggregate.dynamicDifferenceM<=1e-12&&parentAggregate.floorDifferenceM<=1e-12;}
        frames.push({role:frame.role,stepIndex:frame.stepIndex,timeSeconds:frame.timeSeconds,bodies:frame.bodies,observations,maximumDynamicDepthM:maxDynamic,maximumDynamicPairs,maximumFloorDepthM:maxFloor,above2mm:dynamic.filter(o=>o.reference.normalized.depthM>.002).map(o=>[o.aId,o.bId]),parentAggregate});
      }
      const joined=joinRows(row.problem,frames[1].observations),transitions=[];
      for(const pre of frames[1].observations){const post=frames[2].observations.find(o=>pairKey(o.aId,o.bId)===pairKey(pre.aId,pre.bId)),candidate=transition(row,prepared,pre,post,joined),request=structuredClone(candidate.request),reference=await coverageOracle.ask(request),compared=compareCoverage(candidate,reference);assert.deepEqual(request,candidate.request,'coverage observer input copy');transitions.push({...candidate,reference,compared});}
      const exactLinear=await linear.ask(row.problem),linearCompared=compareSolutions(row.archivedSolution,exactLinear);
      const final=frames[2],failedPairs=transitions.filter(t=>t.postAbove2mmNormalized).map(t=>({aId:t.aId,bId:t.bId,classification:t.classification,includedRow:t.includedRow,independentRawBefore:t.independentRawBefore,independentNormalizedBefore:t.independentNormalizedBefore,detectorBeforePresent:t.detectorBeforePresent,normalizingConventionTransitionAgrees:t.conventionTransitionAgrees,ties:t.ties,minimizingAxisChanged:t.minimizingAxisChanged}));
      const detectorAgreement=frames.every(f=>f.observations.every(o=>pairAgrees(o.compared))),aggregateAgreement=frames.filter(f=>f.parentAggregate).every(f=>f.parentAggregate.agrees),coverageAgreement=transitions.every(t=>t.compared.agree);
      const diagnosticGO=detectorAgreement&&aggregateAgreement&&coverageAgreement&&linearCompared.agree;
      const bytes=Buffer.concat(Object.values(row.rawSlices)),report={graph,scene,parentManifestSha256:PARENT.manifestSha256,parentMeasuredSource:PARENT.measuredSource,frames,problem:row.problem,archivedSolution:row.archivedSolution,exactLinear,linearCompared,rounding:prepared.rounding,transitions,failedPairs,rawFrameBytes:bytes.length,rawFrameSha256:digest(bytes),rawFrameHashes:prepared.rawHashes,detectorAgreement,aggregateAgreement,coverageAgreement,diagnosticGO,physicalModelGO:false,worldCreated:false,worldStepped:false,jsSolvePositionCalled:false,historicalUnarchivedCauseClaimed:false};
      reports.push(report);await writeFile(resolve(out,graph+'-'+scene+'-frames.f64le'),bytes);await save(graph+'-'+scene+'-report.json.gz',report);
      console.log(JSON.stringify({graph,scene,diagnosticGO,firstFailureStep:final.stepIndex,maximumDynamicDepthM:final.maximumDynamicDepthM,maximumDynamicPairs:final.maximumDynamicPairs,failedPairs,worldStepped:false}));
    }
  }
  for(const scene of PARENT.scenes){const rows=reports.filter(r=>r.scene===scene),{graph,...first}=rows[0];for(const row of rows.slice(1)){const {graph,...other}=row;assert.deepEqual(other,first,'source/repeat/compiled archive correspondence');}}
  for(const row of controlRows.slice(1)){assert.deepEqual(row.originalControls,controlRows[0].originalControls);assert.deepEqual(row.independentControls,controlRows[0].independentControls);}
  const diagnosticGO=reports.every(r=>r.diagnosticGO);assert.equal(reports.reduce((sum,r)=>sum+r.frames.reduce((n,f)=>n+f.observations.length,0),0),972);assert.equal(reports.reduce((sum,r)=>sum+r.transitions.length,0),324);
  await save('summary.json.gz',{base:frozen.base,measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,emittedLedgerSha256,parentManifestSha256:PARENT.manifestSha256,validatedParentArtifacts:63,actualPairFrameObservations:972,actualCoverageTransitions:324,actualLinearProblems:9,graphAudits:audits,sourceRepeatCompiledParity:true,diagnosticGO,disposition:diagnosticGO?'DIAGNOSTIC_GO':'DIAGNOSTIC_UNRESOLVED',worldCreated:false,worldStepped:false,jsSolvePositionCalled:false,physicalModelGO:false,historicalUnarchivedCauseClaimed:false,results:reports.map(({graph,scene,diagnosticGO,failedPairs,rawFrameSha256,detectorAgreement,aggregateAgreement,coverageAgreement})=>({graph,scene,diagnosticGO,failedPairs,rawFrameSha256,detectorAgreement,aggregateAgreement,coverageAgreement})),stderr:{pair:pairOracle.stderr(),coverage:coverageOracle.stderr(),linear:linear.stderr()}});
}catch(error){await save('execution-failure.json.gz',{classification:'EXECUTION_FAILURE',...describeThrown(error),completedReports:reports.length,audits});throw error;}finally{pairOracle?.close();coverageOracle?.close();linear?.close();}
