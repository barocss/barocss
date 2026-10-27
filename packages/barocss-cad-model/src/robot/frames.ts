// Tool and sensor frames (O12): named frames on a link — a TCP, a camera — each a pose in its part's own coordinates
// (mm; degrees about X, then Y, then Z, as a placed part's rotation), kept beside the joints in the robot settings, not
// made of them. The tree resolves each to its world pose at the solved pose (every joint value 0); FK moves it with its
// link, IK and the workspace map take it as their tool, and every export writes it as a fixed child link. A frame on a
// part that is not in the document, or not a link of the tree as it stands, is refused, typed — never dropped.
import { rotationMatrix } from '../engine/placement';
import type { Motion } from './fk';
import type { Mat3, V3 } from './inertia';
import type { JointTree } from './joints';
import { problem, type Problem } from '../engine/refusal';

export interface FrameSettings { link: string; position?: readonly number[]; rotation?: readonly number[]; kind?: 'tool' | 'sensor' }
/** A frame resolved on the tree: its local pose and its world pose at the solved pose (R columns its axes, o mm). */
export interface ToolFrame { name: string; link: string; kind?: 'tool' | 'sensor'; position: V3; rotation: V3; R: Mat3; o: V3 }
export type FrameCode = 'FRAME_LINK_MISSING' | 'FRAME_LINK_STALE' | 'FRAME_NAME' | 'FRAME_POSE';
/** A frame's name is its name in every export: letters, digits and _, not starting with a digit. */
export const FRAME_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const finite3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x));
/** A name every export's tools take: letters, digits and _, made unique in the order asked (each format's own rule). */
export function namer() {
  const used = new Set<string>();
  return (raw: string) => { let n = raw.replace(/~/g, '_to_').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(?=\d)/, 'n_'), k = 2; const base = n; while (used.has(n)) n = `${base}_${k++}`; used.add(n); return n; };
}
/** The names the exports give the tree's links and joints, as their namers do (links, then joints, each in order). */
export function exportNames(tree: Pick<JointTree, 'links' | 'joints'>): { links: Map<string, string>; joints: Map<string, string> } {
  const link = namer(), joint = namer();
  return { links: new Map(tree.links.map(l => [link(l.id), l.id])), joints: new Map(tree.joints.map(j => [joint(j.key), j.key])) };
}

/** The frames as read from a document (an entry kept when it is an object with a link: the rest is checked on the tree). */
export function readFrames(raw: unknown): Record<string, FrameSettings> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, FrameSettings> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object' || typeof (v as FrameSettings).link !== 'string') continue;
    const f = v as FrameSettings;
    out[k] = { link: f.link, ...(f.position !== undefined ? { position: f.position } : {}), ...(f.rotation !== undefined ? { rotation: f.rotation } : {}), ...(f.kind === 'tool' || f.kind === 'sensor' ? { kind: f.kind } : {}) };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Why a frame cannot be on the tree (typed, naming it): none, or its one problem. `parts`: every part id of the document. */
export function checkFrame(name: string, f: FrameSettings, tree: Pick<JointTree, 'links'>, parts: ReadonlySet<string>, names: ReturnType<typeof exportNames>): Problem<FrameCode>[] {
  if (!FRAME_NAME.test(name)) return [problem('FRAME_NAME', `"${name}": a frame's name is letters, digits and _ (not starting with a digit), as every export writes it`)];
  // (After the exporters' own naming: the frame's link beside the links, its fixed joint `<name>_fixed` beside the joints.)
  const link = names.links.get(name), joint = names.joints.get(`${name}_fixed`);
  if (link !== undefined) return [problem('FRAME_NAME', `"${name}" is the export name of link ${link}: name the frame differently`)];
  if (joint !== undefined) return [problem('FRAME_NAME', `"${name}": its fixed joint ${name}_fixed is the export name of joint ${joint}: name the frame differently`)];
  if (!parts.has(f.link)) return [problem('FRAME_LINK_MISSING', `frame ${name}: no part ${f.link} in the assembly (parts: ${[...parts].join(', ')}). Put it on a link, or remove it (set_frames {"${name}": null})`)];
  if (!tree.links.some(l => l.part === f.link)) return [problem('FRAME_LINK_STALE', `frame ${name}: ${f.link} is not a link of the robot as it stands (not joined to the base link). Mate it, put the frame on a link, or remove it (set_frames {"${name}": null})`)];
  if ((f.position !== undefined && !finite3(f.position)) || (f.rotation !== undefined && !finite3(f.rotation))) return [problem('FRAME_POSE', `frame ${name}: "position" (mm) and "rotation" (degrees about X, then Y, then Z) are three finite numbers, in ${f.link}'s own coordinates`)];
  return [];
}

/** A frame's world pose at the solved pose: its part's placement, then its local pose. */
export function resolveFrame(name: string, f: FrameSettings, placed: { R: readonly number[]; t: readonly number[] }): ToolFrame {
  const position = (f.position ?? [0, 0, 0]) as V3, rotation = (f.rotation ?? [0, 0, 0]) as V3, L = rotationMatrix(rotation), P = placed.R, R = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i * 3 + j] += P[i * 3 + k] * L[k * 3 + j];
  const o: V3 = [0, 1, 2].map(i => P[i * 3] * position[0] + P[i * 3 + 1] * position[1] + P[i * 3 + 2] * position[2] + placed.t[i]) as V3;
  return { name, link: f.link, ...(f.kind ? { kind: f.kind } : {}), position: [...position] as V3, rotation: [...rotation] as V3, R, o };
}

/** A frame of the tree by name, or null. */
export const frameOf = (tree: JointTree, name: string): ToolFrame | null => tree.frames?.find(f => f.name === name) ?? null;

/** Each frame's world pose for FK's link motions: the link's motion, then the frame at its solved pose. */
export function framePoses(tree: JointTree, motions: ReadonlyMap<string, Motion>): Map<string, { R: Mat3; o: V3 }> {
  const out = new Map<string, { R: Mat3; o: V3 }>();
  for (const f of tree.frames ?? []) {
    const m = motions.get(f.link); if (!m) continue;
    const A = m.R, R = new Array(9).fill(0) as Mat3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * f.R[j] + A[i * 3 + 1] * f.R[3 + j] + A[i * 3 + 2] * f.R[6 + j];
    out.set(f.name, { R, o: [0, 1, 2].map(i => A[i * 3] * f.o[0] + A[i * 3 + 1] * f.o[1] + A[i * 3 + 2] * f.o[2] + m.t[i]) as V3 });
  }
  return out;
}
