// Serialized document transport and reference reads. The App owns adoption, history and operation scopes.
// Callers must recheck their owner after awaiting these helpers, immediately before any adoption or UI write.
import { emptyDoc, prefixDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { featureId, nodeIndexOf } from '@barocss/cad-model/engine/ids';
import { isSplitCapFace } from '@barocss/cad-model/engine/rematch';
import { verifyReferences, type Problem } from '@barocss/cad-model/engine/references';
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
  const isSplitCapHole = (node: StudioDoc['nodes'][number]) =>
    node.kind === 'hole' && !node.suppressed && typeof node.face === 'string' &&
    (node.parent.side === 'negative' || node.parent.side === 'positive') &&
    node.face.startsWith(featureId(opened.nodes, node.parent.node) + '.cut.') && isSplitCapFace(opened.nodes, node.face);
  const checkPart = () => {
    if (!current()) return;
    const hasFits = !!opened.fits?.faces?.length;
    const hasCapHoles = opened.nodes.some(isSplitCapHole);
    if (!hasFits && !hasCapHoles) return;
    // Use the same full-history input as the Model view. Leave unrelated refusals to reference review.
    return readPart(prefixDoc(opened, opened.nodes.length)).then(result => {
      if (!current() || result.ok) return;
      const { code, detail, hint, feature } = result.error;
      if (hasFits && code === 'FIT_TABLE_MISS') throw new Error(`${detail} ${hint} Your part is unchanged.`);
      if (!hasCapHoles || code !== 'REFERENCE' || !feature) return;
      const node = opened.nodes[nodeIndexOf(opened.nodes, feature)];
      if (node?.kind === 'hole' && isSplitCapHole(node) && detail === `no face ${node.face} on the target`) {
        throw new Error(`Hole ${feature}: the selected Split face "${node.face}" is missing. Your part is unchanged.`);
      }
    });
  };
  const checkSources = () => {
    const cavities = verifyStoredStepCavities(opened, readPart, current);
    return cavities ? cavities.then(checkPart) : checkPart();
  };
  const hasInsets = opened.nodes.some(node => node.kind === 'rounded-rectangle-inset' ||
    (node.kind === 'sketch' && node.profile !== 'band' && node.association !== undefined));
  if (!hasInsets) return checkSources();
  return readInsets(opened).then(result => {
    if (!current()) return;
    if ('error' in result) throw new Error(result.error + ' Your part is unchanged.');
    return checkSources();
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

/** A project file can take the active path only after a signed finish repair builds. */
export async function prepareProjectFinishOpen(opened: StudioDoc, readPart: (doc: StudioDoc) => Promise<EvalResult>,
  current: () => boolean): Promise<{ doc: StudioDoc; problems: Problem[] } | undefined> {
  if (!current() || !opened.nodes.some(node => (node.kind === 'fillet' || node.kind === 'chamfer')
      && node.edges.some(edge => !!node.sigs?.[edge]))) return;
  const result = await readPart(opened);
  if (!current()) return;
  if (!result.ok) {
    const node = result.error.feature ? opened.nodes[nodeIndexOf(opened.nodes, result.error.feature)] : undefined;
    if (node?.kind !== 'fillet' && node?.kind !== 'chamfer') return;
    if (!node.edges.some(edge => !!node.sigs?.[edge])) return;
  }
  const verified = await verifyReferences(opened, result.ok ? result.bodies : [], readPart);
  if (!current()) return;
  const finishProblem = verified.problems.some(problem => {
    const node = problem.node === null ? undefined : opened.nodes[problem.node];
    return node?.kind === 'fillet' || node?.kind === 'chamfer';
  });
  if (finishProblem) {
    const repaired = await readPart(verified.doc);
    if (!current()) return;
    if (repaired.ok) return { doc: verified.doc, problems: verified.problems };
    throw new Error(`${repaired.error.detail || repaired.error.title} Your part is unchanged.`);
  }
  if (!result.ok) throw new Error(`${result.error.detail || result.error.title} Your part is unchanged.`);
}
