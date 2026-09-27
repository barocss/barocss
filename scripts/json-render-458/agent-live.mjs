// Reviewed live gate. No import or preflight invokes a model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROFILE, PROFILE_RULES, SCRATCH_PARENT } from './agent-profile.mjs';
import { agentEnv, runAgentCodex } from './agent-transport.mjs';
import { verifyAgentFrozen } from './agent-freeze.mjs';
import { verifyFrozen } from './freeze.mjs';
import { CLI_VERSION, MODEL, REASONING } from './plan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const privateRoot = '/Users/user/.barocss-ai/v3/private-458';
const CLI_PATH = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const NODE_BIN = '/Users/user/Library/pnpm/nodejs/22.19.0/bin';
function exactOutput(outputDir) {
  if (!fs.existsSync(privateRoot) || fs.realpathSync(privateRoot) !== privateRoot) throw new Error('Private evidence root missing or linked');
  if ((fs.statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Private evidence root must be mode 0700');
  if (!path.isAbsolute(outputDir) || path.dirname(outputDir) !== privateRoot || !/^cli-run-[a-z0-9-]+$/.test(path.basename(outputDir))) throw new Error('Live output must be one direct private run directory');
  if (fs.existsSync(outputDir)) throw new Error('Live output already exists; no restart');
}
function probeBoundary(cwd, schemaPath, codexEnv) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-live-probe-'));
  const sibling = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'baro-458-live-sibling-'));
  const tempFile = path.join(temp, 'sentinel'), siblingFile = path.join(sibling, 'sentinel');
  try {
    fs.writeFileSync(tempFile, 'probe\n');
    fs.writeFileSync(siblingFile, 'probe\n');
    const link = path.join(cwd, 'probe-link');
    fs.symlinkSync(siblingFile, link);
    const probe = (file) => spawnSync(CLI_PATH, ['sandbox', '-P', PROFILE, '-c', PROFILE_RULES,
      '-c', `permissions.${PROFILE}.network.enabled=false`, '-C', cwd, '/bin/test', '-r', file],
    { encoding: 'utf8', env: codexEnv });
    if (probe(schemaPath).status !== 0) throw new Error('Scratch schema is not readable in effective profile');
    for (const file of [tempFile, siblingFile, link, path.join(here, 'plan.mjs'), privateRoot]) {
      const result = probe(file);
      if (result.status !== 1) throw new Error(`Agent read boundary failed: ${file} (${String(result.status)})`);
    }
    fs.unlinkSync(link);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); fs.rmSync(sibling, { recursive: true, force: true }); }
}
export function agentLiveTransport({ approvalPath, outputDir, agentPlanHash }) {
  exactOutput(outputDir);
  if (!approvalPath || !path.isAbsolute(approvalPath) || path.dirname(approvalPath) !== privateRoot || !fs.existsSync(approvalPath)) throw new Error('Private pre-live Review ACCEPT file required');
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  if (approval.issue !== 458 || approval.decision !== 'ACCEPT' || approval.agentPlanSha256 !== agentPlanHash ||
      approval.outputDir !== outputDir || typeof approval.reviewUrl !== 'string' ||
      !approval.reviewUrl.startsWith('https://github.com/barocss/barocss/issues/458#issuecomment-')) throw new Error('Approval must bind Review, agent plan and one output directory');
  const current = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(current) || approval.commit !== current) throw new Error('Pre-live Review commit mismatch');
  if (execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()) throw new Error('Worktree changed after pre-live Review');
  if (verifyAgentFrozen() !== agentPlanHash || !verifyFrozen()) throw new Error('Agent or base plan drift');
  for (const ancestor of [SCRATCH_PARENT, path.dirname(SCRATCH_PARENT), os.homedir()]) {
    if (fs.existsSync(path.join(ancestor, 'AGENTS.md'))) throw new Error('Scratch ancestor instructions present');
  }
  for (const ancestor of [SCRATCH_PARENT, path.dirname(SCRATCH_PARENT)]) {
    if (fs.existsSync(path.join(ancestor, '.codex/config.toml'))) throw new Error('Scratch ancestor project config present');
  }
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const cwd = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
  fs.chmodSync(cwd, 0o700);
  const home = path.join(cwd, 'home'); fs.mkdirSync(home, { mode: 0o700 });
  const schemaPath = path.join(cwd, 'schema.json');
  fs.copyFileSync(path.join(here, 'output.schema.json'), schemaPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(schemaPath, 0o400);
  const env = agentEnv({ home, codexHome, nodeBin: NODE_BIN });
  const version = execFileSync(CLI_PATH, ['--version'], { encoding: 'utf8', env }).trim();
  const login = execFileSync(CLI_PATH, ['login', 'status'], { encoding: 'utf8', env }).trim();
  if (version !== `codex-cli ${CLI_VERSION}` || login !== 'Logged in using ChatGPT') throw new Error('Codex version or ChatGPT login drift');
  probeBoundary(cwd, schemaPath, env);
  if (JSON.stringify(fs.readdirSync(cwd).sort()) !== JSON.stringify(['home', 'schema.json'])) throw new Error('Scratch changed during preflight');
  const claimPath = path.join(privateRoot, `.claim-${path.basename(outputDir)}`);
  const fd = fs.openSync(claimPath, 'wx', 0o600);
  try { fs.writeSync(fd, JSON.stringify({ issue: 458, agentPlanHash, outputDir, commit: current }) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  return async ({ prompt, attemptDir, timeoutMs }) => {
    const result = await runAgentCodex({ cliPath: CLI_PATH, cwd, home, codexHome, nodeBin: NODE_BIN,
      schemaPath, attemptDir, prompt, timeoutMs });
    if (result.modelRequested !== MODEL || result.reasoningRequested !== REASONING) throw new Error('Requested model settings drift');
    return result;
  };
}
