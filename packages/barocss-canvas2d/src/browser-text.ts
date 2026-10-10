import { Canvas2DError, validateImageAssetId } from './schema.js';
import type { ImageAssetInput } from './schema.js';
import type { GlyphRunLayout } from './display-tree.js';

export type BrowserTextPolicy = 'alphanumeric' | 'printable-ascii' | 'unicode-single-line';

export type BrowserTextOptions = {
  text: string;
  font: string;
  atlasId: string;
  dpr?: number;
  textPolicy?: BrowserTextPolicy;
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

export type BrowserMultilineTextAlignment = 'left' | 'center' | 'right';

export type BrowserMultilineTextOptions = {
  text: string;
  font: string;
  atlasId: string;
  /** Positive logical distance between adjacent alphabetic baselines. */
  lineAdvance: number;
  /** Align measured advance boxes within the widest line. */
  lineAlign?: BrowserMultilineTextAlignment;
  dpr?: number;
};

export type BrowserMultilineTextLine = {
  /** UTF-16 offsets in the original text, excluding the separating LF. */
  textStart: number;
  textEnd: number;
  baseline: number;
  advance: number;
};

export type BrowserMultilineTextRaster = BrowserTextRaster & {
  lineAdvance: number;
  lines: BrowserMultilineTextLine[];
};

/** One printable paragraph with single-space word boundaries. */
export type BrowserWrappedTextOptions = BrowserMultilineTextOptions & { maxWidth: number };
export type BrowserWrappedTextRaster = BrowserMultilineTextRaster & { maxWidth: number };

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
    if (typeof key !== 'string' || !['text', 'font', 'atlasId', 'dpr', 'textPolicy'].includes(key)) {
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
  const textPolicy: unknown = Object.hasOwn(fields, 'textPolicy') ? fields.textPolicy.value : 'alphanumeric';
  if (textPolicy !== 'alphanumeric' && textPolicy !== 'printable-ascii' && textPolicy !== 'unicode-single-line') {
    invalid('browser text policy is unsupported');
  }
  if (typeof text !== 'string' || text.length < 1 || text.length > 128) {
    invalid(textPolicy === 'alphanumeric'
      ? 'browser text requires 1..128 ASCII letters, digits or spaces with ink'
      : textPolicy === 'printable-ascii' ? 'browser text requires 1..128 printable ASCII characters'
      : 'browser text requires 1..128 well-formed Unicode code units');
  }
  if (textPolicy === 'alphanumeric') {
    if (!/^[A-Za-z0-9 ]+$/.test(text) || !/[A-Za-z0-9]/.test(text)) {
      invalid('browser text requires 1..128 ASCII letters, digits or spaces with ink');
    }
  } else if (textPolicy === 'printable-ascii') {
    if (!/^[\x20-\x7E]+$/.test(text) || !/[^ ]/.test(text)) {
      invalid('browser text requires printable ASCII with a nonspace character');
    }
  } else {
    if (/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u.test(text) || !/\S/u.test(text)) {
      invalid('browser Unicode text must be one line with a non-whitespace scalar');
    }
    for (let index = 0; index < text.length; index++) {
      const unit = text.charCodeAt(index);
      if (unit >= 0xD800 && unit <= 0xDBFF) {
        const next = text.charCodeAt(index + 1);
        if (!(next >= 0xDC00 && next <= 0xDFFF)) invalid('browser Unicode text has an unpaired surrogate');
        index++;
      } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
        invalid('browser Unicode text has an unpaired surrogate');
      }
    }
  }
  if (typeof font !== 'string' || font.trim().length === 0 || font.length > 256 || /[\r\n\0]/.test(font)) {
    invalid('browser text font must be a nonempty CSS declaration of at most 256 characters');
  }
  if (typeof dpr !== 'number' || !Number.isFinite(dpr) || dpr < 1 || dpr > 4) {
    invalid('browser text DPR must be finite and within 1..4');
  }
  return { text, font, dpr, textPolicy, atlasId: validateImageAssetId(fields.atlasId.value) };
}

function multilineOptionsOf(value: unknown, wrapped = false): Required<BrowserTextOptions> & { lineAdvance: number; lineAlign: BrowserMultilineTextAlignment; maxWidth?: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    invalid('browser multiline text options must be an ordinary data record');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(fields)) {
    if (typeof key !== 'string' || !['text', 'font', 'atlasId', 'dpr', 'lineAdvance', 'lineAlign', ...(wrapped ? ['maxWidth'] : [])].includes(key)) {
      invalid('browser multiline text options contain an unknown field');
    }
    if (!fields[key].enumerable || !('value' in fields[key])) invalid('browser multiline text options require data fields');
  }
  for (const key of ['text', 'font', 'atlasId', 'lineAdvance', ...(wrapped ? ['maxWidth'] : [])]) {
    if (!Object.hasOwn(fields, key)) invalid(`browser multiline text options require ${key}`);
  }
  const text: unknown = fields.text.value, font: unknown = fields.font.value;
  const dpr: unknown = Object.hasOwn(fields, 'dpr') ? fields.dpr.value : 1;
  const lineAdvance: unknown = fields.lineAdvance.value;
  const lineAlign: unknown = Object.hasOwn(fields, 'lineAlign') ? fields.lineAlign.value : 'left';
  if (lineAlign !== 'left' && lineAlign !== 'center' && lineAlign !== 'right') {
    invalid('browser multiline alignment is unsupported');
  }
  if (typeof text !== 'string' || text.length < 1 || text.length > 128) {
    invalid('browser multiline text requires 1..128 characters including LF');
  }
  if (wrapped && !/^[\x21-\x7E]+(?: [\x21-\x7E]+)*$/.test(text)) {
    invalid('browser wrapped text requires printable ASCII words separated by one space');
  }
  const maxWidth: unknown = wrapped ? fields.maxWidth.value : undefined;
  if (wrapped && (typeof maxWidth !== 'number' || !Number.isFinite(maxWidth) || maxWidth <= 0 || maxWidth > 1e6)) {
    invalid('browser wrapped width must be positive within finite coordinate limits');
  }
  const lines = text.split('\n');
  if (lines.length > 4 || lines.some(line => !/^[\x20-\x7E]+$/.test(line) || !/[^ ]/.test(line))) {
    invalid('browser multiline text requires 1..4 printable ASCII lines with ink');
  }
  if (typeof font !== 'string' || font.trim().length === 0 || font.length > 256 || /[\r\n\0]/.test(font)) {
    invalid('browser text font must be a nonempty CSS declaration of at most 256 characters');
  }
  if (typeof dpr !== 'number' || !Number.isFinite(dpr) || dpr < 1 || dpr > 4) {
    invalid('browser text DPR must be finite and within 1..4');
  }
  if (typeof lineAdvance !== 'number' || !Number.isFinite(lineAdvance) || lineAdvance <= 0 ||
      lineAdvance > 1e6 || (lines.length - 1) * lineAdvance > 1e6) {
    invalid('browser multiline baseline advance must be positive within finite coordinate limits');
  }
  return { text, font, dpr, lineAdvance, lineAlign, textPolicy: 'printable-ascii', atlasId: validateImageAssetId(fields.atlasId.value), ...(wrapped ? { maxWidth: maxWidth as number } : {}) };
}

/** Prepare owned raster data. The host must prepare fonts before this call. */
export function rasterizeBrowserText(options: BrowserTextOptions): BrowserTextRaster {
  return rasterize(optionsOf(options));
}

/** Prepare one copied whole-label atlas from explicit LF-separated lines.
 * The host prepares fonts. Overlapping lines use source-over in text order. */
export function rasterizeBrowserMultilineText(options: BrowserMultilineTextOptions): BrowserMultilineTextRaster {
  return rasterize(multilineOptionsOf(options)) as BrowserMultilineTextRaster;
}

/** Greedily wrap whole words; preserve original offsets and text in the result. */
export function rasterizeBrowserWrappedText(options: BrowserWrappedTextOptions): BrowserWrappedTextRaster {
  return rasterize(multilineOptionsOf(options, true)) as BrowserWrappedTextRaster;
}

function wrappedLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: { text: string; start: number }[] = [];
  let line = '', start = 0, cursor = 0;
  const measure = (candidate: string) => {
    const width = context.measureText(candidate).width;
    if (!Number.isFinite(width) || width < 0 || width > 1e6) {
      throw new Canvas2DError('INVALID_ASSET', 'browser text metrics are outside finite coordinate limits');
    }
    return width;
  };
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) line = candidate;
    else {
      if (!line) throw new Canvas2DError('ASSET_LIMIT', 'browser wrapped word exceeds maxWidth');
      lines.push({ text: line, start });
      if (lines.length >= 4) throw new Canvas2DError('ASSET_LIMIT', 'browser wrapped text exceeds four lines');
      if (measure(word) > maxWidth) throw new Canvas2DError('ASSET_LIMIT', 'browser wrapped word exceeds maxWidth');
      line = word; start = cursor;
    }
    cursor += word.length + 1;
  }
  lines.push({ text: line, start });
  return lines;
}

function rasterize(input: Required<BrowserTextOptions> & { lineAdvance?: number; lineAlign?: BrowserMultilineTextAlignment; maxWidth?: number }): BrowserTextRaster | BrowserMultilineTextRaster | BrowserWrappedTextRaster {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' ||
      !document.fonts || typeof document.fonts.check !== 'function') {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'browser text and font APIs are unavailable');
  }
  let canvas: HTMLCanvasElement | undefined;
  try {
    canvas = document.createElement('canvas');
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
    const wrapped = input.maxWidth === undefined ? null : wrappedLines(context, input.text, input.maxWidth);
    const texts = wrapped ? wrapped.map(line => line.text) : input.lineAdvance === undefined ? [input.text] : input.text.split('\n');
    const lines: BrowserMultilineTextLine[] = [];
    const inkEdges: { left: number; right: number }[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, advance = 0, textStart = 0;
    for (const [index, text] of texts.entries()) {
      const measured = context.measureText(text);
      const values = [measured.width, measured.actualBoundingBoxLeft, measured.actualBoundingBoxRight,
        measured.actualBoundingBoxAscent, measured.actualBoundingBoxDescent];
      const baseline = index * (input.lineAdvance ?? 0);
      const inkTop = baseline - measured.actualBoundingBoxAscent, inkBottom = baseline + measured.actualBoundingBoxDescent;
      if (!values.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6) || measured.width < 0 ||
          ![inkTop, inkBottom].every(value => Number.isFinite(value) && Math.abs(value) <= 1e6)) {
        throw new Canvas2DError('INVALID_ASSET', 'browser text metrics are outside finite coordinate limits');
      }
      inkEdges.push({ left: -measured.actualBoundingBoxLeft, right: measured.actualBoundingBoxRight });
      minY = Math.min(minY, inkTop); maxY = Math.max(maxY, inkBottom); advance = Math.max(advance, measured.width);
      if (wrapped) textStart = wrapped[index].start;
      lines.push({ textStart, textEnd: textStart + text.length, baseline, advance: measured.width });
      textStart += text.length + 1;
    }
    const alignWidth = input.maxWidth ?? advance;
    const offsets = lines.map(line => input.lineAlign === 'center' ? (alignWidth - line.advance) / 2 :
      input.lineAlign === 'right' ? alignWidth - line.advance : 0);
    for (const [index, ink] of inkEdges.entries()) {
      const inkLeft = offsets[index] + ink.left, inkRight = offsets[index] + ink.right;
      if (![inkLeft, inkRight].every(value => Number.isFinite(value) && Math.abs(value) <= 1e6)) {
        throw new Canvas2DError('INVALID_ASSET', 'browser text metrics are outside finite coordinate limits');
      }
      minX = Math.min(minX, inkLeft); maxX = Math.max(maxX, inkRight);
    }
    const left = Math.floor(minX) - 2, right = Math.ceil(maxX) + 2;
    const top = Math.floor(minY) - 2, bottom = Math.ceil(maxY) + 2;
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
    for (const [index, text] of texts.entries()) context.fillText(text, offsets[index] - left, lines[index].baseline - top);
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
    const result: BrowserTextRaster = { asset: { width, height, pixels }, font, dpr: input.dpr, advance: input.lineAdvance === undefined ? lines[0].advance : advance,
      bounds, layout: { atlasId: input.atlasId, text: input.text, baseline: 0, opacity: 1, sampling: 'nearest',
        glyphs: [{ sourceRect: { x: 0, y: 0, width, height }, x: left, y: top,
          width: bounds.width, height: bounds.height, textStart: 0, textEnd: input.text.length }] } };
    if (input.lineAdvance === undefined) return result;
    const multiline = { ...result, lineAdvance: input.lineAdvance, lines };
    return input.maxWidth === undefined ? multiline : { ...multiline, maxWidth: input.maxWidth };
  } catch (error) {
    if (error instanceof Canvas2DError) throw error;
    throw new Canvas2DError('INVALID_ASSET', 'browser could not allocate, measure, draw or read text');
  } finally {
    if (canvas) {
      // Release the rejected or copied backing without changing the result or error.
      try { canvas.width = 0; } catch { /* Continue with the other dimension. */ }
      try { canvas.height = 0; } catch { /* Preserve the result or original error. */ }
    }
  }
}
