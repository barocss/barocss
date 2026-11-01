import { useMemo } from 'react';
import { placedBase, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { bodyName } from '@barocss/cad-model/app/bodies';
import { lookPathKey, lookTargetsOf, looksOf, looksOnFold, type EffectiveLook, type LookTarget } from '@barocss/cad-model/assembly/looks';
import { renderLooksOf, type InstanceRenderLooks } from '../viewport/instanceLook';

// Roadmap 10 ① — what the placed parts look like. A sub-assembly's folded bodies carry the folded ids, not the look keys their
// parts keep them under: where each body comes from (the nested part and its look key) is found once per evaluation, from the
// nodes it was evaluated from; the looks themselves are resolved whenever the instances change (no evaluation, no geometry).

/** A placed occurrence's bodies as the looks name them. */
interface PlacedLooks { targets: LookTarget[]; names: string[] }
const found = new WeakMap<readonly BodyResult[], PlacedLooks>();
/** Each body's look target and name, cached for as long as the evaluation's bodies are the same array. */
export function placedLooksOf(inst: PartInstance, parent: StudioDoc, bodies: readonly BodyResult[]): PlacedLooks {
  let out = found.get(bodies);
  if (out) return out;
  try {
    // (The worker keys a placed body by its origin output in the part unplaced — placedBase — so its ref indexes those nodes.)
    const placed = placedBase(inst, parent);
    out = { targets: lookTargetsOf(inst, placed.nodes, bodies), names: bodies.map(b => bodyName(placed, b)) };
  } catch {
    // (A part that cannot be folded draws as the base colour: its looks have nowhere to be read from.)
    out = { targets: bodies.map(b => ({ path: [], key: b.key })), names: bodies.map(b => b.key) };
  }
  found.set(bodies, out);
  return out;
}

/** One body (or nested part's body) of an occurrence as the panel lists it: the key a look is set by, its name, its effective look. */
export interface InstanceLookRow { key: string; name: string; look: EffectiveLook }
/** The rows of an occurrence's bodies (a key once, even when several bodies share it). */
export function instanceLookRows(inst: PartInstance, entry: { bodies: BodyResult[] } | undefined, parent: StudioDoc): InstanceLookRow[] {
  if (!entry) return [];
  const placed = placedLooksOf(inst, parent, entry.bodies), looks = looksOf(inst, placed.targets), seen = new Set<string>(), rows: InstanceLookRow[] = [];
  placed.targets.forEach((t, k) => { const key = lookPathKey(t.path, t.key); if (!seen.has(key)) { seen.add(key); rows.push({ key, name: placed.names[k], look: looks[k] }); } });
  return rows;
}

/** The viewer's looks of every placed occurrence, by instance id (an occurrence none of whose bodies has a look has no entry). */
export function useInstanceLooks(doc: StudioDoc, instanceBodies: ReadonlyMap<string, { inst: PartInstance; bodies: BodyResult[] }>): ReadonlyMap<string, InstanceRenderLooks> {
  return useMemo(() => {
    const out = new Map<string, InstanceRenderLooks>();
    for (const inst of doc.instances ?? []) {
      const entry = instanceBodies.get(inst.id); if (!entry) continue;
      // (The occurrence as the document has it now: looks change without the bodies being evaluated again.)
      const placed = placedLooksOf(entry.inst, doc, entry.bodies), looks = renderLooksOf(looksOnFold(inst, placed.targets), entry.bodies);
      if (looks) out.set(inst.id, looks);
    }
    return out;
  }, [doc.instances, instanceBodies, doc]);
}
