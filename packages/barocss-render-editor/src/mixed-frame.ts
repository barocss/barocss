import {compileCadModel, tessellateSurface, type Model, type Surface} from '@barocss/cad';
import {compileGpu, prepareMixedDepthFrame, type MixedDepthFrameV0} from '@barocss/gpu';
import {copyRenderMixedDocument, RenderMixedDocumentError, type RenderMixedDocumentV1} from './mixed-document.js';

export interface RenderMixedDocumentMetadata {
  readonly sceneName: string;
  readonly objectId: string;
  readonly assetId: string;
  readonly assetRevision: number;
  readonly modelId: string;
  readonly surfaceId: string;
  readonly nativeObjects: readonly {readonly id: string; readonly kind: 'surface' | 'curve'}[];
  readonly vertexCount: number;
  readonly triangleCount: number;
}
export interface PreparedRenderMixedDocument {
  readonly document: RenderMixedDocumentV1;
  readonly metadata: RenderMixedDocumentMetadata;
  /** Actual full original-source native model, including unrendered objects. */
  readonly model: Model;
  /** Derived display only. Persist document, never this frame/packet as native authority. */
  readonly frame: MixedDepthFrameV0;
}
function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freezeOwned(item);
    Object.freeze(value);
  }
  return value;
}

/** Pure qualification of both sources. No DOM, renderer, GL, timers or file I/O. */
export function prepareRenderMixedDocument(input: unknown): PreparedRenderMixedDocument {
  const document = copyRenderMixedDocument(input);
  const sdf = compileGpu({kind: 'scene', source: document.sceneSource, sourceVersion: 1});
  if (!sdf.ok) throw new RenderMixedDocumentError('SOURCE', 'Scene source could not compile.', sdf.diagnostics);
  if (sdf.execution.kind !== 'sdf' || sdf.execution.scene.objects.length !== 1 || sdf.execution.scene.objects[0].type !== 'sphere') {
    throw new RenderMixedDocumentError('GPU', 'This mixed profile requires one Sphere. Other scene objects remain supported in the source editor.');
  }
  const native = compileCadModel(document.asset.source, {sourceVersion: 0});
  if (!native.ok) throw new RenderMixedDocumentError('SOURCE', 'Original native source could not compile.', native.diagnostics);
  if (native.model.name !== document.asset.modelId) throw new RenderMixedDocumentError('QUALIFICATION', 'Native model reference does not match the original source.');
  const surface = native.model.objects.find((object): object is Surface => object.kind === 'surface' && object.id === document.asset.surfaceId);
  if (!surface) throw new RenderMixedDocumentError('QUALIFICATION', 'Selected Surface does not exist in the original model.');
  let packet;
  try { packet = tessellateSurface(surface, {countU: document.display.countU, countV: document.display.countV, revision: 0}).packet; }
  catch (cause) { throw new RenderMixedDocumentError('NATIVE', 'The original Surface could not be sampled for this preview.', cause); }
  let frame: MixedDepthFrameV0;
  try {
    frame = prepareMixedDepthFrame({format: 'barocss-gpu-mixed-depth-frame', version: 0,
      profile: document.profile, sourceVersion: document.sourceVersion, source: document.sceneSource,
      surface: {ref: {modelId: native.model.name, geometryId: surface.id}, packet, color: document.display.color},
      camera: document.camera, mmToSceneUnit: document.display.mmToSceneUnit, translate: document.display.translate});
  } catch (cause) { throw new RenderMixedDocumentError('GPU', 'The mixed preview refused this source, camera or display configuration.', cause); }
  return freezeOwned({document, frame, model: structuredClone(native.model), metadata: {
    sceneName: sdf.execution.scene.name, objectId: sdf.execution.scene.objects[0].id,
    assetId: document.asset.assetId, assetRevision: document.asset.revision,
    modelId: native.model.name, surfaceId: surface.id,
    nativeObjects: native.model.objects.map(object => ({id: object.id, kind: object.kind})),
    vertexCount: frame.surface.packet.positions.length / 3, triangleCount: frame.surface.packet.indices.length / 3,
  }});
}
