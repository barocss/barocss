// Gated direct OpenAI Responses dispatcher. Importing this file does not send a request.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { capture } from './capture.mjs';
import { preparedApiTransport, API_CEILING_MICRO_USD } from './api-prep.mjs';
import { verifyApiFrozen } from './api-frozen.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyApiCapture } from './api-provenance.mjs';
import { MODEL } from './plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const privateRoot = '/Users/user/.barocss-ai/v3/private-458';
const endpoint = 'https://api.openai.com/v1/responses';
export function claimApprovedRun(outputDir, approvalHash, runId) {
  if (!/^[a-f0-9]{64}$/.test(approvalHash) || !/^[A-Za-z0-9-]{8,64}$/.test(runId) || path.basename(outputDir) !== `run-${runId}`) throw new Error('Approved run identity invalid');
  if (fs.existsSync(outputDir)) throw new Error('Approved output directory already exists');
  const claim = `${outputDir}.claim`;
  const fd = fs.openSync(claim, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify({ runId, approvalSha256: approvalHash, outputDir }) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  const parent = fs.openSync(path.dirname(claim), 'r');
  try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  return claim;
}
export function liveApiTransport({ approvalPath, outputDir, env = process.env }) {
  if (!approvalPath || !path.isAbsolute(approvalPath) || path.dirname(path.resolve(approvalPath)) !== privateRoot) throw new Error('Owner approval must be a private absolute file');
  if (!outputDir || !path.isAbsolute(outputDir) || path.dirname(path.resolve(outputDir)) !== privateRoot || fs.existsSync(outputDir)) throw new Error('Fresh private API output directory required');
  if (env.OPENAI_BASE_URL) throw new Error('Alternate API base URL forbidden');
  if (typeof env.OPENAI_API_KEY !== 'string' || !env.OPENAI_API_KEY.trim() ||
      typeof env.OPENAI_ORG_ID !== 'string' || !env.OPENAI_ORG_ID.trim() ||
      typeof env.OPENAI_PROJECT_ID !== 'string' || !env.OPENAI_PROJECT_ID.trim()) throw new Error('Explicit project-scoped API environment required');
  const approvalBytes = fs.readFileSync(approvalPath);
  const approval = JSON.parse(approvalBytes);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('Reviewed worktree must be clean');
  if (approval.issue !== 458 || approval.ownerDecision !== 'APPROVED_LIVE_API_458' ||
      approval.commit !== commit || approval.outputDir !== path.resolve(outputDir) ||
      approval.runId !== path.basename(outputDir).slice(4) || approval.apiPlanHash !== verifyApiFrozen() ||
      approval.capturePlanHash !== verifyFrozen() || approval.endpoint !== endpoint ||
      approval.model !== MODEL || approval.maxChargeMicroUsd !== API_CEILING_MICRO_USD ||
      approval.organizationId !== env.OPENAI_ORG_ID || approval.projectId !== env.OPENAI_PROJECT_ID ||
      approval.reviewDecision !== 'ACCEPT' || typeof approval.reviewUrl !== 'string' ||
      !approval.reviewUrl.startsWith('https://github.com/barocss/barocss/issues/458#issuecomment-')) {
    throw new Error('Owner approval does not bind exact reviewed API plan, project, and charge ceiling');
  }
  const approvalSha256 = createHash('sha256').update(approvalBytes).digest('hex');
  claimApprovedRun(outputDir, approvalSha256, approval.runId);
  return preparedApiTransport((request, _row, _dir, timeoutMs) => postDirect(request, timeoutMs, env), 'api-live',
    { approvalSha256, reviewedCommit: commit });
}
async function postDirect(request, timeoutMs, env) {
  const response = await fetch(endpoint, { method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'OpenAI-Organization': env.OPENAI_ORG_ID,
      'OpenAI-Project': env.OPENAI_PROJECT_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Oversized API response');
  if (!response.ok) throw new Error(`Responses API HTTP ${response.status}`);
  return JSON.parse(body);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  if (args.length !== 4 || !option('--approval') || !option('--output')) throw new Error('Use --approval PRIVATE_FILE --output FRESH_PRIVATE_DIRECTORY');
  const outputDir = path.resolve(option('--output'));
  const transport = liveApiTransport({ approvalPath: path.resolve(option('--approval')), outputDir });
  const rows = await capture({ outputDir, transport, planHash: verifyFrozen(), synthetic: false });
  const evidence = verifyApiCapture(outputDir);
  console.log(JSON.stringify({ apiEvidenceSha256: evidence.apiEvidenceSha256, heldMicroUsd: evidence.heldMicroUsd,
    scheduled: rows.length, locallyReservedSlots: rows.filter((r) => r.attempted).length,
    statuses: rows.reduce((o, r) => (o[r.status] = (o[r.status] ?? 0) + 1, o), {}) }, null, 2));
}
