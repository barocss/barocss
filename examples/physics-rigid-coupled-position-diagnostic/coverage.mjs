import {requireArchive,dense} from './archive.mjs';
export const pairKey=(a,b)=>a+'\u0000'+b;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const independentClass=r=>r.separated?'separated':r.touching?'touching':'overlap';
export function joinRows(problem,preObservations){
  requireArchive(problem&&Array.isArray(problem.bodies)&&problem.bodies.length===9&&new Set(problem.bodies.map(b=>b.id)).size===9&&Array.isArray(problem.rows)&&problem.rows.length<=8&&preObservations.length===36,'rows');
  const observed=new Map(preObservations.map(o=>[pairKey(o.aId,o.bId),o])),joined=new Map();
  for(const [index,row]of problem.rows.entries()){
    const key=pairKey(row.aId,row.bId),o=observed.get(key);requireArchive(o&&row.aId!==row.bId&&!joined.has(key)&&dense(row.normal,3)&&Math.abs(Math.hypot(...row.normal)-1)<=1e-12&&Number.isFinite(row.depthM)&&row.depthM>=0&&row.depthM<=10,'rows');
    requireArchive(o.actual.hit!==null&&row.depthM===o.actual.hit.penetration&&row.normal.every((x,i)=>x===o.actual.hit.normal[i]),'rows');joined.set(key,{index,row:structuredClone(row),normalZeroSignsRecordedByJSON:true});
  }
  for(const o of preObservations)requireArchive(joined.has(pairKey(o.aId,o.bId))===(o.actual.hit!==null),'rows');
  return joined;
}
export function transition(rowData,prepared,pre,post,joined){
  const key=pairKey(pre.aId,pre.bId),entry=joined.get(key)??null;
  const a=prepared.frames[1].bodies.find(b=>b.id===pre.aId),b=prepared.frames[1].bodies.find(b=>b.id===pre.bId),aa=prepared.frames[2].bodies.find(b=>b.id===pre.aId),bb=prepared.frames[2].bodies.find(b=>b.id===pre.bId),ta=prepared.translations.find(t=>t.id===a.id),tb=prepared.translations.find(t=>t.id===b.id);
  const rawBefore=independentClass(pre.reference.raw),rawAfter=independentClass(post.reference.raw),normalizedBefore=independentClass(pre.reference.normalized),normalizedAfter=independentClass(post.reference.normalized);
  const beforeDelta=sub(b.positionM,a.positionM),afterDelta=sub(bb.positionM,aa.positionM),actualRelativeDelta=sub(afterDelta,beforeDelta);
  const axisChanges={};
  for(const convention of ['raw','normalized']){
    const before=pre.reference[convention],after=post.reference[convention];
    axisChanges[convention]=before.candidates.filter(x=>!x.exactZero).map(axis=>{const other=after.candidates.find(x=>x.candidateIndex===axis.candidateIndex);requireArchive(other&&!other.exactZero&&dense(axis.axis,3)&&dense(other.axis,3),'result');
      const projected=dot(axis.axis,actualRelativeDelta),formula=-Math.abs(axis.signedCenterDistanceM+projected)+Math.abs(axis.signedCenterDistanceM),change=other.marginM-axis.marginM;
      return {candidateIndex:axis.candidateIndex,label:axis.label,axis:[...axis.axis],marginBeforeM:axis.marginM,marginAfterM:other.marginM,projectedActualCentreDeltaM:projected,formulaMarginChangeM:formula,actualMarginChangeM:change,formulaErrorM:Math.abs(change-formula),centreProjectionSignChanged:Math.sign(axis.signedCenterDistanceM)!==Math.sign(other.signedCenterDistanceM),minimumBefore:before.tiedCandidateIndices.includes(axis.candidateIndex),minimumAfter:after.tiedCandidateIndices.includes(axis.candidateIndex)};});
  }
  const rowResidualNominalM=entry?dot(entry.row.normal,sub(tb.u,ta.u))-entry.row.depthM:null;
  const rowResidualActualM=entry?dot(entry.row.normal,sub(sub(bb.positionM,b.positionM),sub(aa.positionM,a.positionM)))-entry.row.depthM:null;
  const archivedMarginM=entry?rowData.archivedSolution.primalMarginsM[entry.index]:null;
  if(entry)requireArchive(Number.isFinite(archivedMarginM)&&Math.abs(rowResidualNominalM-archivedMarginM)<=1e-12,'result');
  const conventionTransitionAgrees=rawBefore===normalizedBefore&&rawAfter===normalizedAfter;
  let classification;
  if(!conventionTransitionAgrees)classification='convention-transition-ambiguous';
  else if(entry)classification=rawAfter==='overlap'?'included-row-post-overlap':'included-row-clear';
  else if(rawBefore==='overlap')classification='pre-existing-overlap-with-detector-absence';
  else classification=rawAfter==='overlap'?'previously-separated-or-touching-omitted-pair-post-overlap':'omitted-pair-clear';
  return {aId:a.id,bId:b.id,includedRow:entry!==null,row:entry?.row??null,rowIndex:entry?.index??null,previousRowIncluded:rowData.previousProblem.rows.some(r=>r.aId===a.id&&r.bId===b.id),detectorBeforePresent:pre.actual.hit!==null,independentRawBefore:rawBefore,independentRawAfter:rawAfter,independentNormalizedBefore:normalizedBefore,independentNormalizedAfter:normalizedAfter,conventionTransitionAgrees,classification,rowResidualNominalM,rowResidualActualM,archivedMarginM,nominalRelativeTranslationM:sub(tb.u,ta.u),actualRelativeCentreDeltaM:actualRelativeDelta,rawMinimumMarginChangeM:post.reference.raw.marginM-pre.reference.raw.marginM,normalizedMinimumMarginChangeM:post.reference.normalized.marginM-pre.reference.normalized.marginM,axisChanges,ties:{rawBefore:pre.reference.raw.tiedAxisLabels,rawAfter:post.reference.raw.tiedAxisLabels,normalizedBefore:pre.reference.normalized.tiedAxisLabels,normalizedAfter:post.reference.normalized.tiedAxisLabels},minimizingAxisChanged:{raw:pre.reference.raw.candidateIndex!==post.reference.raw.candidateIndex,normalized:pre.reference.normalized.candidateIndex!==post.reference.normalized.candidateIndex},postAbove2mmRaw:post.reference.raw.depthM>.002,postAbove2mmNormalized:post.reference.normalized.depthM>.002,request:{before:{a:structuredClone(a),b:structuredClone(b)},after:{a:structuredClone(aa),b:structuredClone(bb)},translations:{aM:[...ta.u],bM:[...tb.u]},row:entry?.row??null}};
}
