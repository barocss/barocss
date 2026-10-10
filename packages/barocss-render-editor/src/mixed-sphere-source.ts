import { compileGpu } from '@barocss/gpu';
import type { Scene1, SceneAst, RotatedSceneObject } from '@barocss/gpu';
import { RENDER_MIXED_DOCUMENT_LIMITS, RenderMixedDocumentError } from './mixed-document.js';

export interface RenderMixedSphereProperties {
  readonly objectId: string;
  readonly radius: number;
  readonly translate: readonly [number, number, number];
  readonly color: string;
}
export interface RenderMixedSpherePatch {
  readonly radius?: number;
  readonly translate?: readonly [number, number, number];
  readonly color?: string;
}
interface CompiledSphere { readonly scene: Scene1; readonly ast: SceneAst; readonly object: RotatedSceneObject }
type Field = SceneAst['rules'][number]['declarations'][number];
interface Replacement { readonly start: number; readonly end: number; readonly text: string }

function compileSphere(source: string): CompiledSphere {
  if (typeof source !== 'string') throw new RenderMixedDocumentError('INPUT', 'Sphere source must be a string.');
  if (source.length > RENDER_MIXED_DOCUMENT_LIMITS.sourceCodeUnits
    || new TextEncoder().encode(source).length > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes) {
    throw new RenderMixedDocumentError('BYTES', 'Sphere source exceeds 65536 UTF-8 bytes or code units.');
  }
  const result = compileGpu({ kind: 'scene', source, sourceVersion: 1 });
  if (!result.ok) throw new RenderMixedDocumentError('SOURCE', 'Sphere source could not compile.', result.diagnostics);
  if (result.execution.kind !== 'sdf' || result.execution.scene.version !== 1 || !result.ast
    || result.execution.scene.objects.length !== 1 || result.execution.scene.objects[0]!.type !== 'sphere') {
    throw new RenderMixedDocumentError('QUALIFICATION', 'Sphere properties require exactly one original Source 1 Sphere.');
  }
  return { scene: result.execution.scene, ast: result.ast, object: result.execution.scene.objects[0] as RotatedSceneObject };
}
function colorHex(color: readonly number[]): string {
  return '#' + color.map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join('');
}
function normalizedHex(color: string): string {
  const hex = color.slice(1).toLowerCase();
  return '#' + (hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex);
}
function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  // Actual GPU source semantics normalize numeric -0 to 0. Keep equivalent text.
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function copyPatch(input: unknown): RenderMixedSpherePatch {
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new RenderMixedDocumentError('INPUT', 'Sphere patch must be a plain data object.');
  }
  const allowed = ['radius', 'translate', 'color'], keys = Reflect.ownKeys(input);
  if (keys.length === 0 || keys.length > allowed.length || keys.some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    throw new RenderMixedDocumentError('INPUT', 'Sphere patch needs radius, translate or color without additional fields.');
  }
  const patch: { radius?: number; translate?: readonly [number, number, number]; color?: string } = {};
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new RenderMixedDocumentError('INPUT', `Sphere ${key} must be own enumerable data.`);
    }
    const value: unknown = descriptor.value;
    if (key === 'radius') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000 || Math.fround(value) <= 0) {
        throw new RenderMixedDocumentError('INPUT', 'Sphere radius must be positive, at most 1000, and positive in Float32.');
      }
      patch.radius = value;
    } else if (key === 'color') {
      if (typeof value !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
        throw new RenderMixedDocumentError('INPUT', 'Sphere color must be opaque #rgb or #rrggbb.');
      }
      patch.color = value;
    } else {
      if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== 4) {
        throw new RenderMixedDocumentError('INPUT', 'Sphere position must be a dense plain XYZ array.');
      }
      const length = Object.getOwnPropertyDescriptor(value, 'length');
      if (!length || !('value' in length) || length.value !== 3) {
        throw new RenderMixedDocumentError('INPUT', 'Sphere position must have three own elements.');
      }
      const translate: number[] = [];
      for (let axis = 0; axis < 3; axis++) {
        const element = Object.getOwnPropertyDescriptor(value, String(axis));
        if (!element || !('value' in element) || !element.enumerable || typeof element.value !== 'number'
          || !Number.isFinite(element.value) || Math.abs(element.value) > 1000) {
          throw new RenderMixedDocumentError('INPUT', 'Sphere position must contain finite own values from -1000 to 1000.');
        }
        translate.push(element.value);
      }
      patch.translate = Object.freeze(translate) as unknown as readonly [number, number, number];
    }
  }
  return Object.freeze(patch);
}

/** Read effective defaults and selector cascade from the actual GPU compiler. */
export function inspectRenderMixedSphereSource(source: string): RenderMixedSphereProperties {
  const { object } = compileSphere(source);
  return Object.freeze({ objectId: object.id, radius: object.radius,
    translate: Object.freeze([...object.translate]) as readonly [number, number, number], color: colorHex(object.color) });
}

/** Change selected original literal tokens, retaining every other source byte. */
export function editRenderMixedSphereSource(source: string, objectId: string, patch: RenderMixedSpherePatch): string {
  const desired = copyPatch(patch), before = compileSphere(source);
  if (typeof objectId !== 'string') throw new RenderMixedDocumentError('INPUT', 'Sphere object ID must be a string.');
  if (objectId !== before.object.id) throw new RenderMixedDocumentError('QUALIFICATION', 'Sphere object ID does not match the original source.');
  const changes: { property: 'radius' | 'translate' | 'color'; values: readonly string[]; numeric?: readonly number[] }[] = [];
  if (desired.radius !== undefined && desired.radius !== before.object.radius) {
    changes.push({ property: 'radius', values: [String(desired.radius)], numeric: [desired.radius] });
  }
  if (desired.translate !== undefined && !sameNumbers(desired.translate, before.object.translate)) {
    changes.push({ property: 'translate', values: desired.translate.map((value) => Object.is(value, -0) ? '-0' : String(value)), numeric: desired.translate });
  }
  if (desired.color !== undefined && normalizedHex(desired.color) !== colorHex(before.object.color)) {
    changes.push({ property: 'color', values: [desired.color] });
  }
  if (changes.length === 0) return source;
  const replacements: Replacement[] = [], overrides: string[] = [];
  for (const change of changes) {
    let field: Field | undefined;
    for (const rule of before.ast.rules) if (rule.selector.text === `#${objectId}`) {
      for (const declaration of rule.declarations) if (declaration.property.text === change.property) field = declaration;
    }
    if (!field) { overrides.push(`${change.property}: ${change.values.join(' ')};`); continue; }
    if (field.literals.length !== change.values.length) {
      throw new RenderMixedDocumentError('SOURCE', 'Compiled Sphere property has an unexpected literal count.');
    }
    field.literals.forEach((literal, index) => {
      // Leave semantically unchanged individual coordinate spellings untouched.
      if (change.numeric && Number(literal.text) === change.numeric[index]) return;
      replacements.push({ start: literal.range.start, end: literal.range.end, text: change.values[index] });
    });
  }
  let output = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);
  }
  if (overrides.length) {
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const separator = /[\r\n\u2028\u2029]$/.test(output) ? '' : newline;
    output += `${separator}#${objectId} { ${overrides.join(' ')} }${newline}`;
  }
  const after = compileSphere(output);
  const expectedRadius = desired.radius ?? before.object.radius;
  const expectedTranslate = desired.translate ?? before.object.translate;
  const expectedColor = desired.color === undefined ? colorHex(before.object.color) : normalizedHex(desired.color);
  if (after.scene.name !== before.scene.name || after.object.id !== before.object.id || after.object.type !== before.object.type
    || !sameNumbers(after.scene.background, before.scene.background) || !sameNumbers(after.object.rotateDegrees, before.object.rotateDegrees)
    || !sameNumbers(after.object.size, before.object.size) || after.object.radius !== expectedRadius
    || !sameNumbers(after.object.translate, expectedTranslate) || colorHex(after.object.color) !== expectedColor) {
    throw new RenderMixedDocumentError('SOURCE', 'Sphere edit did not preserve the requested properties and unrelated scene semantics.');
  }
  return output;
}
