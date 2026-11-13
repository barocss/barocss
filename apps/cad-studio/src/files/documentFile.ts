// Serialized document transport and reference reads. The App owns adoption, history and operation scopes.
// Callers must recheck their owner after awaiting these helpers, immediately before any adoption or UI write.
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { verifyReferences } from '@barocss/cad-model/engine/references';
import type { StoredInsetReply } from '../engine/client';
import { downloadBytes } from '../ui/files';

export function writeDocumentFile(doc: StudioDoc, name: string): void {
  const bytes = encodeStudioFile(doc);
  downloadBytes(bytes, name, bytes[0] === 0x7b ? 'application/json' : 'application/octet-stream');
}

/** Preserve the two admission checkpoints: a superseded read must not proceed to container decoding. */
export async function readDocumentFile(file: File, current: () => boolean) {
  const bytes = await file.arrayBuffer();
  if (!current()) return null;
  const read = await readStudioFile(new Uint8Array(bytes));
  return current() ? read : null;
}

function storedStepCavities(opened: StudioDoc): { name: string; step: string }[] {
  const checked = new Set<string>();
  const documents = [opened];
  const cavities: { name: string; step: string }[] = [];
  for (const doc of documents) {
    const sources: { name: string; step: string }[] = [];
    for (const node of doc.nodes) {
      if (node.kind === 'import') sources.push(node);
      if (node.kind === 'library') for (const feature of node.features) if (feature.kind === 'import') sources.push({ name: node.name, step: feature.step });
    }
    for (const ref of doc.references?.references ?? []) {
      if ('step' in ref.source) sources.push({ name: ref.name, step: ref.source.step });
    }
    for (const instance of doc.instances ?? []) documents.push(instance.doc);
    for (const part of Object.values(doc.pendingParts ?? {})) documents.push(part.doc);

    for (const { name, step } of sources) {
      if (checked.has(step)) continue;
      checked.add(step);
      if (!step.includes('BREP_WITH_VOIDS')) continue;
      // A quoted name or comment cannot introduce an entity.
      const lexical = /\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*(?:'|$)|\bBREP_WITH_VOIDS\b/g;
      for (const [token] of step.matchAll(lexical)) {
        if (token !== 'BREP_WITH_VOIDS') continue;
        cavities.push({ name, step });
        break;
      }
    }
  }
  return cavities;
}

async function verifyCavitySources(sources: ReturnType<typeof storedStepCavities>, readPart: (doc: StudioDoc) => Promise<EvalResult>, current: () => boolean) {
  for (const { name, step } of sources) {
    if (!current()) return;
    const result = await readPart(withNode(emptyDoc(), { kind: 'import', name, step }));
    if (!current()) return;
    if (!result.ok) throw new Error(`Embedded STEP “${name}”: ${result.error.detail}. Your part is unchanged.`);
  }
}

/** Check embedded STEP cavities before a native Open can replace the accepted document. */
export function verifyStoredStepCavities(opened: StudioDoc, readPart: (doc: StudioDoc) => Promise<EvalResult>, current: () => boolean) {
  const sources = storedStepCavities(opened);
  return sources.length ? verifyCavitySources(sources, readPart, current) : undefined;
}

/** Check the native features that require admission before either Open can adopt the file. */
export function verifyStoredNativeOpen(opened: StudioDoc, readPart: (doc: StudioDoc) => Promise<EvalResult>,
  readInsets: (doc: StudioDoc) => Promise<StoredInsetReply>, current: () => boolean): Promise<void> | undefined {
  if (!current()) return;
  const hasInsets = opened.nodes.some(node => node.kind === 'rounded-rectangle-inset' ||
    (node.kind === 'sketch' && node.profile !== 'band' && node.association !== undefined));
  if (!hasInsets) return verifyStoredStepCavities(opened, readPart, current);
  return readInsets(opened).then(result => {
    if (!current()) return;
    if ('error' in result) throw new Error(result.error + ' Your part is unchanged.');
    return verifyStoredStepCavities(opened, readPart, current);
  });
}

/** No UI or document writes occur here. The App checks its same owner before applying the returned data. */
export async function verifyDocumentFile(opened: StudioDoc, readPart: (doc: StudioDoc) => Promise<EvalResult>, current: () => boolean) {
  const result = await readPart(opened);
  if (!current() || !result) return null;
  const verified = await verifyReferences(opened, result.ok ? result.bodies : [], readPart);
  if (!current()) return null;
  // A refusal can hide lost references as well as moved ones. Admit only a usable repair.
  if (!result.ok) {
    if (!verified.changes.length && !verified.problems.length) return null;
    const repaired = await readPart(verified.doc);
    if (!current() || !repaired?.ok) return null;
  }
  return verified;
}
