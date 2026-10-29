import { convexHull } from '@barocss/cad';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { BASE } from '@barocss/cad-model/assembly/mates';
import { motionOf } from '@barocss/cad-model/robot/motion';
import { sweepLinks } from '@barocss/cad-model/robot/sweep';
import { sweepTimed } from '@barocss/cad-model/robot/ccd';
import { workspaceMap } from '@barocss/cad-model/robot/workspace';
import { JointsPanelLive } from '../ui/JointsPanelLive';
import { draftPath, pathLimits, refuseMotionSweep, timedMotion, type LoopMotionContext } from '../state/motion';
import { poseKinematics, type useJoints } from '../state/useJoints';
import { downloadBytes } from '../ui/files';
import type { RobotExportController } from './useRobotExports';

export interface RobotInspectorChanges {
  canChangeDocument(): boolean;
  pushUndo(): void;
  setDoc(next: StudioDoc): boolean;
  setDirty(dirty: boolean): void;
}

export interface RobotInspectorProps {
  controller: RobotExportController;
  motion: ReturnType<typeof useJoints>;
  loopMotionContext?: LoopMotionContext;
  chosenMotion: { duration?: number; problem?: string };
  video: { busy: boolean; record(seconds: number, draw: (time: number) => void, name: string): Promise<void> };
  changes: RobotInspectorChanges;
}

/** Existing joints/motion inspector, using the assembly's robot export controller. */
export function RobotInspector({ controller, motion: joints, loopMotionContext, chosenMotion, video, changes }: RobotInspectorProps) {
  const { model: { doc, bodies, instanceBodies }, fileName, onNotice: setToast, jointTree, robotReady, linkInertias, jointMasses,
    reportMotionError, exportUrdfFile, exportMjcfFile, exportSdfFile, exportUsdFile } = controller;
  const { poseStore, jointInputStore, readJointInputs, setJointValues, jointPlaying, setJointPlaying, pathCheck, setPathCheck,
    jointWaypoints, setJointWaypoints, workspace, setWorkspace, motionTime, motion, motionPlaying, setMotionPlaying,
    motionLoop, setMotionLoop, motionSpeed, setMotionSpeed, playMotion, scrubMotion, stopMotion, motionChoice,
    setMotionChoice, freezeMotion, showMotionAt, motionContact, contactShown } = joints;
  const { busy: videoBusy, record: recordVideo } = video;
  const { canChangeDocument, pushUndo, setDoc, setDirty } = changes;
  if (!jointTree) return null;
  return <JointsPanelLive poseStore={poseStore} tree={jointTree} masses={jointMasses} instances={doc.instances ?? []}
        onValue={(k, v) => { stopMotion(); setJointPlaying(null); setJointValues(x => ({ ...x, [k]: v })); }} onHome={() => { stopMotion(); setJointPlaying(null); setJointValues({}); }} playing={jointPlaying} onPlay={k => { stopMotion(); setJointPlaying(k); }} links={linkInertias}
        motionState={{ time: motionTime, inputs: jointInputStore, context: loopMotionContext, motion, waypoints: jointWaypoints, playing: motionPlaying, loop: motionLoop, speed: motionSpeed,
          contact: contactShown && motionContact ? `Contact ${jointTree.links.find(x => x.id === motionContact.links[0])?.name ?? motionContact.links[0]} – ${jointTree.links.find(x => x.id === motionContact.links[1])?.name ?? motionContact.links[1]} at t ${motionContact.toi.toFixed(2)} s` : null,
          chosenDuration: chosenMotion.duration, chosenProblem: chosenMotion.problem,
          controls: { onPlay: playMotion, onPause: () => setMotionPlaying(false), onTime: scrubMotion, onLoop: setMotionLoop, onSpeed: setMotionSpeed,
            onExportVideo: () => { const m = freezeMotion(); if (!m) return; setMotionPlaying(false); void recordVideo(m.duration, t => showMotionAt(m, t), `${fileName}-${motionChoice ?? 'motion'}.webm`); }, exporting: videoBusy,
            saved: (doc.robot?.motions ?? []).map(m => m.name), choice: motionChoice, onChoose: setMotionChoice,
            // (The draft kept in the document: replacing one of the same name; an undo step, the file dirty.)
            onSave: name => {
              let path; try {
                const draft = draftPath(jointTree, jointWaypoints, readJointInputs());
                if (jointTree.loops.length) timedMotion(draft, loopMotionContext);
                path = motionOf(jointTree, draft);
              } catch (e) { setToast({ title: 'Could not save the motion', hint: e instanceof Error ? e.message : String(e), detail: '' }); return; }
              if (!canChangeDocument()) return;
              const robot = { ...(doc.robot ?? { version: 1 as const }) };
              robot.motions = [...(robot.motions ?? []).filter(m => m.name !== name), { name, path }];
              pushUndo(); if (!setDoc({ ...doc, robot })) return; setDirty(true); setMotionChoice(name);
            } } }}
        onExportUrdf={exportUrdfFile}
        waypoints={jointWaypoints.length} onAddWaypoint={() => {
          const v = readJointInputs();
          try {
            if (jointTree.loops.length) timedMotion(draftPath(jointTree, jointWaypoints, v), loopMotionContext);
            const fk = jointTree.loops.length ? null : poseKinematics(jointTree, v);
            setJointWaypoints(w => [...w, { ...(fk?.values ?? v) }]);
          } catch (error) { reportMotionError(error); }
        }} onClearWaypoints={() => { setJointWaypoints([]); setPathCheck(null); }}
        onWorkspace={(n, h, free) => {
          // (RM9b: the deepest link's joint point over the joints' ranges; a slide without limits refused, said so.)
          const depth = (l: string): number => { const j = jointTree.joints.find(x => x.child === l); return j ? 1 + depth(j.parent) : 0; }, end = jointTree.links.reduce((b, l) => depth(l.id) > depth(b.id) ? l : b, jointTree.links[0]).id;
          try {
            // (The tool point: the end link's farthest hull point from its joint at the solved pose — its tip.)
            const links = sweepLinks(jointTree, p => p === BASE ? bodies : instanceBodies.get(p)?.bodies, pts => convexHull(pts).positions), own = jointTree.joints.find(j => j.child === end)?.origin ?? [0, 0, 0];
            const hull = links.find(l => l.link === end)?.hull; let tool: number[] | undefined, far = -1;
            if (hull) for (let i = 0; i < hull.length; i += 3) { const d = Math.hypot(hull[i] - own[0], hull[i + 1] - own[1], hull[i + 2] - own[2]); if (d > far) { far = d; tool = [hull[i], hull[i + 1], hull[i + 2]]; } }
            setWorkspace(workspaceMap(jointTree, { link: end, samples: n, h, ...(tool ? { tool } : {}), ...(free ? { links } : {}) }));
          } catch (e) { setToast({ title: 'Workspace not mapped', hint: e instanceof Error ? e.message.replace(/^\[[A-Z_]+\] /, '') : String(e), detail: '' }); }
        }}
        workspace={workspace ? `Workspace of ${workspace.samples} poses${workspace.excluded ? ` (${workspace.excluded} in self-contact left out)` : ''}: ${workspace.voxels.length} voxels of ${workspace.h} mm, reach ${workspace.reach.toFixed(1)} mm, best manipulability ${Math.max(0, ...workspace.voxels.map(v => v.w)).toExponential(3)}` : null}
        onWorkspaceDownload={() => workspace && downloadBytes(new TextEncoder().encode(JSON.stringify(workspace)), `${fileName}-workspace.json`, 'application/json')}
        onWorkspaceHide={() => setWorkspace(null)}
        path={pathCheck} ready={robotReady}
        onCheckPath={() => {
          try { refuseMotionSweep(jointTree); }
          catch (error) { setToast({ title: 'Path check refused', hint: error instanceof Error ? error.message : String(error), detail: '' }); return; }
          // (RM6, RM9a: the timed path from the solved pose through the waypoints to the sliders', the links as placed; each
          // segment a trapezoid within the joints' velocity limits — 1 rad/s or 100 mm/s where none is set — and twice that
          // per second's acceleration; the whole path certified, or its time of impact.)
          const links = sweepLinks(jointTree, p => p === BASE ? bodies : instanceBodies.get(p)?.bodies, pts => convexHull(pts).positions);
          const { limits, assumed } = pathLimits(jointTree);
          const r = sweepTimed(jointTree, links, { waypoints: [{}, ...jointWaypoints, poseStore.get()], profile: 'trapezoid', limits });
          const name = (l: string) => jointTree.links.find(x => x.id === l)?.name ?? l, total = r.segments.reduce((t, g) => t + g.duration, 0), n = r.segments.length;
          const note = assumed.length ? `; no velocity limit on ${assumed.join(', ')}: 1 rad/s (100 mm/s) taken` : '';
          setPathCheck(r.toi !== undefined ? { contact: true, text: `Contact ${name(r.links![0])} – ${name(r.links![1])} at ${(total > 0 ? r.toi / total * 100 : 0).toFixed(1)} % of the move, t ${r.toi.toFixed(3)} s${n > 1 ? ` (segment ${r.segment! + 1} of ${n})` : ''} (${r.samples} steps${note})` }
            : { contact: false, text: `Clear: the whole move certified, ${total.toFixed(3)} s${n > 1 ? ` over ${n} segments` : ''} (${r.samples} steps${note})${r.minClearance ? `; least clearance ${r.minClearance.mm.toFixed(2)} mm at t ${r.minClearance.t.toFixed(3)} s, ${name(r.minClearance.links[0])} – ${name(r.minClearance.links[1])}` : ''}` });
        }}
        onExportMjcf={exportMjcfFile}
        onExportSdf={exportSdfFile}
        onExportUsd={exportUsdFile}
        onBase={b => { if (!canChangeDocument()) return; const robot = { ...(doc.robot ?? { version: 1 as const }) }; if (b === BASE) delete robot.base; else robot.base = b; pushUndo(); if (!setDoc({ ...doc, robot })) return; setDirty(true); }} />;
}
