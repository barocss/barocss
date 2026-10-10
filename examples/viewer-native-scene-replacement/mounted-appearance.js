import {prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import {compileMeshMaterial,validateMeshMaterialIR} from '@barocss/gpu';

// Exact authored literals retained from mesh-material-cpu-probe.mjs and material-shorthand-flow.mjs.
export const MOUNTED_APPEARANCE_SHADER_SOURCES=Object.freeze([
  '@shader #wave { @uniform timeSeconds: float(0,2,0); @fragment { color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5); } }',
  '@shader #abc { @uniform amount:float(0,1,0.25); @fragment { color:mix(#aBc,#12f,clamp(amount,0,1)); } }',
]);
export const MOUNTED_APPEARANCE_LIGHT_PRESETS=Object.freeze({
  primary:Object.freeze({ambientStrength:.3,directionalStrength:.7,direction:Object.freeze([-.6,.8,1])}),
  alternate:Object.freeze({ambientStrength:.6,directionalStrength:.4,direction:Object.freeze([.3,1,-.4])}),
});
const clone=value=>structuredClone(value),check=(value,message)=>{if(!value)throw new RangeError('Mounted document appearance: '+message);};
const bodyIds=['body_0_curve','body_0_surface','body_1_surface'];
const refFor=entry=>entry.kind==='surface'?{kind:'surface',modelId:entry.ref.modelId,surfaceId:entry.ref.geometryId}
  :{kind:'curve',modelId:entry.ref.modelId,curveId:entry.ref.geometryId};

/** Build original document intent only. The Viewer method owns mounted eligibility and admission. */
export function buildMountedAppearanceInput(documentResult,settings){
  check(typeof settings.timeSeconds==='number'&&Number.isFinite(settings.timeSeconds)&&settings.timeSeconds>=0&&settings.timeSeconds<=2,'timeSeconds must be in0..2.');
  check(typeof settings.amount==='number'&&Number.isFinite(settings.amount)&&settings.amount>=0&&settings.amount<=1,'amount must be in0..1.');
  check(typeof settings.lightPreset==='string'&&Object.hasOwn(MOUNTED_APPEARANCE_LIGHT_PRESETS,settings.lightPreset),'Choose a current light preset.');
  const options={native:{sourceVersion:0,countU:5,countV:5,unitsPerMillimeter:1,
    curveDisplay:{version:1,chordToleranceMM:.02,maxSegments:512,maxDepth:16}},
    basis:'authored-xyz-matches-rhyup',bodyIds:[...bodyIds]};
  const projected=prepareBaroCadDocumentPrimitiveNativeRefsV2(documentResult,options);
  check(projected.length===3&&projected.filter(entry=>entry.kind==='surface').length===2&&projected.filter(entry=>entry.kind==='curve').length===1,'Original two Surfaces and Curve are required.');
  const surfaces=projected.filter(entry=>entry.kind==='surface'),refs=projected.map(refFor),contextId='mounted_document_appearance';
  const poses=projected.map(entry=>({targetId:entry.binding.bodyId,
    translation:entry.binding.bodyId==='body_0_curve'?[-8,6,0]:entry.binding.bodyId==='body_0_surface'?[-8,-6,0]:[8,-6,0],
    rotation:[0,0,0,1],scale:[1,1,1]}));
  const materials=MOUNTED_APPEARANCE_SHADER_SOURCES.map((source,index)=>{
    const compiled=compileMeshMaterial(source);check(compiled.ok,'Original shader source refused.');
    const material=validateMeshMaterialIR(compiled.material),ref=surfaces[index].ref;
    return{ref:{modelId:ref.modelId,surfaceId:ref.geometryId},binding:{material,
      uniforms:index===0?{timeSeconds:settings.timeSeconds}:{amount:settings.amount}}};
  });
  return{version:1,source:{kind:'document',result:clone(documentResult),options,bindings:projected.map(entry=>clone(entry.binding))},
    display:{motion:{basis:'part-xyz-matches-rhyup',frame:{contextId,timeSeconds:0,poses},
      bindings:projected.map((entry,index)=>({contextId,targetId:entry.binding.bodyId,ref:clone(refs[index])}))},
      visibleGeometry:refs.map(clone),camera:clone(settings.camera)},
    appearance:{lighting:clone(MOUNTED_APPEARANCE_LIGHT_PRESETS[settings.lightPreset]),materials}};
}
