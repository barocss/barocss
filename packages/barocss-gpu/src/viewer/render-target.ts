import { BufferUsage, MapMode, TextureUsage, type Device, type Texture } from './gpu.js';
import { ViewerError } from './viewer-error.js';

/** The backing size in device pixels for a viewer-owned render target. */
export interface RenderTargetOptions { width: number; height: number }

/** A viewer-owned output. Its pixels are read as top-to-bottom RGBA. */
export interface RenderTarget {
  readonly width: number;
  readonly height: number;
  /** Sample the last opaque frame as a base color map. The target retains ownership. */
  asTexture(): RenderTargetTexture;
  /** Read the last frame rendered into this target; it must have been rendered at least once. */
  read(): Promise<{ width: number; height: number; data: Uint8Array }>;
  /** Release this target. Calling this again has no effect. */
  dispose(): void;
}

/** A live, single-level sRGB view of a render target. Sampling uses linear filtering and clamp-to-edge.
 * Only Material.map accepts this texture. The target must have a last frame with an opaque background.
 * Disposing the target invalidates this view. */
export class RenderTargetTexture {
  /** @internal */
  constructor(private readonly target: ViewerRenderTarget) {}
  get width(): number { return this.target.width; }
  get height(): number { return this.target.height; }
  /** @internal */
  validateFor(owner: object, output?: ViewerRenderTarget): void {
    this.target.validateSample(owner);
    if (output === this.target) throw new ViewerError('TEXTURE_INVALID', 'A render target cannot sample itself');
  }
  /** @internal */
  sampleFor(owner: object): { texture: Texture; view: ReturnType<Texture['createView']>; sampler: object } {
    return this.target.sampleFor(owner);
  }
}

/** @internal The owning Viewer validates its own size, device and lifetime through checkOwner. */
export class ViewerRenderTarget implements RenderTarget {
  private readonly texture: Texture;
  private disposed = false;
  private released = false;
  private hasFrame = false;
  private opaqueFrame = false;
  private sample: RenderTargetTexture | null = null;
  private sampleView: ReturnType<Texture['createView']> | null = null;
  private sampleSampler: object | null = null;
  private invalid: 'DEVICE_LOST' | 'DISPOSED' | null = null;

  constructor(
    private readonly owner: object,
    private readonly device: Device,
    private readonly format: string,
    private readonly targetWidth: number,
    private readonly targetHeight: number,
    private readonly checkOwner: () => void,
    private readonly onRelease: (target: ViewerRenderTarget) => void,
  ) {
    const srgbFormat = this.srgbFormat();
    this.texture = device.createTexture({ size: [targetWidth, targetHeight], format, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC | TextureUsage.TEXTURE_BINDING, ...(srgbFormat ? { viewFormats: [srgbFormat] } : {}), label: 'viewer public render target' });
  }

  get width(): number { return this.targetWidth; }
  get height(): number { return this.targetHeight; }

  private check(): void {
    if (this.disposed) throw new ViewerError('DISPOSED', 'The render target has been disposed');
    if (this.invalid) throw new ViewerError(this.invalid, this.invalid === 'DEVICE_LOST' ? 'The render target device was lost' : 'The viewer has been disposed');
    this.checkOwner();
  }

  /** @internal A different viewer must never use this texture, even on the same device. */
  outputFor(owner: object): Texture {
    if (owner !== this.owner) throw new ViewerError('TEXTURE_INVALID', 'The render target belongs to another viewer');
    this.check();
    return this.texture;
  }

  private srgbFormat(): string | null {
    return this.format === 'bgra8unorm' || this.format === 'rgba8unorm' ? `${this.format}-srgb` : null;
  }

  /** @internal Validate on every draw, including after a target is rendered again. */
  validateSample(owner: object): void {
    if (owner !== this.owner) throw new ViewerError('TEXTURE_INVALID', 'The render target belongs to another viewer');
    this.check();
    if (!this.srgbFormat()) throw new ViewerError('TEXTURE_INVALID', 'The render target format cannot be sampled as sRGB');
    if (!this.hasFrame || !this.opaqueFrame) throw new ViewerError('TEXTURE_INVALID', 'The render target needs a frame with an opaque background');
  }

  asTexture(): RenderTargetTexture {
    this.validateSample(this.owner);
    return this.sample ??= new RenderTargetTexture(this);
  }

  /** @internal */
  sampleFor(owner: object): { texture: Texture; view: ReturnType<Texture['createView']>; sampler: object } {
    this.validateSample(owner);
    const view = this.sampleView ??= this.texture.createView({ format: this.srgbFormat()! });
    const sampler = this.sampleSampler ??= this.device.createSampler({ addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest' });
    return { texture: this.texture, view, sampler };
  }

  /** @internal Called only after the viewer submitted the output pass. */
  rendered(opaque: boolean): void { this.hasFrame = true; this.opaqueFrame = opaque; }

  /** @internal Dispose the GPU texture while keeping the reason available to later reads. */
  invalidate(reason: 'DEVICE_LOST' | 'DISPOSED'): void {
    if (this.disposed || this.invalid) return;
    this.invalid = reason;
    this.release();
  }

  private release(): void {
    if (this.released) return;
    this.released = true;
    this.texture.destroy();
    this.onRelease(this);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }

  async read(): Promise<{ width: number; height: number; data: Uint8Array }> {
    this.check();
    if (!this.hasFrame) throw new ViewerError('TEXTURE_INVALID', 'The render target has no frame to read');
    const width = this.width, height = this.height, row = Math.ceil(width * 4 / 256) * 256;
    const buffer = this.device.createBuffer({ size: row * height, usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST, label: 'viewer target readback' });
    try {
      const encoder = this.device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture: this.texture }, { buffer, bytesPerRow: row }, [width, height]);
      this.device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(MapMode.READ);
      // The scene's pixels were copied earlier, but disposal, resize or loss can occur while mapAsync waits.
      this.check();
      const src = new Uint8Array(buffer.getMappedRange()), data = new Uint8Array(width * height * 4), bgra = this.format.startsWith('bgra');
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const s = y * row + x * 4, d = (y * width + x) * 4;
        data[d] = src[s + (bgra ? 2 : 0)]; data[d + 1] = src[s + 1]; data[d + 2] = src[s + (bgra ? 0 : 2)]; data[d + 3] = src[s + 3];
      }
      buffer.unmap();
      return { width, height, data };
    } catch (error) {
      // Prefer the target's observed invalidation, but keep unrelated GPU errors intact.
      this.check();
      throw error;
    } finally { buffer.destroy(); }
  }
}
