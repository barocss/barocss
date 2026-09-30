// Reviewed live gate. No import or preflight invokes a model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
const AUTH_PATH = '/Users/user/.codex/auth.json';
const BUILTIN_SKILLS_SHA = '5ba0f9dbe3610088107ce8a891d894a2c90dab7730326e4e0c81ae693f0ac16f';
const sha = (value) => createHash('sha256').update(value).digest('hex');
export function checkCliLogin(env) {
  const result = spawnSync(CLI_PATH, ['login', 'status'], { encoding: 'utf8', env });
  if (result.status !== 0 || result.error || String(result.stdout ?? '').trim() !== '' ||
      String(result.stderr ?? '').trim() !== 'Logged in using ChatGPT') throw new Error('Codex ChatGPT login status drift');
}
function assertNoStartupSources(codexHome) {
  for (const name of ['AGENTS.md', 'AGENTS.override.md', 'config.toml', 'rules', 'plugins']) {
    if (fs.existsSync(path.join(codexHome, name))) throw new Error(`Isolated Codex home gained ${name}`);
  }
  const skills = path.join(codexHome, 'skills');
  if (fs.existsSync(skills) && fs.readdirSync(skills).some((name) => name !== '.system')) throw new Error('Isolated Codex home gained user skills');
}
export function inspectStartup(cwd, codexHome, env) {
  assertNoStartupSources(codexHome);
  const json = execFileSync(CLI_PATH, ['debug', 'prompt-input', '--enable', 'skip_host_skill_discovery',
    '--disable', 'skill_search', 'probe'], { cwd, env, encoding: 'utf8', maxBuffer: 2_000_000 });
  const messages = JSON.parse(json);
  if (!Array.isArray(messages)) throw new Error('Unexpected CLI startup diagnostic');
  const texts = messages.flatMap((message) => message.content ?? []).map((part) => part.text ?? '');
  const skillsText = texts.find((value) => value.includes('<skills_instructions>'));
  if (!skillsText || sha(skillsText.replaceAll(codexHome, '<CODEX_HOME>')) !== BUILTIN_SKILLS_SHA) throw new Error('Built-in skill inventory drift');
  if (texts.some((value) => /# AGENTS\.md instructions|AGENTS\.override\.md|\/wt\/issue-458\/|scripts\/json-render-458\//.test(value))) throw new Error('Unexpected project or global instruction source');
  assertNoStartupSources(codexHome);
  return BUILTIN_SKILLS_SHA;
}
function exactOutput(outputDir) {
  if (!fs.existsSync(privateRoot) || fs.realpathSync(privateRoot) !== privateRoot) throw new Error('Private evidence root missing or linked');
  if ((fs.statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Private evidence root must be mode 0700');
  if (!path.isAbsolute(outputDir) || path.dirname(outputDir) !== privateRoot || !/^cli-run-[a-z0-9-]+$/.test(path.basename(outputDir))) throw new Error('Live output must be one direct private run directory');
  if (fs.existsSync(outputDir)) throw new Error('Live output already exists; no restart');
}
function probeBoundary(cwd, schemaPath, codexHome, codexEnv) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-live-probe-'));
  const sibling = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'baro-458-live-sibling-'));
  const tempFile = path.join(temp, 'sentinel'), siblingFile = path.join(sibling, 'sentinel');
  const link = path.join(cwd, 'probe-link');
  try {
    fs.writeFileSync(tempFile, 'probe\n');
    fs.writeFileSync(siblingFile, 'probe\n');
    fs.symlinkSync(siblingFile, link);
    const probe = (file) => spawnSync(CLI_PATH, ['sandbox', '-P', PROFILE, '-c', PROFILE_RULES,
      '-c', `permissions.${PROFILE}.network.enabled=false`, '-C', cwd, '/bin/test', '-r', file],
    { encoding: 'utf8', env: codexEnv });
    if (probe(schemaPath).status !== 0) throw new Error('Scratch schema is not readable in effective profile');
    for (const file of [tempFile, siblingFile, link, path.join(here, 'plan.mjs'),
      privateRoot, path.join(codexHome, 'auth.json'), AUTH_PATH]) {
      const result = probe(file);
      if (result.status !== 1) throw new Error(`Agent read boundary failed: ${file} (${String(result.status)})`);
    }
  } finally {
    fs.rmSync(link, { force: true });
    fs.rmSync(temp, { recursive: true, force: true });
    fs.rmSync(sibling, { recursive: true, force: true });
  }
}
export function agentLiveTransport({ approvalPath, outputDir, agentPlanHash, runKind = 'full-pilot' }) {
  const maxCliInvocations = runKind === 'one-invocation-diagnostic' ? 1 : runKind === 'full-pilot' ? 24 : null;
  if (maxCliInvocations === null) throw new Error('Unknown CLI run kind');
  exactOutput(outputDir);
  if (!approvalPath || !path.isAbsolute(approvalPath) || path.dirname(approvalPath) !== privateRoot || !fs.existsSync(approvalPath)) throw new Error('Private pre-live Review ACCEPT file required');
  if (!/^[a-z0-9-]+\.json$/.test(path.basename(approvalPath)) || !fs.lstatSync(approvalPath).isFile() ||
      (fs.statSync(approvalPath).mode & 0o077) !== 0) throw new Error('Review file must be a private regular JSON file');
  const approvalBytes = fs.readFileSync(approvalPath);
  const approvalSha256 = sha(approvalBytes);
  const approval = JSON.parse(approvalBytes);
  if (approval.issue !== 458 || approval.decision !== 'ACCEPT' || approval.agentPlanSha256 !== agentPlanHash ||
      approval.runKind !== runKind || approval.maxCliInvocations !== maxCliInvocations ||
      typeof approval.ownerDecisionRef !== 'string' || approval.ownerDecisionRef.length < 12 ||
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
  if (!fs.existsSync(AUTH_PATH) || !fs.statSync(AUTH_PATH).isFile()) throw new Error('Existing ChatGPT auth file missing');
  const codexHome = path.join(privateRoot, `.codex-home-${path.basename(outputDir)}`);
  let cwd, home, schemaPath, claimPath, env;
  let createdCodexHome = false;
  try {
    fs.mkdirSync(codexHome, { mode: 0o700 });
    createdCodexHome = true;
    fs.symlinkSync(AUTH_PATH, path.join(codexHome, 'auth.json'));
    cwd = fs.mkdtempSync(path.join(SCRATCH_PARENT, 'agent-scratch-458-'));
    fs.chmodSync(cwd, 0o700);
    home = path.join(cwd, 'home'); fs.mkdirSync(home, { mode: 0o700 });
    schemaPath = path.join(cwd, 'schema.json');
    fs.copyFileSync(path.join(here, 'output.schema.json'), schemaPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(schemaPath, 0o400);
    env = agentEnv({ home, codexHome, nodeBin: NODE_BIN });
    const version = execFileSync(CLI_PATH, ['--version'], { encoding: 'utf8', env }).trim();
    if (version !== `codex-cli ${CLI_VERSION}`) throw new Error('Codex CLI version drift');
    checkCliLogin(env);
    if (!fs.lstatSync(path.join(codexHome, 'auth.json')).isSymbolicLink()) throw new Error('Isolated auth reference changed');
    if (fs.realpathSync(path.join(codexHome, 'auth.json')) !== AUTH_PATH ||
        fs.existsSync(path.join(codexHome, 'AGENTS.md'))) throw new Error('Isolated Codex home gained startup files');
    const startupSha256 = inspectStartup(cwd, codexHome, env);
    probeBoundary(cwd, schemaPath, codexHome, env);
    if (JSON.stringify(fs.readdirSync(cwd).sort()) !== JSON.stringify(['home', 'schema.json'])) throw new Error('Scratch changed during preflight');
    claimPath = path.join(privateRoot, `.claim-${path.basename(outputDir)}`);
    const claim = { kind: 'barocss-458-cli-agent-claim', issue: 458, agentPlanHash,
      basePlanHash: verifyFrozen(), outputDir, commit: current, reviewUrl: approval.reviewUrl,
      runKind, maxCliInvocations, ownerDecisionRef: approval.ownerDecisionRef,
      approvalFile: path.basename(approvalPath), approvalSha256,
      startupSha256 };
    const fd = fs.openSync(claimPath, 'wx', 0o600);
    try { fs.writeSync(fd, JSON.stringify(claim) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
  } catch (error) {
    if (createdCodexHome) fs.rmSync(codexHome, { recursive: true, force: true });
    if (cwd) fs.rmSync(cwd, { recursive: true, force: true });
    throw error;
  }
  const transport = async ({ prompt, attemptDir, timeoutMs }) => {
    if (path.dirname(attemptDir) !== outputDir || !/^attempt-\d{2}$/.test(path.basename(attemptDir))) throw new Error('CLI diagnostics must remain in the private run directory');
    if (sha(fs.readFileSync(approvalPath)) !== approvalSha256 ||
        sha(fs.readFileSync(claimPath)) !== transport.claim.sha256 ||
        verifyAgentFrozen() !== agentPlanHash ||
        execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim() !== current ||
        execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()) throw new Error('Reviewed agent launch changed during capture');
    if (inspectStartup(cwd, codexHome, env) !== BUILTIN_SKILLS_SHA) throw new Error('Agent startup inventory changed during capture');
    const result = await runAgentCodex({ cliPath: CLI_PATH, cwd, home, codexHome, nodeBin: NODE_BIN,
      schemaPath, attemptDir, prompt, timeoutMs });
    if (result.modelRequested !== MODEL || result.reasoningRequested !== REASONING) throw new Error('Requested model settings drift');
    return result;
  };
  transport.claim = { path: claimPath, sha256: sha(fs.readFileSync(claimPath)),
    approvalFile: path.basename(approvalPath), approvalSha256,
    reviewedCommit: current, reviewUrl: approval.reviewUrl,
    runKind, maxCliInvocations, ownerDecisionRef: approval.ownerDecisionRef };
  transport.cleanup = () => {
    fs.rmSync(codexHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  };
  return transport;
}
