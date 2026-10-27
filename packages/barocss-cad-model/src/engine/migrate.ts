import { documentConnectorError } from '../assembly/connectors';
// Reading a saved .bcad file: its format and schema checked, an older one brought up to the current
// schema with what was filled in said, one from a newer studio or with unknown features refused — the
// file itself is left as it is until it is saved again.
import { prefixDoc, type StudioDoc } from './doc';
import { bodyKeyFor, withIds } from './ids';
import { documentBeadOwnershipError } from '../frames/beadOwnership';
import { checkDocumentPrintPreview } from './printPreview';
import { checkDocumentBearingHousing } from './bearingContext';
import { firstProblem } from './refusal';
import { assertRouteBundleDocument } from './routeBundle';
import { assertSavedDrawingDocument } from './savedDrawing';

/**
 * 2: every feature has a stable id (engine/ids.ts); a schema-1 file's node i becomes `n<i>`, its names unchanged.
 * 3: bodies are keyed by those ids (`b<k>` for `n<k>`), not by index: a schema-2 file's looks, appearances and
 * animation tracks are moved to them once (the same keys wherever no feature was deleted or moved).
 */
// Legacy documents still migrate to 3; explicit route bundles require reader support for 4.
export const SCHEMA = 3;
const MAX_READ_SCHEMA = 4;
const KINDS = new Set(['sketch', 'extrude', 'revolve', 'decimate', 'translate', 'rotate', 'mirror', 'scale', 'linear-pattern', 'linear-feature-pattern', 'circular-pattern', 'union', 'intersect', 'difference', 'rib', 'rectangular-relief', 'split', 'separate', 'sweep', 'sweep-curve', 'loft', 'import', 'mesh', 'thread', 'shell', 'chamfer', 'fillet', 'draft', 'full-round', 'thicken', 'sew', 'subd', 'gear', 'internal-gear', 'bevel-gear', 'worm', 'worm-wheel', 'spring', 'cam', 'sprocket', 'pulley', 'belt', 'coupling', 'connector-opening', 'connector-body', 'gusset', 'end-cap', 'shaft', 'key', 'keyway', 'retaining-ring', 'pin', 'bearing', 'oring-gland', 'oring', 'rack', 'library', 'hole', 'sheet-base', 'sheet-contour', 'sheet-flange', 'sheet-corner-relief', 'frame-member', 'frame']);

export function readStudioDoc(text: string): { doc: StudioDoc; notes: string[] } | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: 'This is not a BaroCSS model file (it is not JSON).' }; }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== 'object' || o.format !== 'barocss-cad-model') return { error: 'This is not a BaroCSS model file (no barocss-cad-model format).' };
  if (!Array.isArray(o.nodes)) return { error: 'This model file has no features list.' };
  const connectorError = documentConnectorError(o);
  if (connectorError) return { error: connectorError };
  const previewProblem = firstProblem(checkDocumentPrintPreview(o));
  if (previewProblem) return { error: previewProblem };
  const housingProblem = firstProblem(checkDocumentBearingHousing(o));
  if (housingProblem) return { error: housingProblem };
  const ownershipError = documentBeadOwnershipError(o);
  if (ownershipError) return { error: ownershipError };
  const schema = o.schema === undefined ? 0 : Number(o.schema), notes: string[] = [];
  if (!Number.isInteger(schema) || schema < 0) return { error: `This model file has an unreadable schema (${String(o.schema)}).` };
  if (schema > MAX_READ_SCHEMA) return { error: `This model was saved by a newer cad-studio (schema ${schema}; this one reads up to ${MAX_READ_SCHEMA}). Open it there, or save it from there in an older form.` };
  try { assertSavedDrawingDocument(o); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  try { assertRouteBundleDocument(o); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  const unknown = [...new Set((o.nodes as Record<string, unknown>[]).map(n => String(n?.kind)).filter(k => !KINDS.has(k)))];
  if (unknown.length) return { error: `This model has features this cad-studio does not know: ${unknown.join(', ')}.` };
  // Brought up to the current schema: what older files lacked.
  if (schema < SCHEMA) notes.push(`saved before schema ${SCHEMA}: read as schema ${SCHEMA}`);
  if (o.units !== undefined && o.units !== 'mm') return { error: `This model is in ${String(o.units)}: only millimetre models are read.` };
  if (o.units === undefined) notes.push('no units given: read as millimetres');
  const parameters = o.parameters && typeof o.parameters === 'object' ? o.parameters as Record<string, number> : (notes.push('no parameters list: started empty'), {});
  const bad = Object.entries(parameters).filter(([, v]) => typeof v !== 'number' || !Number.isFinite(v)).map(([k]) => k);
  if (bad.length) return { error: `Parameters without a number: ${bad.join(', ')}.` };
  // (Stable ids: a schema-1 file named node i `n<i>`, which is the id it now keeps, so no stored name changes.)
  if (schema < 2) notes.push('features given stable ids (their names stay as they were)');
  let doc: StudioDoc = withIds({ ...(o as unknown as StudioDoc), format: 'barocss-cad-model' as const, schema: schema === 4 ? 4 : SCHEMA, units: 'mm' as const, parameters });
  if (schema === 2) {
    const moved = indexKeysToIds(doc);
    if (moved.changed) notes.push('body looks, appearances and animation tracks keyed by feature ids');
    doc = moved.doc;
  }
  try { assertRouteBundleDocument(doc); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  return { doc: { ...doc, outputs: prefixDoc(doc, doc.nodes.length).outputs }, notes };
}

/** A schema-2 document's records by body index key (`b<i>`, `b<i>_<side>`) moved to the id keys (`b<k>`). */
function indexKeysToIds(doc: StudioDoc): { doc: StudioDoc; changed: boolean } {
  let changed = false;
  const move = <T>(rec: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(rec).map(([k, v]) => {
    const m = /^b(\d+)(_.*)?$/.exec(k), i = m ? Number(m[1]) : -1;
    if (!m || !doc.nodes[i]) return [k, v];
    const to = `${bodyKeyFor(doc.nodes, i)}${m[2] ?? ''}`;
    if (to !== k) changed = true;
    return [to, v];
  }));
  const out: StudioDoc = { ...doc };
  if (doc.bodies) out.bodies = move(doc.bodies);
  if (doc.render) out.render = { ...doc.render, appearances: move(doc.render.appearances), animation: { ...doc.render.animation, tracks: move(doc.render.animation.tracks) } };
  return { doc: out, changed };
}
