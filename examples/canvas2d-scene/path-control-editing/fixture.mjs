// @ts-check
import { createDisplayTree } from '@barocss/canvas2d';
export const OPTIONS={logicalSize:{width:480,height:320},dpr:2,backgroundColor:/** @type {import('@barocss/canvas2d').Color} */([0.1,0.12,0.16,1])};
export const VIEW={panX:12,panY:8,zoom:1.1};
const pose=(x=0,y=0)=>({x,y,scaleX:1,scaleY:1,rotation:0});
export function fixture(){const tree=createDisplayTree('PathControlEditor');const group=tree.createContainer({id:'Curves',layer:0,transform:{...pose(40,32),scaleX:1.2,rotation:Math.PI/12}});tree.stage.addChild(group);
 group.addChild(tree.createPath({id:'Quadratic',layer:0,transform:pose(0,16),commands:[{kind:'M',x:0,y:70},{kind:'Q',cx:45,cy:5,x:100,y:70},{kind:'L',x:100,y:100},{kind:'L',x:0,y:100},{kind:'Z'}],fill:{rule:'nonzero',color:[0,0.5,1,1]},stroke:{width:2,color:[1,1,1,1]}}));
 group.addChild(tree.createPath({id:'Cubic',layer:1,transform:pose(150,16),commands:[{kind:'M',x:0,y:60},{kind:'C',c1x:25,c1y:0,c2x:75,c2y:100,x:110,y:60},{kind:'L',x:110,y:120},{kind:'L',x:0,y:120},{kind:'Z'}],fill:{rule:'nonzero',color:[1,0.25,0.5,1]},stroke:{width:2,color:[1,1,1,1]}}));
 tree.stage.addChild(tree.createRect({id:'Marker',layer:1,transform:pose(350,200),width:60,height:40,fill:[0.25,1,0.25,1]}));return tree;}
