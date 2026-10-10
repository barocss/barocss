// @ts-check
// Browser-owned font preparation; this is an example host, not a core Text API.
export const fontStyle = '24px monospace';
export const rasterDPR = 2;
export class HostTextError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.name = 'HostTextError'; this.code = code; }
}
/** @param {unknown} input @returns {string} */
export function validateText(input) {
  if (typeof input !== 'string' || input.length < 1 || input.length > 32 ||
      !/^[A-Za-z0-9 ]+$/.test(input) || !/[A-Za-z0-9]/.test(input)) {
    throw new HostTextError('HOST_TEXT', 'Use 1..32 ASCII letters, digits or spaces, with at least one letter or digit');
  }
  return input;
}
/** @typedef {{width:number,actualBoundingBoxLeft:number,actualBoundingBoxRight:number,
 * actualBoundingBoxAscent:number,actualBoundingBoxDescent:number}} Metrics */
/** @param {Metrics} metrics */
export function boundsFromMetrics(metrics) {
  if (![metrics.width, metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxRight,
    metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent].every(Number.isFinite)) {
    throw new HostTextError('HOST_METRICS', 'Font metrics must be finite');
  }
  const left = Math.floor(-metrics.actualBoundingBoxLeft) - 2;
  const right = Math.ceil(metrics.actualBoundingBoxRight) + 2;
  const top = Math.floor(-metrics.actualBoundingBoxAscent) - 2;
  const bottom = Math.ceil(metrics.actualBoundingBoxDescent) + 2;
  const width = right - left, height = bottom - top;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new HostTextError('HOST_METRICS', 'Font bounds must be positive safe integer extents');
  }
  const backingWidth = width * rasterDPR, backingHeight = height * rasterDPR;
  if (backingWidth > 1024 || backingHeight > 128 || backingWidth * backingHeight > 131072) {
    throw new HostTextError('HOST_RASTER_LIMIT', 'Raster exceeds 1024x128 and 131072 pixels');
  }
  return { left, right, top, bottom, width, height, backingWidth, backingHeight, advance: metrics.width };
}
/** @param {ReturnType<typeof boundsFromMetrics>} bounds @param {Uint8Array | Uint8ClampedArray} pixels */
export function copyRaster(bounds, pixels) {
  if (!(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) ||
      pixels.length !== bounds.backingWidth * bounds.backingHeight * 4 || pixels.length > 524288) {
    throw new HostTextError('HOST_RASTER', 'RGBA8 bytes must match the admitted raster extents');
  }
  const copy = new Uint8Array(pixels);
  let hasInk = false;
  for (let index = 3; index < copy.length; index += 4) if (copy[index] !== 0) { hasInk = true; break; }
  if (!hasInk) throw new HostTextError('HOST_RASTER', 'Raster has no nonzero-alpha ink');
  return { width: bounds.backingWidth, height: bounds.backingHeight, pixels: copy };
}
/** @param {string} text @param {number} delayMS */
export async function prepareRaster(text, delayMS = 0) {
  const label = validateText(text);
  if (!Number.isInteger(delayMS) || delayMS < 0 || delayMS > 1000) {
    throw new HostTextError('HOST_FONT', 'Host readiness delay must be 0..1000ms');
  }
  if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function' ||
      typeof document.fonts.check !== 'function') throw new HostTextError('HOST_FONT', 'Browser font APIs unavailable');
  const fonts = document.fonts;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let timeout;
  let loadedFaces;
  try {
    loadedFaces = await Promise.race([
      (async () => {
        if (delayMS) await new Promise(resolve => setTimeout(resolve, delayMS));
        await fonts.ready;
        const loaded = await fonts.load(fontStyle, label);
        if (!fonts.check(fontStyle, label)) throw new HostTextError('HOST_FONT', 'Declared browser font is not ready');
        return loaded.length;
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new HostTextError('HOST_FONT_TIMEOUT', 'Font readiness exceeded 5s')), 5000);
      }),
    ]);
  } catch (error) {
    if (error instanceof HostTextError) throw error;
    throw new HostTextError('HOST_FONT', 'Browser font readiness failed');
  } finally { clearTimeout(timeout); }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new HostTextError('HOST_RASTER', 'Browser Canvas2D unavailable');
  function configure() {
    if (!context) return;
    context.font = fontStyle; context.textBaseline = 'alphabetic';
    context.textAlign = 'left'; context.direction = 'ltr'; context.fillStyle = '#ffffff';
  }
  configure();
  const measured = context.measureText(label);
  const metrics = { width: measured.width, actualBoundingBoxLeft: measured.actualBoundingBoxLeft,
    actualBoundingBoxRight: measured.actualBoundingBoxRight, actualBoundingBoxAscent: measured.actualBoundingBoxAscent,
    actualBoundingBoxDescent: measured.actualBoundingBoxDescent };
  const bounds = boundsFromMetrics(metrics);
  canvas.width = bounds.backingWidth; canvas.height = bounds.backingHeight;
  configure(); context.scale(rasterDPR, rasterDPR);
  context.fillText(label, -bounds.left, -bounds.top);
  let asset;
  try { asset = copyRaster(bounds, context.getImageData(0, 0, canvas.width, canvas.height).data); }
  catch (error) {
    if (error instanceof HostTextError) throw error;
    throw new HostTextError('HOST_RASTER', 'Browser raster read failed');
  }
  return { text: label, bounds, metrics, asset, font: { style: fontStyle, loadedFaces: Number(loadedFaces), check: true }, dpr: rasterDPR };
}
