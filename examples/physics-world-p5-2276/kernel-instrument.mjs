import assert from "node:assert/strict";
const H = "globalThis.__p5Kernel";
function replaceOne(source, pattern, replacement, label) {
  const re = typeof pattern === "string" ? new RegExp(pattern, "m") : pattern;
  assert.equal([...source.matchAll(new RegExp(re.source, "gm"))].length, 1, `unique overlay anchor ${label}`);
  return source.replace(re, replacement);
}
function instrumentKernel(path, source) {
  let s = source;
  const tail = path.replaceAll("\\", "/");
  const match = (ending) => tail.endsWith(ending + ".ts") || tail.endsWith(ending + ".js");
  const entry = (name, pattern) => {
    s = replaceOne(s, pattern, (m) => m + `
${H}.hit('${name}');
`, path + ":" + name);
  };
  const func = (name, count = name) => entry(count, `^export function ${name}\\([^\\{]*\\{`);
  if (match("/cloth/topology")) func("createSheet");
  if (match("/cloth/solver")) {
    entry("clothSolverConstructions", "^export class ClothSolver[^\\{]*\\{");
    s = s.replace(`${H}.hit('clothSolverConstructions');`, `__p5Construction = ${H}.hit('clothSolverConstructions');`);
    entry("clothSolverCalls", "^\\s*step\\(sheet[^\\{]*\\{");
    s = replaceOne(s, /for\s*\(const constraint of sheet\.constraints\)\s*projectDistance\(sheet,\s*constraint\);/, `for (const constraint of sheet.constraints) { projectDistance(sheet, constraint); ${H}.fault('mid-kernel'); }`, path);
  }
  if (match("/cloth/constraints")) {
    func("projectDistance", "clothProjectDistance");
    func("projectSphere", "clothProjectSphere");
  }
  if (match("/cloth/metrics")) func("clothDiagnostics", "clothDiagnostics");
  if (match("/fluid/pbf")) {
    entry("pbfSolverConstructions", "^export class PbfSolver[^\\{]*\\{");
    s = s.replace(`${H}.hit('pbfSolverConstructions');`, `__p5Construction = ${H}.hit('pbfSolverConstructions');`);
    s = replaceOne(s, /this\.obstacleHits = 0;/, (m) => `${H}.hit('pbfSolverCalls');
` + m, path);
    entry("pbfProjectDensity", "^\\s*(?:private )?projectDensity\\([^\\{]*\\{");
    s = replaceOne(s, /boundaryHits \+= this\.projectDensity\(velocities\);/, (m) => m + `
${H}.fault('mid-kernel');`, path);
  }
  if (match("/fluid/diagnostics")) func("fluidDiagnostics");
  if (match("/fluid/kernel")) {
    func("initialRestDensity");
    func("densities");
  }
  if (match("/fluid/boundary")) func("floorSamples");
  if (match("/fluid/static-box")) func("inflatedBoxBounds");
  if (match("/fluid/visual-viscosity")) func("blendVisualViscosity", "xsphBlend");
  if (match("/identity")) func("canonicalEncode");
  if (match("/domain/cloth")) {
    entry("outputCopies", "^function copyClothCandidateOutput\\([^\\{]*\\{");
    s = s.replace(`${H}.hit('outputCopies');`, `${H}.fault('prepare-position-copy'); ${H}.hit('outputCopies');`);
    s = replaceOne(s, /solver\.step\(candidateSheet,\s*positions,\s*velocities\);/, (m) => m + `
${H}.hit('completeKernelReturns');`, path);
    s = replaceOne(s, /const diagnostics\s*=\s*clothDiagnostics\(candidateSheet\);/, (m) => m + `
${H}.fault('post-diagnostic');`, path);
  }
  if (match("/domain/fluid")) {
    entry("outputCopies", "^function copyFluidCandidateOutput\\([^\\{]*\\{");
    s = s.replace(`${H}.hit('outputCopies');`, `${H}.fault('prepare-position-copy'); ${H}.hit('outputCopies');`);
    s = replaceOne(s, /const \{\s*boundaryHits,\s*obstacleHits\s*\}\s*=\s*solver\.step\(positions,\s*velocities\);/, (m) => m + `
${H}.hit('completeKernelReturns');`, path);
    s = replaceOne(s, /const measured\s*=\s*fluidDiagnostics\(positions,\s*definition\.restDensity,\s*boundaryHits\);/, (m) => m + `
${H}.fault('post-diagnostic');`, path);
  }
  return { source: s, changed: s !== source };
}
export {
  instrumentKernel
};
