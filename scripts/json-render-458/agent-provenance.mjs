// Route-specific saved evidence checks for the supported CLI agent workflow.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyCapture } from './provenance.mjs';
import { verifyAgentFrozen } from './agent-freeze.mjs';
import { verifyFrozen } from './freeze.mjs';
import { buildAgentArgv } from './agent-profile.mjs';
import { CLI_VERSION, MODEL, REASONING, MAX_ATTEMPTS } from './plan.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const environmentKeys = ['CODEX_HOME', 'HOME', 'LANG', 'NO_COLOR', 'PATH', 'TERM'];
function option(args, key) { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : null; }
export function verifyAgentCapture(captureDir) {
  const base = verifyCapture(captureDir);
  const routePath = path.join(captureDir, 'agent-route.json');
  const routeBytes = fs.readFileSync(routePath);
  const route = JSON.parse(routeBytes);
  const attempted = base.rows.filter((row) => row.attempted);
  if (base.manifest.synthetic !== false || route.kind !== 'barocss-458-cli-agent' ||
      route.agentPlanSha256 !== verifyAgentFrozen() || route.basePlanSha256 !== verifyFrozen() ||
      route.scheduled !== MAX_ATTEMPTS || route.attempted !== attempted.length) throw new Error('CLI agent route binding drift');
  const inventory = { ...base.inventory, 'agent-route.json': sha(routeBytes) };
  let scratchCwd = null;
  const toolUse = {};
  for (const row of attempted) {
    const name = `attempt-${String(row.ordinal).padStart(2, '0')}`;
    const dir = path.join(captureDir, name);
    const transport = JSON.parse(fs.readFileSync(path.join(dir, 'transport.json')));
    const present = fs.readdirSync(dir).sort();
    const allowed = ['events.jsonl', 'request.json', 'reservation.json', 'transport.json',
      ...(fs.existsSync(path.join(dir, 'raw-final.txt')) ? ['raw-final.txt'] : [])].sort();
    if (!same(present, allowed)) throw new Error(`CLI agent unexpected attempt artifacts: ${name}`);
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
      if (event.itemType && !['agent_message', 'reasoning', 'command_execution'].includes(event.itemType)) throw new Error(`Unknown agent item: ${name}`);
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
