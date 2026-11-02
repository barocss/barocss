/** DATA-only audit of both saved prefix replies. No fixture/reference/World/solver/trig imports or calls. */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const bankPath = 'examples/physics-contact-boundary-2276/evidence/world-source-03';
const manifestPath = 'examples/physics-contact-boundary-2276/manifest.json';
const manifestHash = '824cde0637a1cf033f77f673b1b4e12caf478c6b0aea6dbe9fc185b8a3f653c3';
const census = join(here, 'evidence/cost-census-01');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bits = value => { const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value); return bytes.toString('hex'); };
const pointer = value => value.replaceAll('~', '~0').replaceAll('/', '~1');
function need(test, message) { if (!test) throw Error(message); }
function local(path) {
  need(typeof path === 'string' && !path.startsWith('/') && !path.split('/').includes('..'), 'unsafe audit input path');
  const result = realpathSync(join(root, path));
  need(result.startsWith(realpathSync(root) + sep), 'audit input escaped repository'); return result;
}
function readBound(path, maximum = 2 * 1024 * 1024) { need(statSync(path).size <= maximum, 'audit input exceeds bound'); return readFileSync(path); }
function authenticated(path, bytes, hash) {
  const data = readBound(path); need(data.length === bytes && sha(data) === hash, 'input byte/hash mismatch: ' + path); return data;
}
function parse(bytes) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
function json(out, name, value) { const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); need(bytes.length <= 8 * 1024 * 1024, 'audit artifact exceeds8MiB'); writeFileSync(join(out, name), bytes, { flag: 'wx' }); return { path: name, bytes: bytes.length, sha256: sha(bytes) }; }

/** Exhaustive corresponding-node comparison. Object order is not a JSON field;
 * all key sets, array indices, strings, types, and finite number bits are checked.
 */
function fullDiff(expected, actual) {
  const differences = [], visited = { nodes: 0, equalNumericLeaves: 0, archiveZeroPaths: [], freshZeroPaths: [], freshNegativeZeroPaths: [] };
  function walk(a, b, path) {
    need(++visited.nodes <= 1000000, 'full reply tree exceeds node bound');
    if (typeof a === 'number' || typeof b === 'number') {
      if (typeof a === 'number') { need(Number.isFinite(a), 'nonfinite archived number'); if (a === 0) visited.archiveZeroPaths.push(path); }
      if (typeof b === 'number') {
        need(Number.isFinite(b), 'nonfinite fresh number');
        if (b === 0) { visited.freshZeroPaths.push(path); if (Object.is(b, -0)) visited.freshNegativeZeroPaths.push(path); }
      }
      if (typeof a === 'number' && typeof b === 'number' && Object.is(a, b)) { visited.equalNumericLeaves++; return; }
      const classification = typeof a === 'number' && typeof b === 'number' ? a === 0 && b === 0 ? 'ZERO_SIGN_ONLY' : 'NONZERO_NUMBER_BITS' : 'VALUE_TYPE';
      differences.push({ path, classification, expected: a, actual: b,
        archiveStoredF64LE: typeof a === 'number' ? bits(a) : null, freshF64LE: typeof b === 'number' ? bits(b) : null,
        historicalPreArchiveReplyZeroSign: classification === 'ZERO_SIGN_ONLY' ? 'UNKNOWN' : null }); return;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      if (a !== b) differences.push({ path, classification: typeof a === typeof b ? 'NONNUMERIC_VALUE' : 'VALUE_TYPE', expected: a, actual: b });
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) { differences.push({ path, classification: 'CONTAINER_TYPE', expectedArray: Array.isArray(a), actualArray: Array.isArray(b) }); return; }
    if (Array.isArray(a) && a.length !== b.length) differences.push({ path, classification: 'ARRAY_LENGTH', expected: a.length, actual: b.length });
    const keysA = Object.keys(a), keysB = Object.keys(b);
    for (const key of keysA) {
      const next = path + '/' + pointer(key);
      if (!Object.hasOwn(b, key)) differences.push({ path: next, classification: 'MISSING_KEY', expected: a[key] });
      else walk(a[key], b[key], next);
    }
    for (const key of keysB) if (!Object.hasOwn(a, key)) differences.push({ path: path + '/' + pointer(key), classification: 'EXTRA_KEY', actual: b[key] });
  }
  walk(expected, actual, '');
  return { differences, zeroSignOnlyCount: differences.filter(item => item.classification === 'ZERO_SIGN_ONLY').length,
    nonZeroSignDifferenceCount: differences.filter(item => item.classification !== 'ZERO_SIGN_ONLY').length, ...visited };
}

async function archivedRow(manifest, report, locator) {
  const name = bankPath + '/ALIGNED.jsonl.gz', entry = manifest.files.find(item => item.path === name);
  need(entry, 'original archive entry missing');
  const path = local(name), compressed = authenticated(path, entry.bytes, entry.sha256);
  const hash = createHash('sha256'); let count = 0, copied = 0;
  need(Number.isSafeInteger(locator.decodedByteOffset) && Number.isSafeInteger(locator.bytes) && locator.bytes > 0 && locator.bytes <= 4 * 1024 * 1024, 'selected original locator invalid');
  const selected = Buffer.alloc(locator.bytes), source = createReadStream(path), decoded = source.pipe(createGunzip());
  source.on('error', error => decoded.destroy(error));
  try {
    for await (const chunk of decoded) {
      const next = count + chunk.length; need(next <= 32 * 1024 * 1024, 'decoded original archive exceeds32MiB'); hash.update(chunk);
      const start = Math.max(count, locator.decodedByteOffset), stop = Math.min(next, locator.decodedByteOffset + locator.bytes);
      if (stop > start) { chunk.copy(selected, start - locator.decodedByteOffset, start - count, stop - count); copied += stop - start; }
      count = next;
    }
  } finally { decoded.destroy(); source.destroy(); }
  const decodedHash = hash.digest('hex');
  need(decodedHash === report.evidence.decodedRecordSha256 && copied === locator.bytes && sha(selected) === locator.sha256 && selected.at(-1) === 10,
    'full original decode hash/EOF or selected row hash mismatch');
  const row = parse(selected); need(row.kind === 'step' && row.scene === 'ALIGNED' && row.step === 1 && row.positionCheck, 'wrong original selected row');
  return { row, authentication: { archive: name, compressedBytes: compressed.length, compressedSha256: sha(compressed),
    decodedBytes: count, decodedSha256: decodedHash, completeDecodedEOF: true, selectedRow: locator } };
}

const id = process.argv[2];
need(process.argv.length === 3 && /^[a-z0-9][a-z0-9-]{0,95}$/.test(id ?? ''), 'usage: node reply-observation-audit.mjs fresh-data-audit-id');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const out = join(here, 'evidence', id); need(!existsSync(out), 'fresh DATA audit ID required'); mkdirSync(out);
const summary = { kind: 'P4_SAVED_REPLY_OBSERVATION_AUDIT', id, status: 'IN_PROGRESS',
  node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch,
  auditSourceSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  calls: { reference: 0, fixture: 0, World: 0, solver: 0, trig: 0 }, firstFailure: null,
  preservedCensusStatus: 'FAIL', historicalPreArchiveReplyZeroSigns: 'UNKNOWN', historicalBinaryReplyEquality: 'NOT_ESTABLISHED',
  observationSemantics: 'A separate actual Node JSON.parse -> JSON.stringify -> JSON.parse observation of the saved fresh reply. It does not replace any physical output or change any physical tolerance/raw-body gate.' };
try {
  const manifestBytes = authenticated(local(manifestPath), 73147, manifestHash), manifest = parse(manifestBytes);
  const pinned = [
    ['summary.json', 8319, 'bf65e7fadf3b87f6f80cfac4f1f05bd5fb9f4462fcf0947aaa3a19125bf44357'],
    ['ALIGNED-1.authentication.json', 74420, 'f4c15f55994e0a474185ce0b477ef05dc21dba64a4de88c44ed6d4c098c8a80d'],
    ['ALIGNED-1-position-world.comparison.json', 1488, '1d36aa76322046fe8f143ea720ad406dc9fe1f4f988a2fa5c595a25ca9656084'],
    ['ALIGNED-1-contacts.comparison.json', 1167, '23df285555f0402f37ede1ed221bb17c993ab47d5866bc059097b5cc716778b2'],
  ];
  const saved = {}, receiptHashes = {};
  for (const [name, bytes, hash] of pinned) { saved[name] = parse(authenticated(join(census, name), bytes, hash)); receiptHashes[name] = { bytes, sha256: hash }; }
  const failed = saved['summary.json'], comparison = saved['ALIGNED-1-position-world.comparison.json'], locator = saved['ALIGNED-1.authentication.json'].recordLocator;
  need(failed.status === 'FAIL' && failed.counts.referenceIpcAttempted === 2 && failed.counts.referenceRepliesCompleted === 2 && failed.counts.fullReplyEqual === 1 && comparison.exactFullReplyEqual === false,
    'original failed census/count boundary changed');
  const guardBytes = authenticated(join(here, 'evidence/guard-01/result.json'), 6122, '5ba5ee744b1a99fc2a35363ddac6d8ad3078f0c7d909845ee8f4157337c36d34'), guard = parse(guardBytes);
  need(guard.status === 'FAIL' && guard.censusId === 'cost-census-01', 'original outer failure changed');
  const sourceHashes = {};
  for (const [name, pin] of Object.entries(guard.inputs)) {
    const bytes = authenticated(join(here, name), pin.bytes, pin.sha256); sourceHashes[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  const sourcePath = bankPath + '/source.json', sourcePin = manifest.files.find(item => item.path === sourcePath);
  need(sourcePin, 'original provider source receipt missing');
  const sourceBytes = authenticated(local(sourcePath), sourcePin.bytes, sourcePin.sha256), oldSource = parse(sourceBytes);
  const spec = parse(readBound(join(census, 'reference-spec.json')));
  need(spec.harnessSha256 === failed.harnessSha256 &&
    JSON.stringify(Object.entries(spec.providerPins).sort()) === JSON.stringify(Object.entries(failed.authentication.providerPins).sort()),
  'saved reference spec differs from authenticated failed census');
  const sourcePins = new Map(oldSource.files.map(item => [item.path, item.sha256]));
  const referenceSources = {};
  for (const [path, wanted] of Object.entries(spec.providerPins)) {
    need(sourcePins.get(path) === wanted, 'reference source pin differs from original source receipt');
    const bytes = readBound(local(path)); need(sha(bytes) === wanted, 'immutable reference source changed'); referenceSources[path] = { bytes: bytes.length, sha256: wanted };
  }
  const reportPath = bankPath + '/ALIGNED-result.json', reportPin = manifest.files.find(item => item.path === reportPath);
  need(reportPin, 'original scene outcome missing'); const report = parse(authenticated(local(reportPath), reportPin.bytes, reportPin.sha256));
  const original = await archivedRow(manifest, report, locator);
  need(JSON.stringify(comparison.recordLocator) === JSON.stringify(locator), 'failed comparison and archive locator differ');
  const replyPin = comparison.locators.reply;
  need(replyPin.path === 'ALIGNED-1-position-world.stdout.raw', 'unexpected captured reply path');
  const rawReply = authenticated(join(census, replyPin.path), replyPin.bytes, replyPin.sha256), freshReply = parse(rawReply);
  need(rawReply.at(-1) === 10 && rawReply.subarray(0, -1).indexOf(10) < 0, 'captured reply must be one complete JSON line');
  const strict = fullDiff(original.row.positionCheck, freshReply);
  json(out, 'strict-all-differences.json', strict);
  // This is the actual Node operation under review. The fresh parsed reply is not mutated.
  const nodeObservableBytes = Buffer.from(JSON.stringify(freshReply)), nodeObservable = JSON.parse(nodeObservableBytes.toString('utf8'));
  const observed = fullDiff(original.row.positionCheck, nodeObservable);
  const observableArtifact = { path: 'fresh-reply-node-json-observable.json', bytes: nodeObservableBytes.length, sha256: sha(nodeObservableBytes) };
  writeFileSync(join(out, observableArtifact.path), nodeObservableBytes, { flag: 'wx' });
  json(out, 'node-observable-all-differences.json', observed);
  summary.provenance = { originalManifest: { path: manifestPath, bytes: manifestBytes.length, sha256: manifestHash },
    originalProviderReceipt: { path: sourcePath, bytes: sourceBytes.length, sha256: sha(sourceBytes) },
    originalArchive: original.authentication, preservedFailedCensusReceipts: receiptHashes,
    preservedOuterReceipt: { bytes: guardBytes.length, sha256: sha(guardBytes) }, censusSources: sourceHashes, immutableReferenceSources: referenceSources,
    capturedFreshReply: { path: relative(root, join(census, replyPin.path)), bytes: rawReply.length, sha256: sha(rawReply) },
    archivePositionCheckNodeJSONSha256: sha(Buffer.from(JSON.stringify(original.row.positionCheck))),
    separateNodeObservableArtifact: observableArtifact };
  summary.originalCensusCounts = failed.counts; summary.originalChildCallCounts = failed.referenceCallCounts;
  summary.strictComparison = { status: strict.differences.length ? 'FAIL_PRESERVED' : 'PASS', totalDifferences: strict.differences.length,
    zeroSignOnlyCount: strict.zeroSignOnlyCount, nonZeroSignDifferenceCount: strict.nonZeroSignDifferenceCount,
    archiveZeroCount: strict.archiveZeroPaths.length, freshZeroCount: strict.freshZeroPaths.length, freshNegativeZeroCount: strict.freshNegativeZeroPaths.length };
  summary.separateNodeObservableComparison = { status: observed.differences.length ? 'FAIL' : 'PASS', totalDifferences: observed.differences.length,
    zeroSignOnlyCount: observed.zeroSignOnlyCount, nonZeroSignDifferenceCount: observed.nonZeroSignDifferenceCount,
    remainingNegativeZeroCount: observed.freshNegativeZeroPaths.length, completeStructureStringAndNumberBitComparison: true };
  const positionRequestPin = comparison.locators.request;
  need(positionRequestPin.path === 'ALIGNED-1-position-world.stdin.jsonl', 'unexpected position request path');
  authenticated(join(census, positionRequestPin.path), positionRequestPin.bytes, positionRequestPin.sha256);
  const repoEvidence = pin => ({ repoPath: relative(root, join(census, pin.path)), bytes: pin.bytes, sha256: pin.sha256 });
  const positionProof = { operation: 'position-world', archiveField: 'positionCheck', recordLocator: locator,
    request: repoEvidence(positionRequestPin), reply: repoEvidence(replyPin),
    observableArtifact: { auditRelativePath: observableArtifact.path, bytes: observableArtifact.bytes, sha256: observableArtifact.sha256 },
    strictComparison: summary.strictComparison, observableComparison: summary.separateNodeObservableComparison,
    archiveReplyNodeJSONSha256: summary.provenance.archivePositionCheckNodeJSONSha256 };
  const contactsComparison = saved['ALIGNED-1-contacts.comparison.json'];
  need(contactsComparison.operation === 'contacts' && contactsComparison.exactFullReplyEqual === true &&
    JSON.stringify(contactsComparison.recordLocator) === JSON.stringify(locator), 'saved contacts comparison/prefix locator differs');
  const contactRequestPin = contactsComparison.locators.request, contactReplyPin = contactsComparison.locators.reply;
  need(contactRequestPin.path === 'ALIGNED-1-contacts.stdin.jsonl' && contactReplyPin.path === 'ALIGNED-1-contacts.stdout.raw', 'unexpected contacts evidence path');
  authenticated(join(census, contactRequestPin.path), contactRequestPin.bytes, contactRequestPin.sha256);
  const contactRaw = authenticated(join(census, contactReplyPin.path), contactReplyPin.bytes, contactReplyPin.sha256);
  need(contactRaw.at(-1) === 10 && contactRaw.subarray(0, -1).indexOf(10) < 0, 'contacts reply must be one complete JSON line');
  const contacts = parse(contactRaw), contactStrict = fullDiff(original.row.contactGeometry, contacts);
  json(out, 'contacts-strict-all-differences.json', contactStrict);
  // A second actual Node round trip of saved data only; no reference request.
  const contactObservableBytes = Buffer.from(JSON.stringify(contacts)), contactObserved = fullDiff(original.row.contactGeometry, JSON.parse(contactObservableBytes.toString('utf8')));
  const contactArtifact = { auditRelativePath: 'contacts-fresh-reply-node-json-observable.json', bytes: contactObservableBytes.length, sha256: sha(contactObservableBytes) };
  writeFileSync(join(out, contactArtifact.auditRelativePath), contactObservableBytes, { flag: 'wx' });
  json(out, 'contacts-node-observable-all-differences.json', contactObserved);
  const contactProof = { operation: 'contacts', archiveField: 'contactGeometry', recordLocator: locator,
    request: repoEvidence(contactRequestPin), reply: repoEvidence(contactReplyPin), observableArtifact: contactArtifact,
    strictComparison: { status: contactStrict.differences.length ? 'FAIL' : 'PASS', totalDifferences: contactStrict.differences.length,
      zeroSignOnlyCount: contactStrict.zeroSignOnlyCount, nonZeroSignDifferenceCount: contactStrict.nonZeroSignDifferenceCount,
      archiveZeroCount: contactStrict.archiveZeroPaths.length, freshZeroCount: contactStrict.freshZeroPaths.length,
      freshNegativeZeroCount: contactStrict.freshNegativeZeroPaths.length },
    observableComparison: { status: contactObserved.differences.length ? 'FAIL' : 'PASS', totalDifferences: contactObserved.differences.length,
      zeroSignOnlyCount: contactObserved.zeroSignOnlyCount, nonZeroSignDifferenceCount: contactObserved.nonZeroSignDifferenceCount,
      remainingNegativeZeroCount: contactObserved.freshNegativeZeroPaths.length, completeStructureStringAndNumberBitComparison: true },
    archiveReplyNodeJSONSha256: sha(Buffer.from(JSON.stringify(original.row.contactGeometry))) };
  summary.prefixReplies = [contactProof, positionProof];
  need(strict.differences.length > 0 && strict.nonZeroSignDifferenceCount === 0, 'strict saved reply has a nonzero/key/string/type difference or failed-census mismatch vanished');
  need(observed.differences.length === 0, 'Node JSON-wire-observable comparison is not exactly equal');
  need(contactStrict.differences.length === 0 && contactObserved.differences.length === 0, 'contacts strict or Node observable full comparison failed');
  // Recheck original immutable failure and raw bytes. No existing file was written.
  for (const [name, bytes, hash] of pinned) authenticated(join(census, name), bytes, hash);
  authenticated(join(census, replyPin.path), replyPin.bytes, replyPin.sha256);
  authenticated(join(census, contactReplyPin.path), contactReplyPin.bytes, contactReplyPin.sha256);
  summary.status = 'PASS_DATA_OBSERVATION_CLASSIFICATION';
} catch (error) { summary.status = 'FAIL'; summary.firstFailure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
const result = json(out, 'summary.json', summary);
console.log(JSON.stringify({ id, status: summary.status, strictComparison: summary.strictComparison ?? null,
  separateNodeObservableComparison: summary.separateNodeObservableComparison ?? null, summary: result, calls: summary.calls, firstFailure: summary.firstFailure }));
