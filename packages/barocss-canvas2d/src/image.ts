import { Canvas2DError } from './schema.js';
import type { ImageNode, Point, Size, SourceRect, View } from './schema.js';

export type ImageAsset = { width: number; height: number; pixels: Uint8Array; texture: WebGLTexture | null };
export type ImageGpu = { program: WebGLProgram; positionBuffer: WebGLBuffer; uvBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject; size: WebGLUniformLocation; view: WebGLUniformLocation;
  opacity: WebGLUniformLocation; sampler: WebGLUniformLocation; uvClamp: WebGLUniformLocation };

const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
layout(location=1) in vec2 a_uv;
uniform vec2 u_size;
uniform vec3 u_view;
out vec2 v_uv;
void main() {
  vec2 p = (a_position * u_view.z + u_view.xy) / u_size;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  v_uv = a_uv;
}`;
const fragmentSource = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 v_uv;
uniform sampler2D u_image;
uniform vec4 u_uvClamp;
uniform float u_opacity;
out vec4 out_color;
void main() {
  vec4 sampleColor = texture(u_image, clamp(v_uv, u_uvClamp.xy, u_uvClamp.zw));
  float alpha = sampleColor.a * u_opacity;
  out_color = vec4(sampleColor.rgb * alpha, alpha);
}`;

function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const result = gl.createShader(kind);
  if (!result) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create image shader');
  gl.shaderSource(result, source); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result) || 'image shader compilation failed';
    gl.deleteShader(result);
    throw new Canvas2DError('WEBGL_UNAVAILABLE', message);
  }
  return result;
}

export function createImageGpu(gl: WebGL2RenderingContext): ImageGpu {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
  let fs: WebGLShader | null = null;
  let program: WebGLProgram | null = null, positionBuffer: WebGLBuffer | null = null;
  let uvBuffer: WebGLBuffer | null = null, vao: WebGLVertexArrayObject | null = null;
  try {
    fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    if (!program) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create image program');
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Canvas2DError('WEBGL_UNAVAILABLE', gl.getProgramInfoLog(program) || 'image program link failed');
    }
    positionBuffer = gl.createBuffer(); uvBuffer = gl.createBuffer(); vao = gl.createVertexArray();
    const size = gl.getUniformLocation(program, 'u_size');
    const view = gl.getUniformLocation(program, 'u_view');
    const opacity = gl.getUniformLocation(program, 'u_opacity');
    const sampler = gl.getUniformLocation(program, 'u_image');
    const uvClamp = gl.getUniformLocation(program, 'u_uvClamp');
    if (!positionBuffer || !uvBuffer || !vao || !size || !view || !opacity || !sampler || !uvClamp) {
      throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create image GPU state');
    }
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { program, positionBuffer, uvBuffer, vao, size, view, opacity, sampler, uvClamp };
  } catch (error) {
    if (vao) gl.deleteVertexArray(vao);
    if (uvBuffer) gl.deleteBuffer(uvBuffer);
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    if (program) gl.deleteProgram(program);
    throw error;
  } finally { gl.deleteShader(vs); if (fs) gl.deleteShader(fs); }
}

export function disposeImageGpu(gl: WebGL2RenderingContext, gpu: ImageGpu): void {
  gl.deleteVertexArray(gpu.vao); gl.deleteBuffer(gpu.uvBuffer);
  gl.deleteBuffer(gpu.positionBuffer); gl.deleteProgram(gpu.program);
}

export function createImageTexture(gl: WebGL2RenderingContext, asset: ImageAsset): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create image texture');
  const alignment = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
  const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean;
  const premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean;
  try {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, asset.width, asset.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, asset.pixels);
    if (gl.getError() !== gl.NO_ERROR) throw new Canvas2DError('INVALID_ASSET', 'image texture upload failed');
    return texture;
  } catch (error) { gl.deleteTexture(texture); throw error; }
  finally {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Number(flipY));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, Number(premultiply));
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

export function sourceRect(node: ImageNode, asset: ImageAsset): SourceRect {
  return node.sourceRect ?? { x: 0, y: 0, width: asset.width, height: asset.height };
}

export function renderImage(gl: WebGL2RenderingContext, gpu: ImageGpu,
  vertices: Float32Array, node: ImageNode, asset: ImageAsset, size: Size, view: View): void {
  if (!asset.texture) throw new Canvas2DError('CONTEXT_LOST', 'image texture is unavailable');
  const rect = sourceRect(node, asset);
  const u0 = rect.x / asset.width, u1 = (rect.x + rect.width) / asset.width;
  const v0 = rect.y / asset.height, v1 = (rect.y + rect.height) / asset.height;
  const uvs = new Float32Array([u0,v0,u1,v0,u1,v1,u0,v0,u1,v1,u0,v1]);
  gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao);
  gl.uniform2f(gpu.size, size.width, size.height);
  gl.uniform3f(gpu.view, view.panX, view.panY, view.zoom);
  gl.uniform1f(gpu.opacity, node.opacity); gl.uniform1i(gpu.sampler, 0);
  gl.uniform4f(gpu.uvClamp, (rect.x + 0.5) / asset.width, (rect.y + 0.5) / asset.height,
    (rect.x + rect.width - 0.5) / asset.width, (rect.y + rect.height - 0.5) / asset.height);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, asset.texture);
  const filter = node.sampling === 'nearest' ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpu.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, gpu.uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STREAM_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.useProgram(null);
}

export function sampledAlpha(node: ImageNode, asset: ImageAsset, local: Point): number {
  if (local.x < 0 || local.y < 0 || local.x > node.width || local.y > node.height) return 0;
  const rect = sourceRect(node, asset);
  const sx = rect.x + local.x / node.width * rect.width;
  const sy = rect.y + local.y / node.height * rect.height;
  const alpha = (x: number, y: number): number => asset.pixels[(y * asset.width + x) * 4 + 3] / 255;
  if (node.sampling === 'nearest') {
    const x = Math.max(rect.x, Math.min(rect.x + rect.width - 1, Math.floor(sx)));
    const y = Math.max(rect.y, Math.min(rect.y + rect.height - 1, Math.floor(sy)));
    return alpha(x, y) * node.opacity;
  }
  const fx = Math.max(rect.x, Math.min(rect.x + rect.width - 1, sx - 0.5));
  const fy = Math.max(rect.y, Math.min(rect.y + rect.height - 1, sy - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, rect.x + rect.width - 1);
  const y1 = Math.min(y0 + 1, rect.y + rect.height - 1);
  const tx = fx - x0, ty = fy - y0;
  return ((alpha(x0, y0) * (1 - tx) + alpha(x1, y0) * tx) * (1 - ty) +
    (alpha(x0, y1) * (1 - tx) + alpha(x1, y1) * tx) * ty) * node.opacity;
}
