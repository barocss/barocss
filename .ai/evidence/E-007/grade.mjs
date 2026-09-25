// E-007 node-side grading orchestration, shared by selftest.mjs and run.mjs (so the self-test exercises the run's code).
// gradeRun(page, task, baseline, toolCalls): diff at 1280px → required parts (G3: layout at 375px and 1280px) →
// write detector → classify the final section tokens on the same (final) page → pass/fail with reasons.
// analyzeCalls(toolCalls): class tokens per tool call (classify.mjs extractTokens), the first DOM-inserting call and
// its tokens (first-try), and per-token first call.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, counts, extractTokens, isDomInsert, codeOf } from './classify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'grader.js'), 'utf8').replace(/^export /gm, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const inPage = (page, expr) => page.evaluate(`(() => { ${SRC}; return ${expr}; })()`);
export const baselineTree = (page) => inPage(page, 'tree()');
async function width(page, w) { await page.setViewportSize({ width: w, height: 900 }); await sleep(500); }

export async function gradeRun(page, task, baseline, toolCalls) {
  await width(page, 1280);
  const diff = await inPage(page, `diff(${JSON.stringify(baseline)})`);
  let parts;
  if (task === 'G3') {
    const at1280 = await inPage(page, 'layoutAt()');
    await width(page, 375); const at375 = await inPage(page, 'layoutAt()'); await width(page, 1280);
    parts = await inPage(page, `g3(${JSON.stringify(at375)}, ${JSON.stringify(at1280)})`);
  } else parts = await inPage(page, `parts(${JSON.stringify(task)})`);
  const scan = await inPage(page, `scanToolCalls(${JSON.stringify(toolCalls || [])})`);
  const sectionTokens = [...new Set([...diff.newTokens, ...diff.addedToExisting.flatMap((a) => a.tokens)])];
  const sectionClass = await classify(page, sectionTokens);
  const remainingMisses = sectionTokens.filter((t) => sectionClass[t].class === 'PARITY-MISS');
  const reasons = [];
  if (!diff.newElementCount) reasons.push('no new section');
  if (!parts.pass) reasons.push('required parts missing');
  if (diff.newStyleAttrs.length) reasons.push('style attribute on new element');
  if (diff.baselineStyleChanged.length) reasons.push('baseline style attribute changed');
  if (scan.writes.length) reasons.push('raw CSS/style write in tool-call code');
  if (remainingMisses.length) reasons.push(`PARITY-MISS in section: ${remainingMisses.join(' ')}`);
  return { pass: reasons.length === 0, reasons, parts, scan, diff, sectionTokens, sectionCounts: counts(sectionTokens, sectionClass), sectionClass, remainingMisses };
}

export async function analyzeCalls(toolCalls) {
  const perCall = [], firstCall = {};
  for (let i = 0; i < (toolCalls || []).length; i++) {
    const code = codeOf(toolCalls[i]);
    if (!code) continue;
    const toks = await extractTokens(code);
    if (toks.length) perCall.push({ call: i, domInsert: isDomInsert(toolCalls[i]), tokens: toks });
    for (const t of toks) if (!(t in firstCall)) firstCall[t] = i;
  }
  const firstInsertIdx = (toolCalls || []).findIndex((c) => isDomInsert(c));
  const firstTry = firstInsertIdx < 0 ? [] : (perCall.find((p) => p.call === firstInsertIdx)?.tokens || []);
  return { firstInsertCall: firstInsertIdx, firstTry, perCall, firstCall, written: Object.keys(firstCall) };
}
