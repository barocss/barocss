import { compileGeneratedAffineSceneSource } from '@barocss/gpu';

const SOURCE_PROFILE='4dcb0ebb67ac25f94a9f9e0b84d921f54ab468e8';
const WIDTH=320,HEIGHT=210,DPR=2;
const PROJECTION={x:'x + 0.45 * z',y:'y + 0.25 * z',origin:[160,132],pixelsPerSceneUnit:35,fit:'fixed; edited objects outside the viewport can be clipped'};
const EDGES=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
function appError(message){const error=new Error(message);error.name='GeneratedSceneDisplayError';return error;}
function transform(point,object){
  let [x,y,z]=point.map((value,index)=>value*object.scaleXYZ[index]);
  const [rx,ry,rz]=object.rotateDegrees.map(value=>value*Math.PI/180);
  let c=Math.cos(rx),s=Math.sin(rx);[y,z]=[y*c-z*s,y*s+z*c];
  c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];
  c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];
  return [x+object.translate[0],y+object.translate[1],z+object.translate[2]];
}
function project([x,y,z]){return [160+35*(x+.45*z),132-35*(y+.25*z)];}
function localBoxes(scene){
  return scene.objects.map(object=>{
    if(object.type!=='box'&&object.type!=='sphere')throw appError(`This application draws diagnostic boxes only for box and sphere; received ${object.type}. The public compiler may support this shape.`);
    const half=object.type==='box'?object.size.map(value=>value/2):[object.radius,object.radius,object.radius];
    const corners=Array.from({length:8},(_,index)=>transform(half.map((value,axis)=>(index&(1<<axis))?value:-value),object));
    const viewportCorners=corners.map(project);
    return {id:object.id,type:object.type,localHalfExtents:half,cornersScene:corners,viewportCorners,
      clipped:viewportCorners.some(([x,y])=>x<0||x>WIDTH||y<0||y>HEIGHT),color:[...object.color]};
  });
}
function checksum(data){let value=2166136261;for(const byte of data)value=Math.imul(value^byte,16777619)>>>0;return value.toString(16).padStart(8,'0');}
function bitmap(compiled,boxes){
  const stage=document.createElement('canvas');stage.width=WIDTH*DPR;stage.height=HEIGHT*DPR;
  const ctx=stage.getContext('2d');if(!ctx)throw appError('Application Canvas2D context unavailable.');
  ctx.scale(DPR,DPR);ctx.fillStyle='#101820';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.strokeStyle='#243b4d';ctx.lineWidth=.6;
  for(let x=20;x<WIDTH;x+=35){ctx.beginPath();ctx.moveTo(x,32);ctx.lineTo(x,HEIGHT-22);ctx.stroke();}
  for(let y=32;y<HEIGHT-22;y+=35){ctx.beginPath();ctx.moveTo(10,y);ctx.lineTo(WIDTH-10,y);ctx.stroke();}
  for(const box of boxes){
    ctx.strokeStyle=`rgb(${box.color.map(value=>Math.round(value*255)).join(',')})`;ctx.lineWidth=1.7;
    for(const [a,b] of EDGES){ctx.beginPath();ctx.moveTo(...box.viewportCorners[a]);ctx.lineTo(...box.viewportCorners[b]);ctx.stroke();}
    const center=project(transform([0,0,0],compiled.scene.objects.find(object=>object.id===box.id)));
    ctx.fillStyle=ctx.strokeStyle;ctx.font='10px monospace';ctx.fillText(box.id,center[0]+4,center[1]-6);
  }
  ctx.fillStyle='#d5e5ef';ctx.font='11px system-ui';ctx.fillText('APP diagnostic local boxes · shader not executed',10,18);
  ctx.fillStyle='#95acbd';ctx.font='10px system-ui';ctx.fillText(`${boxes.length} selected objects · fixed scene-unit projection`,10,HEIGHT-8);
  const image=ctx.getImageData(0,0,stage.width,stage.height);
  return {image,checksum:checksum(image.data)};
}
function replaceToken(compiled,token,replacement){
  const source=compiled.source,{start,end}=token.range;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>source.length||source.slice(start,end)!==token.text)throw appError('The public authored token no longer matches the accepted source.');
  return source.slice(0,start)+replacement+source.slice(end);
}

export function createExample(canvas,key,source){
  if(key!=='generated-scene')throw appError('Unknown generated scene example.');
  const context=canvas.getContext('2d');if(!context)throw appError('Application Canvas2D context unavailable.');
  let accepted,disposed=false,contextLost=false,frameCount=0;
  function live(){if(disposed)throw appError('Example disposed.');if(contextLost)throw appError('Application Canvas2D context lost; reset the example.');}
  function onContextLost(event){event.preventDefault();contextLost=true;}
  canvas.addEventListener('contextlost',onContextLost);
  function report(){
    if(!accepted)throw appError('No accepted scene.');
    return structuredClone({backend:'Application Canvas2D diagnostic local boxes',sourceProfile:SOURCE_PROFILE,
      ...accepted.compiled,objectCount:accepted.compiled.scene.objects.length,selectedIds:accepted.compiled.scene.objects.map(object=>object.id),
      display:{representation:'Transformed local diagnostic boxes, not primitive geometry or public bounds',
        sphere:'Local cube from ±radius; not a sphere tessellation',box:'Local box from half the full size',
        transformOrder:'scaleXYZ, right-handed X then Y then Z rotations in degrees, then translation',
        projection:PROJECTION,boxes:accepted.boxes,edgesPerBox:12,cornersPerBox:8,clippedIds:accepted.boxes.filter(box=>box.clipped).map(box=>box.id),
        shaderText:'Derived public shader text retained above; not executed',color:'Application CSS colors from resolved RGB; no renderer parity claim'},
      logicalSize:{width:WIDTH,height:HEIGHT},backingSize:{width:WIDTH*DPR,height:HEIGHT*DPR},dpr:DPR,
      frame:{rgbaBytes:accepted.image.data.length,fnv1a32:accepted.checksum,scope:'Staged application bitmap adopted on this canvas'},
      frameCount,actualGL:false,prepareSourceSceneBoundsCalls:0,available:!disposed&&!contextLost});
  }
  function update(text){
    live();
    const compiled=compileGeneratedAffineSceneSource(text);
    const boxes=localBoxes(compiled.scene),candidate=bitmap(compiled,boxes);
    live();
    if(canvas.width!==WIDTH*DPR)canvas.width=WIDTH*DPR;
    if(canvas.height!==HEIGHT*DPR)canvas.height=HEIGHT*DPR;
    try{context.putImageData(candidate.image,0,0);}
    catch(error){if(accepted&&!contextLost){try{context.putImageData(accepted.image,0,0);}catch{contextLost=true;}}throw error;}
    accepted={compiled,boxes,...candidate};frameCount++;
    return report();
  }
  function action(id){
    live();if(!accepted)throw appError('No accepted scene.');
    const declarations=accepted.compiled.ast.declarations;
    let token,replacement;
    if(id==='exclude-marker'||id==='include-marker'){
      const parameter=declarations.find(item=>item.kind==='parameter'&&item.name.text==='used');
      if(!parameter||parameter.quantity.text!=='length')throw appError('This action requires the authored used length parameter.');
      token=parameter.literal;replacement=id==='exclude-marker'?'3scene':'2scene';
    }else if(id==='add-stud'){
      const repeat=declarations.find(item=>item.kind==='repeat'&&item.prefix.text==='studs');
      if(!repeat||repeat.type.text!=='sphere')throw appError('This action requires the authored studs sphere repeat.');
      token=repeat.count;replacement='3';
    }else throw appError(`Unknown application action: ${id}`);
    const candidateSource=replaceToken(accepted.compiled,token,replacement);
    const next=update(candidateSource);return {report:next,acceptedSource:accepted.compiled.source};
  }
  function dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('contextlost',onContextLost);}
  try{update(source);}catch(error){dispose();throw error;}
  return {update,report,action,dispose};
}
