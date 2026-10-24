// WGSL for the viewer: one frame block (camera and lights), one object block per draw (dynamic offset),
// a metal–roughness surface shader, an unlit one, lines, the id/depth pick pass and the output pass.
// The scene is drawn in linear light into a half-float target (blending in linear light); the output
// pass applies exposure and tone mapping and encodes sRGB for the canvas.
// (R2c: split by program under shaders/; this file the facade, its exports as they were.)
export { MAX_DIRECTIONAL, MAX_CLIP_PLANES, FRAME_BYTES, OBJECT_BYTES, MAX_POINT, MAX_SPOT, OBJECT_STRIDE } from './shaders/common.js';
export { surfaceWGSL } from './shaders/surface.js';
export type { SurfaceShader } from './shaders/surface.js';
export { lineWGSL } from './shaders/line.js';
export { pointWGSL } from './shaders/point.js';
export { labelWGSL } from './shaders/label.js';
export { oitWGSL } from './shaders/oit.js';
export { gridWGSL } from './shaders/grid.js';
export { pickWGSL, capProbeSamplesWGSL } from './shaders/pick.js';
export { MAX_OUTLINES, OUTPUT_BYTES, outputWGSL } from './shaders/output.js';
export { mipWGSL } from './shaders/mip.js';
export { envWGSL, ENV_LEVELS, IRRADIANCE_SIZE, BRDF_LUT_SIZE } from './shaders/env.js';
