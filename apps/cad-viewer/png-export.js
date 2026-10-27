function snapshotOverlay(overlay) {
  if (overlay == null) return null;
  const { width, height, points, distanceMM = null } = overlay;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Array.isArray(points))
    throw new Error('The measurement overlay size is invalid.');
  const copied = points.map(({ label, xCss, yCss }) => {
    if ((label !== 'A' && label !== 'B') || !Number.isFinite(xCss) || !Number.isFinite(yCss))
      throw new Error('The measurement overlay point is invalid.');
    return { label, xCss, yCss };
  });
  if (copied.length > 2 || new Set(copied.map(point => point.label)).size !== copied.length)
    throw new Error('The measurement overlay points are invalid.');
  if (distanceMM !== null && (!Number.isFinite(distanceMM) || distanceMM < 0))
    throw new Error('The measurement distance is invalid.');
  return { width, height, distanceMM, points: copied.filter(point =>
    point.xCss >= 0 && point.xCss <= width && point.yCss >= 0 && point.yCss <= height) };
}

function drawOverlay(context, overlay, width, height) {
  const { points } = overlay;
  context.save();
  context.scale(width / overlay.width, height / overlay.height);
  if (points.length === 2) {
    context.beginPath();
    context.moveTo(points[0].xCss, points[0].yCss);
    context.lineTo(points[1].xCss, points[1].yCss);
    context.strokeStyle = '#0e1d25'; context.lineWidth = 4; context.stroke();
    context.strokeStyle = '#8ce8f2'; context.lineWidth = 1.5; context.stroke();
  }
  context.font = '600 12px sans-serif';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  for (const point of points) {
    context.beginPath(); context.arc(point.xCss, point.yCss, 4, 0, 2 * Math.PI);
    context.fillStyle = '#b4f3fa'; context.fill();
    context.strokeStyle = '#14333f'; context.lineWidth = 2; context.stroke();
    const insetX = Math.min(10, overlay.width / 2), insetY = Math.min(14, overlay.height / 2);
    const x = Math.max(insetX, Math.min(overlay.width - insetX, point.xCss + 10));
    const y = Math.max(insetY, Math.min(overlay.height - insetY, point.yCss - 10));
    context.strokeStyle = '#10232c'; context.lineWidth = 3; context.strokeText(point.label, x, y);
    context.fillStyle = '#c9f7fb'; context.fillText(point.label, x, y);
  }
  if (overlay.distanceMM !== null) {
    const fixed = overlay.distanceMM.toFixed(6);
    const rounded = fixed.includes('e') ? fixed : fixed.replace(/\.?0+$/, '');
    const text = `${rounded || '0'} mm`;
    const badgeWidth = Math.min(overlay.width, context.measureText(text).width + 20);
    const badgeHeight = Math.min(26, overlay.height);
    const x = (overlay.width - badgeWidth) / 2, y = Math.max(0, overlay.height - badgeHeight - 14);
    context.fillStyle = '#10232c'; context.fillRect(x, y, badgeWidth, badgeHeight);
    context.fillStyle = '#c9f7fb'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, overlay.width / 2, y + badgeHeight / 2, Math.max(0, badgeWidth - 8));
  }
  context.restore();
}

export function createPngExport({ viewer, canvas, onChange, isLoaded, frameGuard, generation }) {
  let epoch = 0, busy = false, status = '';
  const urls = new Set();
  const refresh = () => { onChange({ busy, status }); };
  const cancel = () => {
    epoch++;
    if (busy) status = 'Image capture cancelled. Export again.';
    busy = false;
    refresh();
  };
  const exportImage = async (options = {}) => {
    if (busy || !isLoaded()) return;
    const request = ++epoch, guard = frameGuard(), version = generation();
    const width = canvas.width, height = canvas.height;
    busy = true; status = 'Preparing PNG…'; refresh();
    let url;
    let overlay;
    const assertCurrent = () => {
      if (guard !== frameGuard() || version !== generation())
        throw new Error('The view changed. Export PNG again.');
      if (overlay) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width !== overlay.width || rect.height !== overlay.height)
          throw new Error('The view size changed. Export PNG again.');
      }
    };
    try {
      overlay = snapshotOverlay(options.overlay);
      assertCurrent();
      const pixels = await viewer.readPixels();
      if (request !== epoch) return;
      assertCurrent();
      if (!width || !height || pixels.byteLength !== width * height * 4)
        throw new Error('The captured image size is invalid.');
      const image = document.createElement('canvas');
      image.width = width; image.height = height;
      const context = image.getContext('2d');
      if (!context) throw new Error('The image encoder is unavailable.');
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
      if (overlay) drawOverlay(context, overlay, width, height);
      const blob = await new Promise(resolve => image.toBlob(resolve, 'image/png'));
      if (request !== epoch) return;
      assertCurrent();
      if (!blob) throw new Error('The image encoder returned no PNG.');
      url = URL.createObjectURL(blob); urls.add(url);
      const link = document.createElement('a');
      link.href = url; link.download = 'viewer-review.png'; link.click();
      status = 'PNG saved.';
    } catch (error) {
      if (request === epoch) status = 'PNG not saved: ' + (error?.message || String(error));
    } finally {
      if (url) setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 1000);
      if (request === epoch) { busy = false; refresh(); }
    }
  };
  refresh();
  return { exportImage, cancel, dispose() {
    cancel();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  } };
}
