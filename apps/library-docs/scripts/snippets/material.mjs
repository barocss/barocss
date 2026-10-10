import { compileMeshMaterial, validateMeshMaterialIR, lowerMeshMaterial } from '@barocss/gpu';
const result = compileMeshMaterial(`
@shader #wave {
  @uniform timeSeconds: float(0,2,0);
  @fragment {
    color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5);
  }
}`);
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const material = validateMeshMaterialIR(result.material);
const lowered = lowerMeshMaterial(material);
if (lowered.uniformLayout.length !== 1 || lowered.uniformLayout[0].name !== 'timeSeconds') throw new Error('Uniform layout mismatch');
const refused = compileMeshMaterial('@shader #bad { @fragment { color: unknown(); } }');
if (refused.ok) throw new Error('Unsupported function was accepted');
export const receipt = { package: '@barocss/gpu', version: '0.0.0', compiler: 'source TypeScript transformed by esbuild', shaderId: material.shaderId, uniform: lowered.uniformLayout[0], refused: refused.diagnostics.map(d => d.code), drawing: 'not executed' };
