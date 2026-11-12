// D524 observation only: delegate every actual call unchanged. Never submit bodies or edit product state.
export async function installD524MeshObserver({ capturePayloads = false } = {}) {
  const { GpuRenderer } = await import('/src/viewport/gpuRenderer.ts');
  const viewer = window.__studioViewer;
  if (!viewer) throw new Error('Existing DEV __studioViewer is required');
  const ids = new WeakMap(), calls = [], geometries = [], uploads = [], restores = [];
  let serial = 0, renderer = null, uploadCount = 0;
  const id = value => { if (!value) return null; if (!ids.has(value)) ids.set(value, ++serial); return ids.get(value); };
  const copy = value => {
    if (value === undefined || value === null || typeof value !== 'object') return value;
    if (ArrayBuffer.isView(value)) return { type: value.constructor.name, values: Array.from(value) };
    if (Array.isArray(value)) return value.map(copy);
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v !== 'function').map(([key, v]) => [key, copy(v)]));
  };
  const mesh = result => ({ key: result.key, positions: copy(result.mesh.positions), normals: copy(result.mesh.normals), indices: copy(result.mesh.indices),
    edgeLines: copy(result.mesh.edgeLines), faceOfVertex: copy(result.mesh.faceOfVertex), edgeOfSegment: copy(result.mesh.edgeOfSegment),
    bounds: copy(result.mesh.bounds), faces: copy(result.mesh.faces), edges: copy(result.mesh.edges) });
  // Recorded legacy decision function only. This is not an independent geometry oracle.
  const legacySignature = result => {
    const m = result.mesh, p = m.positions, step = Math.max(1, Math.floor(p.length / 997)); let h = 2166136261;
    for (let i = 0; i < p.length; i += step) { h ^= Math.round(p[i] * 1e4); h = Math.imul(h, 16777619); }
    return [result.key, p.length, m.indices.length, m.edgeLines.length, ...m.bounds.min, ...m.bounds.max, h >>> 0].join(',');
  };
  const geometry = g => g ? { id: id(g), disposed: g.disposed, gpuAllocated: !!g.gpu, data: copy(g.data),
    ...(capturePayloads && { gpuBuffers: g.gpu ? {
      positions: id(g.gpu.positions), normals: id(g.gpu.normals), indices: id(g.gpu.indices),
    } : null }),
  } : null;
  const bodies = instance => (instance.bodies ?? []).map(body => ({ key: body.result.key, surface: geometry(body.surface?.geometry),
    edges: geometry(body.edges?.geometry), highlight: geometry(body.highlight?.geometry) }));
  const originalCreate = viewer.createGeometry;
  viewer.createGeometry = function (...args) {
    const input = copy(args[0]), result = originalCreate.apply(this, args);
    geometries.push({ sequence: geometries.length, id: id(result), input, prepared: copy(result.data) });
    return result;
  };
  restores.push(() => { viewer.createGeometry = originalCreate; });
  const originalBodies = GpuRenderer.prototype.setBodies;
  GpuRenderer.prototype.setBodies = function (...args) {
    renderer = this;
    const input = args[0].map(mesh), signatures = args[0].map(legacySignature), before = bodies(this), createdBefore = geometries.length;
    const result = originalBodies.apply(this, args);
    calls.push({ sequence: calls.length, input, legacySignatures: signatures, before, after: bodies(this), geometryCreations: geometries.length - createdBefore });
    return result;
  };
  restores.push(() => { GpuRenderer.prototype.setBodies = originalBodies; });
  const queue = globalThis.GPUQueue?.prototype, originalWrite = queue?.writeBuffer;
  if (originalWrite) {
    queue.writeBuffer = function (...args) {
      const [buffer, bufferOffset, data, dataOffset, size] = args;
      // Record geometry vertex/index transfers, not each frame's camera/uniform buffers.
      if ((buffer.usage & (0x10 | 0x20)) !== 0) {
        uploadCount++;
        if (uploads.length < 512) {
          const fullGeometryWrite = capturePayloads && bufferOffset === 0 && dataOffset === undefined && size === undefined
            && ArrayBuffer.isView(data) && ['positions', 'normals', 'indices', 'lines'].includes(buffer.label);
          uploads.push({ sequence: uploadCount, buffer: id(buffer), label: buffer.label, usage: buffer.usage,
            bufferOffset, dataType: data?.constructor?.name, sourceByteLength: data?.byteLength ?? null,
            dataOffset: dataOffset ?? null, size: size ?? null,
            ...(fullGeometryWrite && { bytes: Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)) }),
          });
        }
      }
      return originalWrite.apply(this, args);
    };
    restores.push(() => { queue.writeBuffer = originalWrite; });
  }
  window.__d524Mesh = {
    snapshot() { return { observationOnly: true, originalSignatureAuthority: 'legacy sampled decision, not geometry oracle', calls: calls.slice(), geometries: geometries.slice(),
      current: renderer ? bodies(renderer) : [], uploads: uploads.slice(), uploadCount, uploadCaptureLimit: 512, nativeQueueObserved: !!originalWrite }; },
    restore() { for (const restore of restores.reverse()) restore(); },
  };
}
