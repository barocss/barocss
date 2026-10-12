import { compileCadModel } from './model-compiler.js';
import { buildParametricFace } from './face.js';
import type { FaceBundle, Four } from './face.js';
import { buildAxisBoxShell } from './box-shell.js';
import type { AxisBoxShellIds } from './box-shell.js';
import type { AxisBoxSolidBooleanAsset } from './axis-box-boolean.js';
import type { Point, Surface } from './types.js';
import { signedJson } from './xy-affine-prism-feature-document-internal.js';

const faceCorners = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
/** Private authored-intent adapter. Both operands are genuinely rebuilt on every evaluated union. */
export function buildModelingBox(origin: Point, sides: Point, prefix: string): AxisBoxSolidBooleanAsset {
  const points = Array.from({ length: 8 }, (_, i) => origin.map((value, axis) => ((i >> axis) & 1) ? value + sides[axis] : value) as Point);
  const declarations = faceCorners.map((indices, i) => {
    const p = indices.map(index => points[index]);
    return `@surface #${prefix}_s${i} { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:${signedJson([[p[0], p[3]], [p[1], p[2]]])}; weights:[[1,1],[1,1]]; }`;
  });
  const source = `@model ${prefix}_model { version:0; length-unit:mm; ${declarations.join(' ')} }\n`;
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) throw new Error('Generated union box Source0 refused', { cause: compiled });
  const surfaces = compiled.model.objects.filter((object): object is Surface => object.kind === 'surface');
  if (surfaces.length !== 6 || compiled.model.objects.length !== 6) throw new Error('Union box requires exactly six compiled supports');
  const faces = surfaces.map((surface, i) => {
    const ids = (kind: string) => [0, 1, 2, 3].map(j => `${prefix}_${kind}${i}_${j}`) as Four<string>;
    return buildParametricFace(surface, { faceId: `${prefix}_f${i}`, loopId: `${prefix}_l${i}`, vertexIds: ids('v'), edgeIds: ids('e'), curveIds: ids('c') });
  }) as [FaceBundle, FaceBundle, FaceBundle, FaceBundle, FaceBundle, FaceBundle];
  const ids: AxisBoxShellIds = { shellId: prefix + '_shell',
    faceIds: surfaces.map((_, i) => `${prefix}_gf${i}`) as AxisBoxShellIds['faceIds'],
    vertexIds: points.map((_, i) => `${prefix}_gv${i}`) as AxisBoxShellIds['vertexIds'],
    edgeIds: Array.from({ length: 12 }, (_, i) => `${prefix}_ge${i}`) as AxisBoxShellIds['edgeIds'] };
  const shell = buildAxisBoxShell(origin, sides, faces, ids);
  return { sourceId: prefix + '_src', sourceVersion: 0, source, shell };
}
