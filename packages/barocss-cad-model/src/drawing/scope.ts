import { resolveShopTree } from '../engine/shopRows';
import { frameGeometry, type StudioDoc } from '../engine/doc';
import type { DrawingSettings } from './types';
import { problem, refusal, refused, type Problem } from '../engine/refusal';
export type DrawingScope = { kind: 'part'; part?: string } | { kind: 'assembly' };

/** What is wrong with a drawing's scope: none, or its one problem. */
export function checkDrawingScope(value: unknown): Problem[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [problem('DRAWING_SCOPE', 'scope is {kind: part, part?: id} or {kind: assembly}')];
  const s = value as Record<string, unknown>;
  if (s.kind !== 'part' && s.kind !== 'assembly') return [problem('DRAWING_SCOPE', 'kind is part or assembly')];
  if (Object.keys(s).some(k => k !== 'kind' && !(s.kind === 'part' && k === 'part'))) return [problem('DRAWING_SCOPE', 'unknown scope field')];
  if (s.part !== undefined && (typeof s.part !== 'string' || !s.part.trim())) return [problem('DRAWING_SCOPE', 'part is a nonempty instance id')];
  return [];
}
/** Old BOM/balloon sheets retain their assembly meaning. Ordinary drawings default to the base part. */
export function drawingScopeOf(s: DrawingSettings): DrawingScope {
  if (s.scope !== undefined) { const [why] = checkDrawingScope(s.scope); if (why) throw refused(why); return s.scope; }
  return s.balloons || s.tables?.some(t => t.from === 'bom') ? { kind: 'assembly' } : { kind: 'part' };
}
/** Whether the sheet is drawn from the part's made bodies only (O174): a part's drawing documents what it makes, its
 *  bought elements out of its views and sections. An assembly's keeps them, and so does a part's sheet with balloons
 *  (O175): a balloon points at its BOM line's item, a bought one too, so the item is drawn. */
export const drawsMadeOnly = (s: DrawingSettings): boolean => drawingScopeOf(s).kind !== 'assembly' && !s.balloons;
/** Authored source of a sheet, before drawing-only evaluation changes. */
export function drawingSource(doc: StudioDoc, settings: DrawingSettings): StudioDoc {
  const scope = drawingScopeOf(settings);
  if (scope.kind === 'assembly') return doc;
  const local = scope.part === undefined ? doc : doc.instances?.find(i => i.id === scope.part)?.doc;
  if (!local) throw refusal('DRAWING_SCOPE', `no part ${scope.part}; select an existing part`);
  return local;
}
/** Drawing-only local input. Common assembly/STEP exporters keep their existing instance behavior. */
export function drawingDocument(doc: StudioDoc, settings: DrawingSettings): StudioDoc {
  const scope = drawingScopeOf(settings);
  const local = resolveShopTree(drawingSource(doc, settings), scope.kind === 'part' && scope.part !== undefined ? doc : undefined, scope.kind === 'part' ? scope.part : undefined);
  if (drawingScopeOf(settings).kind === 'assembly') return local;
  // Part-following frames still read their source sketches before instances are excluded from projection.
  // This is a derived evaluation copy only; authored follows records and file settings remain unchanged.
  const nodes = local.nodes.map(n => {
    if (n.kind !== 'frame' || !n.follows || !('part' in n.follows)) return n;
    const g = frameGeometry(local.nodes, n, local.parameters, local.instances);
    if ('code' in g) throw refusal(g.code, g.error);
    return { ...n, follows: undefined, points: g.points, segments: g.segments };
  });
  return { ...local, nodes, instances: undefined, mates: undefined };
}
export function changeDrawingScope(s: DrawingSettings, scope: DrawingScope): DrawingSettings {
  const [why] = checkDrawingScope(scope); if (why) throw refused(why);
  // Snapshot the supported values, including fields the existing validator accepts through a prototype.
  const nextScope: DrawingScope = scope.kind === 'part' ? { kind: 'part', ...(scope.part !== undefined ? { part: scope.part } : {}) } : { kind: 'assembly' };
  const previous = drawingScopeOf(s);
  if (previous.kind === scope.kind && (previous.kind === 'assembly' || (scope.kind === 'part' && previous.part === scope.part))) return { ...s, scope: nextScope };
  if (s.dimensions.some(d => !d.auto) || s.datums?.length || s.frames?.length || s.notes?.some(n => n.leader))
    throw refusal('DRAWING_SCOPE_REFERENCES', 'this sheet has manual model references; keep its scope or remove those references explicitly before changing scope');
  return { ...s, scope: nextScope, dimensions: [] };
}
