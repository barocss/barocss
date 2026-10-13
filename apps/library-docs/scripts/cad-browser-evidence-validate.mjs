// Validates the *shape and provenance* of a CAD browser evidence receipt.
// PASS is not a trusted attestation: review raw captured artifacts independently.
const hash = /^[0-9a-f]{64}$/i, sha = /^[0-9a-f]{40}$/i;
const status = new Set(['PASS','FAIL','BLOCKED','UNRUN']);
const stages = ['native','worker','browser','gpu','file'];
const string = v => typeof v === 'string' && v.trim().length > 0;
export function validateCadEvidence(receipt) {
  const errors = [];
  const bad = (path,why) => errors.push(path+': '+why);
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return {ok:false,errors:['receipt: object required']};
  if (receipt.schema !== 1) bad('schema','expected 1');
  if (!sha.test(receipt.sourceSha ?? '')) bad('sourceSha','40-digit commit SHA required');
  if (!string(receipt.caseId)) bad('caseId','required');
  if (!string(receipt.platform)) bad('platform','required');
  if (!string(receipt.node)) bad('node','required');
  if (!string(receipt.browser)) bad('browser','required');
  if (!string(receipt.gpuBackend)) bad('gpuBackend','required (or unavailable)');
  const s=receipt.stages;
  if (!s || typeof s!=='object' || Array.isArray(s)) bad('stages','object required');
  else for (const key of stages) if (!status.has(s[key])) bad('stages.'+key,'PASS/FAIL/BLOCKED/UNRUN required');
  if (!Array.isArray(receipt.commands)) bad('commands','array required');
  else if (receipt.commands.some(v=>!string(v))) bad('commands','nonempty strings required');
  if (!Array.isArray(receipt.failures)) bad('failures','array required');
  if (!Array.isArray(receipt.screenshots)) bad('screenshots','array required');
  else for (let i=0;i<receipt.screenshots.length;i++) {
    const v=receipt.screenshots[i];
    if (!v || !string(v.path) || !hash.test(v.sha256??'') || !string(v.step) || !string(v.output)) bad('screenshots.'+i,'path, sha256, step, output required');
  }
  const anyPass = stages.some(k=>s?.[k]==='PASS');
  if (anyPass && (!Array.isArray(receipt.commands) || !receipt.commands.length || !receipt.commands.every(string))) bad('commands','executed commands required for PASS');
  if (s?.browser==='PASS' && (!receipt.screenshots?.length || !string(receipt.browser) || receipt.accepted?.generation == null)) bad('stages.browser','frame evidence and accepted generation required');
  if (s?.gpu==='PASS' && (s?.browser!=='PASS' || !string(receipt.gpuBackend) || receipt.gpuBackend==='unavailable' || !receipt.gpuReadback?.sha256 || !hash.test(receipt.gpuReadback.sha256))) bad('stages.gpu','browser PASS and real readback sha256 required');
  if (s?.file==='PASS') {
    const f=receipt.download;
    if (!f || !Number.isInteger(f.byteCount) || f.byteCount<=0 || !hash.test(f.sha256??'') || f.freshOpen!==true || f.reedited!==true) bad('stages.file','downloaded bytes, checksum, fresh Open, re-edit required');
    if(s?.browser!=='PASS')bad('stages.file','browser PASS required');
  }
  if (s?.native==='PASS' && (!string(receipt.nativeEvidence?.providerSha) || !sha.test(receipt.nativeEvidence.providerSha) || !string(receipt.nativeEvidence?.report)))bad('stages.native','provider SHA and report reference required');
  if (s?.worker==='PASS' && (receipt.accepted?.generation==null || !string(receipt.workerEvidence?.transport)))bad('stages.worker','accepted generation and transport required');
  return {ok:errors.length===0,errors};
}
