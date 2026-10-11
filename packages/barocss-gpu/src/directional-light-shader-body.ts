import { MESH_SHADERS } from './mesh-shaders.js';
import type { SceneShaders } from './compiler.js';
import type { LoweredMeshMaterial } from './mesh-material.js';

/** INTERNAL trusted emission: count and material have passed the selected native providers. */
export function directionalLightMeshShaderSource(count: number, material: LoweredMeshMaterial | null): SceneShaders {
  const declarations: string[] = [];
  const terms: string[] = [];
  for (let index = 0; index < count; index++) {
    declarations.push(`uniform vec3 nativeLightDirection_${index};`,
      `uniform vec3 nativeLightColor_${index};`, `uniform float nativeLightIntensity_${index};`);
    terms.push(` light += nativeLightColor_${index} * nativeLightIntensity_${index} * max(dot(normalizedWorldNormal,nativeLightDirection_${index}),0.0);`);
  }
  const color = material ? material.uniformDeclarations : 'uniform vec3 color;';
  const base = material ? '(' + material.expression + ')' : 'pow(color,vec3(2.2))';
  return {
    vertex: MESH_SHADERS.vertex,
    fragment: `#version 300 es
precision highp float;
in vec3 worldNormal;
uniform float nativeAmbientStrength;
${color}
${declarations.join('\n')}
out vec4 outputColor;
void main(){
 vec3 normalizedWorldNormal=normalize(worldNormal);
 vec3 light=vec3(nativeAmbientStrength);
${terms.join('\n')}
 vec3 baseLinear=${base};
 vec3 linearRadiance=clamp(baseLinear*light,vec3(0.0),vec3(1.0));
 outputColor=vec4(pow(linearRadiance,vec3(1.0/2.2)),1.0);
}`,
  };
}
