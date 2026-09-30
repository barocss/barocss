// Explicitly approved live transport. This module alone may launch Codex CLI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanEnv, runCodex } from './cli.mjs';
import { CLI_VERSION, MODEL, REASONING } from './plan.mjs';
import { verifyFrozen } from './freeze.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const privateRoot = '/Users/user/.barocss-ai/v3/private-458';
const CLI_PATH = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const NODE_BIN = '/Users/user/Library/pnpm/nodejs/22.19.0/bin';
export function liveTransport({ approvalPath, outputDir, planHash }) {
  throw new Error('Live pilot blocked: no verified pre-dispatch tool isolation for this Codex CLI');
  if (!approvalPath || !path.isAbsolute(approvalPath) || !fs.existsSync(approvalPath)) throw new Error('Pre-live Review ACCEPT file required');
  if (!path.resolve(outputDir).startsWith(`${privateRoot}/`)) throw new Error('Live evidence must use the private #458 directory');
  if (fs.existsSync(outputDir)) throw new Error('Live output already exists; no restart');
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  if (approval.issue !== 458 || approval.decision !== 'ACCEPT' || approval.planSha256 !== planHash ||
      typeof approval.reviewUrl !== 'string' || !approval.reviewUrl.startsWith('https://github.com/barocss/barocss/issues/458#issuecomment-')) {
    throw new Error('Approval must bind Issue, Review comment and exact frozen plan');
  }
  const current = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (approval.commit !== current || !/^[a-f0-9]{40}$/.test(current)) throw new Error('Pre-live Review commit mismatch');
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Worktree changed after pre-live Review');
  verifyFrozen();
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-cwd-'));
  for (const ancestor of [cwd, path.dirname(cwd), '/private/tmp', '/tmp']) {
    if (fs.existsSync(path.join(ancestor, 'AGENTS.md')) || fs.existsSync(path.join(ancestor, '.codex/config.toml'))) throw new Error('Isolation directory has inherited instruction/config file');
  }
  const env = cleanEnv({ home, codexHome, nodeBin: NODE_BIN });
  const version = execFileSync(CLI_PATH, ['--version'], { encoding: 'utf8', env }).trim();
  const login = execFileSync(CLI_PATH, ['login', 'status'], { encoding: 'utf8', env }).trim();
  if (version !== `codex-cli ${CLI_VERSION}` || login !== 'Logged in using ChatGPT') throw new Error('Codex version or ChatGPT auth route drift');
  return async ({ prompt, attemptDir, timeoutMs }) => {
    const result = await runCodex({ cliPath: CLI_PATH, cwd, home, codexHome, nodeBin: NODE_BIN,
      schemaPath: path.join(here, 'output.schema.json'), attemptDir, prompt, timeoutMs });
    if (result.modelRequested !== MODEL || result.reasoningRequested !== REASONING) throw new Error('Effective requested model settings drift');
    return result;
  };
}
