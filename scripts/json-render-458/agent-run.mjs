// Explicit reviewed CLI-agent capture entry point; no API fallback.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from './capture.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyAgentFrozen } from './agent-freeze.mjs';
import { agentLiveTransport } from './agent-live.mjs';
import { verifyAgentCapture } from './agent-provenance.mjs';

export async function runReviewedAgentPilot({ outputDir, approvalPath }) {
  const agentPlanSha256 = verifyAgentFrozen();
  const basePlanSha256 = verifyFrozen();
  const transport = agentLiveTransport({ approvalPath, outputDir, agentPlanHash: agentPlanSha256 });
  try {
    const rows = await capture({ outputDir, transport, planHash: basePlanSha256, synthetic: false });
    const route = { kind: 'barocss-458-cli-agent-live', agentPlanSha256, basePlanSha256,
      scheduled: rows.length, attempted: rows.filter((row) => row.attempted).length,
      maxCliInvocations: transport.claim.maxCliInvocations,
      claimSha256: transport.claim.sha256, approvalFile: transport.claim.approvalFile,
      approvalSha256: transport.claim.approvalSha256,
      reviewedCommit: transport.claim.reviewedCommit, reviewUrl: transport.claim.reviewUrl };
    const fd = fs.openSync(path.join(outputDir, 'agent-route.json'), 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(route, null, 2) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    const evidence = verifyAgentCapture(outputDir);
    return { rows, agentEvidenceSha256: evidence.agentEvidenceSha256 };
  } finally { transport.cleanup(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--output' || args[2] !== '--approval') throw new Error('Use --output fresh-private-run --approval exact-review-file');
  const result = await runReviewedAgentPilot({ outputDir: path.resolve(args[1]), approvalPath: path.resolve(args[3]) });
  console.log(JSON.stringify({ scheduled: result.rows.length, attempted: result.rows.filter((row) => row.attempted).length,
    agentEvidenceSha256: result.agentEvidenceSha256, statuses: result.rows.reduce((out, row) => (out[row.status] = (out[row.status] ?? 0) + 1, out), {}) }, null, 2));
}
