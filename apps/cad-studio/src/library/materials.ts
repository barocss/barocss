// R6b.7 (D67): the material library and the process profiles, as data. A material carries density, elastic modulus,
// yield, allowable strain (a snap-fit's), shrink and a wall range per process; a profile (injection, FDM, SLA) carries
// its rules' thresholds. Every value names its source id; ours are estimates, said. Library checks read them through
// their context: `material.<field>` from the body a part goes on (its material set — an assumed one is no value),
// `profile.<threshold>` from the document's process.
import materialsJson from './builtin/materials.json';

export interface MaterialData {
  readonly id: string; readonly label: string; readonly family: 'metal' | 'polymer';
  readonly densityGPerCm3: number; readonly elasticModulusMPa: number; readonly yieldMPa: number; readonly allowableStrain: number; readonly shrink: number;
  /** Its coefficient of friction against itself (a snap-fit's push-on and pull-off forces). */
  readonly friction: number;
  /** How prone it is to warp as it cools, 0–1 (printing; AM1). */
  readonly warpRisk?: number;
  /** A living-hinge material's (polypropylene's) allowable strain and thickness range; others have none. */
  readonly livingHingeStrain?: number; readonly livingHingeTMin?: number; readonly livingHingeTMax?: number;
  readonly wallMM?: Readonly<Record<string, readonly [number, number]>>; readonly processes: readonly string[];
  /** Its moulding shrink (mm/mm) where a page gives it (IM1, O77); the generic `shrink` stays the family's estimate. */
  readonly mouldShrink?: number;
  readonly estimate: boolean;
  /** Each field's source id; a per-process wall range as `wallMM.<process>`, before `wallMM`. */
  readonly sources: Readonly<Record<string, string>>;
  /** The page each W-WEB value is from (IM1, O77): by its field's key, as in `sources`. */
  readonly pages?: Readonly<Record<string, WebSource>>;
}
/** A value read from a public page (IM1, O77): its URL, the date read and the page's own label for it; `note` ours (how it is applied: a family row for a grade, O78). */
export interface WebSource { readonly url: string; readonly read: string; readonly label: string; readonly note?: string }
export interface ProcessThreshold { readonly value: number; readonly unit: string; readonly source: string; readonly description: string; readonly page?: WebSource }
/** A moulded surface finish (IM1, O77): the least draft it takes, and the recommended. */
export interface MouldFinish { readonly id: string; readonly label: string; readonly draftMinDeg: number; readonly draftRecDeg?: number; readonly source: string; readonly page?: WebSource }
/** A process: its rules' thresholds; `additive` for the printing processes (AM1: overhang, bridge, hole, gap, escape holes); a moulding process's finishes. */
export interface ProcessProfile { readonly id: string; readonly label: string; readonly thresholds: Readonly<Record<string, ProcessThreshold>>; readonly additive?: boolean; readonly finishes?: readonly MouldFinish[] }
/** A printer (AM1, D72): its process, build volume (X, Y, Z mm), layer, nozzle and bed — a generic one of its class, or the user's. */
export interface PrinterProfile { readonly id: string; readonly label: string; readonly process: string; readonly buildMM: readonly [number, number, number]; readonly layerMM: number; readonly nozzleMM?: number; readonly heatedBed?: boolean; readonly source: string }
export interface MaterialsData { readonly format: 'barocss-materials'; readonly version: 1; readonly libraryVersion: string; readonly license: string; readonly provenance: string; readonly sources: Readonly<Record<string, string>>; readonly materials: readonly MaterialData[]; readonly profiles: readonly ProcessProfile[]; readonly printers: readonly PrinterProfile[] }

const WEB = 'W-WEB';
const pageOk = (w: WebSource | undefined) => !!w && /^https:\/\/[^\s]+$/.test(w.url) && /^\d{4}-\d{2}-\d{2}$/.test(w.read) && w.label.trim().length > 0;
const NUMERIC = ['densityGPerCm3', 'elasticModulusMPa', 'yieldMPa', 'allowableStrain', 'shrink', 'friction'] as const;
/** The data checked: every number finite and not negative (density, modulus and yield above 0), every source id known. */
export function checkMaterials(d: MaterialsData): string[] {
  const problems: string[] = [];
  if (d.format !== 'barocss-materials' || d.version !== 1) problems.push('not barocss-materials version 1');
  const ids = new Set<string>();
  for (const m of d.materials) {
    if (ids.has(m.id)) problems.push(`${m.id} twice`); ids.add(m.id);
    for (const k of NUMERIC) { const v = m[k]; if (!(Number.isFinite(v) && v >= 0) || (k !== 'shrink' && k !== 'allowableStrain' && k !== 'friction' && !(v > 0))) problems.push(`${m.id}.${k}: ${v}`); }
    for (const [field, s] of Object.entries(m.sources)) if (!(s in d.sources)) problems.push(`${m.id}.${field}: unknown source ${s}`);
    for (const k of NUMERIC) if (!(k in m.sources)) problems.push(`${m.id}.${k}: no source`);
    for (const [p, [lo, hi]] of Object.entries(m.wallMM ?? {})) if (!(lo > 0 && hi > lo)) problems.push(`${m.id}.wallMM.${p}: ${lo}–${hi}`);
  }
  // (Printing processes carry every printing threshold; printers name a known process, a positive build volume and layer.)
  const AM = ['minWallUnsupported', 'maxOverhangDeg', 'maxBridgeMM', 'minHoleMM', 'fitGap', 'escapeHoleMM', 'escapeHoles', 'horizontalHoleMM', 'warpLrefMM'];
  for (const p of d.profiles) if (p.additive) for (const k of AM) if (!p.thresholds[k]) problems.push(`${p.id}: no ${k}`);
  const pids = new Set(d.profiles.map(p => p.id)), prn = new Set<string>();
  for (const pr of d.printers ?? []) {
    if (prn.has(pr.id)) problems.push(`printer ${pr.id} twice`); prn.add(pr.id);
    if (!pids.has(pr.process) || !d.profiles.find(p => p.id === pr.process)!.additive) problems.push(`printer ${pr.id}: ${pr.process} is not a printing process`);
    if (!(pr.buildMM.length === 3 && pr.buildMM.every(v => v > 0) && pr.layerMM > 0)) problems.push(`printer ${pr.id}: its build volume or layer`);
    if (!(pr.source in d.sources)) problems.push(`printer ${pr.id}: unknown source ${pr.source}`);
  }
  for (const p of d.profiles) for (const [k, t] of Object.entries(p.thresholds)) {
    if (!t) continue;
    if (!Number.isFinite(t.value)) problems.push(`${p.id}.${k}: ${t.value}`);
    if (!(t.source in d.sources)) problems.push(`${p.id}.${k}: unknown source ${t.source}`);
    if (t.source === WEB && !pageOk(t.page)) problems.push(`${p.id}.${k}: a web value needs its page (url, read, label)`);
  }
  // (IM1: a web value names its page; a finish its least draft.)
  for (const p of d.profiles) for (const f of p.finishes ?? []) {
    if (!(f.draftMinDeg >= 0 && f.draftMinDeg < 45) || (f.draftRecDeg !== undefined && !(f.draftRecDeg >= f.draftMinDeg))) problems.push(`${p.id}.finish ${f.id}: its draft`);
    if (!(f.source in d.sources) || (f.source === WEB && !pageOk(f.page))) problems.push(`${p.id}.finish ${f.id}: its source`);
  }
  for (const m of d.materials) for (const [k, src] of Object.entries(m.sources)) if (src === WEB && !pageOk(m.pages?.[k])) problems.push(`${m.id}.${k}: a web value needs its page (url, read, label)`);
  return problems;
}
export const MATERIALS_DATA = materialsJson as unknown as MaterialsData;
export const materialData = (id: string | undefined): MaterialData | undefined => MATERIALS_DATA.materials.find(m => m.id === id);
export const processProfile = (id: string | undefined): ProcessProfile | undefined => MATERIALS_DATA.profiles.find(p => p.id === id);
export const printerProfile = (id: string | undefined): PrinterProfile | undefined => MATERIALS_DATA.printers.find(p => p.id === id);

/**
 * A context input's value from a material and a process: `material.<field>` (a number field, or `wallMin`/`wallMax` for
 * the process's wall range), `profile.<threshold>`; or why there is none.
 */
export function materialContext(path: string, material: MaterialData | undefined, profile: ProcessProfile | undefined): { value: number; source: string } | { unknown: string } {
  const [scope, field] = path.split('.');
  if (scope === 'material') {
    if (!material) return { unknown: 'the body\'s material is not set' };
    if (field === 'wallMin' || field === 'wallMax') {
      if (!profile) return { unknown: 'no process is chosen' };
      const w = material.wallMM?.[profile.id];
      return w ? { value: w[field === 'wallMin' ? 0 : 1], source: material.sources[`wallMM.${profile.id}`] ?? material.sources.wallMM } : { unknown: `${material.label} has no wall range for ${profile.label}` };
    }
    const v = (material as unknown as Record<string, unknown>)[field];
    if (typeof v === 'number') return { value: v, source: material.sources[field] ?? '?' };
    return { unknown: field.startsWith('livingHinge') ? `${material.label} is not a living-hinge material` : `materials have no ${field}` };
  }
  // (How the part lies in the printer arrives with AM2/AM4: until then, unknown.)
  if (scope === 'print') return { unknown: 'the print orientation is not known yet (it arrives with AM2/AM4)' };
  if (scope === 'profile') {
    if (!profile) return { unknown: 'no process is chosen' };
    const t = profile.thresholds[field];
    return t ? { value: t.value, source: t.source } : { unknown: `${profile.label} has no ${field}` };
  }
  return { unknown: `${path} is not a material or process value` };
}
