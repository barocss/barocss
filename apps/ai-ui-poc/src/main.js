import { BENCHMARK_FIXTURES } from '../fixtures/benchmark.js';
import { FORBIDDEN_FIXTURES } from '../fixtures/forbidden.js';
import { createBaroAdapter } from './barocss-adapter.js';
import { assessFixture } from './assess.js';
import { runMockPipeline } from './pipeline.js';
import './style.css';

const fixtureSelect = document.querySelector('#fixture');
const input = document.querySelector('#json-input');
const preview = document.querySelector('#preview');
const errorsElement = document.querySelector('#errors');
const reportElement = document.querySelector('#report');
const adapter = createBaroAdapter();
let lastBenchmark = null;
const fixtures = [
  ...BENCHMARK_FIXTURES.map((fixture) => ({ ...fixture, label: `${fixture.id} · ${fixture.prompt}`, tree: fixture.mockTree })),
  ...FORBIDDEN_FIXTURES.map((fixture) => ({ ...fixture, label: `금지 입력 · ${fixture.id}`, tree: fixture.mockTree })),
];

function showErrors(errors) {
  errorsElement.replaceChildren();
  if (errors.length === 0) {
    const item = document.createElement('li');
    item.textContent = '오류 없음';
    errorsElement.append(item);
    return;
  }
  for (const error of errors) {
    const item = document.createElement('li');
    item.textContent = `${error.nodeId} · ${error.code} · ${error.detail}`;
    errorsElement.append(item);
  }
}

function run(raw) {
  let result;
  try {
    result = runMockPipeline(raw, { resolveClass: adapter.resolveClass, runtime: adapter, preview });
  } catch (cause) {
    result = { tree: null, errors: [{ nodeId: '$', code: 'RENDERER', detail: String(cause) }], timingsMs: null, usage: null };
  }
  showErrors(result.errors);
  reportElement.textContent = JSON.stringify({
    renderedPreview: result.renderedPreview,
    timingsMs: result.timingsMs,
    usage: result.usage,
    css: result.css,
  }, null, 2);
  return result;
}

for (const fixture of fixtures) {
  const option = document.createElement('option');
  option.value = fixture.id;
  option.textContent = fixture.label;
  fixtureSelect.append(option);
}

fixtureSelect.addEventListener('change', () => {
  const fixture = fixtures.find((item) => item.id === fixtureSelect.value);
  input.value = JSON.stringify(fixture.tree, null, 2);
  run(fixture.tree);
});

document.querySelector('#run').addEventListener('click', () => {
  try { run(JSON.parse(input.value)); }
  catch { showErrors([{ nodeId: '$', code: 'SCHEMA', detail: 'JSON 파싱 실패' }]); preview.replaceChildren(); reportElement.textContent = ''; }
});

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

document.querySelector('#benchmark').addEventListener('click', () => {
  const records = [];
  for (const fixture of BENCHMARK_FIXTURES) {
    for (let repeat = 1; repeat <= 3; repeat++) {
      const result = run(fixture.mockTree);
      const assessment = assessFixture(fixture, preview);
      records.push({
        fixtureId: fixture.id, repeat, viewport: fixture.viewport,
        actualViewportPx: window.innerWidth,
        schemaValid: result.tree !== null,
        structureAndTextPass: assessment.structureAndTextPass,
        checkedStylePass: assessment.checkedStylePass,
        checkedStyles: assessment.checkedStyles,
        uncheckedClasses: assessment.uncheckedClasses,
        styleReady: result.timingsMs.firstStyleReady !== null,
        timingsMs: result.timingsMs, errors: result.errors,
        usage: null,
      });
    }
  }
  const styleTimes = records.map((record) => record.timingsMs.firstStyleReady).filter((value) => value !== null);
  const summary = {
    kind: 'deterministic-mock',
    baseCommit: '533fdb1f224c48c2c1828e7eaa58ab91596d13d6',
    userAgent: navigator.userAgent,
    timingClock: 'performance.now; same-page warm cache; foreground browser',
    runs: records.length,
    schemaValid: records.filter((record) => record.schemaValid).length,
    structureAndTextPass: records.filter((record) => record.structureAndTextPass).length,
    checkedStylePass: records.filter((record) => record.checkedStylePass).length,
    checkedStyleCases: records.reduce((count, record) => count + record.checkedStyles.length, 0),
    uncheckedClasses: [...new Set(records.flatMap((record) => record.uncheckedClasses))].sort(),
    styleReady: styleTimes.length,
    firstStyleReadyP95Ms: styleTimes.length === records.length ? p95(styleTimes) : null,
    modelQualityAndCost: 'not measured',
    records,
  };
  lastBenchmark = summary;
  document.querySelector('#download').disabled = false;
  reportElement.textContent = JSON.stringify(summary, null, 2);
  showErrors(records.flatMap((record) => record.errors));
});

document.querySelector('#download').addEventListener('click', () => {
  if (!lastBenchmark) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(lastBenchmark, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ai-ui-mock-measurements.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

preview.addEventListener('poc:notice', () => {
  reportElement.textContent = '등록된 행동 show_notice 실행';
});

fixtureSelect.value = BENCHMARK_FIXTURES[0].id;
input.value = JSON.stringify(BENCHMARK_FIXTURES[0].mockTree, null, 2);
run(BENCHMARK_FIXTURES[0].mockTree);
