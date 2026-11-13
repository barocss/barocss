import type { CameraFitArea } from './camera';

const PADDING = 12;

/** Read the current space between Studio's persistent controls when a model frame is requested. */
export function modelFitArea(canvas: HTMLCanvasElement): CameraFitArea | undefined {
  const studio = canvas.closest('.studio');
  if (!studio) return undefined;
  const toolbar = studio.querySelector('nav.toolbar');
  if (!toolbar?.getClientRects().length) return undefined;
  const box = canvas.getBoundingClientRect();
  const toolbarBox = toolbar.getBoundingClientRect();
  const panels = (selector: string) => Array.from(studio.querySelectorAll(selector), element => element.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0 && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top);
  const left = Math.max(box.left, toolbarBox.right) + PADDING;
  const right = Math.min(box.right, ...panels('.dock, .dock-strip').map(rect => rect.left)) - PADDING;
  const top = Math.max(box.top, ...panels('.topbar, .view-cube').map(rect => rect.bottom)) + PADDING;
  const bottom = Math.min(box.bottom, ...panels('.corner-right, .corner-right .previews, .history').map(rect => rect.top)) - PADDING;
  if (right <= left || bottom <= top) return undefined;
  return { left: (left - box.left) / box.width, right: (right - box.left) / box.width,
    top: (top - box.top) / box.height, bottom: (bottom - box.top) / box.height };
}
