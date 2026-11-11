import { BrepError, checkBrep, type Brep } from '../brep/brep-core.js';
import { brepQuadratureIntegrals } from '../brep/brep-mass-quadrature.js';
import { planarShellRelation, preparePlanarShell } from '../brep/polyhedral-boolean.js';
import { polyhedralIntegrals } from '../brep/solid-mass.js';

type StepShell = { readonly ref: number; readonly voidShell: boolean; readonly planar: boolean };
type PlanarStepShell = { ref: number; shell: NonNullable<ReturnType<typeof preparePlanarShell>> };

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

function relation(a: PlanarStepShell, b: PlanarStepShell): ReturnType<typeof planarShellRelation> {
  try { return planarShellRelation(a.shell, b.shell); }
  catch (cause) {
    if (!(cause instanceof BrepError)) throw cause;
    throw new BrepError('INPUT', `STEP: BREP_WITH_VOIDS could not classify the spatial relation of shells #${a.ref} and #${b.ref}`);
  }
}

function verifyPlanarPlacement(brep: Brep, planar: ReadonlyMap<string, PlanarStepShell>): void {
  for (const body of brep.bodies) {
    const outer = planar.get(body.shells[0]), voids: PlanarStepShell[] = [];
    for (const id of body.shells.slice(1)) {
      const cavity = planar.get(id);
      if (!cavity) continue;
      if (outer && relation(cavity, outer) !== 'a-inside-b') {
        throw new BrepError('INPUT', `STEP: BREP_WITH_VOIDS void shell #${cavity.ref} is not strictly inside outer shell #${outer.ref}`);
      }
      for (const other of voids) {
        const where = relation(cavity, other);
        if (where === 'contact') {
          throw new BrepError('INPUT', `STEP: BREP_WITH_VOIDS void shells #${cavity.ref} and #${other.ref} touch or intersect`);
        }
        if (where !== 'separate') {
          throw new BrepError('INPUT', `STEP: BREP_WITH_VOIDS void shells #${cavity.ref} and #${other.ref} are nested`);
        }
      }
      voids.push(cavity);
    }
  }
}

/** Check individual shell direction, then spatial placement for pairs of exact planar boundaries. */
export function verifyStepCavityShells(brep: Brep, stepShells: ReadonlyMap<string, StepShell>): void {
  if (!stepShells.size) return;
  const faces = new Map(brep.faces.map(face => [face.id, face]));
  const loops = new Map(brep.loops.map(loop => [loop.id, loop]));
  const coedges = new Map(brep.coedges.map(edge => [edge.id, edge]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex]));
  const planar = new Map<string, PlanarStepShell>();

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
    if (source.planar) {
      const prepared = preparePlanarShell(view);
      if (prepared) planar.set(shell.id, { ref: source.ref, shell: prepared });
    }
  }
  verifyPlanarPlacement(brep, planar);
}
