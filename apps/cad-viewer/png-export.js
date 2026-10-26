export function attachPngExport({ viewer, canvas, button, status, isLoaded, frameGuard, generation }) {
  let epoch = 0, busy = false;
  const urls = new Set();
  const refresh = () => { button.disabled = busy || !isLoaded(); };
  const cancel = () => {
    epoch++;
    if (busy) status.textContent = 'Image capture cancelled. Export again.';
    busy = false;
    refresh();
  };
  const exportImage = async () => {
    if (busy || !isLoaded()) return;
    const request = ++epoch, guard = frameGuard(), version = generation();
    const width = canvas.width, height = canvas.height;
    busy = true; refresh();
    status.textContent = 'Preparing PNG…';
    let url;
    const assertCurrent = () => {
      if (guard !== frameGuard() || version !== generation())
        throw new Error('The view changed. Export PNG again.');
    };
    try {
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
      const blob = await new Promise(resolve => image.toBlob(resolve, 'image/png'));
      if (request !== epoch) return;
      assertCurrent();
      if (!blob) throw new Error('The image encoder returned no PNG.');
      url = URL.createObjectURL(blob); urls.add(url);
      const link = document.createElement('a');
      link.href = url; link.download = 'viewer-review.png'; link.click();
      status.textContent = 'PNG saved.';
    } catch (error) {
      if (request === epoch) status.textContent = 'PNG not saved: ' + (error?.message || String(error));
    } finally {
      if (url) setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 1000);
      if (request === epoch) { busy = false; refresh(); }
    }
  };
  button.addEventListener('click', exportImage);
  refresh();
  return { refresh, cancel, dispose() {
    cancel(); button.removeEventListener('click', exportImage);
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  } };
}
