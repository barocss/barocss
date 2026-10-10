const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face keyboard framing: '+message);};
function callbacks(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'callbacks must be plain own data');
  const fields=['frameAll','frameParent','onError'],keys=Reflect.ownKeys(input),owned={};
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),'callbacks have missing or unsupported fields');
  for(const key of fields){const descriptor=Object.getOwnPropertyDescriptor(input,key);
    check(descriptor&&descriptor.enumerable&&'value'in descriptor&&typeof descriptor.value==='function',key+' must be an own callback function');
    owned[key]=descriptor.value;}
  return owned;
}

/** Frame the current original Faces from canvas-local F and Shift+F keys. */
export function createQualifiedFaceKeyboardFraming(viewer,canvas,options){
  const {frameAll,frameParent,onError}=callbacks(options);
  let disposed=false;
  function keydown(event){
    if(disposed||event.target!==canvas||event.repeat||event.isComposing||event.ctrlKey||event.altKey||event.metaKey
      ||event.key!=='f'&&event.key!=='F')return;
    try{
      const state=viewer.getState();
      check(state.status==='ready'&&state.qualifiedFaceScene,'an available current qualified Face view is required');
      if(event.shiftKey)frameParent();else frameAll();
      event.preventDefault();
    }catch(error){onError(error);}
  }
  canvas.addEventListener('keydown',keydown);
  return()=>{
    if(disposed)return;
    disposed=true;canvas.removeEventListener('keydown',keydown);
  };
}
