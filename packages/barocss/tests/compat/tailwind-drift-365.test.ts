// #365: report-only drift check against the LATEST Tailwind 4.x. Skipped unless the scheduled workflow sets
// BAROCSS_TW_DRIFT_DIR (a scratch dir with `tailwindcss` installed); writes a JSON report to BAROCSS_TW_DRIFT_OUT.
// Drift = a corpus class at parity with the pinned Tailwind that fails against the latest, or a changed preflight.
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { compile } from 'tailwindcss';
import { corpus } from './corpus';
import { corpusHeldout } from './corpus-heldout';
import { coverageReport, runParity, tailwindBuilderFrom } from './parity-compare';

const dir = process.env.BAROCSS_TW_DRIFT_DIR;

async function preflight(compileFn: typeof compile, req: NodeRequire) {
  const src = fs.readFileSync(req.resolve('tailwindcss/preflight.css'), 'utf8');
  return (await compileFn(`@layer base {\n${src}\n}`)).build([]);
}

describe.skipIf(!dir)('#365 Tailwind 4.x drift (report-only)', () => {
  it('reports drift against the installed latest Tailwind', { timeout: 300_000 }, async () => {
    const latestReq = createRequire(path.join(path.resolve(dir!), 'package.json'));
    const pinnedReq = createRequire(import.meta.url);
    const latest = (await import(pathToFileURL(latestReq.resolve('tailwindcss')).href)) as { compile: typeof compile };
    const version: string = latestReq('tailwindcss/package.json').version;
    const pinned: string = pinnedReq('tailwindcss/package.json').version;
    const build = tailwindBuilderFrom(latest.compile, fs.readFileSync(latestReq.resolve('tailwindcss/theme.css'), 'utf8'));

    const corpora: Record<string, { coverage: string; failing: number; regressions: { token: string; family: string; diffs: string[] }[] }> = {};
    for (const [name, c] of [['corpus', corpus], ['heldout', corpusHeldout]] as const) {
      const base = await runParity(c);
      const now = await runParity(c, build);
      const wasPass = new Set(base.filter((r) => r.pass).map((r) => r.token));
      const coverage = coverageReport(`${name} vs Tailwind ${version}`, now).split('\n')[0];
      console.log(coverage);
      corpora[name] = {
        coverage,
        failing: now.filter((r) => !r.pass).length,
        regressions: now.filter((r) => !r.pass && wasPass.has(r.token)).map((r) => ({ token: r.token, family: r.family, diffs: r.diffs.slice(0, 3) })),
      };
    }
    const preflightChanged = (await preflight(latest.compile, latestReq)) !== (await preflight(compile, pinnedReq));
    const drift = preflightChanged || Object.values(corpora).some((c) => c.regressions.length > 0);
    const out = { version, pinned, drift, preflightChanged, corpora };
    if (process.env.BAROCSS_TW_DRIFT_OUT) fs.writeFileSync(process.env.BAROCSS_TW_DRIFT_OUT, JSON.stringify(out, null, 2));
    console.log(`drift=${drift} (Tailwind ${version}, pinned ${pinned}, preflight changed: ${preflightChanged})`);
  });
});
