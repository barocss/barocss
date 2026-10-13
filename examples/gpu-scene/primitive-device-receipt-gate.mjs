/** #1512 Offline gate for ACTUALLY captured 256x256 WebGPU/WebGL2 RGBA8 bytes.
 * This does not launch a browser or certify the provenance of supplied bytes.
 */
import { comparePixelWindow } from './primitive-pixel-windows.mjs';

const win = (x, y, radius = 0) => ({ x: x - radius, y: y - radius, width: radius * 2 + 1, height: radius * 2 + 1 });
const center = win(128, 128, 1), background = win(4, 4);
const expected = { center: [139, 139, 139, 255], background: [13, 18, 26, 255] };
function checkPixels(pixels, label) {
  if (!Array.isArray(pixels) || pixels.length !== 256 * 256 * 4 ||
      pixels.some(n => !Number.isInteger(n) || n < 0 || n > 255))
    throw new TypeError(label + ' must be complete top-left 256x256 RGBA8 byte array');
  return Uint8Array.from(pixels);
}
function exactEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function actualWindow(bytes, area, value) {
  let failures = 0, observed = 0;
  for (let y = area.y; y < area.y + area.height; y++)
    for (let x = area.x; x < area.x + area.width; x++) {
      observed++;
      const o = (y * 256 + x) * 4;
      if (value.some((v, i) => Math.abs(bytes[o + i] - v) > (i === 3 ? 0 : 2))) failures++;
    }
  return Object.freeze({ pixels: observed, outsideTolerancePixels: failures, pass: failures === 0 });
}
function frame(input, label) {
  if (!input || typeof input !== 'object' ||
      !Number.isSafeInteger(input.generation) || input.generation < 1)
    throw new TypeError(label + ' requires a positive integer generation');
  return { generation: input.generation, pixels: checkPixels(input.pixels, label) };
}
/** Receipt shape and provenance fields are deliberately strict: no inferred device acceptance. */
export function evaluatePrimitiveDeviceReceipt(receipt) {
  if (!receipt || receipt.version !== 0 || receipt.width !== 256 || receipt.height !== 256 ||
      receipt.amount !== 0.75 || receipt.phase !== 0 || !receipt.sourceSha ||
      !receipt.browser || !receipt.device || !receipt.webgpu || !receipt.webgl2)
    throw new TypeError('Original 256x256 source/device/browser and amount=.75 receipt required');
  const result = {};
  for (const name of ['webgpu', 'webgl2']) {
    const r = receipt[name];
    const baseline = frame(r.baseline, name + '.baseline');
    const updated = frame(r.updated, name + '.updated');
    const refused = frame(r.refused, name + '.refused');
    if (r.refusalCode !== 'INPUT' && r.refusalCode !== 'PROFILE')
      throw new TypeError(name + ' requires actual nonterminal malformed-frame refusal code');
    const retained = updated.generation === refused.generation && exactEqual(updated.pixels, refused.pixels);
    const advanced = updated.generation === baseline.generation + 1;
    result[name] = Object.freeze({
      advanced, retained,
      center: actualWindow(updated.pixels, center, expected.center),
      background: actualWindow(updated.pixels, background, expected.background),
      pixelsChanged: !exactEqual(baseline.pixels, updated.pixels),
    });
  }
  const gpu = checkPixels(receipt.webgpu.updated.pixels, 'webgpu.updated');
  const gl = checkPixels(receipt.webgl2.updated.pixels, 'webgl2.updated');
  const centerParity = comparePixelWindow(gpu, gl, 256, 256, center, 2);
  const backgroundParity = comparePixelWindow(gpu, gl, 256, 256, background, 2);
  const pass = Object.values(result).every(r => r.advanced && r.retained && r.pixelsChanged &&
    r.center.pass && r.background.pass) && centerParity.withinTolerance && backgroundParity.withinTolerance;
  return Object.freeze({
    pass, measured: true, sourceSha: receipt.sourceSha,
    browser: receipt.browser, device: receipt.device,
    webgpu: result.webgpu, webgl2: result.webgl2,
    parity: Object.freeze({ center: centerParity, background: backgroundParity }),
    scope: 'Submitted captured bytes only; original browser/device authenticity needs independent witness',
  });
}
