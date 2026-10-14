import { GPUError } from './renderer.js';

const completeCanvases = new WeakSet<HTMLCanvasElement>();
const MAX_SIDE = 4096;
const MAX_PIXELS = 4194304;
const MAX_SHADER_LENGTH = 65536;

function check(value: unknown, message: string): asserts value {
  if (!value) throw new GPUError(message);
}

/** Claim only the new complete-mount routes, before canvas properties or context access. */
export function claimCompleteCanvas(canvas: HTMLCanvasElement): void {
  check(typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement,
    'Complete primitive frame requires a current-realm HTML canvas');
  check(!completeCanvases.has(canvas), 'Canvas already has a live complete primitive mount');
  completeCanvases.add(canvas);
}

export function releaseCompleteCanvas(canvas: HTMLCanvasElement): void {
  completeCanvases.delete(canvas);
}

/** Admit the requested and real backing target before allocating owned GL handles. */
export function validateCompleteMountTarget(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  requireBacking = true,
): void {
  check(Number.isInteger(width) && Number.isInteger(height)
    && width >= 1 && height >= 1 && width <= MAX_SIDE && height <= MAX_SIDE
    && width * height <= MAX_PIXELS, 'Complete primitive buffer dimensions exceed limits');
  // First mount requires an exact live backing. Later resize prepares the new
  // offscreen target before changing the accepted canvas backing dimensions.
  if (requireBacking) {
    check(canvas.width === width && canvas.height === height
      && gl.drawingBufferWidth === width && gl.drawingBufferHeight === height,
    'Complete primitive drawing buffer does not match the requested dimensions');
  }
  const texture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const renderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  check(Number.isInteger(texture) && texture >= 1 && width <= texture && height <= texture,
    'Complete primitive target exceeds the texture size limit');
  check(Number.isInteger(renderbuffer) && renderbuffer >= 1
    && width <= renderbuffer && height <= renderbuffer,
  'Complete primitive target exceeds the renderbuffer size limit');
  check(viewport !== null && typeof viewport === 'object' && viewport.length >= 2
    && Number.isInteger(viewport[0]) && Number.isInteger(viewport[1])
    && viewport[0] >= 1 && viewport[1] >= 1 && width <= viewport[0] && height <= viewport[1],
  'Complete primitive target exceeds the viewport size limit');
}

/** Trusted final text only; CPU validation precedes target and shader allocation. */
export function validateCompleteShaderSource(source: { vertex: string; fragment: string }): void {
  const encoder = new TextEncoder();
  for (const text of [source.vertex, source.fragment]) {
    check(typeof text === 'string' && text.length <= MAX_SHADER_LENGTH,
      'Complete primitive shader exceeds the UTF16 source limit');
    check(encoder.encode(text).byteLength <= MAX_SHADER_LENGTH,
      'Complete primitive shader exceeds the UTF8 source limit');
  }
}

/** Keep primary and cleanup values intact, including nested cleanup aggregates. */
export function completeMountFailure(primary: unknown, cleanup: unknown[] = []): Error {
  if (cleanup.length > 0) {
    return new AggregateError([primary, ...cleanup], 'Complete primitive mount and cleanup failed');
  }
  if (primary instanceof Error) return primary;
  const error = new GPUError('Complete primitive mount failed with a non-Error value');
  Object.defineProperty(error, 'cause', { value: primary, enumerable: false });
  return error;
}
