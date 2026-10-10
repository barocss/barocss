import {compareObservation} from '../physics-rigid-feature-penetration-diagnostic/compare.mjs';
import {requireArchive,dense} from './archive.mjs';
const finite=Number.isFinite;
function scalar(v){requireArchive((typeof v==='number'||typeof v==='string'&&v.trim().length>0)&&Number.isFinite(Number(v)),'result');return Number(v);}
export function comparePair(actual,reference,{legacyNormalizationControl=false}={}){
  requireArchive(reference&&typeof reference==='object'&&(reference.ok===true||reference.code==='REFERENCE_PRECISION')&&finite(reference.precisionMaxDifferenceM)&&finite(reference.rawNormalizedDepthDifferenceM),'result');
  for(const r of [reference.raw,reference.normalized]){
    requireArchive(r&&finite(r.depthM)&&finite(r.marginM)&&dense(r.normalAtoB,3)&&Array.isArray(r.candidates)&&r.candidates.length===15&&Array.isArray(r.tiedCandidateIndices)&&Array.isArray(r.tiedAxisLabels)&&r.tiedCandidateIndices.length===r.tiedAxisLabels.length&&Number.isInteger(r.candidateIndex)&&r.candidateIndex>=0&&r.candidateIndex<15&&typeof r.separated==='boolean'&&typeof r.touching==='boolean','result');
    for(const [i,c]of r.candidates.entries()){
      requireArchive(c&&c.candidateIndex===i&&typeof c.label==='string'&&typeof c.exactZero==='boolean'&&finite(c.rawAxisLength),'result');
      if(c.exactZero)requireArchive(c.axis===null&&c.radiusAM===null&&c.radiusBM===null&&c.signedCenterDistanceM===null&&c.marginM===null,'result');
      else requireArchive(dense(c.axis,3)&&[c.radiusAM,c.radiusBM,c.signedCenterDistanceM,c.marginM].every(Number.isFinite),'result');
    }
    requireArchive(r.tiedCandidateIndices.every(i=>Number.isInteger(i)&&i>=0&&i<15)&&r.tiedAxisLabels.every(x=>typeof x==='string'),'result');
  }
  return compareObservation(actual,reference,{requireNormalizedDepthAgreement:!legacyNormalizationControl});
}
export function pairAgrees(c){return c.selectorBitsAgree&&c.depthAgrees&&c.separationAgrees&&c.precisionAgrees&&c.normalizedDepthAgrees;}
/** The independent worker supplies final scalar field names before root freeze. */
export function compareCoverage(candidate,reply){
  requireArchive(reply&&typeof reply==='object'&&typeof reply.ok==='boolean'&&typeof reply.resolved==='boolean'&&reply.metrics&&reply.reference&&Array.isArray(reply.violations),'result');
  const m=reply.metrics;
  const precision=scalar(m.precisionMaxDifferenceM),normalized=scalar(m.maxRawNormalizedDepthDifferenceM);
  requireArchive(m.precisionMaxDifferenceM!==null&&m.maxRawNormalizedDepthDifferenceM!==null&&finite(precision)&&finite(normalized),'result');
  const checks={referenceResolved:reply.resolved&&reply.ok,precisionAgrees:precision<=1e-25,normalizedDepthAgrees:normalized<=1e-12,recordedRoundedFinalMatches:m.recordedRoundedFinalMatches===true,recordedFinalAgrees:scalar(m.maxRecordedFinalErrorM)<=1e-12,axisFormulaAgrees:scalar(m.axisFormulaMaxErrorM)<=1e-25,candidateAxisFormulaAgrees:Math.max(0,...Object.values(candidate.axisChanges).flatMap(a=>a.map(x=>x.formulaErrorM)))<=1e-12};
  if(candidate.rowResidualNominalM!==null){requireArchive(m.rowResidualM!==null&&finite(scalar(m.rowResidualM)),'result');checks.rowResidualAgrees=Math.abs(candidate.rowResidualNominalM-scalar(m.rowResidualM))<=1e-12;}
  else {requireArchive(m.rowResidualM===null,'result');checks.rowResidualAgrees=true;}
  checks.fixedOrientation=m.fixedOrientation===true;
  for(const convention of ['raw','normalized']){
    const expected=reply.reference[convention];requireArchive(expected&&Array.isArray(expected.axes),'result');
    for(const axis of candidate.axisChanges[convention]){
      const r=expected.axes.find(x=>x.candidateIndex===axis.candidateIndex);requireArchive(r&&r.label===axis.label,'result');
      checks[convention+'Axis'+axis.candidateIndex]=Math.abs(axis.actualMarginChangeM-scalar(r.marginChangeM))<=1e-12&&Math.abs(axis.formulaMarginChangeM-scalar(r.expectedMarginChangeM))<=1e-12&&axis.centreProjectionSignChanged===r.centerProjectionSignChanged;
    }
  }
  return {...checks,agree:Object.values(checks).every(Boolean)};
}
