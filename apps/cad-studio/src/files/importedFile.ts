import { DEFAULT_REPAIR } from '@barocss/cad';
import { emptyDoc, withNode, type Side, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { loadDirect } from '@barocss/cad-model/engine/directModule';
import { stepLengthUnit } from '@barocss/cad-model/engine/stepUnits';
import { readMeshFile } from '@barocss/cad-model/engine/meshImport';
import { DWG_ROUTES, dwgRefusal } from '@barocss/cad-model/sketch/dxfRead';
import { emptyDirect } from '../app/directGeometry';
import type { EngineClient } from '../engine/client';
import type { MeshImportController } from './useMeshImport';
export const isImportedFile = (name: string) => /\.(dwg|step|stp|stl|obj|igs|iges|barocad)$/i.test(name);
interface ImportedFileOptions {
  doc: StudioDoc;
  worker: { engine: EngineClient; nextRevision(): number };
  mesh: Pick<MeshImportController, 'setStage' | 'setRepairAsk' | 'setMeshAsk'>;
  changes: { onOpened(doc: StudioDoc, name: string): void; commitDirect(next: DirectGeometry, selection?: string[]): boolean; fitLater(): void };
  onNotice(notice: FriendlyError): void;
}
/** Existing format-specific import routes. Their remaining A05 ownership boundary is unchanged. */
export async function openImportedFile(file: File, { doc, worker, mesh, changes, onNotice: setToast }: ImportedFileOptions): Promise<void> {
  const { engine, nextRevision } = worker;
  const { setStage, setRepairAsk, setMeshAsk } = mesh;
  const { onOpened, commitDirect, fitLater } = changes;
      // A DWG is not read (O61): its routes named, the part unchanged.
      if (/\.dwg$/i.test(file.name)) { const e = dwgRefusal(new TextDecoder('latin1').decode(new Uint8Array(await file.slice(0, 6).arrayBuffer()))); setToast({ title: 'DWG files are not read', hint: e ? e.message.replace(/^\[[A-Z_]+\] /, '') : `This is not a DWG file the studio knows. ${DWG_ROUTES}`, detail: '' }); return; }
      // A STEP file starts a new part from its solids.
      if (/\.(step|stp)$/i.test(file.name)) {
        const name = file.name.replace(/\.(step|stp)$/i, ''), step = await file.text(), unit = stepLengthUnit(step);
        // A file of meshes only (AP242 tessellated: scans, other systems' exports) is checked like an STL: closed and
        // clean it imports as it is (its faces' names kept), else through the repair gate as a mesh (R3.5, D48).
        setStage('reading the file');
        const meshes = await engine.stepMeshes(step);
        setStage(null);
        if (meshes && 'error' in meshes) { if (meshes.error !== 'stopped') setToast({ title: 'Could not open this file', hint: `${meshes.error[0].toUpperCase()}${meshes.error.slice(1)}. Your part is unchanged.`, detail: meshes.error }); return; }
        if (meshes) {
          // (Typed arrays, not number lists: posted to the worker by copying bytes, not element by element; PERF3 B13.)
          const k = unit.to, positions = new Float64Array(meshes.reduce((n, m) => n + m.positions.length, 0)), indices = new Uint32Array(meshes.reduce((n, m) => n + m.indices.length, 0));
          let pv = 0, pi = 0;
          for (const m of meshes) { const base = pv / 3; for (let i = 0; i < m.positions.length; i++) positions[pv++] = m.positions[i] * k; for (let i = 0; i < m.indices.length; i++) indices[pi++] = base + m.indices[i]; }
          setStage('checking the mesh');
          const d = await engine.diagnose(positions, indices);
          setStage(null);
          if ('error' in d) { if (d.error !== 'stopped') setToast({ title: 'Could not read this mesh', hint: d.error, detail: '' }); return; }
          if (!d.closed || d.degenerate || d.duplicates || d.selfIntersections) { setRepairAsk({ mode: 'import', name, format: 'STEP', unit: 'mm', positions, indices, diagnosis: d, steps: DEFAULT_REPAIR, result: null }); return; }
        }
        // Read it before replacing the current part: a file the kernel cannot read keeps the part. Read
        // solid by solid, so that a file holding several opens as that many bodies.
        const read = await engine.part(withNode(emptyDoc(), { kind: 'import', name, step, solids: 2 }), nextRevision(), 'read');
        if (!read.ok) { setToast({ title: 'Could not open this file', hint: `The kernel can’t read it as STEP: ${read.error.detail}. Your part is unchanged.`, detail: read.error.detail }); return; }
        let next = withNode(emptyDoc(), { kind: 'import', name, step, ...(read.bodies.length > 1 ? { solids: read.bodies.length } : {}) });
        // In other units than millimetres: each solid scaled about the origin to its true size.
        const n = read.bodies.length;
        if (unit.to !== 1) for (let k = 0; k < n; k++) next = withNode(next, { kind: 'scale', parent: { node: 0, side: n > 1 ? `part${k}` as Side : 'solid' }, factor: unit.to, pivot: [0, 0, 0] });
        onOpened(next, name);
        const vol = read.bodies.reduce((t, b) => t + (b.volume ?? 0), 0) * unit.to ** 3;
        setToast({ title: 'STEP opened', hint: `${n} solid${n === 1 ? '' : 's'}, ${unit.declared ? `in ${unit.name}` : 'no length unit declared (read as millimetres)'}${unit.to !== 1 ? `, scaled ×${unit.to} to millimetres` : ''}; ${Math.round(vol).toLocaleString('en-US')} mm³ in all. Only the solids come in (no colours, names or assembly structure).`, detail: '' });
        return;
      }
      // An STL or OBJ file starts a new part from its closed mesh, once its unit is chosen (the files say none).
      if (/\.(stl|obj)$/i.test(file.name)) {
        const name = file.name.replace(/\.(stl|obj)$/i, '');
        try { setMeshAsk({ name, format: /\.obj$/i.test(file.name) ? 'OBJ' : 'STL', mesh: readMeshFile(file.name, new Uint8Array(await file.arrayBuffer())), unit: 'mm' }); }
        catch (e) { setToast({ title: 'Could not open this file', hint: `${e instanceof Error ? e.message : String(e)}. Your part is unchanged.`, detail: '' }); }
        return;
      }
      // An IGES file adds its curves and surfaces as direct geometry too, saying what came in.
      if (/\.(igs|iges)$/i.test(file.name)) {
        const r = (await loadDirect()).importIGESFile(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.(igs|iges)$/i, ''));
        commitDirect(r.direct, r.direct.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        setToast({ title: 'IGES opened', hint: `${r.curves} curve${r.curves === 1 ? '' : 's'} and ${r.surfaces} surface${r.surfaces === 1 ? '' : 's'} added as curves and surfaces (Direct), in mm.`, detail: '' });
        fitLater();
        return;
      }
      // A .barocad source adds its curves and surfaces to the part as direct geometry. (Only .barocad: `.cad` is other
      // programs' extension, owner 2026-10-24.)
      if (/\.barocad$/i.test(file.name)) {
        const next = (await loadDirect()).importSource(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.barocad$/i, ''));
        commitDirect(next, next.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        fitLater();
        return;
      }
}
