export { parseScene, SceneError } from './scene.js';
export type { Scene, RGB, Vec3 } from './scene.js';
export { compileScene, GPU_LIMITS } from './compiler.js';
export type { SceneShaders } from './compiler.js';
export { mountScene, SceneRenderer, GPUError } from './renderer.js';
export type { UpdateResult } from './renderer.js';
export { validatePreviewPacket, validateMeshOptions, prepareMesh } from './mesh-packet.js';
export type { PreviewPacket, MeshOptions } from './mesh-packet.js';
export { mountMesh, MeshRenderer } from './mesh-renderer.js';
export { validateMeshCamera, prepareCamera } from './camera.js';
export type { MeshCamera } from './camera.js';

export {compileGpu} from './gpu-compiler.js';
export type {GpuCompileInput,GpuCompileResult,GpuDiagnostic,GpuRenderIR,GpuExecution} from './gpu-compiler.js';
export type {SceneAst,SourceRange} from './scene-front.js';
