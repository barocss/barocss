// Verify all API-specific artifacts in addition to the accepted generic capture chain.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { apiRequest, inspectApiResponse, API_CEILING_MICRO_USD, API_RESERVATION_MICRO_USD } from './api-prep.mjs';
import { verifyApiFrozen } from './api-frozen.mjs';
import { verifyCapture } from './provenance.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function verifyApiCapture(runDir) {
  const capture = verifyCapture(runDir);
  const manifestBytes = fs.readFileSync(path.join(runDir, 'api-run-manifest.json'));
  const apiManifest = JSON.parse(manifestBytes);
  if (apiManifest.kind !== 'barocss-458-direct-responses' || apiManifest.apiPlanHash !== verifyApiFrozen() ||
      apiManifest.capturePlanHash !== capture.manifest.planHash || apiManifest.maxChargeMicroUsd !== API_CEILING_MICRO_USD ||
      !['api-stub', 'api-live'].includes(apiManifest.transportKind) || apiManifest.synthetic !== capture.manifest.synthetic ||
      (apiManifest.transportKind === 'api-stub') !== capture.manifest.synthetic ||
      (apiManifest.transportKind === 'api-live' && (!/^[a-f0-9]{64}$/.test(apiManifest.approvalSha256) ||
        !/^[a-f0-9]{40}$/.test(apiManifest.reviewedCommit))) ||
      (apiManifest.transportKind === 'api-stub' && (apiManifest.approvalSha256 !== null || apiManifest.reviewedCommit !== null))) throw new Error('API run manifest drift');
  const inventory = { ...capture.inventory, 'api-run-manifest.json': sha(manifestBytes) };
  if (apiManifest.transportKind === 'api-live') {
    const claimBytes = fs.readFileSync(`${runDir}.claim`);
    const claim = JSON.parse(claimBytes);
    if (claim.outputDir !== runDir || claim.runId !== path.basename(runDir).slice(4) ||
        claim.approvalSha256 !== apiManifest.approvalSha256) throw new Error('API run claim drift');
    inventory['../run.claim'] = sha(claimBytes);
  }
  let held = 0;
  for (const row of capture.rows.filter((item) => item.attempted)) {
    const dirName = `attempt-${String(row.ordinal).padStart(2, '0')}`;
    const dir = path.join(runDir, dirName);
    const transport = JSON.parse(fs.readFileSync(path.join(dir, 'transport.json'), 'utf8'));
    if (!Number.isSafeInteger(row.elapsedMs) || row.elapsedMs < 0 || transport.elapsedMs !== row.elapsedMs) throw new Error(`API elapsed time drift: ${row.id}`);
    const requestPath = path.join(dir, 'api-request.json');
    const reservationPath = path.join(dir, 'api-charge-reservation.json');
    if (!fs.existsSync(reservationPath)) {
      if (fs.existsSync(requestPath) || !String(row.stopReason).includes('aggregate charge ceiling') ||
          held + API_RESERVATION_MICRO_USD <= API_CEILING_MICRO_USD ||
          capture.rows.slice(row.ordinal + 1).some((later) => later.attempted)) throw new Error(`Invalid API budget stop: ${row.id}`);
      continue;
    }
    const capturedRequest = JSON.parse(fs.readFileSync(path.join(dir, 'request.json'), 'utf8'));
    const apiRequestBytes = fs.readFileSync(requestPath), reservationBytes = fs.readFileSync(reservationPath);
    const request = JSON.parse(apiRequestBytes), reservation = JSON.parse(reservationBytes);
    if (!same(request, apiRequest(capturedRequest.prompt)) || reservation.ordinal !== row.ordinal ||
        reservation.requestSha256 !== sha(JSON.stringify(request)) || reservation.reservedMicroUsd !== API_RESERVATION_MICRO_USD ||
        reservation.ceilingMicroUsd !== API_CEILING_MICRO_USD || reservation.aggregateHeldBeforeMicroUsd !== held ||
        reservation.aggregateHeldAfterMicroUsd !== held + API_RESERVATION_MICRO_USD ||
        reservation.requestedModel !== request.model || reservation.serviceTier !== 'default' ||
        reservation.requestedEndpoint !== 'https://api.openai.com/v1/responses') throw new Error(`API request/reservation drift: ${row.id}`);
    inventory[`${dirName}/api-request.json`] = sha(apiRequestBytes);
    inventory[`${dirName}/api-charge-reservation.json`] = sha(reservationBytes);
    held += API_RESERVATION_MICRO_USD;
    if (held > API_CEILING_MICRO_USD) throw new Error('API aggregate charge ceiling exceeded');
    const responsePath = path.join(dir, 'api-response.json'), settlementPath = path.join(dir, 'api-charge-settlement.json');
    if (!fs.existsSync(responsePath)) {
      if (fs.existsSync(settlementPath) || !String(row.stopReason).startsWith('api-error:')) throw new Error(`Missing API response: ${row.id}`);
      continue;
    }
    const responseBytes = fs.readFileSync(responsePath), response = JSON.parse(responseBytes);
    inventory[`${dirName}/api-response.json`] = sha(responseBytes);
    if (!fs.existsSync(settlementPath)) {
      let reason;
      try { inspectApiResponse(response); } catch (error) { reason = `api-error:${String(error.message).slice(0, 80)}`; }
      if (!reason || row.stopReason !== reason) throw new Error(`Missing or inconsistent API settlement: ${row.id}`);
      continue;
    }
    const settlementBytes = fs.readFileSync(settlementPath), settlement = JSON.parse(settlementBytes);
    const checked = inspectApiResponse(response);
    const raw = fs.readFileSync(path.join(dir, 'raw-final.txt'), 'utf8');
    if (settlement.ordinal !== row.ordinal || settlement.responseSha256 !== sha(responseBytes) ||
        settlement.actualMicroUsd !== checked.usage.microUsd || raw !== checked.rawFinal ||
        !same(row.usage, { inputTokens: checked.usage.inputTokens, cachedInputTokens: checked.usage.cachedInputTokens,
          outputTokens: checked.usage.outputTokens })) throw new Error(`API response/settlement drift: ${row.id}`);
    inventory[`${dirName}/api-charge-settlement.json`] = sha(settlementBytes);
    held = held - API_RESERVATION_MICRO_USD + checked.usage.microUsd;
  }
  return { ...capture, apiManifest, apiEvidenceSha256: sha(JSON.stringify(inventory)), apiInventory: inventory, heldMicroUsd: held };
}
