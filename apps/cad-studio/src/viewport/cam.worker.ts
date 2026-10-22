import { camPackage, type CamPackage } from '@barocss/cad-model/machining/camPackage';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { CamHeightfield } from './camHeightfield';
import type { CamDisplay, CamOptions } from './camDisplay';

// G23 CNC (G-R3, from Codex's source 5c9f861f): the Model's CAM package for the current source, and the selected
// setup's height field at a progress. The document and bodies come only when the source changed (`source`), so
// scrubbing the progress posts a few numbers, not the meshes. No geometry is evaluated here and nothing is authored.

export interface CamRequest extends CamOptions { request: number; sourceKey: number; source?: { doc: StudioDoc; bodies: BodyResult[] } }
export type CamReply = { request: number; packageKey?: number; package?: CamPackage; display?: CamDisplay; error?: string };
let latest = 0, packageKey = 0, packageFor = '', fieldKey = '', cached: CamPackage | null = null, field: CamHeightfield | null = null;
let held: { key: number; doc: StudioDoc; bodies: BodyResult[] } | null = null;

function check(job: CamRequest): void {
  if (!Number.isSafeInteger(job.setup) || job.setup < 0) throw new Error('CNC setup index must be a nonnegative safe integer.');
  if (!Number.isFinite(job.progress) || job.progress < 0) throw new Error('CNC progress must be finite and nonnegative.');
  if (!Number.isFinite(job.cellMM) || job.cellMM <= 0) throw new Error('CNC grid pitch must be finite and positive.');
  if (job.tool?.kind !== undefined && !['flat', 'ball', 'bull'].includes(job.tool.kind)) throw new Error('CNC tool profile is unsupported.');
  for (const key of ['diameterMM', 'fluteMM', 'shankMM'] as const) {
    const value = job.tool?.[key];
    if (value !== undefined && !(Number.isFinite(value) && value > 0)) throw new Error(`CNC ${key} must be finite and positive.`);
  }
  const corner = job.tool?.cornerMM;
  if (corner !== undefined && !(Number.isFinite(corner) && corner >= 0)) throw new Error('CNC corner radius must be finite and nonnegative.');
}

function run(job: CamRequest): void {
  if (job.request !== latest) return;
  let info: CamPackage | undefined;
  try {
    if (!held || held.key !== job.sourceKey) throw new Error('The CNC preview has no current source yet.');
    if (!held.bodies.some(body => body.mesh.indices.length)) throw new Error('No current root solid to preview.');
    check(job);
    const key = JSON.stringify([job.sourceKey, job.tool ?? null]);
    if (!cached || packageFor !== key) {
      cached = camPackage(held.doc, held.bodies, job.tool ? { tool: job.tool } : {});
      packageFor = key; packageKey++; field = null; fieldKey = '';
    }
    info = cached;
    if ('refused' in info.stock) throw new Error(`${info.stock.refused.code}: ${info.stock.refused.message}`);
    const setup = info.setups[job.setup];
    if (!setup) throw new Error(info.setups.length ? 'The selected CNC setup is unavailable; choose one of the setups given.' : 'The Model gave no CNC moves for this part. Read the skipped-feature reasons.');
    if (!setup.moves.length) throw new Error('The selected CNC setup has no moves.');
    const currentField = JSON.stringify([packageKey, job.setup, job.cellMM]);
    if (!field || currentField !== fieldKey) { field = new CamHeightfield(info.stock, setup, info.tool, job.cellMM, held.bodies.map(b => b.mesh)); fieldKey = currentField; }
    const progress = Math.min(job.progress, setup.moves.length), removal = field.evaluate(progress);
    const index = Math.min(Math.floor(progress), setup.moves.length - 1), move = setup.moves[index], fraction = progress >= setup.moves.length ? 1 : progress - index;
    const position: [number, number, number] = [move.a[0] + (move.b[0] - move.a[0]) * fraction, move.a[1] + (move.b[1] - move.a[1]) * fraction, move.a[2] + (move.b[2] - move.a[2]) * fraction];
    const display: CamDisplay = { request: job.request, packageKey, package: info, setupIndex: job.setup, setup, progress, position, removal };
    if (job.request === latest) self.postMessage({ request: job.request, packageKey, package: info, display } satisfies CamReply);
  } catch (error) {
    if (job.request === latest) self.postMessage({ request: job.request, ...(info ? { packageKey, package: info } : {}), error: error instanceof Error ? error.message : String(error) } satisfies CamReply);
  }
}

self.onmessage = (event: MessageEvent<CamRequest>) => {
  const job = event.data;
  latest = job.request;
  if (job.source) { held = { key: job.sourceKey, doc: job.source.doc, bodies: job.source.bodies }; cached = null; field = null; }
  // (A later request posted meanwhile supersedes this one: only the latest runs.)
  setTimeout(run, 0, job);
};
