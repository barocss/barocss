import type { ModelNode } from '@barocss/cad-model/engine/doc';

export type FeatureNumberRule = 'nonzero' | 'positive';

export function commandNumberRule(command: string, key: string): FeatureNumberRule | undefined {
  if (command === 'box' && (key === 'w' || key === 'd')) return 'positive';
  if ((command === 'box' || command === 'extrude') && key === 'h') return 'nonzero';
  if (command === 'fillet' && key === 'radius') return 'positive';
}

export function historyNumberRule(node: ModelNode | undefined, key: string): FeatureNumberRule | undefined {
  if (node?.kind === 'extrude' && key === 'h') return commandNumberRule('extrude', key);
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
