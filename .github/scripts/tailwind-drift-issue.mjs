#!/usr/bin/env node
// #365: open/update ONE tracking Issue from the Tailwind drift report (report-only; never fails CI on drift).
// Usage: node tailwind-drift-issue.mjs <report.json> [--dry-run]
// Env: GH_REPO, RUN_URL (and GH_TOKEN for gh). Issue data flows through files/args, never through shell text.
// No drift: if the tracking Issue is open, comment "clean at X" and close it; otherwise do nothing (silent).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TITLE = 'Tailwind 4.x drift: parity corpora or preflight changed';
const CAP = 30;

export function buildBody(r, runUrl) {
  const lines = [
    `Scheduled report-only check (#365) found drift against **tailwindcss@${r.version}** (pinned: ${r.pinned}).`,
    '',
    `- Run: ${runUrl || '(local)'}`,
    `- Preflight output changed: ${r.preflightChanged ? 'yes' : 'no'}`,
  ];
  for (const [name, c] of Object.entries(r.corpora)) {
    lines.push('', `### ${name}`, '', `${c.coverage}`, '', `Classes at parity with ${r.pinned} but not with ${r.version}: ${c.regressions.length}`);
    for (const x of c.regressions.slice(0, CAP)) lines.push(`- \`${String(x.token).replace(/`/g, "'")}\` (${x.family}): ${x.diffs.join('; ').replace(/`/g, "'").slice(0, 200)}`);
    if (c.regressions.length > CAP) lines.push(`- … and ${c.regressions.length - CAP} more`);
  }
  lines.push('', 'Triage: the Planner decides whether to re-pin the parity reference (see docs/autonomy-v3.md).');
  return lines.join('\n');
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function main() {
  const [file, flag] = process.argv.slice(2);
  const dry = flag === '--dry-run';
  const runUrl = process.env.RUN_URL ?? '';
  const repo = process.env.GH_REPO;
  const r = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  const find = () => (dry ? '' : gh(['issue', 'list', '--repo', repo, '--state', 'open', '--search', `"${TITLE}" in:title`, '--json', 'number,title', '--jq', `map(select(.title == "${TITLE}"))[0].number // empty`]));
  if (!r) {
    // The check itself failed (e.g. compile() broke on a new Tailwind): report that on the same Issue.
    const body = `The scheduled Tailwind drift check (#365) failed to run, so no drift report was produced.\n\n- Run: ${runUrl || '(local)'}\n\nA new Tailwind release may have broken the comparator. Triage: the Planner (see docs/autonomy-v3.md).`;
    return upsert(body, 'Drift check failed to run');
  }
  if (!r.drift) {
    const n = find();
    if (dry) return console.log(`[dry-run] no drift: would comment "clean at ${r.version}" and close the tracking Issue if open`);
    if (n) {
      gh(['issue', 'comment', n, '--repo', repo, '--body', `clean at ${r.version} (${runUrl})`]);
      gh(['issue', 'close', n, '--repo', repo]);
    }
    return;
  }
  upsert(buildBody(r, runUrl), `Still drifting at ${r.version}`);

  function upsert(body, note) {
    if (dry) return console.log(`[dry-run] would open/update "${TITLE}":\n\n${body}`);
    const n = find();
    if (n) {
      gh(['issue', 'edit', n, '--repo', repo, '--body', body]);
      gh(['issue', 'comment', n, '--repo', repo, '--body', `${note} (${runUrl})`]);
    } else {
      gh(['issue', 'create', '--repo', repo, '--title', TITLE, '--body', body]);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
