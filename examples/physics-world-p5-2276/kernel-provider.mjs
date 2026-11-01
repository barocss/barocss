import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { instrumentKernel } from "./kernel-instrument.mjs";
const sha = (b) => createHash("sha256").update(b).digest("hex");
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    assert(!e.isSymbolicLink());
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...await files(p));
    else if (e.isFile()) out.push(p);
  }
  return out.sort();
}
async function prepareKernelProvider({ root, out, graph, pins, write }) {
  const entries = ["domain/cloth", "domain/fluid", "cloth/topology", "cloth/profile", "fluid/constants", "identity"];
  const graphPins = {};
  const forbidden = (path) => /\/(?:world|cad-[^/]*|replay[^/]*|recording-owner)\.[jt]s$/.test(path);
  if (graph === "source") {
    const { build } = await import(pathToFileURL(resolve(root, "node_modules/esbuild/lib/main.js")).href);
    const entry = entries.map((x) => `export * from ${JSON.stringify(resolve(root, `packages/barocss-physics/src/${x}.ts`))};`).join("\n");
    const result = await build({ absWorkingDir: root, stdin: { contents: entry, resolveDir: root, sourcefile: "p5-kernel-entry.mjs" }, bundle: true, platform: "node", format: "esm", target: "node22", write: false, metafile: true, plugins: [{ name: "isolated-p5-kernel-observation", setup(b) {
      b.onLoad({ filter: /\.(ts|js)$/ }, async (a) => {
        const key = relative(root, a.path);
        assert(!forbidden(a.path), `forbidden stage input ${key}`);
        const p = pins[key];
        assert(p, `unfrozen stage input ${key}`);
        const bytes = await readFile(a.path);
        assert.equal(sha(bytes), p.sha256, key);
        const t = instrumentKernel(a.path, bytes.toString());
        graphPins[key] = { originalSha256: sha(bytes), effectiveSha256: sha(t.source), observed: t.changed };
        return { contents: t.source, loader: a.path.endsWith(".ts") ? "ts" : "js" };
      });
    } }] });
    assert(result.outputFiles[0].contents.length <= 8 * 1024 * 1024);
    for (const input of Object.keys(result.metafile.inputs)) if (input !== "p5-kernel-entry.mjs") assert(graphPins[input], `unaccounted source ${input}`);
    const bundle = resolve(out, "kernel-source.mjs");
    await write("kernel-source.mjs", result.outputFiles[0].contents);
    await write("provider-graph.json", JSON.stringify({ mode: "source-private-stage-bundle", inputs: graphPins, bundleSha256: sha(result.outputFiles[0].contents) }, null, 2) + "\n");
    return import(pathToFileURL(bundle).href);
  }
  const dist = resolve(out, "provider/dist");
  await mkdir(dist, { recursive: true });
  const command = [process.execPath, resolve(root, "node_modules/typescript/bin/tsc"), "-p", resolve(root, "packages/barocss-physics/tsconfig.json"), "--outDir", dist];
  await write("compile-command.json", JSON.stringify({ command, cwd: root, noProviderGenerator: true, productionDistWritten: false }, null, 2) + "\n");
  const cp = spawn(command[0], command.slice(1), { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let logs = Buffer.alloc(0), overflow = false;
  for (const stream of [cp.stdout, cp.stderr]) stream.on("data", (b) => {
    const kept = b.subarray(0, Math.max(0, 1048576 - logs.length));
    logs = Buffer.concat([logs, kept]);
    if (kept.length < b.length) {
      overflow = true;
      cp.kill("SIGTERM");
    }
  });
  const exit = await new Promise((accept, reject) => {
    cp.once("error", reject);
    cp.once("close", (code, signal) => accept({ code, signal }));
  });
  await write("compile.log", logs);
  await write("compile-exit.json", JSON.stringify({ ...exit, overflow }, null, 2) + "\n");
  assert.equal(exit.code, 0, "native compile");
  assert(!overflow, "compile output bound");
  await write("provider/package.json", '{"type":"module"}\n');
  let storage = 0;
  for (const path of await files(dist)) {
    const bytes = await readFile(path);
    storage += bytes.length;
    assert(storage <= 32 * 1024 * 1024, "native emission bound");
    if (path.endsWith(".js")) {
      const source = bytes.toString();
      const t = instrumentKernel(path, source);
      if (t.changed) await writeFile(path, t.source);
      graphPins[relative(out, path)] = { originalSha256: sha(bytes), effectiveSha256: sha(t.source), observed: t.changed };
    }
  }
  const visited = /* @__PURE__ */ new Set();
  async function visit(path) {
    if (visited.has(path)) return;
    visited.add(path);
    assert(!forbidden(path), `forbidden native stage input ${path}`);
    const text = await readFile(path, "utf8");
    for (const m of text.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      assert(m[1].startsWith("."), `non-relative native stage import ${m[1]}`);
      const next = resolve(dirname(path), m[1]);
      assert(next.startsWith(dist + "/"));
      await visit(next);
    }
  }
  for (const entry of entries) await visit(resolve(dist, entry + ".js"));
  await write("provider-graph.json", JSON.stringify({ mode: "native-unbundled-separate-tsc-outDir", storage, inputs: graphPins, actualClosure: [...visited].map((x) => relative(out, x)).sort() }, null, 2) + "\n");
  const modules = [];
  for (const entry of entries) modules.push(await import(pathToFileURL(resolve(dist, entry + ".js")).href));
  return Object.assign({}, ...modules);
}
export {
  prepareKernelProvider
};
