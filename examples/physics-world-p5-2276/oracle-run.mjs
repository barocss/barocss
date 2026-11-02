import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../..");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = (x) => JSON.stringify(x, null, 2) + "\n";
async function main() {
  const a = process.argv.slice(2);
  assert.equal(a.length, 7, "--run-id FRESH --freeze PATH --freeze-sha256 SHA --authorize-oracle");
  for (const [i, label] of [[0, "--run-id"], [2, "--freeze"], [4, "--freeze-sha256"], [6, "--authorize-oracle"]]) assert.equal(a[i], label);
  const id = a[1], freezePath = resolve(a[3]), freezeSha = a[5];
  assert(/^[a-z][a-z0-9-]{0,63}$/.test(id));
  assert(/^v22\./.test(process.version), "Node22 required");
  assert(!process.env.ESBUILD_BINARY_PATH, "external esbuild override refused");
  const freezeBytes = await readFile(freezePath);
  assert.equal(sha(freezeBytes), freezeSha);
  const freeze = JSON.parse(freezeBytes);
  assert(freeze.files);
  for (const [path, pin] of Object.entries(freeze.files)) {
    const b = await readFile(resolve(ROOT, path));
    assert.equal(b.length, pin.bytes, path);
    assert.equal(sha(b), pin.sha256, path);
  }
  const out = resolve(HERE, "evidence", id);
  await mkdir(resolve(HERE, "evidence"), { recursive: true });
  await mkdir(out, { recursive: false });
  const command = [process.execPath, resolve(HERE, "oracle-generation.mjs"), out, freezePath, freezeSha, "--authorized-oracle-child"];
  await writeFile(resolve(out, "start.json"), json({ command, cwd: ROOT, freezePath, freezeSha, startedAt: (/* @__PURE__ */ new Date()).toISOString(), childMs: 18e4, termMs: 1e3, postKillMs: 2e3, combinedLogCap: 4194304, evidenceCap: 67108864 }), { flag: "wx" });
  const spawnClock = process.hrtime.bigint();
  const child2 = spawn(command[0], command.slice(1), { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let timedOut = false, overflow = false, closed = false, stdoutEOF = false, stderrEOF = false;
  let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), exit = {}, stopStarted = false;
  let termTimer, finalTimer, resolveFinished;
  const finished = new Promise((r) => {
    resolveFinished = r;
  });
  const signals = [];
  const groupAlive = () => {
    if (!child2.pid) return false;
    try {
      process.kill(-child2.pid, 0);
      return true;
    } catch (e) {
      if (e.code === "ESRCH") return false;
      throw e;
    }
  };
  const kill = (signal) => {
    if (!child2.pid) return;
    try {
      process.kill(-child2.pid, signal);
      signals.push({ signal, result: "SENT" });
    } catch (e) {
      signals.push({ signal, result: e.code });
      if (e.code !== "ESRCH") exit.groupSignalError = e.message;
    }
  };
  const complete = () => {
    if (closed && !groupAlive()) resolveFinished();
  };
  const stop = () => {
    if (stopStarted) return;
    stopStarted = true;
    kill("SIGTERM");
    termTimer = setTimeout(() => {
      kill("SIGKILL");
      finalTimer = setTimeout(() => resolveFinished(), 2e3);
      complete();
    }, 1e3);
  };
  for (const [stream, name] of [[child2.stdout, "stdout"], [child2.stderr, "stderr"]]) {
    stream.on("end", () => {
      if (name === "stdout") stdoutEOF = true;
      else stderrEOF = true;
    });
    stream.on("error", (e) => {
      exit.pipeError = e.message;
      stop();
    });
    stream.on("data", (b) => {
      const allowed = 4 * 1024 * 1024 - stdout.length - stderr.length;
      const kept = b.subarray(0, Math.max(0, allowed));
      if (name === "stdout") stdout = Buffer.concat([stdout, kept]);
      else stderr = Buffer.concat([stderr, kept]);
      if (kept.length < b.length) {
        overflow = true;
        stop();
      }
    });
  }
  child2.once("error", (e) => {
    exit.spawnError = e.message;
    stop();
  });
  child2.once("exit", (code, signal) => {
    exit.code = code;
    exit.signal = signal;
    if (groupAlive()) stop();
  });
  child2.once("close", () => {
    closed = true;
    if (groupAlive()) stop();
    else complete();
  });
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, Math.max(0, 18e4 - Number(process.hrtime.bigint() - spawnClock) / 1e6));
  await finished;
  clearTimeout(timer);
  clearTimeout(termTimer);
  clearTimeout(finalTimer);
  let groupAbsent = !groupAlive();
  if (!groupAbsent) {
    kill("SIGKILL");
    groupAbsent = !groupAlive();
  }
  if (!closed) {
    child2.stdout.destroy();
    child2.stderr.destroy();
    child2.unref();
  }
  await writeFile(resolve(out, "stdout.log"), stdout, { flag: "wx" });
  await writeFile(resolve(out, "stderr.log"), stderr, { flag: "wx" });
  let summary = null;
  try {
    summary = JSON.parse(await readFile(resolve(out, "summary.json"), "utf8"));
  } catch {
  }
  const pass = !timedOut && !overflow && exit.code === 0 && closed && stdoutEOF && stderrEOF && groupAbsent && !exit.pipeError && !exit.spawnError && summary?.status === "PASS_ORIGINAL_CLOTH_RESEARCH_ORACLE";
  await writeFile(resolve(out, "exit.json"), json({ ...exit, timedOut, overflow, closed, stdoutEOF, stderrEOF, groupAbsent, signals, status: pass ? "PASS_ORIGINAL_CLOTH_RESEARCH_ORACLE" : "FAIL", progressPath: "progress.json", summaryPath: summary ? "summary.json" : null, end: (/* @__PURE__ */ new Date()).toISOString() }), { flag: "wx" });
  if (!pass) process.exitCode = 1;
}
await main();
