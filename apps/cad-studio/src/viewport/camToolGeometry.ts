import type { ToolShape } from '@barocss/cad-model/machining/camPackage';
import type { CamGeometry } from './camDisplay';
import { camToolBottom } from './camHeightfield';

// G23 CNC (G-R3, from Codex's source 5c9f861f): the declared tool as a revolved mesh at a local tip of [0, 0, 0], its
// axis +Z — the cutting profile up the flute, then the shank. The Model's shankMM is a diameter, so the shank's length
// is shown as one diameter, a visual estimate said; no holder is invented.

export const CAM_TOOL_SECTORS = 64;
export const CAM_TOOL_NOSE_RINGS = 12;
export interface CamToolGeometry {
  flute: CamGeometry;
  shank: CamGeometry;
  /** Display chord sag only, not machining accuracy. */
  angularChordMM: number;
  noseChordMM: number;
  /** Visual axial extension; Model shankMM is a diameter, not an authored length. */
  shankExtensionMM: number;
}

interface Ring { radius: number; z: number; radial: number; axial: number }
interface Out { positions: number[]; normals: number[]; indices: number[] }
/** A flat end cap of the revolved surface, facing up or down. */
function disk(out: Out, radius: number, z: number, up: boolean): void {
  if (radius <= 0) return;
  const center = out.positions.length / 3, nz = up ? 1 : -1;
  out.positions.push(0, 0, z); out.normals.push(0, 0, nz);
  for (let i = 0; i <= CAM_TOOL_SECTORS; i++) {
    const angle = i * 2 * Math.PI / CAM_TOOL_SECTORS;
    out.positions.push(radius * Math.cos(angle), radius * Math.sin(angle), z); out.normals.push(0, 0, nz);
  }
  for (let i = 0; i < CAM_TOOL_SECTORS; i++) {
    if (up) out.indices.push(center, center + i + 1, center + i + 2); else out.indices.push(center, center + i + 2, center + i + 1);
  }
}
function revolved(rings: Ring[], bottomRadius: number, topRadius: number, top: number): CamGeometry {
  const out: Out = { positions: [], normals: [], indices: [] }, sectors = CAM_TOOL_SECTORS;
  for (const ring of rings) for (let i = 0; i <= sectors; i++) {
    const angle = i * 2 * Math.PI / sectors, x = Math.cos(angle), y = Math.sin(angle);
    out.positions.push(ring.radius * x, ring.radius * y, ring.z); out.normals.push(ring.radial * x, ring.radial * y, ring.axial);
  }
  for (let row = 0; row + 1 < rings.length; row++) for (let i = 0; i < sectors; i++) {
    const a = row * (sectors + 1) + i, b = a + sectors + 1;
    if (rings[row].radius > 0) out.indices.push(a, a + 1, b);
    if (rings[row + 1].radius > 0) out.indices.push(a + 1, b + 1, b);
  }
  disk(out, bottomRadius, rings[0].z, false); disk(out, topRadius, top, true);
  return { positions: Float32Array.from(out.positions), normals: Float32Array.from(out.normals), indices: Uint32Array.from(out.indices) };
}

/** Full declared cutting profile and shank, at a local tip of [0,0,0], with no holder. */
export function camToolGeometry(tool: ToolShape): CamToolGeometry {
  const { kind, diameterMM: diameter, cornerMM: corner, fluteMM: flute, shankMM: shank } = tool, radius = diameter / 2;
  if (!['flat', 'ball', 'bull'].includes(kind) || ![diameter, corner, flute, shank].every(Number.isFinite) || diameter <= 0 || flute <= 0 || shank <= 0
    || (kind === 'flat' && corner !== 0) || (kind === 'ball' && Math.abs(corner - radius) > 1e-9 * Math.max(1, radius))
    || (kind === 'bull' && !(corner > 0 && corner <= radius)) || flute < corner) throw new Error('CAM display: unsupported tool dimensions or rounded nose longer than its flute');
  const rings: Ring[] = [];
  if (kind === 'flat') rings.push({ radius, z: 0, radial: 1, axial: 0 });
  else for (let i = 0; i <= CAM_TOOL_NOSE_RINGS; i++) {
    const angle = i * Math.PI / (2 * CAM_TOOL_NOSE_RINGS), r = radius - corner + corner * Math.sin(angle);
    rings.push({ radius: r, z: camToolBottom(tool, r), radial: Math.sin(angle), axial: -Math.cos(angle) });
  }
  if (rings.at(-1)!.z < flute) rings.push({ radius, z: flute, radial: 1, axial: 0 });
  const shankRadius = shank / 2, shankTop = flute + shank;
  return {
    flute: revolved(rings, kind === 'flat' ? radius : radius - corner, radius, flute),
    shank: revolved([{ radius: shankRadius, z: flute, radial: 1, axial: 0 }, { radius: shankRadius, z: shankTop, radial: 1, axial: 0 }], shankRadius, shankRadius, shankTop),
    angularChordMM: Math.max(radius, shankRadius) * (1 - Math.cos(Math.PI / CAM_TOOL_SECTORS)),
    noseChordMM: corner * (1 - Math.cos(Math.PI / (4 * CAM_TOOL_NOSE_RINGS))), shankExtensionMM: shank,
  };
}
