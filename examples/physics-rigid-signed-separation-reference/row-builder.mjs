import assert from 'node:assert/strict';
import {requireArchive,dense} from '../physics-rigid-coupled-position-diagnostic/archive.mjs';
import {joinRows,pairKey} from '../physics-rigid-coupled-position-diagnostic/coverage.mjs';
export const ADDED_PAIRS={ALIGNED:[['b4','b5'],['b6','b7']],OFFSET:[['b1','b2'],['b6','b7']],YAW:[['b1','b2']]};
export const ORIGINAL_ROW_COUNTS={ALIGNED:6,OFFSET:6,YAW:7};
export function buildSignedArchivedProblem(m,archivedRow,preparedFrames){
 const row=archivedRow,pre=preparedFrames.frames[1].bodies,saved=structuredClone(pre);requireArchive(pre.length===9&&preparedFrames.pairs.length===36&&row.problem.rows.length===ORIGINAL_ROW_COUNTS[row.scene],'rows');
 const preObservations=preparedFrames.pairs.map(([a,b])=>({aId:pre[a].id,bId:pre[b].id,actual:m.inspectPair(pre[a],pre[b])}));
 const joined=joinRows(row.problem,preObservations),original=row.problem.rows.map(r=>({aId:r.aId,bId:r.bId,normal:[...r.normal],boundM:r.depthM})),rowSelections=[];
 const proof=row.diagnostic;requireArchive(proof&&proof.scene===row.scene&&proof.graph===row.graph&&proof.diagnosticGO===true&&proof.transitions.length===36,'rows');
 const omitted=proof.transitions.filter(t=>t.classification==='previously-separated-or-touching-omitted-pair-post-overlap');requireArchive(JSON.stringify(omitted.map(t=>[t.aId,t.bId]))===JSON.stringify(ADDED_PAIRS[row.scene]),'rows');
 for(const [index,r]of original.entries()){
  const a=pre.find(b=>b.id===r.aId),b=pre.find(b=>b.id===r.bId),observation=preObservations.find(o=>o.aId===r.aId&&o.bId===r.bId),fresh=m.inspectSignedBoxSAT(a,b);
  requireArchive(joined.has(pairKey(r.aId,r.bId))&&observation.actual.hit!==null&&r.boundM===observation.actual.hit.penetration&&r.normal.every((v,j)=>v===observation.actual.hit.normal[j]),'rows');
  // Original rows retain the original positive penetration clamp; fresh signed query remains raw.
  requireArchive(Math.max(0,fresh.boundM)===r.boundM&&fresh.normal.every((v,j)=>v===r.normal[j]),'rows');
  rowSelections.push({kind:'original',aId:r.aId,bId:r.bId,originalRowIndex:index,addedIndex:null,row:structuredClone(r),freshPreSelection:fresh,positiveOriginalInspection:observation.actual,zeroSigns:{componentBitsAgree:r.normal.map((v,j)=>Object.is(v,fresh.normal[j])),rehydratedArchivedNormalNegativeZero:r.normal.map(v=>Object.is(v,-0)),freshNormalNegativeZero:fresh.normal.map(v=>Object.is(v,-0)),rehydratedArchivedBoundNegativeZero:Object.is(r.boundM,-0),freshBoundNegativeZero:Object.is(fresh.boundM,-0),historicRowSignMetadataAvailable:false},selectionSource:{issue:1264,step:row.report.failure.step,originalRowIndex:index}});
 }
 const additions=[];
 for(const [index,[aId,bId]]of ADDED_PAIRS[row.scene].entries()){
  const a=pre.find(b=>b.id===aId),b=pre.find(b=>b.id===bId),observation=preObservations.find(o=>o.aId===aId&&o.bId===bId),classification=omitted.find(t=>t.aId===aId&&t.bId===bId),fresh=m.inspectSignedBoxSAT(a,b);
  requireArchive(!joined.has(pairKey(aId,bId))&&observation.actual.hit===null&&classification.detectorBeforePresent===false&&classification.independentRawBefore==='separated'&&classification.independentNormalizedBefore==='separated'&&classification.conventionTransitionAgrees===true&&fresh.boundM<0&&Number.isFinite(fresh.boundM)&&dense(fresh.normal,3),'rows');
  const added={aId,bId,normal:[...fresh.normal],boundM:fresh.boundM};additions.push(added);rowSelections.push({kind:'added',aId,bId,originalRowIndex:null,addedIndex:index,row:structuredClone(added),freshPreSelection:fresh,positiveOriginalInspection:observation.actual,zeroSigns:{freshNormalNegativeZero:fresh.normal.map(v=>Object.is(v,-0)),freshBoundNegativeZero:Object.is(fresh.boundM,-0)},selectionSource:{issue:1308,step:row.report.failure.step,classification:structuredClone(classification)}});
 }
 const problem={bodies:row.problem.bodies.map((b,i)=>{requireArchive(b.id===pre[i].id&&Object.is(b.inverseMass,pre[i].inverseMass),'rows');return {...b};}),rows:[...original,...additions]};
 requireArchive(problem.rows.length===8&&new Set(problem.rows.map(r=>pairKey(r.aId,r.bId))).size===8,'rows');assert.deepEqual(pre,saved,'fresh rows retain pre bodies');
 return {problem,rowSelections,preObservations,originalRows:original.length,addedRows:additions.length,allPrePairTests:36,retrospectiveSelection:true,worldCreated:false,worldStepped:false};
}
