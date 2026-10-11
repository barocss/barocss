import {compileCadModel,curveDomain,surfaceDomain,evaluateCurve,evaluateSurface} from '@barocss/cad';

const check=(value,message)=>{if(!value)throw new RangeError('Selected native point: '+message);};
const clone=value=>structuredClone(value);
const id=/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const modelId=/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function snapshot(input){
  let remaining=8192;const active=new Set();
  function copy(value,depth){
    check(--remaining>=0&&depth<=16,'own JSON value/depth budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),'own JSON numbers must be finite');return value;}
    if(typeof value==='string'){
      check(value.length<=65536&&new TextEncoder().encode(value).length<=65536,'own JSON string exceeds65536bytes/code units');return value;
    }
    check(value&&typeof value==='object','own JSON data is required');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'foreign JSON prototype is unsupported');
    check(!active.has(value),'cyclic JSON data is unsupported');active.add(value);
    const keys=Reflect.ownKeys(value);let output;
    if(array){
      const length=Object.getOwnPropertyDescriptor(value,'length');
      check(length&&'value'in length&&Number.isInteger(length.value)&&length.value>=0&&length.value<=512,'array exceeds512elements');
      check(keys.length===length.value+1,'array has holes or extra fields');output=[];
      for(let index=0;index<length.value;index++){
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        check(descriptor&&descriptor.enumerable&&'value'in descriptor,'array requires own dense data');
        output.push(copy(descriptor.value,depth+1));
      }
    }else{
      check(keys.length<=64&&keys.every(key=>typeof key==='string'&&key.length<=64),'record field/key budget exceeded');
      output={};
      for(const key of keys){
        const descriptor=Object.getOwnPropertyDescriptor(value,key);
        check(descriptor&&descriptor.enumerable&&'value'in descriptor,'record requires own enumerable data');
        Object.defineProperty(output,key,{value:copy(descriptor.value,depth+1),enumerable:true,writable:true,configurable:true});
      }
    }
    active.delete(value);return output;
  }
  const owned=copy(input,0);
  // Test the ORIGINAL graph: descriptor copying must not launder a Proxy.
  structuredClone(input);
  return owned;
}
function record(value,keys,label){
  check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be a record');
  const actual=Reflect.ownKeys(value);
  check(actual.length===keys.length&&actual.every(key=>keys.includes(key)),label+' has missing or extra fields');
  return value;
}
function ref(value){
  check(value&&typeof value==='object'&&!Array.isArray(value),'original reference must be data');
  check(value.kind==='surface'||value.kind==='curve','original reference kind must be Surface or Curve');
  record(value,value.kind==='surface'?['kind','modelId','surfaceId']:['kind','modelId','curveId'],'original reference');
  check(typeof value.modelId==='string'&&modelId.test(value.modelId),'original Model ID must be ASCII1..128');
  const geometryId=value.kind==='surface'?value.surfaceId:value.curveId;
  check(typeof geometryId==='string'&&id.test(geometryId),'original geometry ID must be ASCII1..128');
  return value;
}
const refKey=value=>JSON.stringify(value.kind==='surface'
  ?['surface',value.modelId,value.surfaceId]:['curve',value.modelId,value.curveId]);
function source(value){
  check(typeof value==='string'&&value.length>=1&&value.length<=65536
    &&new TextEncoder().encode(value).length<=65536,'whole Source0 requires1..65536bytes/code units');
  return value;
}

/** Copy and qualify whole ordinary Source0 authority without changing Viewer state. */
export function readNativePointScope(viewer){
  const state=viewer.getState();
  check(state.status!=='disposed','Viewer is disposed');
  check(state.native&&!state.document&&!state.modelSet&&!state.assembly&&!state.shell
    &&!state.qualifiedFaceScene&&!state.uniformCurve&&!state.selectedUniformCurve&&!state.mixedDepth,
  'ordinary native Source0 mode is required');
  const scope=snapshot({source:state.native.source,model:state.native.model,
    refs:[...state.surfaces.map(value=>({kind:'surface',...value})),
      ...state.curves.map(value=>({kind:'curve',...value}))],selectedRef:state.selectedGeometry});
  source(scope.source);
  const compiled=compileCadModel(scope.source,{sourceVersion:0});
  if(!compiled.ok)throw new RangeError('Selected native point: whole Source0 compilation refused',{cause:compiled});
  check(same(compiled.model,scope.model),'whole current Model differs from its complete Source0');
  check(scope.model.objects.length>=1&&scope.model.objects.length<=4&&scope.refs.length===scope.model.objects.length,
    'complete original inventory requires1..4objects');
  const keys=scope.refs.map(value=>refKey(ref(value)));
  const expected=scope.model.objects.map(value=>refKey(value.kind==='surface'
    ?{kind:'surface',modelId:scope.model.name,surfaceId:value.id}
    :{kind:'curve',modelId:scope.model.name,curveId:value.id}));
  check(new Set(keys).size===keys.length&&new Set(expected).size===expected.length
    &&keys.every(key=>expected.includes(key)),'display inventory must contain every unique original object');
  if(scope.selectedRef!==null){ref(scope.selectedRef);check(keys.includes(refKey(scope.selectedRef)),
    'selected reference is not a current original object');}
  return clone(scope);
}

/** Inspect the currently selected original point with one public CAD D0 call. */
export function querySelectedNativePoint(viewer,expected,input){
  const owned=snapshot({expected,input});
  const pin=record(owned.expected,['source','model','ref'],'expected scope');source(pin.source);ref(pin.ref);
  const parameters=record(owned.input,pin.ref.kind==='surface'?['u','v']:['t'],'original parameters');
  check(Object.values(parameters).every(value=>typeof value==='number'&&Number.isFinite(value)),
    'every original parameter must be an explicit finite number');
  const scope=readNativePointScope(viewer);
  check(scope.source===pin.source&&same(scope.model,pin.model)&&scope.selectedRef!==null&&same(scope.selectedRef,pin.ref),
    'whole original source, Model or current selection changed');
  const geometryId=pin.ref.kind==='surface'?pin.ref.surfaceId:pin.ref.curveId;
  const geometry=scope.model.objects.find(value=>value.kind===pin.ref.kind&&value.id===geometryId);
  check(geometry,'selected original geometry is missing');
  const domain=pin.ref.kind==='surface'?surfaceDomain(geometry):curveDomain(geometry);
  // Public evaluation owns exact domain and representability errors; do not clamp or wrap them.
  const pointMM=pin.ref.kind==='surface'?evaluateSurface(geometry,parameters.u,parameters.v)
    :evaluateCurve(geometry,parameters.t);
  const latest=readNativePointScope(viewer);
  check(latest.source===scope.source&&same(latest.model,scope.model)&&same(latest.refs,scope.refs)
    &&latest.selectedRef!==null&&same(latest.selectedRef,pin.ref),'original scope or selection changed during inspection');
  return snapshot({version:0,scope:pin,parameters,domain,pointMM,lengthUnit:'mm',
    coordinateFrame:'native-authored',certification:'not-certified'});
}
