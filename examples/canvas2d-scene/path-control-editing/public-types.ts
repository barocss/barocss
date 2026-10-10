import { createDisplayTreeFromScene as source, Canvas2DRenderer as SourceRenderer } from '../../../packages/barocss-canvas2d/src/index.js';
import { createDisplayTreeFromScene as compiled, Canvas2DRenderer as EmittedRenderer } from '../../../packages/barocss-canvas2d/dist/index.js';
import type { Scene, PathHandle, Point } from '../../../packages/barocss-canvas2d/dist/index.js';
import { candidate, control, localPoint } from './controls.mjs';
export function publicContracts(scene:Scene,renderer:EmittedRenderer,sourceRenderer:SourceRenderer){
 const a=compiled(scene),b=source(scene);const target={id:'Quadratic',index:1,slot:'q' as const};
 const path:PathHandle=control(a,target).path;const point:Point=localPoint({clientX:1,clientY:1},{left:0,top:0,width:480,height:320},{width:960,height:640},2,renderer,path);
 const edited=candidate(scene,target,point);path.setPath({commands:path.data.commands,...(path.data.fill?{fill:path.data.fill}:{})});sourceRenderer.viewportToWorld(point);
 // @ts-expect-error Only Q or either C control is editable.
 candidate(scene,{id:'Quadratic',index:1,slot:'end'},point);
 return {a,b,edited};
}

import { splitPathSegment as splitSource } from '../../../packages/barocss-canvas2d/src/index.js';
import { splitPathSegment as splitEmitted } from '../../../packages/barocss-canvas2d/dist/index.js';
import type { PathCommand } from '../../../packages/barocss-canvas2d/dist/index.js';
import { anchorCandidate, anchorControl } from './controls.mjs';
export function splitContracts(commands:readonly PathCommand[],scene:Scene){const a:PathCommand[]=splitSource(commands,1,.5),b:PathCommand[]=splitEmitted(commands,1,.5),tree=compiled(scene);anchorControl(tree,{id:'Cubic',index:1});anchorCandidate(scene,{id:'Cubic',index:1},{x:1,y:2});
 // @ts-expect-error parameter required
 splitEmitted(commands,1);
 // @ts-expect-error no string parameter
 splitSource(commands,1,'0.5');return{a,b};}
