// Strict source-table and section inputs for drawing.set. Saved-file readers remain permissive.
import { sectionsOf, withSections, type DrawingSection, type DrawingSettings, type DrawingTable } from './types';

export const manufacturingDrawingProperties = {
  weldSymbols: { type: 'boolean', description: 'true enables weld symbols; false removes the flag; omitted keeps it.' },
  balloons: { type: 'boolean', description: 'true enables BOM item balloons; false removes the flag; omitted keeps it. Does not change scope.' },
  sections: { type: 'array', description: 'Replaces all sections; [] clears them. Omitted keeps them. Referenced section changes are refused.', items: { type: 'object', properties: { id: { type: 'string', pattern: '^[A-Z]{1,2}$' }, view: { type: 'string', enum: ['front', 'top', 'right'] }, at: { type: 'number', description: 'Position along the view depth, model mm.' } }, required: ['id', 'view', 'at'], additionalProperties: false } },
  tables: { type: 'array', description: 'Replaces all tables with model-derived source tables; [] clears them. Omitted keeps every existing table.', items: { type: 'object', properties: { id: { type: 'string', minLength: 1 }, from: { type: 'string', enum: ['bom', 'cut-list', 'weld-list'] }, title: { type: 'string' }, at: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, corner: { type: 'string', enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] }, whole: { type: 'boolean' } }, required: ['id', 'from'], additionalProperties: false } },
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));

/** No coercion or partial acceptance, even when the caller bypasses the offered JSON schema. */
export function manufacturingDrawingProblem(args: Record<string, unknown>): string | null {
  for (const flag of ['weldSymbols', 'balloons']) if (flag in args && typeof args[flag] !== 'boolean') return `[DRAWING_OPTIONS] ${flag} must be boolean.`;
  if ('sections' in args) {
    if (!Array.isArray(args.sections)) return '[DRAWING_OPTIONS] sections must be an array.';
    const ids = new Set<string>();
    for (const [index, s] of args.sections.entries()) {
      if (!record(s) || !keys(s, ['id', 'view', 'at']) || typeof s.id !== 'string' || !/^[A-Z]{1,2}$/.test(s.id) || ids.has(s.id) || (typeof s.view !== 'string' || !['front', 'top', 'right'].includes(s.view)) || !finite(s.at)) return `[DRAWING_OPTIONS] sections[${index}] needs a unique letter id, front/top/right view and finite at, with no other keys.`;
      ids.add(s.id);
    }
  }
  if ('tables' in args) {
    if (!Array.isArray(args.tables)) return '[DRAWING_OPTIONS] tables must be an array.';
    const ids = new Set<string>();
    for (const [index, t] of args.tables.entries()) {
      if (!record(t) || !keys(t, ['id', 'from', 'title', 'at', 'corner', 'whole']) || typeof t.id !== 'string' || !t.id.trim() || ids.has(t.id) || (typeof t.from !== 'string' || !['bom', 'cut-list', 'weld-list'].includes(t.from)) || ('title' in t && typeof t.title !== 'string') || ('whole' in t && typeof t.whole !== 'boolean') || ('corner' in t && (typeof t.corner !== 'string' || !['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(t.corner))) || ('at' in t && (!Array.isArray(t.at) || t.at.length !== 2 || !t.at.every(finite)))) return `[DRAWING_OPTIONS] tables[${index}] needs a unique nonempty id and bom/cut-list/weld-list source; optional title, at[2], corner and whole must match the schema. No other keys.`;
      ids.add(t.id);
    }
  }
  return null;
}

/** Call only after strict validation. Refuse section edits that would change an annotation's model reference. */
export function withManufacturingDrawing(s: DrawingSettings, args: Record<string, unknown>): DrawingSettings | string {
  let next = { ...s };
  for (const flag of ['weldSymbols', 'balloons'] as const) if (flag in args) {
    delete next[flag];
    if (args[flag] === true) next[flag] = true;
  }
  if ('sections' in args) {
    const list = args.sections as DrawingSection[];
    const changed = sectionsOf(s).filter(old => !list.some(n => n.id === old.id && n.view === old.view && n.at === old.at));
    if (s.dimensions.some(d => changed.some(c => d.view === `section:${c.id}`))) return '[DRAWING_SECTION_REFERENCES] A changed or removed section has dimensions. Keep its definition or remove those dimensions explicitly first.';
    next = withSections(next, list);
  }
  if ('tables' in args) {
    delete next.tables;
    const tables = args.tables as DrawingTable[];
    if (tables.length) next.tables = tables.map(t => ({ ...t, ...(t.at ? { at: [...t.at] as [number, number] } : {}) }));
  }
  return next;
}
