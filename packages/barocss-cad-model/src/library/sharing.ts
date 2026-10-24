// LIB4 (D64): what may be shared, and the check before it is. The data rules (peer, 2026-10-18): a team or user library
// needs a licence — without one it loads as "unlicensed — private use only" and is never shared; every given value is
// sourced or flagged an estimate (LIB1 refuses others), and the estimates are counted; a library goes to the team only
// when it loads cleanly, every part builds valid in every variant, and its declared fits pass — that check, its time
// and the kernel's version kept beside it; another model's geometry is never a library part (LIB1 refuses import,
// mesh and sewn surfaces); a library an agent wrote is marked so until a person confirms it. Kernel only: the studio
// and the chat server run the same check.
import { CAD_KERNEL_VERSION, checkLibraryFit, checkOutput, outputOf, evaluateCadPart, instantiateLibraryPart, loadCadLibrary, type CadLibrary } from '@barocss/cad';

/** A library's licence as given, or null: unlicensed, private use only. */
export const licenseOf = (lib: CadLibrary): string | null => typeof lib.manifest.license === 'string' && lib.manifest.license.trim() ? lib.manifest.license.trim() : null;
export const UNLICENSED = 'unlicensed — private use only';
/** How many given parameter values are estimates, over all parts. */
export const estimateCount = (lib: CadLibrary): number => lib.manifest.parts.reduce((n, p) => n + Object.values(p.parameters).filter(q => q.estimate === true && typeof q.value === 'number').length, 0);

/** The check before sharing, kept beside the library: when, by which kernel, what was built, what failed. */
export interface LibraryCheck {
  readonly ok: boolean; readonly at: string; readonly kernel: string; readonly library: string; readonly version: string;
  /** Parts × variants built, fits measured. */
  readonly built: number; readonly fits: number;
  readonly problems: readonly string[];
}

/** Loads the library, builds every part in every variant (its outputs valid), and checks its declared fits. */
export function checkLibraryForSharing(json: unknown, now = new Date()): LibraryCheck {
  const problems: string[] = [];
  let lib: CadLibrary;
  try { lib = loadCadLibrary(json); }
  catch (cause) { return { ok: false, at: now.toISOString(), kernel: CAD_KERNEL_VERSION, library: '?', version: '?', built: 0, fits: 0, problems: [cause instanceof Error ? cause.message : String(cause)] }; }
  let built = 0, fits = 0;
  for (const p of lib.manifest.parts) for (const variant of p.variants?.length ? p.variants.map(v => v.id) : [undefined]) {
    const what = `${p.id}${variant ? ` (${variant})` : ''}`;
    try {
      const inst = instantiateLibraryPart(lib, p.id, variant ? { variant } : {});
      const result = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: inst.features });
      for (const o of inst.outputs) { const report = checkOutput(outputOf(result, o)); if (!report.valid) problems.push(`${what}: ${o} is not a valid solid (${report.issues[0] ?? 'invalid'})`); }
      built++;
    } catch (cause) { problems.push(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }
  for (const f of lib.manifest.fits ?? []) {
    try { const r = checkLibraryFit(lib, f.id); fits++; if (!r.ok) problems.push(`fit ${f.id}: ${r.overlap > r.maxOverlap ? `overlap ${r.overlap.toFixed(6)} mm³` : 'the parts do not touch'}`); }
    catch (cause) { problems.push(`fit ${f.id}: ${cause instanceof Error ? cause.message : String(cause)}`); }
  }
  return { ok: !problems.length, at: now.toISOString(), kernel: CAD_KERNEL_VERSION, library: lib.manifest.id, version: lib.manifest.libraryVersion, built, fits, problems };
}

/** Why a library may not be shared with the team, or null: unlicensed, an agent's not confirmed, or its check failed. */
export function sharingRefusal(lib: CadLibrary, meta: { authoredBy?: 'agent' | 'person'; confirmed?: boolean }, check: LibraryCheck): string | null {
  if (!licenseOf(lib)) return `${lib.manifest.id} has no licence: ${UNLICENSED}. Give it a "license" to share it.`;
  if (meta.authoredBy === 'agent' && !meta.confirmed) return `${lib.manifest.id} was written by an agent: a person confirms it before it is shared.`;
  if (!check.ok) return `${lib.manifest.id} did not pass its check: ${check.problems.slice(0, 3).join('; ')}${check.problems.length > 3 ? ` (and ${check.problems.length - 3} more)` : ''}`;
  return null;
}
