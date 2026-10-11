// @ts-check
import {createDisplayTree} from '@barocss/canvas2d';
export const OPTIONS={logicalSize:{width:480,height:320},dpr:2};
export const VIEW={panX:12,panY:8,zoom:1.1};
export const ASSET={width:1,height:1,pixels:new Uint8Array([0,255,255,255])};
export const pose=(/** @type {number} */x=0,/** @type {number} */y=0)=>({x,y,scaleX:1,scaleY:1,rotation:0});
export function fixture(){const t=createDisplayTree('PointerPathCreation');t.stage.addChild(t.createRect({id:'Back',layer:-10,transform:pose(),width:480,height:320,fill:[26/255,31/255,41/255,1]}));const parent=t.createContainer({id:'Parent',layer:0,transform:{...pose(40,32),scaleX:1.2,scaleY:1.1,rotation:Math.PI/12}});t.stage.addChild(parent);parent.addChild(t.createRect({id:'Marker',layer:10,transform:pose(260,60),width:16,height:16,fill:[64/255,1,64/255,1]}));parent.addChild(t.createSprite({id:'StableSprite',layer:10,transform:pose(260,95),imageId:'StableCyan',width:24,height:24,opacity:1,sampling:'nearest',anchorX:0,anchorY:0}));return t;}
