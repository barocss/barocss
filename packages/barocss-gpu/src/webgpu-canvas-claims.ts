/**
 * One canvas custody set shared by every WebGPU viewport route. Per-route sets let a second route
 * (for example point-light after directional) configure the same canvas, steal its context and, on
 * dispose, unconfigure the other route's live context.
 */
export const webgpuViewportCanvasClaims = new WeakSet<HTMLCanvasElement>();
