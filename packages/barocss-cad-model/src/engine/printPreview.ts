// Saved display controls only. Validation never fills defaults or creates print.direction.
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** A refusal for invalid saved controls; undefined means absent. No values are changed. */
export function printPreviewProblem(value: unknown, where = 'printPreview'): string | null {
  if (value === undefined) return null;
  const bad = (reason: string) => `[PRINT_PREVIEW_INPUT] ${where}: ${reason}`;
  if (!record(value)) return bad('expected an object with version: 1');
  const extra = Object.keys(value).find(k => !['version', 'layer', 'layerMM', 'supports', 'printed'].includes(k));
  if (extra !== undefined) return bad(`unknown field ${extra}`);
  if (value.version !== 1) return bad('version must be 1');
  if (value.layer !== undefined && (typeof value.layer !== 'number' || !Number.isSafeInteger(value.layer) || value.layer < 0)) return bad('layer must be a zero-based nonnegative safe integer');
  if (value.layerMM !== undefined && (typeof value.layerMM !== 'number' || !Number.isFinite(value.layerMM) || value.layerMM <= 0)) return bad('layerMM must be a finite number greater than 0 mm');
  for (const k of ['supports', 'printed']) if (value[k] !== undefined && typeof value[k] !== 'boolean') return bad(`${k} must be boolean`);
  return null;
}

/** Check the saved document tree before the existing reader accepts it, including pending revisions. */
export function documentPrintPreviewProblem(doc: unknown, where = ''): string | null {
  if (!record(doc)) return null;
  const own = printPreviewProblem(doc.printPreview, `${where}printPreview`);
  if (own) return own;
  for (const [i, instance] of (Array.isArray(doc.instances) ? doc.instances : []).entries()) {
    if (!record(instance)) continue;
    const problem = documentPrintPreviewProblem(instance.doc, `${where}instances[${i}].doc.`);
    if (problem) return problem;
  }
  if (record(doc.pendingParts)) for (const [id, pending] of Object.entries(doc.pendingParts)) {
    if (!record(pending)) continue;
    const problem = documentPrintPreviewProblem(pending.doc, `${where}pendingParts[${JSON.stringify(id)}].doc.`);
    if (problem) return problem;
  }
  return null;
}
