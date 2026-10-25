// R7.6 bounded static rules. This policy does not certify all API conventions.
import path from 'node:path';

export const RULE_IDS = Object.freeze(['EX001', 'EX002', 'EX003', 'DA001', 'IV001', 'IV002']);
export const CORE_ANCHORS = Object.freeze(['CadPartOutput', 'CadPartSnapshot']);
export const PACKAGES = Object.freeze([
  { name: '@barocss/cad', directory: 'packages/barocss-cad' },
  { name: '@barocss/cad-model', directory: 'packages/barocss-cad-model' },
  { name: '@barocss/gpu', directory: 'packages/barocss-gpu' },
]);
export const EXCEPTIONS = Object.freeze([]);
export const LIMITS = Object.freeze([
  'SCOPED_PASS covers only EX001/EX002/EX003/DA001/IV001/IV002.',
  'DA001 covers two direct core-result anchors, not every nested JSON boundary.',
  'Helper throws, immutability, numeric units, runtime behaviour and full conventions §§1–12 are NOT_PROVEN.',
  'Facade/resource/Error/callback/native labels are observations, never blanket exceptions.',
  'Native SI and R7.3d legacy surfaces are catalogued without conversion or retirement.',
]);
export const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const slash = value => value.split(path.sep).join('/');
export const issue = (rule, message, details = {}) => ({ rule, message, ...details });
const countStars = value => [...value].filter(c => c === '*').length;
const relativeFile = value => typeof value === 'string' && value.startsWith('./')
  && !value.includes('\\') && !value.includes('?') && !value.includes('#')
  && value.slice(2).split('/').every(s => s && s !== '.' && s !== '..' && s !== 'node_modules');
const validKey = key => key === '.' || relativeFile(key);
const supportedConditions = new Set(['types', 'import', 'default']);

export function readExportMap(value, packageName) {
  const issues = [], entries = [];
  let map;
  if (typeof value === 'string' || value === null || Array.isArray(value)) map = { '.': value };
  else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    map = keys.some(k => k.startsWith('.')) ? value : { '.': value };
  } else return { entries, issues: [issue('EX001', 'Missing or invalid package exports', { package: packageName })] };
  for (const [key, target] of Object.entries(map)) {
    if (!validKey(key) || countStars(key) > 1) {
      issues.push(issue('EX001', 'Unsupported public subpath', { package: packageName, module: key })); continue;
    }
    const leaves = [];
    const visit = (node, conditions) => {
      if (node === null) { leaves.push({ conditions, target: null }); return; }
      if (typeof node === 'string') {
        if (!relativeFile(node) || countStars(node) !== countStars(key)) {
          issues.push(issue('EX001', 'Unsafe or unsupported export target', { package: packageName, module: key, target: node, conditions })); return;
        }
        leaves.push({ conditions, target: node }); return;
      }
      if (!node || typeof node !== 'object' || Array.isArray(node) || !Object.keys(node).length) {
        issues.push(issue('EX001', 'Unsupported export fallback or condition shape', { package: packageName, module: key, conditions })); return;
      }
      // Preserve insertion order: condition priority is semantic.
      for (const [condition, branch] of Object.entries(node)) {
        if (!supportedConditions.has(condition)) {
          issues.push(issue('EX001', 'Unsupported export condition', { package: packageName, module: key, condition })); continue;
        }
        visit(branch, [...conditions, condition]);
      }
    };
    visit(target, []);
    entries.push({ key, leaves });
  }
  entries.sort((a, b) => compareText(a.key, b.key));
  return { entries, issues };
}
function match(pattern, value) {
  const i = pattern.indexOf('*');
  if (i < 0) return pattern === value ? '' : null;
  const head = pattern.slice(0, i), tail = pattern.slice(i + 1);
  return value.startsWith(head) && value.endsWith(tail) && value.length >= head.length + tail.length
    ? value.slice(head.length, value.length - tail.length) : null;
}
function priority(a, b) {
  if (!a.includes('*')) return b.includes('*') ? -1 : compareText(a, b);
  if (!b.includes('*')) return 1;
  return b.indexOf('*') - a.indexOf('*') || b.length - a.length || compareText(a, b);
}
function safeCapture(value) {
  try { return decodeURIComponent(value).split('/').every(s => s && s !== '.' && s !== '..' && s.toLowerCase() !== 'node_modules'); }
  catch { return false; }
}
export function expandExports({ packageName, entries, files }) {
  const issues = [], candidates = [];
  const sortedFiles = [...files].sort(compareText);
  for (const entry of entries) for (const leaf of entry.leaves) {
    if (leaf.target === null) continue;
    const matches = sortedFiles.flatMap(file => {
      const capture = match(leaf.target.slice(2), file);
      return capture === null ? [] : [{ file, capture }];
    });
    if (!matches.length) issues.push(issue('EX002', 'Export target has no corresponding source file', {
      package: packageName, module: entry.key, target: leaf.target, conditions: leaf.conditions,
    }));
    for (const { file, capture } of matches) {
      if (entry.key.includes('*') && !safeCapture(capture)) {
        issues.push(issue('EX001', 'Unsafe wildcard capture', { package: packageName, module: entry.key, target: file })); continue;
      }
      candidates.push({ package: packageName, subpath: entry.key.replace('*', capture), declaredKey: entry.key, conditions: leaf.conditions, file });
    }
  }
  const targets = [];
  for (const candidate of candidates) {
    const selected = entries.filter(e => match(e.key, candidate.subpath) !== null).sort((a, b) => priority(a.key, b.key))[0];
    // Exact keys and null blocking patterns must shadow a broader pattern.
    if (selected?.key === candidate.declaredKey) targets.push(candidate);
  }
  targets.sort((a, b) => compareText(a.subpath, b.subpath)
    || compareText(JSON.stringify(a.conditions), JSON.stringify(b.conditions)) || compareText(a.file, b.file));
  return { targets, issues };
}
export function validateExceptions(entries) {
  if (!Array.isArray(entries)) return [issue('IV002', 'Exception registry must be an array')];
  // The first six rules are non-waivable. Even a fully described exception requires a new policy review.
  return entries.map(entry => issue('IV002', 'No exceptions are approved for this policy version', {
    exception: entry, required: ['package', 'module', 'exportName', 'space', 'ruleId', 'reason', 'authority', 'currentShape', 'declaration', 'removalCondition', 'owner', 'policyVersion'],
  }));
}
export function canonicalJSON(data) { return JSON.stringify(data, null, 2) + '\n'; }
function firstDifference(expected, actual, at = '$') {
  if (Object.is(expected, actual)) return null;
  if (typeof expected !== typeof actual || expected === null || actual === null || typeof expected !== 'object') return { path: at, expected, actual };
  if (Array.isArray(expected) !== Array.isArray(actual)) return { path: at, expected, actual };
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) return { path: at + '.length', expected: expected.length, actual: actual.length };
    for (let i = 0; i < expected.length; i++) { const d = firstDifference(expected[i], actual[i], at + '[' + i + ']'); if (d) return d; }
    return null;
  }
  const ek = Object.keys(expected).sort(compareText), ak = Object.keys(actual).sort(compareText);
  if (JSON.stringify(ek) !== JSON.stringify(ak)) return { path: at + '.keys', expected: ek, actual: ak };
  for (const k of ek) { const d = firstDifference(expected[k], actual[k], at + '.' + k); if (d) return d; }
  return null;
}
export function checkInventory(collection, expected, exceptions = EXCEPTIONS) {
  // Hard rules run before baseline comparison. A matching snapshot cannot waive a violation.
  const issues = [...collection.issues];
  if (!expected || expected.status === 'NOTGENERATED' || expected.schemaVersion !== 1 || expected.policyVersion !== 1
    || !Array.isArray(expected.exposures) || expected.exposures.length < 2
    || !Array.isArray(expected.packageExports) || expected.packageExports.length !== PACKAGES.length
    || !Array.isArray(expected.coreResultChecks) || !CORE_ANCHORS.every(name => expected.coreResultChecks.some(row => row.exportName === name))) {
    issues.push(issue('IV001', 'Expected inventory is missing, incomplete or NOTGENERATED'));
  } else {
    const difference = firstDifference(expected, collection.data);
    if (difference) issues.push(issue('IV001', 'Canonical public inventory differs', difference));
  }
  issues.push(...validateExceptions(exceptions));
  return { status: issues.length ? 'FAIL' : 'SCOPED_PASS', issues, checkedRules: RULE_IDS, notProven: LIMITS };
}
