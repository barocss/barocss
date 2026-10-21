// IM6 (O82): the quote package — what a moulder needs to quote an injection-moulded part, in one zip: the part as STEP,
// the manufacturability report (IM1–IM5) as JSON and as a page to read, and the request (material, finish and its least
// draft, the pull, the quantity, the part's size, volume and mass, the sourced tolerance, shrink and press limits, the
// document's revision), with a manifest of every file's SHA-256 and what is still open. No price: prices are the
// moulder's. Open — an unstated material, quantity, pull or finish, a failing rule — is said, and the package is not
// called complete while anything is.
import type { StudioDoc } from '../engine/doc';
import { stepFor, type BodyResult } from '../engine/evaluate';
import { lookOf, materialIdOf } from '../app/bodies';
import { massProperties } from '../chat/analysis';
import { materialData, processProfile } from '../library/materials';
import { printability, type PrintabilityReport } from '../print/rules';
import { documentRevision } from '../team/bundle';
import { sha256Hex } from '../team/digest';
import { writeZip } from '../io/zip';
import type { Half } from './parting';

type Evaluate = Parameters<typeof printability>[2];
export const QUOTE_FILES = { step: 'part.step', report: 'dfm.json', page: 'dfm.md', request: 'quote.json', manifest: 'manifest.json' } as const;
export interface QuoteRequest {
  format: 'barocss-quote-request'; version: 1;
  process: 'injection'; revision: string;
  material: { id: string; label: string; basis: 'body' | 'brief' } | null;
  finish: { id: string; label: string; minDraftDeg: number } | null; pull: [number, number, number] | null; quantity: number | null;
  part: { sizeMM: [number, number, number]; volumeMM3: number; massG: number | null; bodies: number };
  tolerance: { mm: number; perMM: number; source: string } | null; shrink: number | null;
  limits: { largestPartMM: [number, number, number] } | null;
  note: string;
}
export interface QuoteManifest { format: 'barocss-quote'; version: 1; files: { path: string; sha256: string; bytes: number }[]; open: string[]; complete: boolean }
const ENC = new TextEncoder(), json = (v: unknown) => JSON.stringify(v, null, 1) + '\n', r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

/** The report as a page: the request, each rule with its status and why, the open items. */
function page(name: string, req: QuoteRequest, rep: PrintabilityReport, open: readonly string[]): string {
  const row = (r: PrintabilityReport['rules'][number]) => `| ${r.id} | ${r.status} | ${(r.message + (r.why ? ` — ${r.why}` : '')).replace(/\|/g, '/')} |`;
  return [
    `# ${name}: injection moulding quote request`, '',
    `Revision \`${req.revision}\`. No price: prices are the moulder's.`, '',
    '| | |', '|---|---|',
    `| material | ${req.material ? `${req.material.label} (${req.material.basis === 'brief' ? 'the brief\'s, stated' : 'set on the body'})` : '**not set**'} |`,
    `| finish | ${req.finish ? `${req.finish.label}: at least ${req.finish.minDraftDeg}° draft` : '**not set**'} |`,
    `| pull | ${req.pull ? req.pull.join(', ') : '**not set**'} |`,
    `| quantity | ${req.quantity ?? '**not stated**'} |`,
    `| part | ${req.part.sizeMM.join(' × ')} mm, ${req.part.volumeMM3} mm³${req.part.massG !== null ? `, ${req.part.massG} g` : ''} |`,
    `| tolerance | ${req.tolerance ? `±${req.tolerance.mm} mm + ${req.tolerance.perMM} mm/mm (${req.tolerance.source})` : '—'} |`,
    `| shrink | ${req.shrink ?? 'no sourced value for this material'} |`, '',
    '## Manufacturability (IM1–IM5)', '', '| rule | status | |', '|---|---|---|', ...rep.rules.map(row), '',
    '## Open', '', ...(open.length ? open.map(o => `- ${o}`) : ['- nothing: the package is complete']), '',
  ].join('\n');
}

/**
 * The quote package for an injection-moulded part: its files and manifest. `quantity` the parts asked for (else the
 * brief's stated quantity); the pull, finish and halves as the report takes them (else the document's).
 */
export async function quotePackage(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, o: { name?: string; quantity?: number; direction?: readonly number[]; finish?: string; sides?: Readonly<Record<string, Half>> } = {}): Promise<{ files: Map<string, Uint8Array>; manifest: QuoteManifest; request: QuoteRequest; zip: Uint8Array } | { error: string }> {
  if (doc.process !== 'injection') return { error: `a quote package is for injection moulding: the part's process is ${doc.process ?? 'not chosen'}` };
  if (!bodies.length) return { error: 'the part has no body' };
  if (o.quantity !== undefined && !(Number.isInteger(o.quantity) && o.quantity > 0)) return { error: '"quantity" is a whole number above 0' };
  const name = o.name ?? 'part', profile = processProfile('injection')!, t = (k: string) => profile.thresholds[k];
  const rep = await printability(doc, bodies, evaluate, { ...(o.direction ? { direction: o.direction } : {}), ...(o.finish ? { finish: o.finish } : {}), ...(o.sides ? { sides: o.sides } : {}) });
  const step = stepFor(doc, name);
  // The request: what was asked and what the part is, every limit with its source.
  const ids = [...new Set(bodies.map(b => materialIdOf(doc, b) ?? null))], id = ids.length === 1 ? ids[0] : null, m = id ? materialData(id) : undefined;
  const own = !!id && bodies.every(b => lookOf(doc, b).material === id);
  const briefQty = doc.brief?.quantity?.basis === 'stated' && Number.isInteger(Number(doc.brief.quantity.value)) ? Number(doc.brief.quantity.value) : null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.mesh.bounds.min[k]); hi[k] = Math.max(hi[k], b.mesh.bounds.max[k]); }
  const mass = massProperties(doc, bodies) as { mass_g: number | null; assumed?: boolean }[];
  const finish = rep.mould?.finish ? profile.finishes?.find(f => f.id === rep.mould!.finish) : undefined;
  const request: QuoteRequest = {
    format: 'barocss-quote-request', version: 1, process: 'injection', revision: documentRevision(doc),
    material: id && m ? { id, label: m.label, basis: own ? 'body' : 'brief' } : null,
    finish: finish ? { id: finish.id, label: finish.label, minDraftDeg: finish.draftMinDeg } : null,
    pull: rep.direction ? rep.direction.map(r6) as [number, number, number] : null, quantity: o.quantity ?? briefQty,
    part: { sizeMM: [0, 1, 2].map(k => r6(hi[k] - lo[k])) as [number, number, number], volumeMM3: r6(bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0)), massG: id && m ? r6(mass.reduce((s, x) => s + (x.mass_g ?? 0), 0)) : null, bodies: bodies.length },
    tolerance: t('tolMM') && t('tolResinMMPerMM') ? { mm: t('tolMM').value, perMM: t('tolResinMMPerMM').value, source: t('tolMM').page?.url ?? t('tolMM').source } : null,
    shrink: m?.mouldShrink ?? null,
    limits: t('maxPartLongMM') ? { largestPartMM: [t('maxPartLongMM').value, t('maxPartWideMM').value, t('maxPartDepthMM').value] } : null,
    note: 'a request for quote, not a price; every value from the part or a sourced page (see dfm.json for each rule\'s source)',
  };
  // What is still open: the request's gaps, the failing rules, the unknown ones.
  const open: string[] = [];
  if (!request.material) open.push(ids.length > 1 ? 'the bodies are of different materials: one material for the part' : 'the material is not set (set_material, or the brief\'s stated material)');
  if (request.quantity === null) open.push('the quantity is not stated (the brief\'s quantity, or "quantity")');
  if (!request.pull) open.push('the pull direction is not set');
  if (!request.finish) open.push('the surface finish is not set');
  if ('error' in step) open.push(`no STEP: ${step.error}`);
  for (const r of rep.rules) if (r.status === 'fail') open.push(`${r.id} fails: ${r.message}`);
  for (const r of rep.rules) if (r.status === 'unknown' && !['pull', 'finish'].includes(r.id)) open.push(`${r.id} unknown: ${r.why ?? r.message}`);
  const files = new Map<string, Uint8Array>();
  if (!('error' in step)) files.set(QUOTE_FILES.step, ENC.encode(step.text));
  files.set(QUOTE_FILES.report, ENC.encode(json(rep)));
  files.set(QUOTE_FILES.page, ENC.encode(page(name, request, rep, open)));
  files.set(QUOTE_FILES.request, ENC.encode(json(request)));
  const manifest: QuoteManifest = { format: 'barocss-quote', version: 1, files: [...files].map(([path, bytes]) => ({ path, sha256: sha256Hex(bytes), bytes: bytes.length })), open, complete: open.length === 0 };
  files.set(QUOTE_FILES.manifest, ENC.encode(json(manifest)));
  const zip = await writeZip([...files].map(([n, data]) => ({ name: n, data, deflate: true })), new Date(Date.UTC(2026, 0, 1)));
  return { files, manifest, request, zip };
}
