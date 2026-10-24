// Native file boundary only. Public JSON and dynamics keep the default MMGS-to-SI calculation.
import { readNativeSIInertia, type NativeSIUnavailableReason } from '@barocss/cad/internal/native-si-mass';
import type { StudioDoc } from '../engine/doc';
import { nativeMassPropertiesOfBody, type BodyResult } from '../engine/evaluate';
import { materialIdOf } from '../app/bodies';
import { materialOf } from '../library/materials';
import { linkInertia, type Frame, type LinkInertia, type Mat3 } from './inertia';

export interface NativeInertiaBasis {
  link: string; body: string;
  mode: 'raw-native-si' | 'mmgs-roundtrip';
  reason?: NativeSIUnavailableReason;
}

/** Reuse tracked raw moments where available; preserve general derived/clone export support with an explicit note. */
export function nativeLinkInertia(link: string, part: string, doc: StudioDoc | null, bodies: readonly BodyResult[], frame: Frame): { inertia: LinkInertia; basis: NativeInertiaBasis[]; notes: string[] } {
  const basis: NativeInertiaBasis[] = [], notes: string[] = [];
  if (!doc) return { inertia: linkInertia(link, part, null, bodies, frame), basis, notes };
  const inertia = linkInertia(link, part, doc, bodies, frame, b => {
    const props = nativeMassPropertiesOfBody(b), raw = props ? readNativeSIInertia(props) : { ok: false as const, reason: 'untracked' as const };
    if (!raw.ok) {
      basis.push({ link, body: b.key, mode: 'mmgs-roundtrip', reason: raw.reason });
      notes.push(`${link}/${b.key}: native SI provenance unavailable (${raw.reason}); existing MMGS round-trip inertia used.`);
      return undefined;
    }
    const density = materialOf(materialIdOf(doc, b)).gPerCm3, ratio = density / raw.density;
    basis.push({ link, body: b.key, mode: 'raw-native-si' });
    return raw.inertia.flat().map(x => x * ratio) as Mat3;
  });
  return { inertia, basis, notes };
}
