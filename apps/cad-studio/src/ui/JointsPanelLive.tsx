import type { ComponentProps } from 'react';
import { gravityTorques } from '@barocss/cad-model/robot/dynamics';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { framePoses } from '@barocss/cad-model/robot/frames';
import type { FkResult } from '@barocss/cad-model/robot/fk';
import { JointsPanel, type FrameReadout } from './JointsPanel';
import { gearLinesAt, poseKinematics } from '../state/useJoints';
import { useStoreValue, type ValueStore } from '../state/valueStore';
import { countRender } from '../devRenders';

/**
 * The Joints card as the pose changes (R1c (3b)): subscribed to the pose, so a joint played renders this card in each
 * frame, not the App. Its readout as the App's was: the pose's values (after forward kinematics), the gear pairs at it and
 * what each joint holds against gravity there; each tool and sensor frame where the pose puts it (O12).
 */
export function JointsPanelLive({ poseStore, tree, masses, ...rest }: Omit<ComponentProps<typeof JointsPanel>, 'values' | 'gears' | 'holding' | 'tree'> & {
  poseStore: ValueStore<Record<string, number>>;
  tree: JointTree;
  masses: Parameters<typeof gravityTorques>[1] | null;
}) {
  countRender('JointsPanelLive');
  const values = useStoreValue(poseStore), fk = poseKinematics(tree, values), shown = fk?.values ?? values;
  return <JointsPanel {...rest} tree={tree} values={shown} gears={gearLinesAt(tree, fk)} frames={frameReadouts(tree, fk)} holding={masses ? gravityTorques(tree, masses, shown).torques : undefined} />;
}

/** The frames at a pose: FK's link motions, or the solved pose's own (no slider moved). */
function frameReadouts(tree: JointTree, fk: FkResult | null): FrameReadout[] | undefined {
  if (!tree.frames?.length) return undefined;
  const at = fk ? framePoses(tree, fk.motions) : null, out: FrameReadout[] = [];
  for (const f of tree.frames) {
    const p = at ? at.get(f.name) : f; if (!p) continue;
    out.push({ name: f.name, link: f.link, kind: f.kind, o: p.o, z: [p.R[2], p.R[5], p.R[8]] });
  }
  return out;
}
