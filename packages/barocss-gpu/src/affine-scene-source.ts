import { parseAffineSceneAst, analyzeSceneAst } from './scene-front.js';
import type { SceneAst, SceneToken, AffineSceneAst } from './scene-front.js';
import { lowerAffineSceneShaders } from './compiler.js';
import type { SceneShaders } from './compiler.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';
import { SceneError } from './scene-types.js';
import type { Scene1, SceneObject1, RGB, Vec3 } from './scene-types.js';

/** Original Source2 object coefficients and local, dimensionless positive XYZ scale. */
export type AffineSceneObject2 = SceneObject1 & { scaleXYZ: Vec3 };
export interface AffineScene2 {
  version: 2;
  name: string;
  background: RGB;
  objects: AffineSceneObject2[];
}

/** Full original Source2 text and canonical semantics, with separately trusted shader text. */
export interface CompiledAffineSceneSource {
  readonly format: 'barocss-gpu-affine-scene-source';
  readonly version: 0;
  readonly profile: 'source2-local-positive-xyz-min-step-v0';
  readonly source: string;
  readonly scene: AffineScene2;
  readonly shaders: SceneShaders;
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function fail(message: string, token: SceneToken): never {
  throw new SceneError([{ message, ...token.range }]);
}
function sourceError(message: string): SceneError {
  return new SceneError([{ message, start: 0, end: 0, line: 1, column: 1 }]);
}

/** Parse original Source2, reuse Source1 semantics and lower only compiler-owned coefficients. */
export function compileAffineSceneSource(source: unknown): CompiledAffineSceneSource {
  if (typeof source !== 'string') throw sourceError('Source must be a string');
  const ast = parseAffineSceneAst(source);
  const { scene, shaders } = lowerAffineSceneAst(ast);
  return Object.freeze({ format: 'barocss-gpu-affine-scene-source', version: 0,
    profile: 'source2-local-positive-xyz-min-step-v0', source, scene, shaders });
}

/** INTERNAL owned syntax-view lowering; never a public imported-AST admission API. */
export function lowerAffineSceneAst(ast: AffineSceneAst): { scene: AffineScene2; shaders: SceneShaders } {
  // Validate all scale declarations, including selectors that match no object.
  // Keep selectors and empty rules for the existing semantic identity checks.
  const scaleRules = ast.rules.map(rule => ({
    selector: rule.selector.text,
    values: rule.declarations.filter(field => field.property.text === 'scale').map(field => {
      if (field.literals.length !== 3) {
        fail('Scale requires exactly three numeric literals', field.literals[0] ?? field.property);
      }
      const values = field.literals.map(token => {
        if (!NUMBER.test(token.text)) fail('Scale requires finite numeric literals', token);
        const value = Number(token.text);
        if (!Number.isFinite(value) || value < .01 || value > 100) {
          fail('Scale must be finite and within 0.01 to 100', token);
        }
        return value;
      });
      return values as Vec3;
    }),
  }));

  let versionSeen = false;
  const declarations: SceneAst['declarations'] = ast.declarations.map(declaration => {
    if (declaration.kind !== 'header' || declaration.field.property.text !== 'version') return declaration;
    const field = declaration.field;
    if (versionSeen) fail('Duplicate scene version', field.property);
    if (field.literals.length !== 1 || field.literals[0].text !== '2') {
      fail('Expected scene version 2', field.literals[0] ?? field.property);
    }
    versionSeen = true;
    // Only this copied literal changes. Original text and token ranges never change.
    return { ...declaration, field: { ...field,
      literals: [{ ...field.literals[0], text: '1' }] } };
  });
  if (!versionSeen) fail('Scene requires version: 2;', ast.header);
  const semanticView: SceneAst = {
    ...ast, sourceVersion: 1, declarations,
    rules: ast.rules.map(rule => ({ ...rule,
      declarations: rule.declarations.filter(field => field.property.text !== 'scale') })),
  };
  // The actual analyzer returns Source1 for this explicit internal sourceVersion1 view.
  // This private view is neither returned nor persisted as original Source2 authority.
  const baseScene = analyzeSceneAst(semanticView) as Scene1;
  const scales = baseScene.objects.map(object => {
    let scale: Vec3 = [1, 1, 1], specificity = -1;
    for (const rule of scaleRules) {
      const score = rule.selector === '#' + object.id ? 1 : rule.selector === object.type ? 0 : -1;
      if (score < 0 || score < specificity || rule.values.length === 0) continue;
      specificity = score;
      scale = [...rule.values[rule.values.length - 1]] as Vec3;
    }
    return scale;
  });

  let shaders: SceneShaders;
  try { shaders = lowerAffineSceneShaders(baseScene, scales); }
  catch (cause) {
    if (cause instanceof SceneError) throw cause;
    const error = sourceError('Affine scene shader lowering failed');
    Object.defineProperty(error, 'cause', { value: cause, configurable: true, writable: true });
    throw error;
  }
  const scene: AffineScene2 = {
    version: 2, name: baseScene.name, background: [...baseScene.background] as RGB,
    objects: baseScene.objects.map((object, index) => ({ ...copyGpuData(object),
      scaleXYZ: [...scales[index]] as Vec3 })),
  };
  freezeGpuData(scene);
  const trustedShaders = freezeGpuData({ vertex: shaders.vertex, fragment: shaders.fragment });
  return Object.freeze({ scene, shaders: trustedShaders });
}
