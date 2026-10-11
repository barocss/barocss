/** Selected immutable DATA only. Importing this module performs no I/O or solve. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';

export const SNAPSHOTS = Object.freeze(['FIRST', 'LIMIT', 'FINAL']);
export const NATIVE_HEAD = 'f40123da0eedb19245688557f865e1beb09d47ef';
export const RECEIPT_SHA256 = 'b28355cac28b45d9c35639968196f386f4b2fe51dc063897bf52c1b9ab8e3cd4';
const HERE = dirname(fileURLToPath(import.meta.url));
const BANK_ROOT = 'examples/physics-rigid-hinge-velocity-world-reference/evidence/completed-world-a341f222';
const RECEIPT_BYTES = 34958;
const MAX_SELECTED_BYTES = 4 * 1024 * 1024;

export class BankAuthenticationError extends Error {
  constructor(message) { super(message); this.name = 'BankAuthenticationError'; this.code = 'BANK_AUTHENTICATION_FAILED'; }
}
function need(test, label) { if (!test) throw new BankAuthenticationError(label); }
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function authenticated(bytes, wanted, label) {
  need(bytes.length === wanted.bytes && sha256(bytes) === wanted.sha256, label + ': byte/hash mismatch');
  return { bytes: bytes.length, sha256: wanted.sha256, base64: bytes.toString('base64') };
}
function parseJSON(bytes, label) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new BankAuthenticationError(label + ': invalid UTF-8 JSON'); }
}
function localPath(repositoryRoot, historicalPath) {
  const suffix = '/' + BANK_ROOT + '/';
  need(typeof historicalPath === 'string' && historicalPath.includes(suffix), 'archive path is outside fixed bank');
  const tail = historicalPath.slice(historicalPath.indexOf(suffix) + suffix.length);
  const fixedRoot = resolve(repositoryRoot, BANK_ROOT);
  const result = resolve(fixedRoot, tail);
  need(relative(fixedRoot, result) === tail && !tail.startsWith('..'), 'archive path escapes fixed bank');
  return result;
}
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }

/** Logical saved-initial+continuation offsets must never index continuation directly. */
export function physicalIPCOffset(locator, prefixBytes) {
  const logical = locator.logicalCompositeOffset ?? locator.offset;
  need(integer(logical) && integer(prefixBytes) && locator.prefixBytes === prefixBytes,
    'IPC logical/prefix locator is invalid');
  need(logical >= prefixBytes && locator.physicalDecodedOffset === logical - prefixBytes,
    'IPC logical/physical offset translation mismatch');
  return logical - prefixBytes;
}

/** One streaming decode per selected archive. Only selected spans are retained/hashed. */
async function extractSelected(path, streamInfo, ranges) {
  need((await stat(path)).size === streamInfo.archiveBytes, 'archive size differs from authenticated receipt');
  const ordered = [...ranges].sort((a, b) => a.offset - b.offset);
  let retained = 0;
  for (const range of ordered) {
    need(integer(range.offset) && integer(range.bytes) && range.bytes > 0 &&
      range.offset + range.bytes <= streamInfo.decodedBytes, 'selected byte range is invalid');
    retained += range.bytes;
    need(retained <= MAX_SELECTED_BYTES, 'selected range storage bound exceeded');
    range.buffer = Buffer.alloc(range.bytes);
    range.copied = 0;
  }
  const end = Math.max(...ordered.map(range => range.offset + range.bytes));
  const source = createReadStream(path, { highWaterMark: 65536 });
  const decoded = path.endsWith('.gz') ? source.pipe(createGunzip({ chunkSize: 65536 })) : source;
  // A read error must reach the iterator even when a decompressor is interposed.
  if (decoded !== source) source.on('error', error => decoded.destroy(error));
  let position = 0;
  try {
    for await (const chunk of decoded) {
      const next = position + chunk.length;
      need(next <= streamInfo.decodedBytes, 'decoded stream exceeds authenticated bound');
      for (const range of ordered) {
        const start = Math.max(position, range.offset), stop = Math.min(next, range.offset + range.bytes);
        if (stop > start) {
          chunk.copy(range.buffer, start - range.offset, start - position, stop - position);
          range.copied += stop - start;
        }
      }
      position = next;
      if (position >= end) break;
    }
  } finally { decoded.destroy(); source.destroy(); }
  for (const range of ordered) {
    need(range.copied === range.bytes, 'selected byte range ended early');
    range.auth = authenticated(range.buffer, range, range.label);
  }
}

/** Return a detached, JSON-serializable bank; the orchestrator owns saving bank.json. */
export async function loadSavedBank({ repositoryRoot = resolve(HERE, '../..') } = {}) {
  const receiptBuffer = await readFile(resolve(repositoryRoot, 'examples/physics-public-disjoint-hinge-reference/saved-input-authentication.json'));
  const receiptAuth = authenticated(receiptBuffer, { bytes: RECEIPT_BYTES, sha256: RECEIPT_SHA256 }, 'receipt');
  const receipt = parseJSON(receiptBuffer, 'receipt');
  need(receipt.nativeHead === NATIVE_HEAD && receipt.snapshots.length === 3 &&
    receipt.snapshots.every((entry, index) => entry.name === SNAPSHOTS[index]), 'fixed snapshot identity mismatch');
  const manifestBuffer = await readFile(localPath(repositoryRoot, receipt.bankManifest.path));
  need(sha256(manifestBuffer) === receipt.bankManifest.sha256, 'bank manifest hash mismatch');
  const manifest = parseJSON(manifestBuffer, 'manifest');
  need(manifest.consumerHead === receipt.consumerHead, 'bank consumer head mismatch');
  const byPath = new Map(), selected = new Map();
  for (const [name, info] of Object.entries(receipt.streams)) {
    const path = localPath(repositoryRoot, info.archivePath);
    const entry = manifest.entries.find(item => item.archive === 'source-proof/' + basename(path));
    need(entry && entry.archiveBytes === info.archiveBytes && entry.archiveSha256 === info.archiveSha256 &&
      entry.decompressedBytes === info.decodedBytes && entry.decompressedSha256 === info.decodedSha256,
    'selected stream/manifest mismatch: ' + name);
    byPath.set(path, { info, ranges: [] });
  }
  const prefixes = {};
  for (const side of ['stdin', 'stdout']) {
    const archive = 'source-proof/completed-initial.' + side + '.raw';
    const entry = manifest.entries.find(item => item.archive === archive);
    need(entry && integer(entry.archiveBytes), 'missing authenticated IPC prefix');
    // Prefix size/hash comes from the manifest, not the continuation's logical offset.
    prefixes[side] = entry.archiveBytes;
  }
  function add(label, locator, offset, historicalPath) {
    const path = localPath(repositoryRoot, historicalPath);
    const stream = byPath.get(path);
    need(stream, 'selected locator references an unknown stream');
    const range = { label, offset, bytes: locator.bytes, sha256: locator.sha256 };
    stream.ranges.push(range); selected.set(label, range);
  }
  for (const snapshot of receipt.snapshots) {
    for (const [label, key] of [['nativeRecord', 'nativeRecord'], ['outcomeRecord', 'successfulOutcomeRecord']]) {
      const locator = snapshot[key];
      add(snapshot.name + '/' + label, locator, locator.decodedByteOffset, locator.archivePath);
    }
    for (const [label, key, side] of [['request', 'referenceRequest', 'stdin'], ['reply', 'referenceReply', 'stdout']]) {
      const locator = snapshot[key];
      add(snapshot.name + '/' + label, locator, physicalIPCOffset(locator, prefixes[side]), locator.physicalArchivePath);
    }
    for (const phase of snapshot.rawValidation.phases) {
      add(snapshot.name + '/raw/' + phase.phase, phase, phase.offset, phase.archivePath ?? snapshot.rawValidation.stream);
    }
  }
  need([...selected.values()].reduce((sum, range) => sum + range.bytes, 0) <= MAX_SELECTED_BYTES,
    'total selected byte storage bound exceeded');
  // Deliberately serial: no 43-file or full decoded/frame audit is repeated here.
  for (const [path, stream] of byPath) if (stream.ranges.length) await extractSelected(path, stream.info, stream.ranges);
  const snapshots = {};
  for (const locator of receipt.snapshots) {
    const bytes = {}, values = {};
    for (const key of ['request', 'reply', 'nativeRecord', 'outcomeRecord']) {
      const range = selected.get(locator.name + '/' + key);
      bytes[key] = range.auth; values[key] = parseJSON(range.buffer, range.label);
    }
    need(isDeepStrictEqual(values.nativeRecord.request, values.request), locator.name + ': native/IPC request mismatch');
    const rawPhases = {};
    for (const phase of locator.rawValidation.phases) {
      const hex = selected.get(locator.name + '/raw/' + phase.phase).buffer.toString('hex');
      need(hex.length === 832, 'raw phase must contain four 104-byte bodies');
      if (Object.hasOwn(values.request.rawFrames, phase.phase))
        need(values.request.rawFrames[phase.phase] === hex, locator.name + ': raw phase/request mismatch');
      rawPhases[phase.phase] = { hex, locator: phase };
    }
    need(values.request.sourceState.stepIndex === locator.sourceCursor &&
      values.request.attempt.stage === 'report-ready' && values.request.outcome === 'returned' &&
      values.reply.referenceStatus === 'RETURN' && values.reply.ok === true && values.reply.resolved === true &&
      values.reply.executionFailure === false && values.reply.error === null && values.reply.violations.length === 0,
    locator.name + ': authenticated successful snapshot is inconsistent');
    snapshots[locator.name] = { originalRequest: values.request, originalReply: values.reply,
      nativeRecord: values.nativeRecord, outcomeRecord: values.outcomeRecord,
      sourceRawHex: rawPhases.source.hex, postContactRawHex: rawPhases.postContact.hex,
      projectedRawHex: rawPhases.projected.hex, rawPhases, bytes, locators: locator };
  }
  return { version: 1, nativeHead: NATIVE_HEAD, receipt: { ...receiptAuth, data: receipt },
    manifest: { path: receipt.bankManifest.path, bytes: manifestBuffer.length,
      sha256: receipt.bankManifest.sha256, base64: manifestBuffer.toString('base64'), data: manifest }, snapshots,
    extraction: { kind: 'selected-byte-ranges', modelsRun: 0, referencesRun: 0, projectionsRun: 0,
      full43FileAuditRepeated: false, full7201FrameAuditRepeated: false } };
}
