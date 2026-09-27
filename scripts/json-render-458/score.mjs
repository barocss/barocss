// Independent scoring of saved responses. No model, repair, or browser call.
import fs from 'node:fs';
import path from 'node:path';
import { SAFE_BUTTON_CLASSES, SAFE_LAYOUT_CLASSES, schedule } from './plan.mjs';
import { parseFinal, safeSpec, semanticErrors } from './validate.mjs';
import { verifyCapture } from './provenance.mjs';

const numericClass = (tokens, prefix, fixed) => {
  const matches = tokens.filter((token) => token.startsWith(prefix));
  if (matches.length !== 1) return null;
  const suffix = matches[0].slice(prefix.length);
  if (Object.hasOwn(fixed, suffix)) return fixed[suffix];
  const arbitrary = suffix.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  return arbitrary ? Number(arbitrary[1]) : null;
};
const close = (actual, expected) => Number.isFinite(actual) && Math.abs(actual - expected) < 0.01;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function derivedStyle(spec, arm, scenario) {
  const props = spec.elements.layout.props;
  const buttonId = scenario === 'settings' ? 'save' : scenario === 'dashboard' ? 'refresh' : 'add';
  const button = spec.elements[buttonId].props;
  if (arm === 'variable') {
    const base = props.density === 'compact' ? 12 : 24;
    return { paddingPx: props.variables?.paddingPx ?? base, gapPx: props.variables?.gapPx ?? base,
      radiusPx: props.variables?.radiusPx ?? 14, columns: props.columns,
      hoverUnderline: button.hoverUnderline === true, hoverItalic: false, uppercase: false,
      placementConsistent: (props.columns === 1) === (props.placement === 'stacked') };
  }
  const tokens = props.className.split(/\s+/).filter(Boolean);
  const buttonTokens = button.className?.split(/\s+/).filter(Boolean) ?? [];
  if (tokens.some((token) => !SAFE_LAYOUT_CLASSES.includes(token)) || buttonTokens.some((token) => !SAFE_BUTTON_CLASSES.includes(token))) throw new Error('Unsafe classes reached scoring');
  return { paddingPx: numericClass(tokens, 'p-', { '3': 12, '6': 24 }),
    gapPx: numericClass(tokens, 'gap-', { '3': 12, '6': 24 }),
    radiusPx: 14, columns: numericClass(tokens, 'grid-cols-', { '1': 1, '2': 2, '3': 3 }),
    hoverUnderline: buttonTokens.includes('hover:underline'), hoverItalic: buttonTokens.includes('hover:italic'),
    uppercase: buttonTokens.includes('uppercase'), placementConsistent: true };
}
export function scoreSaved(rows, outputDir) {
  const planned = schedule();
  const verified = verifyCapture(outputDir);
  if (!Array.isArray(rows) || !same(rows, verified.rows)) throw new Error('Capture rows differ from verified evidence');
  const prior = new Map();
  const chains = new Map();
  return rows.map((row, index) => {
    const frozen = planned[index];
    const chainBefore = chains.get(row.session) ?? true;
    const result = { id: frozen.id, session: frozen.session, scenario: frozen.scenario, arm: frozen.arm, stage: frozen.stage,
      attempted: row.attempted, captureStatus: row.status, support: frozen.support,
      schemaValid: false, semanticValid: false, requestSatisfied: false, abstentionCorrect: false,
      chainBefore, chainAfter: false, errors: [] };
    if (!row.attempted || row.status.startsWith('skipped-')) { chains.set(row.session, false); return result; }
    const rawPath = path.join(outputDir, `attempt-${String(row.ordinal).padStart(2, '0')}`, 'raw-final.txt');
    if (!fs.existsSync(rawPath)) { result.errors.push('Missing captured final response'); chains.set(row.session, false); return result; }
    const parsed = parseFinal(fs.readFileSync(rawPath, 'utf8'));
    if (parsed.status !== 'parsed') { result.errors.push(...parsed.errors); chains.set(row.session, false); return result; }
    const schemaErrors = safeSpec(parsed.spec, frozen.scenario, frozen.arm);
    if (schemaErrors.length) { result.errors.push(...schemaErrors); chains.set(row.session, false); return result; }
    result.schemaValid = true;
    result.errors.push(...semanticErrors(parsed.spec, frozen.scenario));
    result.semanticValid = result.errors.length === 0;
    result.cannotExpress = parsed.cannotExpress;
    const actual = derivedStyle(parsed.spec, frozen.arm, frozen.scenario);
    result.derivedStyle = actual;
    for (const [key, expected] of Object.entries(frozen.required)) {
      const met = ['paddingPx', 'gapPx', 'radiusPx'].includes(key) ? close(actual[key], expected) : actual[key] === expected;
      if (!met) result.errors.push(`Requested ${key} not met`);
    }
    if (!actual.placementConsistent) result.errors.push('Columns/placement mismatch');
    const previous = prior.get(row.session);
    result.transportValid = ['valid', 'declared-unexpressible', 'unexpected-unexpressible'].includes(row.status) && row.exitCode === 0 && row.stopReason === null && row.usage !== null;
    if (!result.transportValid) result.errors.push(`Capture transport not accepted: ${row.status}`);
    if (!frozen.support.supported) {
      result.abstentionCorrect = result.transportValid && parsed.cannotExpress && result.semanticValid && previous !== undefined && same(parsed.spec, previous);
      if (!result.abstentionCorrect) result.errors.push('Expected unchanged complete spec with cannotExpress=true');
    } else {
      result.requestSatisfied = result.transportValid && !parsed.cannotExpress && result.semanticValid && result.errors.length === 0;
      if (parsed.cannotExpress) result.errors.push('Unexpected cannotExpress=true');
    }
    result.chainAfter = chainBefore && (frozen.support.supported ? result.requestSatisfied : result.abstentionCorrect);
    chains.set(row.session, result.chainAfter);
    if (result.schemaValid && result.semanticValid && (frozen.support.supported ? result.requestSatisfied : result.abstentionCorrect)) prior.set(row.session, parsed.spec);
    return result;
  });
}
