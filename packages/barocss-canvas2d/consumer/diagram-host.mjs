// @ts-check
// A fixed diagram host policy, composed from public display handles.
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, rasterizeBrowserText as browserRaster } from '@barocss/canvas2d';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {'A'|'B'} Key */
/** @typedef {'H'|'I'} Label */
/** @typedef {{tree:import('@barocss/canvas2d').DisplayTree,frame:import('@barocss/canvas2d').FrameHandle,
 * nodes:Record<Key,import('@barocss/canvas2d').ContainerHandle>,boxes:Record<Key,import('@barocss/canvas2d').RectHandle>,
 * labels:Record<Key,import('@barocss/canvas2d').GlyphRunHandle>,connector:import('@barocss/canvas2d').PathHandle}} Bundle */
export class DiagramHostError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code,message) {super(message);this.name='DiagramHostError';this.code=code;}
}
/** @param {Point} point */
export function validatePosition(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x)>500 || Math.abs(point.y)>500) {
    throw new DiagramHostError('HOST_POSITION','Node coordinates must be finite and within -500..500');
  }
  return {x:point.x,y:point.y};
}
/** @param {unknown} asset @returns {import('@barocss/canvas2d').ImageAssetInput} */
export function copyDiagramAsset(asset) {
  const value=/** @type {import('@barocss/canvas2d').ImageAssetInput} */(asset);
  if (!value || value.width!==16 || value.height!==12 || !(value.pixels instanceof Uint8Array) || value.pixels.length!==768) {
    throw new DiagramHostError('HOST_DIAGRAM','DiagramAtlas must be a 16x12 RGBA8 asset');
  }
  const pixels=new Uint8Array(value.pixels);
  if (!pixels.some((byte,index)=>index%4===3 && byte!==0)) throw new DiagramHostError('HOST_DIAGRAM','DiagramAtlas has no ink');
  return {width:16,height:12,pixels};
}
export function atlasAsset() {
  const pixels=new Uint8Array(768);
  for (let y=1;y<=10;y++) for (let x=1;x<=6;x++) {
    for (const [offset,ink] of [[0,x===1 || x===6 || y===5 || y===6],[8,y===1 || y===10 || x===3 || x===4]]) {
      if (ink) pixels.fill(255,((y*16)+x+Number(offset))*4,((y*16)+x+Number(offset))*4+4);
    }
  }
  return {width:16,height:12,pixels};
}
const pose=(/** @type {number} */x=0,/** @type {number} */y=0)=>({x,y,scaleX:1,scaleY:1,rotation:0});
/** @param {Label} label @returns {import('@barocss/canvas2d').GlyphRunLayout} */
function layout(label) {
  if (label!=='H' && label!=='I') throw new DiagramHostError('HOST_DIAGRAM','Only H and I labels are admitted');
  return {atlasId:'DiagramAtlas',text:label,baseline:0,opacity:1,sampling:'nearest',glyphs:[{
    sourceRect:{x:label==='H'?0:8,y:0,width:8,height:12},x:0,y:0,width:16,height:24,textStart:0,textEnd:1}]};
}
/** @param {Bundle} bundle @param {Key} key @param {Label} label */
export function setLabel(bundle,key,label) {
  if (key!=='A' && key!=='B') throw new DiagramHostError('HOST_DIAGRAM','Unknown diagram node');
  bundle.labels[key].setLayout(layout(label));
}
/** @param {Bundle} bundle */
export function updateConnector(bundle) {
  const a=bundle.frame.toLocal(bundle.nodes.A.toWorld({x:45,y:25}));
  const b=bundle.frame.toLocal(bundle.nodes.B.toWorld({x:45,y:25}));
  bundle.connector.setPath({commands:[{kind:'M',...a},{kind:'L',...b}],stroke:{width:3,color:[1,.8,0,1]}});
}
/** @returns {Bundle} */
export function makeDiagram() {
  const tree=createDisplayTree('GlyphDiagramConsumer');
  tree.stage.addChild(tree.createRect({id:'Back',layer:0,transform:pose(),width:360,height:240,fill:[.1,.12,.16,1]}));
  const frame=tree.createFrame({id:'DiagramFrame',layer:1,transform:{...pose(50,30),rotation:.08},
    width:260,height:170,fill:[.94,.96,.98,1],clip:true});tree.stage.addChild(frame);
  const connector=tree.createPath({id:'Connector',layer:0,transform:pose(),
    commands:[{kind:'M',x:70,y:65},{kind:'L',x:195,y:110}],stroke:{width:3,color:[1,.8,0,1]}});frame.addChild(connector);
  const makeNode=(/** @type {Key} */key,/** @type {number} */x,/** @type {number} */y,/** @type {number} */layer,
    /** @type {import('@barocss/canvas2d').Color} */fill,/** @type {Label} */label)=>{
    const node=tree.createContainer({id:`Node${key}`,layer,transform:pose(x,y)});frame.addChild(node);
    const box=tree.createRect({id:`Box${key}`,layer:0,transform:pose(),width:90,height:50,fill});node.addChild(box);
    const glyph=tree.createGlyphRun({id:`Label${key}`,layer:1,transform:pose(12,12),...layout(label)});node.addChild(glyph);
    return {node,box,glyph};
  };
  const a=makeNode('A',25,40,1,[.8,.2,.2,1],'H'),b=makeNode('B',150,85,2,[.2,.4,.8,1],'I');
  const bundle={tree,frame,connector,nodes:{A:a.node,B:b.node},boxes:{A:a.box,B:b.box},labels:{A:a.glyph,B:b.glyph}};
  updateConnector(bundle);return bundle;
}
/** @param {unknown} scene @returns {Bundle} */
export function readDiagram(scene) {
  const tree=createDisplayTreeFromScene(scene),frame=tree.get('DiagramFrame'),connector=tree.get('Connector');
  const a=tree.get('NodeA'),b=tree.get('NodeB'),ba=tree.get('BoxA'),bb=tree.get('BoxB'),la=tree.get('LabelA'),lb=tree.get('LabelB');
  if (frame?.kind!=='frame' || connector?.kind!=='path' || a?.kind!=='container' || b?.kind!=='container' ||
      ba?.kind!=='rect' || bb?.kind!=='rect' || la?.kind!=='glyphRun' || lb?.kind!=='glyphRun') {
    throw new DiagramHostError('HOST_DIAGRAM','Diagram topology is missing');
  }
  const bundle=/** @type {Bundle} */({tree,frame,connector,nodes:{A:a,B:b},boxes:{A:ba,B:bb},labels:{A:la,B:lb}});
  const expected=makeDiagram();
  for (const key of /** @type {const} */(['A','B'])) {
    const transform=bundle.nodes[key].data.transform,point=validatePosition(transform);
    expected.nodes[key].setPosition(point.x,point.y);
    setLabel(expected,key,/** @type {Label} */(bundle.labels[key].data.text));
  }
  updateConnector(expected);
  const actual=connector.data.commands,derived=expected.connector.data.commands;
  if (actual.length!==2 || actual[0].kind!=='M' || actual[1].kind!=='L' || actual.some((command,index)=>{
    const p=/** @type {Point} */(command),q=/** @type {Point} */(derived[index]);
    return Math.abs(p.x-q.x)>1e-10 || Math.abs(p.y-q.y)>1e-10;
  })) throw new DiagramHostError('HOST_DIAGRAM','Connector does not join the node centers');
  // Preserve admitted bytes after checking derived centers; conversion can round a few low bits.
  expected.connector.setPath({commands:actual,stroke:expected.connector.data.stroke});
  if (stringifySceneJSON(tree.snapshot())!==stringifySceneJSON(expected.tree.snapshot())) {
    throw new DiagramHostError('HOST_DIAGRAM','Diagram fields or topology differ from the fixed host policy');
  }
  return bundle;
}

/** Browser labels are an opt-in host policy; the fixed H/I policy above is unchanged. */
export const browserLabelIds={A:'DiagramLabelAAtlas',B:'DiagramLabelBAtlas'};
/** @param {unknown} key @param {unknown} text @returns {{key:Key,text:string}} */
export function validateBrowserLabel(key,text){
  if((key!=='A'&&key!=='B')||typeof text!=='string'||text.length<1||text.length>32||! /\S/u.test(text)||/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u.test(text))throw new DiagramHostError('HOST_LABEL','Use one nonblank label of at most 32 UTF16 units');
  for(let i=0;i<text.length;i++){const a=text.charCodeAt(i);if(a>=0xD800&&a<=0xDBFF){const b=text.charCodeAt(++i);if(!(b>=0xDC00&&b<=0xDFFF))throw new DiagramHostError('HOST_LABEL','Label has an unpaired surrogate');}else if(a>=0xDC00&&a<=0xDFFF)throw new DiagramHostError('HOST_LABEL','Label has an unpaired surrogate');}
  return{key,text};
}
/** @param {Key} key @param {import('@barocss/canvas2d').GlyphRunLayout} layout @param {import('@barocss/canvas2d').ImageAssetInput} asset */
export function admitBrowserLabel(key,layout,asset){
  validateBrowserLabel(key,layout.text);const q=layout.glyphs[0];
  if(layout.atlasId!==browserLabelIds[key]||layout.baseline!==0||layout.opacity!==1||layout.sampling!=='nearest'||layout.glyphs.length!==1||!q||q.textStart!==0||q.textEnd!==layout.text.length||q.sourceRect.x!==0||q.sourceRect.y!==0||q.sourceRect.width!==asset.width||q.sourceRect.height!==asset.height||q.width!==asset.width/2||q.height!==asset.height/2||![q.x,q.y,q.width,q.height].every(Number.isFinite)||q.width<=0||q.height<=0||q.width>66||q.height>26)throw new DiagramHostError('HOST_LABEL_BOUNDS','Label must fit the box interior');
}
/** @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} assets */
export function copyBrowserLabelAssets(assets){
  if(!(assets instanceof Map)||assets.size!==2)throw new DiagramHostError('HOST_DIAGRAM','Two label assets are required');
  /** @type {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */const copied=new Map();
  for(const id of Object.values(browserLabelIds)){const a=assets.get(id);if(!a||Object.getPrototypeOf(a)!==Object.prototype)throw new DiagramHostError('HOST_DIAGRAM','Missing ordinary label asset');const d=Object.getOwnPropertyDescriptors(a);if(Reflect.ownKeys(d).length!==3||['width','height','pixels'].some(k=>!d[k]?.enumerable||!('value'in d[k])))throw new DiagramHostError('HOST_DIAGRAM','Label assets require data fields');const w=d.width.value,h=d.height.value,p=d.pixels.value;
    if(typeof w!=='number'||typeof h!=='number'||!Number.isInteger(w)||w<1||w>132||!Number.isInteger(h)||h<1||h>52||!(p instanceof Uint8Array)||Object.getPrototypeOf(p)!==Uint8Array.prototype||['buffer','byteOffset','byteLength','length'].some(k=>Object.hasOwn(p,k))||!(p.buffer instanceof ArrayBuffer)||p.byteOffset!==0||p.byteLength!==w*h*4||p.buffer.byteLength!==p.byteLength)throw new DiagramHostError('HOST_DIAGRAM','Label asset extent differs');copied.set(id,{width:w,height:h,pixels:new Uint8Array(p)});
  }return copied;
}
/** @param {Bundle} bundle @param {Key} key @param {import('@barocss/canvas2d').GlyphRunLayout} layout */
export function setBrowserLabel(bundle,key,layout){const q=layout.glyphs[0];bundle.labels[key].setLayout(layout);bundle.labels[key].setPosition(12-q.x,12-q.y);}
/** @param {Record<Key,import('@barocss/canvas2d').GlyphRunLayout>} layouts @returns {Bundle} */
export function makeBrowserDiagram(layouts){const scene=makeDiagram().tree.snapshot();const bundle=diagramBundle({...scene,contextId:'BrowserGlyphDiagramConsumer'});for(const key of /** @type {const} */(['A','B']))setBrowserLabel(bundle,key,layouts[key]);return bundle;}
/** @param {unknown} scene @returns {Bundle} */
function diagramBundle(scene){const tree=createDisplayTreeFromScene(scene);const handles=['DiagramFrame','Connector','NodeA','NodeB','BoxA','BoxB','LabelA','LabelB'].map(id=>tree.get(id));if(handles.some((h,i)=>!h||h.kind!==['frame','path','container','container','rect','rect','glyphRun','glyphRun'][i])||tree.get('Back')?.kind!=='rect')throw new DiagramHostError('HOST_DIAGRAM','Diagram topology missing');return /** @type {Bundle} */({tree,frame:handles[0],connector:handles[1],nodes:{A:handles[2],B:handles[3]},boxes:{A:handles[4],B:handles[5]},labels:{A:handles[6],B:handles[7]}});}
/** @param {unknown} scene @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} assets @returns {Bundle} */
export function readBrowserDiagram(scene,assets){const bundle=diagramBundle(scene),snapshot=bundle.tree.snapshot();if(snapshot.contextId!=='BrowserGlyphDiagramConsumer'||snapshot.version!==29)throw new DiagramHostError('HOST_DIAGRAM','Wrong browser diagram context');
  /** @type {Record<Key,import('@barocss/canvas2d').GlyphRunLayout>} */const layouts=/** @type {any} */({});
  for(const k of /** @type {const} */(['A','B'])){const g=bundle.labels[k];if(g.kind!=='glyphRun'||bundle.nodes[k].kind!=='container'||bundle.boxes[k].kind!=='rect')throw new DiagramHostError('HOST_DIAGRAM','Wrong diagram kinds');const d=g.data,a=assets.get(browserLabelIds[k]);if(!a)throw new DiagramHostError('HOST_DIAGRAM','Missing label asset');layouts[k]={atlasId:d.atlasId,text:d.text,baseline:d.baseline,opacity:d.opacity,sampling:d.sampling,glyphs:d.glyphs};admitBrowserLabel(k,layouts[k],a);}
  const expected=makeBrowserDiagram(layouts);for(const k of /** @type {const} */(['A','B'])){const p=validatePosition(bundle.nodes[k].data.transform);expected.nodes[k].setPosition(p.x,p.y);}updateConnector(expected);
  const actual=bundle.connector.data.commands,derived=expected.connector.data.commands;if(actual.length!==2||actual.some((v,i)=>v.kind!==derived[i].kind||Math.abs(/** @type {Point} */(v).x-/** @type {Point} */(derived[i]).x)>1e-10||Math.abs(/** @type {Point} */(v).y-/** @type {Point} */(derived[i]).y)>1e-10))throw new DiagramHostError('HOST_DIAGRAM','Connector centers differ');expected.connector.setPath({commands:actual,stroke:expected.connector.data.stroke});
  if(stringifySceneJSON(snapshot)!==stringifySceneJSON(expected.tree.snapshot()))throw new DiagramHostError('HOST_DIAGRAM','Browser diagram fields/order/topology differ');return bundle;
}
export class BrowserLabelGate{
  generation=0;disposed=false;drag=false;
/** @type {object|null} */session=null;
  begin(){return ++this.generation;}
  startDrag(){++this.generation;this.drag=true;}
  /** @param {number} token @param {object|null} session */valid(token,session){return !this.disposed&&!this.drag&&this.generation===token&&this.session===session;}
}
/** @param {Key} key @param {string} text @param {()=>boolean} current @param {number} [timeoutMS] @param {()=>void} [onPrepare] */
export async function prepareBrowserLabel(key,text,current,timeoutMS=5000,onPrepare=()=>{}){const admitted=validateBrowserLabel(key,text);
/** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
  try{const fonts=document.fonts;if(!fonts||typeof fonts.load!=='function'||typeof fonts.check!=='function')throw new DiagramHostError('HOST_FONT','Browser font APIs unavailable');
    const ready=(async()=>{await fonts.ready;if(!current())return false;await fonts.load('16px system-ui',admitted.text);if(!current())return false;if(!fonts.check('16px system-ui',admitted.text))throw new DiagramHostError('HOST_FONT','Font is not ready');return true;})();
    const ok=await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DiagramHostError('HOST_FONT_TIMEOUT','Font readiness exceeded 5s')),timeoutMS);})]);if(!ok||!current())return null;
    onPrepare();const prepared=browserRaster({text:admitted.text,font:'16px system-ui',atlasId:browserLabelIds[key],dpr:2,textPolicy:'unicode-single-line'});admitBrowserLabel(key,prepared.layout,prepared.asset);return prepared;
  }finally{clearTimeout(timer);}}
