import { compileSceneParameterData, finishSceneParameterSource } from './scene-parameter-source.js';
import type {
  ParameterizedAffineSceneAst, SceneParameter, SceneConditionalDeclaration, SceneConditionalDecision,
} from './scene-parameter-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from '../mesh/compiler.js';

export type { SceneConditionalDeclaration, SceneConditionalDecision } from './scene-parameter-source.js';

export interface ConditionalAffineSceneAst extends Omit<ParameterizedAffineSceneAst, 'schema' | 'declarations'> {
  schema: 'barocss-gpu-conditional-affine-scene-ast';
  declarations: (ParameterizedAffineSceneAst['declarations'][number] | SceneConditionalDeclaration)[];
}

export interface CompiledConditionalAffineSceneSource {
  readonly format: 'barocss-gpu-conditional-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-typed-conditional-objects-v0';
  readonly source: string;
  readonly ast: ConditionalAffineSceneAst;
  readonly parameters: SceneParameter[];
  readonly decisions: SceneConditionalDecision[];
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

/** Compile source-only conditions while retaining every original authored declaration and rule. */
export function compileConditionalAffineSceneSource(input: unknown): CompiledConditionalAffineSceneSource {
  const data = compileSceneParameterData(input, 'arithmetic', 'conditional');
  const ast: ConditionalAffineSceneAst = {
    ...data.ast,
    schema: 'barocss-gpu-conditional-affine-scene-ast',
    declarations: [...data.ast.declarations, ...data.conditionalDeclarations]
      .sort((left, right) => left.range.start - right.range.start),
  };
  const owned: CompiledConditionalAffineSceneSource = {
    format: 'barocss-gpu-conditional-affine-scene-source',
    version: 0,
    profile: 'source2-typed-conditional-objects-v0',
    source: data.source,
    ast,
    parameters: data.parameters,
    decisions: data.decisions,
    scene: data.scene,
    shaders: data.shaders,
  };
  return finishSceneParameterSource(owned, data.ast.range);
}
