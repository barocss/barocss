/** Private command-preview generation. Retirement rejects even an already-running worker reply. */
export function createPreviewLifetime() {
  let generation = 0;
  return { capture: () => generation, current: (ticket: number) => ticket === generation, retire: () => { generation++; } };
}
export async function ownedPreview<T>(owner: ReturnType<typeof createPreviewLifetime>, ticket: number, work: () => Promise<T>): Promise<{ stale: true } | { stale: false; result: T }> {
  if (!owner.current(ticket)) return { stale: true };
  try { const result = await work(); return owner.current(ticket) ? { stale: false, result } : { stale: true }; }
  catch (error) { if (!owner.current(ticket)) return { stale: true }; throw error; }
}
