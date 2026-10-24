import { useCallback, useEffect, useMemo, useState } from 'react';
import { createValueStore, useStoreValue } from './valueStore';
import { forwardKinematics, gearPairAt, sliderRange } from '@barocss/cad-model/robot/fk';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import type { WorkspaceMap } from '@barocss/cad-model/robot/workspace';
import { timedPathOf, type Motion as SavedMotion } from '@barocss/cad-model/robot/motion';
import { draftPath, motionPose, timedMotion, type Motion } from './motion';

/**
 * The robot's joints as the studio shows them (R1c (3a), moved out of App as it was): the joint-slider pose (RM2, a
 * preview only — the instances shown moved by forward kinematics, nothing saved), the joint played, the path checked, the
 * waypoints recorded (RM9a) and the workspace map shown (RM9b), with the pose's forward kinematics.
 *
 * R1c (3b): the pose lives in `poseStore`, outside React state. A joint played sets it in each frame, and only the
 * viewport (SceneViewport) and the Joints card's readout (JointsPanelLive) subscribe. The App reads it as it is when it
 * renders, and subscribes only while `subscribed` (a CPU section or the clearance check follows the pose there).
 */
export function useJoints(jointTree: JointTree | null, subscribed: boolean, savedMotions?: readonly SavedMotion[]) {
  const poseStore = useMemo(() => createValueStore<Record<string, number>>({}), []);
  const jointValues = useStoreValue(poseStore, subscribed), setJointValues = poseStore.set;
  const [jointPlaying, setJointPlaying] = useState<string | null>(null);
  const [pathCheck, setPathCheck] = useState<{ text: string; contact: boolean } | null>(null);
  // (RM9a: the waypoints recorded for Check path, a preview like the pose; nothing saved.)
  const [jointWaypoints, setJointWaypoints] = useState<Record<string, number>[]>([]);
  // (RM9b: the workspace map shown, a preview; nothing saved.)
  const [workspace, setWorkspace] = useState<WorkspaceMap | null>(null);
  // (A path checked is for the pose it was checked to: moving a joint clears it — the store says when, a frame or not.)
  useEffect(() => setPathCheck(null), [jointTree]);
  useEffect(() => poseStore.subscribe(() => setPathCheck(null)), [poseStore]);
  useEffect(() => { setJointWaypoints([]); setWorkspace(null); }, [jointTree]);
  const jointFk = useMemo(() => jointTree && Object.values(jointValues).some(v => v !== 0) ? forwardKinematics(jointTree, jointValues) : null, [jointTree, jointValues]);
  // (Joints gone from the tree lose their values; a joint played swings through its range, a period of 4 s.)
  useEffect(() => { const keys = new Set(jointTree?.joints.map(j => j.key) ?? []); setJointValues(v => Object.keys(v).every(k => keys.has(k)) ? v : Object.fromEntries(Object.entries(v).filter(([k]) => keys.has(k)))); if (jointPlaying && !keys.has(jointPlaying)) setJointPlaying(null); }, [jointTree]);
  useEffect(() => {
    const j = jointPlaying ? jointTree?.joints.find(x => x.key === jointPlaying) : undefined;
    if (!j) return;
    const r = sliderRange(j), mid = (r.min + r.max) / 2, amp = (r.max - r.min) / 2, t0 = performance.now();
    let frame = requestAnimationFrame(function step(now) { setJointValues(v => ({ ...v, [j.key]: mid + amp * Math.sin(2 * Math.PI * (now - t0) / 4000) })); frame = requestAnimationFrame(step); });
    return () => cancelAnimationFrame(frame);
  }, [jointPlaying, jointTree]);
  // (RS2: the motion played — the draft path, home through the waypoints to the pose shown, frozen as Play starts or the
  // scrubber moves — its time in a store of its own, so a frame renders the Joints card's live part and the viewport,
  // never the App. A slider moved, Home, or the waypoints changed stop it; nothing is saved.)
  const motionTime = useMemo(() => createValueStore(0), []);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [motionPlaying, setMotionPlaying] = useState(false), [motionLoop, setMotionLoop] = useState(false), [motionSpeed, setMotionSpeed] = useState(1);
  // (Which motion plays: the draft (null), or one the document saves by name — RobotSettings.motions, in degrees and mm,
  // timed as a radians path by the core's timedPathOf.)
  const [motionChoice, setMotionChoice] = useState<string | null>(null);
  const savedChoice = motionChoice === null ? undefined : savedMotions?.find(m => m.name === motionChoice);
  // (Its first contact — the time of impact and the two links, swept by the App, which has the bodies — and whether the
  // time shown is past it: set as t crosses it, so the App renders at the crossing, not in each frame.)
  const [motionContact, setMotionContact] = useState<{ toi: number; links: [string, string] } | null>(null);
  const [contactShown, setContactShown] = useState(false);
  useEffect(() => {
    const c = motionContact; let shown = false; setContactShown(false);
    if (!c) return;
    const check = () => { const v = motionTime.get() >= c.toi; if (v !== shown) { shown = v; setContactShown(v); } };
    check(); return motionTime.subscribe(check);
  }, [motionContact, motionTime]);
  const stopMotion = useCallback(() => { setMotionPlaying(false); setMotion(null); setMotionContact(null); motionTime.set(0); }, [motionTime]);
  useEffect(stopMotion, [jointTree, jointWaypoints, motionChoice, savedChoice, stopMotion]);
  // (A saved motion gone from the document: back to the draft.)
  useEffect(() => { if (motionChoice !== null && !savedChoice) setMotionChoice(null); }, [motionChoice, savedChoice]);
  /** The motion to play: the one frozen, or the draft path frozen now (null when it can't be timed). */
  const frozenMotion = useCallback((): Motion | null => {
    if (motion) return motion;
    if (!jointTree) return null;
    try {
      const m = timedMotion(savedChoice ? timedPathOf(jointTree, savedChoice.path) : draftPath(jointTree, jointWaypoints, poseStore.get()));
      setMotion(m); return m;
    } catch { return null; }
  }, [motion, jointTree, savedChoice, jointWaypoints, poseStore]);
  const playMotion = useCallback(() => {
    const m = frozenMotion(); if (!m || !(m.duration > 0)) return;
    if (motionTime.get() >= m.duration) motionTime.set(0);
    setJointPlaying(null); setMotionPlaying(true);
  }, [frozenMotion, motionTime]);
  const scrubMotion = useCallback((t: number) => {
    const m = frozenMotion(); if (!m) return;
    setMotionPlaying(false); setJointPlaying(null);
    const at = Math.min(m.duration, Math.max(0, t)); motionTime.set(at); if (jointTree) setJointValues(motionPose(jointTree, m, at));
  }, [frozenMotion, motionTime, setJointValues, jointTree]);
  /** A motion's pose shown at t, and its time (the video export steps it frame by frame). */
  const showMotionAt = useCallback((m: Motion, t: number) => {
    if (!jointTree) return;
    motionTime.set(t); setJointValues(motionPose(jointTree, m, t));
  }, [jointTree, motionTime, setJointValues]);
  useEffect(() => {
    if (!motionPlaying || !motion || !jointTree) return;
    const T = motion.duration, tree = jointTree;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      let t = motionTime.get() + (now - last) / 1000 * motionSpeed, more = true; last = now;
      if (t >= T) { if (motionLoop && T > 0) t %= T; else { t = T; more = false; setMotionPlaying(false); } }
      motionTime.set(t); setJointValues(motionPose(tree, motion, t));
      if (more) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [motionPlaying, motion, motionLoop, motionSpeed, motionTime, setJointValues, jointTree]);
  return { poseStore, jointValues, setJointValues, jointPlaying, setJointPlaying, pathCheck, setPathCheck, jointWaypoints, setJointWaypoints, workspace, setWorkspace, jointFk,
    motionTime, motion, motionPlaying, setMotionPlaying, motionLoop, setMotionLoop, motionSpeed, setMotionSpeed, playMotion, scrubMotion, stopMotion, motionChoice, setMotionChoice, freezeMotion: frozenMotion, showMotionAt,
    motionContact, setMotionContact, contactShown };
}

/** The pose's forward kinematics, as the App's was (null at home): for the subscribers that follow the pose each frame. */
export function poseKinematics(jointTree: JointTree | null, values: Record<string, number>) {
  return jointTree && Object.values(values).some(v => v !== 0) ? forwardKinematics(jointTree, values) : null;
}
/** The gear pairs at a pose (as the Joints card shows them). */
export function gearLinesAt(jointTree: JointTree | null, jointFk: ReturnType<typeof poseKinematics>) {
  return (jointTree?.couplings ?? []).map(c => { const at = gearPairAt(c, jointFk?.values ?? {}), home = gearPairAt(c, {}), d = Math.abs(at.phaseDeg - home.phaseDeg); return { leader: c.leader, follower: c.follower, multiplier: c.multiplier, held: Math.min(d, 360 / c.g2.spec.teeth - d) < 1e-6, backlash: at.backlash }; });
}
