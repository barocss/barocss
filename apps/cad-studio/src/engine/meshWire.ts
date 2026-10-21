// Evaluation replies without the meshes the client already holds (PERF3 B12). Each kind of request is a slot; the
// worker remembers the meshes of its slot's last reply, and a body whose mesh was among them goes back as that mesh's
// token alone: no copy made, nothing sent. The client keeps the same last reply's meshes by token and puts them back.
// Both sides keep exactly the last reply of each slot, in the order the worker posts them.
import type { BodyResult, EvalResult } from './evaluate';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

/** A body as posted: its mesh and the token it goes by, or only the token of a mesh the client holds. */
export type WireBody = Omit<BodyResult, 'mesh'> & ({ mesh: DisplayMesh; meshToken: number } | { meshRef: number });
export type WireResult = { ok: true; revision: number; bodies: WireBody[]; ms: number; faceTable?: unknown } | Extract<EvalResult, { ok: false }>;

/** The worker's side: kept meshes in, posted replies out. */
export class MeshSender {
  private sent = new Map<string, Map<DisplayMesh, number>>();
  private next = 1;
  /** The reply for `slot` and the buffers it transfers; a mesh posted is a copy (the kept one stays whole). */
  pack(slot: string, result: EvalResult): { result: WireResult; transfer: Transferable[] } {
    if (!result.ok) { this.sent.set(slot, new Map()); return { result, transfer: [] }; }
    const before = this.sent.get(slot), now = new Map<DisplayMesh, number>(), transfer: Transferable[] = [];
    const bodies: WireBody[] = result.bodies.map(body => {
      const { mesh, ...rest } = body;
      const token = now.get(mesh) ?? before?.get(mesh);
      if (token !== undefined) { now.set(mesh, token); return { ...rest, meshRef: token }; }
      const t = this.next++, copy = copyMesh(mesh);
      now.set(mesh, t);
      transfer.push(copy.positions.buffer, copy.normals.buffer, copy.faceOfVertex.buffer, copy.indices.buffer, copy.edgeLines.buffer, copy.edgeOfSegment.buffer);
      return { ...rest, mesh: copy, meshToken: t };
    });
    this.sent.set(slot, now);
    return { result: { ...result, bodies }, transfer };
  }
}
/** The client's side: posted replies in, whole results out. */
export class MeshReceiver {
  private held = new Map<string, Map<number, DisplayMesh>>();
  unpack(slot: string, wire: WireResult): EvalResult {
    if (!wire.ok) { this.held.set(slot, new Map()); return wire; }
    const before = this.held.get(slot), now = new Map<number, DisplayMesh>();
    const bodies: BodyResult[] = wire.bodies.map(body => {
      if ('meshRef' in body) {
        const { meshRef, ...rest } = body, mesh = now.get(meshRef) ?? before?.get(meshRef);
        if (!mesh) throw new Error(`the evaluation named a mesh (${meshRef}) the studio does not hold`);
        now.set(meshRef, mesh);
        return { ...rest, mesh } as BodyResult;
      }
      const { meshToken, ...rest } = body;
      now.set(meshToken, body.mesh);
      return rest as BodyResult;
    });
    this.held.set(slot, now);
    return { ...wire, bodies } as EvalResult;
  }
}
function copyMesh(m: DisplayMesh): DisplayMesh {
  return { ...m, positions: m.positions.slice(), normals: m.normals.slice(), faceOfVertex: m.faceOfVertex.slice(), indices: m.indices.slice(), edgeLines: m.edgeLines.slice(), edgeOfSegment: m.edgeOfSegment.slice() };
}
