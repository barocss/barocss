// Read-only manufacturing files. These are the existing generators' results, not approval decisions.
import { OUTPUT_TOOLS } from './outputDefinitions';
export { OUTPUT_TOOLS, OUTPUT_TOOL_NAMES } from './outputDefinitions';
import type { Evaluate } from './tools';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { resolveShopRows, resolveShopTree, provenanceOfTree } from '../engine/shopRows';
import { bomPanelData, purchaseCsv } from '../bom/bom';
import { assemblyPlacedBodies, clearanceMap } from '../team/clearanceMap';
import { documentRevision, verifyBundle, writeBundle } from '../team/bundle';
import { sha256Hex } from '../util/digest';
import { camPackage } from '../machining/camPackage';
import { printLayers } from '../print/layers';
import { madeBodies } from '../engine/elements';

const encoder = new TextEncoder();
const json = (value: unknown): string => JSON.stringify(value, (_key, v: unknown) => ArrayBuffer.isView(v) && !(v instanceof DataView) ? Array.from(v as unknown as ArrayLike<number>) : v, 1) + '\n';
const file = (path: string, mime: string, data: string | Uint8Array) => {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  // bytes are explicit for binary files, as robot exporters' files carry bytes; no host path is accepted.
  return { path, mime, bytes: bytes.length, sha256: sha256Hex(bytes), ...(typeof data === 'string' ? { encoding: 'utf-8', text: data } : { encoding: 'bytes', data: Array.from(bytes) }) };
};
type Output = { content: Record<string, unknown>; summary: string } | { error: string };
const bad = (message: string): Output => ({ error: `[OUTPUT_INPUT] ${message}` });
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export async function runOutputTool(doc: StudioDoc, _bodies: readonly BodyResult[], name: string, args: Record<string, unknown>, evaluate: Evaluate): Promise<Output> {
  const schema = OUTPUT_TOOLS.find(t => t.name === name);
  if (!schema) return bad(`Unknown output ${name}.`);
  const properties = schema.input_schema.properties as Record<string, unknown>;
  const extra = Object.keys(args).filter(k => !(k in properties));
  if (extra.length) return bad(`Unknown arguments: ${extra.join(', ')}.`);
  if (args.expectedRevision !== undefined && (typeof args.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(args.expectedRevision))) return bad('expectedRevision must be a SHA-256 documentRevision.');
  if (args.withMade !== undefined && typeof args.withMade !== 'boolean') return bad('withMade must be boolean.');
  if (args.baseline !== undefined && (typeof args.baseline !== 'string' || !args.baseline.trim())) return bad('baseline must be a nonempty id.');
  if (args.part !== undefined && (typeof args.part !== 'string' || !args.part.trim())) return bad('part must be an existing part id.');
  for (const k of ['toolDiameter', 'near', 'layerHeight']) {
    const value = args[k];
    if (value !== undefined && (!finite(value) || value <= 0 || value > 10000)) return bad(`${k} must be finite, greater than 0 and at most 10000 (mm).`);
  }
  if (args.overhangLimit !== undefined && (!finite(args.overhangLimit) || args.overhangLimit <= 0 || args.overhangLimit >= 90)) return bad('overhangLimit must be greater than 0 and less than 90 degrees.');
  if (args.direction !== undefined && (!Array.isArray(args.direction) || args.direction.length !== 3 || !args.direction.every(finite) || !Number.isFinite(Math.hypot(...args.direction as number[])) || Math.hypot(...args.direction as number[]) < 1e-12)) return bad('direction must contain three finite numbers with nonzero length.');
  if (args.layers !== undefined && (!Array.isArray(args.layers) || args.layers.length < 1 || args.layers.length > 64 || !args.layers.every(k => Number.isInteger(k) && k >= 0) || new Set(args.layers).size !== args.layers.length)) return bad('layers must contain 1 to 64 distinct nonnegative integer indices.');
  try {
    const revision = documentRevision(doc), shopRows = provenanceOfTree(doc);
    if (args.expectedRevision !== undefined && args.expectedRevision !== revision) return { error: `[OUTPUT_STALE] Expected document revision ${String(args.expectedRevision)}, current ${revision}.` };
    if (name === 'output_bom' || name === 'output_purchase_csv' || name === 'output_clearance' || name === 'output_bundle') {
      const preflight = async (source: StudioDoc, parent: StudioDoc | undefined, path: string, owner?: string): Promise<string | null> => {
        const resolved = resolveShopTree(source, parent, owner);
        if (resolved.nodes.length) {
          const evaluation = await evaluate(resolved);
          if (!evaluation?.ok) return `[OUTPUT_EVALUATION] ${path}: ${evaluation ? JSON.stringify(evaluation.error) : 'evaluation returned no result'}`;
        }
        for (const instance of source.instances ?? []) {
          // Clearance sees shown parts; the BOM and bundle include all authored placed parts.
          if (name === 'output_clearance' && instance.hidden) continue;
          const failed = await preflight(instance.doc, resolved, `${path}/${instance.id}`, instance.id);
          if (failed) return failed;
        }
        return null;
      };
      const failure = await preflight(doc, undefined, 'base');
      if (failure) return { error: failure };
    }
    if (name === 'output_bundle') {
      // Keep the authored document in document.bcad. A resolved shop view must never become its source.
      const bundle = await writeBundle(doc, evaluate, args.baseline ? { baseline: args.baseline as string } : {});
      if (!bundle.manifest.complete) return { error: `[OUTPUT_BUNDLE_INCOMPLETE] ${[...bundle.manifest.missing, ...bundle.manifest.stale].join('; ')}` };
      const check = await verifyBundle(path => bundle.files.get(path) ?? null, evaluate);
      if (!check.complete || !check.intact) return { error: `[OUTPUT_BUNDLE_INVALID] ${[...check.missing, ...check.changed, ...check.stale].join('; ')}` };
      return { content: { revision, shopRows, manifest: bundle.manifest, check, files: [...bundle.files].map(([path, bytes]) => file(path, path.endsWith('.json') ? 'application/json' : 'application/octet-stream', path.endsWith('.json') ? new TextDecoder().decode(bytes) : bytes)) }, summary: 'Export bundle: complete and verified' };
    }
    if (name === 'output_bom' || name === 'output_purchase_csv') {
      const data = await bomPanelData(doc, evaluate);
      const files = name === 'output_bom' ? [file('bom.json', 'application/json', json(data))] : [file('purchase.csv', 'text/csv', purchaseCsv(data, args.withMade === true))];
      return { content: { revision, shopRows, bom: data.bom, files }, summary: name === 'output_bom' ? 'BOM exported' : 'Purchase list exported' };
    }
    if (name === 'output_clearance') {
      const map = clearanceMap(await assemblyPlacedBodies(doc, evaluate), args.near === undefined ? {} : { near: args.near as number });
      return { content: { revision, shopRows, map, files: [file('clearance.json', 'application/json', json({ ...map, revision, shopRows }))] }, summary: `Clearance map: ${map.pairs.length} pairs, ${map.pending} exact overlaps pending` };
    }
    const id = typeof args.part === 'string' ? args.part : 'base';
    const source = id === 'base' ? doc : doc.instances?.find(i => i.id === id)?.doc;
    if (!source) return bad(`No part ${id}.`);
    const resolved = { ...resolveShopRows(source, id === 'base' ? undefined : doc), doc: id === 'base' ? resolveShopTree(doc) : resolveShopTree(source, doc, id) };
    const result = await evaluate(resolved.doc);
    if (!result?.ok || !result.bodies.length) return { error: '[OUTPUT_EVALUATION] The selected part has no successfully evaluated bodies.' };
    const context = { revision, part: id, provenance: resolved.provenance };
    if (name === 'output_cam_package') {
      const pack = camPackage(resolved.doc, result.bodies, args.toolDiameter === undefined ? {} : { toolDiameter: args.toolDiameter as number });
      if ('refused' in pack.stock) return { error: `[${pack.stock.refused.code}] ${pack.stock.refused.message}` };
      return { content: { ...context, package: pack, files: [file('cam-package.json', 'application/json', json({ ...pack, ...context }))] }, summary: 'CAM preview package: NOT FOR PRODUCTION' };
    }
    const layerHeight = args.layerHeight === undefined ? 0.2 : args.layerHeight as number;
    // (O160: the layers of what the part's process makes — a bought O-ring or bearing is not printed.)
    const made = madeBodies(resolved.doc.nodes, result.bodies);
    if (!made.length) return { error: '[OUTPUT_EVALUATION] The selected part has no made bodies to print: every body is a bought element.' };
    // Bound layer indexing before the existing generator allocates its chunk index.
    const direction = args.direction as number[] | undefined, axis = direction ?? [0, 0, 1], length = Math.hypot(...axis);
    let lo = Infinity, hi = -Infinity;
    for (const body of made) for (let i = 0; i < body.mesh.positions.length; i += 3) {
      const p = body.mesh.positions, z = (p[i] * axis[0] + p[i + 1] * axis[1] + p[i + 2] * axis[2]) / length;
      lo = Math.min(lo, z); hi = Math.max(hi, z);
    }
    if (Math.ceil((hi - lo) / layerHeight) > 100000) return bad('Print request exceeds 100000 layers; increase layerHeight.');
    const print = printLayers(made.map(b => b.mesh), { ...(args.layerHeight === undefined ? {} : { layerHeight }), ...(direction ? { direction } : {}), ...(args.overhangLimit === undefined ? {} : { overhangLimit: args.overhangLimit as number }) });
    const indices = (args.layers ?? [0]) as number[];
    if (indices.some(k => k >= print.count)) return bad(`Layer index must be below ${print.count}.`);
    const { layer, ...summary } = print;
    const output = { ...summary, ...context, layers: indices.map(k => layer(k)) };
    return { content: { ...context, print: output, files: [file('print-layers.json', 'application/json', json(output))] }, summary: `Print display: ${indices.length} of ${print.count} layers` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: /^\[[A-Z][A-Z0-9_]*\]/.test(message) ? message : `[OUTPUT_FAILED] ${message}` };
  }
}
