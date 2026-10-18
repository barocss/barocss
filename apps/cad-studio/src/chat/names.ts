// Names (as the chat and the kernel give them) to the viewport's mesh indices: small, so the app can use it
// without loading the chat's tools.
import type { Selection } from '../app/commands';
import type { BodyResult } from '../engine/evaluate';
import type { ModelNode } from '../engine/doc';
import { featureId, nodeIndexOf } from '../engine/ids';

export interface NameSelection { faces: string[]; edges: string[]; bodies: string[] }

/** Faces, edges and bodies by name → mesh indices; unknown names are returned. */
export function resolveNames(bodies: BodyResult[], names: Partial<NameSelection>): { selection: Selection; unknown: string[] } {
  const selection: Selection = { faces: [], edges: [], bodies: [] }, unknown: string[] = [];
  for (const name of names.faces ?? []) {
    const hit = bodies.flatMap((b, bi) => b.mesh.faces.flatMap(f => f.name.split('+').includes(name) || f.id === name ? [{ body: bi, face: f.index }] : []))[0];
    if (hit) { if (!selection.faces.some(f => f.body === hit.body && f.face === hit.face)) selection.faces.push(hit); } else unknown.push(name);
  }
  for (const name of names.edges ?? []) {
    const hit = bodies.flatMap((b, bi) => b.mesh.edges.flatMap(e => e.names.includes(name) ? [{ body: bi, edge: e.index }] : []))[0];
    if (hit) { if (!selection.edges.some(e => e.body === hit.body && e.edge === hit.edge)) selection.edges.push(hit); } else unknown.push(name);
  }
  for (const key of names.bodies ?? []) {
    const i = bodies.findIndex(b => b.key === key);
    if (i >= 0) { if (!selection.bodies.includes(i)) selection.bodies.push(i); } else unknown.push(key);
  }
  return { selection, unknown };
}

// Selectors (A1.2): what an agent can say instead of a name — a feature's face by its role, the flat face
// facing a direction, the edge two faces share. Each resolves to the persistent name it stands for, and the
// tools report it, so the agent learns the name; no mesh index is ever exposed. More than one face fitting is
// refused with the candidates (unless `all`), as is none.
export type FaceSelector = string
  | { feature: number | string; role: string; on?: string; all?: boolean }
  | { normal: [number, number, number]; pick?: 'max' | 'min'; on?: string; all?: boolean };
export type EdgeSelector = string | { between: [FaceSelector, FaceSelector] };
export interface Resolved { selector: unknown; names: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const baseOf = (part: string, id: string) => part.slice(id.length + 1).replace(/#\d+$/, '');

/** The face names a face selector stands for, or why it stands for none (or too many). */
export function resolveFace(nodes: readonly ModelNode[], bodies: readonly BodyResult[], sel: unknown): string[] | string {
  if (typeof sel === 'string') return [sel];
  if (!isObj(sel)) return `not a face name or selector: ${JSON.stringify(sel)}`;
  const shown = typeof sel.on === 'string' ? bodies.filter(b => b.key === sel.on) : bodies;
  if (typeof sel.on === 'string' && !shown.length) return `no body ${sel.on} (bodies: ${bodies.map(b => b.key).join(', ')})`;
  let found: string[];
  if ('feature' in sel && typeof sel.role === 'string') {
    const id = typeof sel.feature === 'number' ? featureId(nodes, sel.feature) : String(sel.feature), role = sel.role;
    if (typeof sel.feature === 'number' ? !nodes[sel.feature] : nodeIndexOf(nodes, id) < 0) return `no feature ${JSON.stringify(sel.feature)}`;
    const parts = [...new Set(shown.flatMap(b => b.mesh.faces.flatMap(f => f.name.split('+').filter(p => p.startsWith(`${id}.`)))))];
    const exact = parts.filter(p => baseOf(p, id) === role), family = /^[a-z]+$/i.test(role) ? parts.filter(p => new RegExp(`^${role}(\\d+|\\[[A-Za-z0-9_-]+\\])$`).test(baseOf(p, id))) : [];
    found = exact.length ? exact : family;
    if (!found.length) return `feature ${id} has no face "${role}"${parts.length ? ` (its faces: ${parts.join(', ')})` : ' (it has no faces on the shown bodies)'}`;
  } else if (Array.isArray(sel.normal) && sel.normal.length === 3 && sel.normal.every(x => typeof x === 'number' && Number.isFinite(x))) {
    const l = Math.hypot(...sel.normal as number[]); if (!(l > 0)) return 'a normal of zero length';
    const n = (sel.normal as number[]).map(x => x / l), sign = sel.pick === 'min' ? -1 : 1;
    const flat = shown.flatMap(b => b.mesh.faces.filter(f => f.kind === 'plane' && f.normal[0] * n[0] + f.normal[1] * n[1] + f.normal[2] * n[2] > 1 - 1e-9)
      .map(f => ({ name: f.name.split('+')[0], level: sign * (f.centroid[0] * n[0] + f.centroid[1] * n[1] + f.centroid[2] * n[2]) })));
    if (!flat.length) return `no flat face faces [${n.map(x => +x.toFixed(6)).join(', ')}]`;
    const best = Math.max(...flat.map(f => f.level)), tol = 1e-6 * Math.max(1, Math.abs(best));
    found = [...new Set(flat.filter(f => sel.all ? true : f.level >= best - tol).map(f => f.name))];
  } else return `a face selector is {feature, role} or {normal, pick?}: ${JSON.stringify(sel)}`;
  if (found.length > 1 && !sel.all) return `${JSON.stringify(sel)} fits ${found.length} faces: ${found.join(', ')}; name one, narrow it ("on": a body), or pass "all": true`;
  return found;
}

/** The edge names an edge selector stands for, or why none. */
export function resolveEdge(nodes: readonly ModelNode[], bodies: readonly BodyResult[], sel: unknown): string[] | string {
  if (typeof sel === 'string') return [sel];
  if (!isObj(sel) || !Array.isArray(sel.between) || sel.between.length !== 2) return `an edge selector is {between: [face, face]}: ${JSON.stringify(sel)}`;
  const [a, b] = sel.between.map(f => resolveFace(nodes, bodies, f));
  if (typeof a === 'string') return a; if (typeof b === 'string') return b;
  if (a.length !== 1 || b.length !== 1) return 'each face of "between" must be one face';
  const edge = bodies.flatMap(body => body.mesh.edges.flatMap(e => e.names.filter(name => { const p = name.split('|'); return p.includes(a[0]) && p.includes(b[0]); })))[0];
  return edge ? [edge] : `faces ${a[0]} and ${b[0]} share no edge`;
}

/** Selectors (and names) to names, with what each selector resolved to; `error` when one resolves to none. */
export function resolveSelectors(nodes: readonly ModelNode[], bodies: readonly BodyResult[], sel: { faces?: unknown[]; edges?: unknown[]; bodies?: unknown[] }): { names: NameSelection; resolved: Resolved[]; error: string | null } {
  const names: NameSelection = { faces: [], edges: [], bodies: (sel.bodies ?? []).map(String) }, resolved: Resolved[] = [];
  for (const [list, into, resolve] of [[sel.faces ?? [], names.faces, resolveFace], [sel.edges ?? [], names.edges, resolveEdge]] as const) {
    for (const s of list) {
      const r = resolve(nodes, bodies, s);
      if (typeof r === 'string') return { names, resolved, error: r };
      into.push(...r);
      if (typeof s !== 'string') resolved.push({ selector: s, names: r });
    }
  }
  return { names, resolved, error: null };
}
