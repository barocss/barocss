import { sampleSourceCurveAdaptive } from '@barocss/cad';

function errorData(error) {
  const value={name:error?.name||'Error',message:error?.message||String(error)};
  if(typeof error?.code==='string')value.code=error.code;
  if(error?.cause) {
    value.cause={name:error.cause.name||'Error',message:error.cause.message||'Provider cause'};
    if(typeof error.cause.code==='string')value.cause.code=error.cause.code;
    if(Array.isArray(error.cause.diagnostics))value.cause.diagnostics=error.cause.diagnostics;
  }
  return value;
}
self.addEventListener('message',event=>{
  const message=event.data;
  if(message?.type!=='sample'||!Number.isInteger(message.id)||message.id<1)return;
  let started=null;
  try {
    let request;
    try {request=JSON.parse(message.text);} catch(cause) {
      const error=new Error('The complete sampling request must be valid JSON',{cause});
      error.name='AdaptiveRequestJSONError';error.code='INPUT';throw error;
    }
    started=performance.now();
    const result=sampleSourceCurveAdaptive(request);
    const computeMilliseconds=performance.now()-started;
    self.postMessage({type:'result',id:message.id,ok:true,result,computeMilliseconds});
  }catch(error){
    self.postMessage({type:'result',id:message.id,ok:false,error:errorData(error),
      computeMilliseconds:started===null?null:performance.now()-started});
  }
});
