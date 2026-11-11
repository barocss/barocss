import { refOf } from '@barocss/cad-model/app/bodyRef';
import { withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { friendlyCause, type FriendlyError } from '@barocss/cad-model/engine/errors';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import type { VolumeReply } from '../engine/client';

interface Pair { a: string; b: string }
export interface InterferenceReport {
  pairs: number;
  clashes: (Pair & { volume: number })[];
  failures: (Pair & { error: FriendlyError })[];
}

const minimumVolume = 1e-6;
const unavailable = (detail: string): FriendlyError => ({ title: 'Intersection not checked', hint: detail, detail });
function intersectionVolume(reply: VolumeReply, key: string): number | FriendlyError {
  if (!reply.ok) return reply.error === 'stopped' ? unavailable('The worker stopped.') : reply.error;
  const result = reply.volumes.find(row => row.key === key);
  if (!result) return reply.emptyIntersection === key ? 0 : unavailable('Intersection output is missing.');
  const volume = result.volume;
  if (volume === null) return unavailable('Intersection volume is unavailable.');
  return Number.isFinite(volume) && volume >= 0 ? volume : unavailable('Intersection volume is invalid.');
}

/** Check the selected pairs against the existing bounds and volume thresholds. */
export async function checkInterferencePairs(doc: StudioDoc, bodies: readonly BodyResult[], volumes: (probe: StudioDoc) => Promise<VolumeReply>, current = () => true): Promise<InterferenceReport | null> {
  const report: InterferenceReport = { pairs: bodies.length * (bodies.length - 1) / 2, clashes: [], failures: [] };
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    if (!current()) return null;
    const a = bodies[i], b = bodies[j], A = a.mesh.bounds, B = b.mesh.bounds;
    if ([0, 1, 2].some(k => A.max[k] <= B.min[k] + 1e-6 || B.max[k] <= A.min[k] + 1e-6)) continue;
    const pair = { a: a.key, b: b.key };
    try {
      const probe = withNode(doc, { kind: 'intersect', left: refOf(a), right: refOf(b) });
      const reply = await volumes(probe);
      if (!current()) return null;
      const result = intersectionVolume(reply, bodyKeyFor(probe.nodes, probe.nodes.length - 1));
      if (typeof result !== 'number') report.failures.push({ ...pair, error: result });
      else if (result > minimumVolume) report.clashes.push({ ...pair, volume: result });
    } catch (cause) {
      if (!current()) return null;
      report.failures.push({ ...pair, error: friendlyCause(cause) });
    }
  }
  return current() ? report : null;
}
