import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { buildKernelModels } from "./kernel-fixture.mjs";
import { prepareKernelProvider } from "./kernel-provider.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../..");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = (x) => JSON.stringify(x, null, 2) + "\n";
const raw = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const bits = (n) => {
  const b = Buffer.allocUnsafe(8);
  b.writeDoubleLE(n);
  return b.toString("hex");
};
function fingerprint(value) {
  if (typeof value === "number") return "n" + bits(value);
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (ArrayBuffer.isView(value)) return value.constructor.name + ":" + raw(value).toString("hex");
  if (Array.isArray(value)) return "[" + value.map(fingerprint).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + fingerprint(value[k])).join(",") + "}";
}
async function evidenceBytes(dir) {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    assert(!e.isSymbolicLink(), "unexpected evidence symlink");
    const path = resolve(dir, e.name);
    if (e.isDirectory()) total += await evidenceBytes(path);
    else if (e.isFile()) total += (await readFile(path)).length;
  }
  return total;
}
async function pinFile(path, pin) {
  const b = await readFile(resolve(ROOT, path));
  assert.equal(b.length, pin.bytes, path);
  assert.equal(sha(b), pin.sha256, path);
  return b;
}
async function authenticate(freezePath, freezeSha) {
  const freezeBytes = await readFile(freezePath);
  assert.equal(sha(freezeBytes), freezeSha, "execution freeze hash");
  const freeze = JSON.parse(freezeBytes);
  assert(freeze.files && Object.keys(freeze.files).length > 10, "parent must freeze full owned closure");
  for (const [path, pin] of Object.entries(freeze.files)) await pinFile(path, pin);
  const recipe = JSON.parse(await readFile(resolve(HERE, "KERNEL-RECIPES.json"), "utf8"));
  const needed = ["KERNEL-CONTRACT.md", "KERNEL-RECIPES.json", "kernel-implementation-freeze-01.json", "KERNEL-CLARIFICATION-01.json", "KERNEL-CLARIFICATION-02.json", "static-input-results.json", "kernel-trial.mjs", "kernel-provider.mjs", "kernel-fixture.mjs", "kernel-instrument.mjs", "kernel-run.mjs"];
  for (const name of needed) assert(freeze.files[relative(ROOT, resolve(HERE, name))], `missing execution pin ${name}`);
  for (const name of ["types", "cloth", "fluid"]) assert(freeze.files[`packages/barocss-physics/src/domain/${name}.ts`]);
  for (const [path, pin] of Object.entries({ ...recipe.authorityPins, ...recipe.capturedBaselinePins })) await pinFile(path, pin);
  const original = JSON.parse(await readFile(resolve(HERE, "BASELINE-PROVIDERS.json"), "utf8"));
  for (const [path, pin] of Object.entries(original.files)) await pinFile(path, pin);
  const staticResult = JSON.parse(await readFile(resolve(HERE, "static-input-results.json"), "utf8"));
  await pinFile(staticResult.receipt.path, staticResult.receipt);
  assert(freeze.files[staticResult.receipt.path], "actual native operand receipt must be pinned");
  assert.equal(staticResult.counts.WorldCalls, 0);
  assert.equal(staticResult.counts.candidateCalls, 0);
  assert.deepEqual(staticResult.effectiveShelf.centerM.map(bits), staticResult.effectiveShelf.positionF64LE);
  assert.deepEqual(staticResult.effectiveShelf.halfExtentsM.map(bits), staticResult.effectiveShelf.halfExtentsF64LE);
  const smoothing = JSON.parse(await readFile(resolve(HERE, "KERNEL-CLARIFICATION-01.json"), "utf8"));
  return { recipe, staticBox: staticResult.effectiveShelf, smoothing, pins: { ...original.files, ...freeze.files } };
}
function compareOutput(output, reference, cloth) {
  for (const [field, key] of [["positionsM", "positionsF64LEHostHex"], ["velocitiesMps", "velocitiesF64LEHostHex"]]) {
    const actual = raw(output[field]);
    assert.equal(actual.toString("hex"), reference[key], field + " raw bit parity");
    assert.equal(sha(actual), reference[field === "positionsM" ? "positionsSha256" : "velocitiesSha256"]);
    assert(output[field].every(Number.isFinite), "nonfinite output");
  }
  const diagnostics = { ...output.diagnostics };
  if (!cloth) {
    assert.equal(diagnostics.obstacleHits, reference.obstacleHits ?? 0);
    delete diagnostics.obstacleHits;
  }
  assert.equal(fingerprint(diagnostics), fingerprint(reference.diagnostics), "diagnostic bit parity");
}
function snap(output) {
  return { id: output.id, positionsF64LE: raw(output.positionsM).toString("hex"), velocitiesF64LE: raw(output.velocitiesMps).toString("hex"), positionsSha256: sha(raw(output.positionsM)), velocitiesSha256: sha(raw(output.velocitiesMps)), diagnostics: output.diagnostics };
}
async function main() {
  const [graph, out, freezePath, freezeSha, token] = process.argv.slice(2);
  assert.equal(token, "--authorized-child");
  assert(["source", "emitted"].includes(graph));
  assert(/^v22\./.test(process.version));
  assert.equal(new Uint8Array(new Uint16Array([1]).buffer)[0], 1, "little endian raw authority");
  let written = 0, firstFailure = null, armed = null, phase = "import", currentProfile = null;
  const counts = {}, completed = [];
  let recipe;
  const progress = () => writeFileSync(resolve(out, "progress.json"), json({ counts, completed, currentProfile, phase, armed: armed?.site ?? null }));
  const hit = (name) => {
    if (name === "clothDiagnostics") name = phase === "initialize" ? "clothInitialDiagnostics" : "clothPrepareDiagnostics";
    if (name === "fluidDiagnostics") name = phase === "initialize" ? "fluidInitialDiagnostics" : "fluidPrepareDiagnostics";
    counts[name] = (counts[name] ?? 0) + 1;
    if (!["clothProjectDistance", "clothProjectSphere", "densities", "pbfProjectDensity", "xsphBlend"].includes(name)) progress();
  };
  const write = async (name, data) => {
    const b = typeof data === "string" || Buffer.isBuffer(data) || data instanceof Uint8Array ? data : json(data);
    written += Buffer.byteLength(b);
    assert(written <= 20 * 1024 * 1024, "authored output20MiB + native32MiB + wrapper4MiB leaves8MiB reserve");
    await writeFile(resolve(out, name), b, { flag: "wx" });
  };
  globalThis.__p5Kernel = { hit, fault(site) {
    if (armed?.site === site) {
      const error = armed.error;
      armed = null;
      hit("injectedThrows");
      throw error;
    }
  } };
  try {
    const auth = await authenticate(resolve(freezePath), freezeSha);
    recipe = auth.recipe;
    for (const name of Object.keys(recipe.perGraphCounts)) counts[name] = 0;
    for (const name of Object.keys(recipe.furtherHelperCountsPerGraph)) if (name !== "note") counts[name] = 0;
    counts.outputCopies = 0;
    const m = await prepareKernelProvider({ root: ROOT, out, graph, pins: auth.pins, write });
    await authenticate(resolve(freezePath), freezeSha);
    assert.equal(bits(m.FLUID_SMOOTHING_RADIUS_M), auth.smoothing.effectivePrivateFixture.f64le, "exact selected original smoothing bits");
    const models = buildKernelModels(m, auth.staticBox, hit);
    phase = "model-size";
    for (const fixture of models) {
      const encoded = m.canonicalEncode(fixture.model);
      await write(`model-size-${fixture.profile}.json`, { profile: fixture.profile, canonicalModelBytes: encoded.length, sha256: sha(encoded), withinRecorderModelCap: encoded.length <= 131072, recordingAdmission: "NOT_TESTED", numericInitializationAlreadyDeclared: true });
    }
    for (let index = 0; index < models.length; index++) {
      const fixture = models[index], r = recipe.profiles[index];
      assert.equal(fixture.profile, r.profile);
      currentProfile = r.profile;
      const captured = JSON.parse(await readFile(resolve(HERE, `evidence/baseline-${graph}-01/case-${r.baselineCase}.json`), "utf8"));
      if (r.additionalDataAliasCase) {
        const alias = JSON.parse(await readFile(resolve(HERE, `evidence/baseline-${graph}-01/case-${r.additionalDataAliasCase}.json`), "utf8"));
        assert.deepEqual(alias.after, captured.after);
        assert.deepEqual(alias.next, captured.next);
      }
      const cloth = fixture.model.cloths.length === 1, initialize = cloth ? m.initializeCloth : m.initializeFluid, prepare = cloth ? m.prepareCloth : m.prepareFluid;
      const modelBefore = fingerprint(fixture.model);
      phase = "initialize";
      hit("initializations");
      const initialized = initialize(cloth ? fixture.model.cloths[0] : fixture.model.fluids[0], fixture.staticData);
      assert.equal(fingerprint(fixture.model), modelBefore);
      const definitionBefore = fingerprint(initialized.definition);
      const initialBefore = fingerprint(initialized.initial);
      const submittedDomain = cloth ? fixture.model.cloths[0] : fixture.model.fluids[0];
      const submittedX = submittedDomain.initialPositionsM[0][0];
      submittedDomain.initialPositionsM[0][0] = 123;
      assert.equal(fingerprint(initialized.definition), definitionBefore, "definition detached from submitted model");
      assert.equal(fingerprint(initialized.initial), initialBefore, "initial buffers detached from submitted model");
      submittedDomain.initialPositionsM[0][0] = submittedX;
      assert.equal(fingerprint(fixture.model), modelBefore);
      const call = (accepted) => {
        phase = "prepare";
        hit("prepareAttempts");
        const result = prepare(initialized.definition, accepted);
        hit("prepareReturns");
        return result;
      };
      const s1 = call(initialized.initial);
      hit("nominalOutputs");
      assert.equal(fingerprint(initialized.initial), initialBefore);
      compareOutput(s1.output, captured.after, cloth);
      const acceptedBefore = fingerprint(s1.candidate), s2 = call(s1.candidate);
      hit("nominalOutputs");
      compareOutput(s2.output, captured.next, cloth);
      assert.equal(fingerprint(s1.candidate), acceptedBefore);
      assert.equal(fingerprint(initialized.definition), definitionBefore);
      await write(`nominal-${r.profile}.json`, { status: "PASS_CAPTURED_TWO_STEP_PARITY", profile: r.profile, after: snap(s1.output), next: snap(s2.output), clock: "external labels1/2 only" });
      for (const site of ["mid-kernel", "post-diagnostic", "prepare-position-copy"]) {
        const error = new Error(`P5_KERNEL_SYNTHETIC:${r.profile}:${site}`);
        armed = { site, error };
        progress();
        let caught;
        try {
          call(s1.candidate);
        } catch (e) {
          caught = e;
        }
        assert.equal(caught, error, "exact unmodified thrown object");
        assert.equal(armed, null, "exactly one injected fault");
        assert.equal(fingerprint(s1.candidate), acceptedBefore, "accepted retention");
        assert.equal(fingerprint(initialized.definition), definitionBefore);
        assert.equal(fingerprint(fixture.model), modelBefore);
        const recovered = call(s1.candidate);
        hit("recoveryOutputs");
        assert.equal(fingerprint(recovered), fingerprint(s2), "never-failed candidate and output control equality");
        compareOutput(recovered.output, captured.next, cloth);
        const candidateBefore = fingerprint(recovered.candidate);
        assert.notEqual(recovered.output.positionsM.buffer, recovered.candidate.positions.buffer);
        assert.notEqual(recovered.candidate.positions.buffer, s1.candidate.positions.buffer);
        recovered.output.positionsM[0] = 123;
        recovered.output.velocitiesMps[0] = 456;
        recovered.output.diagnostics[Object.keys(recovered.output.diagnostics)[0]] = 789;
        assert.equal(fingerprint(recovered.candidate), candidateBefore, "output copy isolation");
        assert.equal(fingerprint(s1.candidate), acceptedBefore);
        assert.equal(fingerprint(initialized.definition), definitionBefore);
        await write(`failure-${r.profile}-${site}.json`, { status: "PASS_CANDIDATE_FAILURE_RETENTION_AND_CONTINUATION", site, exactThrownIdentity: true, error: { name: caught.name, message: caught.message }, acceptedFingerprint: sha(acceptedBefore), definitionFingerprint: sha(definitionBefore), modelFingerprint: sha(modelBefore), expectedRecovered: snap(s2.output), outputCopyIsolation: true, counts: structuredClone(counts) });
      }
      completed.push(r.profile);
      progress();
    }
    for (const [name, expected] of Object.entries(recipe.perGraphCounts)) assert.equal(counts[name], expected, name);
    for (const [name, expected] of Object.entries(recipe.furtherHelperCountsPerGraph)) if (name !== "note") assert.equal(counts[name], expected, name);
    assert.equal(counts.outputCopies, 20, "fully prepared output copies");
    const actualEvidenceBytes = await evidenceBytes(out);
    assert(actualEvidenceBytes <= 52 * 1024 * 1024, "bounded evidence leaves wrapper logs and emergency reserve");
    await write("resource-summary.json", { actualEvidenceBytes, authoredWrites: written, nativeEmissionCap: 33554432, wrapperLogReserve: 4194304, totalCap: 67108864 });
    await authenticate(resolve(freezePath), freezeSha);
  } catch (error) {
    firstFailure = { name: error?.name, message: error?.message, stack: error?.stack, phase, currentProfile, counts: structuredClone(counts) };
  } finally {
    armed = null;
    delete globalThis.__p5Kernel;
    progress();
  }
  const summary = { status: firstFailure ? "FAIL" : "PASS_P5A_CLOCK_FREE_CANDIDATE_EXTRACTION", graph, counts, completed, firstFailure, comparison: "captured two-step parity and candidate ownership only", diagnosticZeroSignAuthority: "captured diagnostic JSON did not preserve unknown historical zero signs; no historical binary diagnostic equivalence claim", WorldCalls: 0, recordingAdmission: "NOT_TESTED", browser: "NOT_RUN" };
  await writeFile(resolve(out, "summary.json"), json(summary), { flag: "wx" });
  if (firstFailure) process.exitCode = 1;
}
await main();
