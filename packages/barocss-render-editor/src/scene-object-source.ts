import { compileGpu } from '@barocss/gpu';
import type { Scene1, SceneAst, SceneObject1 } from '@barocss/gpu';
import { validateRenderEditorSourceInput } from './document.js';
import { RenderEditorError } from './errors.js';

export type RenderSceneObjectKind = SceneObject1['type'];
type XYZ = readonly [number, number, number];
export interface RenderSceneObjectProperties {
  readonly objectId: string;
  readonly type: RenderSceneObjectKind;
  readonly translate: XYZ;
  readonly rotateDegrees: XYZ;
  readonly color: string;
  readonly radius?: number;
  readonly size?: XYZ;
  readonly height?: number;
  readonly start?: XYZ;
  readonly end?: XYZ;
  readonly majorRadius?: number;
  readonly minorRadius?: number;
}
export interface RenderSceneObjectPatch {
  readonly translate?: XYZ;
  readonly rotateDegrees?: XYZ;
  readonly color?: string;
  readonly radius?: number;
  readonly size?: XYZ;
  readonly height?: number;
  readonly start?: XYZ;
  readonly end?: XYZ;
  readonly majorRadius?: number;
  readonly minorRadius?: number;
}
interface CompiledScene { readonly scene: Scene1; readonly ast: SceneAst }
interface Replacement { readonly start: number; readonly end: number; readonly text: string }
type Field = SceneAst['rules'][number]['declarations'][number];
type PatchKey = keyof RenderSceneObjectPatch;
const KINDS: readonly RenderSceneObjectKind[] = ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'];
const COMMON: readonly PatchKey[] = ['translate', 'rotateDegrees', 'color'];
const DIMENSIONS: Record<RenderSceneObjectKind, readonly PatchKey[]> = {
  sphere: ['radius'], box: ['size'], cylinder: ['radius', 'height'], capsule: ['radius', 'start', 'end'],
  'rounded-box': ['radius', 'size'], torus: ['majorRadius', 'minorRadius'],
};
function input(message: string): RenderEditorError { return new RenderEditorError('DOCUMENT_INPUT', message); }
function compiled(source: string): CompiledScene {
  validateRenderEditorSourceInput(source);
  const result = compileGpu({ kind: 'scene', source, sourceVersion: 1 });
  if (!result.ok) throw new RenderEditorError('SOURCE_REFUSED', 'Scene source could not compile.', result.diagnostics);
  if (result.execution.kind !== 'sdf' || result.execution.scene.version !== 1 || !result.ast) {
    throw new RenderEditorError('SOURCE_REFUSED', 'Scene object tools require original Source 1 SDF input.');
  }
  return { scene: result.execution.scene, ast: result.ast };
}
function id(inputId: unknown): asserts inputId is string {
  if (typeof inputId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(inputId)) throw input('Object ID must be an ASCII identifier of 1..48 characters.');
}
function existingId(inputId: unknown): asserts inputId is string {
  if (typeof inputId !== 'string' || inputId.length === 0 || inputId.length > 65536) throw input('Existing object ID must be a bounded original string.');
}
function hex(rgb: readonly number[]): string { return '#' + rgb.map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join(''); }
function rgb(color: string): [number, number, number] {
  const text = color.slice(1), expanded = text.length === 3 ? [...text].map((digit) => digit + digit).join('') : text;
  return [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}
function ownedVector(value: unknown, label: string, min: number, max: number, positive = false): XYZ {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== 4) throw input(`${label} must be a dense plain XYZ array.`);
  const length = Object.getOwnPropertyDescriptor(value, 'length');
  if (!length || !('value' in length) || length.value !== 3) throw input(`${label} must have exactly three elements.`);
  const copy: number[] = [];
  for (let axis = 0; axis < 3; axis++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(axis));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number'
      || !Number.isFinite(descriptor.value) || descriptor.value < min || descriptor.value > max
      || (positive && (descriptor.value <= 0 || Math.fround(descriptor.value) <= 0))) throw input(`${label} has an invalid numeric element.`);
    copy.push(descriptor.value);
  }
  return Object.freeze(copy) as unknown as XYZ;
}
function patchCopy(value: unknown, kind: RenderSceneObjectKind): RenderSceneObjectPatch {
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw input('Object patch must be a plain data object.');
  const allowed = [...COMMON, ...DIMENSIONS[kind]], keys = Reflect.ownKeys(value);
  if (!keys.length || keys.some((key) => typeof key !== 'string' || !allowed.includes(key as PatchKey))) throw input('Object patch has no fields or fields unsupported by this kind.');
  const copy: Record<string, number | string | XYZ> = {};
  for (const key of keys as PatchKey[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw input(`Object ${key} must be own enumerable data.`);
    const item: unknown = descriptor.value;
    if (key === 'color') {
      if (typeof item !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(item)) throw input('Color must be opaque #rgb or #rrggbb.');
      copy[key] = item;
    } else if (['translate', 'rotateDegrees', 'size', 'start', 'end'].includes(key)) {
      copy[key] = ownedVector(item, key, key === 'size' ? 0 : key === 'rotateDegrees' ? -360 : -1000,
        key === 'rotateDegrees' ? 360 : 1000, key === 'size');
    } else {
      if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0 || item > 1000 || Math.fround(item) <= 0) throw input(`${key} must be positive, at most 1000, and positive in Float32.`);
      copy[key] = item;
    }
  }
  return Object.freeze(copy) as RenderSceneObjectPatch;
}
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function text(value: number): string { return Object.is(value, -0) ? '-0' : String(value); }
function vectorCopy(value: readonly number[]): XYZ { return Object.freeze([...value]) as XYZ; }
function appendRule(source: string, objectId: string, declarations: readonly string[]): string {
  if (!declarations.length) return source;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return source + (/[\r\n\u2028\u2029]$/.test(source) ? '' : newline) + `#${objectId} { ${declarations.join(' ')} }${newline}`;
}
function replace(source: string, replacements: Replacement[]): string {
  for (const part of replacements.sort((a, b) => b.start - a.start)) source = source.slice(0, part.start) + part.text + source.slice(part.end);
  return source;
}
function assertUnchanged(before: Scene1, after: Scene1, objects: readonly SceneObject1[]): void {
  if (before.name !== after.name || before.version !== after.version || !same(before.background, after.background) || !same(objects, after.objects)) {
    throw new RenderEditorError('SOURCE_REFUSED', 'The object edit changed unrelated scene semantics.');
  }
}

/** Effective Source1 values come from the real compiler, including its cascade. */
export function inspectRenderSceneObjects(source: string): readonly RenderSceneObjectProperties[] {
  return Object.freeze(compiled(source).scene.objects.map((object) => Object.freeze({ objectId: object.id, type: object.type,
    translate: vectorCopy(object.translate), rotateDegrees: vectorCopy(object.rotateDegrees), color: hex(object.color),
    ...(['sphere', 'cylinder', 'capsule', 'rounded-box'].includes(object.type) ? { radius: object.radius } : {}),
    ...(['box', 'rounded-box'].includes(object.type) ? { size: vectorCopy(object.size) } : {}),
    ...('height' in object ? { height: object.height } : {}), ...('start' in object ? { start: vectorCopy(object.start), end: vectorCopy(object.end) } : {}),
    ...('majorRadius' in object ? { majorRadius: object.majorRadius, minorRadius: object.minorRadius } : {}),
  })));
}

/** Edit only the selected object's last exact-ID literal tokens or narrow override. */
export function editRenderSceneObjectSource(source: string, objectId: string, patch: RenderSceneObjectPatch): string {
  existingId(objectId);
  const before = compiled(source), selected = before.scene.objects.find((object) => object.id === objectId);
  if (!selected) throw input('Object ID does not exist in the original scene.');
  const desired = patchCopy(patch, selected.type), expected = { ...selected } as SceneObject1;
  const replacements: Replacement[] = [], additions: string[] = [];
  const change = (property: string, values: readonly string[], numbers?: readonly number[], degrees = false) => {
    let field: Field | undefined;
    for (const rule of before.ast.rules) if (rule.selector.text === `#${objectId}`) {
      for (const declaration of rule.declarations) if (declaration.property.text === property) field = declaration;
    }
    if (!field) { additions.push(`${property}: ${values.join(' ')};`); return; }
    if (field.literals.length !== values.length) throw new RenderEditorError('SOURCE_REFUSED', 'Compiled property literal count is unexpected.');
    field.literals.forEach((literal, index) => {
      if (numbers && Number(degrees ? literal.text.slice(0, -3) : literal.text) === numbers[index]) return;
      replacements.push({ start: literal.range.start, end: literal.range.end, text: values[index] });
    });
  };
  for (const key of Object.keys(desired) as PatchKey[]) {
    const value = desired[key]!;
    const previous = (selected as unknown as Record<string, unknown>)[key];
    if (key === 'color') {
      const color = rgb(value as string); if (same(color, selected.color)) continue;
      expected.color = color; change('color', [value as string]);
    } else if (key === 'rotateDegrees') {
      const rotation = value as XYZ; if (same(rotation, selected.rotateDegrees)) continue;
      expected.rotateDegrees = [...rotation];
      rotation.forEach((angle, axis) => { if (angle !== selected.rotateDegrees[axis]) change(['rotate-x', 'rotate-y', 'rotate-z'][axis]!, [`${text(angle)}deg`], [angle], true); });
    } else {
      if (same(value, previous)) continue;
      (expected as unknown as Record<string, unknown>)[key] = Array.isArray(value) ? [...value] : value;
      const property = key === 'majorRadius' ? 'major-radius' : key === 'minorRadius' ? 'minor-radius' : key;
      const numbers = typeof value === 'number' ? [value] : value as XYZ;
      change(property, numbers.map(text), numbers);
    }
  }
  if (!replacements.length && !additions.length) return source;
  const output = appendRule(replace(source, replacements), objectId, additions), after = compiled(output);
  assertUnchanged(before.scene, after.scene, before.scene.objects.map((object) => object.id === objectId ? expected : object));
  return output;
}

/** Add one independently identified object with explicit ID-level defaults. */
export function addRenderSceneObjectSource(source: string, kind: RenderSceneObjectKind, newId: string): string {
  id(newId);
  if (typeof kind !== 'string' || !KINDS.includes(kind)) throw input('Object kind is unsupported by Source 1.');
  const before = compiled(source);
  if (before.scene.objects.some((object) => object.id === newId)) throw input('New object ID already exists.');
  const last = before.ast.declarations.at(-1);
  if (!last) throw new RenderEditorError('SOURCE_REFUSED', 'Compiled scene declaration boundary is unavailable.');
  const defaults: Record<RenderSceneObjectKind, readonly string[]> = {
    sphere: ['radius: 1;'], box: ['size: 2 2 2;'], cylinder: ['radius: 1;', 'height: 2;'],
    capsule: ['radius: 1;', 'start: 0 -1 0;', 'end: 0 1 0;'], 'rounded-box': ['radius: 0.25;', 'size: 2 2 2;'], torus: ['major-radius: 1;', 'minor-radius: 0.25;'],
  };
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const withDeclaration = source.slice(0, last.range.end) + `${newline} ${kind} #${newId};` + source.slice(last.range.end);
  const output = appendRule(withDeclaration, newId, ['color: #e08040;', 'translate: 0 0 0;', 'rotate-x: 0deg;', 'rotate-y: 0deg;', 'rotate-z: 0deg;', ...defaults[kind]]);
  const after = compiled(output), added = after.scene.objects.at(-1)!;
  if (added.id !== newId || added.type !== kind) throw new RenderEditorError('SOURCE_REFUSED', 'Added object identity was not retained.');
  assertUnchanged(before.scene, after.scene, [...before.scene.objects, added]);
  return output;
}

/** Duplicate effective compiler values into a fresh exact-ID rule; original text stays intact. */
export function duplicateRenderSceneObjectSource(source: string, objectId: string, newId: string): string {
  existingId(objectId); id(newId);
  try {
    const before = compiled(source), selected = before.scene.objects.find(object => object.id === objectId);
    if (!selected) throw input('Object ID does not exist in the original scene.');
    if (before.scene.objects.some(object => object.id === newId)) throw input('New object ID already exists.');
    const last = before.ast.declarations.at(-1);
    if (!last) throw new RenderEditorError('SOURCE_REFUSED', 'Compiled scene declaration boundary is unavailable.');
    const color = hex(selected.color);
    if (!same(rgb(color), selected.color)) throw new RenderEditorError('SOURCE_REFUSED', 'The effective color cannot be copied exactly with supported opaque Source colors.');
    const declarations = [`color: ${color};`, `translate: ${selected.translate.map(text).join(' ')};`,
      ...selected.rotateDegrees.map((value, axis) => `${['rotate-x', 'rotate-y', 'rotate-z'][axis]}: ${text(value)}deg;`)];
    for (const key of DIMENSIONS[selected.type]) {
      const value = (selected as unknown as Record<string, number | readonly number[]>)[key]!;
      const property = key === 'majorRadius' ? 'major-radius' : key === 'minorRadius' ? 'minor-radius' : key;
      declarations.push(`${property}: ${(typeof value === 'number' ? [value] : value).map(text).join(' ')};`);
    }
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const withDeclaration = source.slice(0, last.range.end) + `${newline} ${selected.type} #${newId};` + source.slice(last.range.end);
    const output = appendRule(withDeclaration, newId, declarations), after = compiled(output);
    assertUnchanged(before.scene, after.scene, [...before.scene.objects, {...selected, id: newId}]);
    return output;
  } catch (error) {
    if (error instanceof RenderEditorError && error.code === 'DOCUMENT_BYTES') {
      const refused = new RenderEditorError('SOURCE_REFUSED', error.message, error.diagnostics);
      Object.defineProperty(refused, 'cause', {value: error, configurable: true});
      throw refused;
    }
    throw error;
  }
}

/** Remove the original declaration and all exact-ID rules; type styles stay intact. */
export function removeRenderSceneObjectSource(source: string, objectId: string): string {
  existingId(objectId);
  const before = compiled(source), declaration = before.ast.declarations.find((item) => item.kind === 'object' && item.id.text === `#${objectId}`);
  if (!declaration) throw input('Object ID does not exist in the original scene.');
  const removed = [{ start: declaration.range.start, end: declaration.range.end, text: '' },
    ...before.ast.rules.filter((rule) => rule.selector.text === `#${objectId}`).map((rule) => ({ start: rule.range.start, end: rule.range.end, text: '' }))];
  const output = replace(source, removed), after = compiled(output);
  assertUnchanged(before.scene, after.scene, before.scene.objects.filter((object) => object.id !== objectId));
  return output;
}
