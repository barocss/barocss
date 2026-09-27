// Route-specific saved evidence checks for the supported CLI agent workflow.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyCapture } from './provenance.mjs';
import { verifyAgentFrozen } from './agent-freeze.mjs';
import { verifyFrozen } from './freeze.mjs';
import { buildAgentArgv } from './agent-profile.mjs';
import { verifyAgentDiagnostics } from './agent-diagnostics.mjs';
import { CLI_VERSION, MODEL, REASONING, MAX_ATTEMPTS } from './plan.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const environmentKeys = ['CODEX_HOME', 'HOME', 'LANG', 'NO_COLOR', 'PATH', 'TERM'];
const privateRoot = '/Users/user/.barocss-ai/v3/private-458';
const builtInSkillsSha = '5ba0f9dbe3610088107ce8a891d894a2c90dab7730326e4e0c81ae693f0ac16f';
function option(args, key) { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : null; }
function verifyLiveClaim(captureDir, route, inventory) {
  if (path.dirname(captureDir) !== privateRoot || !/^cli-run-[a-z0-9-]+$/.test(path.basename(captureDir))) throw new Error('Live CLI route outside private root');
  if (!/^[a-f0-9]{40}$/.test(route.reviewedCommit) ||
      !String(route.reviewUrl).startsWith('https://github.com/barocss/barocss/issues/458#issuecomment-') ||
      !/^[a-z0-9.-]+\.json$/.test(route.approvalFile) || route.approvalFile.startsWith('.')) throw new Error('Live Review identity missing');
  const claimPath = path.join(privateRoot, `.claim-${path.basename(captureDir)}`);
  const approvalPath = path.join(privateRoot, route.approvalFile);
  if (fs.realpathSync(privateRoot) !== privateRoot || (fs.statSync(privateRoot).mode & 0o077) !== 0 ||
      !fs.lstatSync(claimPath).isFile() || !fs.lstatSync(approvalPath).isFile() ||
      (fs.statSync(claimPath).mode & 0o077) !== 0 || (fs.statSync(approvalPath).mode & 0o077) !== 0) throw new Error('Live private evidence path or mode drift');
  const claimBytes = fs.readFileSync(claimPath), approvalBytes = fs.readFileSync(approvalPath);
  const claim = JSON.parse(claimBytes), approval = JSON.parse(approvalBytes);
  if (sha(claimBytes) !== route.claimSha256 || sha(approvalBytes) !== route.approvalSha256 ||
      claim.kind !== 'barocss-458-cli-agent-claim' || claim.issue !== 458 ||
      claim.agentPlanHash !== route.agentPlanSha256 || claim.basePlanHash !== route.basePlanSha256 ||
      claim.outputDir !== captureDir || claim.commit !== route.reviewedCommit ||
      claim.reviewUrl !== route.reviewUrl || claim.approvalFile !== route.approvalFile ||
      claim.approvalSha256 !== route.approvalSha256 || claim.startupSha256 !== builtInSkillsSha ||
      claim.runKind !== approval.runKind || claim.maxCliInvocations !== approval.maxCliInvocations ||
      claim.ownerDecisionRef !== approval.ownerDecisionRef ||
      route.maxCliInvocations !== claim.maxCliInvocations ||
      claim.runKind !== (route.kind === 'barocss-458-cli-agent-diagnostic-live' ? 'one-invocation-diagnostic' : 'full-pilot') ||
      approval.issue !== 458 || approval.decision !== 'ACCEPT' ||
      approval.agentPlanSha256 !== route.agentPlanSha256 || approval.commit !== route.reviewedCommit ||
      approval.outputDir !== captureDir || approval.reviewUrl !== route.reviewUrl) throw new Error('Live CLI claim or Review binding drift');
  inventory[path.basename(claimPath)] = sha(claimBytes);
  inventory[route.approvalFile] = sha(approvalBytes);
}
export function verifyAgentCapture(captureDir) {
  const base = verifyCapture(captureDir);
  const routePath = path.join(captureDir, 'agent-route.json');
  const routeBytes = fs.readFileSync(routePath);
  const route = JSON.parse(routeBytes);
  const attempted = base.rows.filter((row) => row.attempted);
  if (!((base.manifest.synthetic === false && ['barocss-458-cli-agent-live', 'barocss-458-cli-agent-diagnostic-live'].includes(route.kind)) ||
        (base.manifest.synthetic === true && ['barocss-458-cli-agent-synthetic', 'barocss-458-cli-agent-diagnostic-synthetic'].includes(route.kind))) ||
      route.agentPlanSha256 !== verifyAgentFrozen() || route.basePlanSha256 !== verifyFrozen() ||
      route.scheduled !== MAX_ATTEMPTS || route.attempted !== attempted.length) throw new Error('CLI agent route binding drift');
  if (route.kind.includes('-diagnostic-') && (route.maxCliInvocations !== 1 || attempted.length !== 1 ||
      attempted[0].ordinal !== 0 || base.rows.slice(1).some((row) => row.attempted ||
        row.status !== 'skipped-global' || row.reason !== 'one-invocation-diagnostic-limit'))) throw new Error('CLI diagnostic invocation limit drift');
  if (route.kind === 'barocss-458-cli-agent-live' && route.maxCliInvocations !== 24) throw new Error('CLI full pilot invocation limit drift');
  const inventory = { ...base.inventory, 'agent-route.json': sha(routeBytes) };
  if (base.manifest.synthetic === false) verifyLiveClaim(captureDir, route, inventory);
  else if (Object.keys(route).some((key) => ['claimSha256', 'approvalFile', 'approvalSha256', 'reviewedCommit', 'reviewUrl'].includes(key))) throw new Error('Synthetic route must not carry live Review identity');
  let scratchCwd = null;
  const toolUse = {};
  for (const row of attempted) {
    const name = `attempt-${String(row.ordinal).padStart(2, '0')}`;
    const dir = path.join(captureDir, name);
    const transport = JSON.parse(fs.readFileSync(path.join(dir, 'transport.json')));
    const present = fs.readdirSync(dir).sort();
    const diagnosticNames = ['diagnostics.json', 'stderr.txt', 'error-item.jsonl'].filter((file) => fs.existsSync(path.join(dir, file)));
    const allowed = ['events.jsonl', 'request.json', 'reservation.json', 'transport.json',
      ...(fs.existsSync(path.join(dir, 'raw-final.txt')) ? ['raw-final.txt'] : []), ...diagnosticNames].sort();
    if (!same(present, allowed)) throw new Error(`CLI agent unexpected attempt artifacts: ${name}`);
    if (base.manifest.synthetic === false && transport.argv !== null && !diagnosticNames.includes('diagnostics.json')) throw new Error(`Private CLI diagnostics missing: ${name}`);
    const diagnostics = diagnosticNames.length ? verifyAgentDiagnostics(dir) : null;
    if (diagnostics) for (const [file, hash] of Object.entries(diagnostics.files)) inventory[`${name}/${file}`] = hash;
    if (transport.argv === null) {
      if (!String(transport.stopReason).startsWith('transport-exception:')) throw new Error(`Missing agent argv: ${name}`);
      toolUse[row.id] = 0;
      continue;
    }
    const args = transport.argv;
    const cwd = option(args, '--cd'), schemaPath = option(args, '--output-schema'), finalPath = option(args, '--output-last-message');
    if (!cwd || !schemaPath || !finalPath || finalPath !== path.join(dir, 'raw-final.txt') ||
        !same(args, buildAgentArgv({ cwd, schemaPath, finalPath })) ||
        transport.cliVersion !== CLI_VERSION || transport.modelRequested !== MODEL ||
        transport.reasoningRequested !== REASONING || !same(transport.environmentKeys, environmentKeys)) throw new Error(`CLI agent launch drift: ${name}`);
    if (scratchCwd === null) scratchCwd = cwd;
    else if (scratchCwd !== cwd) throw new Error('CLI agent workspace changed during run');
    const lines = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean);
    if (transport.eventCount !== lines.length) throw new Error(`CLI agent event count mismatch: ${name}`);
    let completed = false, usage = null, finalHash = null, commands = 0;
    for (const line of lines) {
      const event = JSON.parse(line);
      if (!['thread.started', 'turn.started', 'turn.completed', 'turn.failed', 'item.started', 'item.updated', 'item.completed', 'error'].includes(event.type)) throw new Error(`Unknown agent event: ${name}`);
      if (event.itemType && !['agent_message', 'reasoning', 'command_execution', 'error'].includes(event.itemType)) throw new Error(`Unknown agent item: ${name}`);
      if (event.itemType === 'error' && (!diagnostics?.summary.errorItemBytes ||
          diagnostics.summary.errorItemClass !== event.errorClass)) throw new Error(`CLI error item lost private diagnostics: ${name}`);
      if (event.itemType === 'reasoning' && Object.keys(event).some((key) => key !== 'type' && key !== 'itemType' && key !== 'itemId')) throw new Error(`Reasoning payload retained: ${name}`);
      if (event.itemType === 'command_execution' && event.type === 'item.completed') {
        if (typeof event.command !== 'string') throw new Error(`Command evidence missing: ${name}`);
        commands++;
      }
      if (event.itemType === 'agent_message' && event.type === 'item.completed') finalHash = event.textSha256 ?? null;
      if (event.type === 'turn.completed') { completed = true; usage = event.usage ?? null; }
    }
    if (transport.exitCode === 0 && !transport.stopReason && (!completed || !same(usage, transport.usage) || finalHash !== transport.rawFinalSha256)) throw new Error(`CLI agent completion evidence mismatch: ${name}`);
    toolUse[row.id] = commands;
  }
  return { ...base, route, scratchCwd, toolUse, agentEvidenceSha256: sha(JSON.stringify(inventory)), inventory };
}
