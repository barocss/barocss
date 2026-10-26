// Strict source-table and section inputs for drawing.set. Saved-file readers remain permissive.
import { problem, refusal, type Problem } from '../engine/refusal';
import { halfOk, removedOk, sameSection, sectionDirOk, sectionsOf, stepsOk, withSections, type DrawingSection, type DrawingSettings, type DrawingTable } from './types';
import { detailOk, type DrawingDetail } from './detail';
import { datumsProperty, checkDatumOptions, readDatums } from './datums';
import { datumTargetsProperty, checkDatumTargetOptions, readDatumTargets } from './datumTargets';
import { framesProperty, checkDrawingFrames, readFrames } from './controls';
import { checkDrawingMetadata, readTitleBlock, readRevisions } from './metadata';
import { breakOk, breaksMeet, type DrawingBreak } from './breaks';

export const manufacturingDrawingProperties = {
  datums: datumsProperty,
  datumTargets: datumTargetsProperty,
  frames: framesProperty,
  titleBlock: { type: 'object', description: 'DR-5: replaces title metadata. Basic retains the original block; extended adds six fields. Omitted keeps it.', properties: { template: { type: 'string', enum: ['basic', 'extended'] }, ...Object.fromEntries(['organization', 'number', 'drawnBy', 'checkedBy', 'material', 'finish'].map(k => [k, { type: 'string', minLength: 1, maxLength: 120 }])) }, required: ['template'], additionalProperties: false },
  revisions: { type: 'array', maxItems: 50, description: 'DR-5: replaces revision history; [] clears; omitted keeps. Unique revision labels. Does not change the active revision or record approval. Show with a table from revisions.', items: { type: 'object', properties: { revision: { type: 'string', minLength: 1, maxLength: 6 }, date: { type: 'string', description: 'YYYY-MM-DD' }, description: { type: 'string', minLength: 1, maxLength: 120 }, by: { type: 'string', minLength: 1, maxLength: 60 } }, required: ['revision', 'date', 'description'], additionalProperties: false } },
  weldSymbols: { type: 'boolean', description: 'true enables weld symbols; false removes the flag; omitted keeps it.' },
  balloons: { type: 'boolean', description: 'true enables BOM item balloons; false removes the flag; omitted keeps it. Does not change scope.' },
  sections: { type: 'array', description: 'Replaces all sections; [] clears them. Omitted keeps them. Referenced section changes are refused.', items: { type: 'object', properties: { id: { type: 'string', pattern: '^[A-Z]{1,2}$' }, view: { type: 'string', enum: ['front', 'top', 'right'] }, at: { type: 'number', description: 'Position along the view depth, model mm.' }, dir: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, description: 'Aligned section: plane normal (model axes); at is along it.' }, half: { type: 'object', description: 'DR-3 half section: cut on one side of a centreline in the section view (vertical at u = at, or horizontal at v = at); cut after = the greater side.', properties: { line: { type: 'string', enum: ['vertical', 'horizontal'] }, at: { type: 'number' }, cut: { type: 'string', enum: ['after', 'before'] } }, required: ['line', 'at', 'cut'], additionalProperties: false }, steps: { type: 'array', description: 'DR-3 offset section: from the section view coordinate past onward (along along, horizontal by default), the plane is at depth at; past increasing.', items: { type: 'object', properties: { past: { type: 'number' }, at: { type: 'number' } }, required: ['past', 'at'], additionalProperties: false } }, along: { type: 'string', enum: ['horizontal', 'vertical'] }, removed: { type: 'object', description: 'DR-4 removed section: only the cut face, drawn apart from the views at scale (absolute; omitted: the sheet\'s), its centre at at [x, y] on the sheet (omitted: in free room).', properties: { at: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, scale: { type: 'number' } }, additionalProperties: false }, revolved: { type: 'boolean', description: 'DR-4 revolved section (principal only): the cut face turned onto the view that sees the plane edge-on (a front section\'s onto the top view, others onto the front view).' } }, required: ['id', 'view', 'at'], additionalProperties: false } },
  details: { type: 'array', description: 'DR-1: replaces all detail views; [] clears them; omitted keeps them. A detail enlarges what lies inside a circle on a view or a section. Letters are unique among sections and details. Changing or removing one with dimensions is refused.', items: { type: 'object', properties: { id: { type: 'string', pattern: '^[A-Z]{1,2}$' }, view: { type: 'string', description: 'front, top, right or section:<letter>.' }, center: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'The circle\'s centre in that view\'s coordinates, model mm.' }, radius: { type: 'number', description: 'Model mm.' }, scale: { type: 'number', description: 'Absolute, 5 = 5:1; omitted: the smallest standard scale at least twice the sheet\'s.' }, at: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'Its centre on the sheet, sheet mm; omitted: placed in free room.' } }, required: ['id', 'view', 'center', 'radius'], additionalProperties: false } },
  breaks: { type: 'array', description: 'DR-2: replaces all breaks; [] clears them; omitted keeps them. A break leaves the part between from and to (model mm along axis x, y or z) out of the front, top and right views (and their sections), drawn shorter with break lines; dimensions across it keep their true values. Breaks on one axis may not overlap.', items: { type: 'object', properties: { axis: { type: 'string', enum: ['x', 'y', 'z'] }, from: { type: 'number' }, to: { type: 'number' } }, required: ['axis', 'from', 'to'], additionalProperties: false } },
  tables: { type: 'array', description: 'Replaces all tables with model-derived source tables; [] clears them. Omitted keeps every existing table.', items: { type: 'object', properties: { id: { type: 'string', minLength: 1 }, from: { type: 'string', enum: ['bom', 'cut-list', 'weld-list', 'revisions'] }, title: { type: 'string' }, at: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, corner: { type: 'string', enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] }, whole: { type: 'boolean' } }, required: ['id', 'from'], additionalProperties: false } },
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
// Check each required index: Array.every alone skips holes in direct JavaScript input.
const finiteTuple = (v: unknown, length: 2 | 3): boolean => Array.isArray(v) && v.length === length && finite(v[0]) && finite(v[1]) && (length === 2 || finite(v[2]));

/** No coercion or partial acceptance, even when the caller bypasses the offered JSON schema. */
export function checkManufacturingDrawing(args: Record<string, unknown>): Problem[] {
  const datums = checkDatumOptions(args); if (datums.length) return datums;
  const datumTargets = checkDatumTargetOptions(args); if (datumTargets.length) return datumTargets;
  const frames = checkDrawingFrames(args); if (frames.length) return frames;
  const metadata = checkDrawingMetadata(args); if (metadata.length) return metadata;
  for (const flag of ['weldSymbols', 'balloons']) if (flag in args && typeof args[flag] !== 'boolean') return [problem('DRAWING_OPTIONS', `${flag} must be boolean.`)];
  if ('sections' in args) {
    if (!Array.isArray(args.sections)) return [problem('DRAWING_OPTIONS', 'sections must be an array.')];
    const ids = new Set<string>();
    for (const [index, s] of args.sections.entries()) {
      if (record(s) && (s.half !== undefined || s.steps !== undefined || s.along !== undefined) && (s.dir !== undefined || (s.half !== undefined && s.steps !== undefined) || (s.half !== undefined && (!record(s.half) || !keys(s.half, ['line', 'at', 'cut']) || !halfOk(s.half))) || (s.steps !== undefined && (!Array.isArray(s.steps) || [...s.steps].some(st => !record(st) || !keys(st, ['past', 'at'])) || !stepsOk(s.steps))) || (s.along !== undefined && (s.steps === undefined || !['horizontal', 'vertical'].includes(s.along as string))))) return [problem('DRAWING_OPTIONS', `sections[${index}]: a half {line: vertical|horizontal, at, cut: after|before} or steps [{past, at}] with past increasing (along: horizontal|vertical with steps), on a principal section (no dir), not both.`)];
      // (DR-4: removed on a plain or aligned section, revolved on a plain principal one; neither with a half or steps, nor together.)
      if (record(s) && (s.removed !== undefined || s.revolved !== undefined) && ((s.removed !== undefined && (!record(s.removed) || !keys(s.removed, ['at', 'scale']) || !removedOk(s.removed) || (s.removed.at !== undefined && !finiteTuple(s.removed.at, 2)))) || (s.revolved !== undefined && s.revolved !== true && s.revolved !== false) || s.half !== undefined || s.steps !== undefined || (s.revolved === true && (s.dir !== undefined || s.removed !== undefined)))) return [problem('DRAWING_OPTIONS', `sections[${index}]: removed {at?: [sheet x, y], scale?: > 0} or revolved: true (no dir), not both, and neither with a half or steps.`)];
      if (!record(s) || !keys(s, ['id', 'view', 'at', 'dir', 'half', 'steps', 'along', 'removed', 'revolved']) || typeof s.id !== 'string' || !/^[A-Z]{1,2}$/.test(s.id) || ids.has(s.id) || (typeof s.view !== 'string' || !['front', 'top', 'right'].includes(s.view)) || !finite(s.at) || (s.dir !== undefined && (!finiteTuple(s.dir, 3) || !sectionDirOk(s.dir)))) return [problem('DRAWING_OPTIONS', `sections[${index}] needs a unique letter id, front/top/right view and finite at (an aligned section: dir, its plane's normal [x, y, z]), with no other keys.`)];
      ids.add(s.id);
    }
  }
  if ('details' in args) {
    if (!Array.isArray(args.details)) return [problem('DRAWING_OPTIONS', 'details must be an array.')];
    const ids = new Set<string>(), sectionIds = new Set(Array.isArray(args.sections) ? (args.sections as { id?: unknown }[]).map(x => String(x?.id)) : []);
    for (const [index, d] of args.details.entries()) {
      if (!record(d) || !keys(d, ['id', 'view', 'center', 'radius', 'scale', 'at']) || !finiteTuple(d.center, 2) || (d.at !== undefined && !finiteTuple(d.at, 2)) || !detailOk(d) || ids.has(d.id) || sectionIds.has(d.id)) return [problem('DRAWING_OPTIONS', `details[${index}] needs a unique letter id (not a section's), view front/top/right or section:<letter>, center [x, y] and radius > 0 in that view's model mm; optional scale > 0 and at [x, y] on the sheet. No other keys.`)];
      ids.add(d.id);
    }
  }
  if ('breaks' in args) {
    if (!Array.isArray(args.breaks)) return [problem('DRAWING_OPTIONS', 'breaks must be an array.')];
    const seen: DrawingBreak[] = [];
    for (const [index, b] of args.breaks.entries()) {
      if (!record(b) || !keys(b, ['axis', 'from', 'to']) || !breakOk(b)) return [problem('DRAWING_OPTIONS', `breaks[${index}] needs axis x, y or z and finite from < to (model mm). No other keys.`)];
      if (seen.some(o => breaksMeet(o, b))) return [problem('DRAWING_OPTIONS', `breaks[${index}] overlaps another break on ${b.axis}.`)];
      seen.push(b);
    }
  }
  if ('tables' in args) {
    if (!Array.isArray(args.tables)) return [problem('DRAWING_OPTIONS', 'tables must be an array.')];
    const ids = new Set<string>();
    for (const [index, t] of args.tables.entries()) {
      if (!record(t) || !keys(t, ['id', 'from', 'title', 'at', 'corner', 'whole']) || typeof t.id !== 'string' || !t.id.trim() || ids.has(t.id) || (typeof t.from !== 'string' || !['bom', 'cut-list', 'weld-list', 'revisions'].includes(t.from)) || ('title' in t && typeof t.title !== 'string') || ('whole' in t && typeof t.whole !== 'boolean') || ('corner' in t && (typeof t.corner !== 'string' || !['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(t.corner))) || ('at' in t && !finiteTuple(t.at, 2))) return [problem('DRAWING_OPTIONS', `tables[${index}] needs a unique nonempty id and bom/cut-list/weld-list/revisions source; optional title, at[2], corner and whole must match the schema. No other keys.`)];
      ids.add(t.id);
    }
  }
  return [];
}

/** Call only after strict validation. Refuse section edits that would change an annotation's model reference (DRAWING_SECTION_REFERENCES, thrown). */
export function withManufacturingDrawing(s: DrawingSettings, args: Record<string, unknown>): DrawingSettings {
  let next = { ...s };
  if ('datums' in args) { delete next.datums; const datums = readDatums(args.datums); if (datums.length) next.datums = datums; }
  if ('datumTargets' in args) { delete next.datumTargets; const targets = readDatumTargets(args.datumTargets); if (targets.length) next.datumTargets = targets; }
  if ('frames' in args) { delete next.frames; const frames = readFrames(args.frames); if (frames.length) next.frames = frames; }
  if ('titleBlock' in args) next.titleBlock = readTitleBlock(args.titleBlock)!;
  if ('revisions' in args) { delete next.revisions; const rows = readRevisions(args.revisions); if (rows.length) next.revisions = rows; }
  for (const flag of ['weldSymbols', 'balloons'] as const) if (flag in args) {
    delete next[flag];
    if (args[flag] === true) next[flag] = true;
  }
  if ('sections' in args) {
    const list = args.sections as DrawingSection[];
    const changed = sectionsOf(s).filter(old => !list.some(n => sameSection(n, old)));
    if (s.dimensions.some(d => changed.some(c => d.view === `section:${c.id}`))) throw refusal('DRAWING_SECTION_REFERENCES', 'A changed or removed section has dimensions. Keep its definition or remove those dimensions explicitly first.');
    // Snapshot nested section inputs; revolved false stays dropped as in saved files.
    next = withSections(next, list.map(x => {
      const { dir, half, steps, removed, revolved, ...rest } = x;
      return { ...rest,
        ...(dir ? { dir: [dir[0], dir[1], dir[2]] as [number, number, number] } : {}),
        ...(half ? { half: { line: half.line, at: half.at, cut: half.cut } } : {}),
        ...(steps ? { steps: steps.map(st => ({ past: st.past, at: st.at })) } : {}),
        ...(removed ? { removed: { ...(removed.at ? { at: [removed.at[0], removed.at[1]] as [number, number] } : {}), ...(removed.scale !== undefined ? { scale: removed.scale } : {}) } } : {}),
        ...(revolved === true ? { revolved: true as const } : {}),
      };
    }));
  }
  // (DR-1: a detail's circle and parent are its dimensions' reference — changed or removed, refused while they have any;
  // its scale and place may change. Its parent section must be on the drawing.)
  if ('details' in args) {
    const list = args.details as DrawingDetail[], same = (a: DrawingDetail, b: DrawingDetail) => a.id === b.id && a.view === b.view && a.center[0] === b.center[0] && a.center[1] === b.center[1] && a.radius === b.radius;
    const changed = (s.details ?? []).filter(old => !list.some(n => same(n, old)));
    if (s.dimensions.some(d => changed.some(c => d.view === `detail:${c.id}`))) throw refusal('DRAWING_DETAIL_REFERENCES', 'A changed or removed detail has dimensions. Keep its view, centre and radius, or remove those dimensions explicitly first.');
    delete next.details;
    if (list.length) next.details = list.map(d => ({ id: d.id, view: d.view, center: [d.center[0], d.center[1]], radius: d.radius, ...(d.scale !== undefined ? { scale: d.scale } : {}), ...(d.at ? { at: [d.at[0], d.at[1]] } : {}) }) as DrawingDetail);
  }
  if ('breaks' in args) {
    delete next.breaks;
    const list = args.breaks as DrawingBreak[];
    if (list.length) next.breaks = list.map(b => ({ axis: b.axis, from: b.from, to: b.to }));
  }
  const letters = new Set(sectionsOf(next).map(x => x.id));
  for (const d of next.details ?? []) {
    if (letters.has(d.id)) throw refusal('DRAWING_DETAIL_LETTER', `Detail ${d.id} has a section's letter: letters are unique among sections and details.`);
    if (d.view.startsWith('section:') && !letters.has(d.view.slice(8))) throw refusal('DRAWING_DETAIL_PARENT', `Detail ${d.id} enlarges section ${d.view.slice(8)}, which the drawing does not have.`);
  }
  if ('tables' in args) {
    delete next.tables;
    const tables = args.tables as DrawingTable[];
    if (tables.length) next.tables = tables.map(t => ({ ...t, ...(t.at ? { at: [...t.at] as [number, number] } : {}) }));
  }
  return next;
}
