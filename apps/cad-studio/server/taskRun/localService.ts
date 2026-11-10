import { spawn } from 'node:child_process';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import type { TaskRunLaunch } from '../../src/chat/taskRunOffer';
import { localRunStatus, prepareTaskRunHandoff, startLocalTaskRun } from './start';
import { RunStoreError, TaskRunStore } from './store';

export class LocalRunRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

type LocalRunReply = { result: TaskRunLaunch } | { status: number; error: string };

function startInProcess(root: string, bytes: Uint8Array): Promise<TaskRunLaunch> {
  return new Promise((resolve, reject) => {
    // The local runner has a separate PID and a fresh native blob store for each admission.
    const child = spawn(process.execPath, [fileURLToPath(new URL('./localTaskRun.mjs', import.meta.url)), root], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const failed = () => reject(new LocalRunRequestError(500, 'The local task run process did not return a result.'));
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', text => { output += text; });
    let processError = false;
    const markFailed = () => { processError = true; };
    child.stdin.on('error', markFailed);
    child.once('error', markFailed);
    child.once('close', code => {
      if (code !== 0 || processError) return failed();
      let reply: LocalRunReply;
      try { reply = JSON.parse(output); }
      catch { return failed(); }
      if ('result' in reply) resolve(reply.result);
      else reject(new LocalRunRequestError(reply.status, reply.error));
    });
    child.stdin.end(bytes);
  });
}

export function createLocalTaskRuns(root: string) {
  let active: { bytesHash: string; result: Promise<TaskRunLaunch> } | undefined;
  return async (bytes: Uint8Array): Promise<TaskRunLaunch> => {
    const bytesHash = sha256Hex(bytes);
    if (active) {
      if (active.bytesHash === bytesHash) return { ...await active.result, reused: true };
      throw new LocalRunRequestError(409, 'Another local task run is starting. Try again when it finishes.');
    }
    const result = startInProcess(root, bytes);
    active = { bytesHash, result };
    try { return await result; }
    finally { active = undefined; }
  };
}

function privateDirectory(path: string) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)))
    throw new LocalRunRequestError(409, 'The local task run directory must be private and owned by this account.');
  return realpathSync(path);
}

function syncDirectory(path: string) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

async function launchLocalTaskRun(root: string, bytes: Uint8Array): Promise<TaskRunLaunch> {
  const prepared = await prepareTaskRunHandoff(bytes).catch((error: unknown) => {
    throw new LocalRunRequestError(400, error instanceof Error ? error.message : 'Invalid task run handoff.');
  });
  const { config, tasks } = prepared, ids = tasks.map(task => task.id).sort();
  const key = digestOf({ source: config.sourceSHA256, occurrences: ids });
  root = resolve(root);
  const created = mkdirSync(root, { recursive: true, mode: 0o700 });
  const privateRoot = privateDirectory(root);
  if (created) {
    const parent = realpathSync(dirname(created));
    for (let path = privateRoot; path !== parent && path !== dirname(path); path = dirname(path)) syncDirectory(path);
    syncDirectory(parent);
  }
  const directory = join(privateRoot, key);
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  privateDirectory(directory);
  syncDirectory(privateRoot);

  const report = (status: ReturnType<typeof localRunStatus>, reused: boolean): TaskRunLaunch => ({
    directory, runId: status.runId, phase: status.phase, reused,
    tasks: status.tasks.map(({ id, phase, reason }) => ({ id, phase, reason })),
  });
  const inspect = () => {
    const record = TaskRunStore.inspect(directory);
    if (digestOf(record.state.plan.identity) !== digestOf(config.plan.identity)
      || digestOf(record.state.tasks.map(task => task.id).sort()) !== digestOf(ids))
      throw new LocalRunRequestError(409, 'The existing local task run has a different source or selection.');
    return report(localRunStatus(record), true);
  };
  try { return inspect(); }
  catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new LocalRunRequestError(409, `Could not read the existing local run. Check ${directory}.`);
  }
  try { return report(await startLocalTaskRun(directory, prepared), false); }
  catch (error) {
    if (error instanceof RunStoreError && error.code === 'RUN_BUSY')
      throw new LocalRunRequestError(409, 'Another process owns this local task run. Try again when it finishes.');
    if (error instanceof RunStoreError && error.code === 'RUN_EXISTS') return inspect();
    throw new LocalRunRequestError(500, `Could not finish starting the local run. Check ${directory}.`);
  }
}

export async function runLocalTaskHandoff(root: string, bytes: Uint8Array): Promise<LocalRunReply> {
  try { return { result: await launchLocalTaskRun(root, bytes) }; }
  catch (error) {
    return error instanceof LocalRunRequestError ? { status: error.status, error: error.message }
      : { status: 500, error: 'Could not access the local task run directory.' };
  }
}
