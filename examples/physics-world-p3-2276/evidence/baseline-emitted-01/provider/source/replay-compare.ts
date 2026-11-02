export function equivalentReplayValue(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' || typeof right === 'number') {
    return typeof left === 'number' && typeof right === 'number' &&
      Number.isFinite(left) && Number.isFinite(right) &&
      Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return left === right;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => equivalentReplayValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && equivalentReplayValue((left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key]));
}
