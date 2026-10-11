import { compileMeshMaterial, validateMeshMaterialIR, lowerMeshMaterial } from '@barocss/gpu';

export const blendSource = `@shader #blend {
  @uniform amount: float(0,1,0);
  @let ratio: float(smoothstep(0,1,amount));
  @fragment {
    color: mix(#2060D0,#F09030,ratio);
  }
}`;
export const invalidSource = blendSource.replace('mix(#2060D0,#F09030,ratio)', 'unknown()');
export const correctedSource = blendSource.replace('float(0,1,0)', 'float(0,1,.5)');
export const stages = ['Source', 'IR', 'Validated IR', 'GLSL'];
const copy = value => structuredClone(value);
function treeStats(expression) {
  const children = expression.kind === 'call' ? expression.args : expression.kind === 'binary'
    ? [expression.left, expression.right] : expression.kind === 'unary' ? [expression.value] : [];
  const stats = children.map(treeStats);
  return { nodes: 1 + stats.reduce((sum, child) => sum + child.nodes, 0), depth: 1 + Math.max(0, ...stats.map(child => child.depth)) };
}
function deeplyFrozen(value) {
  return value === null || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}
// This APP model counts direct export calls, never private compiler work or timings.
export function createMaterialBench() {
  let draft = blendSource, accepted = null, diagnostics = [], selectedStage = 0;
  const calls = { compile: 0, validate: 0, lower: 0 };
  function report() { return copy({ draft, accepted, diagnostics, selectedStage, calls }); }
  return {
    report,
    setDraft(source) {
      if (typeof source !== 'string') throw new TypeError('Draft must be text');
      draft = source;
      return report();
    },
    selectStage(index) {
      if (!Number.isInteger(index) || index < 0 || index >= stages.length) throw new RangeError('Unknown stage');
      selectedStage = index;
      return report();
    },
    compile() {
      calls.compile++;
      const compiled = compileMeshMaterial(draft);
      if (!compiled.ok) { diagnostics = copy(compiled.diagnostics); return report(); }
      // Candidate adoption is atomic: a failure never replaces any accepted artifact.
      try {
        calls.validate++;
        const validated = validateMeshMaterialIR(compiled.material);
        calls.lower++;
        const lowered = lowerMeshMaterial(validated);
        accepted = {
          source: draft, compiled: compiled.material, validated, lowered,
          statistics: treeStats(validated.expression),
          ownership: { compiledDeeplyFrozen: deeplyFrozen(compiled.material), validatedDeeplyFrozen: deeplyFrozen(validated), freshValidation: compiled.material !== validated }
        };
        diagnostics = [];
      } catch (error) {
        diagnostics = [{ code: error.code ?? 'APP', message: error.message, start: error.start ?? 0, end: error.end ?? 0 }];
      }
      return report();
    }
  };
}
