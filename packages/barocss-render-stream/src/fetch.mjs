import { createCompiler } from './server.mjs';
import { createJsonlDecoder, encodeRecord, STREAM_LIMITS, validateIdentity, validateOutputRecord } from './protocol.mjs';

// The host callback owns final authority. This adapter does not perform actions.
export function createCompiledResponse({ identity, contract, source, signal, includePreview = true, acceptFinal }) {
  validateIdentity(identity); identity = structuredClone(identity);
  if (typeof source !== 'function' || typeof acceptFinal !== 'function' || typeof includePreview !== 'boolean')
    throw new Error('Invalid Fetch host options');
  const owned = new AbortController(), stoppedRead = Symbol('stopped');
  let wakeStop;
  const stopNotice = new Promise((resolve) => { wakeStop = resolve; });
  let controller, iterator, stopped = false, finished = false, returnRequested = false;
  let outputSeq = 0, outputBytes = 0, lastSourceSeq = 0, proposedFinal = null;
  const pending = [];
  const compiler = createCompiler({ identity, contract });
  const decoder = createJsonlDecoder({ identity, kind: 'input', onRecord(record) {
    const candidate = compiler.accept(record);
    if (candidate?.final) proposedFinal = candidate;
    else if (candidate && includePreview) {
      if (pending.length >= STREAM_LIMITS.snapshots) throw new Error('Pending snapshot limit');
      pending.push(candidate);
    }
  } });
  const cleanup = () => signal?.removeEventListener('abort', externalAbort);
  const requestReturn = () => {
    if (!iterator || returnRequested) return;
    returnRequested = true;
    // An upstream next()/return() may ignore cancellation. Do not wait for it.
    try { Promise.resolve(iterator.return?.()).catch(() => {}); } catch { /* source cleanup is best effort */ }
  };
  const stop = (reason, errorOutput) => {
    if (stopped || finished) return;
    stopped = true; pending.length = 0; proposedFinal = null;
    cleanup(); owned.abort(reason); wakeStop(stoppedRead); requestReturn();
    if (errorOutput) controller.error(reason);
  };
  const externalAbort = () => stop(signal.reason ?? new DOMException('Request aborted', 'AbortError'), true);
  const prepareOutput = (candidate, phase) => {
    if (outputSeq >= STREAM_LIMITS.snapshots || candidate.sourceSeq <= lastSourceSeq) throw new Error('Output snapshot order or limit');
    const record = { version: 1, ...identity, seq: outputSeq + 1, type: 'snapshot',
      sourceSeq: candidate.sourceSeq, phase, spec: candidate.spec, css: candidate.css };
    validateOutputRecord(record, identity, outputSeq + 1);
    const bytes = encodeRecord(record);
    if (outputBytes + bytes.length > STREAM_LIMITS.outputBytes) throw new Error('Output byte limit');
    return { record, bytes };
  };
  const enqueue = ({ record, bytes }) => {
    outputSeq++; outputBytes += bytes.length; lastSourceSeq = record.sourceSeq;
    controller.enqueue(bytes);
  };
  const body = new ReadableStream({
    start(value) {
      controller = value;
      signal?.addEventListener('abort', externalAbort, { once: true });
      if (signal?.aborted) externalAbort();
    },
    async pull() {
      if (stopped || finished) return;
      try {
        if (!iterator) {
          const iterable = source(owned.signal);
          if (!iterable || typeof iterable[Symbol.asyncIterator] !== 'function') throw new Error('Expected an async byte source');
          iterator = iterable[Symbol.asyncIterator]();
          if (stopped) { requestReturn(); return; }
        }
        while (!pending.length) {
          const next = await Promise.race([iterator.next(), stopNotice]);
          if (stopped || next === stoppedRead) return;
          if (next.done) {
            decoder.finish(); compiler.finish();
            if (!proposedFinal) throw new Error('Missing proposed final');
            const output = prepareOutput(proposedFinal, 'committed');
            // All source and output checks precede the host's once-only admission.
            const admission = await Promise.race([
              Promise.resolve().then(() => {
                if (stopped) return stoppedRead;
                return acceptFinal(structuredClone(output.record), owned.signal);
              }), stopNotice,
            ]);
            if (stopped || admission === stoppedRead) return;
            if (admission === false) throw new Error('Final admission refused');
            enqueue(output); finished = true; cleanup(); controller.close(); return;
          }
          decoder.push(next.value);
        }
        enqueue(prepareOutput(pending.shift(), 'preview'));
      } catch (error) { stop(error, true); }
    },
    cancel(reason) { stop(reason ?? new DOMException('Response cancelled', 'AbortError'), false); },
  }, { highWaterMark: 0 });
  return new Response(body, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store',
    'x-stream-id': identity.streamId, 'x-revision': String(identity.revision) } });
}
