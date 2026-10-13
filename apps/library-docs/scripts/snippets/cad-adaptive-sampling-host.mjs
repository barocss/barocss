/* global workerCode: readonly */
// Build-time binding prepended by build-cad-adaptive-sampling.mjs before bundling.
const sourceProfile='733428030029a65797c26e3daadcae94c4762b09';
const width=640,height=420;
const project=point=>[point[0]+.4*point[2],point[1]+.6*point[2]];
function sameNative(a,b) {
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>sameNative(value,b[index]));
  if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object') {
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameNative(a[key],b[key]));
  }
  return Object.is(a,b);
}
function negativeZeroWitness(model) {
  const line=model.objects.find(object=>object.id==='keep_line'&&object.kind==='curve');
  const plane=model.objects.find(object=>object.id==='keep_plane'&&object.kind==='surface');
  const firstX=line?.controlPoints?.[0]?.[0],firstZ=plane?.controlPoints?.[0]?.[0]?.[2];
  return {keepLineFirstX:typeof firstX==='number'?Object.is(firstX,-0):null,
    keepPlaneFirstZ:typeof firstZ==='number'?Object.is(firstZ,-0):null};
}
function prepare(text,result) {
  const poles=result.curve.controlPoints.map(project);
  const min=[Math.min(...poles.map(p=>p[0])),Math.min(...poles.map(p=>p[1]))];
  const max=[Math.max(...poles.map(p=>p[0])),Math.max(...poles.map(p=>p[1]))];
  const scale=Math.min(510/Math.max(max[0]-min[0],1),240/Math.max(max[1]-min[1],1));
  const offsetX=65+(510-(max[0]-min[0])*scale)/2;
  const offsetY=92+(240-(max[1]-min[1])*scale)/2;
  const screen=point=>{const p=project(point);return[offsetX+(p[0]-min[0])*scale,offsetY+(max[1]-p[1])*scale];};
  return {text,result,projection:{formula:'screen axes: x + 0.4z; y + 0.6z',sourceUnit:'mm',pixelScale:scale,
    projectedControlBounds:{min,max},fitAuthority:'original control polygon; unchanged across tolerance-only edits'},screen};
}
function bitmapFor(canvas,data) {
  const bitmap=canvas.ownerDocument.createElement('canvas');bitmap.width=width;bitmap.height=height;
  try {
    const context=bitmap.getContext('2d');if(!context)throw new Error('Canvas2D staging is unavailable');
    const {result,screen}=data;
    context.fillStyle='#101820';context.fillRect(0,0,width,height);
    context.fillStyle='#EDF3F8';context.font='bold 20px sans-serif';context.fillText('Adaptive points · original Curve stays unchanged',22,31);
    context.font='14px sans-serif';context.fillStyle='#B8C9D8';
    context.fillText(`Criterion ${result.request.options.chordToleranceMM} mm · ${result.report.segmentCount} segments · ${result.report.pointCount} points`,22,55);
    context.fillText('XYZ projection: x + 0.4z, y + 0.6z · native coordinates remain mm',22,77);
    context.beginPath();result.curve.controlPoints.forEach((point,index)=>{const[x,y]=screen(point);if(index)context.lineTo(x,y);else context.moveTo(x,y);});
    context.setLineDash([5,5]);context.strokeStyle='#BD8655';context.lineWidth=1.5;context.stroke();context.setLineDash([]);
    result.curve.controlPoints.forEach((point,index)=>{const[x,y]=screen(point);context.beginPath();context.arc(x,y,3,0,Math.PI*2);context.fillStyle='#F0B36D';context.fill();context.font='11px sans-serif';context.fillText('P'+index,x+5,y-5);});
    context.beginPath();result.samples.forEach((sample,index)=>{const[x,y]=screen(sample.pointMM);if(index)context.lineTo(x,y);else context.moveTo(x,y);});
    context.lineWidth=3;context.strokeStyle='#68D5E1';context.stroke();
    result.samples.forEach(sample=>{const[x,y]=screen(sample.pointMM);context.beginPath();context.arc(x,y,2.5,0,Math.PI*2);context.fillStyle=sample.originalD1Guarded?'#FF7979':'#D5F8FB';context.fill();});
    const [start,end]=result.domain,axisY=369;
    context.strokeStyle='#718699';context.lineWidth=1;context.beginPath();context.moveTo(65,axisY);context.lineTo(575,axisY);context.stroke();
    result.samples.forEach(sample=>{const x=65+(sample.parameter-start)/(end-start)*510;context.beginPath();context.moveTo(x,axisY-6);context.lineTo(x,axisY+6);context.stroke();});
    context.fillStyle='#CEDCE8';context.font='12px sans-serif';context.fillText(`Original parameter ${start}`,65,394);context.fillText(String(end),562,394);
    context.fillText('Orange: control polygon · Cyan: returned display points',22,414);
    return bitmap;
  }catch(error){bitmap.width=bitmap.height=0;throw error;}
}
function cancelled(message) {
  const error=new Error(message);error.name='AbortError';error.code='CANCELLED';return error;
}
function workerClient() {
  const url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'}));
  let worker;
  try {worker=new Worker(url,{type:'module',name:'cad-adaptive-sampling'});}
  catch(error){URL.revokeObjectURL(url);throw error;}
  let closed=false,fatal=false,nextId=0;
  const pending=new Map(),calls={requested:0,completed:0,failed:0,cancelled:0,staleResponses:0};
  function rejectAll(error){for(const entry of pending.values())entry.reject(error);pending.clear();}
  function terminate(error){if(closed)return;closed=true;worker.terminate();rejectAll(error);URL.revokeObjectURL(url);}
  worker.onmessage=event=>{
    const message=event.data;
    if(message?.type!=='result')return;
    const entry=pending.get(message.id);
    if(!entry){calls.staleResponses++;return;}
    pending.delete(message.id);
    if(message.ok){calls.completed++;entry.resolve(message);}
    else {
      calls.failed++;
      const error=new Error(message.error?.message||'Worker sampling refused');
      error.name=message.error?.name||'Error';
      if(typeof message.error?.code==='string')error.code=message.error.code;
      if(message.error?.cause)error.cause=message.error.cause;
      error.workerRelay=true; // Genuine provider fields, not a main-realm provider instance.
      entry.reject(error);
    }
  };
  worker.onerror=event=>{event.preventDefault();fatal=true;terminate(new Error(event.message||'Sampling Worker failed'));};
  worker.onmessageerror=()=>{fatal=true;terminate(new Error('Sampling Worker result could not be decoded'));};
  return {
    available:()=>!closed&&!fatal,
    ledger:()=>({...calls}),
    cancelPending(){if(!pending.size)return;calls.cancelled+=pending.size;rejectAll(cancelled('Sampling candidate superseded'));},
    sample(text){
      if(closed)return Promise.reject(new Error('Sampling Worker is unavailable'));
      const id=++nextId;calls.requested++;
      return new Promise((resolve,reject)=>{
        pending.set(id,{resolve,reject});
        try{worker.postMessage({type:'sample',id,text});}
        catch(error){pending.delete(id);calls.failed++;reject(error);}
      });
    },
    dispose(){worker.onmessage=worker.onerror=worker.onmessageerror=null;terminate(cancelled('Sampling Worker disposed'));},
  };
}
export async function createExample(canvas,kind,text) {
  if(kind!=='cad-adaptive-sampling')throw new Error('Unknown CAD adaptive sampling example');
  const context=canvas.getContext('2d');if(!context)throw new Error('Browser Canvas2D drawing is unavailable');
  const client=workerClient();
  let accepted=null,disposed=false,unavailable=false,frameCount=0,generation=0;
  const onLoss=()=>{unavailable=true;};canvas.addEventListener('contextlost',onLoss);
  function live(){if(disposed)throw new Error('CAD adaptive sampling example is disposed');if(unavailable)throw new Error('Canvas2D context is unavailable; recreate the example');if(!client.available())throw new Error('Sampling Worker is unavailable; recreate the example');}
  function report() {
    if(!accepted)return null;
    const {result}=accepted;
    return structuredClone({backend:'Public CAD sampling → application browser Canvas2D drawing',sourceProfile,
      curveId:result.curve.id,degree:result.curve.degree,domain:result.domain,chordToleranceMM:result.request.options.chordToleranceMM,
      segmentCount:result.report.segmentCount,pointCount:result.report.pointCount,maximumDepthUsed:result.report.maximumDepthUsed,
      criterion:result.report.quality.criterion,quality:result.report.quality,
      maximumControlPolygonBoundMM:result.report.maximumControlPolygonBoundMM,
      maximumArithmeticUncertaintyMM:result.report.maximumArithmeticUncertaintyMM,
      maximumObservedOutputChordDistanceMM:result.report.maximumObservedOutputChordDistanceMM,
      directProviderCounts:result.report.directCounts,delegatedReceipts:result.report.delegatedReceipts,
      wholeValidatorCalls:0,applicationDrawingD0Calls:0,
      negativeZeroWitness:negativeZeroWitness(result.originalModel),
      completeNativeModelRetainedOnToleranceEdit:accepted.completeNativeModelRetainedOnToleranceEdit??null,
      projection:accepted.projection,nativeControlPointsXYZMM:result.curve.controlPoints,
      parameterDistribution:result.samples.map(sample=>sample.parameter),frameCount,available:!disposed&&!unavailable&&client.available(),
      worker:accepted.worker,
      logicalSize:[width,height],actualGL:false,packageCanvas2D:false,request:result.request,
      resultView:{kind:'application-view-not-complete-public-result',request:result.request,
        originalModel:result.originalModel,curve:result.curve,domain:result.domain,samples:result.samples,
        report:result.report,spanCount:result.spans.length,operationCount:result.operations.length,
        omittedAuditData:['Complete span extraction and leaf records','Complete subdivision operation records'],
        retention:'The complete accepted result stays internal; the selected CPU consumer receipt retains its full data.'},
    });
  }
  async function update(sourceText) {
    live();const token=++generation;client.cancelPending();
    const response=await client.sample(sourceText);
    if(disposed||token!==generation)throw cancelled('Sampling candidate no longer owns this example');
    live();const candidate=prepare(sourceText,response.result);
    candidate.worker={execution:'Application dedicated Worker',callId:response.id,computeMilliseconds:response.computeMilliseconds,
      measurement:'Selected public sampleSourceCurveAdaptive call only; not startup, cloning, drawing or a benchmark',
      ledgerAtAdoption:client.ledger(),ledgerScope:'Application Worker messages; unrelated to public provider directCounts'};
    if(accepted) {
      const previous=accepted.result.request,next=candidate.result.request;
      const toleranceOnly=previous.source===next.source&&Object.is(previous.sourceVersion,next.sourceVersion)&&previous.curveId===next.curveId&&
        ['maxSegments','maxDepth','resultIdPrefix'].every(key=>Object.is(previous.options[key],next.options[key]))&&
        !Object.is(previous.options.chordToleranceMM,next.options.chordToleranceMM);
      candidate.completeNativeModelRetainedOnToleranceEdit=toleranceOnly?
        previous.source===next.source&&sameNative(accepted.result.originalModel,candidate.result.originalModel)&&sameNative(accepted.result.curve,candidate.result.curve):null;
    }
    const bitmap=bitmapFor(canvas,candidate);
    try {
      live();if(token!==generation)throw cancelled('Sampling candidate was superseded');
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      context.drawImage(bitmap,0,0);accepted=candidate;frameCount++;
      return report();
    }finally{bitmap.width=bitmap.height=0;}
  }
  async function action(id) {
    live();if(id!=='coarsen'&&id!=='fine')throw new Error('Unknown adaptive sampling action');
    const next=structuredClone(accepted.result.request);next.options.chordToleranceMM=id==='coarsen'?.2:.05;
    const acceptedSource=JSON.stringify(next,null,2),data=await update(acceptedSource);
    return {report:data,acceptedSource};
  }
  function dispose(){if(disposed)return;disposed=true;generation++;canvas.removeEventListener('contextlost',onLoss);client.dispose();accepted=null;}
  try{await update(text);}catch(error){dispose();throw error;}
  return {update,report,action,dispose};
}
