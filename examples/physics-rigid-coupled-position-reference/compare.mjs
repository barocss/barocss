export function compareSolutions(candidate,reference){
  if(!candidate.ok||!reference.ok)return {agree:candidate.status===reference.status&&candidate.ok===reference.ok,candidateStatus:candidate.status,referenceStatus:reference.status};
  const finiteOutput=[candidate,reference].every(r=>Number.isFinite(r.objectiveKgM2)&&r.translations.every(t=>Array.isArray(t.u)&&t.u.length===3&&t.u.every(Number.isFinite)));
  if(!finiteOutput)return {agree:false,numericRepresentationAgrees:false};
  const displacementDeltaM=Math.max(0,...candidate.translations.flatMap((t,i)=>t.u.map((v,k)=>Math.abs(v-reference.translations[i].u[k]))));
  const objectiveDeltaKgM2=Math.abs(candidate.objectiveKgM2-reference.objectiveKgM2);
  const certificateAgrees=Object.values(candidate.certificate).every(v=>Number.isFinite(v)&&v<=1e-12);
  const exactCertificateAgrees=Object.values(reference.certificate).every(v=>v===0)&&reference.stationarityResidualKgM===0&&reference.gramPrimalConsistencyM===0;
  return {agree:displacementDeltaM<=1e-12&&objectiveDeltaKgM2<=1e-12&&certificateAgrees&&exactCertificateAgrees,displacementDeltaM,objectiveDeltaKgM2,certificateAgrees,exactCertificateAgrees};
}
export function geometryAgreement(reference){return reference.ok===true&&reference.precisionMaxDifferenceM<=1e-25&&reference.rawNormalizedDepthDifferenceM<=1e-12;}
