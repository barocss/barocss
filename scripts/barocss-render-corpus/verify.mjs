// No-model verification of the frozen plan, #460 calibration, and saved #458 lineage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCliArgv, buildCliPrompt, PROMPT_VERSION, PROMPT_CONTRACT_SHA256 } from '../barocss-render-loop/cli-profile.mjs';
import { inspectTurn, sha256 } from './collector.mjs';
import { verifyFrozenPlan } from './freeze.mjs';
import { verifyPriorDispatches } from './launch.mjs';
import { CONTRACT, SCENARIOS } from './plan.mjs';

const privateRoot = '/Users/user/.barocss-ai/v3';
const calibrationDir = path.join(privateRoot, 'private-460-run-f6gsoX');
const claimFile = path.join(privateRoot, 'private-458-corpus-claim.json');
const trackedStatuses = new Set(['valid', 'invalid', 'failed', 'reserved']);
const allStatuses = new Set([...trackedStatuses, 'unattempted', 'ceiling']);
const must = (condition, message) => { if (!condition) throw new Error(message); };

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function savedPath(dir, name) { return path.join(dir, name); }
function actualDispatches(dir) {
  return ['initial', 'next'].filter((kind) => fs.existsSync(savedPath(dir, `${kind}-dispatch.json`)));
}

export function verifyCorpus(corpusDir) {
  const frozen = verifyFrozenPlan();
  const prior = verifyPriorDispatches();
  must(typeof corpusDir === 'string' && path.isAbsolute(corpusDir)
    && path.dirname(corpusDir) === privateRoot
    && path.basename(corpusDir).startsWith('private-458-corpus-run-'), 'Invalid private corpus directory');
  const claim = readJson(claimFile);
  must(claim.kind === 'barocss-458-corpus-launch'
    && claim.issue === 458 && claim.outputDir === corpusDir
    && claim.frozenPlanSha256 === frozen.sha256
    && claim.priorDispatches === CONTRACT.priorDispatches
    && claim.newDispatchCeiling === CONTRACT.newDispatchCeiling
    && claim.aggregateCeiling === CONTRACT.aggregateCeiling, 'Corpus claim does not match frozen plan');
  const manifestBytes = fs.readFileSync(savedPath(corpusDir, 'corpus.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  must(manifest.kind === CONTRACT.kind && manifest.priorDispatches === prior.count
    && Array.isArray(manifest.rows) && manifest.rows.length === SCENARIOS.length,
  'Corpus manifest shape or prior count changed');
  const reservations = fs.readdirSync(corpusDir).filter((name) => /^reservation-[0-9]{2}\.json$/.test(name)).sort();
  must(reservations.length === manifest.newReservations
    && reservations.length <= CONTRACT.newDispatchCeiling, 'Reservation count changed');
  const byTurn = new Map();
  for (const [index, name] of reservations.entries()) {
    const reservation = readJson(savedPath(corpusDir, name));
    const ordinal = CONTRACT.priorDispatches + index + 1;
    must(name === `reservation-${String(ordinal).padStart(2, '0')}.json`
      && reservation.ordinal === ordinal && /^(initial|next)$/.test(reservation.kind)
      && SCENARIOS.some((row) => row.id === reservation.rowId)
      && typeof reservation.outputDir === 'string'
      && path.dirname(reservation.outputDir) === privateRoot
      && path.basename(reservation.outputDir).startsWith(`private-460-corpus-row-${reservation.rowId}-`),
    'Reservation order, row, or private path changed');
    const key = `${reservation.rowId}:${reservation.kind}`;
    must(!byTurn.has(key), 'Duplicate turn reservation');
    byTurn.set(key, reservation);
  }
  const counts = { valid: 0, invalid: 0, failed: 0, reserved: 0, unattempted: 0, ceiling: 0 };
  const lineage = [];
  for (const [index, row] of manifest.rows.entries()) {
    const planned = SCENARIOS[index];
    must(row.id === planned.id && row.prompt === planned.prompt && row.name === planned.name,
      'Scenario input changed after freeze');
    if (index === 0) {
      must(row.initial.status === 'valid' && row.next.status === 'valid'
        && row.initial.outputDir === calibrationDir && row.next.outputDir === calibrationDir
        && row.initial.rawSha256 === prior.calibration.initial.rawSha256
        && row.next.rawSha256 === prior.calibration.next.rawSha256,
      'Calibration lineage changed');
    }
    for (const kind of ['initial', 'next']) {
      const turn = row[kind];
      must(turn && allStatuses.has(turn.status), 'Unaccounted planned turn');
      counts[turn.status]++;
      if (index === 0) continue;
      const reservation = byTurn.get(`${row.id}:${kind}`);
      must(Boolean(reservation) === trackedStatuses.has(turn.status), 'Turn status and reservation disagree');
      if (!reservation) continue;
      must(turn.outputDir === reservation.outputDir, 'Turn output path changed');
      const dispatchPath = savedPath(turn.outputDir, `${kind}-dispatch.json`);
      const resultPath = savedPath(turn.outputDir, `${kind}-result.json`);
      const finalPath = savedPath(turn.outputDir, `${kind}-final.txt`);
      if (!fs.existsSync(dispatchPath) || !fs.existsSync(resultPath)) {
        must(['reserved', 'failed'].includes(turn.status), 'Missing dispatch or result for completed turn');
        lineage.push({ rowId: row.id, kind, status: turn.status, diagnostic: 'dispatch-or-result-missing' });
        continue;
      }
      const dispatch = readJson(dispatchPath);
      const result = readJson(resultPath);
      must(dispatch.kind === kind && dispatch.promptVersion === PROMPT_VERSION
        && dispatch.promptContractSha256 === PROMPT_CONTRACT_SHA256
        && dispatch.dispatchNumber === (kind === 'initial' ? 1 : 2), 'Transport dispatch setting changed');
      const request = kind === 'initial' ? { kind, prompt: row.prompt }
        : { kind, action: 'save', revision: 1, input: { name: row.name } };
      const expectedPrompt = buildCliPrompt(request);
      const promptBytes = fs.readFileSync(savedPath(turn.outputDir, `${kind}-prompt.txt`));
      must(sha256(promptBytes) === dispatch.promptSha256
        && promptBytes.toString('utf8') === expectedPrompt, 'Frozen prompt changed');
      const initialResult = kind === 'next' ? readJson(savedPath(turn.outputDir, 'initial-result.json')) : null;
      const expectedArgv = buildCliArgv({ kind, cwd: dispatch.cwd,
        schemaPath: path.join(dispatch.cwd, 'schema.json'), finalPath,
        ...(kind === 'next' ? { threadId: initialResult.threadId } : {}) });
      must(JSON.stringify(dispatch.argv) === JSON.stringify(expectedArgv), 'CLI argv changed');
      if (kind === 'next') must(result.threadId === initialResult.threadId, 'CLI session changed');
      if (['valid', 'invalid'].includes(turn.status)) {
        must(result.exitCode === 0 && result.completed === true && result.stopReason === null
          && result.validationFailure === null, 'Completed turn transport changed');
      }
      let rawSha256 = null;
      if (fs.existsSync(finalPath)) {
        const raw = fs.readFileSync(finalPath);
        rawSha256 = sha256(raw);
        if (['valid', 'invalid'].includes(turn.status)) {
          must(typeof turn.rawSha256 === 'string' && turn.rawSha256 === rawSha256,
            'Saved final digest changed');
        } else if (turn.rawSha256) must(turn.rawSha256 === rawSha256, 'Saved final digest changed');
        const text = raw.toString('utf8').replace(/\r?\n$/, '');
        must(!result.finalEventHash || result.finalEventHash === sha256(text), 'CLI event/final mismatch');
        if (turn.status === 'valid' || turn.status === 'invalid') {
          const envelope = JSON.parse(raw.toString('utf8'));
          const checked = inspectTurn({ threadId: result.threadId, specJson: envelope.specJson },
            kind, row.name, kind === 'next' ? initialResult.threadId : null);
          must(checked.status === turn.status && checked.reason === turn.reason,
            'Saved output classification changed');
        }
      } else must(!['valid', 'invalid'].includes(turn.status), 'Completed generation lost raw output');
      lineage.push({ rowId: row.id, kind, status: turn.status, rawSha256,
        dispatchSha256: sha256(fs.readFileSync(dispatchPath)),
        resultSha256: sha256(fs.readFileSync(resultPath)), elapsedMs: result.elapsedMs,
        stopReason: result.stopReason, validationFailure: result.validationFailure });
    }
    if (index > 0 && row.initial.outputDir && path.dirname(row.initial.outputDir) === privateRoot) {
      const observed = actualDispatches(row.initial.outputDir);
      for (const kind of observed) must(byTurn.has(`${row.id}:${kind}`), 'Unreserved CLI dispatch exists');
    }
  }
  must(prior.count + reservations.length <= CONTRACT.aggregateCeiling, 'Aggregate call ceiling exceeded');
  return { kind: 'barocss-render-corpus-verification-v1', taskCommit: claim.taskCommit,
    frozenPlanSha256: frozen.sha256, corpusManifestSha256: sha256(manifestBytes),
    priorDispatches: prior.count, newReservations: reservations.length,
    aggregateReservations: prior.count + reservations.length, counts, lineage };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === '--prior') {
    console.log(JSON.stringify({ frozenPlanSha256: verifyFrozenPlan().sha256,
      priorDispatches: verifyPriorDispatches().count }));
  } else if (process.argv.length === 3 && process.argv[2] === '--claim') {
    console.log(JSON.stringify(verifyCorpus(readJson(claimFile).outputDir), null, 2));
  } else if (process.argv.length === 4 && process.argv[2] === '--corpus') {
    console.log(JSON.stringify(verifyCorpus(process.argv[3]), null, 2));
  } else throw new Error('Usage: node verify.mjs --prior | --claim | --corpus PRIVATE_CORPUS_DIR');
}
