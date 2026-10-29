import { useMemo, useState } from 'react';
import { DEFAULT_REPAIR, type MeshDiagnosis, type MeshRepairResult, type MeshRepairSteps } from '@barocss/cad';
import { emptyDoc, withNode, type MeshRepairRecord, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { getBlob, meshNodeBlobs, positionsArray, putBlob } from '@barocss/cad-model/engine/blobs';
import { FACET_EXPLODE_TRIANGLES, FACET_PREVIEW_TRIANGLES, MESH_UNITS, meshInMM, type readMeshFile, type MeshUnit } from '@barocss/cad-model/engine/meshImport';
import type { EngineClient } from '../engine/client';

export interface MeshQuestion {
  name: string;
  format: 'STL' | 'OBJ';
  mesh: ReturnType<typeof readMeshFile>;
  unit: MeshUnit;
}

export interface MeshOpenInput {
  name: string;
  format?: string;
  unit: string;
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
  diagnosis: MeshDiagnosis;
  repair?: { steps: MeshRepairSteps; result: MeshRepairResult };
}

export interface RepairQuestion {
  mode: 'import' | 'edit';
  node?: number;
  name: string;
  format?: string;
  unit: string;
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
  diagnosis: MeshDiagnosis;
  steps: MeshRepairSteps;
  result: MeshRepairResult | null;
}

export interface MeshImportOptions {
  doc: StudioDoc;
  engine: EngineClient;
  nextRevision(): number;
  onNotice(notice: FriendlyError): void;
  /** The existing App replacement/name/dirty/fit sequence, called before the import notice. */
  onOpened(doc: StudioDoc, name: string): void;
  onCommit(next: StudioDoc, live: false): boolean;
}

/** Mesh units, worker diagnosis and recorded repair; central document acceptance stays in App. */
export function useMeshImport({ doc, engine, nextRevision, onNotice, onOpened, onCommit }: MeshImportOptions) {
  const [meshAsk, setMeshAsk] = useState<MeshQuestion | null>(null);
  const meshInUnit = useMemo(() => meshAsk && meshInMM(meshAsk.mesh, meshAsk.unit), [meshAsk]);
  /** What the worker is doing that the user waits on (checking or repairing a mesh): shown with its stage, stoppable. */
  const [stage, setStage] = useState<string | null>(null);
  const [repairAsk, setRepairAsk] = useState<RepairQuestion | null>(null);
  const stopStage = () => { engine.restart(); setStage(null); onNotice({ title: 'Stopped', hint: 'The mesh check or repair was stopped; nothing changed.', detail: '' }); };
  const openMesh = async () => {
    if (!meshAsk || !meshInUnit) return;
    const { name, format, unit } = meshAsk;
    setStage('checking the mesh');
    const d = await engine.diagnose(meshInUnit.positions, meshInUnit.indices);
    setStage(null);
    if ('error' in d) { if (d.error !== 'stopped') onNotice({ title: 'Could not read this mesh', hint: d.error, detail: '' }); return; }
    setMeshAsk(null);
    // (Anything a step would change, or crossings to say: the gate; else straight in.)
    if (!d.closed || d.degenerate || d.duplicates || d.floaters || d.selfIntersections) { setRepairAsk({ mode: 'import', name, format, unit, positions: meshInUnit.positions, indices: meshInUnit.indices, diagnosis: d, steps: DEFAULT_REPAIR, result: null }); return; }
    await openMeshNode({ name, format, unit, positions: meshInUnit.positions, indices: meshInUnit.indices, diagnosis: d });
  };
  /** The mesh node made (its import's blobs, a repair's beside them) and opened as the part. */
  const openMeshNode = async (o: MeshOpenInput) => {
    // (Its arrays as blobs, by their SHA-256: the document names them, M1.)
    const base = await meshNodeBlobs({ kind: 'mesh' as const, name: o.name, unit: o.unit, representation: 'facets' as const }, o.positions, o.indices);
    const repair = o.repair ? await repairRecord(o.repair.steps, o.repair.result) : undefined;
    const crossings = o.repair ? o.repair.result.report.selfIntersections : o.diagnosis.selfIntersections;
    const node = { ...base, ...(repair ? { repair } : {}), ...(crossings ? { crossings: { count: crossings, at: o.diagnosis.selfIntersectionAt.map(p => [...p] as [number, number, number]) } } : {}) };
    // Read before replacing the current part: a mesh that does not build keeps the part. Read piece by piece, so a
    // file of several closed pieces (a kit, separate eyes) opens as that many bodies (D42).
    const read = await engine.part(withNode(emptyDoc(), { ...node, pieces: 2 }), nextRevision(), 'read');
    if (!read.ok) { onNotice({ title: 'Could not open this mesh', hint: `${read.error.detail || read.error.hint}. Your part is unchanged.`, detail: read.error.detail }); return; }
    const pieces = read.bodies.length, next = withNode(emptyDoc(), { ...node, ...(pieces > 1 ? { pieces } : {}) });
    setRepairAsk(null); onOpened(next, o.name);
    const faces = read.bodies.reduce((n, b) => n + b.mesh.faces.length, 0), volume = read.bodies.reduce((v, b) => v + (b.volume ?? 0), 0);
    const r = repair?.report, sheet = r && !r.closed;
    // (Pieces under 1% of the largest one's volume, kept: floaters, likely — the repair drops them when asked.)
    const largest = Math.max(...read.bodies.map(b => b.volume ?? 0)), tiny = pieces > 1 ? read.bodies.filter(b => (b.volume ?? 0) < 0.01 * largest).length : 0;
    onNotice({ title: `${o.format ?? 'Mesh'} opened${repair ? ', repaired' : ''}`, hint: `${pieces > 1 ? `${pieces} pieces, each a body of its own (${faces.toLocaleString('en-US')} regions in all)` : `${sheet ? 'An open sheet' : 'A mesh solid'} of ${faces.toLocaleString('en-US')} region${faces === 1 ? '' : 's'}`} — ${(o.indices.length / 3).toLocaleString('en-US')} triangles read in ${MESH_UNITS.find(u => u.value === o.unit)?.label.toLowerCase() ?? o.unit}${sheet ? '' : `; ${Math.round(volume).toLocaleString('en-US')} mm³`}.${r?.holesFilled ? ` ${r.holesFilled} hole${r.holesFilled > 1 ? 's' : ''} filled (${Math.round(r.filledArea).toLocaleString('en-US')} mm² guessed: its badge shows where).` : ''}${sheet ? ' It is not closed: no volume, no Booleans.' : ''}${tiny ? ` ${tiny} of the pieces ${tiny === 1 ? 'is' : 'are'} tiny (under 1% of the largest): stray bits, likely — delete ${tiny === 1 ? 'it' : 'them'}, or open the mesh with its repair.` : ''}${crossings ? ` It crosses itself in ${crossings} place${crossings > 1 ? 's' : ''}: Booleans will refuse it.` : ''} Splits, sections, holes and Booleans with modelled bodies work at any size (up to ${FACET_EXPLODE_TRIANGLES.toLocaleString('en-US')} triangles near the tool; ${FACET_PREVIEW_TRIANGLES.toLocaleString('en-US')} in a preview); Booleans of two meshes up to ${FACET_EXPLODE_TRIANGLES.toLocaleString('en-US')} triangles; fillets, shells and drafts on mesh faces come later.`, detail: '' });
  };
  /** A repair's arrays as blobs, and the record the node keeps. */
  const repairRecord = async (steps: MeshRepairSteps, r: MeshRepairResult): Promise<MeshRepairRecord> => {
    const [positions, indices, fill] = await Promise.all([putBlob(positionsArray(r.positions)), putBlob(r.indices), putBlob(r.fill)]);
    return { steps, result: { positions, indices, fill }, report: r.report };
  };
  /** The checked repair (in the worker, its stages shown, stoppable). */
  const checkRepair = async () => {
    if (!repairAsk) return;
    setStage('weld');
    const r = await engine.repair(repairAsk.positions, repairAsk.indices, repairAsk.steps, st => setStage(st));
    setStage(null);
    if ('error' in r) { if (r.error !== 'stopped') onNotice({ title: 'Could not repair this mesh', hint: r.error, detail: '' }); return; }
    setRepairAsk(a => a && { ...a, result: r });
  };
  const applyRepair = async () => {
    const a = repairAsk; if (!a?.result) return;
    if (a.mode === 'import') { await openMeshNode({ ...a, repair: { steps: a.steps, result: a.result } }); return; }
    const n = doc.nodes[a.node!]; if (n?.kind !== 'mesh') return;
    const repair = await repairRecord(a.steps, a.result), crossings = a.result.report.selfIntersections;
    const rest = { ...n }; delete rest.crossings;
    setRepairAsk(null);
    onCommit({ ...doc, nodes: doc.nodes.map((x, i) => i === a.node ? { ...rest, repair, ...(crossings ? { crossings: { count: crossings, at: a.diagnosis.selfIntersectionAt.map(p => [...p] as [number, number, number]) } } : {}) } : x) }, false);
  };
  /** A mesh node's repair opened again: its import checked anew, its steps as they were. */
  const editRepair = async (index: number) => {
    const n = doc.nodes[index]; if (n?.kind !== 'mesh') return;
    const positions = n.blob ? getBlob(n.blob.positions) : n.positions, indices = n.blob ? getBlob(n.blob.indices) : n.indices;
    if (!positions || !indices) return;
    setStage('checking the mesh');
    const d = await engine.diagnose(positions, indices);
    setStage(null);
    if ('error' in d) return;
    setRepairAsk({ mode: 'edit', node: index, name: n.name, unit: n.unit, positions, indices, diagnosis: d, steps: n.repair?.steps ?? DEFAULT_REPAIR, result: null });
  };
  const removeRepair = () => {
    const a = repairAsk; if (!a || a.mode !== 'edit') return;
    const n = doc.nodes[a.node!]; if (n?.kind !== 'mesh') return;
    const rest = { ...n }; delete rest.repair;
    setRepairAsk(null);
    onCommit({ ...doc, nodes: doc.nodes.map((x, i) => i === a.node ? rest : x) }, false);
  };
  return { meshAsk, setMeshAsk, meshInUnit, stage, setStage, repairAsk, setRepairAsk,
    stopStage, openMesh, openMeshNode, checkRepair, applyRepair, editRepair, removeRepair };
}

export type MeshImportController = ReturnType<typeof useMeshImport>;
