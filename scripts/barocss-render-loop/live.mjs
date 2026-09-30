// Live entry point. Do not run without an owner decision and pre-live Review ACCEPT.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCliGenerator } from './cli-transport.mjs';
import { CLI_VERSION, MAX_DISPATCHES, PER_CALL_TIMEOUT_MS, TOTAL_TIMEOUT_MS,
  PRIVATE_ROOT, PROMPT_VERSION, PROMPT_CONTRACT_SHA256 } from './cli-profile.mjs';
import { createLoopServer } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const CLI_PATH = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const NODE_BIN = '/Users/user/Library/pnpm/nodejs/22.19.0/bin';
const AUTH_PATH = '/Users/user/.codex/auth.json';
const PRIOR_ATTEMPTS = Object.freeze([
  { claim: path.join(PRIVATE_ROOT, 'private-460-live-claim.json'),
    evidence: path.join(PRIVATE_ROOT, 'private-460-run-Y9ch1k'),
    taskCommit: '957e1564e2e6011eb77edf831478c14742668814', stopReason: 'unexpected-cli-tool' },
  { claim: path.join(PRIVATE_ROOT, 'private-460-live-claim-continuation-1.json'),
    evidence: path.join(PRIVATE_ROOT, 'private-460-run-eS95yj'),
    taskCommit: 'bddce535eb7ee205ab4fd5ad460b22941852d93c', stopReason: null },
]);
const LIVE_CLAIM = path.join(PRIVATE_ROOT, 'private-460-live-claim-continuation-2.json');
const PRIOR_DISPATCHES = 2;
const AGGREGATE_CEILING = 20;
const ASSET_ROOTS = Object.freeze({
  JR_ROOT: '/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr',
  PW_DIR: '/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core',
  REPO_DEPS_ROOT: '/Users/user/.barocss-ai/v3/integration',
});
export const LIVE_PROMPT = 'Create a profile form';
export const LIVE_NAME = 'Bea';
const issueComment = /^https:\/\/github\.com\/barocss\/barocss\/issues\/460#issuecomment-[0-9]+$/;

export function readLaunchApproval(file, taskCommit) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.dirname(file) !== PRIVATE_ROOT
    || !/^private-460-approval-[a-z0-9-]+\.json$/.test(path.basename(file))) {
    throw new Error('Use one private #460 approval file');
  }
  if (!fs.lstatSync(file).isFile()) throw new Error('Approval file must be a regular file');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  const keys = ['kind', 'issue', 'taskCommit', 'ownerDecisionRef', 'continuationRef', 'reviewUrl',
    'prompt', 'name', 'promptVersion', 'promptContractSha256',
    'priorDispatches', 'aggregateCeiling', 'maxDispatches',
    'perCallTimeoutMs', 'totalTimeoutMs'];
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== keys.sort().join(',')
    || value.kind !== 'barocss-460-prompt-v2-continuation' || value.issue !== 460
    || value.taskCommit !== taskCommit || !issueComment.test(value.ownerDecisionRef)
    || !issueComment.test(value.continuationRef) || !issueComment.test(value.reviewUrl)
    || value.priorDispatches !== PRIOR_DISPATCHES || value.aggregateCeiling !== AGGREGATE_CEILING
    || value.priorDispatches + value.maxDispatches > value.aggregateCeiling
    || value.promptVersion !== PROMPT_VERSION || value.promptContractSha256 !== PROMPT_CONTRACT_SHA256
    || typeof value.prompt !== 'string'
    || value.prompt !== LIVE_PROMPT || value.name !== LIVE_NAME
    || value.maxDispatches !== MAX_DISPATCHES || value.perCallTimeoutMs !== PER_CALL_TIMEOUT_MS
    || value.totalTimeoutMs !== TOTAL_TIMEOUT_MS) {
    throw new Error('Approval does not match the exact reviewed two-turn run');
  }
  return value;
}

export function verifyPriorAttempts(attempts = PRIOR_ATTEMPTS) {
  if (attempts.length !== PRIOR_DISPATCHES) throw new Error('Previous #460 dispatch count changed');
  for (const attempt of attempts) {
    if (!fs.existsSync(attempt.claim) || !fs.statSync(attempt.claim).isFile()
      || !fs.existsSync(attempt.evidence) || !fs.statSync(attempt.evidence).isDirectory()) {
      throw new Error('Previous #460 claim and evidence are required');
    }
    const claim = JSON.parse(fs.readFileSync(attempt.claim, 'utf8'));
    const dispatch = JSON.parse(fs.readFileSync(path.join(attempt.evidence, 'initial-dispatch.json'), 'utf8'));
    const result = JSON.parse(fs.readFileSync(path.join(attempt.evidence, 'initial-result.json'), 'utf8'));
    const live = JSON.parse(fs.readFileSync(path.join(attempt.evidence, 'live-result.json'), 'utf8'));
    if (claim.taskCommit !== attempt.taskCommit || live.taskCommit !== attempt.taskCommit
      || dispatch.kind !== 'initial' || dispatch.dispatchNumber !== 1
      || result.stopReason !== attempt.stopReason
      || fs.existsSync(path.join(attempt.evidence, 'next-dispatch.json'))) {
      throw new Error('Previous #460 dispatch accounting changed');
    }
  }
}

export function claimLiveRun(approval, file = LIVE_CLAIM) {
  if (path.dirname(file) !== PRIVATE_ROOT || !path.basename(file).startsWith('private-460-live-claim')) {
    throw new Error('Invalid private live claim path');
  }
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error?.code === 'EEXIST') throw new Error('The #460 live allowance is already claimed');
    throw error;
  }
  try {
    fs.writeSync(fd, JSON.stringify({ issue: 460, taskCommit: approval.taskCommit,
      ownerDecisionRef: approval.ownerDecisionRef, continuationRef: approval.continuationRef,
      reviewUrl: approval.reviewUrl, priorDispatches: PRIOR_DISPATCHES,
      promptVersion: PROMPT_VERSION, promptContractSha256: PROMPT_CONTRACT_SHA256,
      reservedDispatches: MAX_DISPATCHES, aggregateCeiling: AGGREGATE_CEILING,
      claimedAt: new Date().toISOString() }) + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

async function run() {
  if (process.argv.length !== 4 || process.argv[2] !== '--approval') {
    throw new Error('Usage: node live.mjs --approval /Users/user/.barocss-ai/v3/private-460-approval-ID.json');
  }
  const taskCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Exact reviewed task commit must be clean before live dispatch');
  const approval = readLaunchApproval(process.argv[3], taskCommit);
  verifyPriorAttempts();
  if (!fs.existsSync(AUTH_PATH)) throw new Error('Existing Codex CLI login is unavailable');
  if (Object.entries(ASSET_ROOTS).some(([key, value]) => process.env[key] !== value)) {
    throw new Error('Use the approved local JR_ROOT, PW_DIR and REPO_DEPS_ROOT');
  }
  const pwDir = ASSET_ROOTS.PW_DIR;
  claimLiveRun(approval);
  const outputDir = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'private-460-run-'));
  const cwd = fs.mkdtempSync(path.join(PRIVATE_ROOT, 'agent-scratch-460-'));
  const codexHome = fs.mkdtempSync(path.join(PRIVATE_ROOT, '.codex-home-460-'));
  const home = path.join(cwd, 'home');
  const schemaPath = path.join(cwd, 'schema.json');
  let browser, server, controller;
  const report = { kind: 'barocss-460-live-attempt', source: 'real-codex-cli', taskCommit,
    ownerDecisionRef: approval.ownerDecisionRef, continuationRef: approval.continuationRef,
    reviewUrl: approval.reviewUrl, promptVersion: PROMPT_VERSION,
    promptContractSha256: PROMPT_CONTRACT_SHA256, priorDispatches: PRIOR_DISPATCHES,
    limits: { maxDispatches: MAX_DISPATCHES, perCallTimeoutMs: PER_CALL_TIMEOUT_MS,
      totalTimeoutMs: TOTAL_TIMEOUT_MS }, prompt: approval.prompt, name: approval.name,
    granularity: 'complete-response', first: null, next: null, pageErrors: [], externalRequests: [],
    failure: null };
  try {
    fs.mkdirSync(home, { mode: 0o700 });
    fs.copyFileSync(path.join(here, 'output.schema.json'), schemaPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(schemaPath, 0o400);
    fs.symlinkSync(AUTH_PATH, path.join(codexHome, 'auth.json'));
    const isolatedEnv = { HOME: home, CODEX_HOME: codexHome, PATH: `${NODE_BIN}:/usr/bin:/bin`,
      TERM: 'dumb', NO_COLOR: '1', LANG: 'en_US.UTF-8' };
    const version = execFileSync(CLI_PATH, ['--version'], { encoding: 'utf8', env: isolatedEnv }).trim();
    if (version !== `codex-cli ${CLI_VERSION}`) throw new Error('Installed CLI version changed');
    const generate = createCliGenerator({ cliPath: CLI_PATH, cwd, home, codexHome,
      nodeBin: NODE_BIN, schemaPath, outputDir });
    const opened = await createLoopServer({ generate, mode: 'local-cli',
      liveInputs: { prompt: approval.prompt, name: approval.name } });
    server = opened.server; controller = opened.controller;
    const { chromium } = createRequire(path.join(pwDir, 'package.json'))('playwright-core');
    browser = await chromium.launch({ executablePath: chromium.executablePath(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    page.on('request', (request) => {
      if (!request.url().startsWith(opened.url)) report.externalRequests.push(request.url());
    });
    await page.goto(opened.url, { waitUntil: 'load' });
    await page.getByText('Local CLI transport').waitFor();
    await page.getByRole('textbox', { name: 'Request' }).fill(approval.prompt);
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.waitForFunction(() => ['ready', 'failed', 'cancelled'].includes(
      document.querySelector('#status')?.dataset.phase), null, { timeout: PER_CALL_TIMEOUT_MS + 10_000 });
    report.first = controller.snapshot();
    await page.screenshot({ path: path.join(outputDir, 'first-screen.png') });
    if (report.first.phase !== 'ready') throw new Error(`Initial generation ${report.first.phase}`);
    await page.locator('[data-node-id="name"] input').fill(approval.name);
    await page.locator('[data-node-id="save"]').click();
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status?.dataset.phase === 'failed' || status?.dataset.phase === 'cancelled'
        || (status?.dataset.phase === 'ready' && !document.querySelector('[data-node-id="name"] input'));
    }, null, { timeout: PER_CALL_TIMEOUT_MS + 10_000 });
    report.next = controller.snapshot();
    await page.screenshot({ path: path.join(outputDir, 'next-screen.png') });
    if (report.next.phase !== 'ready' || report.next.turn !== 2) {
      throw new Error(`Action generation ${report.next.phase}`);
    }
    const exactName = report.next.spec.elements && Object.values(report.next.spec.elements).find((node) =>
      node.type === 'Text' && [approval.name, `Name: ${approval.name}`].includes(node.props.text));
    if (!exactName || await page.locator(`[data-node-id="${exactName.props.id}"]`).textContent()
      !== exactName.props.text) throw new Error('Next screen omitted the exact entered name');
    await page.waitForFunction(() => window.LOOP_METRICS.sampleCount === 2);
    report.browserMetrics = await page.evaluate(() => window.LOOP_METRICS);
    if (report.pageErrors.length || report.externalRequests.length) throw new Error('Browser error or external request');
  } catch (error) {
    report.failure = String(error instanceof Error ? error.message : error).slice(0, 500);
    throw error;
  } finally {
    if (controller && ['generating', 'action-pending'].includes(controller.snapshot().phase)) controller.cancel();
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(path.join(outputDir, 'live-result.json'), JSON.stringify(report, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    fs.rmSync(codexHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
    console.log(`Private live evidence: ${outputDir}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
