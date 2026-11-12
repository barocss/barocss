export const mirrorReplacementPlane = 'Reflected body only uses the YZ plane at X = 0.';

export function mirrorReplacementProblem(node: { keep?: unknown; plane?: unknown }): string | null {
  if (node.keep !== undefined && typeof node.keep !== 'boolean') return 'Mirror keep must be true or false.';
  return node.keep === false && node.plane !== 'yz' ? mirrorReplacementPlane : null;
}
