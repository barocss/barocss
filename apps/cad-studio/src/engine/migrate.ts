// Reading a saved .bcad file: its format and schema checked, an older one brought up to the current
// schema with what was filled in said, one from a newer studio or with unknown features refused — the
// file itself is left as it is until it is saved again.
import { prefixDoc, type StudioDoc } from './doc';

export const SCHEMA = 1;
const KINDS = new Set(['sketch', 'extrude', 'revolve', 'translate', 'rotate', 'mirror', 'scale', 'linear-pattern', 'circular-pattern', 'union', 'intersect', 'difference', 'split', 'separate', 'sweep', 'loft', 'import', 'shell', 'chamfer', 'fillet', 'hole']);

export function readStudioDoc(text: string): { doc: StudioDoc; notes: string[] } | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: 'This is not a BaroCSS model file (it is not JSON).' }; }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== 'object' || o.format !== 'barocss-cad-model') return { error: 'This is not a BaroCSS model file (no barocss-cad-model format).' };
  if (!Array.isArray(o.nodes)) return { error: 'This model file has no features list.' };
  const schema = o.schema === undefined ? 0 : Number(o.schema), notes: string[] = [];
  if (!Number.isInteger(schema) || schema < 0) return { error: `This model file has an unreadable schema (${String(o.schema)}).` };
  if (schema > SCHEMA) return { error: `This model was saved by a newer cad-studio (schema ${schema}; this one reads up to ${SCHEMA}). Open it there, or save it from there in an older form.` };
  const unknown = [...new Set((o.nodes as Record<string, unknown>[]).map(n => String(n?.kind)).filter(k => !KINDS.has(k)))];
  if (unknown.length) return { error: `This model has features this cad-studio does not know: ${unknown.join(', ')}.` };
  // Brought up to the current schema: what older files lacked.
  if (schema < SCHEMA) notes.push(`saved before schema ${SCHEMA}: read as schema ${SCHEMA}`);
  if (o.units !== undefined && o.units !== 'mm') return { error: `This model is in ${String(o.units)}: only millimetre models are read.` };
  if (o.units === undefined) notes.push('no units given: read as millimetres');
  const parameters = o.parameters && typeof o.parameters === 'object' ? o.parameters as Record<string, number> : (notes.push('no parameters list: started empty'), {});
  const bad = Object.entries(parameters).filter(([, v]) => typeof v !== 'number' || !Number.isFinite(v)).map(([k]) => k);
  if (bad.length) return { error: `Parameters without a number: ${bad.join(', ')}.` };
  const doc = { ...(o as unknown as StudioDoc), format: 'barocss-cad-model' as const, schema: SCHEMA as 1, units: 'mm' as const, parameters };
  return { doc: { ...doc, outputs: prefixDoc(doc, doc.nodes.length).outputs }, notes };
}
