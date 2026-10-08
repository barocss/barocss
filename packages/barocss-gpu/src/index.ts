export { parseScene, SceneError } from './scene.js';
export type { Scene, Scene1, SceneObject, SceneObject1, RotatedSceneObject, CylinderSceneObject, CapsuleSceneObject, RoundedBoxSceneObject, TorusSceneObject, AnyScene, SceneSourceOptions, RGB, Vec3 } from './scene.js';
export { compileScene, GPU_LIMITS } from './compiler.js';
export type { SceneShaders } from './compiler.js';
export { mountScene, SceneRenderer, GPUError } from './renderer.js';
export type { UpdateResult } from './renderer.js';
export { validatePreviewPacket, validateMeshOptions, prepareMesh } from './mesh-packet.js';
export type { PreviewPacket, MeshOptions } from './mesh-packet.js';
export { mountMesh, MeshRenderer } from './mesh-renderer.js';
export type { MeshEdgeOverlay } from './edge-overlay.js';
export { validateMeshCamera, prepareCamera } from './camera.js';
export type { MeshCamera } from './camera.js';

export {compileGpu} from './gpu-compiler.js';
export type {GpuCompileInput,GpuCompileResult,GpuDiagnostic,GpuRenderIR,GpuExecution} from './gpu-compiler.js';
export type {SceneAst,SourceRange} from './scene-front.js';

export type {MeshFaceHighlight} from './face-highlight.js';

export type {MeshObjectHighlight} from './object-highlight.js';

export { mountMeshViewport, MeshViewport } from './mesh-viewport.js';
export type { MeshViewportState, MeshViewportSelection } from './mesh-viewport.js';

export {prepareKernelFacePreview,resolveKernelFaceReference} from './kernel-face-preview.js';
export type {KernelFaceContext,KernelNormalSource,KernelFaceReference,KernelFaceBinding,KernelFacePreview,KernelFacePreviewOptions} from './kernel-face-preview.js';

export {mountMeshScene,MeshSceneRenderer} from './mesh-scene-renderer.js';
export type {MeshSceneEntry,MeshSceneOptions,MeshSceneTransform,MeshSceneBounds} from './mesh-scene-renderer.js';
export {mountPrimitiveScene,PrimitiveSceneRenderer,mountPrimitiveSceneV1,PrimitiveSceneRendererV1} from './primitive-scene-renderer.js';
export type {PrimitiveSceneEntry,PrimitiveSceneOptions,PrimitiveSceneEntryV1,PrimitiveSceneInputV1} from './primitive-scene-renderer.js';
