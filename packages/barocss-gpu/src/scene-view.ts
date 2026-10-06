import type {SceneShaders} from './compiler.js';
import type {MeshCamera} from './camera.js';
import {prepareCamera} from './camera.js';
/** Opt-in view uniforms over the original generated SDF; authored GLSL is not accepted. */
export function sceneViewShaders(shaders:SceneShaders):SceneShaders{
 return{vertex:shaders.vertex,fragment:shaders.fragment.replace('uniform vec2 resolution;',`uniform vec2 resolution;
uniform vec3 viewEye;
uniform vec3 viewRight;
uniform vec3 viewUp;
uniform vec3 viewBackward;
uniform float viewFocal;
uniform vec2 viewClip;`).replace('vec3 direction=normalize(vec3(uv*0.414213562373095, -1.0));','vec3 direction=normalize(viewRight*uv.x*viewFocal+viewUp*uv.y*viewFocal-viewBackward);').replace('vec3 origin=vec3(0.0,0.0,6.0); float travel=0.0;','vec3 origin=viewEye; float travel=viewClip.x;').replace('for(int step=0;', 'if(viewClip.x>=min(100.0,viewClip.y)){outputColor=vec4(background,1.0);return;}\n for(int step=0;').replace('if(travel>100.0)break;','if(travel>min(100.0,viewClip.y))break;')};
}
export function sceneViewUniforms(camera:MeshCamera){const {view}=prepareCamera(camera,1);return{eye:camera.eye,right:[view[0],view[4],view[8]],up:[view[1],view[5],view[9]],backward:[view[2],view[6],view[10]],focal:Math.tan(camera.fovYDegrees*Math.PI/360),clip:[camera.near,camera.far]};}
