/** Authored opt-in only. Participants and owned geometry are computed for each evaluation. */
export interface BeadOwnership { version: 1; policy: 'equal-length' }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The same refusal for a file, a tool input and a direct evaluation. Undefined means absent. */
export function beadOwnershipError(value: unknown, where = 'frames.beadOwnership'): string | null {
  if (value === undefined) return null;
  const why = !record(value) ? 'expected {version:1, policy:"equal-length"}'
    : Object.keys(value).some(k => k !== 'version' && k !== 'policy') ? 'only version and policy are supported'
    : value.version !== 1 ? 'only version 1 is supported'
    : value.policy !== 'equal-length' ? 'only policy "equal-length" is supported' : null;
  return why ? `[BEAD_SHARED_CONTEXT] ${where}: ${why}` : null;
}

/** Includes nested placed documents before any part is evaluated or accepted. */
export function documentBeadOwnershipError(doc: unknown, where = ''): string | null {
  if (!record(doc)) return null;
  const own = beadOwnershipError(record(doc.frames) ? doc.frames.beadOwnership : undefined, `${where}frames.beadOwnership`);
  if (own) return own;
  for (const [i, instance] of (Array.isArray(doc.instances) ? doc.instances : []).entries()) {
    if (!record(instance)) continue;
    const error = documentBeadOwnershipError(instance.doc, `${where}instances[${i}].doc.`);
    if (error) return error;
  }
  return null;
}
