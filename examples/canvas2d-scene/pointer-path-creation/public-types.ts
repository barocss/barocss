import type {Scene} from '../../../packages/barocss-canvas2d/src/index.js';
/** TYPEONLY view of unchanged example CPU history; runtime alias is the existing mjs provider. */
export declare class SceneHistory {
 constructor(renderer:{updateScene(value:unknown):void;render():void},initial:Scene,limit?:number);
 readonly scene:Scene;readonly position:number;readonly length:number;readonly canUndo:boolean;readonly canRedo:boolean;
 commit(edit:(scene:Scene)=>void):Scene;preview(edit:(scene:Scene)=>void):Scene;undo():Scene;redo():Scene;restore():Scene;replace(scene:Scene):Scene;attachRenderer(renderer:{updateScene(value:unknown):void;render():void}):void;
}
import {createPathBuilder as source,createDisplayTreeFromScene as sourceTree} from '../../../packages/barocss-canvas2d/src/index.js';
import {createPathBuilder as emitted,createDisplayTreeFromScene as emittedTree} from '../../../packages/barocss-canvas2d/dist/index.js';
import type {PathCommand,SceneV29} from '../../../packages/barocss-canvas2d/dist/index.js';
export function publicTypes(scene:SceneV29){const a:PathCommand[]=source().moveTo(1,2).quadraticCurveTo(3,4,5,6).build(),b:PathCommand[]=emitted().moveTo(1,2).bezierCurveTo(3,4,5,6,7,8).build();
// @ts-expect-error Curve controls are numeric.
source().quadraticCurveTo('x',4,5,6);
return{a,b,sourceTree:sourceTree(scene),emittedTree:emittedTree(scene)};}
