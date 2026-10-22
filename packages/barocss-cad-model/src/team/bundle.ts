import { resolveShopTree } from '../engine/shopRows';
// The export bundle (A8.6, O32's addendum, O39): a portable folder that carries what an approval stands on. The source
// document (as saved) and its revision digest; the approved BOM baseline and its ancestors; each part's materials with
// their sources and basis; each analysis result with its fingerprint and its freshness when written; the ECR history
// with its pins. A manifest lists every other file with its SHA-256 and size, and what is missing or stale: it is
// complete only when nothing is. Read back — in a fresh process, from the files alone — every pin is checked again,
// and what is missing, changed or stale is listed; it is never said complete when something is.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Evaluate } from '../chat/tools';
import { encodeStudioFile, readStudioFile } from '../engine/container';
import { lookOf } from '../app/bodies';
import { briefMaterial } from '../chat/brief';
import { MATERIALS_DATA, materialData } from '../library/materials';
import { readBaselines, verifyBaseline, type Baseline } from './baseline';
import { digestOf, sha256Hex } from './digest';
import { readEcrs, verifyEcrPin, type Ecr } from './ecr';
import { bomResult, freshnessOf, massResult, requirementResults, type Freshness, type Result } from './freshness';
import { revisionContent } from './team';

export const BUNDLE_FILES = { document: 'document.bcad', baseline: 'baseline.json', materials: 'materials.json', results: 'results.json', ecrs: 'ecrs.json', manifest: 'manifest.json' } as const;
export interface BundleFile { path: string; sha256: string; bytes: number }
export interface Manifest {
  format: 'barocss-bundle'; version: 1;
  document: { file: string; revision: string };
  baseline: { id: string; digest: string } | null;
  files: BundleFile[];
  missing: string[]; stale: string[]; complete: boolean;
}
export interface MaterialEntry { part: string; body: string; material: string | null; label: string | null; densityGPerCm3: number | null; basis: 'body' | 'brief' | 'default'; sources: Record<string, string> }
export interface BundleCheck { complete: boolean; intact: boolean; missing: string[]; changed: string[]; stale: string[]; manifestSaidComplete: boolean | null }

/** A document's revision digest: the SHA-256 of its revision fields (what A7's revision reads). */
export const documentRevision = (doc: StudioDoc) => digestOf(revisionContent(doc));
const ENCODER = new TextEncoder();
const bytesOf = (x: Uint8Array | string) => (typeof x === 'string' ? ENCODER.encode(x) : x);
const json = (v: unknown) => JSON.stringify(v, null, 1) + '\n';

/** Each body's material, its library sources (their texts) and basis: its own, the brief's, or none (the default, assumed). */
export async function materialsOf(doc: StudioDoc, evaluate: Evaluate): Promise<MaterialEntry[]> {
  doc = resolveShopTree(doc);
  const out: MaterialEntry[] = [], parts: [string, StudioDoc][] = [...(doc.nodes.length ? [['base', doc] as [string, StudioDoc]] : []), ...(doc.instances ?? []).map(i => [i.id, i.doc] as [string, StudioDoc])];
  for (const [part, d] of parts) {
    const e = await evaluate(d), bodies: readonly BodyResult[] = e?.ok ? e.bodies : [];
    for (const b of bodies) {
      const own = lookOf(d, b).material, id = own ?? briefMaterial(d), m = materialData(id), sources: Record<string, string> = {};
      if (m) for (const [field, s] of Object.entries(m.sources)) sources[field] = `${s}: ${MATERIALS_DATA.sources[s] ?? '?'}`;
      out.push({ part, body: b.key, material: id ?? null, label: m?.label ?? null, densityGPerCm3: m?.densityGPerCm3 ?? null, basis: own ? 'body' : id ? 'brief' : 'default', sources });
    }
  }
  return out;
}
const materialGaps = (ms: readonly MaterialEntry[]) => ms.filter(m => !m.sources.densityGPerCm3).map(m => `material source: ${m.part}/${m.body} (${m.basis === 'default' ? 'none set: the default, assumed' : `${m.material}: not in the material library`})`);
/** The standard results a bundle carries when none are given: the BOM, each part's mass and requirements. */
export async function standardResults(doc: StudioDoc, evaluate: Evaluate, run = 'B1'): Promise<Result[]> {
  const out: Result[] = [await bomResult(doc, evaluate, run)];
  for (const inst of doc.instances ?? []) { out.push(await massResult(doc, evaluate, run, inst.id)); if (inst.doc.requirements?.length) out.push(...(await requirementResults(doc, evaluate, run, inst.id))); }
  return out;
}
const resultGaps = (rs: readonly { result: Result; freshness: Freshness }[]) => ({
  missing: rs.filter(x => x.result.status !== 'ok').map(x => `result ${x.result.id}: ${x.result.status}${x.result.why ? ` (${x.result.why})` : ''}`),
  stale: rs.filter(x => x.result.status === 'ok' && x.freshness.state !== 'current').map(x => `result ${x.result.id}: ${x.freshness.state} (${x.freshness.state === 'stale' ? `${x.freshness.changed.join(', ')} changed` : x.freshness.unresolved.map(u => u.message).join('; ')})`),
});
/** A baseline and its ancestors, root last. */
function chainOf(log: readonly Baseline[], id: string): Baseline[] {
  const out: Baseline[] = [];
  for (let b = log.find(x => x.id === id), guard = 0; b && guard < 4096; guard++) { out.push(b); b = b.parent ? log.find(x => x.id === b!.parent) : undefined; }
  return out;
}

/**
 * The bundle's files, by path: the document as saved, the baseline chain, the materials, the results (the standard set
 * when none are given) with their freshness, the ECRs, and the manifest over them. `baseline`: the approved one it
 * carries (else the newest approved; none: missing).
 */
export async function writeBundle(doc: StudioDoc, evaluate: Evaluate, o: { baseline?: string; results?: readonly Result[] } = {}): Promise<{ files: Map<string, Uint8Array>; manifest: Manifest }> {
  const missing: string[] = [], stale: string[] = [], log = readBaselines(doc.baselines).baselines;
  const chosen = o.baseline ? log.find(b => b.id === o.baseline) : [...log].reverse().find(b => b.state === 'approved');
  if (!chosen) missing.push(o.baseline ? `baseline ${o.baseline}: not in the document` : 'an approved BOM baseline: none');
  else {
    if (chosen.state !== 'approved') missing.push(`an approved BOM baseline: ${chosen.id} is ${chosen.state}`);
    const v = verifyBaseline(doc, chosen.id);
    if (!v.intact) missing.push(...v.mismatches.map(m => `baseline ${m}: does not verify`));
    if (!v.current) stale.push(`baseline ${chosen.id}: ${v.changed.join(', ')} changed since`);
  }
  const materials = await materialsOf(doc, evaluate); missing.push(...materialGaps(materials));
  const results: { result: Result; freshness: Freshness }[] = [];
  for (const r of o.results ?? await standardResults(doc, evaluate)) results.push({ result: r, freshness: await freshnessOf(r, doc, evaluate) });
  const g = resultGaps(results); missing.push(...g.missing); stale.push(...g.stale);
  const ecrs = readEcrs(doc.ecrs).ecrs; for (const e of ecrs) missing.push(...verifyEcrPin(e).map(m => `ECR ${m}: does not verify`));
  const files = new Map<string, Uint8Array>([
    [BUNDLE_FILES.document, encodeStudioFile(doc)],
    [BUNDLE_FILES.baseline, bytesOf(json({ version: 1, baselines: chosen ? chainOf(log, chosen.id) : [] }))],
    [BUNDLE_FILES.materials, bytesOf(json({ version: 1, materials }))],
    [BUNDLE_FILES.results, bytesOf(json({ version: 1, results }))],
    [BUNDLE_FILES.ecrs, bytesOf(json({ version: 1, ecrs }))],
  ]);
  const manifest: Manifest = {
    format: 'barocss-bundle', version: 1, document: { file: BUNDLE_FILES.document, revision: documentRevision(doc) },
    baseline: chosen ? { id: chosen.id, digest: chosen.digest } : null,
    files: [...files].map(([path, b]) => ({ path, sha256: sha256Hex(b), bytes: b.length })),
    missing, stale, complete: !missing.length && !stale.length,
  };
  files.set(BUNDLE_FILES.manifest, bytesOf(json(manifest)));
  return { files, manifest };
}

const parse = <T>(b: Uint8Array | null): T | null => { if (!b) return null; try { return JSON.parse(new TextDecoder().decode(b)) as T; } catch { return null; } };
/**
 * A bundle read back from its files alone (`read(path)`: the bytes, or null when the file is not there): each file's
 * digest and size, the document's revision, the baseline's anchor (the manifest's digest), chain and pins against the
 * document, each ECR's pin, each result's freshness against the document, each body's material source. Complete only
 * when nothing is missing, changed or stale.
 */
export async function verifyBundle(read: (path: string) => Uint8Array | null, evaluate: Evaluate): Promise<BundleCheck> {
  const missing: string[] = [], changed: string[] = [], stale: string[] = [];
  const done = (said: boolean | null): BundleCheck => ({ complete: !missing.length && !changed.length && !stale.length, intact: !changed.length, missing, changed, stale, manifestSaidComplete: said });
  const manifest = parse<Manifest>(read(BUNDLE_FILES.manifest));
  if (!manifest || manifest.format !== 'barocss-bundle' || manifest.version !== 1) { missing.push(`${BUNDLE_FILES.manifest}: ${manifest ? 'not a barocss-bundle version 1' : 'missing or not JSON'}`); return done(null); }
  const got = new Map<string, Uint8Array>();
  for (const f of manifest.files) {
    const b = read(f.path);
    if (!b) { missing.push(`${f.path}: missing`); continue; }
    if (b.length !== f.bytes || sha256Hex(b) !== f.sha256) changed.push(`${f.path}: its digest is not the manifest's`);
    else got.set(f.path, b);
  }
  for (const want of Object.values(BUNDLE_FILES)) if (want !== BUNDLE_FILES.manifest && !manifest.files.some(f => f.path === want)) missing.push(`${want}: not in the manifest`);
  // (Nothing past a file that does not match is read from it: its content is not the one pinned.)
  const docBytes = got.get(manifest.document.file);
  let doc: StudioDoc | null = null;
  if (docBytes) {
    const r = await readStudioFile(docBytes);
    if ('error' in r) changed.push(`${manifest.document.file}: ${r.error}`);
    else if (documentRevision(r.doc) !== manifest.document.revision) changed.push(`${manifest.document.file}: its revision is not the manifest's`);
    else doc = r.doc;
  }
  const chain = parse<{ baselines: Baseline[] }>(got.get(BUNDLE_FILES.baseline) ?? null)?.baselines ?? null;
  if (!manifest.baseline) missing.push('an approved BOM baseline: none');
  else if (chain && doc) {
    const top = chain.find(b => b.id === manifest.baseline!.id);
    if (!top) missing.push(`baseline ${manifest.baseline.id}: not in ${BUNDLE_FILES.baseline}`);
    else {
      if (top.digest !== manifest.baseline.digest) changed.push(`baseline ${top.id}: its digest is not the manifest's`);
      if (top.state !== 'approved') missing.push(`an approved BOM baseline: ${top.id} is ${top.state}`);
      const v = verifyBaseline({ ...doc, baselines: { version: 1, baselines: chain } }, top.id);
      changed.push(...v.mismatches.map(m => `baseline ${m}`));
      if (!v.current) stale.push(`baseline ${top.id}: ${v.changed.join(', ')} changed since`);
    }
  }
  const ecrs = parse<{ ecrs: Ecr[] }>(got.get(BUNDLE_FILES.ecrs) ?? null)?.ecrs;
  for (const e of ecrs ?? []) changed.push(...verifyEcrPin(e).map(m => `ECR ${m}`));
  const results = parse<{ results: { result: Result }[] }>(got.get(BUNDLE_FILES.results) ?? null)?.results;
  if (results && doc) {
    const now: { result: Result; freshness: Freshness }[] = [];
    for (const { result } of results) now.push({ result, freshness: await freshnessOf(result, doc, evaluate) });
    const g = resultGaps(now); missing.push(...g.missing); stale.push(...g.stale);
  }
  if (doc) missing.push(...materialGaps(await materialsOf(doc, evaluate)));
  return done(manifest.complete);
}
