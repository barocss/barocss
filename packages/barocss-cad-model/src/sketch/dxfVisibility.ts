import { refusal } from '../engine/refusal';

type Group = readonly [number, string];
type LayerState = { name: string; flags: number; off: boolean; problem?: string };

function fields(groups: readonly Group[], codes: readonly number[]): Map<number, string[]> {
  const result = new Map<number, string[]>();
  let applicationDepth = 0;
  for (const [code, value] of groups) {
    if (code === 102) {
      if (value.startsWith('{')) applicationDepth++;
      else if (value === '}') applicationDepth = Math.max(0, applicationDepth - 1);
    }
    if (applicationDepth || !codes.includes(code)) continue;
    const values = result.get(code);
    if (values) values.push(value);
    else result.set(code, [value]);
  }
  return result;
}

function integer(value: string | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (!/^[+-]?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function layerStates(groups: readonly Group[]): { layers: Map<string, LayerState>; declared: boolean } {
  const layers = new Map<string, LayerState>();
  const start = groups.findIndex(([code, value], i) => code === 2 && value === 'TABLES' &&
    groups[i - 1]?.[0] === 0 && groups[i - 1][1] === 'SECTION');
  if (start < 0) return { layers, declared: false };
  let declared = false, inLayerTable = false;
  let i = start + 1;
  while (i < groups.length) {
    const [code, type] = groups[i++];
    if (code !== 0) continue;
    if (type === 'ENDSEC') break;
    if (type === 'ENDTAB') { inLayerTable = false; continue; }
    const first = i;
    while (i < groups.length && groups[i][0] !== 0) i++;
    if (type === 'TABLE') {
      inLayerTable = fields(groups.slice(first, i), [2]).get(2)?.[0] === 'LAYER';
      declared ||= inLayerTable;
    }
    if (type !== 'LAYER' || !inLayerTable) continue;
    const info = fields(groups.slice(first, i), [2, 62, 70]);
    const names = info.get(2), name = names?.[0];
    if (!name || names.length !== 1) throw refusal('DXF_MALFORMED', 'a LAYER record needs one layer name');
    const key = name.toUpperCase(), previous = layers.get(key);
    if (previous) { previous.problem = 'duplicate layer definition'; continue; }
    const flags = integer(info.get(70)?.[0], 0), color = integer(info.get(62)?.[0], 7);
    const malformed = flags === null || flags < 0 || flags > 65535 || color === null || (info.get(70)?.length ?? 0) > 1 || (info.get(62)?.length ?? 0) > 1;
    layers.set(key, { name, flags: flags ?? 0, off: color !== null && color < 0, ...(malformed ? { problem: 'invalid layer flags or color' } : {}) });
  }
  return { layers, declared };
}

const quoted = (label: string) => JSON.stringify(label.slice(0, 96));

/** Audit only the entities that the profile or underlay consumer would read. */
export function createDxfVisibility(groups: readonly Group[]) {
  const { layers, declared } = layerStates(groups);
  const problems = new Map<string, { layer: string; reason: string; counts: Map<string, number> }>();
  let malformed = false;
  const flag = (type: string, layer: string, reason: string, invalid = false) => {
    const key = JSON.stringify([layer, reason]);
    let found = problems.get(key);
    if (!found) { found = { layer, reason, counts: new Map() }; problems.set(key, found); }
    found.counts.set(type, (found.counts.get(type) ?? 0) + 1);
    malformed ||= invalid;
    return null;
  };
  return {
    entity(type: string, groups: readonly Group[], inherited = '0'): string | null {
      const info = fields(groups, [8, 60, 62]);
      const raw = info.get(8)?.[0] ?? '0', layer = raw === '0' ? inherited : raw;
      if (!raw || (info.get(8)?.length ?? 0) > 1) return flag(type, layer, 'invalid entity layer', true);
      const state = layers.get(layer.toUpperCase()), name = state?.name ?? layer;
      const visible = integer(info.get(60)?.[0], 0), color = integer(info.get(62)?.[0], 0);
      if ((visible !== 0 && visible !== 1) || color === null || (info.get(60)?.length ?? 0) > 1 || (info.get(62)?.length ?? 0) > 1) {
        return flag(type, name, 'invalid entity visibility or color', true);
      }
      if (state?.problem) return flag(type, name, state.problem, true);
      if (declared && !state && layer !== '0') return flag(type, name, 'layer has no definition', true);
      const flags = state?.flags ?? 0, reasons: string[] = [];
      if (state?.off || color < 0) reasons.push('layer is off');
      if (flags & 1) reasons.push('layer is frozen');
      if (visible === 1) reasons.push('entity is invisible');
      if (flags & 16) reasons.push('external layer visibility is unsupported');
      if (flags & ~(1 | 2 | 4 | 16 | 32 | 64)) reasons.push('layer visibility flags are unsupported');
      return reasons.length ? flag(type, name, reasons.join(', ')) : layer;
    },
    block(name: string, layer: string, flagsText: string | undefined, hasExternalPath: boolean): boolean {
      const flags = integer(flagsText, 0);
      if (flags === null || flags < 0 || flags > 127) { flag('INSERT', layer, 'invalid block flags for ' + quoted(name), true); return false; }
      if (hasExternalPath || (flags & (4 | 8 | 16 | 32 | 64))) {
        flag('INSERT', layer, 'external block visibility is unsupported for ' + quoted(name));
        return false;
      }
      return true;
    },
    finish(): void {
      if (!problems.size) return;
      const summary = [...problems.values()].slice(0, 4).map(({ layer, reason, counts }) =>
        [...counts].map(([type, count]) => count + ' ' + type).join(', ') + ' on layer ' + quoted(layer) + ' (' + reason + ')');
      if (problems.size > summary.length) summary.push((problems.size - summary.length) + ' more layer visibility problems');
      throw refusal(malformed ? 'DXF_MALFORMED' : 'DXF_UNSUPPORTED', 'drawing visibility cannot be preserved. ' + summary.join('. '));
    },
  };
}
