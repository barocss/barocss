// O24(b): a stored connector selects a point and frame on a persistent geometry reference. Only the
// options are stored. The frame is derived in part coordinates, then projected to the classic mate's rows.
import type { MateFace, MateRef } from './mates';
import { add, cross, dot, len, scale, sub, unit, type Vec3 } from '../engine/vec3';
import { isRefusal, refusal } from '../engine/refusal';

export interface Connector {
  point?: 'centre' | 'start' | 'mid' | 'end' | 'apex';
  offset?: Vec3;
  /** Degrees about local Z, after flip. */
  turn?: number;
  /** Reverse Z by a half turn about X, before turn and offset. */
  flip?: boolean;
}
export interface ConnectorFrame { kind: 'frame'; point: Vec3; normal: Vec3; x: Vec3 }
const POINTS = ['centre', 'start', 'mid', 'end', 'apex'];
const KEYS = ['point', 'offset', 'turn', 'flip'];

/** Validate boundary data and return an owned JSON value; no coercion or unknown fields. */
export function readConnector(value: unknown): Connector {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw refusal('CONNECTOR_INVALID', 'A connector is an object with point, offset, turn and flip.');
  const o = value as Record<string, unknown>;
  if (Object.keys(o).some(k => !KEYS.includes(k))) throw refusal('CONNECTOR_INVALID', 'Unknown connector field. Use point, offset, turn or flip.');
  if (o.point !== undefined && !POINTS.includes(o.point as string)) throw refusal('CONNECTOR_INVALID', 'Connector point is centre, start, mid, end or apex.');
  if (o.offset !== undefined && (!Array.isArray(o.offset) || o.offset.length !== 3 || ![0, 1, 2].every(k => typeof (o.offset as unknown[])[k] === 'number' && Number.isFinite((o.offset as number[])[k])))) throw refusal('CONNECTOR_INVALID', 'Connector offset is three finite numbers in mm.');
  if (o.turn !== undefined && (typeof o.turn !== 'number' || !Number.isFinite(o.turn))) throw refusal('CONNECTOR_INVALID', 'Connector turn is a finite number in degrees.');
  if (o.flip !== undefined && typeof o.flip !== 'boolean') throw refusal('CONNECTOR_INVALID', 'Connector flip is a boolean.');
  return { ...(o.point !== undefined ? { point: o.point as Connector['point'] } : {}), ...(o.offset !== undefined ? { offset: [...o.offset as Vec3] as Vec3 } : {}), ...(o.turn !== undefined ? { turn: o.turn as number } : {}), ...(o.flip !== undefined ? { flip: o.flip as boolean } : {}) };
}

/** Set or remove a connector, keeping the reference's persistent name and signature. */
export function withConnector(ref: MateRef, at: Connector | null): MateRef {
  const next = { ...ref };
  if (at === null) delete next.at; else next.at = readConnector(at);
  return next;
}

/** Part X projected into the normal plane (part Y if X is parallel). */
function across(z: Vec3): Vec3 {
  const p: Vec3 = Math.abs(z[0]) < 1 - 1e-12 ? [1, 0, 0] : [0, 1, 0];
  return unit(sub(p, scale(z, dot(p, z))));
}
function unavailable(point: string, kind: string): never { throw refusal('CONNECTOR_POINT', `Point ${point} is not available on ${kind}.`); }

/** Resolve a reference's frame. Missing centroids/spans are refused, never replaced by arbitrary points. */
export function connectorOf(face: MateFace, options: { at: Connector; name?: string }): ConnectorFrame {
  const { name = '' } = options, at = readConnector(options.at), point = at.point ?? (face.kind === 'line' ? 'mid' : 'centre');
  let p: Vec3, z: Vec3, x: Vec3;
  switch (face.kind) {
    case 'plane':
      if (point !== 'centre') unavailable(point, face.kind);
      if (!face.centre && !/^(origin:|datum:)/.test(name)) throw refusal('CONNECTOR_UNAVAILABLE', 'This face has no computed area centre.');
      p = face.centre ?? face.point; z = unit(face.normal); x = across(z); break;
    case 'sphere':
      if (point !== 'centre') unavailable(point, face.kind);
      p = face.point; z = [0, 0, 1]; x = [1, 0, 0]; break;
    case 'cylinder': case 'cone': {
      z = unit(face.axis); x = across(z);
      if (point === 'apex' && face.kind === 'cone') { p = face.point; break; }
      if (!['centre', 'start', 'end'].includes(point)) unavailable(point, face.kind);
      if (!face.span && point === 'centre' && name.startsWith('datum:')) { p = face.point; break; }
      if (!face.span || !face.span.every(Number.isFinite)) throw refusal('CONNECTOR_UNAVAILABLE', 'This face has no computed axis span.');
      const t = point === 'start' ? face.span[0] : point === 'end' ? face.span[1] : (face.span[0] + face.span[1]) / 2;
      p = add(face.point, scale(z, t)); break;
    }
    case 'line':
      if (!['start', 'mid', 'end'].includes(point)) unavailable(point, face.kind);
      z = unit(face.axis); x = across(z);
      p = add(face.point, scale(z, point === 'start' ? 0 : point === 'end' ? face.length : face.length / 2)); break;
    case 'circle': {
      z = unit(face.axis); x = face.ends ? unit(sub(face.ends[0], face.point)) : across(z);
      if (point === 'centre') { p = face.point; break; }
      if (!['start', 'mid', 'end'].includes(point) || !face.ends) unavailable(point, face.kind);
      if (point === 'start') p = face.ends[0];
      else if (point === 'end') p = face.ends[1];
      else {
        const v = unit(sub(face.ends[1], face.point));
        let sweep = Math.atan2(dot(z, cross(x, v)), dot(x, v));
        if (sweep <= 0) sweep += 2 * Math.PI;
        p = add(face.point, scale(add(scale(x, Math.cos(sweep / 2)), scale(cross(z, x), Math.sin(sweep / 2))), face.radius));
      }
      break;
    }
  }
  if (at.flip) z = scale(z, -1);
  const angle = ((at.turn ?? 0) % 360) * Math.PI / 180;
  x = add(scale(x, Math.cos(angle)), scale(cross(z, x), Math.sin(angle)));
  const y = cross(z, x), offset = at.offset ?? [0, 0, 0];
  p = add(p, add(add(scale(x, offset[0]), scale(y, offset[1])), scale(z, offset[2])));
  if (![...p, ...z, ...x].every(Number.isFinite) || len(z) < 0.5 || len(x) < 0.5 || p.some(v => Math.abs(v) > 1e6)) throw refusal('CONNECTOR_INVALID', 'Connector frame must be finite and within the coordinate domain (1000000 mm).');
  return { kind: 'frame', point: p, normal: z, x };
}

/** Validate connector data in saved documents, including nested and pending parts. Geometry is resolved later. */
export function documentConnectorError(doc: unknown): string | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const d = doc as Record<string, unknown>;
  for (const item of Array.isArray(d.mates) ? d.mates : []) {
    if (!item || typeof item !== 'object') continue;
    for (const side of ['a', 'b']) {
      const ref = item[side];
      if (!ref || typeof ref !== 'object' || ref.at === undefined) continue;
      try {
        readConnector(ref.at);
        if (item.kind === 'cam' || item.kind === 'lock') throw refusal('CONNECTOR_KIND', 'A cam or lock mate cannot carry connectors.');
      } catch (e) { if (isRefusal(e)) return e.message; throw e; }
    }
  }
  const children = [...(Array.isArray(d.instances) ? d.instances : []), ...(d.pendingParts && typeof d.pendingParts === 'object' ? Object.values(d.pendingParts) : [])];
  for (const child of children) { const error = documentConnectorError(child?.doc); if (error) return error; }
  return null;
}
