const ORBIT_STEP = Math.PI / 36;
const PAN_RATIO = 0.08;
const ZOOM_FACTOR = 1.15;

/** Handle camera keys only on the focused Viewer canvas. Key repeat is allowed. */
export function handleCameraKey(event, { canvas, viewer, isLoaded, onError }) {
  if (event.target !== canvas || event.defaultPrevented || event.isComposing
    || event.altKey || event.ctrlKey || event.metaKey || !isLoaded()) return false;

  const arrows = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
  };
  const direction = Object.hasOwn(arrows, event.key) ? arrows[event.key] : null;
  const zoom = event.key === '+' || event.key === '=' ? ZOOM_FACTOR
    : event.key === '-' ? 1 / ZOOM_FACTOR : null;
  if (!direction && (zoom === null || (event.shiftKey && event.key === '-'))) return false;

  event.preventDefault();
  try {
    if (direction && event.shiftKey) {
      const camera = viewer.captureReviewState().camera;
      const distance = Math.hypot(...camera.eye.map((value, index) => value - camera.target[index]));
      const step = Math.min(1000, distance * PAN_RATIO);
      viewer.pan(direction[0] * step, direction[1] * step);
    } else if (direction) viewer.orbit(direction[0] * ORBIT_STEP, direction[1] * ORBIT_STEP);
    else viewer.zoom(zoom);
  } catch (error) { onError(error); }
  return true;
}
