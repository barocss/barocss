import { compileSceneParameterData, finishSceneParameterSource } from './scene-parameter-source.js';
import type { ParameterizedAffineSceneAst, SceneParameter } from './scene-parameter-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from './compiler.js';

export interface ArithmeticAffineSceneAst extends Omit<ParameterizedAffineSceneAst, 'schema'> {
  schema: 'barocss-gpu-arithmetic-affine-scene-ast';
}

export interface CompiledArithmeticAffineSceneSource {
  readonly format: 'barocss-gpu-arithmetic-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-typed-flat-arithmetic-coefficients-v0';
  readonly source: string;
  readonly ast: ArithmeticAffineSceneAst;
  readonly parameters: SceneParameter[];
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

/** Compile flat typed arithmetic through the shared bounded source pipeline. */
export function compileArithmeticAffineSceneSource(input: unknown): CompiledArithmeticAffineSceneSource {
  const data = compileSceneParameterData(input, 'arithmetic');
  const ast: ArithmeticAffineSceneAst = {
    ...data.ast,
    schema: 'barocss-gpu-arithmetic-affine-scene-ast',
  };
  const owned: CompiledArithmeticAffineSceneSource = {
    format: 'barocss-gpu-arithmetic-affine-scene-source',
    version: 0,
    profile: 'source2-typed-flat-arithmetic-coefficients-v0',
    source: data.source,
    ast,
    parameters: data.parameters,
    scene: data.scene,
    shaders: data.shaders,
  };
  return finishSceneParameterSource(owned, data.ast.range);
}
