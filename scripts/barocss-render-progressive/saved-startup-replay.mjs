import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptPassiveNotification, validateInitializeResponse } from './protocol-contract.mjs';

// Read saved bytes only. This module cannot spawn Codex, connect, or create a session.
export function replaySavedStartup(bytes, { initializeRequestId = 1, codexHome } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 32768) throw new Error('Invalid saved startup bytes');
  // Match live RPC decoding/framing: no replacement characters or partial final line.
  if (bytes.at(-1) !== 10) throw new Error('Incomplete saved RPC line');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const frames = decoded.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  let initialized = false, notifications = 0;
  for (const event of frames) {
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      throw new Error('Invalid saved RPC message');
    }
    if (Object.hasOwn(event, 'id')) {
      if (Object.hasOwn(event, 'method') || event.id !== initializeRequestId || initialized
        || !Object.hasOwn(event, 'result') || Object.hasOwn(event, 'error')) {
        throw new Error('Unexpected saved initialize response');
      }
      validateInitializeResponse(event.result, '0.156.1', { codexHome });
      initialized = true;
    } else {
      if (!acceptPassiveNotification(event, { phase: initialized ? 'starting-session' : 'initializing' })) {
        throw new Error('Unknown saved startup frame');
      }
      if (++notifications > 16) throw new Error('Saved metadata ceiling exceeded');
    }
  }
  if (!initialized) throw new Error('Saved initialize response missing');
  return { source: 'saved-native-startup-only', frames: frames.length, initializeResponses: 1,
    passiveNotifications: notifications, acceptedSessions: 0, completedTurns: 0,
    nativeLaunches: 0, modelCalls: 0, uiSamples: 0, latencyClaim: 'none' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  const root = '/Users/user/.barocss-ai/v3';
  if (!input || !output || path.dirname(path.dirname(input)) !== root
    || path.basename(input) !== 'stdout.bin' || !path.basename(path.dirname(input)).startsWith('private-464-')
    || fs.realpathSync(input) !== input || path.dirname(output) !== root
    || !path.basename(output).startsWith('private-467-') || fs.existsSync(output)) {
    throw new Error('Canonical private saved input and fresh private output required');
  }
  const result = replaySavedStartup(fs.readFileSync(input));
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  // eslint-disable-next-line no-console -- CLI emits only the public-safe aggregate.
  console.log(JSON.stringify(result));
}
