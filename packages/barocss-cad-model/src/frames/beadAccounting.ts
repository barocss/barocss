import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { withIds } from '../engine/ids';
import { beadsOf, beadRefusal } from '../engine/part';

/** Subtotals of valid reported bodies only. Incomplete never means the whole requested material. */
export interface BeadAccounting {
  complete: boolean; bodyCount: number; nominalVolume: number; ownedVolume: number;
  sharedSeamCount: number; refusedJointIds: string[];
}
export function beadAccounting(doc: StudioDoc, bodies: readonly BodyResult[]): BeadAccounting | undefined {
  const requests = beadsOf(withIds(doc)).filter(b => !beadRefusal(doc, b.joint)?.quiet);
  if (!requests.length) return undefined;
  const seen = new Set<string>(), shared = new Set<string>(), refused = new Set<string>();
  let nominalVolume = 0, ownedVolume = 0;
  for (const request of requests) {
    const body = bodies.find(b => b.key === request.feature.id && b.element?.kind === 'weld-bead');
    if (!body || body.element?.kind !== 'weld-bead' || body.volume === null || !Number.isFinite(body.volume)) { refused.add(request.joint); continue; }
    if (seen.has(body.key)) continue;
    seen.add(body.key); nominalVolume += body.element.report.nominalVolume; ownedVolume += body.volume;
    for (const seam of body.element.report.sharedSeams) shared.add(seam.id);
  }
  return { complete: !refused.size, bodyCount: seen.size, nominalVolume, ownedVolume,
    sharedSeamCount: shared.size, refusedJointIds: [...refused].sort() };
}

/** Each part/instance scope owns its local ids; two placed copies count as two physical components. */
export function combineBeadAccounting(parts: readonly { scope: string; accounting?: BeadAccounting }[]): BeadAccounting | undefined {
  const rows = parts.filter((p): p is { scope: string; accounting: BeadAccounting } => !!p.accounting);
  if (!rows.length) return undefined;
  return { complete: rows.every(p => p.accounting.complete), bodyCount: rows.reduce((s, p) => s + p.accounting.bodyCount, 0),
    nominalVolume: rows.reduce((s, p) => s + p.accounting.nominalVolume, 0), ownedVolume: rows.reduce((s, p) => s + p.accounting.ownedVolume, 0),
    sharedSeamCount: rows.reduce((s, p) => s + p.accounting.sharedSeamCount, 0),
    refusedJointIds: rows.flatMap(p => p.accounting.refusedJointIds.map(id => `${p.scope}/${id}`)).sort() };
}
export const incompleteBeadReason = (accounting: BeadAccounting | undefined): string | null => accounting && !accounting.complete
  ? `[BEAD_ACCOUNTING_INCOMPLETE] no complete welded-part quantity: ${accounting.refusedJointIds.join(', ')}` : null;
