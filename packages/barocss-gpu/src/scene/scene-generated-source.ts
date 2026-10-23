import { compileSceneParameterData, finishSceneParameterSource } from './scene-parameter-source.js';
import type {
  ParameterizedAffineSceneAst, SceneParameter, SceneRepeatDeclaration, SceneGenerationRecord,
  SceneConditionalDeclaration, SceneConditionalDecision,
} from './scene-parameter-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from '../mesh/compiler.js';

export interface GeneratedAffineSceneAst extends Omit<ParameterizedAffineSceneAst, 'schema' | 'declarations'> {
  schema: 'barocss-gpu-generated-affine-scene-ast';
  declarations: (ParameterizedAffineSceneAst['declarations'][number]
    | SceneRepeatDeclaration | SceneConditionalDeclaration)[];
}

export interface CompiledGeneratedAffineSceneSource {
  readonly format: 'barocss-gpu-generated-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-typed-mixed-generation-v0';
  readonly source: string;
  readonly ast: GeneratedAffineSceneAst;
  readonly parameters: SceneParameter[];
  readonly generation: SceneGenerationRecord[];
  readonly decisions: SceneConditionalDecision[];
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

/** Compose bounded authored repeats and conditions without exposing private generated ID tokens. */
export function compileGeneratedAffineSceneSource(input: unknown): CompiledGeneratedAffineSceneSource {
  const data = compileSceneParameterData(input, 'arithmetic', 'mixed');
  const ast: GeneratedAffineSceneAst = {
    ...data.ast,
    schema: 'barocss-gpu-generated-affine-scene-ast',
    declarations: [...data.ast.declarations, ...data.repeatDeclarations, ...data.conditionalDeclarations]
      .sort((left, right) => left.range.start - right.range.start),
  };
  const owned: CompiledGeneratedAffineSceneSource = {
    format: 'barocss-gpu-generated-affine-scene-source',
    version: 0,
    profile: 'source2-typed-mixed-generation-v0',
    source: data.source,
    ast,
    parameters: data.parameters,
    generation: data.generation,
    decisions: data.decisions,
    scene: data.scene,
    shaders: data.shaders,
  };
  return finishSceneParameterSource(owned, data.ast.range);
}
