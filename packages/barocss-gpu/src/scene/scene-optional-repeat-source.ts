import { compileSceneParameterData, finishSceneParameterSource } from './scene-parameter-source.js';
import type {
  ParameterizedAffineSceneAst, SceneParameter, SceneRepeatDeclaration, SceneGenerationRecord,
} from './scene-parameter-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from '../mesh/compiler.js';

export interface OptionalRepeatedAffineSceneAst extends Omit<ParameterizedAffineSceneAst, 'schema' | 'declarations'> {
  schema: 'barocss-gpu-optional-repeat-affine-scene-ast';
  declarations: (ParameterizedAffineSceneAst['declarations'][number] | SceneRepeatDeclaration)[];
}

export interface CompiledOptionalRepeatedAffineSceneSource {
  readonly format: 'barocss-gpu-optional-repeat-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-typed-optional-repeat-coefficients-v0';
  readonly source: string;
  readonly ast: OptionalRepeatedAffineSceneAst;
  readonly parameters: SceneParameter[];
  readonly generation: SceneGenerationRecord[];
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

/** Retain authored zero-count repeats without creating generated objects or identities. */
export function compileOptionalRepeatedAffineSceneSource(input: unknown): CompiledOptionalRepeatedAffineSceneSource {
  const data = compileSceneParameterData(input, 'arithmetic', 'optional-repeat');
  const ast: OptionalRepeatedAffineSceneAst = {
    ...data.ast,
    schema: 'barocss-gpu-optional-repeat-affine-scene-ast',
    declarations: [...data.ast.declarations, ...data.repeatDeclarations]
      .sort((left, right) => left.range.start - right.range.start),
  };
  const owned: CompiledOptionalRepeatedAffineSceneSource = {
    format: 'barocss-gpu-optional-repeat-affine-scene-source',
    version: 0,
    profile: 'source2-typed-optional-repeat-coefficients-v0',
    source: data.source,
    ast,
    parameters: data.parameters,
    generation: data.generation,
    scene: data.scene,
    shaders: data.shaders,
  };
  return finishSceneParameterSource(owned, data.ast.range);
}
