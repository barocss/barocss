/** Private trusted text copied from #1184 immutable shader source at 61d68692. */
export const engineUVTextureSamplingHelpers = `vec3 decodeSRGB(vec3 encodedColor) {
  vec3 low = encodedColor / 12.92;
  vec3 high = pow((encodedColor + 0.055) / 1.055, vec3(2.4));
  return mix(high, low, lessThanEqual(encodedColor, vec3(0.04045)));
}
`;
