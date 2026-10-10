// @ts-check
// The host owns font readiness and its narrower example limits.
import { rasterizeBrowserText } from '@barocss/canvas2d';
export const fontStyle = '24px monospace';
export const rasterDPR = 2;
const atlasId = 'TextAtlas';
const hostCounts = { helperCalls: 0 };
export function getHostCounts() { return { ...hostCounts }; }
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
/** The public helper has already measured, rasterized and copied this result.
 * This narrower example guard runs after the helper scratch allocation.
 * @param {import('@barocss/canvas2d').BrowserTextRaster} result @param {number} loadedFaces */
export function admitRaster(result, loadedFaces = 0) {
  const { asset, bounds, layout } = result;
  if (asset.width > 1024 || asset.height > 128 || asset.width * asset.height > 131072 || asset.pixels.length > 524288) {
    throw new HostTextError('HOST_RASTER_LIMIT', 'Example raster exceeds 1024x128 or 512 KiB');
  }
  return { text: layout.text, layout, asset, dpr: result.dpr,
    bounds: { ...bounds, right: bounds.left + bounds.width, bottom: bounds.top + bounds.height,
      backingWidth: asset.width, backingHeight: asset.height, advance: result.advance },
    font: { style: result.font, loadedFaces, check: true } };
}
/** @param {string} text @param {number} delayMS @param {()=>boolean} isCurrent */
export async function prepareRaster(text, delayMS = 0, isCurrent = () => true) {
  const label = validateText(text);
  if (!Number.isInteger(delayMS) || delayMS < 0 || delayMS > 1000 || typeof isCurrent !== 'function') {
    throw new HostTextError('HOST_FONT', 'Host readiness needs a 0..1000ms delay and a current-generation callback');
  }
  if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function' ||
      typeof document.fonts.check !== 'function') throw new HostTextError('HOST_FONT', 'Browser font APIs unavailable');
  const fonts = document.fonts;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let timeout;
  /** @type {number} */ let loadedFaces;
  try {
    loadedFaces = await Promise.race([
      (async () => {
        if (delayMS) await new Promise(resolve => setTimeout(resolve, delayMS));
        await fonts.ready;
        const loaded = await fonts.load(fontStyle, label);
        if (!fonts.check(fontStyle, label)) throw new HostTextError('HOST_FONT', 'Declared browser font is not ready');
        return loaded.length;
      })(),
      /** @type {Promise<never>} */ (new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new HostTextError('HOST_FONT_TIMEOUT', 'Font readiness exceeded 5s')), 5000);
      })),
    ]);
  } catch (error) {
    if (error instanceof HostTextError) throw error;
    throw new HostTextError('HOST_FONT', 'Browser font readiness failed');
  } finally { clearTimeout(timeout); }
  // Superseded font readiness cannot allocate a public helper scratch raster.
  if (!isCurrent()) return null;
  hostCounts.helperCalls++;
  const result = rasterizeBrowserText({ text: label, font: fontStyle, atlasId, dpr: rasterDPR });
  return admitRaster(result, loadedFaces);
}
/** Actual measured public-helper refusal; no synthetic metric input. */
export function oversizeRaster() {
  hostCounts.helperCalls++;
  return rasterizeBrowserText({ text: 'M'.repeat(32), font: '1000px monospace', atlasId, dpr: rasterDPR });
}
