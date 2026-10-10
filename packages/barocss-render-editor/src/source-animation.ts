import { prepareEngineScene, sampleEngineTranslationClip, validateMeshCamera } from '@barocss/gpu';
import type { MeshCamera } from '@barocss/gpu';
import { RenderEditorError } from './errors.js';
import { editRenderSceneObjectSource, inspectRenderSceneObjects } from './scene-object-source.js';

export interface RenderSceneAnimationKeyV0 {
  readonly timeSeconds: number;
  readonly translation: readonly [number, number, number];
}
export interface RenderSceneAnimationTrackV0 {
  readonly objectId: string;
  readonly keys: readonly RenderSceneAnimationKeyV0[];
}
export interface RenderSceneAnimationClipV0 {
  readonly format: 'barocss-render-editor-translation-clip';
  readonly version: 0;
  readonly id: string;
  readonly timeUnit: 'seconds';
  readonly interpolation: 'linear';
  readonly tracks: readonly RenderSceneAnimationTrackV0[];
}
function refuse(message: string): never { throw new RenderEditorError('DOCUMENT_INPUT', message); }
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) refuse('Animation requires plain own data.');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) refuse('Animation has missing or unsupported fields.');
  const copied: Record<string, unknown> = {};
  for (const key of fields) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d || !('value' in d) || !d.enumerable) refuse('Animation fields require own enumerable data.');
    copied[key] = d.value;
  }
  return copied;
}
function array(input: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) refuse('Animation requires dense own arrays.');
  const d = Object.getOwnPropertyDescriptor(input, 'length');
  if (!d || !('value' in d) || !Number.isInteger(d.value) || d.value < min || d.value > max) refuse('Animation array exceeds its count limit.');
  if (Reflect.ownKeys(input).length !== d.value + 1) refuse('Animation arrays cannot contain holes or extra fields.');
  const result: unknown[] = [];
  for (let i = 0; i < d.value; i++) {
    const item = Object.getOwnPropertyDescriptor(input, String(i));
    if (!item || !('value' in item) || !item.enumerable) refuse('Animation array items require own enumerable data.');
    result.push(item.value);
  }
  return result;
}
function number(input: unknown, min: number, max: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max) refuse(`Animation values require finite Numbers in ${min}..${max}.`);
  return input;
}
function copyClip(input: unknown): RenderSceneAnimationClipV0 {
  const data = record(input, ['format', 'version', 'id', 'timeUnit', 'interpolation', 'tracks']);
  if (data.format !== 'barocss-render-editor-translation-clip' || data.version !== 0 || data.timeUnit !== 'seconds' || data.interpolation !== 'linear') {
    throw new RenderEditorError('DOCUMENT_VERSION', 'Only Source translation clip0 in seconds with linear interpolation is supported.');
  }
  if (typeof data.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(data.id)) refuse('Animation clip ID requires an ASCII identifier of 1..48 characters.');
  let total = 0;
  const rows = array(data.tracks, 0, 32).map(input => {
    const row = record(input, ['objectId', 'keys']);
    if (typeof row.objectId !== 'string' || !row.objectId.length || row.objectId.length > 65536) refuse('Animation object references require original Source IDs.');
    const keys = array(row.keys, 1, 32); total += keys.length;
    if (total > 512) refuse('Animation exceeds 512 total keys.');
    return { objectId: row.objectId, keys };
  });
  const tracks = rows.map(row => {
    let previous: number | undefined;
    const keys = row.keys.map(input => {
      const key = record(input, ['timeSeconds', 'translation']), timeSeconds = number(key.timeSeconds, 0, 3600);
      if (previous !== undefined && (!(timeSeconds > previous) || timeSeconds - previous < 1e-6)) refuse('Key times require increasing order and at least 0.000001 seconds between keys.');
      previous = timeSeconds;
      const translation = Object.freeze(array(key.translation, 3, 3).map(value => number(value, -1000, 1000))) as unknown as readonly [number, number, number];
      return Object.freeze({ timeSeconds, translation });
    });
    return Object.freeze({ objectId: row.objectId, keys: Object.freeze(keys) });
  });
  return Object.freeze({ format: 'barocss-render-editor-translation-clip', version: 0, id: data.id,
    timeUnit: 'seconds', interpolation: 'linear', tracks: Object.freeze(tracks) });
}
function admitted(source: string, input: unknown, camera: MeshCamera, time: number) {
  const clip = copyClip(input), objects = inspectRenderSceneObjects(source);
  const aliases = new Map(objects.map((object, index) => [object.objectId, `object_${index}`]));
  const seen = new Set<string>();
  for (const track of clip.tracks) {
    if (!aliases.has(track.objectId) || seen.has(track.objectId)) refuse('Animation tracks require unique existing original Source object IDs.');
    seen.add(track.objectId);
  }
  const ownedCamera = validateMeshCamera(camera);
  const scene = prepareEngineScene({ format: 'barocss-gpu-engine-scene', version: 0, id: 'source_animation_rig',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera: ownedCamera,
    geometries: [], materials: [], nodes: objects.map(object => ({ id: aliases.get(object.objectId), type: 'group',
      parentId: null, translation: [...object.translate], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true })) }).scene;
  const sampled = sampleEngineTranslationClip(scene, { format: 'barocss-gpu-engine-translation-clip', version: 0,
    id: clip.id, sceneId: scene.id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', timeUnit: 'seconds',
    interpolation: 'linear', tracks: clip.tracks.map(track => ({ nodeId: aliases.get(track.objectId), keys: track.keys.map(key => ({
      timeSeconds: key.timeSeconds, translation: [...key.translation] })) })) },
  { format: 'barocss-gpu-engine-translation-clip-request', version: 0, timeSeconds: time });
  return { clip, aliases, sampled };
}
function withCause<T>(work: () => T): T {
  try { return work(); } catch (cause) {
    if (cause instanceof RenderEditorError) throw cause;
    const error = new RenderEditorError('DOCUMENT_INPUT', 'Actual animation admission refused.');
    Object.defineProperty(error, 'cause', { value: cause, configurable: true }); throw error;
  }
}
/** Copy original references and keys; temporary group aliases are never persisted. */
export function validateRenderSceneAnimationClip(sceneSource: string, input: unknown, camera: MeshCamera): RenderSceneAnimationClipV0 {
  return withCause(() => admitted(sceneSource, input, camera, 0).clip);
}
/** Sample the actual GPU translation clip and write only tracked Source translations. */
export function sampleRenderSceneAnimationSource(sceneSource: string, clip: RenderSceneAnimationClipV0, camera: MeshCamera, timeSeconds: number): string {
  return withCause(() => {
    const result = admitted(sceneSource, clip, camera, number(timeSeconds, 0, 3600));
    let source = sceneSource;
    for (const track of result.clip.tracks) {
      const node = result.sampled.scene.nodes.find(node => node.id === result.aliases.get(track.objectId))!;
      source = editRenderSceneObjectSource(source, track.objectId, { translate: node.translation });
    }
    return source;
  });
}
