import {parseBaroCadSource} from '@barocss/cad-interop/native';

const check=(condition,message)=>{if(!condition)throw new RangeError('Native source download: '+message);};
const clone=value=>structuredClone(value);
const nativeOptions=Object.freeze({sourceVersion:0,countU:5,countV:5,unitsPerMillimeter:1,
  curveDisplay:Object.freeze({version:1,chordToleranceMM:.02,maxSegments:512,maxDepth:16})});
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a),other=Object.keys(b);
  return keys.length===other.length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
}
function record(input,fields,label){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,label+' must be plain own data');
  const keys=Reflect.ownKeys(input),owned={};
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),label+' has missing or unsupported fields');
  for(const key of fields){const descriptor=Object.getOwnPropertyDescriptor(input,key);
    check(descriptor&&descriptor.enumerable&&'value'in descriptor,label+'.'+key+' must be own data');owned[key]=descriptor.value;}
  return owned;
}
function ref(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'reference must be plain own data');
  const kind=Object.getOwnPropertyDescriptor(input,'kind');check(kind&&kind.enumerable&&'value'in kind,'reference kind must be own data');
  check(kind.value==='surface'||kind.value==='curve','reference kind must be Surface or Curve');
  const id=kind.value==='surface'?'surfaceId':'curveId',owned=record(input,['kind','modelId',id],'reference');
  for(const key of ['modelId',id])check(typeof owned[key]==='string'&&owned[key].length>=1&&owned[key].length<=128,'reference identity exceeds128code units');
  return owned;
}
function metadata(input){
  if(input===null)return null;
  const owned=record(input,['name','bytes','sha256','source','modelId','refs'],'accepted File metadata');
  check(typeof owned.name==='string'&&owned.name.length>=1&&owned.name.length<=255,'filename requires1..255code units');
  check(Number.isInteger(owned.bytes)&&owned.bytes>=1&&owned.bytes<=65536,'accepted File requires1..65536bytes');
  check(typeof owned.sha256==='string'&&/^[0-9a-f]{64}$/.test(owned.sha256),'accepted File SHA256 must be64lowercase hex characters');
  check(typeof owned.source==='string'&&owned.source.length>=1&&owned.source.length<=65536,'accepted File source exceeds65536code units');
  check(typeof owned.modelId==='string'&&owned.modelId.length>=1&&owned.modelId.length<=128,'accepted File Model identity exceeds128code units');
  const values=owned.refs;
  check(Array.isArray(values)&&Object.getPrototypeOf(values)===Array.prototype,'accepted File refs must be an own array');
  const length=Object.getOwnPropertyDescriptor(values,'length')?.value;
  check(Number.isInteger(length)&&length>=1&&length<=4&&Reflect.ownKeys(values).length===length+1,'accepted File requires1..4dense refs');
  owned.refs=Array.from({length},(_,index)=>{const descriptor=Object.getOwnPropertyDescriptor(values,String(index));
    check(descriptor&&descriptor.enumerable&&'value'in descriptor,'accepted File ref must be dense own data');return ref(descriptor.value);});
  try{structuredClone(input);}catch(cause){throw new RangeError('Native source download: accepted File metadata cannot be copied',{cause});}
  return clone(owned);
}
function nativeScope(viewer){
  const state=viewer.getState();
  check(state.status!=='disposed'&&state.native&&state.native.model,'a current ordinary native source is required');
  check(!state.document&&!state.modelSet&&!state.assembly&&!state.shell&&!state.mixedDepth&&!state.qualifiedFaceScene
    &&!state.uniformCurve&&!state.selectedUniformCurve,'this mode is not an ordinary native source');
  const source=state.native.source;
  check(typeof source==='string'&&source.length>=1&&source.length<=65536,'native source requires1..65536code units');
  const inventory=[...state.surfaces.map(value=>({kind:'surface',...value})),...state.curves.map(value=>({kind:'curve',...value}))];
  return clone({source,model:state.native.model,inventory});
}
function errorSnapshot(error){const code=error?.code;return{name:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:String(error),
  code:typeof code==='string'||typeof code==='number'&&Number.isFinite(code)?code:null};}

/** Prepare exact current Source0 bytes; this report is not a reusable download admission token. */
async function prepare(viewer,acceptedFile,current){
  const initial=nativeScope(viewer),offered=metadata(acceptedFile),data=new TextEncoder().encode(initial.source);
  check(data.length>=1&&data.length<=65536,'native source requires1..65536UTF8bytes');
  check(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data)===initial.source,'native source UTF8 roundtrip changed the original text');
  const parsed=parseBaroCadSource(initial.source,clone(nativeOptions));
  const refs=[...parsed.surfaces.map(value=>({kind:'surface',modelId:parsed.model.name,surfaceId:value.surfaceId})),
    ...parsed.curves.map(value=>({kind:'curve',modelId:parsed.model.name,curveId:value.curveId}))];
  check(parsed.model.objects.length>=1&&parsed.model.objects.length<=4&&refs.length===parsed.model.objects.length
    &&parsed.unrenderedCurveIds.length===0,'the complete original source requires1..4native objects');
  check(same(parsed.model,initial.model),'the complete original Source0 Model differs from current native authority');
  check(initial.inventory.length>=1&&initial.inventory.every(value=>refs.some(original=>same(value,original))),
    'current inventory differs from the original native references');
  if(offered)check(offered.source===initial.source&&offered.modelId===parsed.model.name&&same(offered.refs,refs)
    &&offered.bytes===data.length,'accepted File metadata differs from current original source authority');
  const digest=await crypto.subtle.digest('SHA-256',data);
  if(!current())return null;
  check(same(initial,nativeScope(viewer)),'current native source changed during byte preparation');
  const sha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(offered)check(offered.sha256===sha256,'accepted File hash differs from the original bytes');
  const name=offered?.name??parsed.model.name+'.source0.css';
  check(name.length>=1&&name.length<=255,'suggested filename exceeds255code units');
  return clone({version:0,name,bytes:data.length,sha256,source:initial.source,modelId:parsed.model.name,refs,
    filenameOrigin:offered?'opened-file':'generated',data});
}

export async function prepareNativeSourceDownload(viewer,acceptedFile=null){return prepare(viewer,acceptedFile,()=>true);}

/** Offer current original bytes without changing Viewer or local File-open intent. */
export function createNativeSourceDownload(viewer,canvas,options){
  const settings=record(options,['getAcceptedFile','onChange','onError'],'download callbacks');
  for(const key of ['getAcceptedFile','onChange','onError'])check(typeof settings[key]==='function',key+' must be a callback function');
  const {getAcceptedFile,onChange,onError}=settings;
  let pending=false,disposed=false,enabled=false,report=null,error=null,generation=0,scope=null;
  const urls=new Set(),anchors=new Set(),timers=new Map();
  const snapshot=()=>clone({version:0,pending,disposed,enabled,report,error,activeUrls:urls.size,activeAnchors:anchors.size,activeTimers:timers.size});
  const changed=()=>{if(!disposed)onChange(snapshot());};
  const current=ticket=>!disposed&&ticket===generation;
  function refresh(notify){
    if(disposed)return snapshot();
    let next=null;try{next=nativeScope(viewer);}catch{}
    const eligible=!!next,contentChanged=!same(scope,next),changedState=eligible!==enabled||contentChanged;
    if(contentChanged||!eligible&&pending){generation++;pending=false;error=null;}
    if(contentChanged||!eligible)report=null;
    scope=next;enabled=eligible;
    if(notify&&changedState)changed();return snapshot();
  }
  const sync=()=>refresh(true);
  const revoke=url=>{if(urls.delete(url))URL.revokeObjectURL(url);};
  const remove=anchor=>{if(anchors.delete(anchor))anchor.remove();};
  async function download(){
    check(!disposed,'controller is disposed');generation++;pending=false;error=null;refresh(false);const ticket=generation;
    let url=null,anchor=null,timer=null;
    try{
      check(enabled,'a current ordinary native source is required');const initial=clone(scope),offered=getAcceptedFile();
      if(!current(ticket))return null;
      pending=true;changed();if(!current(ticket))return null;
      const prepared=await prepare(viewer,offered,()=>current(ticket));
      if(!current(ticket))return null;
      refresh(false);if(!current(ticket))return null;
      check(same(initial,scope),'current native source changed before download');
      const data=new Uint8Array(prepared.data),blob=new Blob([data],{type:'text/plain;charset=utf-8'});
      url=URL.createObjectURL(blob);urls.add(url);
      const document=canvas.ownerDocument;check(document.body,'download requires the canvas owner document body');
      anchor=document.createElement('a');anchors.add(anchor);anchor.href=url;anchor.download=prepared.name;document.body.append(anchor);
      refresh(false);
      if(!current(ticket)){remove(anchor);anchor=null;revoke(url);url=null;return null;}
      anchor.click();remove(anchor);anchor=null;
      if(!current(ticket)){revoke(url);url=null;return null;}
      const cleanupUrl=url;
      timer=setTimeout(()=>{timers.delete(timer);revoke(cleanupUrl);if(!disposed)changed();},1000);timers.set(timer,url);
      const {name,bytes,sha256,modelId,refs,filenameOrigin}=prepared;
      report=clone({name,bytes,sha256,modelId,refs,filenameOrigin});const output=clone(report);
      pending=false;error=null;changed();return output;
    }catch(failure){
      if(anchor)remove(anchor);
      if(timer!==null){clearTimeout(timer);timers.delete(timer);}
      if(url)revoke(url);
      if(!current(ticket))return null;
      refresh(false);if(!current(ticket))return null;
      pending=false;error=errorSnapshot(failure);changed();if(!current(ticket))return null;
      onError(failure);throw failure;
    }
  }
  function dispose(){
    if(disposed)return;
    generation++;disposed=true;pending=false;enabled=false;scope=null;report=null;error=null;
    for(const timer of timers.keys())clearTimeout(timer);timers.clear();
    for(const anchor of [...anchors])remove(anchor);
    for(const url of [...urls])revoke(url);
  }
  return{download,sync,snapshot,dispose};
}
