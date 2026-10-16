// The part of the WebGPU API the viewer uses, typed structurally (the package does not depend on
// @webgpu/types), and the usage flags as numbers.
export interface Buffer { readonly size: number; destroy(): void; mapAsync(mode: number, offset?: number, size?: number): Promise<void>; getMappedRange(offset?: number, size?: number): ArrayBuffer; unmap(): void }
export interface TextureView { readonly __view?: never }
export interface Texture { readonly width: number; readonly height: number; readonly format: string; createView(descriptor?: object): TextureView; destroy(): void }
export interface BindGroup { readonly __group?: never }
export interface BindGroupLayout { readonly __layout?: never }
export interface Pipeline { getBindGroupLayout(index: number): BindGroupLayout }
export interface RenderPass {
  setPipeline(pipeline: Pipeline): void;
  setBindGroup(index: number, group: BindGroup, dynamicOffsets?: number[]): void;
  setVertexBuffer(slot: number, buffer: Buffer): void;
  setIndexBuffer(buffer: Buffer, format: 'uint16' | 'uint32'): void;
  setScissorRect(x: number, y: number, width: number, height: number): void;
  draw(vertexCount: number, instanceCount?: number): void;
  drawIndexed(indexCount: number): void;
  end(): void;
}
export interface CommandEncoder {
  beginRenderPass(descriptor: object): RenderPass;
  copyTextureToBuffer(source: object, destination: object, size: object): void;
  finish(): object;
}
export interface Queue { writeBuffer(buffer: Buffer, offset: number, data: ArrayBufferView, dataOffset?: number, size?: number): void; submit(commands: object[]): void; onSubmittedWorkDone(): Promise<void> }
export interface ShaderModule { getCompilationInfo(): Promise<{ messages: readonly { type: string; message: string; lineNum: number }[] }> }
export interface Device {
  readonly limits: Record<string, number>;
  readonly queue: Queue;
  readonly lost: Promise<{ reason: string; message: string }>;
  onuncapturederror: ((e: { error: { message: string } }) => void) | null;
  createBuffer(descriptor: { size: number; usage: number; mappedAtCreation?: boolean; label?: string }): Buffer;
  createTexture(descriptor: object): Texture;
  createShaderModule(descriptor: { code: string; label?: string }): ShaderModule;
  createRenderPipelineAsync(descriptor: object): Promise<Pipeline>;
  createBindGroupLayout(descriptor: object): BindGroupLayout;
  createPipelineLayout(descriptor: object): object;
  createBindGroup(descriptor: object): BindGroup;
  createCommandEncoder(): CommandEncoder;
  pushErrorScope(filter: 'validation' | 'out-of-memory' | 'internal'): void;
  popErrorScope(): Promise<{ message: string } | null>;
  destroy(): void;
}
export interface Adapter { requestDevice(descriptor?: object): Promise<Device>; readonly limits: Record<string, number> }
export interface GPU { requestAdapter(options?: object): Promise<Adapter | null>; getPreferredCanvasFormat(): string }
export interface CanvasContext { configure(descriptor: object): void; unconfigure(): void; getCurrentTexture(): Texture }

export const BufferUsage = { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64 } as const;
export const TextureUsage = { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, RENDER_ATTACHMENT: 16 } as const;
export const MapMode = { READ: 1 } as const;

export function gpuOf(): GPU | null {
  return (globalThis as { navigator?: { gpu?: GPU } }).navigator?.gpu ?? null;
}
