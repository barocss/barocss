import type { ReactNode } from 'react';
import { fmt } from '@barocss/cad-model/engine/doc';
import { MESH_UNITS, type MeshUnit } from '@barocss/cad-model/engine/meshImport';
import { Icon } from '../ui/atoms';
import { MeshRepairPanel } from '../ui/MeshRepairPanel';
import type { MeshImportController } from './useMeshImport';

/** Existing unit and repair questions for an imported mesh. */
export function MeshFileDialogs({ controller, children }: { controller: MeshImportController; children?: ReactNode }) {
  const { meshAsk, setMeshAsk, meshInUnit, openMesh, repairAsk, setRepairAsk, stage,
    checkRepair, applyRepair, openMeshNode, removeRepair } = controller;
  return <>
      {meshAsk && meshInUnit && <div className="toast card recovery" role="dialog" aria-label="Mesh units">
        <Icon name="straighten" className="accent" />
        <div><div className="toast-title">Open {meshAsk.name}.{meshAsk.format.toLowerCase()}: in what unit?</div>
          <div className="toast-hint">{meshAsk.format} files carry no unit. In {meshAsk.unit} it is {meshInUnit.size.map(fmt).join(' × ')} mm.</div>
          <div className="row-actions">
            <select aria-label="Mesh unit" value={meshAsk.unit} onChange={e => setMeshAsk(m => m && { ...m, unit: e.target.value as MeshUnit })}>
              {MESH_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <button className="primary" onClick={() => void openMesh()}>Open</button>
            <button className="ghost" onClick={() => setMeshAsk(null)}>Cancel</button>
          </div></div>
      </div>}
      {children}
      {repairAsk && <MeshRepairPanel title={repairAsk.mode === 'import' ? `Open ${repairAsk.name}${repairAsk.format ? `.${repairAsk.format.toLowerCase()}` : ''}: it needs repair` : `Repair of ${repairAsk.name}`}
        diagnosis={repairAsk.diagnosis} steps={repairAsk.steps} onSteps={steps => setRepairAsk(a => a && { ...a, steps, result: null })} report={repairAsk.result?.report ?? null} busy={stage !== null}
        onCheck={() => void checkRepair()} onApply={() => void applyRepair()}
        {...(repairAsk.diagnosis.closed ? { onAsIs: repairAsk.mode === 'import' ? () => void openMeshNode(repairAsk) : removeRepair } : {})}
        asIsLabel={repairAsk.mode === 'import' ? 'Open as it is' : 'Remove the repair'} onCancel={() => setRepairAsk(null)} />}
  </>;
}
