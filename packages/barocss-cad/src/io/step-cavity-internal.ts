import { BrepError, checkBrep, type Brep } from '../brep/brep-core.js';
import { brepQuadratureIntegrals } from '../brep/brep-mass-quadrature.js';
import { polyhedralIntegrals } from '../brep/solid-mass.js';

type StepShell = { readonly ref: number; readonly voidShell: boolean };

function signedVolume(shell: Brep): number | null {
  const planar = polyhedralIntegrals(shell);
  if (planar) return Number.isFinite(planar[0]) ? planar[0] : null;

  const coarse = brepQuadratureIntegrals(shell, 8);
  if (!coarse) return null;
  const fine = coarse.meshed ? brepQuadratureIntegrals(shell, 16) : coarse;
  if (!fine) return null;
  const volume = fine.integrals[0], previous = coarse.integrals[0];
  // For a curved trim, refuse an unstable sign instead of making a new orientation guess.
  return Number.isFinite(volume) && Math.abs(volume) > 8 * Math.abs(volume - previous) ? volume : null;
}

/** Check each material-facing shell separately. A positive whole-body volume cannot detect an added void. */
export function verifyStepShellOrientation(brep: Brep, stepShells: ReadonlyMap<string, StepShell>): void {
  if (!stepShells.size) return;
  const faces = new Map(brep.faces.map(face => [face.id, face]));
  const loops = new Map(brep.loops.map(loop => [loop.id, loop]));
  const coedges = new Map(brep.coedges.map(edge => [edge.id, edge]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex]));

  for (const shell of brep.shells) {
    const source = stepShells.get(shell.id);
    if (!source) continue;
    const label = 'STEP: BREP_WITH_VOIDS ' + (source.voidShell ? 'void' : 'outer') + ' shell #' + source.ref;
    const shellFaces = shell.faces.map(id => faces.get(id)!);
    const shellLoops = shellFaces.flatMap(face => face.loops.map(id => loops.get(id)!));
    const useIds = new Set(shellLoops.flatMap(loop => loop.coedges));
    const shellCoedges = [...useIds].map(id => coedges.get(id)!);
    if (shellCoedges.some(edge => !edge.twin || !useIds.has(edge.twin))) {
      throw new BrepError('INPUT', label + ' must have its own closed boundary');
    }
    const shellEdges = [...new Set(shellCoedges.map(edge => edge.edge))].map(id => edges.get(id)!);
    const shellVertices = [...new Set(shellEdges.flatMap(edge => edge.vertices))].map(id => vertices.get(id)!);
    const view: Brep = {
      ...brep, bodies: [{ id: shell.body, kind: 'solid', shells: [shell.id] }], shells: [shell],
      faces: shellFaces, loops: shellLoops, coedges: shellCoedges, edges: shellEdges, vertices: shellVertices,
    };
    const report = checkBrep(view);
    if (!report.valid) throw new BrepError('INPUT', label + ' orientation or topology is invalid: ' + report.issues[0]);
    const volume = signedVolume(view);
    if (volume === null || volume === 0) throw new BrepError('INPUT', label + ' orientation could not be verified');
    if (source.voidShell ? volume > 0 : volume < 0) {
      throw new BrepError('INPUT', label + ' orientation is inconsistent with its material boundary');
    }
  }
}
