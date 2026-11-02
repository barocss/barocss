/** Immutable DATA authentication. No Physics, solver, or reference execution. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { restoreNegativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';

export const NATIVE_HEAD = 'f40123da0eedb19245688557f865e1beb09d47ef';
export const P3_BASE_HEAD = '2e270d3b';
const RECEIPT_SHA = 'b28355cac28b45d9c35639968196f386f4b2fe51dc063897bf52c1b9ab8e3cd4';
const MANIFEST_SHA = '60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191';
const BANK = 'examples/physics-rigid-hinge-velocity-world-reference/evidence/completed-world-a341f222';
const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_LINE = 512 * 1024;
const authenticatedBanks = new WeakMap();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export class BankAuthenticationError extends Error {
  constructor(message) { super(message); this.name = 'BankAuthenticationError'; this.code = 'BANK_AUTHENTICATION_FAILED'; }
}
function need(value, message) { if (!value) throw new BankAuthenticationError(message); }
function parse(bytes) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
function exact(bytes, count, hash, name) { need(bytes.length === count && digest(bytes) === hash, name + ': byte/hash mismatch'); }
async function safePath(root, path) {
  need(typeof path === 'string' && !path.includes('\\') && !path.startsWith('/') && !path.split('/').includes('..'), 'unsafe bank path');
  const actualRoot = await realpath(root), actual = await realpath(resolve(root, path));
  const tail = relative(actualRoot, actual);
  need(tail !== '' && !tail.startsWith('..') && !tail.startsWith('/'), 'bank symlink escapes fixed root');
  return actual;
}
async function hashArchive(path, entry) {
  need((await stat(path)).size === entry.archiveBytes, entry.archive + ': archive size mismatch');
  const hash = createHash('sha256'); let count = 0;
  for await (const chunk of createReadStream(path)) { count += chunk.length; hash.update(chunk); }
  need(count === entry.archiveBytes && hash.digest('hex') === entry.archiveSha256, entry.archive + ': archive hash mismatch');
}
async function* decoded(bank, name) {
  const entry = bank.entries[name], path = bank.paths[name];
  need(entry && path, 'unauthenticated stream');
  const source = createReadStream(path, { highWaterMark: 65536 });
  const stream = path.endsWith('.gz') ? source.pipe(createGunzip({ chunkSize: 65536 })) : source;
  if (stream !== source) source.on('error', error => stream.destroy(error));
  const hash = createHash('sha256'); let count = 0;
  try {
    for await (const chunk of stream) {
      count += chunk.length;
      need(count <= entry.decompressedBytes, name + ': decoded size exceeds bound');
      hash.update(chunk); bank.compositeHashes?.[name]?.update(chunk); yield chunk;
    }
    need(count === entry.decompressedBytes && hash.digest('hex') === entry.decompressedSha256, name + ': decoded hash mismatch');
  } finally { stream.destroy(); source.destroy(); }
}
async function* lines(bank, name, parseJSON = true) {
  let pending = Buffer.alloc(0), offset = 0, lineNumber = 0;
  for await (const chunk of decoded(bank, name)) {
    pending = Buffer.concat([pending, chunk]);
    let end;
    while ((end = pending.indexOf(10)) >= 0) {
      const bytes = pending.subarray(0, end + 1);
      need(bytes.length <= MAX_LINE, name + ': line exceeds bound');
      yield { bytes, offset, lineNumber: ++lineNumber, value: parseJSON ? parse(bytes) : null };
      offset += bytes.length; pending = pending.subarray(end + 1);
    }
    need(pending.length <= MAX_LINE, name + ': pending line exceeds bound');
  }
  need(pending.length === 0, name + ': unterminated line');
}
async function small(bank, name) {
  need(bank.entries[name].decompressedBytes <= 4 * 1024 * 1024, 'small bank object exceeds bound');
  const chunks = []; for await (const chunk of decoded(bank, name)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** Authenticate original compressed bytes before any row can be read. */
export async function authenticateOriginalBank({ repositoryRoot = resolve(HERE, '../..') } = {}) {
  const receiptPath = await safePath(repositoryRoot, 'examples/physics-public-disjoint-hinge-reference/saved-input-authentication.json');
  need((await stat(receiptPath)).size === 34958, 'selected receipt size mismatch');
  const receiptBytes = await readFile(receiptPath);
  exact(receiptBytes, 34958, RECEIPT_SHA, 'selected receipt');
  const receipt = parse(receiptBytes);
  need(receipt.nativeHead === NATIVE_HEAD, 'original native authority mismatch');
  const root = resolve(repositoryRoot, BANK), manifestPath = await safePath(root, 'manifest.json');
  need((await stat(manifestPath)).size <= 1024 * 1024, 'manifest size exceeds bound');
  const manifestBytes = await readFile(manifestPath);
  need(digest(manifestBytes) === MANIFEST_SHA && receipt.bankManifest.sha256 === MANIFEST_SHA, 'manifest hash mismatch');
  const manifest = parse(manifestBytes);
  need(manifest.consumerHead === receipt.consumerHead && manifest.allGraphDisposition === 'HINGE2_WORLD_GO', 'original bank identity mismatch');
  const names = ['main.native.jsonl.gz', 'main.records.jsonl.gz', 'main.bodies.raw.gz',
    'reference.stdin.raw.gz', 'reference.stdout.raw.gz', 'completed-initial.stdin.raw', 'completed-initial.stdout.raw'];
  const entries = {}, paths = {};
  for (const name of names) {
    const entry = manifest.entries.find(item => item.archive === 'source-proof/' + name);
    need(entry && Number.isSafeInteger(entry.archiveBytes) && entry.archiveBytes >= 0 && entry.archiveBytes < 16 * 1024 * 1024 &&
      Number.isSafeInteger(entry.decompressedBytes) && entry.decompressedBytes >= 0 && entry.decompressedBytes < 256 * 1024 * 1024,
    'invalid bounded manifest stream');
    entries[name] = entry; paths[name] = await safePath(root, entry.archive);
    await hashArchive(paths[name], entry);
  }
  const bank = { root, receipt, manifest, entries, paths, provenance: {
    nativeHead: NATIVE_HEAD, consumerHead: manifest.consumerHead, receiptSha256: RECEIPT_SHA,
    manifestSha256: MANIFEST_SHA, expectedSteps: 1200, graph: 'source', modelsRun: 0, referencesRun: 0,
    compressedAuthentication: 'PASS', fullDecodedAuthentication: 'PENDING', completedRows: 0 } };
  // Keep immutable stream descriptors outside caller-owned bank metadata.
  authenticatedBanks.set(bank, { entries: structuredClone(entries), paths: { ...paths } });
  return bank;
}

function locatorMatches(line, locator, prefix = 0) {
  need(locator && Number.isSafeInteger(locator.offset) && locator.offset >= prefix &&
    line.offset === locator.offset - prefix, 'stream locator offset mismatch');
  need(line.bytes.length === locator.bytes, 'saved row locator: byte count mismatch');
  // Original reply receipts have no per-line hash; their bytes are authenticated
  // by the immutable full archive and decoded stream hashes, not an invented locator.
  if (Object.hasOwn(locator, 'sha256')) exact(line.bytes, locator.bytes, locator.sha256, 'saved row locator');
}
async function at(iterator, locator, prefix) {
  let next;
  do { next = await iterator.next(); need(!next.done, 'saved IPC stream ended early'); }
  while (next.value.offset < locator.offset - prefix);
  locatorMatches(next.value, locator, prefix);
  next.value.value = parse(next.value.bytes);
  return next.value;
}
async function drain(iterator) { while (!(await iterator.next()).done) { /* Verify trailing controls and full decoded hash. */ } }

/** Consume all 1200 rows to finish decoded authentication. At most one native/IPC row is retained.
 * All returned requests are historical data. Never substitute a new request for an old certificate.
 */
export async function* iterateOriginalRows(bank) {
  need(authenticatedBanks.has(bank), 'bank was not authenticated by this module');
  const streams = authenticatedBanks.get(bank);
  need(streams.active !== true, 'bank iterator is already active');
  streams.active = true;
  bank.provenance.completedRows = 0;
  bank.provenance.fullDecodedAuthentication = 'IN_PROGRESS';
  const native = lines(streams, 'main.native.jsonl.gz')[Symbol.asyncIterator]();
  const input = lines(streams, 'reference.stdin.raw.gz', false)[Symbol.asyncIterator]();
  const output = lines(streams, 'reference.stdout.raw.gz', false)[Symbol.asyncIterator]();
  const raw = await small(streams, 'main.bodies.raw.gz');
  const prefixIn = await small(streams, 'completed-initial.stdin.raw');
  const prefixOut = await small(streams, 'completed-initial.stdout.raw');
  streams.compositeHashes = {
    'reference.stdin.raw.gz': createHash('sha256').update(prefixIn),
    'reference.stdout.raw.gz': createHash('sha256').update(prefixOut),
  };
  let index = 0, initialSeen = false;
  let previousProjectedRaw = raw.subarray(0, 416).toString('hex');
  try {
    for await (const recordLine of lines(streams, 'main.records.jsonl.gz')) {
      const record = recordLine.value;
      if (record.type === 'initial') {
        need(!initialSeen && index === 0 && record.stepIndex === 0 && record.raw.offset === 0 && record.raw.bytes === 416, 'initial row mismatch');
        initialSeen = true; continue;
      }
      need(initialSeen && ++index <= 1200 && record.type === 'step' && record.attemptedStepIndex === index &&
        record.acceptedStepIndex === index && record.passed === true && record.outcome === 'returned', 'original step order/outcome mismatch');
      const next = await native.next(); need(!next.done, 'native stream ended early');
      const nativeLine = next.value; locatorMatches(nativeLine, record.nativeLocator);
      const requestLine = await at(input, record.request, prefixIn.length);
      const replyLine = await at(output, record.reply, prefixOut.length);
      const nativeRecord = nativeLine.value, request = nativeRecord.request, reply = replyLine.value;
      need(isDeepStrictEqual(request, requestLine.value), 'native request differs from actual saved IPC');
      need(request.op === 'world-step' && request.outcome === 'returned' && request.dt === 1 / 120 &&
        request.sourceState.stepIndex === index - 1 && request.output.state.stepIndex === index &&
        request.commands.length === 0 && request.commandsRawHex === '' && request.attempt.stage === 'report-ready', 'saved original request mismatch');
      need(reply.ok === true && reply.resolved === true && reply.executionFailure === false &&
        reply.referenceStatus === 'RETURN' && reply.error === null && reply.violations.length === 0, 'saved certificate did not qualify');
      need(request.rawFrames.source === previousProjectedRaw, 'raw step continuation mismatch');
      need(record.raw.length === 6 && record.raw.every((phase, i) =>
        phase.phase === ['source', 'angular', 'motor', 'free', 'postContact', 'projected'][i] &&
        phase.offset === 416 + (index - 1) * 2496 + i * 416), 'six-phase raw order mismatch');
      for (const phase of record.raw) {
        need(phase.bytes === 416 && phase.offset >= 0 && phase.offset + phase.bytes <= raw.length, 'raw phase range invalid');
        const bytes = raw.subarray(phase.offset, phase.offset + phase.bytes);
        exact(bytes, phase.bytes, phase.sha256, 'raw phase');
        need(request.rawFrames[phase.phase] === bytes.toString('hex'), 'raw phase differs from request');
      }
      // JSON bytes and pointer lists remain available in the authenticated line locators.
      for (const [root, paths] of Object.entries(request.negativeZeroPaths)) restoreNegativeZeroPaths(request[root], paths);
      previousProjectedRaw = request.rawFrames.projected;
      bank.provenance.completedRows = index;
      yield { stepIndex: index, request, reply, nativeRecord, record,
        initialRawHex: index === 1 ? raw.subarray(0, 416).toString('hex') : null,
        locators: { native: record.nativeLocator, request: record.request, reply: { ...record.reply, sha256: digest(replyLine.bytes) },
          requestPhysicalOffset: record.request.offset - prefixIn.length,
          replyPhysicalOffset: record.reply.offset - prefixOut.length,
          record: { offset: recordLine.offset, bytes: recordLine.bytes.length, sha256: digest(recordLine.bytes) } } };
    }
    need(index === 1200 && (await native.next()).done, 'full original bank row count mismatch');
    await drain(input); await drain(output);
    bank.provenance.logicalIPC = Object.fromEntries(['stdin', 'stdout'].map(side => [side, {
      bytes: streams.entries['reference.' + side + '.raw.gz'].decompressedBytes + (side === 'stdin' ? prefixIn.length : prefixOut.length),
      sha256: streams.compositeHashes['reference.' + side + '.raw.gz'].digest('hex'),
    }]));
    bank.provenance.fullDecodedAuthentication = 'PASS';
    bank.provenance.completedAuthenticationPasses = (bank.provenance.completedAuthenticationPasses ?? 0) + 1;
  } finally {
    await native.return?.(); await input.return?.(); await output.return?.();
    if (bank.provenance.fullDecodedAuthentication !== 'PASS') bank.provenance.fullDecodedAuthentication = 'INCOMPLETE';
    streams.active = false;
  }
}

/** Authenticate old actual repeat/emitted byte-comparison receipts, without rerunning their graphs. */
export async function authenticateOriginalAliases(bank) {
  need(authenticatedBanks.has(bank) && bank.provenance.fullDecodedAuthentication === 'PASS', 'full source authentication must pass before alias authentication');
  const results = [];
  for (const graph of ['source-repeat', 'compiled-dependencies']) {
    let count = 0;
    for (const entry of bank.manifest.entries.filter(item => item.archive.startsWith('run/' + graph + '-proof/') && item.archive.endsWith('.alias.json'))) {
      need(entry.archiveBytes <= 4096, 'alias receipt exceeds bound');
      const path = await safePath(bank.root, entry.archive), bytes = await readFile(path);
      exact(bytes, entry.archiveBytes, entry.archiveSha256, 'alias receipt');
      const alias = parse(bytes), name = entry.archive.split('/').at(-1).replace('.alias.json', '');
      need(alias.graph === graph && alias.completeEOF === true, 'alias identity or EOF mismatch');
      if (name.startsWith('reference.') && ['stdin', 'stdout'].includes(name.split('.')[1])) {
        const side = name.split('.')[1], logical = bank.provenance.logicalIPC[side];
        need(alias.source.representation === 'composite' && alias.source.completeEOF === true && alias.source.trailingBytes === 0 &&
          alias.source.logicalBytes === logical.bytes && alias.source.logicalSha256 === logical.sha256 &&
          alias.actualComparedBytes === logical.bytes && alias.actualComparedSha256 === logical.sha256 && alias.composite.length === 2,
        'composite alias differs from authenticated original');
        for (const [i, streamName] of ['completed-initial.' + side + '.raw', 'reference.' + side + '.raw.gz'].entries()) {
          const pinned = bank.manifest.entries.find(item => item.archive === 'source-proof/' + streamName), segment = alias.composite[i];
          need(segment.offset === 0 && segment.bytes === pinned.decompressedBytes && segment.sha256 === pinned.decompressedSha256 &&
            segment.completeEOF === true && segment.trailingBytes === 0, 'composite alias segment mismatch');
        }
      } else {
        const pinned = bank.manifest.entries.find(item => item.archive === 'source-proof/' + name || item.archive === 'source-proof/' + name + '.gz');
        need(pinned && alias.source.bytes === pinned.decompressedBytes && alias.source.sha256 === pinned.decompressedSha256 &&
          alias.source.completeEOF === true && alias.source.noUnusedBytes === true &&
          (!name.endsWith('.jsonl') || alias.source.trailingBytes === 0) &&
          alias.actualComparedBytes === pinned.decompressedBytes && alias.actualComparedSha256 === pinned.decompressedSha256,
        'alias differs from pinned original stream');
      }
      count++;
    }
    need(count === 8, 'original graph must contain eight authenticated stream aliases');
    results.push({ graph, aliases: count, status: 'PASS', newGraphExecution: false });
  }
  bank.provenance.aliases = results;
  return results;
}

/** Exact data comparison only. This is not a new independent numerical evaluation. */
export function canReuseOriginalCertificate(row, { before, after, report }) {
  return isDeepStrictEqual(before, row.request.sourceState) &&
    isDeepStrictEqual(after, row.request.output.state) &&
    isDeepStrictEqual(report, row.request.output.diagnostics);
}
