// The v2 `image` group's handlers (R3, moved verbatim from chat/tools.ts): an attached image's traced layers, and
// a layer extruded or inflated into the part; the tracing geometry they share.
import { featureLabel, withNode, type ModelNode } from '../../engine/doc';
import { withImageDraft } from '../drafts';
import type { ImageTrace, Pt } from '../trace';
import { insideRing as inside } from '../../engine/geom2';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, json, accept, fail } from '../toolKit';
import { r3Signed as r3 } from '../../util/round';

function traceOf(state: ChatState, image: unknown): ImageTrace | string {
  const list = state.images ?? [];
  if (!list.length) return 'No image is attached in this conversation.';
  const i = Number(image ?? list.length);
  return Number.isInteger(i) && list[i - 1] ? list[i - 1] : `There is no image ${String(image)} (images 1–${list.length}).`;
}

/** The silhouette's box in trace pixels: every layer is placed by it, so layers line up. */
function silhouetteBox(t: ImageTrace) {
  const pts = (t.layers.find(l => l.id === 'silhouette') ?? t.layers[0]).regions.flatMap(r => r.outer);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function imageLayers(t: ImageTrace) {
  const box = silhouetteBox(t), w = box.maxX - box.minX, h = box.maxY - box.minY;
  return {
    silhouette_aspect: Math.round(h / w * 1000) / 1000, background: t.background,
    note: 'height of the figure in mm = width × silhouette_aspect. Layer boxes are fractions of the silhouette box, x from the left, y from the bottom.',
    layers: t.layers.map(l => {
      const pts = l.regions.flatMap(r => r.outer), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const fx = (x: number) => r3((x - box.minX) / w), fy = (y: number) => r3((box.maxY - y) / h);
      return { id: l.id, name: l.name, color: l.color, area_fraction: l.areaFraction, regions: l.regions.length, holes: l.regions.reduce((s, r) => s + r.holes.length, 0),
        points: l.regions.reduce((s, r) => s + r.outer.length + r.holes.reduce((a, h) => a + h.length, 0), 0),
        box: { x: [fx(Math.min(...xs)), fx(Math.max(...xs))], y: [fy(Math.max(...ys)), fy(Math.min(...ys))] } };
    }),
  };
}

/**
 * Sketch nodes of a traced layer, scaled so the silhouette is `width` mm wide (y up), lying flat or standing.
 * A sketch's holes cut all its regions, so islands inside another region's hole (eyes inside an outline)
 * go in sketches of their own: one sketch per nesting depth.
 */
export function layerSketches(t: ImageTrace, layerId: string, width: number, at: [number, number], standing: boolean, y0: number): ModelNode[] | string {
  const layer = t.layers.find(l => l.id === layerId);
  if (!layer) return `No layer "${layerId}"; layers: ${t.layers.map(l => l.id).join(', ')}.`;
  if (!layer.regions.length) return `Layer "${layerId}" has no outline.`;
  const box = silhouetteBox(t), k = width / (box.maxX - box.minX);
  const map = (p: Pt): [number, number] => [r3(at[0] + (p[0] - box.minX) * k), r3(at[1] + (box.maxY - p[1]) * k)];
  // (Image y runs down: flipping it reverses each loop's turn, which the kernel orients itself.)
  const loop = (pts: Pt[]) => pts.map(p => ({ kind: 'line' as const, start: map(p) }));
  const depth = (r: typeof layer.regions[number]) => layer.regions.filter(o => o !== r && inside(r.outer[0], o.outer)).length;
  const levels = new Map<number, typeof layer.regions>();
  for (const r of layer.regions) { const d = depth(r); levels.set(d, [...(levels.get(d) ?? []), r]); }
  return [...levels.keys()].sort((a, b) => a - b).map(d => {
    const [first, ...rest] = levels.get(d)!;
    return {
      kind: 'sketch', profile: 'polygon', points: first.outer.map(map),
      ...(rest.length ? { regions: rest.map(r => loop(r.outer)) } : {}),
      ...(levels.get(d)!.some(r => r.holes.length) ? { holes: levels.get(d)!.flatMap(r => r.holes.map(loop)) } : {}),
      // Standing: sketch X along world X, sketch Y up world Z, extruded towards −Y (the front).
      ...(standing ? { plane: { origin: [0, y0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } } : {}),
    } as ModelNode;
  });
}

/** A closed loop resampled to `n` points evenly along its length. */
function resample(p: Pt[], n: number): Pt[] {
  const len: number[] = [0];
  for (let i = 1; i <= p.length; i++) { const a = p[i - 1], b = p[i % p.length]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = len[p.length], out: Pt[] = [];
  for (let k = 0, i = 0; k < n; k++) {
    const d = total * k / n; while (len[i + 1] < d) i++;
    const a = p[i], b = p[(i + 1) % p.length], t = (d - len[i]) / ((len[i + 1] - len[i]) || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
const centroidOf = (p: Pt[]): Pt => {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], c = q[0] * r[1] - r[0] * q[1]; a += c; x += (q[0] + r[0]) * c; y += (q[1] + r[1]) * c; }
  return a ? [x / (3 * a), y / (3 * a)] : p[0];
};
const areaOf = (p: Pt[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };

/** Section scales of an inflated body (pebble-like: round at the rim, full in the middle). */
export const INFLATE = [-1, -0.5, 0, 0.5, 1].map(t => ({ t, z: Math.sin(t * Math.PI / 2) / 2, s: Math.max(0.18, Math.cos(t * Math.PI / 2)) }));
const BUMP = [0, 0.4, 0.75, 1].map(t => ({ z: t, s: Math.max(0.2, Math.cos(t * Math.PI / 2)) }));

/** The front surface height (above the mid plane) of an inflated outline at a point, or null outside it. */
export function surfaceAt(outline: Pt[], centre: Pt, depth: number, p: Pt): number | null {
  // The smallest section scale that still holds the point; the sections follow z = depth/2 · √(1 − s²).
  const holds = (s: number) => inside([centre[0] + (p[0] - centre[0]) / s, centre[1] + (p[1] - centre[1]) / s], outline);
  if (!holds(1)) return null;
  let lo = INFLATE[INFLATE.length - 1].s, hi = 1;
  if (holds(lo)) return depth / 2 * Math.sqrt(1 - lo * lo);
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (holds(m)) hi = m; else lo = m; }
  return depth / 2 * Math.sqrt(1 - hi * hi);
}

async function getImageLayersTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const t = traceOf(state, args.image);
  if (typeof t === 'string') return fail(state, t);
  const out = imageLayers(t);
  return { state, content: json(out), isError: false, changed: false, summary: `${out.layers.length} layers: ${out.layers.map(l => `${l.id} ${l.color}`).join(', ')}` };
}
async function extrudeImageLayerTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const t = traceOf(state, args.image);
  if (typeof t === 'string') return fail(state, t);
  const width = Number(args.width), height = Number(args.height), base = Number(args.base ?? 0);
  if (!(width > 0)) return fail(state, '"width" (the silhouette\'s width) must be positive.');
  if (!(height > 0)) return fail(state, '"height" (the layer\'s thickness) must be positive.');
  if (!Number.isFinite(base)) return fail(state, '"base" must be a number.');
  const at: [number, number] = Array.isArray(args.at) && args.at.length === 2 ? [Number(args.at[0]), Number(args.at[1])] : [0, 0];
  const standing = args.orientation === 'standing';
  const sketches = layerSketches(t, String(args.layer ?? 'silhouette'), width, at, standing, Number(args.y ?? 0));
  if (typeof sketches === 'string') return fail(state, sketches);
  let doc = state.doc;
  for (const sketch of sketches) {
    doc = withNode(doc, sketch);
    doc = withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height, ...(base ? { from: base } : {}) });
  }
  // (A draft, A6.4: its width and thickness the user's to confirm.)
  doc = withImageDraft(doc, state.doc.nodes.length, `image ${String(args.image ?? (state.images?.length ?? 1))} ${String(args.layer ?? 'silhouette')}`, { width, thickness: height, at });
  return accept(state, doc, evaluate, `image ${String(args.image ?? (state.images?.length ?? 1))} ${String(args.layer ?? 'silhouette')} ${width} mm wide, ${height} thick${base ? ` from ${base}` : ''}${standing ? ', standing' : ''}`,
    { added: doc.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, doc.nodes)}`) });
}
async function inflateImageLayerTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  // A rounded, puffed-up solid of a traced layer (a plush or figure look) instead of a flat slab.
  const t = traceOf(state, args.image);
  if (typeof t === 'string') return fail(state, t);
  const width = Number(args.width), depth = Number(args.depth), mode = args.mode === 'bump' ? 'bump' : 'body';
  if (!(width > 0)) return fail(state, '"width" (the silhouette\'s width) must be positive.');
  if (!(depth > 0)) return fail(state, mode === 'body' ? '"depth" (front-to-back thickness) must be positive.' : '"depth" (how far the bump stands out) must be positive.');
  const layerId = String(args.layer ?? 'silhouette'), layer = t.layers.find(l => l.id === layerId);
  if (!layer) return fail(state, `No layer "${layerId}"; layers: ${t.layers.map(l => l.id).join(', ')}.`);
  const sil = t.layers.find(l => l.id === 'silhouette') ?? t.layers[0];
  const box = silhouetteBox(t), k = width / (box.maxX - box.minX);
  const at: [number, number] = Array.isArray(args.at) && args.at.length === 2 ? [Number(args.at[0]), Number(args.at[1])] : [0, 0];
  const map = (p: Pt): Pt => [at[0] + (p[0] - box.minX) * k, at[1] + (box.maxY - p[1]) * k];
  const standing = args.orientation === 'standing';
  // Standing: the mid plane is XZ at y = `y`, the front towards −Y.
  const plane = standing ? { plane: { origin: [0, Number(args.y ?? 0), 0] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] } } : {};
  const bodyDepth = Number(args.body_depth ?? 0);
  if (mode === 'bump' && !(bodyDepth > 0)) return fail(state, 'A bump sits on an inflated silhouette: pass "body_depth", the depth that silhouette was inflated with (same image, width and at).');
  // The largest silhouette region carries the surface.
  const silOutline = sil.regions.length ? sil.regions[0].outer.map(map) : [];
  let doc = state.doc; const skipped: string[] = [];
  for (const [ri, region] of layer.regions.entries()) {
    const outline = resample(region.outer.map(map), 48), c = centroidOf(outline);
    let z0 = 0, sections: { z: number; s: number }[];
    if (mode === 'body') sections = INFLATE.map(sec => ({ z: sec.z * depth, s: sec.s }));
    // An outline stroke is mostly hole; a filled area with a small hole (a muzzle round a nose) is inflated whole.
    else if (region.holes.reduce((sum, h) => sum + Math.abs(areaOf(h)), 0) > 0.5 * Math.abs(areaOf(region.outer))) { skipped.push(`region ${ri + 1} is an outline stroke`); continue; }
    else {
      const h = surfaceAt(silOutline, centroidOf(silOutline), bodyDepth, c);
      if (h === null) { skipped.push(`region ${ri + 1} lies outside the silhouette`); continue; }
      // Sunk a little into the body so it joins it.
      z0 = h - Math.min(depth * 0.5, bodyDepth * 0.1);
      sections = BUMP.map(sec => ({ z: z0 + sec.z * depth, s: sec.s }));
    }
    const refs: { sketch: number; z: number }[] = [];
    for (const sec of sections) {
      doc = withNode(doc, { kind: 'sketch', profile: 'polygon', points: outline.map(p => [r3(c[0] + (p[0] - c[0]) * sec.s), r3(c[1] + (p[1] - c[1]) * sec.s)] as [number, number]), ...plane });
      refs.push({ sketch: doc.nodes.length - 1, z: r3(sec.z) });
    }
    doc = withNode(doc, { kind: 'loft', sections: refs, smooth: true });
  }
  if (doc === state.doc) return fail(state, `Nothing to inflate: ${skipped.join('; ') || 'the layer has no outline'}.`);
  // (A draft, A6.4: its width and depth the user's to confirm.)
  doc = withImageDraft(doc, state.doc.nodes.length, `image ${String(args.image ?? (state.images?.length ?? 1))} ${layerId}`, { width, depth, at });
  return accept(state, doc, evaluate, `image ${String(args.image ?? (state.images?.length ?? 1))} ${layerId} inflated (${mode}) ${width} mm wide, ${depth} deep${standing ? ', standing' : ''}`,
    { ...(skipped.length ? { skipped } : {}), note: mode === 'body' ? `the body spans ${-depth / 2}…${depth / 2} about its mid plane` : 'bumps are separate bodies sunk into the surface; union them only if one solid is needed (each union is slow)' });
}

/** The image group's handlers, by v1 tool name (R3). */
export const IMAGE_HANDLERS: Readonly<Record<string, PartHandler>> = { get_image_layers: getImageLayersTool, extrude_image_layer: extrudeImageLayerTool, inflate_image_layer: inflateImageLayerTool };
