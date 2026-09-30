import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildCliPrompt, PROMPT_CONTRACT_SHA256 } from '../barocss-render-loop/cli-profile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = path.join(here, 'frozen-plan.json');

export function verifyFrozenPlan({ protocolSchemaPath =
  '/Users/user/.barocss-ai/v3/private-461-app-server-schema-0156/codex_app_server_protocol.v2.schemas.json' } = {}) {
  const bytes = fs.readFileSync(planPath);
  const plan = JSON.parse(bytes.toString('utf8'));
  if (plan.kind !== 'barocss-progressive-live-plan-v1' || plan.issue !== 461
    || plan.phase !== 'preparation-only' || plan.maxNewTurns !== 4 || plan.maxSessions !== 2
    || plan.noAutomaticRetry !== true || plan.prior458AllowanceExhausted !== true
    || plan.scenarios.length !== 2 || plan.model !== 'gpt-6.1-sol'
    || plan.reasoningEffort !== 'high') throw new Error('Frozen live bounds changed');
  const sources = [
    [plan.protocolSchemaSha256, protocolSchemaPath, 'Installed app-server protocol schema'],
    [plan.outputSchemaSha256, path.join(root, 'scripts/barocss-render-loop/output.schema.json'), 'Output schema'],
    [plan.validationContractSha256, path.join(root, 'packages/barocss-render/src/contract.mjs'), 'Screen contract'],
  ];
  for (const [expected, file, label] of sources) {
    if (sha(fs.readFileSync(file)) !== expected) throw new Error(`${label} changed`);
  }
  if (plan.promptContractSha256 !== PROMPT_CONTRACT_SHA256) throw new Error('Prompt contract changed');
  for (const row of plan.scenarios) {
    if (sha(buildCliPrompt({ kind: 'initial', prompt: row.prompt })) !== row.initialPromptSha256
      || sha(buildCliPrompt({ kind: 'next', action: 'save', revision: 1,
        input: { name: row.name } })) !== row.nextPromptSha256) {
      throw new Error(`Prompt changed for row ${row.id}`);
    }
  }
  return { planSha256: sha(bytes), protocolSchemaSha256: plan.protocolSchemaSha256,
    turns: plan.maxNewTurns, scenarios: plan.scenarios.map((row) => row.id) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
    throw new Error('Use --verify');
  }
  console.log(JSON.stringify(verifyFrozenPlan()));
}
