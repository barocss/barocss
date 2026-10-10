/** Trusted opaque unlit engine path; authored shader/native profiles stay separate. */
export const engineSceneShaders = Object.freeze({
  vertex: `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
void main() {
  gl_Position = projection * view * world * vec4(position, 1.0);
}`,
  fragment: `#version 300 es
precision highp float;
uniform vec3 color;
out vec4 fragmentColor;
vec3 encodeSRGB(vec3 linearColor) {
  vec3 low = 12.92 * linearColor;
  vec3 high = 1.055 * pow(linearColor, vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, lessThanEqual(linearColor, vec3(0.0031308)));
}
void main() { fragmentColor = vec4(encodeSRGB(color), 1.0); }
`,
});

/** The frame target contains encoded sRGB, including its clear colour. */
export function encodeEngineSRGB(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}
