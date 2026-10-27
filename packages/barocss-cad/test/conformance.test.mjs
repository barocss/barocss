import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateCadPart, tessellateBrep, exportStep, importStep, checkBrep, brepMassProperties, brepSurfaceArea, subdReport, flatPattern, cutPiece, cutList, checkFit, massPropertiesOf, checkOutput, surfaceAreaOf, flatPatternOf } from '../dist/index.js';
import { openEdges } from '../scripts/rb/stages.mjs';

// Every conformance case (conformance/<step>/*.json) against this kernel: see conformance/README.md.
const root = resolve(import.meta.dirname, '../conformance');
const cases = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(d => readdirSync(join(root, d.name)).filter(f => f.endsWith('.json')).map(f => join(root, d.name, f)));
const base = name => name.replace(/#\d+$/, '');

for (const file of cases) {
  const c = JSON.parse(readFileSync(file, 'utf8'));
  // (A case a later step superseded stays as the record of what that step promised; it is not run.)
  if (c.supersededBy) continue;
  test(`conformance ${c.id}: ${c.about}`, () => {
    assert.equal(`${c.step.toLowerCase()}-${file.split('/').pop().replace(/\.json$/, '')}`, c.id, 'id matches the file');
    if (c.expect.error) {
      assert.throws(() => evaluateCadPart(c.input.partDocument), e => e.code === c.expect.error.code && (c.expect.error.category === undefined || e.details?.category === c.expect.error.category) && e.message.includes(c.expect.error.messageIncludes));
      return;
    }
    const outputs = evaluateCadPart(c.input.partDocument).outputs;
    assert.equal(outputs.length, c.expect.outputs.length, 'outputs');
    c.expect.outputs.forEach((want, k) => {
      const o = outputs[k], m = massPropertiesOf(o), report = checkOutput(o);
      assert.equal(report.valid, true, report.issues[0]);
      assert.ok(Math.abs(m.volume - want.volume.value) <= Math.max(want.volume.relTol * Math.abs(want.volume.value), want.volume.absTol ?? 0), `output ${k} volume ${m.volume} vs ${want.volume.value}`);
      m.centroid.forEach((x, i) => assert.ok(Math.abs(x - want.centroid.value[i]) <= want.centroid.absTol, `output ${k} centroid ${m.centroid} vs ${want.centroid.value}`));
      assert.equal(o.bodyCount, want.bodies, `output ${k} bodies`);
      assert.deepEqual(report.topology.map(t => ({ shells: t.shells, genus: t.genus })), want.topology, `output ${k} topology`);
      const names = o.brep.faces.map(f => base(f.name ?? f.id));
      if (want.faceNames) assert.deepEqual([...new Set(names)].sort(), want.faceNames, `output ${k} face names`);
      if (want.faceNamePattern) assert.ok(names.every(n => new RegExp(want.faceNamePattern).test(n)), `output ${k} face names match ${want.faceNamePattern}`);
      if (want.area) assert.ok(Math.abs(surfaceAreaOf(o) - want.area.value) <= want.area.relTol * want.area.value, `output ${k} area ${surfaceAreaOf(o)} vs ${want.area.value}`);
      if (want.decimate) {
        // A decimated mesh's report (R9, D85): no more triangles than said, the measured distance both ways within its bound.
        assert.ok(o.decimate && o.decimate.trianglesAfter <= want.decimate.trianglesAtMost, `output ${k} decimated to ${o.decimate?.trianglesAfter} triangles`);
        assert.ok(o.decimate.distance.hausdorff <= want.decimate.hausdorffMMAtMost, `output ${k} ${o.decimate.distance.hausdorff} mm from the original`);
      }
      if (want.sheet) {
        // A sheet-metal body's rules and bends (R12, D116): each bend's name, angle and allowance by its definition.
        const r = o.sheet, w = want.sheet;
        assert.ok(r, `output ${k} has no sheet report`);
        assert.deepEqual({ t: r.thickness, r: r.bendRadius, k: r.kFactor, n: r.bends.length }, { t: w.thickness, r: w.bendRadius, k: w.kFactor, n: w.bends.length }, `output ${k} sheet rules`);
        w.bends.forEach((b, i) => {
          assert.equal(r.bends[i].name, b.name);
          assert.ok(Math.abs(r.bends[i].angle - b.angle) <= w.absTol && Math.abs(r.bends[i].allowance - b.allowance) <= w.absTol, `output ${k} ${b.name}: ${r.bends[i].angle}°, BA ${r.bends[i].allowance}`);
        });
      }
      if (want.member) {
        // A structural member's report (FR1, D123): its section's area and centroid, its length, the section's frame.
        const r = o.member, w = want.member, close = (x, y, what) => assert.ok(Math.abs(x - y) <= w.absTol * Math.max(1, Math.abs(y)), `output ${k} member ${what}: ${x} vs ${y}`);
        assert.ok(r, `output ${k} has no member report`);
        close(r.area, w.area, 'area'); close(r.length, w.length, 'length'); w.centroid.forEach((x, i) => close(r.centroid[i], x, 'centroid'));
        for (const key of ['xAxis', 'yAxis', 'upFallback']) if (w[key]) w[key].forEach((x, i) => close(r[key][i], x, key));
        if (w.derived !== undefined) assert.deepEqual(r.derived ?? null, w.derived, `output ${k} member derived dimensions`);
        // Its ends at the frame's corners (FR3a, D125): end, kind and point in order, and each cut's angle from square.
        if (w.ends) {
          assert.deepEqual((r.ends ?? []).map(e => [e.end, e.kind, e.point]), w.ends.map(e => [e.end, e.kind, e.point]), `output ${k} member ends`);
          w.ends.forEach((e, i) => { if (e.angle !== undefined) close(r.ends[i].angle, e.angle, `end ${i} angle`); });
        }
      }
      if (want.plate) {
        // A weldment plate's report (FRk1, D165): a gusset's or an end cap's area, volume and seams.
        const r = o[want.plate.kind], w = want.plate, close = (x, y, what) => assert.ok(Math.abs(x - y) <= w.absTol * Math.max(1, Math.abs(y)), `output ${k} ${w.kind} ${what}: ${x} vs ${y}`);
        assert.ok(r, `output ${k} has no ${w.kind} report`);
        close(r.area, w.area, 'area'); close(r.volume, m.volume, 'volume');
        if (w.seams) { assert.equal(r.seams.length, w.seams.length); w.seams.forEach((x, i) => close(r.seams[i].length, x, `seam ${i}`)); }
        if (w.seam !== undefined) close(r.seam.length, w.seam, 'seam');
      }
      if (want.bead) {
        // A weld bead's report (FRk2, D166): its leg, its seam and the part of it flush, the members it meets, its volume.
        const r = o.bead, w = want.bead, close = (x, y, what) => assert.ok(Math.abs(x - y) <= w.absTol * Math.max(1, Math.abs(y)), `output ${k} bead ${what}: ${x} vs ${y}`);
        assert.ok(r, `output ${k} has no bead report`);
        close(r.leg, w.leg, 'leg'); close(r.seam.length, w.seam, 'seam'); close(r.seam.flush, w.flush, 'flush'); close(r.volume, m.volume, 'volume');
        assert.deepEqual(r.meets, w.meets, `output ${k} bead meets`);
      }
      if (want.flat) {
        // A sheet's flat pattern (R12.2, D117): by the output's own rules, or with T and K given (`options.thickness`).
        const w = want.flat, opts = w.options ?? {}, make = () => opts.thickness !== undefined ? flatPattern(o.brep, opts) : flatPatternOf(o, opts);
        if (w.error) assert.throws(make, e => e.code === w.error.code && e.message.includes(w.error.messageIncludes), `output ${k} flat refused`);
        else {
          const f = make();
          assert.ok(Math.abs(f.area - w.area.value) <= w.area.relTol * w.area.value, `output ${k} flat area ${f.area} vs ${w.area.value}`);
          if (w.box) f.box.max.forEach((x, i) => assert.ok(Math.abs(x - w.box.value[i]) <= w.box.absTol, `output ${k} flat box ${f.box.max} vs ${w.box.value}`));
          if (w.loops !== undefined) assert.equal(f.loops.length, w.loops, `output ${k} flat loops`);
          assert.deepEqual(f.bends.map(b => ({ name: b.name, direction: b.direction })).sort((a, b) => a.name < b.name ? -1 : 1), w.bends.map(b => ({ name: b.name, direction: b.direction })), `output ${k} flat bends`);
          w.bends.forEach(b => assert.ok(Math.abs(f.bends.find(x => x.name === b.name).angle - b.angle) <= 1e-9, `output ${k} ${b.name} angle`));
        }
      }
      if (want.tessellation?.watertight) { const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: want.tessellation.segmentsPerQuarter }); assert.equal(openEdges(mesh.positions, mesh.indices), 0, `output ${k} tessellation watertight`); }
    });
    if (c.expect.subd) {
      // A SubD feature's promises (D78/D79), measured on its cage: G1 and closed seams, the caps near the limit, no
      // degenerate point or fold in a cap.
      const want = c.expect.subd, f = c.input.partDocument.features.find(x => x.id === want.feature), r = subdReport(f.cage, { id: f.id });
      assert.ok(r.g1.maxAngleDeg <= want.g1MaxAngleDeg, `subd G1: normals ${r.g1.maxAngleDeg}° apart`);
      assert.ok(r.g1.maxGapMM <= want.maxGapMM, `subd seams ${r.g1.maxGapMM} mm apart`);
      assert.ok(r.deviation.maxMM <= want.capDeviationMaxMM, `subd caps ${r.deviation.maxMM} mm from the limit`);
      assert.ok(r.caps.minJacobianRatio >= want.minJacobianRatio, `subd |Su × Sv| down to ${r.caps.minJacobianRatio} of its median`);
      assert.ok(r.caps.maxNormalTurnDeg <= want.maxNormalTurnDeg, `subd cap normals turn ${r.caps.maxNormalTurnDeg}°`);
    }
    if (c.expect.fitChecks) {
      // Fits (R12c.2, D155): a hole face and a shaft face of two outputs, their classes from the case's tables — the
      // kind, the least and greatest clearance (µm), the overlap at MMC and LMC (mm³), contradicted or not; or the refusal.
      for (const w of c.expect.fitChecks) {
        const face = (f) => ({ brep: outputs.find(o => o.id === f.output).brep, face: f.face, class: f.class });
        if (w.error) { assert.throws(() => checkFit(w.tables, face(w.hole), face(w.shaft)), e => e.code === w.error.code && e.message.includes(w.error.messageIncludes)); continue; }
        const r = checkFit(w.tables, face(w.hole), face(w.shaft)), close = (x, y, what) => assert.ok(Math.abs(x - y) <= w.absTol * Math.max(1, Math.abs(y)), `fit ${what}: ${x} vs ${y}`);
        // Independent original µm operands; retain strict binary64 equality after each input is converted to mm.
        const clearances = { 'H8/f7': [0 / 1000 - -25 / 1000, 39 / 1000 - -50 / 1000], 'H7/k6': [0 / 1000 - 18 / 1000, 25 / 1000 - 2 / 1000], 'H7/p6': [0 / 1000 - 42 / 1000, 25 / 1000 - 26 / 1000] };
        const expected = clearances[`${w.hole.class}/${w.shaft.class}`];
        assert.ok(expected, 'independent clearance oracle');
        assert.deepEqual([r.limits.kind, r.limits.clearanceMin, r.limits.clearanceMax, r.contradicted], [w.kind, expected[0], expected[1], w.contradicted], 'fit');
        close(r.mmc.overlap, w.mmcOverlapMM3, 'MMC overlap'); close(r.lmc.overlap, w.lmcOverlapMM3, 'LMC overlap');
      }
    }
    if (c.expect.cutList) {
      // A frame's cut list (FR4a, D127): its rows in order — quantity, pieces, axis length, long point, each end's cut, mass — and the totals.
      const w = c.expect.cutList, list = cutList(outputs.filter(o => o.member).map(o => cutPiece(o)), { density: w.density }), close = (x, y, what) => assert.ok(Math.abs(x - y) <= w.absTol * Math.max(1, Math.abs(y)), `cut list ${what}: ${x} vs ${y}`);
      assert.equal(list.rows.length, w.rows.length, 'cut list rows');
      w.rows.forEach((r, i) => {
        const g = list.rows[i];
        assert.deepEqual([g.quantity, g.pieces, g.fromVolume], [r.quantity, r.pieces, r.fromVolume], `row ${i}`);
        close(g.axisLength, r.axisLength, `row ${i} axis`); close(g.longPoint, r.longPoint, `row ${i} long point`); close(g.mass, r.mass, `row ${i} mass`);
        r.ends.forEach((e, k) => { assert.equal(g.ends[k].kind, e.kind, `row ${i} end ${k}`); close(g.ends[k].mitre, e.mitre, `row ${i} end ${k} mitre`); close(g.ends[k].bevel, e.bevel, `row ${i} end ${k} bevel`); });
      });
      assert.equal(list.totals.quantity, w.totals.quantity); close(list.totals.axisLength, w.totals.axisLength, 'total length'); close(list.totals.mass, w.totals.mass, 'total mass');
    }
    if (c.expect.stepRoundTrip) {
      const back = importStep(exportStep(outputs.map(o => o.brep), { name: c.id })), r = checkBrep(back, { strict: true }), tol = c.expect.stepRoundTrip.relTol;
      assert.equal(r.valid, true, `round trip: ${r.issues[0]}`);
      const v0 = outputs.reduce((s, o) => s + massPropertiesOf(o).volume, 0), a0 = outputs.reduce((s, o) => s + surfaceAreaOf(o), 0);
      assert.ok(Math.abs(brepMassProperties(back, 1).volume - v0) <= tol * v0, 'round-trip volume');
      assert.ok(Math.abs(brepSurfaceArea(back) - a0) <= tol * a0, 'round-trip area');
    }
  });
}
