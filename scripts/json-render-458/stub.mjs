// CLI-free fixtures for contract tests and local viewer smoke only. Never imported into live calls.
import fs from 'node:fs';
import path from 'node:path';
import { specFor } from '../json-render-446/spec.mjs';
import { MODEL } from './plan.mjs';

function stubSpec(row) {
  const spec = structuredClone(specFor(row.scenario, row.arm === 'variable' ? 'bounded' : 'utility', 'initial'));
  const layout = spec.elements.layout.props;
  if (row.arm === 'variable') layout.variables = {};
  if (row.stage === 'initial') return spec;
  if (row.arm === 'variable') {
    layout.variables = { [row.scenario === 'dashboard' ? 'gapPx' : 'paddingPx']: row.scenario === 'settings' ? 17.5 : row.scenario === 'dashboard' ? 21.25 : 23.75 };
    if (row.stage === 'compiled' || row.stage === 'absent') {
      if (row.scenario === 'settings') spec.elements.save.props.hoverUnderline = true;
      else { layout.columns = 1; layout.placement = 'stacked'; if (row.scenario === 'kiosk') layout.density = 'compact'; }
    }
  } else {
    if (row.scenario === 'settings') {
      layout.className = 'grid-cols-2 p-[17.5px] gap-6';
      if (row.stage === 'compiled' || row.stage === 'absent') spec.elements.save.props.className = row.stage === 'absent' ? 'hover:underline hover:italic' : 'hover:underline';
    } else if (row.scenario === 'dashboard') {
      layout.className = row.stage === 'scalar' ? 'grid-cols-2 p-6 gap-[21.25px]' : row.stage === 'compiled' ? 'grid-cols-1 p-6 gap-[21.25px]' : 'grid-cols-3 p-6 gap-[21.25px]';
    } else {
      layout.className = row.stage === 'scalar' ? 'grid-cols-2 p-[23.75px] gap-6' : 'grid-cols-1 p-[23.75px] gap-3';
      if (row.stage === 'absent') spec.elements.add.props.className = 'uppercase';
    }
  }
  return spec;
}
export function stubTransport(mode = 'valid') {
  const modes = new Set(['valid', 'malformed', 'truncated', 'schema', 'timeout', 'quota', 'missing-usage']);
  if (!modes.has(mode)) throw new Error('Unknown stub mode');
  return async ({ row, attemptDir }) => {
    const failFirst = row.ordinal === 0;
    const spec = stubSpec(row);
    const cannotExpress = row.stage === 'absent' && row.arm === 'variable';
    let rawFinal = JSON.stringify({ specJson: JSON.stringify(spec), cannotExpress });
    if (failFirst && mode === 'malformed') rawFinal = '{broken';
    if (failFirst && mode === 'truncated') rawFinal = rawFinal.slice(0, 25);
    if (failFirst && mode === 'schema') rawFinal = JSON.stringify({ specJson: '{}', cannotExpress: false });
    const hard = failFirst && ['timeout', 'quota'].includes(mode);
    fs.writeFileSync(path.join(attemptDir, 'events.jsonl'), JSON.stringify({ type: 'synthetic-stub', mode }) + '\n', { flag: 'wx', mode: 0o600 });
    return { cliVersion: 'synthetic', modelRequested: MODEL, reasoningRequested: 'synthetic',
      exitCode: hard ? null : 0, stopReason: hard ? mode : null, rawFinal: hard ? null : rawFinal,
      usage: failFirst && mode === 'missing-usage' ? null : { input_tokens: 100, cached_input_tokens: 0, output_tokens: 50 },
      elapsedMs: 0, eventCount: 1, responseModel: MODEL };
  };
}
