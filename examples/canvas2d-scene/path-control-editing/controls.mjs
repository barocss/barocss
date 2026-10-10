// @ts-check
import { Canvas2DError, createDisplayTreeFromScene } from '@barocss/canvas2d';
/** @typedef {{id:string,index:number,slot:'q'|'c1'|'c2'}} Target */
/** @param {import('@barocss/canvas2d').DisplayTree} tree @param {Target} target */
export function control(tree,target){const path=tree.get(target.id);if(path?.kind!=='path'||!Number.isInteger(target.index))throw new Canvas2DError('INVALID_SCENE','Path control target missing');const command=path.data.commands[target.index];
 if(target.slot==='q'&&command?.kind==='Q')return {path,point:{x:command.cx,y:command.cy}};
 if(target.slot==='c1'&&command?.kind==='C')return {path,point:{x:command.c1x,y:command.c1y}};
 if(target.slot==='c2'&&command?.kind==='C')return {path,point:{x:command.c2x,y:command.c2y}};
 throw new Canvas2DError('INVALID_SCENE','Command does not have the requested control');}
/** @param {unknown} scene @param {Target} target @param {import('@barocss/canvas2d').Point} point */
export function candidate(scene,target,point){if(!point||typeof point.x!=='number'||typeof point.y!=='number'||!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>1e6||Math.abs(point.y)>1e6)throw new Canvas2DError('INVALID_SCENE','Control coordinates must be finite within ±1000000');
 const tree=createDisplayTreeFromScene(scene),found=control(tree,target),data=found.path.data,commands=structuredClone(data.commands),command=commands[target.index];
 if(target.slot==='q'&&command.kind==='Q'){command.cx=point.x;command.cy=point.y;}else if(target.slot==='c1'&&command.kind==='C'){command.c1x=point.x;command.c1y=point.y;}else if(target.slot==='c2'&&command.kind==='C'){command.c2x=point.x;command.c2y=point.y;}else throw new Canvas2DError('INVALID_SCENE','Control slot mismatch');
 found.path.setPath({commands,...(data.fill?{fill:data.fill}:{}),...(data.stroke?{stroke:data.stroke}:{})});return tree;}
/** @param {{clientX:number,clientY:number}} event @param {{left:number,top:number,width:number,height:number}} rect @param {{width:number,height:number}} backing @param {number} dpr @param {Pick<import('@barocss/canvas2d').Canvas2DRenderer,'viewportToWorld'>} renderer @param {import('@barocss/canvas2d').PathHandle} path */
export function localPoint(event,rect,backing,dpr,renderer,path){if(rect.width<=0||rect.height<=0||!Number.isFinite(dpr)||dpr<=0)throw new Canvas2DError('SCENE_LIMIT','Viewport cannot be mapped');const viewport={x:(event.clientX-rect.left)*backing.width/rect.width/dpr,y:(event.clientY-rect.top)*backing.height/rect.height/dpr};return path.toLocal(renderer.viewportToWorld(viewport));}
/** @param {Pick<import('@barocss/canvas2d').Canvas2DRenderer,'viewportToWorld'>} renderer */
export function viewBasis(renderer){return [[0,0],[1,0],[0,1]].map(([x,y])=>renderer.viewportToWorld({x,y}));}

/** @typedef {{id:string,index:number}} AnchorTarget */
/** @param {import('@barocss/canvas2d').DisplayTree} tree @param {AnchorTarget} target */
export function anchorControl(tree,target){const path=tree.get(target.id);if(path?.kind!=='path'||!Number.isInteger(target.index))throw new Canvas2DError('INVALID_SCENE','Anchor path missing');const command=path.data.commands[target.index];if(!command||command.kind==='M'||command.kind==='Z')throw new Canvas2DError('INVALID_SCENE','Anchor must end L/Q/C');return{path,point:{x:command.x,y:command.y}};}
/** @param {unknown} scene @param {AnchorTarget} target @param {import('@barocss/canvas2d').Point} point */
export function anchorCandidate(scene,target,point){if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>1e6||Math.abs(point.y)>1e6)throw new Canvas2DError('INVALID_SCENE','Anchor coordinates must be finite');const tree=createDisplayTreeFromScene(scene),found=anchorControl(tree,target),data=found.path.data,commands=structuredClone(data.commands),command=commands[target.index];if(command.kind==='M'||command.kind==='Z')throw new Canvas2DError('INVALID_SCENE','Anchor command missing');command.x=point.x;command.y=point.y;found.path.setPath({commands,...(data.fill?{fill:data.fill}:{}),...(data.stroke?{stroke:data.stroke}:{})});return tree;}
