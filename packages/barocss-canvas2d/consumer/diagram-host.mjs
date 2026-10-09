// @ts-check
// A fixed diagram host policy, composed from public display handles.
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
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
