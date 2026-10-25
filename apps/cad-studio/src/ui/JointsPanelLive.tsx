import type { ComponentProps } from 'react';
import { gravityTorques } from '@barocss/cad-model/robot/dynamics';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { framePoses } from '@barocss/cad-model/robot/frames';
import type { FkResult } from '@barocss/cad-model/robot/fk';
import { JointsPanel, type FrameReadout, type MotionControls } from './JointsPanel';
import { draftPath, timedMotion, type LoopMotionContext, type Motion } from '../state/motion';
import { gearLinesAt, poseKinematics } from '../state/useJoints';
import { createValueStore, useStoreValue, type ValueStore } from '../state/valueStore';
import { countRender } from '../devRenders';

/**
 * The Joints card as the pose changes (R1c (3b)): subscribed to the pose, so a joint played renders this card in each
 * frame, not the App. Its readout as the App's was: the pose's values (after forward kinematics), the gear pairs at it and
 * what each joint holds against gravity there; each tool and sensor frame where the pose puts it (O12).
 */
export function JointsPanelLive({ poseStore, tree, masses, motionState, ...rest }: Omit<ComponentProps<typeof JointsPanel>, 'values' | 'gears' | 'holding' | 'tree' | 'motion'> & {
  poseStore: ValueStore<Record<string, number>>;
  tree: JointTree;
  masses: Parameters<typeof gravityTorques>[1] | null;
  /** The motion (RS2): its time's store, the one frozen (null: the draft not yet frozen), the draft's waypoints, the play
   *  state and a contact reached; the time follows here, so a frame of the motion renders this card, not the App. */
  motionState?: { time: ValueStore<number>; inputs: ValueStore<Record<string, number>>; context?: LoopMotionContext; motion: Motion | null; waypoints: readonly Record<string, number>[]; playing: boolean; loop: boolean; speed: number; contact: string | null; controls: MotionControls;
    /** The saved motion chosen's length (s), before it is frozen. */
    chosenDuration?: number; chosenProblem?: string };
}) {
  countRender('JointsPanelLive');
  const values = useStoreValue(poseStore), fk = poseKinematics(tree, values), shown = fk?.values ?? values;
  const inputs = useStoreValue(motionState?.inputs ?? poseStore);
  const t = useStoreValue(motionState?.time ?? NO_TIME), m = motionState;
  // (The draft's length before it is frozen: from home through the waypoints to the pose shown; none away from home.)
  const draft = m && !m.motion && m.controls.choice === null && (m.waypoints.length || Object.values(inputs).some(v => v !== 0))
    ? draftDuration(tree, m.waypoints, tree.loops.length ? inputs : shown, m.context) : undefined;
  const duration = !m ? 0 : m.motion ? m.motion.duration : m.controls.choice !== null ? m.chosenDuration ?? 0 : draft?.duration ?? 0;
  const problem = m?.controls.choice !== null ? m?.chosenProblem : draft?.problem;
  const motion = m && (m.motion || duration > 0 || m.controls.saved.length || problem) ? { t, duration, playing: m.playing, loop: m.loop, speed: m.speed, contact: m.contact } : null;
  return <><JointsPanel {...rest} tree={tree} values={shown} gears={gearLinesAt(tree, fk)} frames={frameReadouts(tree, fk)} holding={masses ? gravityTorques(tree, masses, shown).torques : undefined}
    motion={motion} motionControls={m?.controls} />
    {problem && <div className="hud-error" role="alert">Motion refused: {problem}</div>}</>;
}
const NO_TIME = createValueStore(0);
/** The draft motion's length (s), 0 when it can't be timed. */
function draftDuration(tree: JointTree, waypoints: readonly Record<string, number>[], pose: Record<string, number>, context?: LoopMotionContext): { duration: number; problem?: string } {
  try { return { duration: timedMotion(draftPath(tree, waypoints, pose), context).duration }; }
  catch (error) { return { duration: 0, problem: error instanceof Error ? error.message : String(error) }; }
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
