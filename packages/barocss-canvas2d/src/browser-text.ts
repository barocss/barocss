import { Canvas2DError, validateImageAssetId } from './schema.js';
import type { ImageAssetInput } from './schema.js';
import type { GlyphRunLayout } from './display-tree.js';

export type BrowserTextOptions = {
  text: string;
  font: string;
  atlasId: string;
  dpr?: number;
};

export type BrowserTextRaster = {
  asset: ImageAssetInput;
  layout: GlyphRunLayout;
  /** Normalized declaration; this does not identify the matched typeface. */
  font: string;
  dpr: number;
  advance: number;
  bounds: { left: number; top: number; width: number; height: number };
};

function invalid(message: string): never {
  throw new Canvas2DError('INVALID_SCENE', message);
}

function optionsOf(value: unknown): Required<BrowserTextOptions> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    invalid('browser text options must be an ordinary data record');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(fields)) {
    if (typeof key !== 'string' || !['text', 'font', 'atlasId', 'dpr'].includes(key)) {
      invalid('browser text options contain an unknown field');
    }
    const descriptor = fields[key];
    if (!descriptor.enumerable || !('value' in descriptor)) invalid('browser text options require data fields');
  }
  for (const key of ['text', 'font', 'atlasId']) {
    if (!Object.hasOwn(fields, key)) invalid(`browser text options require ${key}`);
  }
  const text: unknown = fields.text.value;
  const font: unknown = fields.font.value;
  const dpr: unknown = Object.hasOwn(fields, 'dpr') ? fields.dpr.value : 1;
  if (typeof text !== 'string' || text.length < 1 || text.length > 128 ||
      !/^[A-Za-z0-9 ]+$/.test(text) || !/[A-Za-z0-9]/.test(text)) {
    invalid('browser text requires 1..128 ASCII letters, digits or spaces with ink');
  }
  if (typeof font !== 'string' || font.trim().length === 0 || font.length > 256 || /[\r\n\0]/.test(font)) {
    invalid('browser text font must be a nonempty CSS declaration of at most 256 characters');
  }
  if (typeof dpr !== 'number' || !Number.isFinite(dpr) || dpr < 1 || dpr > 4) {
    invalid('browser text DPR must be finite and within 1..4');
  }
  return { text, font, dpr, atlasId: validateImageAssetId(fields.atlasId.value) };
}

/** Prepare owned raster data. The host must prepare fonts before this call. */
export function rasterizeBrowserText(options: BrowserTextOptions): BrowserTextRaster {
  const input = optionsOf(options);
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' ||
      !document.fonts || typeof document.fonts.check !== 'function') {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'browser text and font APIs are unavailable');
  }
  try {
    const canvas = document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') {
      throw new Canvas2DError('UNSUPPORTED_FEATURE', 'scratch canvas API is unavailable');
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || ['measureText', 'setTransform', 'scale', 'fillText', 'getImageData']
      .some(key => typeof context[key as keyof CanvasRenderingContext2D] !== 'function')) {
      throw new Canvas2DError('UNSUPPORTED_FEATURE', 'scratch Canvas2D API is unavailable');
    }

    // An invalid assignment keeps the sentinel. Two distinct sentinels also
    // accept a valid declaration that happens to normalize to one sentinel.
    context.font = '10px serif';
    context.font = input.font;
    const first = context.font;
    context.font = '20px monospace';
    context.font = input.font;
    const font = context.font;
    if (first !== font || typeof font !== 'string' || font.length === 0) {
      invalid('browser ignored the CSS font declaration');
    }
    if (!document.fonts.check(font, input.text)) {
      throw new Canvas2DError('INVALID_ASSET', 'browser text font is not ready');
    }
    function configure() {
      context!.setTransform(1, 0, 0, 1, 0, 0);
      context!.font = font;
      context!.textAlign = 'left';
      context!.textBaseline = 'alphabetic';
      context!.direction = 'ltr';
      context!.fillStyle = '#ffffff';
      context!.globalAlpha = 1;
      context!.globalCompositeOperation = 'source-over';
      context!.fontKerning = 'auto';
      if ('letterSpacing' in context!) context!.letterSpacing = '0px';
      if ('wordSpacing' in context!) context!.wordSpacing = '0px';
    }
    configure();
    const measured = context.measureText(input.text);
    const values = [measured.width, measured.actualBoundingBoxLeft, measured.actualBoundingBoxRight,
      measured.actualBoundingBoxAscent, measured.actualBoundingBoxDescent];
    if (!values.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6) || measured.width < 0) {
      throw new Canvas2DError('INVALID_ASSET', 'browser text metrics are outside finite coordinate limits');
    }
    const left = Math.floor(-measured.actualBoundingBoxLeft) - 2;
    const right = Math.ceil(measured.actualBoundingBoxRight) + 2;
    const top = Math.floor(-measured.actualBoundingBoxAscent) - 2;
    const bottom = Math.ceil(measured.actualBoundingBoxDescent) + 2;
    const width = Math.ceil((right - left) * input.dpr);
    const height = Math.ceil((bottom - top) * input.dpr);
    if (![left, right, top, bottom].every(value => Math.abs(value) <= 1e6) ||
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
      throw new Canvas2DError('INVALID_ASSET', 'browser text raster bounds are invalid');
    }
    if (width > 1024 || height > 256 || width * height * 4 > 1048576) {
      throw new Canvas2DError('ASSET_LIMIT', 'browser text raster exceeds 1024x256 or 1 MiB');
    }
    canvas.width = width;
    canvas.height = height;
    configure();
    context.scale(input.dpr, input.dpr);
    context.fillText(input.text, -left, -top);
    const data: unknown = context.getImageData(0, 0, width, height).data;
    if (!(data instanceof Uint8ClampedArray || data instanceof Uint8Array) || data.length !== width * height * 4) {
      throw new Canvas2DError('INVALID_ASSET', 'browser text readback has an invalid RGBA8 extent');
    }
    const pixels = new Uint8Array(data);
    let hasInk = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) { hasInk = true; break; }
    }
    if (!hasInk) throw new Canvas2DError('INVALID_ASSET', 'browser text raster has no ink');
    const bounds = { left, top, width: width / input.dpr, height: height / input.dpr };
    return { asset: { width, height, pixels }, font, dpr: input.dpr, advance: measured.width,
      bounds, layout: { atlasId: input.atlasId, text: input.text, baseline: 0, opacity: 1, sampling: 'nearest',
        glyphs: [{ sourceRect: { x: 0, y: 0, width, height }, x: left, y: top,
          width: bounds.width, height: bounds.height, textStart: 0, textEnd: input.text.length }] } };
  } catch (error) {
    if (error instanceof Canvas2DError) throw error;
    throw new Canvas2DError('INVALID_ASSET', 'browser could not allocate, measure, draw or read text');
  }
}
