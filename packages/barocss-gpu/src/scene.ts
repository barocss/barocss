export * from './scene-types.js';
import type {Scene,Scene1,AnyScene,SceneSourceOptions} from './scene-types.js';
import {parseSceneAst,analyzeSceneAst} from './scene-front.js';
import {ownRecord} from './gpu-data.js';
export function sceneSourceVersion(options?:SceneSourceOptions):0|1{
 if(options===undefined)return 0;
 const data=ownRecord(options,['sourceVersion']);
 if(data.sourceVersion!==1)throw new Error('Only explicit sourceVersion: 1 is supported');
 return 1;
}
/** Existing calls stay source0; source1 requires explicit opt-in. */
export function parseScene(source:string):Scene;
export function parseScene(source:string,options:SceneSourceOptions):Scene1;
export function parseScene(source:string,options?:SceneSourceOptions):AnyScene{return analyzeSceneAst(parseSceneAst(source,sceneSourceVersion(options)));}
