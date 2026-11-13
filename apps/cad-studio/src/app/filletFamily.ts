// Studio presentation only: original model commands/builders and saved node kinds remain unchanged.
import { commands, type Command, type Ctx, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { ELLIPSE_SIDE_EDGE_REFUSAL } from '@barocss/cad-model/sketch/ellipse';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import type { Active } from './commandState';
export type FilletType = 'edge' | 'face' | 'full-round';
export type RadiusMode = 'constant' | 'varying';
export const FILLET_TYPES = [{ value: 'edge', label: 'Edge' }, { value: 'face', label: 'Face' }, { value: 'full-round', label: 'Full round' }] as const;
const IDS: Record<FilletType, string> = { edge: 'fillet', face: 'face-fillet', 'full-round': 'full-round' };
export function filletType(id: string): FilletType | null { return id === 'fillet' ? 'edge' : id === 'face-fillet' ? 'face' : id === 'full-round' ? 'full-round' : null; }
const ORIGINALS = Object.fromEntries(FILLET_TYPES.map(type => [type.value, commands.find(c => c.id === IDS[type.value])!])) as Record<FilletType, Command>;
const original = (type: FilletType): Command => ORIGINALS[type];
const guardedBuild = (type: FilletType): NonNullable<Command['build']> => (ctx, values) => { const cmd = original(type), available = cmd.available(ctx); if (!available.ok) throw new Error(available.reason); return cmd.build!(ctx, values); };
const MEMBERS = Object.fromEntries(FILLET_TYPES.map(t => [t.value, { ...original(t.value), build: guardedBuild(t.value) }])) as Record<FilletType, Command>;
export function filletLaunchAvailability(ctx: Ctx, type: FilletType): ReturnType<Command['available']> {
  if (!ctx.bodies.some(b => b.family !== 'faceted' && !b.band && b.role !== 'infill')) {
    return { ok: false, reason: 'A current solid body is needed to choose a fillet type.' };
  }
  const picked = ctx.selection.edges;
  if (type === 'edge' && picked.length && picked.every(e => ctx.bodies[e.body]?.mesh.edges[e.edge])) {
    const availability = original('edge').available(ctx);
    if (!availability.ok && availability.reason === ELLIPSE_SIDE_EDGE_REFUSAL) return availability;
  }
  return { ok: true };
}

export const FILLET_LAUNCHER: Command = { ...original('edge'), available: ctx => filletLaunchAvailability(ctx, 'edge') };
export function filletSelection(type: FilletType, ctx: Ctx): Selection {
  const faces = ctx.selection.faces.filter(f => !!ctx.bodies[f.body]?.mesh.faces[f.face]);
  const edges = type === 'edge' ? ctx.selection.edges.filter(e => !!ctx.bodies[e.body]?.mesh.edges[e.edge]) : [];
  const body = edges[0]?.body ?? faces[0]?.body;
  return { faces: edges.length ? [] : faces.filter(f => f.body === body && (type !== 'full-round' || ctx.bodies[f.body].mesh.faces[f.face].kind === 'plane')), edges: edges.filter(e => e.body === body), bodies: [] };
}
export function newFilletActive(type: FilletType, context: Ctx, initial?: Values): Active {
  const ctx = { ...context, selection: filletSelection(type, context) }, cmd = MEMBERS[type], values = { ...cmd.defaults?.(ctx), ...initial };
  return { cmd, ctx, values, preview: 'busy', fillet: { type, radiusMode: type === 'edge' && Number(values.endRadius) > 0 ? 'varying' : 'constant' } };
}
export function nodeFilletType(node?: ModelNode): FilletType | null { return node ? filletType(node.kind) : null; }
/** Keep only one presentation row; the original best-ranked member remains the action for a nonempty query. */
export function filletPaletteRows<T extends { c: Command }>(rows: readonly T[], query: string, context?: Ctx): T[] {
  let added = false; const out: T[] = [], edge = !query.trim() ? rows.find(r => r.c.id === 'fillet') : undefined;
  for (const row of rows) { if (!filletType(row.c.id)) { out.push(row); continue; } if (added) continue; added = true; const selected = edge ?? row; out.push(context ? { ...selected, a: filletLaunchAvailability(context, filletType(selected.c.id)!) } : selected); }
  return out;
}
export function pickedFilletSelection(active: Active, hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null }, additive: boolean): Selection | null {
  if (!active.fillet) return null;
  const type = active.fillet.type, selected = active.ctx.selection;
  if (type === 'edge' && hit.edge) { const item = hit.edge, same = (e: typeof item) => e.body === item.body && e.edge === item.edge; const list = additive ? selected.edges.filter(e => e.body === item.body) : []; return filletSelection(type, { ...active.ctx, selection: { faces: [], edges: list.some(same) ? list.filter(e => !same(e)) : [...list, item], bodies: [] } }); }
  if (hit.face) { const item = hit.face, same = (f: typeof item) => f.body === item.body && f.face === item.face; const list = additive ? selected.faces.filter(f => f.body === item.body) : []; return filletSelection(type, { ...active.ctx, selection: { faces: list.some(same) ? list.filter(f => !same(f)) : [...list, item], edges: [], bodies: [] } }); }
  return null;
}
interface Transition { current(): Active | null; context(): Ctx; retire(): void; clearApply(): void; set(active: Active): void; select(selection: Selection): void }
export function replaceFillet(options: Transition, type: FilletType, mode?: RadiusMode): void {
  const old = options.current(); if (!old?.fillet) return;
  const next = newFilletActive(type, { ...options.context(), selection: old.ctx.selection }, mode ? old.values : undefined);
  if (mode && type === 'edge') { next.fillet!.radiusMode = mode; next.values = { ...next.values, endRadius: mode === 'constant' ? 0 : Number(old.values.endRadius) > 0 ? old.values.endRadius : old.values.radius }; }
  options.retire(); options.clearApply(); options.select(next.ctx.selection); options.set(next);
}

export function filletApplyCurrent(owner: Active, current: Active | null): boolean { return !owner.fillet || owner === current; }

/** Only exact body identity or the current family's explicit output-parent relation proves a source body. */
function sourceBody(active: Active, shown: BodyResult): number | null {
  const matches: number[] = [];
  for (let i = 0; i < active.ctx.bodies.length; i++) {
    const body = active.ctx.bodies[i];
    if (body.ref && shown.ref && body.key === shown.key && body.ref.node === shown.ref.node && body.ref.side === shown.ref.side) matches.push(i);
  }
  if (matches.length) return matches.length === 1 ? matches[0] : null;
  let candidate;
  try { candidate = active.cmd.build?.(active.ctx, active.values); } catch { return null; }
  if (!candidate || candidate.nodes.length !== active.ctx.doc.nodes.length + 1) return null;
  const index = candidate.nodes.length - 1, node = candidate.nodes[index];
  if (node.kind !== active.cmd.id || !('parent' in node) || !node.parent || typeof node.parent !== 'object' || !('node' in node.parent) || !('side' in node.parent)) return null;
  if (shown.key !== bodyKeyFor(candidate.nodes, index) || shown.ref?.node !== index || shown.ref.side !== 'solid') return null;
  for (let i = 0; i < active.ctx.bodies.length; i++) {
    const body = active.ctx.bodies[i];
    if (body.ref?.node === node.parent.node && body.ref?.side === node.parent.side && body.key === bodyKeyFor(active.ctx.doc.nodes, node.parent.node, node.parent.side)) matches.push(i);
  }
  return matches.length === 1 ? matches[0] : null;
}
function sameNames(a: readonly string[], b: readonly string[]): boolean { if (a.length !== b.length) return false; const left = [...a].sort(), right = [...b].sort(); return left.every((name, i) => name === right[i]); }
/** Preview indices never become source indices. Generated, merged and ambiguous names are refused. */
export function sourceFilletPick(active: Active, shown: readonly BodyResult[], hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null }) {
  let face: typeof hit.face = null, edge: typeof hit.edge = null;
  if (hit.face) {
    const body = shown[hit.face.body], surface = body?.mesh.faces[hit.face.face], source = body && sourceBody(active, body);
    if (surface && source !== null && source !== undefined) {
      const matches: number[] = [], faces = active.ctx.bodies[source].mesh.faces;
      for (let i = 0; i < faces.length; i++) if (faces[i].name === surface.name) matches.push(i);
      if (matches.length === 1) face = { body: source, face: matches[0] };
    }
  }
  if (hit.edge) {
    const body = shown[hit.edge.body], boundary = body?.mesh.edges[hit.edge.edge], source = body && sourceBody(active, body);
    if (boundary && source !== null && source !== undefined) {
      const matches: number[] = [], edges = active.ctx.bodies[source].mesh.edges;
      for (let i = 0; i < edges.length; i++) if (sameNames(edges[i].names, boundary.names)) matches.push(i);
      if (matches.length === 1) edge = { body: source, edge: matches[0] };
    }
  }
  return { face, edge };
}
/** A refused attempt preserves the accepted preview, but never its queued automatic Apply. */
export function prepareFilletPick(active: Active, shown: readonly BodyResult[], hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; instance?: string }, additive: boolean, clearApply: () => void): Selection | null {
  clearApply();
  if (hit.instance) return null;
  const source = sourceFilletPick(active, shown, hit);
  if (hit.edge && active.fillet?.type === 'edge' ? !source.edge : !source.face) return null;
  return pickedFilletSelection(active, source, additive);
}
export function replaceFilletSelection(options: Transition, selection: Selection): void {
  const active = options.current(); if (!active?.fillet) return;
  const next: Active = { ...active, ctx: { ...options.context(), selection }, values: { ...active.values }, preview: 'busy', error: undefined };
  options.retire(); options.clearApply(); options.select(selection); options.set(next);
}
