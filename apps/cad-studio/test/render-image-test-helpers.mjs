// Hold genuine browser outcomes by file name and inspect decoded image pixels.
export function installDecodeHold(prefix = 'D577-') {
  const decode = window.createImageBitmap;
  const held = new Map();
  const closed = [];
  const bitmapNames = new WeakMap();
  const closeBitmap = ImageBitmap.prototype.close;
  ImageBitmap.prototype.close = function () {
    const name = bitmapNames.get(this);
    if (name) closed.push(name);
    return closeBitmap.call(this);
  };
  window.createImageBitmap = function (source, ...options) {
    const decoded = decode.call(this, source, ...options);
    if (!(source instanceof File) || !source.name.startsWith(prefix)) return decoded;
    return new Promise((resolve, reject) => {
      decoded.then(bitmap => {
        bitmapNames.set(bitmap, source.name);
        held.set(source.name, { ok: true, deliver: () => resolve(bitmap) });
      }, error => held.set(source.name, { ok: false, deliver: () => reject(error) }));
    });
  };
  window.__renderDecodeHold = {
    read: name => held.get(name)?.ok ?? null,
    release(name) {
      const entry = held.get(name);
      if (!entry) throw new Error('No held decode for ' + name);
      held.delete(name);
      entry.deliver();
    },
    closed: () => [...closed],
  };
}

export const imagePixels = (page, url) => page.evaluate(async url => {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const rgba = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', rgba)), x => x.toString(16).padStart(2, '0')).join('');
    return { hash, width: bitmap.width, height: bitmap.height, transparent: rgba.some((v, i) => i % 4 === 3 && v < 255) };
  } finally { bitmap.close(); }
}, url);
