// USD export (RM9c, O62): the joint tree (RM1) as a USD stage in text (.usda) with OpenUSD's UsdPhysics schema, the same
// parts as URDF, MJCF and SDF (robotParts). SI units (metersPerUnit 1, kilogramsPerUnit 1, Z up), as the other three.
//   - the root Xform carries PhysicsArticulationRootAPI; each link is an Xform beneath it (not nested: each its own rigid
//     body) with PhysicsRigidBodyAPI and PhysicsMassAPI — physics:mass, physics:centerOfMass, and the inertia as
//     physics:diagonalInertia about physics:principalAxes (RM3's eigen-decomposition) — its frame a matrix4d
//     xformOp:transform (USD's row vectors: each row an axis, the last the origin);
//   - its mesh a Mesh prim, and its convex hull a Mesh with PhysicsCollisionAPI (approximation "convexHull"), in the link frame;
//   - each joint a PhysicsRevoluteJoint, PhysicsPrismaticJoint or PhysicsFixedJoint: body0 the parent, body1 the child,
//     its frame the child link's (localPos0/localRot0 in the parent's; identity in the child's), physics:axis "Z";
//     limits in degrees (a turn) or metres (a slide); a continuous joint a revolute one without limits;
//   - what UsdPhysics has no attribute for — a gear coupling, effort and velocity limits — kept as `barocss:` custom
//     attributes, said in the notes; a loop's pin (RM8) a PhysicsSphericalJoint excluded from the articulation.
import { symmetricEigen3 } from '@barocss/cad';
import type { JointTree } from './joints';
import { type Mat3, type V3 } from './inertia';
import { namer, num, robotParts, type UrdfPart, type UrdfRefusal } from './urdf';
import { quatOf, type MjcfClosure } from './mjcf';

export const USD_EXPORT_VERSION = 'barocss-usd-v1';
export type UsdResult =
  | { ok: true; usda: string; names: { links: Record<string, string>; joints: Record<string, string> }; notes: string[]; frames: Map<string, { R: Mat3; o: V3 }> }
  | { ok: false; refusals: { code: UrdfRefusal; message: string }[] };
const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const tr = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const ap = (m: Mat3, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const tuple = (v: readonly number[]) => `(${v.map(num).join(', ')})`;
const DEG = 180 / Math.PI;
/** A rotation's columns made right-handed (a principal frame's third axis flipped when it is not). */
function proper(R: Mat3): Mat3 {
  const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]);
  return det < 0 ? [R[0], R[1], -R[2], R[3], R[4], -R[5], R[6], R[7], -R[8]] : R;
}
/** A mesh's points and triangles as a USD Mesh prim's attributes. */
function meshLines(pad: string, positions: ArrayLike<number>, indices: ArrayLike<number>): string[] {
  const pts: string[] = [], idx: string[] = [];
  for (let i = 0; i < positions.length; i += 3) pts.push(`(${num(positions[i])}, ${num(positions[i + 1])}, ${num(positions[i + 2])})`);
  for (let i = 0; i < indices.length; i++) idx.push(String(indices[i]));
  return [`${pad}point3f[] points = [${pts.join(', ')}]`, `${pad}int[] faceVertexCounts = [${new Array(indices.length / 3).fill(3).join(', ')}]`, `${pad}int[] faceVertexIndices = [${idx.join(', ')}]`];
}

/** The robot as a .usda stage, or what refuses it. */
export function exportUsd(tree: JointTree, partOf: (part: string) => UrdfPart | null, robotName: string, closures: readonly MjcfClosure[] = []): UsdResult {
  const parts = robotParts(tree, partOf);
  if ('refusals' in parts) return { ok: false, refusals: parts.refusals };
  const { world, inertias, meshes } = parts, notes = closures.length >= tree.loops.length ? parts.notes.filter(n => !/A tree format/.test(n)) : [...parts.notes];
  const linkName = namer(), jointName = namer(), names = { links: {} as Record<string, string>, joints: {} as Record<string, string> };
  const root = linkName(robotName.replace(/[^A-Za-z0-9_]/g, '_') || 'robot');
  for (const l of tree.links) names.links[l.id] = linkName(l.id);
  for (const j of tree.joints) names.joints[j.key] = jointName(j.key);
  const out: string[] = ['#usda 1.0', '(', `    doc = "${USD_EXPORT_VERSION}: barocss CAD Studio. SI units; each link's frame at its joint, Z on the axis; joint values 0 at the pose the mates solve to."`,
    `    defaultPrim = "${root}"`, '    metersPerUnit = 1', '    kilogramsPerUnit = 1', '    upAxis = "Z"', ')', '',
    `def Xform "${root}" (`, '    prepend apiSchemas = ["PhysicsArticulationRootAPI"]', ')', '{'];
  for (const l of tree.links) {
    const n = names.links[l.id], F = world.get(l.id)!, li = inertias.get(l.id), m = meshes.get(l.id), R = F.R, o = F.o.map(v => v / 1000);
    out.push(`    def Xform "${n}" (`, '        prepend apiSchemas = ["PhysicsRigidBodyAPI", "PhysicsMassAPI"]', '    )', '    {',
      `        matrix4d xformOp:transform = ( ${tuple([R[0], R[3], R[6], 0])}, ${tuple([R[1], R[4], R[7], 0])}, ${tuple([R[2], R[5], R[8], 0])}, ${tuple([...o, 1])} )`,
      '        uniform token[] xformOpOrder = ["xformOp:transform"]');
    if (li) {
      // (The principal frame from the tensor itself, right-handed: I = A diag(d) Aᵀ.)
      const e = symmetricEigen3(li.inertia), A = proper(e.vectors);
      out.push(`        float physics:mass = ${num(li.massKg)}`, `        point3f physics:centerOfMass = ${tuple(li.comM)}`, `        float3 physics:diagonalInertia = ${tuple(e.values)}`, `        quatf physics:principalAxes = ${tuple(quatOf(A))}`);
    } else out.push('        float physics:mass = 1e-9', '        float3 physics:diagonalInertia = (1e-15, 1e-15, 1e-15)');
    if (m) {
      out.push('        def Mesh "visual"', '        {', ...meshLines('            ', m.visual.positions, m.visual.indices), '        }',
        '        def Mesh "collision" (', '            prepend apiSchemas = ["PhysicsCollisionAPI", "PhysicsMeshCollisionAPI"]', '        )', '        {',
        '            uniform token physics:approximation = "convexHull"', '            uniform token purpose = "guide"', ...meshLines('            ', m.hull.positions, m.hull.indices), '        }');
    }
    out.push('    }');
  }
  let custom = false;
  for (const j of tree.joints) {
    const P = world.get(j.parent)!, C = world.get(j.child)!, pos = ap(tr(P.R), [C.o[0] - P.o[0], C.o[1] - P.o[1], C.o[2] - P.o[2]]).map(v => v / 1000), rot = quatOf(mul(tr(P.R), C.R));
    const kind = j.type === 'prismatic' ? 'PhysicsPrismaticJoint' : j.type === 'fixed' ? 'PhysicsFixedJoint' : 'PhysicsRevoluteJoint', l = j.limit;
    out.push(`    def ${kind} "${names.joints[j.key]}"`, '    {', `        rel physics:body0 = </${root}/${names.links[j.parent]}>`, `        rel physics:body1 = </${root}/${names.links[j.child]}>`,
      `        point3f physics:localPos0 = ${tuple(pos)}`, `        quatf physics:localRot0 = ${tuple(rot)}`, '        point3f physics:localPos1 = (0, 0, 0)', '        quatf physics:localRot1 = (1, 0, 0, 0)');
    if (j.type !== 'fixed') out.push('        uniform token physics:axis = "Z"');
    if ((j.type === 'revolute' || j.type === 'prismatic') && l?.lower !== undefined && l.upper !== undefined) {
      const k = j.type === 'prismatic' ? 1e-3 : DEG;
      out.push(`        float physics:lowerLimit = ${num(l.lower * k)}`, `        float physics:upperLimit = ${num(l.upper * k)}`);
    }
    if (j.type === 'continuous') out.push('        custom bool barocss:continuous = true');
    const kv = j.type === 'prismatic' ? 1e-3 : 1;
    if (l?.effort !== undefined) { out.push(`        custom double barocss:effort = ${num(l.effort)}`); custom = true; }
    if (l?.velocity !== undefined) { out.push(`        custom double barocss:velocity = ${num(l.velocity * kv)}`); custom = true; }
    if (j.mimic) { out.push(`        custom string barocss:mimicJoint = "${names.joints[j.mimic.joint]}"`, `        custom double barocss:mimicMultiplier = ${num(j.mimic.multiplier)}`, `        custom double barocss:mimicOffset = ${num(j.mimic.offset * kv)}`); custom = true; }
    out.push('    }');
  }
  for (const c of closures) {
    const A = world.get(c.a)!, B = world.get(c.b)!, pa = ap(tr(A.R), [c.point[0] - A.o[0], c.point[1] - A.o[1], c.point[2] - A.o[2]]).map(v => v / 1000), pb = ap(tr(B.R), [c.point[0] - B.o[0], c.point[1] - B.o[1], c.point[2] - B.o[2]]).map(v => v / 1000);
    out.push(`    def PhysicsSphericalJoint "loop_${names.links[c.a]}_${names.links[c.b]}"`, '    {', `        rel physics:body0 = </${root}/${names.links[c.a]}>`, `        rel physics:body1 = </${root}/${names.links[c.b]}>`,
      `        point3f physics:localPos0 = ${tuple(pa)}`, `        point3f physics:localPos1 = ${tuple(pb)}`, '        bool physics:excludeFromArticulation = true', '    }');
  }
  out.push('}', '');
  if (custom) notes.push('UsdPhysics has no attribute for a gear coupling or a joint\'s effort and velocity limits: they are kept as barocss: custom attributes.');
  return { ok: true, usda: out.join('\n'), names, notes, frames: world };
}
