// CNC5 (O88): the drawing a machined part goes with, checked on the studio's own (R14) — whether one is needed, and on
// it: the views, every size and position (R14's issue list), each thread's callout, the general tolerance note, the
// part's name, its material and its finish. Each item names the page it follows (Hubs' CNC guide and its technical
// drawing page, read 2026-10-21). The STEP carries no semantic PMI (AP242): that is the kernel's STEP writer, queued
// for the kernel lane, and not judged here — the drawing is the document a shop quotes and machines from.
import type { StudioDoc } from '../engine/doc';
import { materialIdOf } from '../app/bodies';
import type { BodyResult } from '../engine/evaluate';
import { materialData, type WebSource } from '@barocss/cad-model/library/materials';
import { drawingInputs } from '../chat/drawing';
import { drawingIssues, issueContext } from '../drawing/issues';
import { GENERAL_NOTE_PREFIX } from '../drawing/tolerance';
import type { RuleStatus } from '../print/rules';

const GUIDE = 'https://www.hubs.com/guides/cnc-machining/', DRAW = 'https://www.hubs.com/knowledge-base/how-prepare-technical-drawing-cnc-machining/', READ = '2026-10-21';
const page = (url: string, label: string): WebSource => ({ url, read: READ, label });
/** The pages each item follows, by item. */
export const DRAWING_PAGES: Readonly<Record<string, WebSource>> = {
  needed: page(GUIDE, 'A technical drawing is required … When feature tolerances are required'),
  standard: page(GUIDE, 'If no tolerance is specified in the technical drawing, then the standard ± 0.125 mm will be held'),
  views: page(DRAW, 'Include one or more 3D pictorial views … two or three orthographic views are sufficient'),
  dimensions: page(DRAW, 'dimensioning all critical features on the drawing'),
  threads: page(DRAW, 'Specify the location, size, and length of all threads'),
  tolerance: page(DRAW, 'the drawing scale and the standards used for dimensioning and tolerancing'),
  title: page(DRAW, 'part name, material, finish and color, the designer and the company'),
  material: page(DRAW, 'part name, material, finish and color, the designer and the company'),
  finish: page(DRAW, 'Individual surfaces with specific finishing requirements … the standard is Ra 3.2 μm'),
};
export interface DrawingItem { readonly id: string; readonly status: RuleStatus; readonly message: string; readonly source: string }
export interface DrawingCheck { readonly needed: boolean; readonly present: boolean; readonly items: readonly DrawingItem[] }
const item = (id: string, status: RuleStatus, message: string): DrawingItem => ({ id, status, message, source: DRAWING_PAGES[id].url });
/** R14's warnings that leave a size or position unsaid. */
const MISSING = new Set(['HOLE_SIZE_MISSING', 'HOLE_NOT_LOCATED', 'STEP_NOT_LOCATED', 'OVERALL_MISSING', 'VIEW_NEEDED']);

/** The part's drawing against what a machining shop needs from it. */
export function drawingCheck(doc: StudioDoc, bodies: readonly BodyResult[]): DrawingCheck {
  const tapped = doc.nodes.flatMap(n => (n.kind === 'hole' && n.thread ? [n.thread] : []));
  // Needed: threads are specified on a drawing; tighter tolerances need one (a part with neither holds ±0.125).
  if (!doc.drawing) {
    return tapped.length
      ? { needed: true, present: false, items: [item('needed', 'fail', `no drawing, but ${tapped.length} tapped hole${tapped.length === 1 ? '' : 's'} (${[...new Set(tapped)].join(', ')}): a thread's size, place and length go on a drawing`)] }
      : { needed: false, present: false, items: [item('standard', 'pass', 'no drawing: no threads and no tolerance stated, so the standard ±0.125 mm holds')] };
  }
  const items: DrawingItem[] = [];
  const i = drawingInputs(doc);
  if (typeof i === 'string') return { needed: !!tapped.length, present: true, items: [item('views', 'unknown', `the drawing could not be built: ${i}`)] };
  const ctx = issueContext(i), issues = drawingIssues(ctx), settings = i.settings;
  // Views: the front and top always; a pictorial (iso) one asked for.
  const shown = Object.entries(ctx.layout.views).filter(([, v]) => !v.hidden).map(([k]) => k);
  items.push(shown.includes('iso') ? item('views', 'pass', `${shown.length} views (${shown.join(', ')}), a pictorial one among them`) : item('views', 'warn', `${shown.length} views (${shown.join(', ')}), no pictorial (iso) one`));
  // Dimensions: R14's errors (the sheet wrong) fail; its warnings that leave a size or position unsaid warn.
  const errors = issues.filter(x => x.severity === 'error'), missing = issues.filter(x => MISSING.has(x.code));
  items.push(errors.length ? item('dimensions', 'fail', `${errors.length} error${errors.length === 1 ? '' : 's'} on the sheet (${[...new Set(errors.map(x => x.code))].join(', ')}): ${errors[0].message}`)
    : missing.length ? item('dimensions', 'warn', `${missing.length} size${missing.length === 1 ? '' : 's'} or position${missing.length === 1 ? '' : 's'} not given (${[...new Set(missing.map(x => x.code))].join(', ')}): ${missing[0].message}`)
      : item('dimensions', 'pass', `${ctx.sheet.dimensions.filter(d => d.ok).length} dimensions; every hole, step and overall size given`));
  // Threads: each tapped hole's designation in a callout on the sheet (its size; its length, THRU or DEEP).
  const texts = ctx.sheet.dimensions.flatMap(d => (d.ok ? [d.text] : [])), uncalled = [...new Set(tapped)].filter(t => !texts.some(x => x.includes(t)));
  if (tapped.length) items.push(uncalled.length ? item('threads', 'warn', `${uncalled.join(', ')} not called out on the sheet (its size, place and length)`) : item('threads', 'pass', `every thread called out (${[...new Set(tapped)].join(', ')})`));
  // The general tolerance note (the standard the sizes are held to).
  const notes = (settings.notes ?? []).map(n => n.text), general = notes.find(t => t.toUpperCase().startsWith(GENERAL_NOTE_PREFIX) || /ISO 2768/i.test(t));
  items.push(general ? item('tolerance', 'pass', `the general tolerance note: "${general.split('\n')[0]}"`) : item('tolerance', 'warn', 'no general tolerance note: the sizes not given a tolerance are held to what (accept the tolerance suggestions\' general note)'));
  // The part's name, its material and its finish.
  items.push(settings.title && settings.title.trim() && settings.title !== 'part' ? item('title', 'pass', `titled "${settings.title}"`) : item('title', 'warn', 'the title block names no part (set_drawing title)'));
  const ids = [...new Set(bodies.map(b => materialIdOf(doc, b) ?? null))], m = ids.length === 1 && ids[0] ? materialData(ids[0]) : undefined;
  if (!m) items.push(item('material', 'unknown', ids.length > 1 ? 'the bodies are of different materials' : 'the part\'s material is not set: the drawing cannot be checked for it'));
  else items.push(notes.some(t => t.toUpperCase().includes(m.label.toUpperCase()) || t.toUpperCase().includes(m.id.toUpperCase())) ? item('material', 'pass', `the material named (${m.label})`) : item('material', 'warn', `the material (${m.label}) not named on the drawing: a note "MATERIAL: ${m.label.toUpperCase()}"`));
  const finish = doc.brief?.finish?.value;
  items.push(!finish ? item('finish', 'pass', 'no finish stated: as machined, Ra 3.2 μm the standard')
    : notes.some(t => t.toUpperCase().includes(finish.toUpperCase()) || /\bRa\b/.test(t)) ? item('finish', 'pass', `the finish stated ("${finish}") on the drawing`) : item('finish', 'warn', `the finish the brief states ("${finish}") is not on the drawing`));
  return { needed: !!tapped.length, present: true, items };
}
