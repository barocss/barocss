import { readStudioFile } from '@barocss/cad-model/engine/container';
import { inspectLocalHeightPlan } from '@barocss/cad-model/team/localHeightPlan';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import { MAX_TASK_RUN_NATIVE_BYTES, readTaskRunOffer, type TaskRunOffer } from '../chat/taskRunOffer';

export const TASK_RUN_HANDOFF_EXT = '.bcad-task';
const MAGIC = 'BCADTSK1', PREFIX = 12, MAX_HEADER = 16 * 1024;
export const MAX_TASK_RUN_HANDOFF_BYTES = PREFIX + MAX_HEADER + MAX_TASK_RUN_NATIVE_BYTES;

async function verifySource(offer: TaskRunOffer, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_TASK_RUN_NATIVE_BYTES) throw new Error('The saved model exceeds the supported handoff size.');
  // The native container reader needs Uint8Array slicing semantics, including when called by Node.
  const native = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const opened = await readStudioFile(native);
  if ('error' in opened) throw new Error(opened.error);
  if (opened.notes.length || digestOf(opened.doc) !== offer.revision)
    throw new Error('The saved model differs from the reviewed plan. Save and inspect it again.');
  const result = inspectLocalHeightPlan(opened.doc, offer.occurrences, { projectId: 'studio', documentId: 'working-model' });
  if ('error' in result || result.issues.length || canonical(result.targets) !== canonical(offer.targets))
    throw new Error('The reviewed targets do not match an executable local plan.');
  return opened.doc;
}

export async function encodeTaskRunHandoff(offer: TaskRunOffer, native: Uint8Array) {
  await verifySource(offer, native);
  const encoder = new TextEncoder(), receipt = { offer, sourceSHA256: sha256Hex(native) };
  const header = encoder.encode(JSON.stringify({ receipt, digest: digestOf(receipt) }));
  if (header.length > MAX_HEADER) throw new Error('The plan handoff header is too large.');
  const bytes = new Uint8Array(PREFIX + header.length + native.length);
  bytes.set(encoder.encode(MAGIC));
  new DataView(bytes.buffer).setUint32(8, header.length, true);
  bytes.set(header, PREFIX);
  bytes.set(native, PREFIX + header.length);
  return bytes;
}

export async function readTaskRunHandoff(bytes: Uint8Array) {
  if (bytes.length <= PREFIX || bytes.length > MAX_TASK_RUN_HANDOFF_BYTES || new TextDecoder().decode(bytes.subarray(0, 8)) !== MAGIC)
    throw new Error('The task run handoff header is invalid.');
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
  if (!length || length > MAX_HEADER || PREFIX + length >= bytes.length) throw new Error('The task run handoff is incomplete.');
  const envelope: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(PREFIX, PREFIX + length)));
  if (!isObj(envelope) || !isObj(envelope.receipt) || digestOf(envelope.receipt) !== envelope.digest)
    throw new Error('The task run handoff checksum differs.');
  const { receipt } = envelope, offer = readTaskRunOffer(receipt.offer), native = bytes.subarray(PREFIX + length);
  if (!offer || typeof receipt.sourceSHA256 !== 'string' || receipt.sourceSHA256 !== sha256Hex(native))
    throw new Error('The saved source does not match the task run handoff.');
  const doc = await verifySource(offer, native);
  return { doc, offer, sourceSHA256: receipt.sourceSHA256 };
}
