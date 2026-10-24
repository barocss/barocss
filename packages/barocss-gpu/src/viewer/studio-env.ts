// G15b: procedural studio environments, made in our own code (no image downloads) as equirectangular RGBA bytes (sRGB,
// Z up: the top row overhead, the middle column looking along +X) for Viewer.createTexture and Environment.map. A photo
// studio's light on a part: softboxes in a dark room, or a white cyclorama with a light bank over it.

/** The studios: `softbox` — a dark room, a large key overhead in front, a fill to the side and a strip behind;
 *  `cyclorama` — a seamless white backdrop curving into the floor, a light bank above. */
export type StudioEnvironment = 'softbox' | 'cyclorama';
export const STUDIO_ENVIRONMENTS: readonly StudioEnvironment[] = ['softbox', 'cyclorama'];

/** A softbox on the sphere: its centre (azimuth from +X toward +Y, elevation above the horizon; degrees), its half size
 *  (degrees) and its brightness (linear). */
interface Panel { azimuth: number; elevation: number; halfWidth: number; halfHeight: number; brightness: number }
interface Studio { panels: readonly Panel[]; sky: (elevation: number) => number; floor: (elevation: number) => number; tint: readonly [number, number, number] }

const STUDIOS: Record<StudioEnvironment, Studio> = {
  softbox: {
    // (The part's front faces −Y, as the studio's views look: the key is up and in front of it, left; the fill right.)
    panels: [
      { azimuth: -120, elevation: 50, halfWidth: 28, halfHeight: 16, brightness: 1 },
      { azimuth: -30, elevation: 20, halfWidth: 12, halfHeight: 22, brightness: 0.45 },
      { azimuth: 90, elevation: 30, halfWidth: 40, halfHeight: 4, brightness: 0.8 },
    ],
    sky: e => 0.035 + 0.03 * Math.max(0, e) / 90,
    floor: () => 0.025,
    tint: [1, 1, 1],
  },
  cyclorama: {
    panels: [{ azimuth: -90, elevation: 75, halfWidth: 60, halfHeight: 12, brightness: 1 }],
    sky: e => 0.62 + 0.18 * Math.max(0, e) / 90,
    // (The floor brightest where it meets the backdrop, darker straight down: the cove's soft horizon.)
    floor: e => 0.32 + 0.3 * Math.exp(e / 12),
    tint: [1, 0.985, 0.96],
  },
};

const encode = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)));
const soft = (d: number, edge: number) => { const t = Math.min(1, Math.max(0, d / edge)); return 1 - t * t * (3 - 2 * t); };
/** The angle between two azimuths (degrees, −180 – 180). */
const turn = (a: number) => ((a + 540) % 360) - 180;

/** A studio environment's pixels: `width` × width/2, RGBA sRGB bytes, rows top (overhead) to bottom. */
export function studioEnvironment(kind: StudioEnvironment, width = 1024): { width: number; height: number; data: Uint8Array } {
  const s = STUDIOS[kind], height = width / 2, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    // (Row y's elevation: +90 overhead to −90 below; column x's azimuth as envUv reads it, −180 at the left edge.)
    const elevation = 90 - ((y + 0.5) / height) * 180;
    const base = elevation >= 0 ? s.sky(elevation) : s.floor(elevation);
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + 0.5) / width) * 360 - 180;
      let v = base;
      for (const p of s.panels) {
        // (A panel's distance in its own axes, the azimuth's narrowed toward the pole; a soft edge a fifth of its size.)
        const dx = Math.abs(turn(azimuth - p.azimuth)) * Math.cos((elevation * Math.PI) / 180) - p.halfWidth;
        const dy = Math.abs(elevation - p.elevation) - p.halfHeight;
        const k = soft(Math.max(dx, dy, 0), Math.min(p.halfWidth, p.halfHeight) * 0.4 + 1);
        if (k > 0) v = Math.max(v, p.brightness * k + base * (1 - k));
      }
      const i = (y * width + x) * 4;
      data[i] = encode(v * s.tint[0]); data[i + 1] = encode(v * s.tint[1]); data[i + 2] = encode(v * s.tint[2]); data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
