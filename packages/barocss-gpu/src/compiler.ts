import { resolveStructuredScene } from './gpu-data.js';
import type { Scene, RGB, Vec3 } from './scene.js';

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
export function lowerSceneShaders(scene: Scene): SceneShaders {
  if (!scene || scene.version !== 0 || !Array.isArray(scene.objects) || scene.objects.length > GPU_LIMITS.maxObjects) throw new Error('Invalid scene');
  color(scene.background);
  const seen = new Set<string>();
  const shapes: string[] = [];
  scene.objects.forEach(object => {
    if (!object || typeof object.id !== 'string' || seen.has(object.id) || !['sphere', 'box'].includes(object.type)) throw new Error('Invalid scene object');
    seen.add(object.id);
    color(object.color);
    vector(object.translate, false, 1000);
    vector(object.size, true, 1000);
    if (typeof object.radius !== 'number' || !Number.isFinite(object.radius) || object.radius <= 0 || object.radius > 1000 || Math.fround(object.radius) <= 0) throw new Error('Invalid sphere radius');
    const distance = object.type === 'sphere'
      ? `length(p-${vec(object.translate)})-${scalar(object.radius)}`
      : `boxDistance(p-${vec(object.translate)},${vec(object.size.map(n => n / 2) as Vec3)})`;
    shapes.push(`d=${distance}; if(d<nearest){nearest=d; material=${vec(object.color)};}`);
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
float sceneDistance(vec3 p,out vec3 material){float nearest=1.0e20;float d;material=vec3(0.0);${shapes.join('\n')}return nearest;}
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
export function compileScene(scene:Scene):SceneShaders{return lowerSceneShaders(resolveStructuredScene(scene));}
