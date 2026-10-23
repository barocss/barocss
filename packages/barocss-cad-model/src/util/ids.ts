// A new id beside the ones taken (R4 A3: the first-free-id loops gathered; each caller keeps its prefix and start).

/** `${prefix}${n}` for the least n from `from` (default 1) that `taken` does not hold. */
export function nextFreeId(prefix: string, taken: { has(id: string): boolean }, from = 1): string {
  let n = from;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
