import { useCallback, useMemo } from 'react';
import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { BASE } from '@barocss/cad-model/assembly/mates';
import { jointTreeOf } from '@barocss/cad-model/robot/joints';
import { treeInertia } from '@barocss/cad-model/robot/inertia';
import { linkMasses } from '@barocss/cad-model/robot/dynamics';
import { exportUrdf } from '@barocss/cad-model/robot/urdf';
import { exportMjcf, type MjcfClosure } from '@barocss/cad-model/robot/mjcf';
import { exportSdf } from '@barocss/cad-model/robot/sdf';
import { exportUsd } from '@barocss/cad-model/robot/usd';
import { closureOfDoc } from '@barocss/cad-model/robot/loop';
import { sourceBytes, sourceRecord } from '@barocss/cad-model/team/source';
import { writeZip } from '@barocss/cad-model/io/zip';
import type { Assembly } from '../assembly/useAssembly';
import { instanceEvaluationCurrent, type InstanceEvaluationSource } from '../viewport/instanceEvaluation';
import { downloadBytes } from '../ui/files';

export interface RobotModelContext {
  doc: StudioDoc;
  bodies: BodyResult[];
  instanceBodies: ReadonlyMap<string, { inst: PartInstance; sourceKey: string; bodies: BodyResult[] }>;
  instanceSources: ReadonlyMap<string, InstanceEvaluationSource>;
  fresh: boolean;
  busy: boolean;
  massReady: boolean;
}

export interface RobotExportOptions {
  model: RobotModelContext;
  assembly: Pick<Assembly, 'problems' | 'tables'>;
  fileName: string;
  onNotice(notice: FriendlyError): void;
}

/** Robot calculations and file exports of the solved, currently evaluated assembly. */
export function useRobotExports({ model, assembly, fileName, onNotice }: RobotExportOptions) {
  const { doc, bodies, instanceBodies, instanceSources, fresh, busy, massReady } = model;
  // The assembly as a robot (RM1): its joint tree from the solved instances, the faces read, the parts' gears.
  const jointTree = useMemo(() => !doc.mates?.length || !doc.instances?.length ? null : jointTreeOf(doc, { instances: doc.instances, problems: assembly.problems }, p => assembly.tables.get(p),
    p => (p === BASE ? bodies : instanceBodies.get(p)?.bodies ?? []).flatMap(b => (b.gear ? [b.gear] : []))), [doc, assembly.problems, assembly.tables, bodies, instanceBodies]);
  // (Every placed part evaluated with its bodies: until then the robot's masses, exports and sweeps wait, RM6 — a part
  // not yet evaluated is not massless.)
  const robotReady = fresh && !busy && massReady && (doc.instances ?? []).every(i => instanceEvaluationCurrent(instanceBodies.get(i.id), i, instanceSources.get(i.id)));
  // Each link's mass properties (RM3): the bodies as placed (world), so each part's placement is the identity here.
  const linkInertias = useMemo(() => !jointTree || !robotReady ? undefined : treeInertia(jointTree, p => {
    if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] };
    const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p);
    return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null;
  }), [jointTree, doc, bodies, instanceBodies, robotReady]);
  // What each joint holds against gravity at the pose shown (RD1): the masses as placed (world), identity placements.
  const jointMasses = useMemo(() => !jointTree || !robotReady ? null : linkMasses(jointTree, p => {
    if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] };
    const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p);
    return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null;
  }), [jointTree, robotReady, doc, bodies, instanceBodies]);
  const reportMotionError = useCallback((error: unknown) => {
    onNotice({ title: 'Motion refused', hint: error instanceof Error ? error.message : String(error), detail: '' });
  }, [onNotice]);
  /** A robot part for the exports (RM4–RM9c): the bodies as placed, so each part's placement is the identity here. */
  const robotPartOf = (p: string) => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; };
  /** The tree's planar loops closed at their pins (RM8), those that are not left out (the exports note them). */
  const robotClosures = (): MjcfClosure[] => { const out: MjcfClosure[] = []; if (jointTree) for (const l of jointTree.loops) { try { out.push(closureOfDoc(doc, jointTree, l)); } catch { /* not planar: noted */ } } return out; };
  const exportUrdfFile = () => {
    if (!jointTree) return;
    // (RM4: the bodies as placed, so each part's placement is the identity here; the same robot as from part coordinates.)
    const r = exportUrdf(jointTree, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; }, fileName);
    if (!r.ok) { onNotice({ title: 'URDF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
    void writeZip([{ name: 'robot.urdf', data: new TextEncoder().encode(r.urdf), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true })), { name: 'robot.source.json', data: sourceBytes(sourceRecord(doc, ['robot.urdf', ...r.files.map(f => f.path)], { robot: true })), deflate: true }]).then(z => downloadBytes(z, `${fileName}-urdf.zip`, 'application/zip'));
    if (r.notes.length) onNotice({ title: 'URDF written', hint: r.notes.join(' '), detail: '' });
  };
  const exportMjcfFile = () => {
    if (!jointTree) return;
    // (RM5: as the URDF, the same parts; robot.xml and its meshes.)
    const r = exportMjcf(jointTree, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; }, fileName);
    if (!r.ok) { onNotice({ title: 'MJCF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
    void writeZip([{ name: 'robot.xml', data: new TextEncoder().encode(r.xml), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true })), { name: 'robot.source.json', data: sourceBytes(sourceRecord(doc, ['robot.xml', ...r.files.map(f => f.path)], { robot: true })), deflate: true }]).then(z => downloadBytes(z, `${fileName}-mjcf.zip`, 'application/zip'));
  };
  const exportSdfFile = () => {
    if (!jointTree) return;
    // (RM9c: as the URDF and MJCF, the same parts; each planar loop closed at its pin, RM8.)
    const r = exportSdf(jointTree, robotPartOf, fileName, robotClosures());
    if (!r.ok) { onNotice({ title: 'SDF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
    void writeZip([{ name: 'robot.sdf', data: new TextEncoder().encode(r.sdf), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true })), { name: 'robot.source.json', data: sourceBytes(sourceRecord(doc, ['robot.sdf', ...r.files.map(f => f.path)], { robot: true })), deflate: true }]).then(z => downloadBytes(z, `${fileName}-sdf.zip`, 'application/zip'));
    if (r.notes.length) onNotice({ title: 'SDF written', hint: r.notes.join(' '), detail: '' });
  };
  const exportUsdFile = () => {
    if (!jointTree) return;
    const r = exportUsd(jointTree, robotPartOf, fileName, robotClosures());
    if (!r.ok) { onNotice({ title: 'USD refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
    downloadBytes(new TextEncoder().encode(r.usda), `${fileName}.usda`, 'model/vnd.usda');
    downloadBytes(sourceBytes(sourceRecord(doc, [`${fileName}.usda`], { robot: true })), `${fileName}.source.json`, 'application/json');
    if (r.notes.length) onNotice({ title: 'USD written', hint: r.notes.join(' '), detail: '' });
  };
  return { model, fileName, onNotice, jointTree, robotReady, linkInertias, jointMasses,
    reportMotionError, exportUrdfFile, exportMjcfFile, exportSdfFile, exportUsdFile };
}

export type RobotExportController = ReturnType<typeof useRobotExports>;
