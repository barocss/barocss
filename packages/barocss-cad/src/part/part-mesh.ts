// R5.3 (D224): the mesh and import features of the part model — STEP import, SubD, sew, mesh, decimate and separate —
// moved out of part-model.ts's operation() as they were there. The dispatcher calls `meshOperation` for those kinds.
import { type Brep, BrepError, isFacetFace } from '../brep/brep-core.js';
import { type FacetPatch, type Point } from '../types.js';
import { isMeshBrepError, brepFromTriangles } from '../mesh/mesh-brep.js';
import { isSewError, sewSolid } from '../brep/sew-solid.js';
import { SubdError, buildSubd, subdSummary } from '../features/subd.js';
import { decimateMesh } from '../mesh/mesh-decimate.js';
import { facetBrepFromTriangles, facetBrepsFromTriangles } from '../mesh/facet-brep.js';
import { importStep } from '../io/step.js';
import { transformBrep } from '../brep/brep-transform.js';
import { validateSurface } from '../core/math.js';
import type { CadPartDim, Solid, CadPartFeature, Result, Tools, PartHelpers } from './part-model.js';

/** An import or mesh feature's evaluation (part-model.ts's operation() for these kinds). */
export function meshOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, solids, fail, at } = t;
  const { isRecord, CadPartLimits, stepSizeProblem, splitBodies, brepOf, meshArrayOk, facetBody, facetTriangles, brepBodies } = k;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  const many = (parts: Solid[]): Result => ({ kind: 'solid', parts: parts.map(solid => ({ solid })) });
  switch (f.kind) {
    case 'import': {
      if (typeof f.step !== 'string' || !f.step.length) fail('INPUT', 'step must be the text of a STEP file');
      const tooLarge = stepSizeProblem(f.step as string); if (tooLarge) fail('INPUT', tooLarge);
      return () => {
        let brep: Brep;
        try { brep = importStep(f.step as string, { id: at }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported/.test(cause.message) ? 'CAPABILITY' : 'INPUT', cause.message.replace(/^B-rep: STEP: /, '')); throw cause; }
        let triangles = 0;
        for (const x of brep!.faces) if (isFacetFace(x)) triangles += (x.surface as FacetPatch).indices.length / 3;
        if (triangles > CadPartLimits.meshTriangles) fail('INPUT', `the STEP file's meshes hold ${triangles.toLocaleString('en-US')} triangles, more than ${CadPartLimits.meshTriangles.toLocaleString('en-US')}`);
        // Names in this part: the feature id before each face name (an edge's two names alike).
        const named = { ...brep!, faces: brep!.faces.map((x, i) => x.name ? x : { ...x, name: `face${i}` }) };
        const prefixed = transformBrep(named, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split('|').map(p => `${at}.${p}`).join('|'));
        if (f.each !== undefined && typeof f.each !== 'boolean') fail('INPUT', 'each must be true or false');
        return f.each ? many(brepBodies(prefixed).map(b => ({ kind: 'brep' as const, brep: b }))) : one({ kind: 'brep', brep: prefixed });
      };
    }
    case 'subd': {
      const cage = f.cage as Record<string, unknown> | undefined;
      if (!isRecord(cage) || !(Array.isArray(cage.positions) || cage.positions instanceof Float64Array) || !Array.isArray(cage.faces)) fail('INPUT', 'cage must be { positions, faces, creases? }');
      const { positions, faces, creases } = cage as { positions: ArrayLike<number>; faces: unknown[]; creases?: unknown };
      if (positions.length > 3 * CadPartLimits.subdVertices || faces.length > CadPartLimits.subdVertices) fail('INPUT', `a cage has at most ${CadPartLimits.subdVertices} vertices and faces`);
      if (!faces.every(x => Array.isArray(x) && x.every(v => Number.isInteger(v)))) fail('INPUT', 'cage faces must list vertex numbers');
      if (creases !== undefined && !(Array.isArray(creases) && creases.every(c => Array.isArray(c) && c.length === 2 && c.every(v => Number.isInteger(v))))) fail('INPUT', 'cage creases must be pairs of vertex numbers');
      return () => {
        try {
          const built = buildSubd({ positions, faces: faces as number[][], ...(creases ? { creases: creases as [number, number][] } : {}) }, { id: at });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: built.brep }, subd: subdSummary(built) }] };
        }
        catch (cause) { if (cause instanceof SubdError) fail(cause.code, cause.message.replace(/^SubD: /, '')); if (cause instanceof BrepError) fail('GEOMETRY', cause.message.replace(/^B-rep: /, '')); throw cause; }
      };
    }
    case 'sew': {
      const list = f.surfaces as unknown, tol = f.tolerance as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.edges) fail('INPUT', 'surfaces must list 2 to 64 NURBS surfaces');
      if (tol !== undefined && !(typeof tol === 'number' && Number.isFinite(tol) && tol > 0 && tol <= 1)) fail('INPUT', 'tolerance must be a number of mm above 0, at most 1');
      const surfaces = (list as unknown[]).map((g, k) => {
        if (!isRecord(g)) fail('INPUT', `surfaces[${k}] must be a NURBS surface { degreeU, degreeV, knotsU, knotsV, controlPoints, weights }`);
        const r = g as Record<string, unknown>, s = { kind: 'surface' as const, id: `surface${k}`, degreeU: r.degreeU as number, degreeV: r.degreeV as number, knotsU: r.knotsU as number[], knotsV: r.knotsV as number[], controlPoints: r.controlPoints as Point[][], weights: r.weights as number[][] };
        try { validateSurface(s); } catch (cause) { fail('INPUT', `surfaces[${k}]: ${cause instanceof Error ? cause.message : String(cause)}`); }
        return s;
      });
      return () => {
        try { return one({ kind: 'brep', brep: sewSolid({ id: at, surfaces, ...(tol === undefined ? {} : { toleranceMM: tol as number }) }) }); }
        catch (cause) { if (isSewError(cause)) fail('GEOMETRY', cause.message); if (cause instanceof BrepError) fail('GEOMETRY', cause.message.replace(/^B-rep: /, '')); throw cause; }
      };
    }
    case 'mesh': {
      const P = f.positions as unknown, I = f.indices as unknown;
      if (!meshArrayOk(P, 'positions')) fail('INPUT', 'positions must be x, y, z numbers within ±10000 mm');
      const nv = (P as ArrayLike<number>).length / 3;
      if (!meshArrayOk(I, 'indices', nv)) fail('INPUT', `indices must be three vertex numbers a triangle, at most ${CadPartLimits.meshTriangles} triangles`);
      if (f.each !== undefined && typeof f.each !== 'boolean') fail('INPUT', 'each must be true or false');
      if (f.open !== undefined && typeof f.open !== 'boolean') fail('INPUT', 'open must be true or false');
      const G = f.groups as unknown;
      if (G !== undefined && (!(Array.isArray(G) || G instanceof Int32Array) || (G as ArrayLike<number>).length * 3 !== (I as ArrayLike<number>).length)) fail('INPUT', 'groups must give one number a triangle');
      // (A planar mesh solid — a face per flat group — stays under its own, lower limit: its faces are B-rep faces.)
      if (f.representation !== 'facets' && (I as ArrayLike<number>).length / 3 > CadPartLimits.planarMeshTriangles) fail('INPUT', `a planar mesh solid takes at most ${CadPartLimits.planarMeshTriangles} triangles (import it as facets)`);
      return () => {
        const facets = f.representation === 'facets', opts = { id: at, maximumTriangles: CadPartLimits.meshTriangles, ...(f.open ? { open: true } : {}), ...(G !== undefined ? { groups: G as ArrayLike<number> } : {}) };
        try {
          if (facets && f.each) return many(facetBrepsFromTriangles(P as ArrayLike<number>, I as ArrayLike<number>, opts).map(brep => ({ kind: 'brep' as const, brep })));
          return one({ kind: 'brep', brep: (facets ? facetBrepFromTriangles : brepFromTriangles)(P as ArrayLike<number>, I as ArrayLike<number>, opts) });
        }
        catch (cause) { if (isMeshBrepError(cause)) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'decimate': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('REFERENCE', 'decimate one part at a time (name it as id/k)');
      const ratio = f.ratio === undefined ? undefined : f.ratio as unknown, triangles = f.triangles === undefined ? undefined : f.triangles as unknown;
      if (ratio !== undefined && !(typeof ratio === 'number' && ratio > 0 && ratio < 1)) fail('INPUT', 'ratio must be a share of the triangles between 0 and 1');
      if (triangles !== undefined && !(Number.isInteger(triangles) && (triangles as number) >= 4)) fail('INPUT', 'triangles must be a whole number, 4 or more');
      const maxError = f.maxError === undefined ? undefined : dim(f.maxError as CadPartDim, 'maxError', true);
      if (ratio === undefined && triangles === undefined && maxError === undefined) fail('INPUT', 'say how far: triangles, ratio or maxError');
      const angle = f.featureAngle === undefined ? 180 : f.featureAngle as unknown;
      if (!(typeof angle === 'number' && angle > 0 && angle <= 180)) fail('INPUT', 'featureAngle must be degrees between 0 and 180');
      return () => {
        const s = target[0].solid;
        if (!facetBody(s) || s.kind !== 'brep' || !s.brep.faces.every(isFacetFace)) fail('CAPABILITY', 'decimate takes a mesh body (facet faces); a body of exact faces is not a mesh');
        const brep = (s as { brep: Brep }).brep, mesh = facetTriangles(brep), sheet = brep.bodies.some(b => b.kind === 'sheet');
        const r = decimateMesh(mesh.positions, mesh.indices, { ...(triangles !== undefined ? { targetTriangles: triangles as number } : {}), ...(ratio !== undefined ? { ratio: ratio as number } : {}), ...(maxError !== undefined ? { maxErrorMM: maxError } : {}), featureDegrees: angle as number, groups: mesh.groups });
        try {
          // (Each source face's triangles a group of its own, named as that face: its references keep resolving.)
          const out = facetBrepFromTriangles(r.positions, r.indices, { id: at, maximumTriangles: CadPartLimits.meshTriangles, groups: r.groups!, groupName: g => mesh.names[g], creaseDegrees: 180, ...(sheet ? { open: true } : {}) });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: out }, decimate: r.report }] };
        } catch (cause) { if (isMeshBrepError(cause)) fail('GEOMETRY', cause.message); throw cause; }
      };
    }
    case 'separate': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('REFERENCE', 'separate one part at a time (name it as id/k)');
      return () => {
        const pieces = splitBodies(brepOf(target[0], at));
        if (pieces.length < 2) fail('SELECTION', 'the body is in one piece: there is nothing to separate');
        return { kind: 'solid', parts: pieces.map(brep => ({ solid: { kind: 'brep', brep } as Solid })) };
      };
    }
  }
  throw new Error(`meshOperation: ${f.kind} is not one of its features`);
}
