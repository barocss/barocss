import { compileSceneParameterData, finishSceneParameterSource } from './scene-parameter-source.js';
import type { ParameterizedAffineSceneAst, SceneParameter } from './scene-parameter-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from '../mesh/compiler.js';

export interface MultiplicativeAffineSceneAst extends Omit<ParameterizedAffineSceneAst, 'schema'> {
  schema: 'barocss-gpu-multiplicative-affine-scene-ast';
}

export interface CompiledMultiplicativeAffineSceneSource {
  readonly format: 'barocss-gpu-multiplicative-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-typed-product-coefficients-v0';
  readonly source: string;
  readonly ast: MultiplicativeAffineSceneAst;
  readonly parameters: SceneParameter[];
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

/** Compile the opt-in quantity-product source through the shared bounded pipeline. */
export function compileMultiplicativeAffineSceneSource(input: unknown): CompiledMultiplicativeAffineSceneSource {
  const data = compileSceneParameterData(input, true);
  const ast: MultiplicativeAffineSceneAst = {
    ...data.ast,
    schema: 'barocss-gpu-multiplicative-affine-scene-ast',
  };
  const owned: CompiledMultiplicativeAffineSceneSource = {
    format: 'barocss-gpu-multiplicative-affine-scene-source',
    version: 0,
    profile: 'source2-typed-product-coefficients-v0',
    source: data.source,
    ast,
    parameters: data.parameters,
    scene: data.scene,
    shaders: data.shaders,
  };
  return finishSceneParameterSource(owned, data.ast.range);
}
