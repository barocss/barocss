import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../..");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = (x) => JSON.stringify(x, null, 2) + "\n";
const idOK = (x) => /^[a-z][a-z0-9-]{0,63}$/.test(x);
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    assert(!e.isSymbolicLink(), "provider symlink refused");
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...await files(p));
    else if (e.isFile()) out.push(p);
  }
  return out.sort();
}
async function authenticate() {
  const pin = JSON.parse(await readFile(resolve(HERE, "BASELINE-PROVIDERS.json"), "utf8"));
  for (const [p, v] of Object.entries(pin.files)) {
    const b = await readFile(resolve(ROOT, p));
    assert.equal(b.length, v.bytes, p);
    assert.equal(sha(b), v.sha256, p);
  }
  for (const tree of pin.trees) assert.deepEqual((await files(resolve(ROOT, tree))).map((p) => relative(ROOT, p)), Object.keys(pin.files).filter((p) => p.startsWith(tree + "/")).sort(), tree);
  return pin;
}
function transform(path, text) {
  let s = text;
  const kernel = path.endsWith("/cloth/solver.ts") || path.endsWith("/cloth/solver.js") ? "cloth" : path.endsWith("/fluid/pbf.ts") || path.endsWith("/fluid/pbf.js") ? "pbf" : null;
  if (kernel) {
    const anchor = kernel === "cloth" ? "const p = positions, dt = CLOTH_PROFILE.dt;" : "this.obstacleHits = 0;";
    assert.equal(s.split(anchor).length, 2, path);
    return s.replace(anchor, `globalThis.__p5Baseline.kernel('${kernel}');
` + anchor);
  }
  const kind = path.endsWith("/cloth/world.ts") || path.endsWith("/cloth/world.js") ? "cloth" : path.endsWith("/fluid/world.ts") || path.endsWith("/fluid/world.js") ? "fluid" : path.endsWith("/fluid/cad-world.ts") || path.endsWith("/fluid/cad-world.js") ? "cad" : null;
  if (!kind) return text;
  const name = { cloth: "BoundedClothWorld", fluid: "BoundedFluidWorld", cad: "BoundedCadFluidWorld" }[kind];
  const re = new RegExp(`class ${name}[^\\{]*\\{`);
  assert.equal([...s.matchAll(new RegExp(re.source, "g"))].length, 1, path);
  s = s.replace(re, (m) => m + `
__p5BaselineCtor = globalThis.__p5Baseline.constructed(this, '${kind}');
`);
  const step = /^\s*step\(fixedStepSeconds[^\{]*\{/m;
  assert.equal([...s.matchAll(new RegExp(step.source, "gm"))].length, 1, path);
  s = s.replace(step, (m) => m + `
globalThis.__p5Baseline.enter(this, '${kind}');
`);
  const old = kind === "cloth" ? "positionsM: sheet.positions.slice()" : kind === "fluid" ? "positionsM: this.positions.slice()" : "...this.world.getState(), obstacleHits:";
  assert.equal(s.split(old).length, 2, path);
  const replacement = kind === "cloth" ? `positionsM: globalThis.__p5Baseline.copy(this, 'cloth-copy', () => sheet.positions.slice())` : kind === "fluid" ? `positionsM: globalThis.__p5Baseline.copy(this, 'fluid-copy', () => this.positions.slice())` : `...globalThis.__p5Baseline.copy(this, 'cad-outer-copy', () => this.world.getState()), obstacleHits:`;
  s = s.replace(old, replacement);
  if (kind !== "cad") {
    assert.equal(s.split("this.stepIndex++;").length, 2, path);
    s = s.replace("this.stepIndex++;", `this.stepIndex++; globalThis.__p5Baseline.committed(this, '${kind}');`);
  }
  return s;
}
async function provider(graph, out, pin) {
  if (graph === "source") {
    const { build } = await import(pathToFileURL(resolve(ROOT, "node_modules/esbuild/lib/main.js")).href);
    const entry = ["export * as root from " + JSON.stringify(resolve(ROOT, "packages/barocss-physics/src/index.ts")) + ";", ...["cloth", "fluid", "fluid-cad"].map((n) => "export * as " + { "cloth": "cloth", "fluid": "fluid", "fluid-cad": "cad" }[n] + " from " + JSON.stringify(resolve(ROOT, `packages/barocss-physics/src/${n}.ts`)) + ";")].join("\n");
    const result = await build({ stdin: { contents: entry, resolveDir: ROOT, sourcefile: "p5-baseline-entry.mjs" }, bundle: true, format: "esm", platform: "node", target: "node22", write: false, metafile: true, plugins: [{ name: "p5-baseline-owned-overlay", setup(b) {
      b.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: resolve(ROOT, "packages/barocss-cad/src/index.ts") }));
      b.onLoad({ filter: /\.(ts|js)$/ }, async (a) => {
        const key = relative(ROOT, a.path);
        assert(pin.files[key], `unfrozen source input ${key}`);
        const original = await readFile(a.path, "utf8");
        const source = transform(a.path, original);
        return { contents: source, loader: a.path.endsWith(".ts") ? "ts" : "js" };
      });
    } }] });
    for (const p of Object.keys(result.metafile.inputs)) if (p !== "p5-baseline-entry.mjs") assert(pin.files[p], `unfrozen graph ${p}`);
    const bundle = result.outputFiles[0].contents;
    assert(bundle.length <= 16 * 1024 * 1024);
    const path = resolve(out, "source-overlay.mjs");
    await writeFile(path, bundle, { flag: "wx" });
    await writeFile(resolve(out, "source-graph.json"), json({ sha256: sha(bundle), inputs: result.metafile.inputs }), { flag: "wx" });
    return import(pathToFileURL(path).href);
  }
  let total = 0;
  for (const pkg of ["physics", "cad"]) {
    const dir = resolve(out, "provider", `barocss-${pkg}`);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, "package.json"), json({ type: "module", exports: { ".": "./dist/index.js" } }), { flag: "wx" });
    for (const src of await files(resolve(ROOT, `packages/barocss-${pkg}/dist`))) {
      const b = await readFile(src);
      total += b.length;
      assert(total <= 32 * 1024 * 1024, "native provider storage bound");
      const dest = resolve(dir, relative(resolve(ROOT, `packages/barocss-${pkg}`), src));
      await mkdir(dirname(dest), { recursive: true });
      const t = src.endsWith(".js") ? Buffer.from(transform(src, b.toString())) : b;
      await writeFile(dest, t, { flag: "wx" });
    }
  }
  const cadLink = resolve(out, "provider/node_modules/@barocss/cad");
  await mkdir(cadLink, { recursive: true });
  await writeFile(resolve(cadLink, "package.json"), json({ type: "module", exports: { ".": "./index.js" } }), { flag: "wx" });
  await writeFile(resolve(cadLink, "index.js"), `export * from '../../../barocss-cad/dist/index.js';
`, { flag: "wx" });
  const base = resolve(out, "provider/barocss-physics/dist");
  const [root, cloth, fluid, cad] = await Promise.all(["index.js", "cloth.js", "fluid.js", "fluid-cad.js"].map((x) => import(pathToFileURL(resolve(base, x)).href)));
  await writeFile(resolve(out, "native-graph.json"), json({ mode: "native-unbundled-staged-published-dist", providerBytes: total, inputs: Object.keys(pin.files).filter((x) => x.includes("/dist/")) }), { flag: "wx" });
  return { root, cloth, fluid, cad };
}
async function child(graph, out) {
  let bytes = 0;
  const counts = { constructors: 0, constructorKinds: { cloth: 0, fluid: 0, cad: 0 }, stepEntries: 0, stepKinds: { cloth: 0, fluid: 0, cad: 0 }, kernelCommits: 0, clothSolverCalls: 0, pbfCalls: 0, publicCreationAttempts: 0, commonCreationAttempts: 0, commonReturnedWorlds: 0, publicStepAttempts: 0, publicStepReturns: 0, injectedThrows: 0, cleanupAttempts: 0, cleanupCompleted: 0 };
  const refs = [], owned = [];
  let armed = null, firstUnexpected = null;
  const record = async (name, value) => {
    const b = json(value);
    bytes += Buffer.byteLength(b);
    assert(bytes <= 4 * 1024 * 1024, "evidence output cap");
    await writeFile(resolve(out, name), b, { flag: "wx" });
  };
  const fs = await import("node:fs");
  const durable = () => fs.writeFileSync(resolve(out, "progress.json"), json({ counts }));
  globalThis.__p5Baseline = { kernel(k) {
    if (k === "cloth") counts.clothSolverCalls++;
    else counts.pbfCalls++;
    durable();
  }, constructed(o, k) {
    counts.constructors++;
    counts.constructorKinds[k]++;
    refs.push({ o, k });
    durable();
  }, committed(o, k) {
    counts.kernelCommits++;
    durable();
  }, enter(o, k) {
    counts.stepEntries++;
    counts.stepKinds[k]++;
    durable();
  }, copy(o, site, copy) {
    if (armed && armed.o === o && armed.site === site) {
      const error = armed.error;
      armed = null;
      counts.injectedThrows++;
      durable();
      throw error;
    }
    return copy();
  } };
  const snap = (s) => ({ stepIndex: s.stepIndex, timeSeconds: s.timeSeconds, positionsBytes: s.positionsM.byteLength, positionsF64LEHostHex: Buffer.from(s.positionsM.buffer, s.positionsM.byteOffset, s.positionsM.byteLength).toString("hex"), velocitiesF64LEHostHex: Buffer.from(s.velocitiesMps.buffer, s.velocitiesMps.byteOffset, s.velocitiesMps.byteLength).toString("hex"), positionsSha256: sha(Buffer.from(s.positionsM.buffer, s.positionsM.byteOffset, s.positionsM.byteLength)), velocitiesSha256: sha(Buffer.from(s.velocitiesMps.buffer, s.velocitiesMps.byteOffset, s.velocitiesMps.byteLength)), diagnostics: s.diagnostics, obstacleHits: s.obstacleHits ?? null });
  try {
    const pin = await authenticate();
    const m = await provider(graph, out, pin);
    await authenticate();
    const source = await readFile(resolve(ROOT, "examples/physics-scene/fluid-cad-shelf.barocad"), "utf8");
    const current = { sourceText: source, currentRevision: "shelfRev1" };
    const request = { sourceVersion: 0, sourceRevision: "shelfRev1", modelId: "fluid_shelf", surfaceId: "shelf", kind: "static", proxy: "box", minimumHalfExtentM: 0.01 };
    const water = (v) => {
      const initialPositionsM = [];
      for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) initialPositionsM.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
      return { format: "barocss-fluid-scene", version: v, revision: "waterRev1", basis: "right-handed-xyz-metres", fixedStepSeconds: 1 / 120, gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM, ...v === 2 ? { visualViscosity: { kind: "xsph", coefficient: 0.15 } } : {} };
    };
    const create = (kind) => {
      counts.publicCreationAttempts++;
      durable();
      let w;
      if (kind === "cloth") w = m.cloth.createClothWorld({ format: "barocss-cloth-scene", version: 1, revision: "clothRev1", basis: "right-handed-xyz-metres", fixedStepSeconds: 1 / 120, profile: "pinned-sheet-sphere-v1" });
      else if (kind.startsWith("cad")) w = m.cad.createCadFluidWorld(water(1), source, request);
      else w = m.fluid.createFluidWorld(water(kind === "fluid-xsph" ? 2 : 1));
      owned.push(w);
      return w;
    };
    const step = (w, kind) => {
      counts.publicStepAttempts++;
      durable();
      const r = kind.startsWith("cad") ? w.step(1 / 120, current) : w.step(1 / 120);
      counts.publicStepReturns++;
      durable();
      return r;
    };
    for (const kind of ["cloth", "fluid", "fluid-xsph", "cad-inner", "cad-outer"]) {
      const begin = refs.length;
      const target = create(kind), targetRefs = refs.slice(begin);
      const control = create(kind);
      const before = target.getState();
      assert.equal(before.stepIndex, 0);
      await record(`case-${kind}-start.json`, { kind, before: snap(before), counts: structuredClone(counts) });
      const site = kind === "cloth" ? "cloth-copy" : kind === "cad-outer" ? "cad-outer-copy" : "fluid-copy";
      const object = kind === "cad-inner" ? targetRefs.find((x) => x.k === "fluid").o : target;
      const error = new Error(`P5_BASELINE_SYNTHETIC_COPY_FAILURE:${kind}`);
      armed = { o: object, site, error };
      let thrown;
      try {
        step(target, kind);
      } catch (e) {
        thrown = e;
      }
      assert.equal(thrown, error, "exact synthetic error identity");
      assert.equal(armed, null, "fault must fire exactly once");
      const after = target.getState();
      assert.equal(after.stepIndex, 1);
      assert.equal(after.timeSeconds, 1 / 120);
      const c1 = step(control, kind);
      assert.deepEqual(after, c1, "current failure committed exactly the normal first state");
      const next = step(target, kind), c2 = step(control, kind);
      assert.deepEqual(next, c2, "continuation follows committed step1, not rollback");
      assert.equal(next.stepIndex, 2);
      await record(`case-${kind}.json`, { status: "PASS_REPRODUCED_KNOWN_ATOMICITY_NO_GO", kind, site, firstThrown: { name: thrown.name, message: thrown.message, sameObject: true, synthetic: true }, before: snap(before), after: snap(after), next: snap(next), neverFailedControl: snap(c2), exactStateEquality: true, claim: "synthetic return-copy boundary throw; not actual allocator exhaustion; no new physical accuracy claim" });
    }
    const model = { format: "barocss-physics-model", version: 1, revision: "p5ProfileRefusal1", frame: { id: "world", basis: "right-handed-xyz", rotation: "local-to-world-xyzw" }, units: { length: "m", mass: "kg", time: "s", angle: "rad" }, gravityMps2: [0, -9.81, 0], bodies: [], colliders: [], joints: [], cloths: [], fluids: [], sourceBindings: [] };
    for (const profile of ["cloth-pinned-sphere-visual-v1", "fluid-basin-visual-v1", "fluid-basin-xsph-visual-v1", "fluid-static-box-visual-v1"]) {
      counts.commonCreationAttempts++;
      durable();
      let e, w;
      try {
        w = m.root.createPhysicsWorld(model, { profile, fixedStepSeconds: 1 / 120, broadPhase: "domain-fixed" });
        counts.commonReturnedWorlds++;
        owned.push(w);
      } catch (x) {
        e = x;
      }
      assert(e instanceof m.root.PhysicsError);
      assert.equal(e.code, "INVALID_CONFIG");
      assert.match(e.message, /profile is not implemented/);
      await record(`refusal-${profile}.json`, { status: "PASS_CURRENT_PROFILE_REFUSAL", profile, error: { code: e.code, message: e.message }, scope: "profile dispatch rejects before body/domain validation; not proof of a valid full P5 fixture or recording admission" });
    }
    assert.equal(counts.constructors, 14);
    assert.deepEqual(counts.constructorKinds, { cloth: 2, fluid: 8, cad: 4 });
    assert.equal(counts.stepEntries, 28);
    assert.equal(counts.kernelCommits, 20);
    assert.equal(counts.clothSolverCalls, 4);
    assert.equal(counts.pbfCalls, 16);
    assert.deepEqual(counts.stepKinds, { cloth: 4, fluid: 16, cad: 8 });
    assert.equal(counts.publicCreationAttempts, 10);
    assert.equal(counts.publicStepAttempts, 20);
    assert.equal(counts.publicStepReturns, 15);
    assert.equal(counts.injectedThrows, 5);
    assert.equal(counts.commonCreationAttempts, 4);
    assert.equal(counts.commonReturnedWorlds, 0);
    await authenticate();
  } catch (e) {
    firstUnexpected = { name: e?.name, message: e?.message, stack: e?.stack };
  } finally {
    armed = null;
    for (const w of owned.reverse()) {
      counts.cleanupAttempts++;
      durable();
      try {
        w.dispose();
        counts.cleanupCompleted++;
      } catch (e) {
        firstUnexpected ??= { name: e?.name, message: e?.message, phase: "cleanup" };
      }
      durable();
    }
    delete globalThis.__p5Baseline;
  }
  if (!firstUnexpected && (counts.cleanupAttempts !== 10 || counts.cleanupCompleted !== 10)) firstUnexpected = { phase: "cleanup-counts", message: "expected 10 complete top-level cleanups" };
  await record("summary.json", { status: firstUnexpected ? "FAIL" : "PASS_REPRODUCED_P5A_CURRENT_ATOMICITY_NO_GO", graph, counts, firstUnexpected, accuracyClaim: false, recorderModelSize: "NOT_MEASURED", browser: "NOT_RUN" });
  if (firstUnexpected) process.exitCode = 1;
}
async function main() {
  if (process.argv[2] === "--child") {
    const [graph2, out2] = process.argv.slice(3);
    assert(["source", "emitted"].includes(graph2));
    await child(graph2, out2);
    return;
  }
  const args = process.argv.slice(2);
  assert.equal(args.length, 5, "usage: baseline.mjs --run-id FRESH --graph source|emitted --authorize-baseline");
  assert.equal(args[0], "--run-id");
  assert.equal(args[2], "--graph");
  assert.equal(args[4], "--authorize-baseline");
  const id = args[1], graph = args[3];
  assert(idOK(id) && ["source", "emitted"].includes(graph));
  assert(/^v22\./.test(process.version), "Node22 required");
  assert.equal(new Uint8Array(new Uint16Array([1]).buffer)[0], 1, "raw host-byte evidence requires little endian");
  assert(!process.env.ESBUILD_BINARY_PATH, "external esbuild binary override refused");
  const pin = await authenticate();
  const out = resolve(HERE, "evidence", id);
  await mkdir(resolve(HERE, "evidence"), { recursive: true });
  await mkdir(out, { recursive: false });
  const command = [process.execPath, fileURLToPath(import.meta.url), "--child", graph, out];
  await writeFile(resolve(out, "start.json"), json({ command, start: (/* @__PURE__ */ new Date()).toISOString(), timeoutMs: 18e4, cleanupMaxMs: 2e3, pinsSha256: sha(await readFile(resolve(HERE, "BASELINE-PROVIDERS.json"))), inputs: pin.files }), { flag: "wx" });
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
  }, Math.max(0, 180000 - Number(process.hrtime.bigint() - spawnClock) / 1e6));
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
  const pass = !timedOut && !overflow && exit.code === 0 && closed && stdoutEOF && stderrEOF && groupAbsent && !exit.pipeError && !exit.spawnError && summary?.status === "PASS_REPRODUCED_P5A_CURRENT_ATOMICITY_NO_GO";
  await writeFile(resolve(out, "exit.json"), json({ ...exit, timedOut, overflow, closed, stdoutEOF, stderrEOF, groupAbsent, signals, status: pass ? "PASS_REPRODUCED_KNOWN_ATOMICITY_NO_GO" : "FAIL", progressPath: "progress.json", summaryPath: summary ? "summary.json" : null, end: (/* @__PURE__ */ new Date()).toISOString() }), { flag: "wx" });
  if (!pass) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
