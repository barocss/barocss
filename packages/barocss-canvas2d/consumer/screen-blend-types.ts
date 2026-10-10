import type {SceneV27,SceneV28,ImageNodeV27,ImageNodeV28,SpriteSpec,SpriteData} from '../dist/index.js';
import {createDisplayTree} from '../dist/index.js';
const tree=createDisplayTree('Types');
const scene:SceneV28=tree.snapshot();
const mode:ImageNodeV28['blendMode']='screen';
// @ts-expect-error Historical Scene27 mode remains narrow.
const oldMode:ImageNodeV27['blendMode']='screen';
const narrow:SceneV27={version:27,unit:'logical-px',contextId:'Types',nodes:[]};
function edit(spec:SpriteSpec){const sprite=tree.createSprite({...spec,blendMode:mode});sprite.setBlendMode('screen');const data:SpriteData=sprite.data;return data;}
void[scene,narrow,oldMode,edit];
