import type { ComponentProps } from 'react';
import { gravityTorques } from '@barocss/cad-model/robot/dynamics';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { JointsPanel } from './JointsPanel';
import { gearLinesAt, poseKinematics } from '../state/useJoints';
import { useStoreValue, type ValueStore } from '../state/valueStore';
import { countRender } from '../devRenders';

/**
 * The Joints card as the pose changes (R1c (3b)): subscribed to the pose, so a joint played renders this card in each
 * frame, not the App. Its readout as the App's was: the pose's values (after forward kinematics), the gear pairs at it and
 * what each joint holds against gravity there.
 */
export function JointsPanelLive({ poseStore, tree, masses, ...rest }: Omit<ComponentProps<typeof JointsPanel>, 'values' | 'gears' | 'holding' | 'tree'> & {
  poseStore: ValueStore<Record<string, number>>;
  tree: JointTree;
  masses: Parameters<typeof gravityTorques>[1] | null;
}) {
  countRender('JointsPanelLive');
  const values = useStoreValue(poseStore), fk = poseKinematics(tree, values), shown = fk?.values ?? values;
  return <JointsPanel {...rest} tree={tree} values={shown} gears={gearLinesAt(tree, fk)} holding={masses ? gravityTorques(tree, masses, shown).torques : undefined} />;
}
