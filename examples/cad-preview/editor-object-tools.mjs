import * as cad from '/cad.js';
import {pickDisplayObject} from './editor-interaction.mjs';
import {screenRay} from './screen-ray.mjs';
import * as gpu from '/gpu.js';

export function addNativeObject(kind,native,x){
 const document=native.document,ids=new Set();
 function collect(value){if(typeof value==='string')ids.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}collect(native);
 let number=1;while([...ids].some(id=>id.startsWith('object_'+number+'_')))number++;
 const prefix='object_'+number+'_',profileId=prefix+'profile',featureId=prefix+'feature',parameterId=prefix+'height';
 const parameter={id:parameterId,type:'length',definition:{kind:'literal',valueMM:6}};
 if(kind==='rectangle'){
  const profile={id:profileId,kind:'rectangle',originMM:[Math.round(x),0],widthMM:4,heightMM:3,cornerIds:[0,1,2,3].map(i=>prefix+'corner_'+i)},feature={id:featureId,kind:'axis-rectangle-extrude',profileId,bodyId:prefix+'body',distanceParameterId:parameterId,suppressed:false};
  return{featureId,native:cad.editSketchRectangleFeatureGraphParameters(document,{parameterOperations:[{kind:'upsert',parameter}],featureOperations:[{kind:'upsert',feature}],sketchEdits:[{kind:'upsert',profile}]})};
 }
 const driven=kind==='driven-circle',profile={id:profileId,kind:'circle',centerId:prefix+'center',centerMM:[x,0],radius:{id:prefix+'radius',...(driven?{definition:{kind:'literal',valueMM:3}}:{valueMM:3})},seamId:prefix+'seam'},feature={id:featureId,kind:'xy-circle-extrude',profileId,shellId:prefix+'shell',distanceParameterId:parameterId,suppressed:false};
 const edits={parameterOperations:[{kind:'upsert',parameter}],featureOperations:[{kind:'upsert',feature}]};
 return{featureId,native:driven?cad.editDrivenSketchCircleFeatureGraphProfiles(document,{...edits,profileOperations:[{kind:'upsert',profile}]}):cad.editSketchCircleFeatureGraphParameters(document,{...edits,sketchEdits:[{kind:'upsert',profile}]})};
}
export function bindObjectMovement(viewport,read,onStatus){
 let drag,frame,latest;
 function point(current,x,y){const ray=screenRay(current.canvas,current.renderer.options,x,y,gpu).query;if(Math.abs(ray.direction[2])<1e-8)throw Error('Use an oblique view to move on the XY plane');const t=-ray.originMM[2]/ray.direction[2];if(t<0||t>ray.maxDistanceMM)throw Error('XY workplane is outside the camera range');return ray.originMM.slice(0,2).map((n,i)=>n+t*ray.direction[i]);}
 viewport.addEventListener('pointerdown',event=>{
  let current=read();if(current.mode!=='move'||event.button!==0||event.pointerType!=='mouse'||!current.editor?.position)return;
  if(current.pending){onStatus('Apply or discard the draft before moving the object.');return;}
  try{const hit=pickDisplayObject(current.canvas,current.renderer,current.objects,event.clientX,event.clientY);if(!hit)return;current.select(hit.id);current=read();drag={id:event.pointerId,start:point(current,event.clientX,event.clientY),position:current.editor.position,editor:current.editor};event.preventDefault();}catch(error){onStatus(error.message);}
 });
 function commit(){frame=null;if(!drag||!latest)return;try{const current=read(),p=point(current,...latest),next=p.map((n,i)=>drag.position[i]+n-drag.start[i]),result=drag.editor.moveTo(next);if(!result.ok){onStatus('Move rejected. '+(result.error?.message??result.error??'Native candidate retained.'));drag=null;}}catch(error){onStatus('Move rejected: '+error.message);drag=null;}}
 const view=viewport.ownerDocument.defaultView;
 view.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;latest=[event.clientX,event.clientY];if(!frame)frame=view.requestAnimationFrame(commit);event.preventDefault();});
 function end(event){if(drag&&(!event||event.pointerId===drag.id)){if(frame)view.cancelAnimationFrame(frame);commit();drag=null;latest=null;}}
 view.addEventListener('pointerup',end);view.addEventListener('pointercancel',()=>{drag=null;latest=null;if(frame)view.cancelAnimationFrame(frame);frame=null;});view.addEventListener('blur',()=>end());
}

export function selectedLengths(prefix,draft,selected){
 const feature=draft.features.find(f=>f.id===selected),profile=draft.sketch.profiles.find(p=>p.id===feature?.profileId),used=new Set();
 function visit(id){if(!id||used.has(id))return;used.add(id);const parameter=draft.parameters.find(p=>p.id===id);if(parameter?.definition.kind==='offset')visit(parameter.definition.parameterId);}
 visit(feature?.distanceParameterId);if(profile?.radius?.definition?.kind==='parameter')visit(profile.radius.definition.parameterId);
 const root=document.getElementById(prefix+'-parameters');for(const box of root.children){const id=box.querySelector('[id^="'+prefix+'-kind-"]')?.id.slice((prefix+'-kind-').length);box.hidden=!used.has(id);}
 const selectedPanel=document.getElementById(prefix+'-selected'),parameter=draft.parameters.find(p=>p.id===feature?.distanceParameterId);
 if(parameter){const label=document.createElement('label');label.textContent=parameter.definition.kind==='literal'?'Height · mm':'Height offset · mm (shared dependency)';const input=document.createElement('input');input.id=prefix+'-selected-height';input.type='number';input.step='any';input.value=String(parameter.definition.kind==='literal'?parameter.definition.valueMM:parameter.definition.offsetMM);input.addEventListener('input',()=>{const original=document.getElementById(prefix+'-value-'+parameter.id);original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));});label.append(input);selectedPanel.append(label);}
 const shared=document.createElement('p');shared.className='editor-shared-note';shared.textContent='Profile and height references stay linked. Shared inputs affect their references.';selectedPanel.append(shared);
}
