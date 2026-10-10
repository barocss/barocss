import {createDisplayTree,createDisplayTreeFromScene,type SpriteRGBMatrix,type SceneV27,type ImageNodeV27,type NodeV27,type GroupNodeV27,type FrameNodeV27,type SpriteSpec,type SpriteData} from '../../../dist/index.js';
const matrix:SpriteRGBMatrix=[0,0,1,0,0,1,0,0,1,0,0,0];
const spec:SpriteSpec={id:'Sprite',layer:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},imageId:'Atlas',width:10,height:10,anchorX:0,anchorY:0,opacity:1,sampling:'nearest',rgbMatrix:matrix};
const tree=createDisplayTree('Types'),handle=tree.createSprite(spec);tree.stage.addChild(handle);handle.setRGBMatrix(matrix);handle.setRGBMatrix(null);
const data:SpriteData=handle.data,scene:SceneV27=tree.snapshot(),node:NodeV27=scene.nodes[0]!;const image:ImageNodeV27={kind:'image',...data,rgbMatrix:matrix};
const group:GroupNodeV27={kind:'group',id:'Group',layer:0,transform:spec.transform,visible:true,alpha:1,hitMode:'auto',children:[image]};
const frame:FrameNodeV27={kind:'frame',id:'Frame',layer:0,transform:spec.transform,visible:true,alpha:1,hitMode:'auto',width:20,height:20,fill:[0,0,0,0],clip:true,children:[group]};
createDisplayTreeFromScene({...scene,nodes:[frame,node]});
