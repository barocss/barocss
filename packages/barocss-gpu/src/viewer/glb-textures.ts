// Decode prepared GLB colour textures without transferring their ownership to a mesh.
import { glbImageSize } from './glb-texture-data.js';
import type { PreparedGlbPrimitive, PreparedTexturedGlb } from './glb-scene.js';
import type { ImageTexture } from './scene.js';
import type { Viewer } from './viewer.js';
import { ViewerError } from './viewer-error.js';

/** The caller owns these textures and must dispose them after removing their meshes. */
export interface MaterializedGlbTextures {
  primitives: PreparedGlbPrimitive[];
  dispose(): void;
}

/** Decode opaque embedded PNG/JPEG images and create viewer-owned sRGB colour textures.
 * Images are decoded to independent RGBA bytes, which remain available for device recovery.
 * Any failure releases all textures made by this call. */
export async function materializeGlbTextures(viewer: Viewer, prepared: PreparedTexturedGlb): Promise<MaterializedGlbTextures> {
  const textures: ImageTexture[] = [];
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    let firstError: unknown, failed = false;
    for (const texture of textures) try { texture.dispose(); } catch (error) { if (!failed) { firstError = error; failed = true; } }
    if (failed) throw firstError;
  };
  try {
    let pixelsTotal = 0, bytesTotal = 0, verticesTotal = 0, indicesTotal = 0;
    if (!prepared || !Array.isArray(prepared.textures) || !Array.isArray(prepared.primitives) || prepared.textures.length > 4096 || prepared.primitives.length > 4096) throw new ViewerError('TEXTURE_INVALID', 'Invalid prepared GLB textures');
    const device = viewer.computeDevice as { limits?: { maxTextureDimension2D?: number } } | null;
    const checkDevice = (): number => {
      const current = viewer.computeDevice as { limits?: { maxTextureDimension2D?: number } } | null;
      if (!current) throw new ViewerError('DISPOSED', 'The viewer has been disposed');
      if (!viewer.ready || current !== device) throw new ViewerError('DEVICE_LOST', 'The viewer device changed while decoding GLB textures');
      const max = current.limits?.maxTextureDimension2D;
      if (typeof max !== 'number') throw new ViewerError('DEVICE_LOST', 'The viewer device limit is unavailable');
      return max;
    };
    const max = checkDevice();
    const sourceTextures = prepared.textures.map(item => {
      if (!item || !(item.bytes instanceof Uint8Array) || (item.mimeType !== 'image/png' && item.mimeType !== 'image/jpeg') || !item.options || item.options.srgb !== true || typeof item.options.mipmaps !== 'boolean' || !['repeat', 'clamp'].includes(item.options.wrap) || !['nearest', 'linear'].includes(item.options.filter)) throw new ViewerError('TEXTURE_INVALID', 'Invalid prepared GLB texture');
      bytesTotal += item.bytes.byteLength;
      if (bytesTotal > 64 * 1024 * 1024) throw new ViewerError('TEXTURE_INVALID', 'GLB textures exceed the byte limit');
      const bytes = new Uint8Array(item.bytes), options = { ...item.options }, mimeType = item.mimeType, size = glbImageSize(bytes, mimeType);
      pixelsTotal += size.width * size.height;
      if (pixelsTotal > 33_554_432) throw new ViewerError('TEXTURE_INVALID', 'GLB textures exceed the pixel limit');
      if (typeof max !== 'number' || size.width > max || size.height > max) throw new ViewerError('TEXTURE_INVALID', 'GLB texture exceeds the viewer device limit');
      return { bytes, options, mimeType, size };
    });
    // Copy all parser output before the first await. Callers may reuse or mutate it while decoding runs.
    const sourcePrimitives = prepared.primitives.map(primitive => {
      if (!primitive || !primitive.geometry || !primitive.material || !primitive.transform) throw new ViewerError('TEXTURE_INVALID', 'Invalid GLB primitive');
      const index = primitive.baseColorTexture, g = primitive.geometry, material = primitive.material;
      if (index !== null && (!Number.isSafeInteger(index) || index < 0 || index >= sourceTextures.length)) throw new ViewerError('TEXTURE_INVALID', 'Invalid GLB texture reference');
      if (Object.keys(material).some(key => !['color', 'opacity', 'metallic', 'roughness', 'doubleSided'].includes(key))) throw new ViewerError('TEXTURE_INVALID', 'Prepared GLB material has unsupported changes');
      if (Object.keys(g).some(key => !['positions', 'normals', 'uvs', 'colors', 'indices'].includes(key))) throw new ViewerError('TEXTURE_INVALID', 'Prepared GLB geometry has unsupported changes');
      const n = g.positions?.length, ni = g.indices?.length ?? 0;
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 3 || n % 3 !== 0 || !g.normals || g.normals.length !== n || !g.indices || !Number.isSafeInteger(ni) || ni < 3 || ni % 3 !== 0 || primitive.transform.length !== 16 || (g.uvs && g.uvs.length !== n / 3 * 2) || (g.colors && g.colors.length !== n) || (index !== null && !g.uvs)) throw new ViewerError('TEXTURE_INVALID', 'Invalid GLB geometry');
      verticesTotal += n / 3; indicesTotal += ni;
      if (verticesTotal > 2_000_000 || indicesTotal > 6_000_000) throw new ViewerError('TEXTURE_INVALID', 'GLB geometry exceeds the supported limits');
      if (g.indices) for (let i = 0; i < g.indices.length; i++) {
        const value = g.indices[i];
        if (!Number.isSafeInteger(value) || value < 0 || value >= n / 3 || value >= 65535) throw new ViewerError('TEXTURE_INVALID', 'Prepared GLB index is invalid');
      }
      const geometry = { positions: Float32Array.from(g.positions), ...(g.normals ? { normals: Float32Array.from(g.normals) } : {}), ...(g.uvs ? { uvs: Float32Array.from(g.uvs) } : {}), ...(g.indices ? { indices: Uint16Array.from(g.indices) } : {}), ...(g.colors ? { colors: Array.from(g.colors) } : {}) };
      const color = material.color;
      return { geometry, transform: primitive.transform.slice(), material: { color: Array.isArray(color) ? [color[0], color[1], color[2]] as [number, number, number] : color, opacity: material.opacity, metallic: material.metallic, roughness: material.roughness, doubleSided: material.doubleSided }, index };
    });
    if (sourceTextures.length && typeof createImageBitmap !== 'function') throw new ViewerError('TEXTURE_INVALID', 'ImageBitmap decoding is not available');
    for (const { bytes, options, mimeType, size } of sourceTextures) {
      const bitmap = await createImageBitmap(new Blob([bytes.buffer], { type: mimeType }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      try {
        const currentMax = checkDevice();
        if (size.width > currentMax || size.height > currentMax) throw new ViewerError('TEXTURE_INVALID', 'GLB texture exceeds the viewer device limit');
        if (bitmap.width !== size.width || bitmap.height !== size.height) throw new ViewerError('TEXTURE_INVALID', 'Decoded GLB image dimensions differ from its header');
        let pixels: Uint8ClampedArray;
        if (typeof OffscreenCanvas !== 'undefined') {
          const context = new OffscreenCanvas(size.width, size.height).getContext('2d', { willReadFrequently: true });
          if (!context) throw new ViewerError('TEXTURE_INVALID', 'A 2D canvas is required to decode GLB images');
          context.drawImage(bitmap, 0, 0); pixels = context.getImageData(0, 0, size.width, size.height).data;
        } else {
          if (typeof document === 'undefined') throw new ViewerError('TEXTURE_INVALID', 'A 2D canvas is required to decode GLB images');
          const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new ViewerError('TEXTURE_INVALID', 'A 2D canvas is required to decode GLB images');
          context.drawImage(bitmap, 0, 0); pixels = context.getImageData(0, 0, size.width, size.height).data;
        }
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) throw new ViewerError('TEXTURE_INVALID', 'GLB base colour images must be fully opaque');
        textures.push(viewer.createTexture({ width: size.width, height: size.height, data: new Uint8Array(pixels) }, options));
      } finally { bitmap.close(); }
    }
    const primitives = sourcePrimitives.map(({ geometry, transform, material, index }) => ({
      geometry, transform, material: { ...material, ...(index === null ? {} : { map: textures[index] }) },
    }));
    checkDevice();
    return { primitives, dispose };
  } catch (error) {
    // Preserve the original failure even if a caller's render callback throws during cleanup.
    try { dispose(); } catch { /* Each owned texture was still offered disposal. */ }
    if (error instanceof ViewerError && (error.code === 'DISPOSED' || error.code === 'DEVICE_LOST' || error.code === 'TEXTURE_INVALID')) throw error;
    throw new ViewerError('TEXTURE_INVALID', `Could not decode GLB textures: ${error instanceof Error ? error.message : String(error)}`);
  }
}
