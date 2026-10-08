import type {SceneShaders} from './compiler.js';
import type {MeshLighting} from './mesh-lighting.js';
export const MESH_LIGHTING=Object.freeze({kind:'fixed-directional-and-ambient',direction:Object.freeze([-.6,.8,1]),ambientStrength:.35,diffuseStrength:.65});

export const MESH_SHADERS: SceneShaders = {
  vertex: `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform float aspect;
uniform bool defaultCamera;
uniform mat4 view;
uniform mat4 projection;
out vec3 worldNormal;
void main(){
 if(defaultCamera){
  vec3 p=position-vec3(0.0,0.0,6.0);
  float f=2.414213562373095;
  gl_Position=vec4(p.x*f/aspect,p.y*f,-1.000200020002*p.z-0.02000200020002,-p.z);
 }else{
  gl_Position=projection*view*vec4(position,1.0);
 }
 worldNormal=normal;
}`,
  fragment: `#version 300 es
precision highp float;
in vec3 worldNormal;
uniform vec3 color;
out vec4 outputColor;
void main(){
 float light=${MESH_LIGHTING.ambientStrength.toFixed(2)}+${MESH_LIGHTING.diffuseStrength.toFixed(2)}*max(dot(normalize(worldNormal),normalize(vec3(${MESH_LIGHTING.direction.map(n=>n.toFixed(1)).join(',')}))),0.0);
 outputColor=vec4(pow(pow(color,vec3(2.2))*light,vec3(1.0/2.2)),1.0);
}`,
};

/** Preserve the exact old source when optional lighting is absent. */
export function meshLightingShaders(lighting?:MeshLighting):SceneShaders {
 if(!lighting)return MESH_SHADERS;
 return{vertex:MESH_SHADERS.vertex,fragment:`#version 300 es
precision highp float;
in vec3 worldNormal;
uniform vec3 color;
uniform float ambientStrength;
uniform float directionalStrength;
uniform vec3 lightDirection;
out vec4 outputColor;
void main(){
 float light=ambientStrength+directionalStrength*max(dot(normalize(worldNormal),normalize(lightDirection)),0.0);
 outputColor=vec4(pow(pow(color,vec3(2.2))*light,vec3(1.0/2.2)),1.0);
}`};
}
export function applyMeshLighting(gl:WebGL2RenderingContext,program:WebGLProgram,lighting?:MeshLighting):void {
 if(!lighting)return;
 const length=Math.hypot(...lighting.direction);
 // Lower a nonzero unit direction, including subnormal authored components.
 gl.uniform1f(gl.getUniformLocation(program,'ambientStrength'),lighting.ambientStrength);
 gl.uniform1f(gl.getUniformLocation(program,'directionalStrength'),lighting.directionalStrength);
 gl.uniform3fv(gl.getUniformLocation(program,'lightDirection'),lighting.direction.map(n=>n/length));
}
