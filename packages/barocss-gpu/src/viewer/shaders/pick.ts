// The viewer's WGSL: pick (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';

const pickShader = (capSamples = false): string => common + /* wgsl */ `
struct POut { @builtin(position) clip: vec4f, @location(0) @interpolate(flat) instance: u32, @location(1) ${capSamples ? '@interpolate(perspective, sample) ' : ''}world: vec3f${capSamples ? ', @location(2) @interpolate(flat) key: u32' : ''} }
struct Ids { @location(0) id: u32, @location(1) depth: f32, @location(2) instance: u32 }
@vertex fn vs(@location(0) position: vec3f, inst: Instance, @builtin(instance_index) ii: u32${capSamples ? ', @builtin(vertex_index) vi: u32' : ''}) -> POut {
  var o: POut;${capSamples ? `
  o.key = probeKey(vi, ii);` : ''}
  let world = object.model * instanceMatrix(inst) * vec4f(position, 1.0);
  o.clip = frame.viewProj * world;
  o.instance = ii;
  o.world = world.xyz;
  return o;
}
@fragment fn fs(in: POut) -> Ids {
  if (clippedAway(in.world)) { discard; }
  return Ids(object.pick.x, in.clip.z, in.instance);
}
// The outline mask: which outline (1-based; 0 none) covers each visible pixel.
@fragment fn fsMask(in: POut) -> @location(0) u32 {
  if (clippedAway(in.world)) { discard; }
  return object.pick.y;
}
// The nearest kept front surface's depth (capFront, read by the caps).
// The caps' probe (G19): a capped mesh's face, unclipped, beyond its ray's entry into the kept region — its depth, and
// whether a back face; the nearest kept by the depth test, a back face drawn a little nearer so that it wins a tie (two
// solids touching: the cap is the first's).
struct Probe { @location(0) v: ${capSamples ? 'u32' : 'vec2f'}, @builtin(frag_depth) z: f32 }
// (Which way is nearer: +1 in the scene's reversed depth, −1 in the shadow map's — the light's probe, G19.4.)
override nearer: f32 = 1.0;
@fragment fn fsCapProbe(in: POut, @builtin(front_facing) front: bool${capSamples ? ', @builtin(sample_index) sample: u32' : ''}) -> Probe {
  if (capPoint(in.world).w < 0.5) { discard; }
  var o: Probe;
  let z = ${capSamples ? 'capSampleDepth(in.world)' : 'in.clip.z'};
  o.v = ${capSamples ? 'select(in.key, 0u, front)' : 'vec2f(z, select(1.0, 0.0, front))'};
  // (A back face's lead: enough to win a tie — two faces at one depth, to rounding — and no more. In the scene's reversed
  // depth, a share of it (G20.2: a fixed 4e-7 there, far from the eye, put a back face just behind a front one — near an
  // edge — ahead of it, a cap leaking over the edge); in the shadow map's, linear in distance, a fixed one.)
  let lead = select(4e-7, max(z, 1e-12) * 1e-5, nearer > 0.0);
  o.z = clamp(z + select(lead * nearer, 0.0, front), 0.0, 1.0);
  return o;
}
// The shadow map: depth only, less what the clip plane cuts away.
@fragment fn fsDepth(in: POut) { if (clippedAway(in.world)) { discard; } }
// The cap in the pick and the outline mask (G2): at the plane's depth, as fsCap draws it.
struct CapIds { @location(0) id: u32, @location(1) depth: f32, @location(2) instance: u32, @builtin(frag_depth) z: f32 }
@fragment fn fsCapPick(in: POut) -> CapIds {
  if (!capFirst(in.clip)) { discard; }
  let z = capDepth(capPoint(in.world));
  if (z < 0.0) { discard; }
  return CapIds(object.pick.x, z, in.instance, z);
}
// The caps in the shadow map (G19.4): as in the scene, from the light — its probe read, the cap at its entry's depth.
@fragment fn fsCapShadow(in: POut) -> @builtin(frag_depth) f32 {
  if (!capFirst(in.clip)) { discard; }
  let z = capDepth(capPoint(in.world));
  if (z < 0.0) { discard; }
  return z;
}
struct CapMask { @location(0) id: u32, @builtin(frag_depth) z: f32 }
@fragment fn fsCapMask(in: POut) -> CapMask {
  if (!capFirst(in.clip)) { discard; }
  let z = capDepth(capPoint(in.world));
  if (z < 0.0) { discard; }
  return CapMask(object.pick.y, z);
}
`;
export const pickWGSL = pickShader();
/** Scene-only probe; its interpolated world point and depth are evaluated at each MSAA sample. */
export const capProbeSamplesWGSL = pickShader(true);
