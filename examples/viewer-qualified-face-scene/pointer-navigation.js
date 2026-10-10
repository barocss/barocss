const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face pointer navigation: '+message);};
function callbacks(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'callbacks must be plain own data');
  const fields=['onViewChange','onError'],keys=Reflect.ownKeys(input),owned={};
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),'callbacks have missing or unsupported fields');
  for(const key of fields){const descriptor=Object.getOwnPropertyDescriptor(input,key);
    check(descriptor&&descriptor.enumerable&&'value'in descriptor&&typeof descriptor.value==='function',key+' must be an own callback function');
    owned[key]=descriptor.value;}
  return owned;
}
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a),other=Object.keys(b);
  return keys.length===other.length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
}

/** Opt-in public pointer controls for the current qualified Face view. */
export function createQualifiedFacePointerNavigation(viewer,canvas,options){
  const {onViewChange,onError}=callbacks(options);
  let enabled=false,disposed=false,adapter=null,bindingScope=null,latestCamera=null,changingBinding=false;
  let gesture=null,canceledClick=false,touchAction=null,touchOverridden=false;
  const guardedEvents=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','wheel'];
  const observedEvents=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','wheel'];
  const snapshot=()=>({enabled,attached:!!adapter,disposed,status:viewer.getState().status});
  const restoreTouchAction=()=>{
    if(!touchOverridden)return;
    if(touchAction.value)canvas.style.setProperty('touch-action',touchAction.value,touchAction.priority);
    else canvas.style.removeProperty('touch-action');
    touchOverridden=false;
  };
  const removeObservers=()=>{for(const type of observedEvents)canvas.removeEventListener(type,observe);};
  const detach=()=>{
    if(gesture?.dragged)canceledClick=true;
    gesture=null;removeObservers();
    const old=adapter;adapter=null;bindingScope=null;
    old?.dispose();restoreTouchAction();
  };
  const scope=state=>{
    const scene=structuredClone(state.qualifiedFaceScene);delete scene.camera;
    const rect=canvas.getBoundingClientRect();
    return JSON.stringify({scene,width:canvas.width,height:canvas.height,
      css:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}});
  };
  function sync(){
    if(disposed||changingBinding)return snapshot();
    const state=viewer.getState(),eligible=enabled&&state.status==='ready'&&!!state.qualifiedFaceScene;
    latestCamera=structuredClone(state.camera);
    const currentScope=eligible?scope(state):null;
    if(!eligible||adapter&&bindingScope!==currentScope){
      changingBinding=true;try{detach();}finally{changingBinding=false;}
    }
    if(eligible&&!adapter){
      changingBinding=true;
      try{
        adapter=viewer.attachPointerControls({onError:error=>{sync();onError(error);}});
        bindingScope=currentScope;
        canvas.style.setProperty('touch-action','none',touchAction.priority);touchOverridden=true;
        // Rebind observers after every new public adapter to retain accepted-motion ordering.
        removeObservers();for(const type of observedEvents)canvas.addEventListener(type,observe);
      }finally{changingBinding=false;}
    }
    return snapshot();
  }
  function guard(event){
    if(disposed||changingBinding)return;
    if(gesture&&event.pointerId===gesture.id&&['pointermove','pointerup'].includes(event.type)
      &&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY))
      gesture.dragged ||= Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>3;
    sync();
    if(event.type==='pointerdown')canceledClick=false;
  }
  function observe(event){
    if(disposed||changingBinding||!adapter)return;
    if(event.type==='pointerdown'&&!gesture&&event.isPrimary&&event.button===0&&canvas.hasPointerCapture(event.pointerId))
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dragged:false};
    if(gesture&&event.pointerId===gesture.id&&['pointerup','pointercancel','lostpointercapture'].includes(event.type))gesture=null;
    if(!['pointermove','pointerup','wheel'].includes(event.type))return;
    const camera=viewer.getState().camera;
    if(same(latestCamera,camera))return;
    latestCamera=structuredClone(camera);
    onViewChange();
  }
  function canceledGestureClick(event){
    if(!canceledClick)return;
    canceledClick=false;event.preventDefault();event.stopImmediatePropagation();
  }
  for(const type of guardedEvents)canvas.addEventListener(type,guard,{capture:true,passive:false});
  canvas.addEventListener('click',canceledGestureClick,true);
  return{
    setEnabled(value){
      check(!disposed,'controller is disposed');check(typeof value==='boolean','enabled must be an explicit boolean');
      if(value&&!enabled)touchAction={value:canvas.style.getPropertyValue('touch-action'),priority:canvas.style.getPropertyPriority('touch-action')};
      enabled=value;const state=sync();if(!enabled)touchAction=null;return state;
    },
    sync,snapshot,
    dispose(){
      if(disposed)return;
      disposed=true;
      for(const type of guardedEvents)canvas.removeEventListener(type,guard,true);
      canvas.removeEventListener('click',canceledGestureClick,true);
      detach();canceledClick=false;touchAction=null;
    },
  };
}
