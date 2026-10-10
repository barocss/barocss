import { resolveStructuredScene } from './gpu-data.js';
import {validateTorusRadii} from './torus.js';
import {roundedBoxInner} from './rounded-box.js';
import {validateCapsuleSegment} from './capsule.js';
import {inverseRotation} from './rotation.js';
import type { AnyScene, Scene, Scene1, RGB, Vec3 } from './scene.js';

export const GPU_LIMITS = Object.freeze({ maxObjects: 32, maxSteps: 128, maxDistance: 100, epsilon: 0.001, maxShaderBytes: 65536 });
export interface SceneShaders { vertex: string; fragment: string }

function vector(value: unknown, positive: boolean, maximum: number): asserts value is Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || value.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > maximum || (positive && (n <= 0 || Math.fround(n) <= 0)))) {
    throw new Error('Invalid scene vector');
  }
}
function color(value: unknown): asserts value is RGB {
  vector(value, false, 1);
  if (value.some(n => n < 0)) throw new Error('Invalid scene color');
}
function scalar(value: number): string { return Math.fround(value).toExponential(8); }
function vec(value: Vec3): string { return `vec3(${value.map(scalar).join(',')})`; }

/** Validate structured input again: identifiers and source text never enter GLSL. */
export function lowerSceneShaders(scene: AnyScene): SceneShaders {
  return lowerSceneShadersInternal(scene);
}

/** Internal trusted Source2 lowering. Existing Source0/1 admission is unchanged. */
export function lowerAffineSceneShaders(scene: Scene1, scales: readonly Vec3[]): SceneShaders {
  if (!Array.isArray(scales) || scales.length !== scene.objects.length) throw new Error('Invalid affine scale count');
  for (const scale of scales) {
    vector(scale, true, 100);
    if (scale.some(value => value < .01)) throw new Error('Affine scale must remain within .01..100');
  }
  return lowerSceneShadersInternal(scene, scales);
}
function lowerSceneShadersInternal(scene: AnyScene, scales?: readonly Vec3[]): SceneShaders {
  if (!scene || (scene.version !== 0 && scene.version !== 1) || !Array.isArray(scene.objects) || scene.objects.length > GPU_LIMITS.maxObjects) throw new Error('Invalid scene');
  color(scene.background);
  const seen = new Set<string>();
  const shapes: string[] = [];
  scene.objects.forEach((object,index) => {
    if (!object || typeof object.id !== 'string' || seen.has(object.id) || !['sphere', 'box',...(scene.version===1?['cylinder','capsule','rounded-box','torus']:[])].includes(object.type)) throw new Error('Invalid scene object');
    seen.add(object.id);
    color(object.color);
    vector(object.translate, false, 1000);
    vector(object.size, true, 1000);
    if (typeof object.radius !== 'number' || !Number.isFinite(object.radius) || object.radius <= 0 || object.radius > 1000 || Math.fround(object.radius) <= 0) throw new Error('Invalid sphere radius');
    let point=`p-${vec(object.translate)}`;
    if(scene.version===1){
      const rotation=scene.objects[index].rotateDegrees;
      if(rotation.some(n=>n!==0))point=`(mat3(${inverseRotation(rotation).map(scalar).join(',')})*(${point}))`;
    }
    const scale = scales?.[index];
    const affine = scale !== undefined && scale.some(value => value !== 1);
    if (affine) point = `((${point})/${vec(scale)})`;
    if(object.type==='cylinder'&&(!Number.isFinite(object.height)||object.height<=0||object.height>1000||Math.fround(object.height/2)<=0))throw new Error('Invalid cylinder height');
    if(object.type==='capsule'){vector(object.start,false,1000);vector(object.end,false,1000);validateCapsuleSegment(object.start,object.end);}
    if(object.type==='torus')validateTorusRadii(object.majorRadius,object.minorRadius);
    const distance = object.type === 'torus'
      ? `torusDistance(${point},${scalar(object.majorRadius)},${scalar(object.minorRadius)})`
      : object.type === 'rounded-box'
      ? `boxDistance(${point},${vec(roundedBoxInner(object.size,object.radius))})-${scalar(object.radius)}`
      : object.type === 'capsule'
      ? `capsuleDistance(${point},${vec(object.start)},${vec(object.end)},${scalar(object.radius)})`
      : object.type === 'cylinder'
      ? `cylinderDistance(${point},${scalar(object.radius)},${scalar(object.height/2)})`
      : object.type === 'sphere'
      ? `length(${point})-${scalar(object.radius)}`
      : `boxDistance(${point},${vec(object.size.map(n => n / 2) as Vec3)})`;
    // The multiplier uses the same executed Float32 scale constants as point division.
    // This is a conservative field in ideal arithmetic, not exact world distance.
    const field = affine ? `(${distance})*${scalar(Math.min(...scale.map(Math.fround)))}` : distance;
    shapes.push(`d=${field}; if(d<nearest){nearest=d; material=${vec(object.color)};}`);
  });
  const vertex = `#version 300 es
precision highp float;
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.0-1.0,0.0,1.0); }
`;
  const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution;
out vec4 outputColor;
float boxDistance(vec3 p,vec3 extent){vec3 q=abs(p)-extent;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
${scene.objects.some(o=>o.type==='cylinder')?'float cylinderDistance(vec3 p,float radius,float halfHeight){vec2 d=vec2(length(p.xz)-radius,abs(p.y)-halfHeight);return length(max(d,0.0))+min(max(d.x,d.y),0.0);}'+'\n':''}${scene.objects.some(o=>o.type==='capsule')?'float capsuleDistance(vec3 p,vec3 start,vec3 end,float radius){vec3 ba=end-start;vec3 pa=p-start;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h)-radius;}'+'\n':''}${scene.objects.some(o=>o.type==='torus')?'float torusDistance(vec3 p,float majorRadius,float minorRadius){return length(vec2(length(p.xz)-majorRadius,p.y))-minorRadius;}'+'\n':''}float sceneDistance(vec3 p,out vec3 material){float nearest=1.0e20;float d;material=vec3(0.0);${shapes.join('\n')}return nearest;}
void main(){
 vec3 background=${vec(scene.background)};
 vec2 uv=(2.0*gl_FragCoord.xy-resolution)/resolution.y;
 vec3 direction=normalize(vec3(uv*0.414213562373095, -1.0));
 vec3 origin=vec3(0.0,0.0,6.0); float travel=0.0; bool hit=false; vec3 material;
 for(int step=0;step<128;step++){ float d=sceneDistance(origin+direction*travel,material);if(d<0.001){hit=true;break;}travel+=d;if(travel>100.0)break; }
 if(!hit){outputColor=vec4(background,1.0);return;}
 vec3 p=origin+direction*travel; vec3 unusedColor;
 vec3 normal=normalize(vec3(
 sceneDistance(p+vec3(0.001,0.0,0.0),unusedColor)-sceneDistance(p-vec3(0.001,0.0,0.0),unusedColor),
 sceneDistance(p+vec3(0.0,0.001,0.0),unusedColor)-sceneDistance(p-vec3(0.0,0.001,0.0),unusedColor),
 sceneDistance(p+vec3(0.0,0.0,0.001),unusedColor)-sceneDistance(p-vec3(0.0,0.0,0.001),unusedColor)));
 float light=0.35+0.65*max(dot(normal,normalize(vec3(-0.6,0.8,1.0))),0.0);
 outputColor=vec4(pow(pow(material,vec3(2.2))*light,vec3(1.0/2.2)),1.0);
}
`;
  if (new TextEncoder().encode(fragment).length > GPU_LIMITS.maxShaderBytes) throw new Error('Shader workload limit exceeded');
  return { vertex, fragment };
}

/** Existing structured convenience API over semantic validation and original lowering. */
export function compileScene(scene:Scene):SceneShaders;
export function compileScene(scene:Scene1):SceneShaders;
export function compileScene(scene:AnyScene):SceneShaders{return lowerSceneShaders(resolveStructuredScene(scene));}
