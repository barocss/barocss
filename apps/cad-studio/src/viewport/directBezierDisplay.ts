import type { DirectDisplay } from '@barocss/cad-model/engine/direct';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

const maxSegments = 2048;
const chordTargetCSS = 0.2;
const cache = new WeakMap<DirectDisplay, { segments: number; items: DirectDisplay[] }>();

/** Share one dyadic world packet between drawing and picking. Ortho scale bounds any view orientation. */
export function directBezierDisplay(items: DirectDisplay[], scaleCSS?: number): DirectDisplay[] {
  if (items.length !== 1 || scaleCSS === undefined || !(scaleCSS > 0) || !Number.isFinite(scaleCSS)) return items;
  const [item] = items;
  const poles = item.bezierPoles;
  if (!poles) return items;
  const degree = poles.length - 1;
  let secondDifference = 0;
  for (let i = 0; i + 2 < poles.length; i++) {
    const [a, b, c] = [poles[i], poles[i + 1], poles[i + 2]];
    secondDifference = Math.max(secondDifference,
      Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1], a[2] - 2 * b[2] + c[2]));
  }
  // Linear interpolation error is bounded by max |B''| / (8 * segments²).
  const needed = Math.sqrt(scaleCSS * degree * (degree - 1) * secondDifference / (8 * chordTargetCSS));
  const baseSegments = item.positions.length / 6;
  if (!Number.isFinite(needed) || needed <= baseSegments) return items;
  const segments = Math.min(maxSegments, 2 ** Math.ceil(Math.log2(needed)));
  const previous = cache.get(item);
  if (previous?.segments === segments) return previous.items;
  const positions = new Float32Array(segments * 6);
  let start = poles[0];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments, u = 1 - t;
    const basis = degree === 2 ? [u * u, 2 * u * t, t * t] : [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
    const end = i === segments ? poles[degree] : poles.reduce<Vec3>((point, pole, k) => {
      point[0] += pole[0] * basis[k];
      point[1] += pole[1] * basis[k];
      point[2] += pole[2] * basis[k];
      return point;
    }, [0, 0, 0]);
    positions.set(start, (i - 1) * 6);
    positions.set(end, (i - 1) * 6 + 3);
    start = end;
  }
  const refined = [{ ...item, positions }];
  cache.set(item, { segments, items: refined });
  return refined;
}
