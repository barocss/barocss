// Separate immutable identity for the Codex CLI agent route; legacy freezes stay intact.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyFrozen } from './freeze.mjs';
import { MAX_ATTEMPTS, MODEL, REASONING, CLI_VERSION } from './plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const AGENT_FILES = Object.freeze([
  'agent-profile.mjs', 'agent-diagnostics.mjs', 'agent-transport.mjs', 'agent-live.mjs', 'agent-run.mjs', 'agent-diagnostic.mjs',
  'agent-provenance.mjs', 'agent-consumers.mjs', 'agent-freeze.mjs',
  'AGENT-CLI-BOUNDARY.md', 'AGENT-CLI-RUN-PACKET.md',
]);
export function currentAgentPlan() {
  return { issue: 458, route: 'codex-cli-agent', basePlanSha256: verifyFrozen(),
    model: MODEL, reasoning: REASONING, cliVersion: CLI_VERSION, maxAttempts: MAX_ATTEMPTS,
    startupContext: { isolatedCodexHome: true, existingChatGptAuthSymlink: true,
      globalAgentsAbsent: true, userRulesAbsent: true, userSkillsAbsent: true,
      userConfigIgnored: true, hostSkillDiscoverySkipped: true,
      normalizedBuiltInSkillInventorySha256: '5ba0f9dbe3610088107ce8a891d894a2c90dab7730326e4e0c81ae693f0ac16f' },
    files: Object.fromEntries(AGENT_FILES.map((name) => [name, sha(fs.readFileSync(path.join(here, name)))])) };
}
export function verifyAgentFrozen() {
  const bytes = fs.readFileSync(path.join(here, 'agent-frozen.json'));
  if (JSON.stringify(JSON.parse(bytes)) !== JSON.stringify(currentAgentPlan())) throw new Error('Agent plan/source freeze drift');
  return sha(bytes);
}
