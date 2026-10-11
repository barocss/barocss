const check=(value,message)=>{if(!value)throw new RangeError('Native pointer navigation: '+message);};
function callbacks(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'callbacks must be plain own data');
  const fields=['isIdle','onViewChange','onError'],keys=Reflect.ownKeys(input),owned={};
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),'callbacks have missing or unsupported fields');
  for(const key of fields){const descriptor=Object.getOwnPropertyDescriptor(input,key);
    check(descriptor&&descriptor.enumerable&&'value'in descriptor&&typeof descriptor.value==='function',key+' must be an own callback function');
    owned[key]=descriptor.value;}
  return owned;
}
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}

/** Opt-in existing public camera controls for the current ordinary native view. */
export function createNativePointerNavigation(viewer,canvas,options){
  check(arguments.length===3,'constructor takes exactly three arguments');
  const {isIdle,onViewChange,onError}=callbacks(options);
  check(canvas instanceof HTMLCanvasElement,'the actual Viewer canvas is required');
  let enabled=false,disposed=false,adapter=null,bindingScope=null,latestCamera=null;
  let changingBinding=false,reporting=false,gesture=null,canceledClick=false,touchAction=null,touchOverridden=false;
  let status=viewer.getState().status;
  const events=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','wheel'];
  const localSnapshot=()=>({enabled,attached:!!adapter,disposed,status});
  const noArgs=count=>check(count===0,'this hook takes no arguments');
  const notifyError=error=>{
    if(disposed||reporting)return;
    reporting=true;try{onError(error);}finally{reporting=false;}
  };
  const removeObservers=()=>{for(const type of events)canvas.removeEventListener(type,observe);};
  const restoreTouchAction=()=>{
    if(!touchOverridden)return;
    if(touchAction.value)canvas.style.setProperty('touch-action',touchAction.value,touchAction.priority);
    else canvas.style.removeProperty('touch-action');
    touchOverridden=false;
  };
  const detach=()=>{
    if(gesture?.dragged)canceledClick=true;
    gesture=null;removeObservers();
    const old=adapter;adapter=null;bindingScope=null;
    old?.dispose();restoreTouchAction();
  };
  const nativeReady=state=>state.status==='ready'&&!!state.native
    &&typeof state.native.source==='string'&&state.native.source.length>0
    &&state.native.model?.version===0&&state.native.model.lengthUnit==='mm'
    &&Array.isArray(state.native.model.objects)&&state.native.model.objects.length>=1&&state.native.model.objects.length<=4
    &&!state.document&&!state.modelSet&&!state.qualifiedFaceScene&&!state.shell&&!state.assembly
    &&!state.uniformCurve&&!state.selectedUniformCurve&&!state.mixedDepth;
  const read=()=>{
    const idle=isIdle();check(!disposed,'controller is disposed');
    check(typeof idle==='boolean','isIdle must return a primitive boolean');
    const state=viewer.getState();status=state.status;return{idle,state};
  };
  const scope=state=>{
    const rect=canvas.getBoundingClientRect();
    check([rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)&&rect.width>0&&rect.height>0,'a visible finite CSS canvas is required');
    return structuredClone({native:state.native,surfaces:state.surfaces,curves:state.curves,
      curveSampleVersion:state.curveSampleVersion,visibleGeometry:state.visibleGeometry,
      selected:state.selected,selectedGeometry:state.selectedGeometry,motion:state.motion,
      geometryMotion:state.geometryMotion,surfaceMaterials:state.surfaceMaterials,lighting:state.lighting,
      fluidFrame:state.fluidFrame,clothFrame:state.clothFrame,frame:state.frame,sourceUnit:state.sourceUnit,
      mmToSceneUnit:state.mmToSceneUnit,width:canvas.width,height:canvas.height,
      css:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}});
  };
  function reconcile(data){
    const eligible=enabled&&data.idle&&nativeReady(data.state),currentScope=eligible?scope(data.state):null;
    latestCamera=structuredClone(data.state.camera);
    changingBinding=true;
    try{
      if(!eligible||adapter&&!same(bindingScope,currentScope))detach();
      if(eligible&&!adapter){
        adapter=viewer.attachPointerControls({onError:error=>{syncInternal();notifyError(error);}});
        bindingScope=currentScope;
        canvas.style.setProperty('touch-action','none',touchAction.priority);touchOverridden=true;
        // Observers must follow the new SDK listeners on every rebind.
        removeObservers();for(const type of events)canvas.addEventListener(type,observe);
      }
    }finally{changingBinding=false;}
  }
  function syncInternal(){
    if(disposed||changingBinding)return localSnapshot();
    try{reconcile(read());}
    catch(error){changingBinding=true;try{detach();}finally{changingBinding=false;}notifyError(error);}
    return localSnapshot();
  }
  function guard(event){
    if(disposed||changingBinding)return;
    if(gesture&&event.pointerId===gesture.id&&['pointermove','pointerup'].includes(event.type)
      &&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY))
      gesture.dragged ||= Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>3;
    syncInternal();
    if(event.type==='pointerdown')canceledClick=false;
  }
  function observe(event){
    if(disposed||changingBinding||!adapter)return;
    if(event.type==='pointerdown'&&!gesture&&event.isPrimary&&event.button===0&&canvas.hasPointerCapture(event.pointerId))
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dragged:false};
    if(gesture&&event.pointerId===gesture.id&&['pointerup','pointercancel','lostpointercapture'].includes(event.type))gesture=null;
    if(!['pointermove','pointerup','wheel'].includes(event.type))return;
    try{
      const data=read();
      if(!data.idle||!nativeReady(data.state)||!same(bindingScope,scope(data.state))){reconcile(data);return;}
      if(same(latestCamera,data.state.camera))return;
      latestCamera=structuredClone(data.state.camera);
    }catch(error){changingBinding=true;try{detach();}finally{changingBinding=false;}notifyError(error);return;}
    // The SDK camera has already committed; callback errors cannot roll it back.
    try{onViewChange();}catch(error){notifyError(error);}
  }
  function canceledGestureClick(event){
    if(!canceledClick)return;
    canceledClick=false;event.preventDefault();event.stopImmediatePropagation();
  }
  for(const type of events)canvas.addEventListener(type,guard,{capture:true,passive:false});
  canvas.addEventListener('click',canceledGestureClick,true);
  return{
    setEnabled(value){
      check(!disposed,'controller is disposed');check(arguments.length===1&&typeof value==='boolean','enabled must be one explicit boolean');
      if(value){
        let data;try{data=read();}catch(error){changingBinding=true;try{detach();}finally{changingBinding=false;}notifyError(error);throw error;}
        if(!data.idle||!nativeReady(data.state)){
          changingBinding=true;try{detach();}finally{changingBinding=false;}
          check(false,'enabling requires an idle ready ordinary native view');
        }
        scope(data.state);
        if(!enabled)touchAction={value:canvas.style.getPropertyValue('touch-action'),priority:canvas.style.getPropertyPriority('touch-action')};
        enabled=true;reconcile(data);return localSnapshot();
      }
      enabled=false;changingBinding=true;try{detach();}finally{changingBinding=false;}
      touchAction=null;return syncInternal();
    },
    sync(){noArgs(arguments.length);return syncInternal();},
    invalidate(){
      noArgs(arguments.length);if(disposed)return localSnapshot();
      changingBinding=true;try{detach();}finally{changingBinding=false;}
      return syncInternal();
    },
    snapshot(){noArgs(arguments.length);return localSnapshot();},
    dispose(){
      noArgs(arguments.length);if(disposed)return localSnapshot();
      disposed=true;
      for(const type of events)canvas.removeEventListener(type,guard,true);
      canvas.removeEventListener('click',canceledGestureClick,true);
      detach();canceledClick=false;touchAction=null;
      return localSnapshot();
    },
  };
}
