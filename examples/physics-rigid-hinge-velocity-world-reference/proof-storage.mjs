import {openSync, closeSync, readSync, writeSync, fsyncSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

export const LIMITS = Object.freeze({main: 1024 * 1048576, fixed: 64 * 1048576,
  controls: 32 * 1048576, emergency: 8 * 1048576, request: 256 * 1024,
  reply: 512 * 1024, receipt: 4 * 1024, transport: 8 * 1048576});
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export class ProofFailure extends Error {
  constructor(phase, code, message) { super(message); this.name = 'ProofFailure'; this.phase = phase; this.code = code; }
  safe() { return {phase: this.phase, code: this.code, message: this.message}; }
}

/** Streams full SOURCE bytes; later graphs retain aliases only after actual byte comparison. */
export class ProofStorage {
  constructor(directory, graph, sourceDirectory = null) {
    mkdirSync(directory, {recursive: false});
    this.directory = directory; this.graph = graph; this.sourceDirectory = sourceDirectory;
    this.channels = new Map(); this.used = {main: 0, fixed: 0, controls: 0, emergency: 0};
    this.firstFailure = null;
  }
  fail(phase, code, message) {
    const error = new ProofFailure(phase, code, message);
    this.firstFailure ??= error.safe();
    throw error;
  }
  charge(bucket, length) {
    if (this.used[bucket] + length > LIMITS[bucket] ||
      (bucket === 'controls' && this.used.fixed + length > LIMITS.fixed))
      this.fail('proof', 'PROOF_BYTE_LIMIT', 'hinge World proof byte limit exceeded');
    this.used[bucket] += length;
    if (bucket === 'controls') this.used.fixed += length;
  }
  channel(name) {
    if (!this.channels.has(name)) {
      const path = resolve(this.directory, name);
      const sourcePath = this.sourceDirectory === null ? null : resolve(this.sourceDirectory, name);
      this.channels.set(name, {path, sourcePath, fd: sourcePath === null ? openSync(path, 'wx') : openSync(sourcePath, 'r'),
        bytes: 0, hash: createHash('sha256'), lines: 0, trailing: 0, closed: false});
    }
    return this.channels.get(name);
  }
  append(name, bytes, bucket = 'fixed') {
    bytes = Buffer.from(bytes);
    const channel = this.channel(name), offset = channel.bytes;
    const observed = segment => {
      channel.hash.update(segment); channel.bytes += segment.length;
      for (const byte of segment) { if (byte === 10) { channel.lines++; channel.trailing = 0; } else channel.trailing++; }
    };
    if (this.sourceDirectory === null) {
      try { this.charge(bucket, bytes.length); }
      catch (error) { this.saveEmergency(name, offset, bytes, null); throw error; }
      let written = 0;
      while (written < bytes.length) {
        const count = writeSync(channel.fd, bytes, written, bytes.length - written, null);
        observed(bytes.subarray(written, written + count)); written += count;
      }
      fsyncSync(channel.fd);
    } else {
      const expected = Buffer.alloc(bytes.length);
      let read = 0;
      while (read < bytes.length) {
        const count = readSync(channel.fd, expected, read, bytes.length - read, offset + read);
        if (count === 0) break;
        read += count;
      }
      if (read !== bytes.length || !expected.equals(bytes)) {
        this.saveEmergency(name, offset, bytes, expected.subarray(0, read));
        this.fail('parity', 'PROOF_BYTES_DIFFER', 'hinge World proof bytes differ between graphs');
      }
      observed(bytes);
    }
    return {stream: name, offset, bytes: bytes.length, sha256: digest(bytes)};
  }
  json(name, value, bucket = 'fixed', maximum = LIMITS.reply) {
    const bytes = Buffer.from(JSON.stringify(value) + '\n');
    if (bytes.length > maximum) {
      this.saveEmergency(name, this.channels.get(name)?.bytes ?? 0, bytes, null);
      this.fail('proof', 'PROOF_BYTE_LIMIT', 'hinge World proof byte limit exceeded');
    }
    return this.append(name, bytes, bucket);
  }
  saveEmergency(name, offset, actual, expected) {
    // Reserve the failure locator as part of the same emergency allocation.
    const remain = Math.max(0, LIMITS.emergency - this.used.emergency - 4096);
    if (remain === 0) return;
    const actualPrefix = actual.subarray(0, Math.min(actual.length, Math.floor(remain / 2)));
    const expectedPrefix = expected === null ? Buffer.alloc(0) : expected.subarray(0, Math.min(expected.length, remain - actualPrefix.length));
    const index = this.used.emergency;
    writeFileSync(resolve(this.directory, `failure-${index}.actual.raw`), actualPrefix, {flag: 'wx'});
    writeFileSync(resolve(this.directory, `failure-${index}.expected.raw`), expectedPrefix, {flag: 'wx'});
    const receipt = {stream: name, offset, actualBytes: actual.length, capturedActualBytes: actualPrefix.length,
      capturedActualSha256: digest(actualPrefix), expectedBytes: expected?.length ?? null,
      capturedExpectedBytes: expectedPrefix.length, capturedExpectedSha256: digest(expectedPrefix)};
    const receiptBytes = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
    writeFileSync(resolve(this.directory, `failure-${index}.json`), receiptBytes, {flag: 'wx'});
    this.used.emergency += actualPrefix.length + expectedPrefix.length + receiptBytes.length;
  }
  finish(name, completeEOF = true) {
    const channel = this.channel(name);
    if (channel.closed) return channel.receipt;
    let noUnusedBytes = true;
    if (this.sourceDirectory !== null && completeEOF) {
      const extra = Buffer.alloc(1);
      noUnusedBytes = readSync(channel.fd, extra, 0, 1, channel.bytes) === 0;
    }
    closeSync(channel.fd); channel.closed = true;
    channel.receipt = {path: channel.sourcePath ?? channel.path, bytes: channel.bytes,
      sha256: channel.hash.digest('hex'), completeLines: channel.lines, trailingBytes: channel.trailing,
      completeEOF, noUnusedBytes};
    if (!noUnusedBytes) this.fail('parity', 'PROOF_BYTES_DIFFER', 'hinge World proof bytes differ between graphs');
    if (channel.sourcePath !== null) {
      const alias = Buffer.from(JSON.stringify({
      graph: this.graph, source: channel.receipt, actualComparedBytes: channel.bytes,
      actualComparedSha256: channel.receipt.sha256, completeEOF,
      }, null, 2) + '\n');
      this.charge('fixed', alias.length);
      writeFileSync(channel.path + '.alias.json', alias, {flag: 'wx'});
    }
    return channel.receipt;
  }
  finishAll(completeEOF = true) {
    const result = {}, failures = [];
    for (const name of this.channels.keys()) {
      try { result[name] = this.finish(name, completeEOF); }
      catch (error) {
        failures.push(error instanceof ProofFailure ? error.safe() : {phase: 'proof', code: 'PROOF_PERSIST_FAILED', message: 'hinge World proof could not be stored'});
        result[name] = this.channels.get(name).receipt ?? null;
      }
    }
    return {streams: result, failures};
  }
}
