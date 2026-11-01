// Private Studio preparation state. Bytes stay here until the explicit download action.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
export type StepMeshes = 'auto' | 'tessellated' | 'planar';
export interface StepOwner { doc: StudioDoc; shown: StudioDoc; evaluated: StudioDoc; name: string; fresh: boolean; hasBody: boolean; hasMeshes: boolean }
export interface StepPreview { name: string; meshes: StepMeshes; hasMeshes: boolean; stage: 'preparing' | 'ready' | 'error'; profile: string; losses: readonly string[]; error?: string; size?: number }
type StepResult = { text: string; omitted?: string[] } | { error: string };
interface Options {
  current(): StepOwner;
  step(doc: StudioDoc, name: string, meshes: StepMeshes): Promise<StepResult>;
  changed(value: StepPreview | null): void;
  notice(hint: string): void;
  download(bytes: Uint8Array, name: string, doc: StudioDoc): void;
}
function sameOwner(a: StepOwner, b: StepOwner): boolean { return b.fresh && b.hasBody && a.doc === b.doc && a.evaluated === b.evaluated && a.shown === b.shown && a.name === b.name; }
function profile(text: string): string {
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/.exec(text)?.[1] ?? '';
  return schema.startsWith('AP242_') ? 'STEP AP242 · tessellated or mixed geometry · mm' : schema.startsWith('AUTOMOTIVE_DESIGN') ? 'STEP AP214 · B-rep geometry · mm' : 'STEP geometry · mm';
}
export function createStepPreparation(options: Options) {
  let generation = 0, captured: StepOwner | null = null, bytes: Uint8Array | null = null;
  let preview: StepPreview | null = null;
  const publish = (value: StepPreview | null) => { preview = value; options.changed(value); };
  const discard = () => { generation++; captured = null; bytes = null; preview = null; };
  const cancel = () => { discard(); options.changed(null); };
  const reconcile = () => { if (captured && !sameOwner(captured, options.current())) cancel(); };
  const prepare = async (meshes: StepMeshes = 'auto') => {
    discard(); const owner = options.current(), ticket = generation;
    if (!owner.fresh || !owner.hasBody) { options.changed(null); options.notice(!owner.fresh ? 'Wait for the current design and its placed parts to finish evaluating.' : 'There is no exportable body in the current design.'); return; }
    captured = owner;
    const pending: StepPreview = { name: owner.name, meshes, hasMeshes: owner.hasMeshes, stage: 'preparing', profile: 'Preparing STEP geometry · mm', losses: [] };
    publish(pending);
    try {
      const result = await options.step({ ...owner.shown, nodes: owner.evaluated.nodes, outputs: owner.evaluated.outputs }, owner.name, meshes);
      if (generation !== ticket) return;
      if (!sameOwner(owner, options.current())) { cancel(); return; }
      if ('error' in result) { publish({ ...pending, stage: 'error', error: result.error }); return; }
      bytes = new TextEncoder().encode(result.text);
      publish({ ...pending, stage: 'ready', profile: profile(result.text), losses: [...(result.omitted ?? [])], size: bytes.byteLength });
    } catch (error) {
      if (generation !== ticket) return;
      if (!sameOwner(owner, options.current())) { cancel(); return; }
      publish({ ...pending, stage: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  };
  const download = () => {
    if (!captured || !bytes || preview?.stage !== 'ready') return;
    if (!sameOwner(captured, options.current())) { cancel(); options.notice('The design or file name changed. Prepare the current STEP again.'); return; }
    const owner = captured, prepared = bytes; discard(); options.changed(null);
    options.download(prepared, `${owner.name}.step`, owner.doc);
  };
  return { prepare, download, cancel, reconcile, dispose: discard };
}
