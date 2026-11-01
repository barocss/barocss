import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { transform } from "../../node_modules/esbuild/lib/main.js";
import { instrumentKernel } from "./kernel-instrument.mjs";
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, "../..");
const paths = ["cloth/topology", "cloth/solver", "cloth/constraints", "cloth/metrics", "fluid/pbf", "fluid/diagnostics", "fluid/kernel", "fluid/boundary", "fluid/static-box", "fluid/visual-viscosity", "identity", "domain/cloth", "domain/fluid"];
const checked = [];
for (const mode of ["src", "dist"]) for (const part of paths) {
  if (mode === "dist" && part.startsWith("domain/")) continue;
  const path = resolve(root, `packages/barocss-physics/${mode}/${part}.${mode === "src" ? "ts" : "js"}`), bytes = await readFile(path);
  const result = instrumentKernel(path, bytes.toString());
  assert(result.changed, path);
  await transform(result.source, { loader: mode === "src" ? "ts" : "js", target: "node22", format: "esm" });
  checked.push({ path: path.slice(root.length + 1), sha256: createHash("sha256").update(bytes).digest("hex"), overlaySyntax: "PASS" });
}
const receipt = { status: "PASS_SOURCE_TEXT_OVERLAY_COMPILE_ONLY", command: process.argv, checked, providerImports: 0, modelConstructions: 0, kernelCalls: 0, baselineCalls: 0, nativeNewStageEmission: "NOT_RUN", existingTypeCheck: { command: ["/Users/user/.volta/tools/image/node/22.19.0/bin/node", "node_modules/typescript/bin/tsc", "-p", "packages/barocss-physics/tsconfig.json", "--noEmit"], exit: 0, gate: "NOT_ACQUIRED_PROCESS_POLICY_MISS_REPORTED_TO_PARENT; not rerun for acknowledgement" } };
await writeFile(resolve(here, "kernel-source-check-02.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
