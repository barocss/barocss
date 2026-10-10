import {parseBaroCadSource} from '@barocss/cad-interop/native';

const check=(condition,message)=>{if(!condition)throw new RangeError('Native file open: '+message);};
const clone=value=>structuredClone(value);
const fileName=Object.getOwnPropertyDescriptor(File.prototype,'name').get;
const blobSize=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get;
const bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const nativeOptions=Object.freeze({sourceVersion:0,countU:5,countV:5,
  curveDisplay:Object.freeze({version:1,chordToleranceMM:.02,maxSegments:512,maxDepth:16})});
function fileMetadata(file){
  check(file!==null&&typeof file==='object'&&Object.getPrototypeOf(file)===File.prototype,
    'a same-realm ordinary File is required');
  check(Reflect.ownKeys(file).length===0,'custom File fields are not supported');
  // These intrinsic platform getters also reject forged File objects and Proxies.
  const name=fileName.call(file),bytes=blobSize.call(file);
  check(typeof name==='string'&&name.length>=1&&name.length<=255,'filename must contain1..255code units');
  check(Number.isInteger(bytes)&&bytes>=1&&bytes<=65536,'File requires1..65536bytes');
  return{name,bytes};
}
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a),other=Object.keys(b);
  return keys.length===other.length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
}
function callbacks(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'callbacks must be plain own data');
  const fields=['onChange','onAccepted','onError'],keys=Reflect.ownKeys(input),owned={};
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),'callbacks have missing or unsupported fields');
  for(const key of fields){const descriptor=Object.getOwnPropertyDescriptor(input,key);
    check(descriptor&&descriptor.enumerable&&'value'in descriptor&&typeof descriptor.value==='function',key+' must be an own callback function');
    owned[key]=descriptor.value;}
  return owned;
}
function errorSnapshot(error){
  const code=error?.code;
  return{name:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:String(error),
    code:typeof code==='string'||typeof code==='number'&&Number.isFinite(code)?code:null};
}
const gpuEligible=state=>!['context-lost','unavailable','disposed'].includes(state.status);
const stateRefs=state=>[...state.surfaces.map(ref=>({kind:'surface',...ref})),
  ...state.curves.map(ref=>({kind:'curve',...ref}))];
async function read(file,current){
  const metadata=fileMetadata(file);
  // Resolve the public platform method per invocation so held real reads can be observed independently.
  const arrayBuffer=Blob.prototype.arrayBuffer;
  const buffer=await arrayBuffer.call(file);
  if(!current())return null;
  const length=bufferLength.call(buffer);
  check(Object.getPrototypeOf(buffer)===ArrayBuffer.prototype&&length===metadata.bytes,'File read byte length differs from its declared size');
  const bytes=new Uint8Array(new Uint8Array(buffer));
  const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  check(source.length>=1&&source.length<=65536,'source requires1..65536code units');
  const encoded=new TextEncoder().encode(source);
  check(encoded.length===bytes.length&&encoded.every((value,index)=>value===bytes[index]),'UTF8 source does not preserve original bytes');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  if(!current())return null;
  const sha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  const parsed=parseBaroCadSource(source,{...clone(nativeOptions),unitsPerMillimeter:1});
  const refs=[...parsed.surfaces.map(surface=>({kind:'surface',modelId:parsed.model.name,surfaceId:surface.surfaceId})),
    ...parsed.curves.map(curve=>({kind:'curve',modelId:parsed.model.name,curveId:curve.curveId}))];
  check(parsed.model.objects.length>=1&&parsed.model.objects.length<=4&&refs.length===parsed.model.objects.length
    &&parsed.unrenderedCurveIds.length===0,'the complete original source requires1..4displayed native objects');
  const candidate={version:0,source:{kind:'native',source,options:clone(nativeOptions),basis:'authored-xyz-matches-rhyup'},
    display:{motion:null,visibleGeometry:clone(refs),camera:null}};
  return{value:clone({...metadata,sha256,source,modelId:parsed.model.name,refs,candidate}),model:clone(parsed.model)};
}

/** Read exact original UTF8 bytes and prepare a complete public native-scene candidate. */
export async function readNativeFile(file){return clone((await read(file,()=>true)).value);}

/** Caller-owned local File intent; public Viewer replacement remains the admission authority. */
export function createNativeFileOpen(viewer,options){
  const {onChange,onAccepted,onError}=callbacks(options);
  let intent=0,stagedFile=null,staged=null,accepted=null,acceptedModel=null,pending=false,disposed=false,error=null;
  const snapshot=()=>clone({version:0,intent,staged,accepted,pending,disposed,error});
  const changed=()=>{if(!disposed)onChange(snapshot());};
  const live=()=>check(!disposed,'controller is disposed');
  const current=ticket=>!disposed&&ticket===intent;
  const cancel=()=>{intent++;pending=false;error=null;};
  const failed=(failure,ticket)=>{
    if(!current(ticket))return null;
    pending=false;error=errorSnapshot(failure);changed();
    if(!current(ticket))return null;
    onError(failure);throw failure;
  };
  function stage(file){
    live();cancel();const ticket=intent;
    try{const metadata=fileMetadata(file);stagedFile=file;staged=metadata;changed();return snapshot();}
    catch(failure){return failed(failure,ticket);}
  }
  async function open(){
    live();cancel();const ticket=intent,file=stagedFile;
    try{
      check(file,'choose an original File first');
      check(gpuEligible(viewer.getState()),'new File presentation requires an available Viewer');
      pending=true;changed();
      if(!current(ticket))return null;
      const result=await read(file,()=>current(ticket));
      if(!current(ticket)||!result)return null;
      check(gpuEligible(viewer.getState()),'new File presentation requires an available Viewer');
      if(!current(ticket))return null;
      viewer.replaceNativeScene(result.value.candidate);
      const {candidate,...metadata}=result.value;
      accepted=clone(metadata);acceptedModel=clone(result.model);pending=false;error=null;
      const output=clone(accepted);
      onAccepted(clone(output));changed();return output;
    }catch(failure){return failed(failure,ticket);}
  }
  function invalidate(){if(disposed)return snapshot();cancel();changed();return snapshot();}
  function discard(){if(disposed)return snapshot();cancel();stagedFile=null;staged=null;changed();return snapshot();}
  function clearAccepted(){if(disposed)return snapshot();if(accepted){accepted=null;acceptedModel=null;changed();}return snapshot();}
  function sync(){
    if(disposed)return snapshot();
    const state=viewer.getState();let change=false;
    if(accepted&&(!state.native||state.document||state.native.source!==accepted.source
      ||!same(state.native.model,acceptedModel)||!same(stateRefs(state),accepted.refs))){
      accepted=null;acceptedModel=null;change=true;
    }
    if(pending&&!gpuEligible(state)){cancel();change=true;}
    if(change)changed();return snapshot();
  }
  function dispose(){
    if(disposed)return;
    cancel();disposed=true;stagedFile=null;staged=null;accepted=null;acceptedModel=null;
  }
  return{stage,open,discard,invalidate,clearAccepted,sync,snapshot,dispose};
}
