import {prepareRenderNativeDirectionalLightDocument, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeDirectionalLightDocumentV1} from '@barocss/render-editor';

export interface DirectionalLightFields {
  nodeId: string; label: string; enabled: boolean;
  direction: [string, string, string]; color: [string, string, string]; intensity: string;
}
export interface DirectionalLightForm {ambient: string; lights: DirectionalLightFields[]}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function readDirectionalLightFields(document: RenderNativeDirectionalLightDocumentV1): DirectionalLightForm {
  return {ambient: text(document.lights.ambientStrength), lights: document.lights.lights.map(light => ({
    nodeId: light.nodeId, label: light.label, enabled: light.enabled,
    direction: light.directionScene.map(text) as DirectionalLightFields['direction'],
    color: light.colorLinearRGB.map(text) as DirectionalLightFields['color'], intensity: text(light.intensity),
  }))};
}
function numeric(value: string, label: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) || !Number.isFinite(Number(value)))
    throw new RenderEditorError('DOCUMENT_INPUT', label + ' requires a finite decimal number.');
  return Number(value);
}
/** Fields are corrective text. Only explicit Apply qualifies a complete original document. */
export function applyDirectionalLightFields(base: RenderNativeDirectionalLightDocumentV1, fields: DirectionalLightForm): RenderNativeDirectionalLightDocumentV1 {
  return prepareRenderNativeDirectionalLightDocument({...base, lights: {...base.lights,
    ambientStrength: numeric(fields.ambient, 'Ambient'), lights: fields.lights.map(light => ({
      nodeId: light.nodeId, label: light.label, enabled: light.enabled,
      directionScene: light.direction.map(value => numeric(value, 'Direction')),
      colorLinearRGB: light.color.map(value => numeric(value, 'Linear color')),
      intensity: numeric(light.intensity, 'Intensity'),
    })),
  }}).document;
}
export function addDirectionalLightFields(fields: DirectionalLightForm): DirectionalLightForm {
  if (fields.lights.length >= 4) throw new RenderEditorError('DOCUMENT_INPUT', 'This profile admits at most four directional lights.');
  let index = 1;
  while (fields.lights.some(light => light.nodeId === 'directional-' + index)) index++;
  return {...fields, lights: [...fields.lights, {nodeId: 'directional-' + index, label: 'Directional ' + index,
    enabled: true, direction: ['1', '1', '1'], color: ['1', '1', '1'], intensity: '.5'}]};
}
export function directionalLightFieldsDirty(fields: DirectionalLightForm, accepted: RenderNativeDirectionalLightDocumentV1): boolean {
  return JSON.stringify(fields) !== JSON.stringify(readDirectionalLightFields(accepted));
}
