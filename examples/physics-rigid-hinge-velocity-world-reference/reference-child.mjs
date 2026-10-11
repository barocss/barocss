import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {LIMITS, ProofFailure} from './proof-storage.mjs';

const tuple = (phase, code, message) => ({phase, code, message});
const EXIT_MISSING = tuple('reply', 'IPC_REPLY_MISSING', 'hinge World reference exited before its reply');

/** One actual in-flight request. Raw files are written before send/parse. */
export class ReferenceChild {
  constructor(storage, script, python = 'python3') {
    this.storage = storage; this.pending = null; this.buffer = Buffer.alloc(0);
    this.sent = 0; this.completed = 0; this.firstFailure = null; this.secondaryFailures = [];
    this.stdoutClosed = false; this.stderrClosed = false; this.stdinEnded = false; this.closed = false;
    this.exitCode = null; this.signal = null;
    this.child = spawn(python, ['-u', resolve(script)], {stdio: ['pipe', 'pipe', 'pipe']});
    this.closedPromise = new Promise(resolveClose => { this.resolveClose = resolveClose; });
    this.child.on('error', () => this.reject(tuple('spawn', 'IPC_SPAWN_FAILED', 'hinge World reference process could not start')));
    this.child.stdin.on('error', () => this.reject(tuple('request', 'IPC_REQUEST_WRITE_FAILED', 'hinge World reference request could not be written')));
    this.child.stdout.on('data', bytes => this.receive(bytes));
    this.child.stdout.on('error', () => this.reject(tuple('stdout', 'IPC_STDOUT_READ_FAILED', 'hinge World reference stdout could not be read')));
    this.child.stdout.on('close', () => { this.stdoutClosed = true; });
    this.child.stderr.on('data', bytes => {
      try { this.storage.append('reference.stderr.raw', bytes, 'fixed'); }
      catch (error) { this.reject(error instanceof ProofFailure ? error.safe() : tuple('stderr', 'IPC_STDERR_PERSIST_FAILED', 'hinge World reference stderr could not be stored')); }
    });
    this.child.stderr.on('error', () => this.reject(tuple('stderr', 'IPC_STDERR_READ_FAILED', 'hinge World reference stderr could not be read')));
    this.child.stderr.on('close', () => { this.stderrClosed = true; });
    this.child.on('close', (code, signal) => {
      this.exitCode = code; this.signal = signal; this.closed = true;
      if (this.pending !== null) this.reject(EXIT_MISSING);
      else if (this.buffer.length > 0) this.reject(tuple('reply', 'IPC_REPLY_UNSOLICITED', 'hinge World reference returned an unsolicited reply'));
      if (signal !== null) this.reject(tuple('close', 'IPC_EXIT_SIGNAL', 'hinge World reference process terminated by signal'));
      else if (code !== 0) this.reject(tuple('close', 'IPC_EXIT_NONZERO', 'hinge World reference process exited unsuccessfully'));
      this.resolveClose();
    });
  }
  reject(failure) {
    if (this.firstFailure === null) this.firstFailure = failure;
    else if (JSON.stringify(failure) !== JSON.stringify(this.firstFailure)) this.secondaryFailures.push(failure);
    if (this.pending !== null) {
      const pending = this.pending; this.pending = null;
      this.failedRequestIndex = pending.index;
      pending.reject(new ProofFailure(failure.phase, failure.code, failure.message));
    }
  }
  receive(chunk) {
    try {
      // Persist raw bytes before attempting JSON decoding, including a bad fragment.
      const bucket = this.pending?.bucket ?? 'fixed';
      this.storage.append('reference.stdout.raw', chunk, bucket);
      if (this.buffer.length + chunk.length > LIMITS.transport)
        throw new ProofFailure('stdout', 'REPLY_BYTE_LIMIT', 'hinge World reference reply byte limit exceeded');
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (this.buffer.length > LIMITS.reply && this.buffer.indexOf(10) < 0)
        throw new ProofFailure('stdout', 'REPLY_BYTE_LIMIT', 'hinge World reference reply byte limit exceeded');
      let lf;
      while ((lf = this.buffer.indexOf(10)) >= 0) {
        const line = this.buffer.subarray(0, lf + 1); this.buffer = this.buffer.subarray(lf + 1);
        if (line.length > LIMITS.reply) throw new ProofFailure('stdout', 'REPLY_BYTE_LIMIT', 'hinge World reference reply byte limit exceeded');
        if (this.pending === null) throw new ProofFailure('reply', 'IPC_REPLY_UNSOLICITED', 'hinge World reference returned an unsolicited reply');
        let reply;
        try { reply = JSON.parse(line.toString('utf8')); }
        catch { throw new ProofFailure('reply', 'IPC_REPLY_JSON_INVALID', 'hinge World reference reply is not valid JSON'); }
        const pending = this.pending; this.pending = null; this.completed++;
        const channel = this.storage.channels.get('reference.stdout.raw');
        this.lastReply = {stream: 'reference.stdout.raw', offset: channel.bytes - this.buffer.length - line.length,
          bytes: line.length, requestIndex: pending.index};
        pending.resolve(reply);
      }
    } catch (error) {
      this.reject(error instanceof ProofFailure ? error.safe() : tuple('stdout', 'IPC_STDOUT_PERSIST_FAILED', 'hinge World reference stdout could not be stored'));
    }
  }
  async ask(value, bucket = 'controls') {
    return this.askRaw(JSON.stringify(value) + '\n', bucket);
  }
  async askRaw(text, bucket = 'controls') {
    if (this.firstFailure !== null || this.closed || this.pending !== null)
      throw new ProofFailure('reply', 'IPC_REPLY_MISSING', 'hinge World reference exited before its reply');
    const bytes = Buffer.from(text);
    if (bytes.length > LIMITS.request) {
      this.storage.saveEmergency('reference.stdin.raw', this.storage.channels.get('reference.stdin.raw')?.bytes ?? 0, bytes, null);
      const failure = tuple('request', 'REQUEST_BYTE_LIMIT', 'hinge World reference request byte limit exceeded');
      this.reject(failure); throw new ProofFailure(failure.phase, failure.code, failure.message);
    }
    try { this.lastRequest = this.storage.append('reference.stdin.raw', bytes, bucket); }
    catch (error) {
      const failure = error instanceof ProofFailure ? error.safe() : tuple('request', 'IPC_STDIN_PERSIST_FAILED', 'hinge World reference request could not be stored');
      this.reject(failure); throw new ProofFailure(failure.phase, failure.code, failure.message);
    }
    const index = ++this.sent;
    const response = new Promise((resolveReply, rejectReply) => { this.pending = {index, bucket, resolve: resolveReply, reject: rejectReply}; });
    // Attach immediately while a backpressured write awaits drain; keep the original rejection for the caller.
    response.catch(() => {});
    try {
      if (!this.child.stdin.write(bytes))
        await Promise.race([once(this.child.stdin, 'drain'), response.then(() => null), this.closedPromise.then(() => { throw new Error('closed'); })]);
    }
    catch { this.reject(tuple('request', 'IPC_REQUEST_WRITE_FAILED', 'hinge World reference request could not be written')); }
    return response;
  }
  async close(abort = false) {
    if (!this.stdinEnded) { this.stdinEnded = true; this.child.stdin.end(); }
    if (abort && !this.closed) this.child.kill('SIGTERM');
    const wait = async milliseconds => {
      let timer;
      const result = await Promise.race([this.closedPromise.then(() => true), new Promise(resolveWait => { timer = setTimeout(() => resolveWait(false), milliseconds); })]);
      clearTimeout(timer); return result;
    };
    if (!await wait(5000)) { this.child.kill('SIGKILL'); await wait(5000); }
    const complete = this.closed && this.stdoutClosed && this.stderrClosed;
    const streamReceipt = (name, eof) => {
      const value = this.storage.finish(name, eof);
      return Object.fromEntries(['path', 'bytes', 'sha256', 'completeLines', 'trailingBytes', 'completeEOF'].map(key => [key, value[key]]));
    };
    const stdin = streamReceipt('reference.stdin.raw', this.stdinEnded);
    const stdout = streamReceipt('reference.stdout.raw', this.stdoutClosed);
    const stderr = streamReceipt('reference.stderr.raw', this.stderrClosed);
    if (!complete && this.firstFailure === null)
      this.reject(tuple('close', 'IPC_EXIT_SIGNAL', 'hinge World reference process terminated by signal'));
    return {pid: this.child.pid ?? null, exitCode: this.exitCode, signal: this.signal, stdin, stdout, stderr,
      completedReplies: this.completed, pendingRequestIndex: this.pending?.index ?? this.failedRequestIndex ?? null,
      firstFailure: this.firstFailure, secondaryFailures: this.secondaryFailures};
  }
}
