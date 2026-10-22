// G25 (G-R12), EXPERIMENTAL: one compute dispatch — storage inputs (bindings 0…k−1 in order), read-write outputs after
// them, a 16-byte uniform last; one invocation an element in workgroups of 64; the outputs read back and every buffer
// released. The pipeline is compiled once a device and shader. WebGPU's types structurally (the package does not depend
// on @webgpu/types), as the viewer's are.

interface ComputeBuffer { destroy(): void; mapAsync(mode: number): Promise<void>; getMappedRange(): ArrayBuffer; unmap(): void }
interface ComputePass { setPipeline(p: object): void; setBindGroup(i: number, g: object): void; dispatchWorkgroups(x: number): void; end(): void }
interface ComputeEncoder { beginComputePass(): ComputePass; copyBufferToBuffer(a: ComputeBuffer, ao: number, b: ComputeBuffer, bo: number, size: number): void; finish(): object }
/** What a dispatch needs of a GPUDevice. */
export interface ComputeDevice {
  readonly queue: { writeBuffer(b: ComputeBuffer, offset: number, data: ArrayBufferView | ArrayBuffer): void; submit(commands: object[]): void };
  createBuffer(d: { size: number; usage: number; label?: string }): ComputeBuffer;
  createShaderModule(d: { code: string; label?: string }): object;
  createComputePipelineAsync(d: object): Promise<{ getBindGroupLayout(i: number): object }>;
  createBindGroup(d: object): object;
  createCommandEncoder(): ComputeEncoder;
}
export interface ComputeJob {
  code: string; label: string;
  inputs: readonly (ArrayBuffer | ArrayBufferView)[];
  /** 16 bytes, bound after the outputs. */
  params: ArrayBuffer;
  /** Each output's size in bytes. */
  outputs: readonly number[];
  invocations: number;
}
const STORAGE = 128, COPY_SRC = 4, COPY_DST = 8, UNIFORM = 64, MAP_READ = 1;
const pipelines = new WeakMap<object, Map<string, Promise<{ getBindGroupLayout(i: number): object }>>>();
const padded = (bytes: number) => Math.max(16, Math.ceil(bytes / 4) * 4);

export async function runCompute(device: ComputeDevice, job: ComputeJob): Promise<ArrayBuffer[]> {
  let byCode = pipelines.get(device);
  if (!byCode) { byCode = new Map(); pipelines.set(device, byCode); }
  let pipeline = byCode.get(job.code);
  if (!pipeline) {
    pipeline = device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code: job.code, label: job.label }), entryPoint: 'main' } });
    byCode.set(job.code, pipeline);
  }
  const p = await pipeline, owned: ComputeBuffer[] = [];
  try {
    const bound: ComputeBuffer[] = [];
    for (const data of job.inputs) {
      const b = device.createBuffer({ size: padded(data.byteLength), usage: STORAGE | COPY_DST, label: job.label + ' input' });
      owned.push(b); bound.push(b); if (data.byteLength) device.queue.writeBuffer(b, 0, data);
    }
    const outs: ComputeBuffer[] = [], reads: ComputeBuffer[] = [];
    for (const bytes of job.outputs) {
      const o = device.createBuffer({ size: padded(bytes), usage: STORAGE | COPY_SRC, label: job.label + ' output' }), r = device.createBuffer({ size: padded(bytes), usage: MAP_READ | COPY_DST });
      owned.push(o, r); outs.push(o); reads.push(r); bound.push(o);
    }
    const uniform = device.createBuffer({ size: 16, usage: UNIFORM | COPY_DST, label: job.label + ' params' });
    owned.push(uniform); bound.push(uniform); device.queue.writeBuffer(uniform, 0, job.params);
    const group = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: bound.map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const enc = device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(p); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.max(1, Math.ceil(job.invocations / 64))); pass.end();
    for (let i = 0; i < outs.length; i++) enc.copyBufferToBuffer(outs[i], 0, reads[i], 0, padded(job.outputs[i]));
    device.queue.submit([enc.finish()]);
    await Promise.all(reads.map(r => r.mapAsync(MAP_READ)));
    const result = reads.map((r, i) => r.getMappedRange().slice(0, job.outputs[i]));
    for (const r of reads) r.unmap();
    return result;
  } finally { for (const b of owned) b.destroy(); }
}
