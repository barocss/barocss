import {prepareRenderNativeLightDocument, createRenderNativeLightRequest, createRenderMaterialSession, deriveRenderMaterialAssignment, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeLightDocument, RenderMaterialDocument} from '@barocss/render-editor';
import {compileMeshMaterial} from '@barocss/gpu';
import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';

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
  rotation: [string, string, string, string];
}
export type LightRotationAxis = 'x' | 'y' | 'z';
export type LightRotationSpace = 'local' | 'world';
export interface MaterialUniformFields {
  name: string; override: boolean; value: string; min: number; max: number; defaultValue: string;
}
export interface MaterialFields {
  target: RenderNativeLightDocument['surfaceMaterials'][number]['target'];
  documentId: string; revision: number; shaderSource: string; suppliedOrder: string[]; uniforms: MaterialUniformFields[];
}
export interface LightForm {kind: LightKind; title: string; ambient: string; lights: LightFields[]; camera: CameraFields; bodies: BodyFields[]; materials: MaterialFields[]}
function declarations(source: string) {
  const result = compileMeshMaterial(source);
  if (!result.ok) throw new RenderEditorError('SOURCE_REFUSED', 'The original material shader could not be compiled.');
  return result.material.uniforms;
}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
function materialFields(target: MaterialFields['target'], material: RenderMaterialDocument): MaterialFields {
  return {target, documentId: material.documentId, revision: material.revision, shaderSource: material.shaderSource,
    suppliedOrder: Object.keys(material.uniforms),
    uniforms: declarations(material.shaderSource).map(uniform => ({name: uniform.name, min: uniform.min, max: uniform.max,
      defaultValue: text(uniform.default), override: Object.hasOwn(material.uniforms, uniform.name),
      value: text(Object.hasOwn(material.uniforms, uniform.name) ? material.uniforms[uniform.name] : uniform.default)}))};
}
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
      scale: (pose?.scale ?? [1, 1, 1]).map(text) as BodyFields['scale'],
      rotation: (pose?.rotationXYZW ?? [0, 0, 0, 1]).map(text) as BodyFields['rotation']};
  });
  const materials = document.surfaceMaterials.map(({target, material}) => materialFields(target, material));
  return {kind: lightKind(document), title: document.title, ambient: text(catalog.ambientStrength), bodies, materials, camera: {
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
    if (body.position.length !== 3 || body.scale.length !== 3 || body.rotation.length !== 4)
      throw new RenderEditorError('DOCUMENT_INPUT', 'Body fields require complete position/scale XYZ and rotation XYZW values.');
    return {bodyId: body.bodyId,
      translationMM: [0, 1, 2].map(index => numeric(body.position[index], 'Body position')),
      scale: [0, 1, 2].map(index => numeric(body.scale[index], 'Body scale')),
      rotationXYZW: [0, 1, 2, 3].map(index => numeric(body.rotation[index], 'Body rotation'))};
  });
  // Empty poses are authored identity intent, not an instruction to materialize defaults.
  const poses = base.display.poses.length
    ? base.display.poses.map(pose => ({...pose, ...parsedBodies.find(body => body.bodyId === pose.bodyId)!}))
    : parsedBodies.some(body => body.translationMM.some(value => !Object.is(value, 0)) || body.scale.some(value => !Object.is(value, 1))
      || body.rotationXYZW.some((value, index) => !Object.is(value, index === 3 ? 1 : 0))) ? parsedBodies : [];
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
    const uniforms = declarations(row.shaderSource);
    if (row.uniforms.length !== uniforms.length || uniforms.some((uniform, i) => row.uniforms[i]?.name !== uniform.name
      || typeof row.uniforms[i]?.override !== 'boolean'))
      throw new RenderEditorError('DOCUMENT_INPUT', 'Material fields must retain the exact shader-declared uniform names and order.');
    const values = new Map(row.uniforms.filter(field => field.override).map(field => [field.name, numeric(field.value, 'Uniform ' + field.name)]));
    if (!Array.isArray(row.suppliedOrder) || new Set(row.suppliedOrder).size !== row.suppliedOrder.length
      || row.suppliedOrder.some(name => !uniforms.some(uniform => uniform.name === name)))
      throw new RenderEditorError('DOCUMENT_INPUT', 'Material supplied-key order must refer to unique declared uniforms.');
    // Retain the accepted/imported key order; newly enabled overrides follow declarations.
    const names = [...row.suppliedOrder.filter(name => values.has(name)),
      ...row.uniforms.filter(field => field.override && !row.suppliedOrder.includes(field.name)).map(field => field.name)];
    const session = createRenderMaterialSession(binding.material);
    try {
      session.setDraftMaterial(row.shaderSource, Object.fromEntries(names.map(name => [name, values.get(name)!])));
      // Actual material-session ownership decides omission/signed equality and revision overflow.
      return session.getSnapshot().dirty ? {...binding, material: session.prepareDraft().document} : binding;
    } finally {session.dispose();}
  });
  const camera = fields.camera;
  return prepareRenderNativeLightDocument({...base, title: fields.title, surfaceMaterials,
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
/** Duplicate an authored light as a separate staged catalog entry; keep the source row untouched. */
export function duplicateLightFields(fields: LightForm, nodeId: string): LightForm {
  const original = fields.lights.find(light => light.nodeId === nodeId);
  if (!original) throw new RenderEditorError('DOCUMENT_INPUT', 'Select a current light to duplicate.');
  const added = addLightFields(fields);
  const fresh = added.lights[added.lights.length - 1]!;
  const suffix = ' copy', label = original.label + suffix;
  const duplicated: LightFields = {...original, nodeId: fresh.nodeId,
    label: label.length <= 128 && new TextEncoder().encode(label).length <= 128 ? label : original.label,
    vector: [...original.vector], color: [...original.color]};
  return {...added, lights: [...fields.lights, duplicated]};
}
export function lightFieldsDirty(fields: LightForm, accepted: RenderNativeLightDocument): boolean {
  return JSON.stringify(fields) !== JSON.stringify(readLightFields(accepted));
}

/** Explicit selected-field replacement; unrelated corrective drafts are never parsed or consumed. */
export function stageLightBodyTransformReset(base: RenderNativeLightDocument, fields: LightForm, bodyId: string): LightForm {
  const ids = bodyIds(base), index = ids.indexOf(bodyId);
  if (fields.kind !== lightKind(base) || index < 0 || fields.bodies.length !== ids.length
    || ids.some((id, i) => fields.bodies[i]?.bodyId !== id))
    throw new RenderEditorError('DOCUMENT_INPUT', 'Reset requires the current original body selection.');
  const body = fields.bodies[index];
  if (body.position.length !== 3 || body.scale.length !== 3 || body.rotation.length !== 4)
    throw new RenderEditorError('DOCUMENT_INPUT', 'Reset requires complete selected transform fields.');
  const identity: BodyFields = {...body, position: ['0', '0', '0'], rotation: ['0', '0', '0', '1'], scale: ['1', '1', '1']};
  let unchanged = false;
  try {
    unchanged = (['position', 'rotation', 'scale'] as const).every(key => body[key].every((value, i) =>
      Object.is(numeric(value, 'Body transform'), Number(identity[key][i]))));
  } catch { /* Explicit reset is also a correction of this selected body's invalid text. */ }
  if (unchanged) return fields;
  const baseline = readLightFields(base);
  const candidate = applyLightFields(base, {...baseline, bodies: baseline.bodies.map((row, i) => i === index ? identity : row)});
  const request = createRenderNativeLightRequest(candidate);
  prepareViewerNativeSceneAppearance({version: 1, source: request.source, display: request.display,
    appearance: {lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}, materials: request.materials}}, request.context);
  return {...fields, bodies: fields.bodies.map((row, i) => i === index ? identity : row)};
}

/** Explicit body-origin delta, never an Euler decomposition or an authored-q normalization. */
export function stageLightBodyRotation(base: RenderNativeLightDocument, fields: LightForm, bodyId: string,
  axis: LightRotationAxis, space: LightRotationSpace, degrees: string): LightForm {
  const ids = bodyIds(base), index = ids.indexOf(bodyId);
  if (fields.kind !== lightKind(base) || index < 0 || fields.bodies.length !== ids.length
    || ids.some((id, i) => fields.bodies[i]?.bodyId !== id))
    throw new RenderEditorError('DOCUMENT_INPUT', 'Rotation requires the current original body selection.');
  if (!['x', 'y', 'z'].includes(axis) || !['local', 'world'].includes(space))
    throw new RenderEditorError('DOCUMENT_INPUT', 'Choose X, Y or Z and local or world axes.');
  const angle = numeric(degrees, 'Rotation degrees');
  if (Math.abs(angle) > 360) throw new RenderEditorError('DOCUMENT_INPUT', 'Rotation degrees must be from -360 to 360.');
  // Identity commands retain exact raw authorship, even q/-q and omitted poses.
  if (angle === 0 || Math.abs(angle) === 360) return fields;
  const body = fields.bodies[index], baseline = readLightFields(base);
  const isolated = {...baseline, bodies: baseline.bodies.map((row, i) => i === index ? body : row)};
  // Admit the current selected pose before using its quaternion. Unrelated invalid
  // corrective text stays in fields, outside this temporary validation document.
  const current = applyLightFields(base, isolated);
  const q = current.display.poses.find(pose => pose.bodyId === bodyId)?.rotationXYZW ?? [0, 0, 0, 1] as const;
  const half = angle * Math.PI / 360, delta: [number, number, number, number] = [0, 0, 0, Math.cos(half)];
  if (half === 0) throw new RenderEditorError('DOCUMENT_INPUT', 'Rotation degrees are too small to represent safely.');
  delta[['x', 'y', 'z'].indexOf(axis)] = Math.sin(half);
  const [ax, ay, az, aw] = space === 'local' ? q : delta;
  const [bx, by, bz, bw] = space === 'local' ? delta : q;
  // Same Hamilton XYZW order as Native gizmos: local q*delta, world delta*q.
  // Keep the computed values. The actual authority refuses unsafe roundoff;
  // it is not permission to normalize or choose the sign of the original q.
  const rotation = [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz].map(text) as BodyFields['rotation'];
  const changed = {...body, rotation};
  const candidate = applyLightFields(base, {...isolated, bodies: isolated.bodies.map((row, i) => i === index ? changed : row)});
  const request = createRenderNativeLightRequest(candidate);
  // This is the same real pose/material CPU preflight used by both native light
  // candidates. Catalog lighting was admitted above; no renderer is mounted.
  prepareViewerNativeSceneAppearance({version: 1, source: request.source, display: request.display,
    appearance: {lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}, materials: request.materials}}, request.context);
  return {...fields, bodies: fields.bodies.map((row, i) => i === index ? changed : row)};
}

/** Select only an existing, fully qualified visible binding; embedded IDs are not global assets. */
export function selectedLightMaterial(base: RenderNativeLightDocument, bodyId: string) {
  prepareRenderNativeLightDocument(base);
  const bindings = base.surfaceMaterials.filter(binding => binding.target.bodyId === bodyId);
  if (!base.display.visibleBodyIds.includes(bodyId) || bindings.length !== 1)
    throw new RenderEditorError('DOCUMENT_INPUT', 'Select one visible Surface with an existing qualified material binding.');
  return bindings[0]!;
}

/** Copy accepted content between qualified embedded bindings, never their identities. */
export function stageLightMaterialCopy(base: RenderNativeLightDocument, fields: LightForm,
  destinationBodyId: string, sourceBodyId: string): LightForm {
  const source = selectedLightMaterial(base, sourceBodyId);
  return stageLightMaterialFields(base, fields, destinationBodyId, source.material);
}

/** Portable data stages only source and overrides; original target metadata remain authoritative. */
export function stageLightMaterialFields(base: RenderNativeLightDocument, fields: LightForm,
  bodyId: string, portable: RenderMaterialDocument): LightForm {
  if (lightFieldsDirty(fields, base))
    throw new RenderEditorError('DOCUMENT_INPUT', 'Apply or Discard all scene drafts before importing a material.');
  const binding = selectedLightMaterial(base, bodyId), index = base.surfaceMaterials.indexOf(binding);
  const assigned = deriveRenderMaterialAssignment(binding.material, portable);
  const session = createRenderMaterialSession(binding.material);
  try {
    session.setDraftMaterial(assigned.shaderSource, assigned.uniforms);
    if (!session.getSnapshot().dirty) return fields;
    if (base.revision === 2147483647)
      throw new RenderEditorError('DOCUMENT_INPUT', 'Light revision is at its maximum.');
    session.prepareDraft(); // The actual material authority checks its next revision before staging.
    const next = {...fields, materials: fields.materials.map((row, i) => i === index ? materialFields(binding.target, assigned) : row)};
    applyLightFields(base, next); // Qualify the complete scene before exposing either imported field.
    return next;
  } finally {session.dispose();}
}
