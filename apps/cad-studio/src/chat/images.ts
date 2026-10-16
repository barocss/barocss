// Images attached to a chat message, scaled in the browser so the long side is at most MAX_SIDE px
// (what the model reads at full detail) and sent as base64 PNG (drawings) or JPEG (photos).
export interface ChatImage { media_type: 'image/png' | 'image/jpeg'; data: string; name: string; width: number; height: number }

export const MAX_SIDE = 1568;
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/** The scaled size of a w × h image. */
export function fitSize(w: number, h: number, max = MAX_SIDE): [number, number] {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

export async function prepareImage(file: Blob & { name?: string }): Promise<ChatImage> {
  if (!ACCEPT.split(',').includes(file.type)) throw new Error(`${file.name ?? 'The file'} is not a PNG, JPEG, WebP or GIF image.`);
  const bitmap = await createImageBitmap(file);
  const [width, height] = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d')!;
  // (Transparent drawings read best on white.)
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, width, height);
  g.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  // Line drawings stay PNG (crisp, small); photos become JPEG.
  const media_type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const url = canvas.toDataURL(media_type, 0.9);
  return { media_type, data: url.slice(url.indexOf(',') + 1), name: file.name ?? 'image', width, height };
}

export const imageUrl = (i: ChatImage) => `data:${i.media_type};base64,${i.data}`;
