// AM5 (D76): the part (and its shown instances) as a 3MF model — each visible body an object with its material, colour
// and face colours; with a print direction (AM4) the build items are turned so it points up, set down on the bed and
// centred on the printer's bed when one is chosen.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { bodyName, lookOf } from '@barocss/cad-model/app/bodies';
import { materialData, printerProfile } from '@barocss/cad-model/library/materials';
import type { ThreeMfModel, ThreeMfObject } from '@barocss/cad-model/print/threemf';

/** The rotation (row-major) turning the unit direction `d` onto +Z: the shortest turn (half a turn about X for −Z). */
export function rotationToUp(d: readonly number[]): number[] {
  const l = Math.hypot(d[0], d[1], d[2]), x = d[0] / l, y = d[1] / l, z = d[2] / l;
  if (z < -1 + 1e-12) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  // v = d × ẑ = (y, −x, 0); R = I + [v]× + [v]×² / (1 + d·ẑ).
  const vx = y, vy = -x, k = 1 / (1 + z);
  return [1 - k * vy * vy, k * vx * vy, vy, k * vx * vy, 1 - k * vx * vx, -vx, -vy, vx, 1 - k * (vx * vx + vy * vy)];
}
/** A rotation (row-major, p' = R·p) and a translation as 3MF's 12 numbers (row vectors: the rows are R's columns). */
export const toThreeMfTransform = (R: readonly number[], t: readonly number[]): number[] => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8], t[0], t[1], t[2]];

export interface PartBodies { readonly doc: StudioDoc; readonly bodies: readonly BodyResult[]; /** An instance's name, before its bodies'. */ readonly name?: string }
/** The 3MF model of the parts' visible bodies (meshes as shown: placed instances' already in place). */
export function threeMfModelOf(doc: StudioDoc, parts: readonly PartBodies[], title: string): ThreeMfModel | string {
  const objects: ThreeMfObject[] = [];
  for (const part of parts) for (const b of part.bodies) {
    const look = lookOf(part.doc, b);
    if (look.hidden) continue;
    const m = b.mesh, faces = look.faces;
    let triangleColors: (string | null)[] | undefined;
    if (faces && Object.keys(faces).length) {
      triangleColors = new Array(m.indices.length / 3);
      for (let t = 0; t < triangleColors.length; t++) triangleColors[t] = faces[m.faces[m.faceOfVertex[m.indices[3 * t]]]?.name] ?? null;
    }
    const name = bodyName(part.doc, b);
    objects.push({ name: part.name ? `${part.name} / ${name}` : name, positions: m.positions, indices: m.indices, material: materialData(look.material)?.label ?? look.material ?? '', color: look.color ?? '', ...(triangleColors ? { triangleColors } : {}) });
  }
  if (!objects.length) return 'there is no visible body to write';
  if (!doc.print) return { title, objects, items: objects.map((o, k) => ({ object: k, name: o.name })) };
  // Turned so the print direction is up, its lowest point on the bed, centred on the printer's bed when chosen.
  const R = rotationToUp(doc.print.direction), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const o of objects) {
    const P = o.positions;
    for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { const v = R[3 * a] * P[i] + R[3 * a + 1] * P[i + 1] + R[3 * a + 2] * P[i + 2]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  }
  const bed = printerProfile(doc.printer)?.buildMM;
  const t = bed ? [bed[0] / 2 - (lo[0] + hi[0]) / 2, bed[1] / 2 - (lo[1] + hi[1]) / 2, -lo[2]] : [0, 0, -lo[2]];
  const transform = toThreeMfTransform(R, t);
  return { title, objects, items: objects.map((o, k) => ({ object: k, transform, name: o.name })) };
}
