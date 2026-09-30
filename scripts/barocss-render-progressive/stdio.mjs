// Consumes stdout from a caller-owned local process. It never starts a model or process.
export async function consumeStdio(readable, delivery, processId) {
  if (!readable || typeof readable[Symbol.asyncIterator] !== 'function'
    || !delivery || typeof delivery.push !== 'function' || typeof processId !== 'string') {
    throw new Error('A readable stream, delivery controller, and process ID are required');
  }
  for await (const bytes of readable) {
    const result = delivery.push(bytes, processId);
    if (!result.ok) return result;
  }
  return delivery.finish(processId);
}
