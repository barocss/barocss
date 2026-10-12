import {prepareRenderNativeLightDocument, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeLightDocument} from '@barocss/render-editor';

export type LightKind = 'directional' | 'point';
export interface LightFields {
  nodeId: string; label: string; enabled: boolean;
  vector: [string, string, string]; range: string;
  color: [string, string, string]; intensity: string;
}
export interface CameraFields {
  eye: [string, string, string]; target: [string, string, string]; up: [string, string, string];
  fovYDegrees: string; near: string; far: string;
}
export interface LightForm {kind: LightKind; ambient: string; lights: LightFields[]; camera: CameraFields}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function lightKind(document: RenderNativeLightDocument): LightKind {
  return document.lights.profile === 'native-world-point-linear-v0' ? 'point' : 'directional';
}
export function readLightFields(document: RenderNativeLightDocument): LightForm {
  const catalog = document.lights, camera = document.display.camera;
  const lights = catalog.profile === 'native-world-point-linear-v0'
    ? catalog.lights.map(light => ({...light, vector: light.positionScene, range: text(light.rangeScene)}))
    : catalog.lights.map(light => ({...light, vector: light.directionScene, range: ''}));
  return {kind: lightKind(document), ambient: text(catalog.ambientStrength), camera: {
    eye: camera.eye.map(text) as CameraFields['eye'], target: camera.target.map(text) as CameraFields['target'],
    up: camera.up.map(text) as CameraFields['up'], fovYDegrees: text(camera.fovYDegrees), near: text(camera.near), far: text(camera.far),
  }, lights: lights.map(light => ({
    nodeId: light.nodeId, label: light.label, enabled: light.enabled,
    vector: light.vector.map(text) as LightFields['vector'], range: light.range,
    color: light.colorLinearRGB.map(text) as LightFields['color'], intensity: text(light.intensity),
  }))};
}
function numeric(value: string, label: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) || !Number.isFinite(Number(value)))
    throw new RenderEditorError('DOCUMENT_INPUT', label + ' requires a finite decimal number.');
  return Number(value);
}
/** Corrective text is not accepted authorship. The fixed workspace kind cannot be changed by fields. */
export function applyLightFields(base: RenderNativeLightDocument, fields: LightForm): RenderNativeLightDocument {
  if (fields.kind !== lightKind(base)) throw new RenderEditorError('DOCUMENT_INPUT', 'Use a new workspace to change the light kind.');
  const common = (light: LightFields) => ({nodeId: light.nodeId, label: light.label, enabled: light.enabled,
    colorLinearRGB: light.color.map(value => numeric(value, 'Linear color')),
    intensity: numeric(light.intensity, 'Intensity')});
  const lights = fields.kind === 'point'
    ? fields.lights.map(light => ({...common(light), positionScene: light.vector.map(value => numeric(value, 'World position')), rangeScene: numeric(light.range, 'Range')}))
    : fields.lights.map(light => ({...common(light), directionScene: light.vector.map(value => numeric(value, 'Direction'))}));
  const camera = fields.camera;
  return prepareRenderNativeLightDocument({...base,
    display: {...base.display, camera: {
      eye: camera.eye.map(value => numeric(value, 'Camera eye')),
      target: camera.target.map(value => numeric(value, 'Camera target')),
      up: camera.up.map(value => numeric(value, 'Camera up')),
      fovYDegrees: numeric(camera.fovYDegrees, 'Vertical FOV'), near: numeric(camera.near, 'Near clip'), far: numeric(camera.far, 'Far clip'),
    }}, lights: {...base.lights, ambientStrength: numeric(fields.ambient, 'Ambient'), lights}}).document;
}
export function addLightFields(fields: LightForm): LightForm {
  if (fields.lights.length >= 4) throw new RenderEditorError('DOCUMENT_INPUT', 'This workspace admits at most four lights.');
  let index = 1; while (fields.lights.some(light => light.nodeId === fields.kind + '-' + index)) index++;
  return {...fields, lights: [...fields.lights, {nodeId: fields.kind + '-' + index,
    label: (fields.kind === 'point' ? 'Point ' : 'Directional ') + index, enabled: true,
    vector: fields.kind === 'point' ? ['0', '1', '2'] : ['1', '1', '1'], range: fields.kind === 'point' ? '10' : '',
    color: ['1', '1', '1'], intensity: '.5'}]};
}
export function lightFieldsDirty(fields: LightForm, accepted: RenderNativeLightDocument): boolean {
  return JSON.stringify(fields) !== JSON.stringify(readLightFields(accepted));
}
