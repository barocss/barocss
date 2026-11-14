import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { isSketchAnchoredCut } from '@barocss/cad-model/app/editFields';

export type FeatureNumberRule = 'nonzero' | 'positive';

export function commandNumberRule(command: string, key: string, operation?: unknown): FeatureNumberRule | undefined {
  if (command === 'box' && (key === 'w' || key === 'd')) return 'positive';
  if (command === 'extrude' && key === 'h' && operation === 'cut') return 'positive';
  if ((command === 'box' || command === 'extrude') && key === 'h') return 'nonzero';
  if (command === 'fillet' && key === 'radius') return 'positive';
}

export function historyNumberRule(nodes: readonly ModelNode[], index: number, key: string): FeatureNumberRule | undefined {
  const node = nodes[index];
  if (key.endsWith('linkedInsetMM')) return 'positive';
  if (node?.kind === 'extrude' && key === 'h') return isSketchAnchoredCut(nodes, index) ? 'positive' : commandNumberRule('extrude', key);
  if (node?.kind === 'extrude' && node.made?.command === 'box') return commandNumberRule('box', key);
  if (node?.kind === 'fillet' && !node.radii?.length && key === 'r') return commandNumberRule('fillet', 'radius');
}

export function featureNumberInvalid(value: string | number, rule: FeatureNumberRule): boolean {
  const number = Number(value);
  return !Number.isFinite(number) || (rule === 'positive' ? number <= 0 : number === 0);
}

export function featureNumberRange(rule: FeatureNumberRule): string {
  return rule === 'positive' ? 'Greater than 0 mm' : 'Any number except 0 mm';
}
