import { fillPatternDocumentProblem } from './fillFeaturePattern';
import { curvePatternDocumentProblem } from './curveFeaturePattern';
import { documentConnectorError } from '../assembly/connectors';
// Reading a saved .bcad file: its format and schema checked, what was filled in said, one from an older
// or newer studio or with unknown features refused — the file itself is left as it is until it is saved again.
import { rectangularPatternDocumentProblem, textDocumentProblem, prefixDoc, NODE_EXTRA_FIELDS, frameSegmentEnds, type ModelFrameSegment, type StudioDoc } from './doc';
import { withIds } from './ids';
import { documentBeadOwnershipError } from '../frames/beadOwnership';
import { checkDocumentPrintPreview } from './printPreview';
import { checkDocumentBearingHousing } from './bearingContext';
import { firstProblem, refusal } from './refusal';
import { patternsProblem } from '../assembly/patternCheck';
import { assertRouteBundleDocument } from './routeBundle';
import { assertSavedDrawingDocument } from './savedDrawing';
import { sketch3dRefusal, type Constraint3D, type V3 } from '../frames/sketch3d';

/**
 * 3: bodies are keyed by feature ids (`b<k>` for `n<k>`), not by index. 4: the route bundle. Older schemas are refused.
 */
// Only schemas 3 and 4 are read; explicit route bundles require reader support for 4.
export const SCHEMA = 3;
const MAX_READ_SCHEMA = 4;
const KINDS = new Set(['skeleton', 'cylindrical-wrap', 'text', 'text-relief', 'sketch', 'extrude', 'revolve', 'decimate', 'translate', 'rotate', 'mirror', 'scale', 'linear-pattern', 'linear-feature-pattern', 'rectangular-feature-pattern', 'curve-feature-pattern', 'fill-feature-pattern', 'circular-pattern', 'union', 'intersect', 'difference', 'rib', 'rectangular-relief', 'split', 'separate', 'sweep', 'sweep-curve', 'loft', 'import', 'mesh', 'thread', 'shell', 'chamfer', 'fillet', 'draft', 'full-round', 'face-fillet', 'face-thread', 'thicken', 'band-surface', 'sew', 'subd', 'gear', 'internal-gear', 'bevel-gear', 'worm', 'worm-wheel', 'spring', 'cam', 'sprocket', 'pulley', 'belt', 'coupling', 'connector-opening', 'connector-body', 'gusset', 'end-cap', 'shaft', 'key', 'keyway', 'retaining-ring', 'pin', 'bearing', 'oring-gland', 'oring', 'rack', 'library', 'hole', 'sheet-base', 'sheet-contour', 'sheet-flange', 'sheet-corner-relief', 'frame-member', 'frame']);

export function readStudioDoc(text: string): { doc: StudioDoc; notes: string[] } | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: 'This is not a BaroCSS model file (it is not JSON).' }; }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== 'object' || o.format !== 'barocss-cad-model') return { error: 'This is not a BaroCSS model file (no barocss-cad-model format).' };
  if (!Array.isArray(o.nodes)) return { error: 'This model file has no features list.' };
  const connectorError = documentConnectorError(o);
  if (connectorError) return { error: connectorError };
  const previewProblem = firstProblem(checkDocumentPrintPreview(o));
  if (previewProblem) return { error: previewProblem };
  const housingProblem = firstProblem(checkDocumentBearingHousing(o));
  if (housingProblem) return { error: housingProblem };
  const ownershipError = documentBeadOwnershipError(o);
  if (ownershipError) return { error: ownershipError };
  const patternError = patternsProblem(o as Parameters<typeof patternsProblem>[0]);
  if (patternError) return { error: refusal('PATTERN_VALUE', patternError).message };
  const schema = o.schema === undefined ? 0 : Number(o.schema), notes: string[] = [];
  if (!Number.isInteger(schema) || schema < 0) return { error: `This model file has an unreadable schema (${String(o.schema)}).` };
  if (schema > MAX_READ_SCHEMA) return { error: `This model was saved by a newer cad-studio (schema ${schema}; this one reads up to ${MAX_READ_SCHEMA}). Open it there, or save it from there in an older form.` };
  if (schema < 3) return { error: `This model was saved in an older form (${o.schema === undefined ? 'no schema' : `schema ${schema}`}); this cad-studio reads schemas 3 and 4. Re-save it with a studio that reads it.` };
  try { assertSavedDrawingDocument(o); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  try { assertRouteBundleDocument(o); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  const unknown = [...new Set((o.nodes as Record<string, unknown>[]).map(n => String(n?.kind)).filter(k => !KINDS.has(k)))];
  if (unknown.length) return { error: `This model has features this cad-studio does not know: ${unknown.join(', ')}.` };
  if (o.units !== undefined && o.units !== 'mm') return { error: `This model is in ${String(o.units)}: only millimetre models are read.` };
  if (o.units === undefined) notes.push('no units given: read as millimetres');
  const parameters = o.parameters && typeof o.parameters === 'object' ? o.parameters as Record<string, number> : (notes.push('no parameters list: started empty'), {});
  const bad = Object.entries(parameters).filter(([, v]) => typeof v !== 'number' || !Number.isFinite(v)).map(([k]) => k);
  if (bad.length) return { error: `Parameters without a number: ${bad.join(', ')}.` };
  const idProblem = instanceIdProblem(o, '');
  if (idProblem) return { error: refusal('VALUE', idProblem).message };
  const skeletonProblem = skeletonDocumentProblem({ ...o, parameters });
  if (skeletonProblem) return { error: skeletonProblem };
  const fillProblem = fillPatternDocumentProblem({ ...o, parameters });
  if (fillProblem) return { error: fillProblem };
  const curveProblem = curvePatternDocumentProblem({ ...o, parameters });
  if (curveProblem) return { error: curveProblem };
  const patternProblem = rectangularPatternDocumentProblem({ ...o, parameters });
  if (patternProblem) return { error: patternProblem };
  const textProblem = textDocumentProblem({ ...o, parameters });
  if (textProblem) return { error: textProblem };
  const doc: StudioDoc = withIds({ ...(o as unknown as StudioDoc), format: 'barocss-cad-model' as const, schema: schema === 4 ? 4 : SCHEMA, units: 'mm' as const, parameters });
  try { assertRouteBundleDocument(doc); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  return { doc: { ...doc, outputs: prefixDoc(doc, doc.nodes.length).outputs }, notes };
}

// Raw skeleton structure only: no solving, defaults or coordinate changes.
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const SKELETON_FIELDS = new Set(['kind', 'points', 'segments', 'name', 'constraints']);
const FRAME_SEGMENT_FIELDS = new Set(['from', 'to', 'through', 'center']);
const vector = (value: unknown): value is V3 => Array.isArray(value) && value.length === 3 && finite(value[0]) && finite(value[1]) && finite(value[2]);
const direction = (value: unknown): boolean => vector(value) && Math.hypot(...value) > 0 && Number.isFinite(Math.hypot(...value));
const axis = (value: unknown): boolean => value === 'x' || value === 'y' || value === 'z';

function dimension(value: unknown, parameters: Record<string, unknown>): number | undefined {
  if (finite(value)) return value;
  if (record(value) && Object.keys(value).length === 1 && typeof value.parameter === 'string' && Object.hasOwn(parameters, value.parameter) && finite(parameters[value.parameter])) return parameters[value.parameter] as number;
  return undefined;
}

function dimensionPoint(value: unknown, parameters: Record<string, unknown>): boolean {
  if (!Array.isArray(value) || value.length !== 3) return false;
  for (const x of value) if (dimension(x, parameters) === undefined) return false;
  return true;
}
const pointIndex = (value: unknown, count: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < count;
function skeletonField(key: string): boolean {
  if (SKELETON_FIELDS.has(key)) return true;
  // Read the existing field list only when called, after the document module has initialized.
  for (const extra of NODE_EXTRA_FIELDS) if (key === extra) return true;
  return false;
}

function frameCacheProblem(node: Record<string, unknown>, parameters: Record<string, unknown>): string | null {
  if (!Array.isArray(node.points) || !Array.isArray(node.segments)) return 'requires its saved points and segments arrays, with finite or parameter coordinates';
  for (const p of node.points) if (!dimensionPoint(p, parameters)) return 'requires its saved points and segments arrays, with finite or parameter coordinates';
  const count = node.points.length;
  for (const segment of node.segments) {
    if (Array.isArray(segment)) {
      if (segment.length !== 2 || !pointIndex(segment[0], count) || !pointIndex(segment[1], count)) return 'cached segment endpoints must name saved points';
    } else {
      if (!record(segment) || Object.hasOwn(segment, 'through') === Object.hasOwn(segment, 'center')) return 'cached object segments need from, to and exactly one of through or center';
      for (const key of Object.keys(segment)) if (!FRAME_SEGMENT_FIELDS.has(key)) return 'cached object segments need from, to and exactly one of through or center';
      for (const end of frameSegmentEnds(segment as unknown as ModelFrameSegment)) if (!pointIndex(end, count)) return 'cached object segment indices and center must name saved points or finite coordinates';
      if (Object.hasOwn(segment, 'through') ? !pointIndex(segment.through, count) : !dimensionPoint(segment.center, parameters)) return 'cached object segment indices and center must name saved points or finite coordinates';
    }
  }
  return null;
}

function constraintProblem(value: unknown, parameters: Record<string, unknown>): string | null {
  if (!record(value)) return 'a constraint must be an object';
  switch (value.kind) {
    case 'coincident': case 'parallel': case 'perpendicular': return null;
    case 'length': case 'distance': return dimension(value.value, parameters) === undefined ? 'value must be finite or name a finite document parameter' : null;
    case 'angle': return dimension(value.degrees, parameters) === undefined ? 'degrees must be finite or name a finite document parameter' : null;
    case 'fixed': return value.at === undefined || vector(value.at) ? null : 'fixed.at must be three finite numbers';
    case 'along': return axis(value.axis) || direction(value.axis) ? null : 'along.axis must be x, y, z or a finite nonzero vector';
    case 'on-axis': return axis(value.axis) || record(value.axis) && vector(value.axis.origin) && direction(value.axis.direction) ? null : 'on-axis.axis needs an axis name or finite origin and nonzero direction';
    case 'on-plane': return record(value.plane) && vector(value.plane.origin) && direction(value.plane.normal) ? null : 'on-plane.plane needs a finite origin and nonzero normal';
    default: return `unknown constraint kind ${String(value.kind)}`;
  }
}

function nodeProblem(node: Record<string, unknown>, parameters: Record<string, unknown>): string | null {
  for (const key of Object.keys(node)) if (!skeletonField(key)) return `unknown field ${key}`;
  if (node.id !== undefined && typeof node.id !== 'string') return 'id must be text';
  if (node.name !== undefined && typeof node.name !== 'string') return 'name must be text';
  if (!Array.isArray(node.points)) return 'points must be [x, y, z] arrays of finite numbers or finite document parameters';
  for (const p of node.points) if (!dimensionPoint(p, parameters)) return 'points must be [x, y, z] arrays of finite numbers or finite document parameters';
  const points = node.points;
  if (!Array.isArray(node.segments)) return 'segments must be pairs of integer indices of existing points';
  for (const s of node.segments) if (!Array.isArray(s) || s.length !== 2 || !pointIndex(s[0], points.length) || !pointIndex(s[1], points.length)) return 'segments must be pairs of integer indices of existing points';
  if (node.constraints === undefined) return null;
  if (!Array.isArray(node.constraints)) return 'constraints must be an array';
  // The evaluator bypasses an empty list; preserve parameter coordinates in that case too.
  if (!node.constraints.length) return null;
  for (const p of points) if (!vector(p)) return 'points with nonempty constraints must be finite numeric coordinates';
  const resolved: Constraint3D[] = [];
  for (const [i, value] of node.constraints.entries()) {
    const why = constraintProblem(value, parameters);
    if (why) return `constraints[${i}]: ${why}`;
    const c = value as Record<string, unknown>, key = c.kind === 'angle' ? 'degrees' : c.kind === 'length' || c.kind === 'distance' ? 'value' : null;
    resolved.push((key ? { ...c, [key]: dimension(c[key], parameters) } : c) as Constraint3D);
  }
  return sketch3dRefusal(points as V3[], node.segments as [number, number][], resolved);
}

/** A part's id never holds "/" (it joins a path to a part inside a sub-assembly: `sub1/p2`): the first that does, in words. */
function instanceIdProblem(raw: unknown, where: string): string | null {
  if (!record(raw) || !Array.isArray(raw.instances)) return null;
  for (const [i, instance] of raw.instances.entries()) {
    if (!record(instance)) continue;
    if (typeof instance.id === 'string' && instance.id.includes('/')) return `${where}instances[${i}]: the part id "${instance.id}" cannot hold "/", which names a part inside a sub-assembly (sub1/p2). Rename the id.`;
    const inner = instanceIdProblem(instance.doc, `${where}instances[${i}].doc.`);
    if (inner) return inner;
  }
  return null;
}

/** Existing nested part and pending-part documents use their own parameters and node indices. */
function skeletonDocumentProblem(input: unknown): string | null {
  const stack: { raw: unknown; where: string }[] = [{ raw: input, where: '' }], seen = new Set<object>();
  while (stack.length) {
    const { raw, where } = stack.pop()!;
    if (!record(raw) || seen.has(raw)) continue;
    seen.add(raw);
    const parameters = record(raw.parameters) ? raw.parameters : {}, nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
    for (const [i, node] of nodes.entries()) {
      if (!record(node)) continue;
      if (node.kind === 'skeleton') {
        const why = nodeProblem(node, parameters);
        if (why) return `${where}nodes[${i}].skeleton: ${why}`;
      }
      // frameGeometry supports forward references. Do not replace cached frame geometry while reading.
      if (node.kind === 'frame' && record(node.follows) && Object.hasOwn(node.follows, 'skeleton')) {
        const at = node.follows.skeleton;
        if (Object.keys(node.follows).length !== 1 || !Number.isInteger(at) || (at as number) < 0 || !record(nodes[at as number]) || nodes[at as number].kind !== 'skeleton') return `${where}nodes[${i}].frame.follows.skeleton must name an existing skeleton without another follows discriminator`;
        const why = frameCacheProblem(node, parameters);
        if (why) return `${where}nodes[${i}].frame following a skeleton ${why}`;
      }
    }
    for (const [i, instance] of (Array.isArray(raw.instances) ? raw.instances : []).entries()) {
      if (!record(instance)) continue;
      stack.push({ raw: instance.doc, where: `${where}instances[${i}].doc.` });
    }
    if (record(raw.pendingParts)) for (const [id, pending] of Object.entries(raw.pendingParts)) {
      if (!record(pending)) continue;
      stack.push({ raw: pending.doc, where: `${where}pendingParts[${JSON.stringify(id)}].doc.` });
    }
  }
  return null;
}
