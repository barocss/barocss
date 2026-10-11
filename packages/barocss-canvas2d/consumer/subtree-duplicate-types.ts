import {duplicateSceneSubtree as source} from '../src/index.js';
import {duplicateSceneSubtree as emitted} from '../dist/index.js';
import type {SceneSubtreeDuplicateOptions,SceneSubtreeDuplicateResult,SceneV29} from '../dist/index.js';
export function publicTypes(scene:SceneV29){const options:SceneSubtreeDuplicateOptions={nodeIds:{A:'B'},assetIds:{},offset:{x:1,y:2}};const a:SceneSubtreeDuplicateResult=source(scene,'A',options),b:SceneSubtreeDuplicateResult=emitted(scene,'A',options);
// @ts-expect-error Offset is required.
source(scene,'A',{nodeIds:{A:'B'},assetIds:{}});
// @ts-expect-error The result has no pixels registry.
const pixels=a.pixels;
// @ts-expect-error The pure CPU helper is synchronous.
const asyncResult:Promise<SceneSubtreeDuplicateResult>=emitted(scene,'A',options);
return{a,b,pixels,asyncResult};}
