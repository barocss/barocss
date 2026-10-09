import { Canvas2DError } from './schema.js';
import type { Point } from './schema.js';

export type TransformClip = {
  inverse: [number, number, number, number, number, number];
  width: number;
  height: number;
};
export type ClipGpu = {
  count: WebGLUniformLocation;
  inverse0: WebGLUniformLocation;
  inverse1: WebGLUniformLocation;
  size: WebGLUniformLocation;
};

const clipCapacity = 16;

export const clipDeclarations = `
uniform int u_clip_count;
uniform vec3 u_clip_inverse0[16];
uniform vec3 u_clip_inverse1[16];
uniform vec2 u_clip_size[16];
`;

export const clipDiscard = `
  for (int i = 0; i < 16; i++) {
    if (i >= u_clip_count) break;
    vec3 clipWorld = vec3(v_world, 1.0);
    vec2 clipLocal = vec2(dot(clipWorld, u_clip_inverse0[i]),
      dot(clipWorld, u_clip_inverse1[i]));
    if (clipLocal.x < 0.0 || clipLocal.y < 0.0 ||
        clipLocal.x > u_clip_size[i].x || clipLocal.y > u_clip_size[i].y) discard;
  }
`;

export function createClipGpu(gl: WebGL2RenderingContext, program: WebGLProgram): ClipGpu {
  const count = gl.getUniformLocation(program, 'u_clip_count');
  const inverse0 = gl.getUniformLocation(program, 'u_clip_inverse0[0]');
  const inverse1 = gl.getUniformLocation(program, 'u_clip_inverse1[0]');
  const size = gl.getUniformLocation(program, 'u_clip_size[0]');
  if (!count || !inverse0 || !inverse1 || !size) {
    throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create clip GPU state');
  }
  return { count, inverse0, inverse1, size };
}

export function setClipGpu(gl: WebGL2RenderingContext, gpu: ClipGpu,
  clips: readonly TransformClip[]): void {
  if (clips.length > clipCapacity) {
    throw new Canvas2DError('SCENE_LIMIT', 'transformed clip capacity exceeded');
  }
  gl.uniform1i(gpu.count, clips.length);
  if (clips.length === 0) return;
  const inverse0 = new Float32Array(clips.length * 3);
  const inverse1 = new Float32Array(clips.length * 3);
  const size = new Float32Array(clips.length * 2);
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i], inverse = clip.inverse;
    inverse0.set([inverse[0], inverse[2], inverse[4]], i * 3);
    inverse1.set([inverse[1], inverse[3], inverse[5]], i * 3);
    size.set([clip.width, clip.height], i * 2);
  }
  gl.uniform3fv(gpu.inverse0, inverse0);
  gl.uniform3fv(gpu.inverse1, inverse1);
  gl.uniform2fv(gpu.size, size);
}

export function insideClips(clips: readonly TransformClip[], world: Point): boolean {
  for (const clip of clips) {
    const inverse = clip.inverse;
    const x = inverse[0] * world.x + inverse[2] * world.y + inverse[4];
    const y = inverse[1] * world.x + inverse[3] * world.y + inverse[5];
    if (x < 0 || y < 0 || x > clip.width || y > clip.height) return false;
  }
  return true;
}
