/** Private structural browser boundary. No injectable/public device contract. */
export interface GPUBufferHandle {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}
export interface GPUTextureHandle { createView(): object; destroy(): void }
export interface GPUPipelineHandle { getBindGroupLayout(index: number): object }
export interface GPUCommandEncoderHandle {
  beginRenderPass(descriptor: object): GPURenderPassHandle;
  copyTextureToTexture(source: object, destination: object, size: object): void;
  copyTextureToBuffer(source: object, destination: object, size: object): void;
  finish(): object;
}
export interface GPURenderPassHandle {
  setPipeline(pipeline: GPUPipelineHandle): void;
  setBindGroup(index: number, group: object): void;
  setVertexBuffer(index: number, buffer: GPUBufferHandle): void;
  setIndexBuffer(buffer: GPUBufferHandle, format: string): void;
  drawIndexed(count: number): void;
  end(): void;
}
export interface GPUQueueHandle {
  writeBuffer(buffer: GPUBufferHandle, offset: number, data: ArrayBufferView): void;
  writeTexture(destination: object, data: ArrayBufferView, layout: object, size: object): void;
  submit(commands: object[]): void;
  onSubmittedWorkDone(): Promise<void>;
}
export interface GPUDeviceHandle {
  readonly limits: Record<string, number>;
  readonly queue: GPUQueueHandle;
  readonly lost: Promise<{ reason: string; message: string }>;
  createBuffer(descriptor: object): GPUBufferHandle;
  createTexture(descriptor: object): GPUTextureHandle;
  createSampler(descriptor: object): object;
  createShaderModule(descriptor: object): { getCompilationInfo(): Promise<{ messages: { type: string; message: string }[] }> };
  createRenderPipelineAsync(descriptor: object): Promise<GPUPipelineHandle>;
  createBindGroupLayout(descriptor: object): object;
  createPipelineLayout(descriptor: object): object;
  createBindGroup(descriptor: object): object;
  createCommandEncoder(): GPUCommandEncoderHandle;
  pushErrorScope(filter: string): void;
  popErrorScope(): Promise<{ message: string } | null>;
  destroy(): void;
}
export interface GPUAdapterHandle { requestDevice(descriptor: object): Promise<GPUDeviceHandle> }
export interface GPUPlatformHandle {
  requestAdapter(): Promise<GPUAdapterHandle | null>;
  getPreferredCanvasFormat(): string;
}
export interface GPUCanvasHandle {
  configure(descriptor: object): void;
  unconfigure(): void;
  getCurrentTexture(): GPUTextureHandle;
}
