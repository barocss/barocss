import { refusal } from './refusal';
import type { StudioDoc } from './doc';
import type { BodyResult } from './evaluate';
import type { DisplayFace, NativeDisplayFace } from './mesh';

/** Resolve the operation's fixed +Y half by native geometry, never by a suffix convention. */
export function cylindricalWrapCarrier(face: DisplayFace): NativeDisplayFace {
  const members = face.nativeFaces ?? [];
  const positive: NativeDisplayFace[] = [];
  for (const m of members) if (m.kind === 'curved' && m.radius !== undefined && m.centroid[1] > 0 && Math.abs(m.centroid[0]) <= 1e-6 * Math.max(1, m.radius)) positive.push(m);
  if (positive.length !== 1 || positive[0].name.includes('+')) throw refusal('BAD_REFERENCE', 'Cylindrical wrap: the selected wall has no unique original +Y half.');
  return positive[0];
}
/** The fixed height comes from the authored circle, not fitted display curvature. */
export function cylindricalWrapRadius(doc: StudioDoc, body: BodyResult): number {
  const source = body.ref ? doc.nodes[body.ref.node] : undefined;
  const sketch = source?.kind === 'extrude' ? doc.nodes[source.sketch] : undefined;
  if (!sketch || sketch.kind !== 'sketch' || sketch.profile !== 'circle') throw refusal('BAD_REFERENCE', 'Cylindrical wrap: select one original circle extrusion.');
  const radius = typeof sketch.radius === 'number' ? sketch.radius : doc.parameters[sketch.radius.parameter];
  if (!Number.isFinite(radius) || radius <= 0) throw refusal('VALUE', 'Cylindrical wrap: the authored cylinder radius is unavailable.');
  return radius;
}
