// Bounded, self-contained image and sampler metadata for the textured GLB adapter.
import type { TextureOptions } from './scene.js';
import { ViewerError } from './viewer-error.js';

export interface PreparedGlbTexture {
  mimeType: 'image/png' | 'image/jpeg';
  /** A copy of the embedded compressed image bytes. */
  bytes: Uint8Array;
  /** Sampling settings represented exactly by the viewer. */
  options: Required<TextureOptions>;
}

type Obj = Record<string, unknown>;
const fail = (message: string): never => { throw new ViewerError('GEOMETRY_INVALID', `GLB: ${message}`); };
const object = (v: unknown, label: string): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : fail(`${label} must be an object`);
const list = (v: unknown, label: string): unknown[] => v === undefined ? [] : Array.isArray(v) ? v : fail(`${label} must be an array`);
const keys = (v: Obj, allowed: readonly string[], label: string): void => { for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(`${label}.${k} is not supported`); };
const integer = (v: unknown, label: string): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : fail(`${label} must be a non-negative integer`);
const ref = (v: unknown, values: readonly unknown[], label: string): number => { const i = integer(v, label); if (i >= values.length) fail(`${label} is out of range`); return i; };

/** Validate image headers before browser decoding can allocate a large bitmap. */
export function glbImageSize(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg'): { width: number; height: number } {
  let width = 0, height = 0;
  if (mime === 'image/png') {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 24 || !signature.every((b, i) => bytes[i] === b) || bytes[8] !== 0 || bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') fail('invalid PNG header');
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    width = data.getUint32(16); height = data.getUint32(20);
  } else {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('invalid JPEG header');
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) fail('invalid JPEG marker');
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      if (offset >= bytes.length) fail('truncated JPEG marker');
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) fail('truncated JPEG segment');
      const length = bytes[offset] * 256 + bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) fail('invalid JPEG segment length');
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        if (length < 8) fail('invalid JPEG frame');
        height = bytes[offset + 3] * 256 + bytes[offset + 4];
        width = bytes[offset + 5] * 256 + bytes[offset + 6];
        break;
      }
      offset += length;
    }
  }
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16_777_216) fail('image dimensions exceed the supported range');
  return { width, height };
}

/** @internal */
export function glbTextures(gltf: Obj, bin: Uint8Array, bufferLength: number, views: readonly unknown[]): PreparedGlbTexture[] {
  const images = list(gltf.images, 'images'), textures = list(gltf.textures, 'textures'), samplers = list(gltf.samplers, 'samplers');
  if (images.length > 4096 || textures.length > 4096 || samplers.length > 4096) fail('too many images, textures or samplers');
  let totalBytes = 0, totalPixels = 0;
  const decodedImages = images.map((entry, i) => {
    const image = object(entry, `image[${i}]`);
    keys(image, ['bufferView', 'mimeType', 'name', 'extras'], `image[${i}]`);
    const mimeType: PreparedGlbTexture['mimeType'] = image.mimeType === 'image/png' ? 'image/png'
      : image.mimeType === 'image/jpeg' ? 'image/jpeg' : fail('only embedded PNG or JPEG images are supported');
    const view = object(views[ref(image.bufferView, views, 'image.bufferView')], 'image.bufferView');
    keys(view, ['buffer', 'byteOffset', 'byteLength', 'name', 'extras'], 'image.bufferView');
    if (view.buffer !== 0) fail('image.bufferView must use the GLB buffer');
    const offset = view.byteOffset === undefined ? 0 : integer(view.byteOffset, 'image.byteOffset');
    const length = integer(view.byteLength, 'image.byteLength');
    if (!length || offset + length > bufferLength || !Number.isSafeInteger(offset + length)) fail('image bufferView exceeds the buffer');
    totalBytes += length;
    if (totalBytes > 64 * 1024 * 1024) fail('embedded images exceed the byte limit');
    const bytes = new Uint8Array(bin.subarray(offset, offset + length)), size = glbImageSize(bytes, mimeType);
    totalPixels += size.width * size.height;
    if (totalPixels > 33_554_432) fail('embedded images exceed the pixel limit');
    return { bytes, mimeType, size };
  });
  let texturePixels = 0, textureBytes = 0;
  return textures.map((entry, i) => {
    const texture = object(entry, `texture[${i}]`);
    keys(texture, ['source', 'sampler', 'name', 'extras'], `texture[${i}]`);
    const image = decodedImages[ref(texture.source, decodedImages, 'texture.source')];
    texturePixels += image.size.width * image.size.height; textureBytes += image.bytes.byteLength;
    if (texturePixels > 33_554_432 || textureBytes > 64 * 1024 * 1024) fail('texture instances exceed the resource limit');
    const sampler = texture.sampler === undefined ? {} : object(samplers[ref(texture.sampler, samplers, 'texture.sampler')], 'sampler');
    keys(sampler, ['wrapS', 'wrapT', 'minFilter', 'magFilter', 'name', 'extras'], 'sampler');
    const wrapS = sampler.wrapS === undefined ? 10497 : sampler.wrapS, wrapT = sampler.wrapT === undefined ? 10497 : sampler.wrapT;
    if (wrapS !== wrapT || (wrapS !== 10497 && wrapS !== 33071)) fail('sampler wrapping is not supported by the viewer');
    const min = sampler.minFilter, mag = sampler.magFilter;
    if (min !== undefined && min !== 9728 && min !== 9729 && min !== 9984 && min !== 9987) fail('sampler minification is not supported by the viewer');
    if (mag !== undefined && mag !== 9728 && mag !== 9729) fail('sampler magnification is not supported by the viewer');
    const minFilter = min === 9728 || min === 9984 ? 'nearest' : min === 9729 || min === 9987 ? 'linear' : null;
    const magFilter = mag === 9728 ? 'nearest' : mag === 9729 ? 'linear' : null;
    if (minFilter && magFilter && minFilter !== magFilter) fail('sampler filters differ');
    return { bytes: image.bytes, mimeType: image.mimeType, options: { srgb: true, mipmaps: min === undefined || min === 9984 || min === 9987, wrap: wrapS === 10497 ? 'repeat' : 'clamp', filter: minFilter ?? magFilter ?? 'linear' } };
  });
}
