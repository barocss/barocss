// The still tracer's original 16-float light storage, with an optional visibility-disk radius in cone.z.
import { linear, parseColor, type Light } from './lights.js';
import { normalize, type Vec3 } from './math.js';
import { ViewerError } from './viewer-error.js';

/** Pack every light, without the raster shadow budgets. Disabled radii keep the delta-light path. */
export function traceLights(lights: readonly Light[]): Float32Array {
  const data = new Float32Array(Math.max(1, lights.length) * 16);
  lights.forEach((light, i) => {
    let radius = 0;
    if (light.kind !== 'directional' && light.castShadow) {
      const value = light.shadowRadius === undefined ? 0 : light.shadowRadius;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isFinite(Math.fround(value)) || (value > 0 && Math.fround(value) === 0)) throw new ViewerError('LIGHT_INVALID', 'A path-trace shadow radius must be nonnegative and representable in f32');
      radius = value === 0 ? 0 : value;
    }
    const offset = i * 16, position: Vec3 = light.kind === 'directional' ? [0, 0, 0] : light.position, direction = light.kind === 'point' ? [0, 0, 0] : normalize(light.direction);
    data.set([...position, light.kind === 'directional' ? 0 : light.kind === 'point' ? 1 : 2, ...direction, light.kind === 'directional' ? 0 : light.range ?? 0, ...linear(parseColor(light.color)), light.intensity ?? 1], offset);
    if (light.kind === 'spot') {
      const outer = (light.angle ?? 30) * Math.PI / 180, inner = outer * (1 - Math.min(1, Math.max(0, light.penumbra ?? 0.2)));
      data.set([Math.max(Math.cos(inner), Math.cos(outer) + 1e-4), Math.cos(outer), 0, 0], offset + 12);
    }
    data[offset + 14] = radius;
  });
  return data;
}
