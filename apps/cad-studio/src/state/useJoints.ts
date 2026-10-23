import { useEffect, useMemo, useState } from 'react';
import { forwardKinematics, gearPairAt, sliderRange } from '@barocss/cad-model/robot/fk';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import type { WorkspaceMap } from '@barocss/cad-model/robot/workspace';

/**
 * The robot's joints as the studio shows them (R1c (3a), moved out of App as it was): the joint-slider pose (RM2, a
 * preview only — the instances shown moved by forward kinematics, nothing saved), the joint played, the path checked, the
 * waypoints recorded (RM9a) and the workspace map shown (RM9b), with the pose's forward kinematics and its gear pairs.
 */
export function useJoints(jointTree: JointTree | null) {
  const [jointValues, setJointValues] = useState<Record<string, number>>({});
  const [jointPlaying, setJointPlaying] = useState<string | null>(null);
  const [pathCheck, setPathCheck] = useState<{ text: string; contact: boolean } | null>(null);
  // (RM9a: the waypoints recorded for Check path, a preview like the pose; nothing saved.)
  const [jointWaypoints, setJointWaypoints] = useState<Record<string, number>[]>([]);
  // (RM9b: the workspace map shown, a preview; nothing saved.)
  const [workspace, setWorkspace] = useState<WorkspaceMap | null>(null);
  // (A path checked is for the pose it was checked to: moving a joint clears it.)
  useEffect(() => setPathCheck(null), [jointValues, jointTree]);
  useEffect(() => { setJointWaypoints([]); setWorkspace(null); }, [jointTree]);
  const jointFk = useMemo(() => jointTree && Object.values(jointValues).some(v => v !== 0) ? forwardKinematics(jointTree, jointValues) : null, [jointTree, jointValues]);
  const gearLines = useMemo(() => (jointTree?.couplings ?? []).map(c => { const at = gearPairAt(c, jointFk?.values ?? {}), home = gearPairAt(c, {}), d = Math.abs(at.phaseDeg - home.phaseDeg); return { leader: c.leader, follower: c.follower, multiplier: c.multiplier, held: Math.min(d, 360 / c.g2.spec.teeth - d) < 1e-6, backlashMM: at.backlashMM }; }), [jointTree, jointFk]);
  // (Joints gone from the tree lose their values; a joint played swings through its range, a period of 4 s.)
  useEffect(() => { const keys = new Set(jointTree?.joints.map(j => j.key) ?? []); setJointValues(v => Object.keys(v).every(k => keys.has(k)) ? v : Object.fromEntries(Object.entries(v).filter(([k]) => keys.has(k)))); if (jointPlaying && !keys.has(jointPlaying)) setJointPlaying(null); }, [jointTree]);
  useEffect(() => {
    const j = jointPlaying ? jointTree?.joints.find(x => x.key === jointPlaying) : undefined;
    if (!j) return;
    const r = sliderRange(j), mid = (r.min + r.max) / 2, amp = (r.max - r.min) / 2, t0 = performance.now();
    let frame = requestAnimationFrame(function step(now) { setJointValues(v => ({ ...v, [j.key]: mid + amp * Math.sin(2 * Math.PI * (now - t0) / 4000) })); frame = requestAnimationFrame(step); });
    return () => cancelAnimationFrame(frame);
  }, [jointPlaying, jointTree]);
  return { jointValues, setJointValues, jointPlaying, setJointPlaying, pathCheck, setPathCheck, jointWaypoints, setJointWaypoints, workspace, setWorkspace, jointFk, gearLines };
}
