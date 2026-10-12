import {prepareRenderNativeLightDocument, createRenderMaterialSession, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeLightDocument} from '@barocss/render-editor';
import {compileMeshMaterial} from '@barocss/gpu';

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
export interface BodyFields {
  bodyId: string; position: [string, string, string]; scale: [string, string, string];
}
export interface MaterialUniformFields {
  name: string; override: boolean; value: string; min: number; max: number; defaultValue: string;
}
export interface MaterialFields {
  target: RenderNativeLightDocument['surfaceMaterials'][number]['target'];
  documentId: string; revision: number; uniforms: MaterialUniformFields[];
}
export interface LightForm {kind: LightKind; ambient: string; lights: LightFields[]; camera: CameraFields; bodies: BodyFields[]; materials: MaterialFields[]}
function declarations(source: string) {
  const result = compileMeshMaterial(source);
  if (!result.ok) throw new RenderEditorError('SOURCE_REFUSED', 'The original material shader could not be compiled.');
  return result.material.uniforms;
}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
function bodyIds(document: RenderNativeLightDocument): readonly string[] {
  const ids = document.nativeOptions.bodyIds;
  if (!Array.isArray(ids)) throw new RenderEditorError('DOCUMENT_INPUT', 'The scene requires its explicit qualified body selection.');
  return ids;
}
export function lightKind(document: RenderNativeLightDocument): LightKind {
  return document.lights.profile === 'native-world-point-linear-v0' ? 'point' : 'directional';
}
export function readLightFields(document: RenderNativeLightDocument): LightForm {
  const catalog = document.lights, camera = document.display.camera;
  const lights = catalog.profile === 'native-world-point-linear-v0'
    ? catalog.lights.map(light => ({...light, vector: light.positionScene, range: text(light.rangeScene)}))
    : catalog.lights.map(light => ({...light, vector: light.directionScene, range: ''}));
  const bodies = bodyIds(document).map(bodyId => {
    const pose = document.display.poses.find(item => item.bodyId === bodyId);
    return {bodyId, position: (pose?.translationMM ?? [0, 0, 0]).map(text) as BodyFields['position'],
      scale: (pose?.scale ?? [1, 1, 1]).map(text) as BodyFields['scale']};
  });
  const materials = document.surfaceMaterials.map(({target, material}) => ({target, documentId: material.documentId, revision: material.revision,
    uniforms: declarations(material.shaderSource).map(uniform => ({name: uniform.name, min: uniform.min, max: uniform.max,
      defaultValue: text(uniform.default), override: Object.hasOwn(material.uniforms, uniform.name),
      value: text(Object.hasOwn(material.uniforms, uniform.name) ? material.uniforms[uniform.name] : uniform.default)})),
  }));
  return {kind: lightKind(document), ambient: text(catalog.ambientStrength), bodies, materials, camera: {
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
  const ids = bodyIds(base);
  if (fields.bodies.length !== ids.length || ids.some((bodyId, index) => fields.bodies[index]?.bodyId !== bodyId))
    throw new RenderEditorError('DOCUMENT_INPUT', 'Body fields must retain the exact qualified body selection and order.');
  const parsedBodies = fields.bodies.map(body => {
    if (body.position.length !== 3 || body.scale.length !== 3)
      throw new RenderEditorError('DOCUMENT_INPUT', 'Body fields require complete position and scale XYZ values.');
    return {bodyId: body.bodyId,
      translationMM: [0, 1, 2].map(index => numeric(body.position[index], 'Body position')),
      scale: [0, 1, 2].map(index => numeric(body.scale[index], 'Body scale'))};
  });
  // Empty poses are authored identity intent, not an instruction to materialize defaults.
  const poses = base.display.poses.length
    ? base.display.poses.map(pose => ({...pose, ...parsedBodies.find(body => body.bodyId === pose.bodyId)!}))
    : parsedBodies.some(body => body.translationMM.some(value => !Object.is(value, 0)) || body.scale.some(value => !Object.is(value, 1)))
      ? parsedBodies.map(body => ({...body, rotationXYZW: [0, 0, 0, 1]})) : [];
  const common = (light: LightFields) => ({nodeId: light.nodeId, label: light.label, enabled: light.enabled,
    colorLinearRGB: light.color.map(value => numeric(value, 'Linear color')),
    intensity: numeric(light.intensity, 'Intensity')});
  const lights = fields.kind === 'point'
    ? fields.lights.map(light => ({...common(light), positionScene: light.vector.map(value => numeric(value, 'World position')), rangeScene: numeric(light.range, 'Range')}))
    : fields.lights.map(light => ({...common(light), directionScene: light.vector.map(value => numeric(value, 'Direction'))}));
  if (fields.materials.length !== base.surfaceMaterials.length)
    throw new RenderEditorError('DOCUMENT_INPUT', 'Material fields must retain the existing body bindings.');
  const surfaceMaterials = base.surfaceMaterials.map((binding, index) => {
    const row = fields.materials[index], targetKeys = Object.keys(binding.target) as (keyof typeof binding.target)[];
    if (!row || row.documentId !== binding.material.documentId || !Object.is(row.revision, binding.material.revision)
      || Object.keys(row.target).length !== targetKeys.length || targetKeys.some(key => !Object.is(row.target[key], binding.target[key])))
      throw new RenderEditorError('DOCUMENT_INPUT', 'Material fields must retain the complete original target and embedded owner.');
    const uniforms = declarations(binding.material.shaderSource);
    if (row.uniforms.length !== uniforms.length || uniforms.some((uniform, i) => row.uniforms[i]?.name !== uniform.name
      || typeof row.uniforms[i]?.override !== 'boolean'))
      throw new RenderEditorError('DOCUMENT_INPUT', 'Material fields must retain the exact shader-declared uniform names and order.');
    const values = new Map(row.uniforms.filter(field => field.override).map(field => [field.name, numeric(field.value, 'Uniform ' + field.name)]));
    // Keep existing supplied-key order; new overrides follow shader declaration order.
    const names = [...Object.keys(binding.material.uniforms).filter(name => values.has(name)),
      ...row.uniforms.filter(field => field.override && !Object.hasOwn(binding.material.uniforms, field.name)).map(field => field.name)];
    const session = createRenderMaterialSession(binding.material);
    try {
      session.setDraftUniforms(Object.fromEntries(names.map(name => [name, values.get(name)!])));
      // Actual material-session ownership decides omission/signed equality and revision overflow.
      return session.getSnapshot().dirty ? {...binding, material: session.prepareDraft().document} : binding;
    } finally {session.dispose();}
  });
  const camera = fields.camera;
  return prepareRenderNativeLightDocument({...base, surfaceMaterials,
    display: {...base.display, poses, camera: {
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
