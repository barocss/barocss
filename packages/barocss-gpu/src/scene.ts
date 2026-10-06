export * from './scene-types.js';
import type {Scene} from './scene-types.js';
import {parseSceneAst,analyzeSceneAst} from './scene-front.js';
/** Existing convenience API over the original ranged parser and semantic stage. */
export function parseScene(source:string):Scene{return analyzeSceneAst(parseSceneAst(source));}
