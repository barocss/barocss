#!/usr/bin/env node
// #365: open/update ONE tracking Issue from the Tailwind drift report (report-only; never fails CI on drift).
// Usage: node tailwind-drift-issue.mjs <report.json> [--dry-run]
// Env: GH_REPO, RUN_URL (and GH_TOKEN for gh). Issue data flows through files/args, never through shell text.
// No drift: if the tracking Issue is open, comment "clean at X" and close it; otherwise do nothing (silent).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const runUrl = process.env.RUN_URL ?? '';
  const repo = process.env.GH_REPO;
  const find = () => (dry ? '' : gh(['issue', 'list', '--repo', repo, '--state', 'open', '--search', `"${TITLE}" in:title`, '--json', 'number,title', '--jq', `map(select(.title == "${TITLE}"))[0].number // empty`]));
  if (!r.drift) {
    const n = find();
    if (dry) return console.log(`[dry-run] no drift: would comment "clean at ${r.version}" and close the tracking Issue if open`);
    if (n) {
      gh(['issue', 'comment', n, '--repo', repo, '--body', `clean at ${r.version} (${runUrl})`]);
      gh(['issue', 'close', n, '--repo', repo]);
    }
    return;
  }
  const body = buildBody(r, runUrl);
  if (dry) return console.log(`[dry-run] would open/update "${TITLE}":\n\n${body}`);
  const n = find();
  if (n) {
    gh(['issue', 'edit', n, '--repo', repo, '--body', body]);
    gh(['issue', 'comment', n, '--repo', repo, '--body', `Still drifting at ${r.version} (${runUrl})`]);
  } else {
    gh(['issue', 'create', '--repo', repo, '--title', TITLE, '--body', body]);
  }
}

main();
