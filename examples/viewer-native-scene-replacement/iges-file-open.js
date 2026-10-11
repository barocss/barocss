import {importIGES,validateIGESImport} from '@barocss/cad';
import {parseBaroCadSource} from '@barocss/cad-interop/native';

const MAX_INTENT=1000000,MAX_FILE=1048576,MAX_SNAPSHOT=4194304+8192;
const check=(value,message)=>{if(!value)throw new RangeError('IGES file open: '+message);};
const clone=value=>structuredClone(value);
const fileName=Object.getOwnPropertyDescriptor(File.prototype,'name').get;
const blobSize=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get;
const bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const nativeOptions=Object.freeze({sourceVersion:0,countU:5,countV:5,
  curveDisplay:Object.freeze({version:1,chordToleranceMM:.02,maxSegments:512,maxDepth:16})});

function ticketValue(ticket){
  check(typeof ticket==='number'&&Number.isInteger(ticket)&&ticket>=1&&ticket<=MAX_INTENT,
    'ticket must be an explicit integer1..1000000');
}
function fileMetadata(file){
  check(file!==null&&typeof file==='object'&&Object.getPrototypeOf(file)===File.prototype,
    'a same-realm ordinary File is required');
  check(Reflect.ownKeys(file).length===0,'custom File fields are not supported');
  // Intrinsic platform getters enforce the File/Blob brands without caller getters.
  const name=fileName.call(file),bytes=blobSize.call(file);
  check(typeof name==='string'&&name.length>=1&&name.length<=255,'filename requires1..255code units');
  check(Number.isInteger(bytes)&&bytes>=1&&bytes<=MAX_FILE,'File requires1..1048576bytes');
  return{name,bytes};
}
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
// Count actual JSON spelling, including numeric -0, without weakening provider data.
function snapshotBudget(value){
  let utf16=0,utf8=0;
  const add=text=>{utf16+=text.length;utf8+=new TextEncoder().encode(text).length;
    check(utf16<=MAX_SNAPSHOT&&utf8<=MAX_SNAPSHOT,'complete enclosing snapshot exceeds4MiB+8192');};
  function visit(item){
    if(item===null){add('null');return;}
    if(typeof item==='number'){check(Number.isFinite(item),'snapshot contains a nonfinite number');
      add(Object.is(item,-0)?'-0':JSON.stringify(item));return;}
    if(typeof item==='string'||typeof item==='boolean'){add(JSON.stringify(item));return;}
    check(item&&typeof item==='object','snapshot must contain copied JSON data');
    if(Array.isArray(item)){
      add('[');item.forEach((entry,index)=>{if(index)add(',');visit(entry);});add(']');return;
    }
    add('{');Object.keys(item).forEach((key,index)=>{if(index)add(',');add(JSON.stringify(key));add(':');visit(item[key]);});add('}');
  }
  visit(value);
}
function copied(value){snapshotBudget(value);return clone(value);}
function callbacks(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,
    'callbacks must be plain own data');
  const fields=['onChange','onAccepted','onError'],keys=Reflect.ownKeys(input),owned={};
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),
    'callbacks have missing or unsupported fields');
  for(const key of fields){const descriptor=Object.getOwnPropertyDescriptor(input,key);
    check(descriptor&&descriptor.enumerable&&'value'in descriptor&&typeof descriptor.value==='function',
      key+' must be an own callback function');owned[key]=descriptor.value;}
  return owned;
}
function errorField(error,key){
  try{let object=error;for(let depth=0;object&&typeof object==='object'&&depth<8;depth++){
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    if(descriptor)return'value'in descriptor?descriptor.value:undefined;
    object=Object.getPrototypeOf(object);
  }}catch{/* Diagnostics must not replace the actual thrown error. */}
}
function errorSnapshot(error){
  const name=errorField(error,'name'),message=errorField(error,'message'),code=errorField(error,'code');
  return{name:typeof name==='string'?name:'Error',
    message:(typeof message==='string'?message:typeof error==='string'?error:'Operation failed').slice(0,1024),
    code:typeof code==='string'?code.slice(0,64):typeof code==='number'&&Number.isFinite(code)?code:null};
}
const gpuEligible=state=>state.status==='ready'||state.status==='empty';
const refKey=ref=>JSON.stringify(ref.kind==='surface'
  ?['surface',ref.modelId,ref.surfaceId]:['curve',ref.modelId,ref.curveId]);
function completeRefsMatch(actual,expected){
  const a=actual.map(refKey),b=expected.map(refKey);
  return a.length===b.length&&new Set(a).size===a.length&&new Set(b).size===b.length
    &&a.every(key=>b.includes(key));
}
const stateRefs=state=>[...state.surfaces.map(ref=>({kind:'surface',...ref})),
  ...state.curves.map(ref=>({kind:'curve',...ref}))];
function matchesAccepted(state,accepted){
  return state.status!=='disposed'&&state.native&&!state.document&&!state.modelSet&&!state.assembly
    &&!state.shell&&!state.qualifiedFaceScene&&!state.uniformCurve&&!state.selectedUniformCurve&&!state.mixedDepth
    &&state.native.source===accepted.imported.source&&same(state.native.model,accepted.imported.model)
    &&completeRefsMatch(stateRefs(state),accepted.refs);
}

async function read(file,ticket,current){
  ticketValue(ticket);
  const metadata=fileMetadata(file);
  // Resolve the real public method per invocation; held reads can delegate it.
  const arrayBuffer=Blob.prototype.arrayBuffer;
  const buffer=await arrayBuffer.call(file);
  if(!current())return null;
  const length=bufferLength.call(buffer);
  check(Object.getPrototypeOf(buffer)===ArrayBuffer.prototype&&length===metadata.bytes,
    'File read requires an ordinary ArrayBuffer of its exact declared size');
  const bytes=new Uint8Array(new Uint8Array(buffer));
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  check(text.length>=1&&text.length<=MAX_FILE,'raw IGES exceeds1MiB UTF16');
  const encoded=new TextEncoder().encode(text);
  check(encoded.length<=MAX_FILE&&encoded.length===bytes.length
    &&encoded.every((value,index)=>value===bytes[index]),'UTF8 must preserve every original File byte');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  if(!current())return null;
  const sha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  const imported=importIGES(text,{sourceId:'iges_source_'+ticket,modelName:'iges_model_'+ticket,
    idPrefix:'iges_i_'+ticket,maximumEntities:16,maximumRecords:8192});
  if(!current())return null;
  validateIGESImport(imported);
  if(!current())return null;
  check(imported.model.objects.length>=1&&imported.model.objects.length<=4,
    'the complete imported Model requires1..4display objects');
  check(imported.source.length<=65536&&new TextEncoder().encode(imported.source).length<=65536,
    'complete imported Source0 exceeds65536bytes/code units');
  const refs=imported.model.objects.map(object=>object.kind==='surface'
    ?{kind:'surface',modelId:imported.model.name,surfaceId:object.id}
    :{kind:'curve',modelId:imported.model.name,curveId:object.id});
  const native=parseBaroCadSource(imported.source,{...clone(nativeOptions),unitsPerMillimeter:1});
  check(same(native.model,imported.model)&&native.unrenderedCurveIds.length===0,
    'native preflight must retain the complete original imported Model');
  const previewRefs=[...native.surfaces.map(entry=>({kind:'surface',modelId:native.model.name,surfaceId:entry.surfaceId})),
    ...native.curves.map(entry=>({kind:'curve',modelId:native.model.name,curveId:entry.curveId}))];
  check(completeRefsMatch(previewRefs,refs),'every original imported object must have one display reference');
  if(!current())return null;
  const candidate={version:0,source:{kind:'native',source:imported.source,options:clone(nativeOptions),
    basis:'authored-xyz-matches-rhyup'},display:{motion:null,visibleGeometry:clone(refs),camera:null}};
  const value=copied({...metadata,sha256,imported,refs,candidate});
  if(!current())return null;
  return{value,file,bytes};
}

/** Prepare a copied complete candidate; this does not confirm the host's up axis. */
export async function readIGESFile(file,ticket){
  ticketValue(ticket);
  return copied((await read(file,ticket,()=>true)).value);
}

/** Local File intent and provenance; Viewer remains the public presentation authority. */
export function createIGESFileOpen(viewer,options){
  const {onChange,onAccepted,onError}=callbacks(options);
  let intent=0,identity=null,stagedFile=null,staged=null,accepted=null,acceptedFile=null,acceptedBytes=null;
  let pending=false,disposed=false,error=null;
  const snapshot=()=>copied({version:0,intent,staged,accepted,pending,disposed,error});
  const changed=()=>{if(!disposed)onChange(snapshot());};
  const live=()=>check(!disposed,'controller is disposed');
  const current=action=>!disposed&&action.ticket===intent&&action.identity===identity;
  function cancel(){identity=null;if(intent<MAX_INTENT)intent++;pending=false;error=null;}
  function begin(){
    live();const exhausted=intent>=MAX_INTENT;cancel();identity={};
    return{ticket:intent,identity,exhausted};
  }
  function failed(failure,action){
    if(!current(action))return null;
    pending=false;error=errorSnapshot(failure);
    try{changed();}catch{/* Keep the original failure and its cause. */}
    if(!current(action))return null;
    try{onError(failure);}catch{/* Callback errors cannot replace this original failure. */}
    if(!current(action))return null;
    throw failure;
  }
  function postcommitFailure(failure,action){
    if(current(action)){
      pending=false;error=errorSnapshot(failure);
      try{changed();}catch{/* The public replacement and accepted metadata remain committed. */}
      if(current(action)){try{onError(failure);}catch{/* Preserve the postcommit failure. */}}
    }
    throw failure;
  }
  function stage(file){
    const action=begin();
    try{
      check(!action.exhausted,'intent capacity is exhausted; create a fresh controller');
      const metadata=fileMetadata(file);stagedFile=file;staged=metadata;
      changed();return current(action)?snapshot():null;
    }catch(failure){return failed(failure,action);}
  }
  async function open(yUpConfirmed){
    const action=begin();let committed=false;
    try{
      check(!action.exhausted,'intent capacity is exhausted; create a fresh controller');
      check(typeof yUpConfirmed==='boolean'&&yUpConfirmed===true,'explicit true XYZ/Y-up confirmation is required');
      const file=stagedFile;check(file,'choose an original IGES File first');
      check(gpuEligible(viewer.getState()),'new IGES presentation requires a ready or empty Viewer');
      pending=true;changed();if(!current(action))return null;
      const result=await read(file,action.ticket,()=>current(action));
      if(!current(action)||!result)return null;
      check(gpuEligible(viewer.getState()),'new IGES presentation requires a ready or empty Viewer');
      if(!current(action))return null;
      const {candidate,...metadata}=result.value;
      const next=copied(metadata),output=copied(next);
      snapshotBudget({version:0,intent,staged,accepted:next,pending:false,disposed:false,error:null});
      if(!current(action))return null;
      viewer.replaceNativeScene(candidate);
      if(!current(action))return null;
      accepted=next;acceptedFile=result.file;acceptedBytes=result.bytes;pending=false;error=null;committed=true;
      onAccepted(copied(output));if(!current(action))return null;
      changed();return current(action)?output:null;
    }catch(failure){return committed?postcommitFailure(failure,action):failed(failure,action);}
  }
  function invalidate(){if(disposed)return snapshot();cancel();changed();return snapshot();}
  function discard(){if(disposed)return snapshot();cancel();stagedFile=null;staged=null;changed();return snapshot();}
  function clearAccepted(){
    if(disposed)return snapshot();
    if(accepted){accepted=null;acceptedFile=null;acceptedBytes=null;changed();}
    return snapshot();
  }
  function sync(){
    if(disposed)return snapshot();
    const state=viewer.getState();let change=false;
    if(accepted&&!matchesAccepted(state,accepted)){accepted=null;acceptedFile=null;acceptedBytes=null;change=true;}
    if(pending&&!gpuEligible(state)){cancel();change=true;}
    if(change)changed();return snapshot();
  }
  function dispose(){
    if(disposed)return;
    cancel();disposed=true;stagedFile=null;staged=null;accepted=null;acceptedFile=null;acceptedBytes=null;
  }
  return{stage,open,discard,invalidate,clearAccepted,sync,snapshot,dispose};
}
