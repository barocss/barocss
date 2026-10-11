import { compileSceneParameterData, finishSceneParameterSource } from './scene-parameter-source.js';
import type {
  ParameterizedAffineSceneAst, SceneParameter, SceneRepeatDeclaration, SceneGenerationRecord,
} from './scene-parameter-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from './compiler.js';

export type { SceneRepeatDeclaration, SceneGenerationRecord } from './scene-parameter-source.js';

export interface FiniteRepeatAffineSceneAst extends Omit<ParameterizedAffineSceneAst, 'schema' | 'declarations'> {
  schema: 'barocss-gpu-finite-repeat-affine-scene-ast';
  declarations: (ParameterizedAffineSceneAst['declarations'][number] | SceneRepeatDeclaration)[];
}

export interface CompiledFiniteRepeatAffineSceneSource {
  readonly format: 'barocss-gpu-finite-repeat-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-typed-finite-repeat-coefficients-v0';
  readonly source: string;
  readonly ast: FiniteRepeatAffineSceneAst;
  readonly parameters: SceneParameter[];
  readonly generation: SceneGenerationRecord[];
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

/** Compile bounded repeats while retaining only authored declarations in the public AST. */
export function compileFiniteRepeatAffineSceneSource(input: unknown): CompiledFiniteRepeatAffineSceneSource {
  const data = compileSceneParameterData(input, 'arithmetic', true);
  const ast: FiniteRepeatAffineSceneAst = {
    ...data.ast,
    schema: 'barocss-gpu-finite-repeat-affine-scene-ast',
    declarations: [...data.ast.declarations, ...data.repeatDeclarations]
      .sort((left, right) => left.range.start - right.range.start),
  };
  const owned: CompiledFiniteRepeatAffineSceneSource = {
    format: 'barocss-gpu-finite-repeat-affine-scene-source',
    version: 0,
    profile: 'source2-typed-finite-repeat-coefficients-v0',
    source: data.source,
    ast,
    parameters: data.parameters,
    generation: data.generation,
    scene: data.scene,
    shaders: data.shaders,
  };
  return finishSceneParameterSource(owned, data.ast.range);
}
