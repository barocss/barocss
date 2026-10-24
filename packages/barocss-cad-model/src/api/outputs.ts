// P1 milestone 3 (cad-model's facade): a part's manufacturing inputs and its outputs, the one place the facade calls the
// core's output functions.
// - Inputs, as the studio and the agent write them: the part's process and pull (the Library panel's Process and Pull),
//   the casting pattern's inputs (set_casting), the drawing's settings (set_drawing) and its dimensions (auto_dimension).
// - Outputs, the agent's own tools' replies: check_printability's report, drawing_issues, output_cam_package,
//   output_bom and output_purchase_csv; and the drawing's files as the drawing workspace exports them (SVG, DXF, PDF).
// The output tools evaluate through an async evaluate, so the outputs that use one are async here too; the inputs and
// the drawing are sync, as their core functions are. A refusal is the core's code, passed through (§6).
import { BarocssError, bracketedCode, refuse, type Vec3 } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import { evaluateDoc, type BodyResult, type EvalResult } from '../engine/evaluate';
import { PROCESSES } from '../engine/schema/brief';
import { MATERIALS_DATA } from '../library/materials';
import { printability } from '../print/rules';
import { drawingInputs, runDrawingTool } from '../chat/drawing';
import { runOutputTool } from '../chat/outputs';
import { issueContext } from '../drawing/issues';
import { sheetSvg } from '../io/svg';
import { sheetDxf } from '../io/dxf';
import { sheetPdf, pdfMissing } from '../io/pdf';
import { bodiesOf } from './core';

const REVISION = 0;
const evaluate = async (doc: StudioDoc): Promise<EvalResult | null> => evaluateDoc(doc, REVISION);
/** A tool's refusal in its words: its bracketed code, else the facade's own. */
const refused = (message: string, fallback: string) => new BarocssError(bracketedCode(message) ?? fallback, message, 'evaluate');

/** The pulls the Library panel offers: a casting's or a moulding's direction out of the die, one of the six axes. */
type M3 = [number, number, number];
const PULLS: readonly M3[] = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];

/**
 * The Library panel's Process (and Pull): the part's process by id — a printer that is not for it dropped, as the panel
 * drops it — or none (null). The pull, for a casting or a moulding, is one of the six axes.
 */
export function withProcess(doc: StudioDoc, id: string | null, o: { pull?: Vec3 } = {}): StudioDoc {
  if (id !== null && !(PROCESSES as readonly string[]).includes(id)) throw refuse('VALUE', `no process '${id}'; the processes are ${PROCESSES.join(', ')}`);
  const next = { ...doc };
  if (id !== null) next.process = id; else delete next.process;
  if (next.printer && MATERIALS_DATA.printers.find(p => p.id === next.printer)?.process !== next.process) delete next.printer;
  if (o.pull !== undefined) {
    const pull = PULLS.find(p => p.every((x, k) => x === o.pull![k]));
    if (!pull) throw refuse('VALUE', `a pull is one of the six axes, ${PULLS.map(p => `[${p.join(', ')}]`).join(' ')}; not ${JSON.stringify(o.pull)}`);
    next.mould = { version: 1, ...doc.mould, pull: [pull[0], pull[1], pull[2]] };
  }
  return next;
}

export interface CastingOptions { machined?: readonly string[]; allowance?: number; shrink?: number; gate?: Vec3 }
const inRange = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/** set_casting's write: the faces machined after casting (by name), your allowance and shrinkage, the gate — checked as the tool checks them. */
export function withCasting(doc: StudioDoc, bodies: readonly BodyResult[], o: CastingOptions): StudioDoc {
  const { machined, allowance, shrink, gate } = o;
  if (machined === undefined && allowance === undefined && shrink === undefined && gate === undefined) throw refuse('VALUE', 'Give machined, allowance, shrink, gate or any of them.');
  if (gate !== undefined && !(Array.isArray(gate) && gate.length === 3 && gate.every(x => typeof x === 'number' && Number.isFinite(x)))) throw refused('[CASTING_GATE] gate is a point [x, y, z] (mm) on the part, where the metal comes in.', 'CASTING_GATE');
  if (machined !== undefined && !(Array.isArray(machined) && machined.every(x => typeof x === 'string' && x))) throw refused('[CASTING_FACE] machined is a list of face names ("n1.top").', 'CASTING_FACE');
  const faces = new Set(bodies.flatMap(b => b.mesh.faces.map(f => f.name))), missing = (machined ?? []).filter(n => !faces.has(n));
  if (missing.length) throw refused(`[CASTING_FACE] not a face of the part: ${missing.join(', ')}. Use the names from the last result or query.summary.`, 'CASTING_FACE');
  if (allowance !== undefined && !inRange(allowance, 0, 100)) throw refused(`[CASTING_ALLOWANCE] allowance is mm a machined face, 0 to 100: ${JSON.stringify(allowance)}.`, 'CASTING_ALLOWANCE');
  if (shrink !== undefined && !inRange(shrink, 0, 0.1)) throw refused(`[CASTING_SHRINK] shrink is a ratio (mm/mm), 0 to 0.1 (0.013 is 1.3 %): ${JSON.stringify(shrink)}.`, 'CASTING_SHRINK');
  const was = doc.casting ?? { version: 1 as const };
  return { ...doc, casting: { ...was, version: 1 as const, ...(machined !== undefined ? { machined: [...new Set<string>(machined)] } : {}), ...(allowance !== undefined ? { machiningAllowance: allowance } : {}), ...(shrink !== undefined ? { shrink } : {}), ...(gate !== undefined ? { gate: [gate[0], gate[1], gate[2]] as M3 } : {}) } };
}

/** A drawing tool's write (set_drawing, auto_dimension, fix_drawing, accept_tolerances): the document it writes, or its refusal. */
export function drawingDoc(doc: StudioDoc, tool: 'set_drawing' | 'auto_dimension' | 'fix_drawing' | 'accept_tolerances', args: Record<string, unknown>): StudioDoc {
  const r = runDrawingTool(doc, tool, args);
  if ('error' in r) throw refused(r.error, 'DRAWING');
  return r.doc;
}

/** The part's drawing: drawing_issues' reply (the sheet and its issues), and the sheet as the drawing workspace exports it — SVG, DXF (R2000) and PDF. */
export function drawingOf(doc: StudioDoc) {
  const r = runDrawingTool(doc, 'drawing_issues', {});
  if ('error' in r) throw refused(r.error, 'DRAWING');
  const i = drawingInputs(doc);
  if (typeof i === 'string') throw refused(i, 'DRAWING');
  const ctx = issueContext(i), title = i.settings.title ?? 'part', dxf = sheetDxf(ctx.sheet, ctx.layout);
  return {
    ...(r.content as { sheet: Record<string, unknown>; issues: { code: string; severity: string; message: string; fix?: string }[] }),
    svg: sheetSvg(ctx.sheet, title), dxf: dxf.text, pdf: sheetPdf(ctx.sheet, title),
    /** Characters the PDF's font has not got (they print as ?). */
    pdfMissing: pdfMissing(ctx.sheet),
  };
}

/** check_printability's report: the rules of the part's process — printing, moulding, machining, casting. */
export const manufacturabilityOf = (doc: StudioDoc, o: { direction?: Vec3; finish?: string; sides?: Readonly<Record<string, '+' | '-'>> } = {}) =>
  printability(doc, doc.nodes.length ? bodiesOf(doc) : [], evaluate, o);

/** An output tool's reply (output_bom, output_purchase_csv, output_cam_package, …): its content, files with their bytes and digests. */
export async function outputOf(doc: StudioDoc, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const r = await runOutputTool(doc, doc.nodes.length ? bodiesOf(doc) : [], name, args, evaluate);
  if ('error' in r) throw refused(r.error, 'OUTPUT');
  return r.content;
}
