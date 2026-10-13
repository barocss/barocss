/** #1512 pixel-window measurement, not a browser or GPU acceptance driver.
 * Caller supplies actual same-size, top-left RGBA8 backing pixels and declared windows.
 * This module never invents expected values or treats synthetic inputs as GPU proof.
 */
export function comparePixelWindow(before, after, width, height, window, tolerance) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 4096 || height > 4096 || width * height > 4194304)
    throw new RangeError('Invalid backing dimensions');
  if (!(before instanceof Uint8Array) || !(after instanceof Uint8Array) ||
      before.length !== width * height * 4 || after.length !== before.length)
    throw new TypeError('Both images must be complete RGBA8 Uint8Arrays');
  if (!window || !Number.isInteger(window.x) || !Number.isInteger(window.y) ||
      !Number.isInteger(window.width) || !Number.isInteger(window.height) ||
      window.x < 0 || window.y < 0 || window.width < 1 || window.height < 1 ||
      window.x + window.width > width || window.y + window.height > height)
    throw new RangeError('Invalid declared pixel window');
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255)
    throw new RangeError('Tolerance must be an integer channel delta in 0..255');
  let changedPixels = 0, outsideTolerancePixels = 0, maxChannelDelta = 0, totalChannelDelta = 0;
  for (let y = window.y; y < window.y + window.height; y++) {
    for (let x = window.x; x < window.x + window.width; x++) {
      const offset = (y * width + x) * 4;
      let changed = false, outside = false;
      for (let channel = 0; channel < 4; channel++) {
        const delta = Math.abs(before[offset + channel] - after[offset + channel]);
        if (delta > 0) changed = true;
        if (delta > tolerance) outside = true;
        maxChannelDelta = Math.max(maxChannelDelta, delta);
        totalChannelDelta += delta;
      }
      if (changed) changedPixels++;
      if (outside) outsideTolerancePixels++;
    }
  }
  const pixels = window.width * window.height;
  return Object.freeze({
    window: Object.freeze({ x: window.x, y: window.y, width: window.width, height: window.height }),
    tolerance, pixels, changedPixels, outsideTolerancePixels, maxChannelDelta,
    meanChannelDelta: totalChannelDelta / (pixels * 4),
    withinTolerance: outsideTolerancePixels === 0,
  });
}
