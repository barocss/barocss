// D775/B10-06 actual React props, current Viewer frames and a Studio edit.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../../../apps/cad-studio/test/flow-helper.mjs';

export const propsOracle = String.raw`
import json, math, sys
x = json.load(sys.stdin)
body, radius, height = x["body"], x["radius"], x["height"]
expected = height * (60 * 40 - math.pi * radius**2)
assert math.isclose(body["volume"], expected, rel_tol=1e-3)
assert all(abs(a-b) <= 0.01 for a,b in zip(body["centroid"], [30,20,height/2], strict=True))
if "bounds" in body:
    for edge, target in [("min",[0,0,0]),("max",[60,40,height])]:
        assert all(abs(a-b) <= 0.01 for a,b in zip(body["bounds"][edge], target, strict=True))
print(json.dumps({"status":"PASS","expectedVolume":expected,"volume":body["volume"],"centroid":body["centroid"]}))
`;

export async function qualifyProfileProps(f, ready, raw, workers) {
  const states = [];
  const readProps = async (label, radius, previous) => {
    await ready(radius, previous);
    const { observation } = await raw(label);
    const { host, calls } = observation;
    const owner = host.nativeOwner, viewer = host.viewer;
    for (const actual of [host.renderedOwner, host.adapter.desired, viewer.mountedOwner, viewer.frameOwner])
      assert.deepEqual(actual, owner);
    assert.equal(viewer.facade, '@barocss/viewer');
    assert.equal(viewer.displayMeshes.revision, owner.evaluationRevision);
    assert.equal(viewer.displayMeshes.authority, 'approximate-display-only');
    const accepted = JSON.parse(host.documentJSON);
    assert.deepEqual(accepted, host.currentDocument);
    assert.equal(accepted.schema, 3);
    assert.equal(accepted.units, 'mm');
    assert.deepEqual(accepted.nodes[0].holes[0][0],
      { kind: 'arc', start: [30+radius,20], center: [30,20], direction: 'ccw' });
    assert.equal(accepted.nodes[1].height, 8);
    const call = calls.find(entry => entry.revision === owner.evaluationRevision);
    assert.deepEqual(call.doc, accepted);
    assert.equal(call.reply.ok, true);
    assert.equal(call.reply.bodies.length, 1);
    assert.equal(call.reply.bodies[0].key, host.native.key);
    assert.deepEqual(viewer.displayMeshes.bodies, [
      { bodyId: host.native.key, vertices: host.native.vertices, triangles: host.native.triangles },
    ]);
    await f.runOracle({ body: host.native, radius, height: 8 }, label);
    states.push({ owner, viewer, accepted, bytes: host.documentJSON });
    return owner.evaluationRevision;
  };

  f.phase = 'change public React props A to B and back to A';
  const first = await readProps('radius-6-a', 6, -1);
  await f.page.getByRole('spinbutton', { name: 'Profile Radius', exact: true }).fill('8');
  const second = await readProps('radius-8-b', 8, first);
  await f.page.getByRole('button', { name: 'Reset', exact: true }).click();
  await readProps('radius-6-a-restored', 6, second);
  assert.ok(workers.some(url => /\/assets\/engine\.worker-.*\.js$/.test(url)));
  const [a, b, restored] = states;
  assert.equal(a.bytes, restored.bytes);
  assert.notEqual(b.bytes, a.bytes);
  assert.deepEqual(b.accepted.outputs, a.accepted.outputs);
  assert.deepEqual(restored.viewer.camera, a.viewer.camera);
  assert.deepEqual(restored.viewer.pixels, a.viewer.pixels);
  assert.notEqual(b.viewer.pixels.sha256, a.viewer.pixels.sha256);
  assert.equal(new Set(states.map(state => state.owner.hostEpoch)).size, 1);
  const file = join(f.output, 'returned-radius8.bcad');
  await writeFile(file, b.bytes);
  assert.equal(await readFile(file, 'utf8'), b.bytes);

  f.phase = 'open and edit the exact returned B document in Studio';
  const opened = await f.freshOpen(file, b.accepted, 'returned-b-open');
  assert.equal(opened.bodies.bodies.length, 1);
  assert.equal(opened.bodies.bodies[0].key, b.viewer.displayMeshes.bodies[0].bodyId);
  await f.runOracle({ body: opened.bodies.bodies[0], radius: 8, height: 8 }, 'studio-open');
  await f.openFeatureEditor(1, 'returned extrusion');
  await f.editor().getByLabel('Distance', { exact: true }).fill('12');
  const edited = await f.applyEditor(b.accepted, 'returned-b-height-12');
  const expected = structuredClone(b.accepted);
  expected.nodes[1].height = 12;
  assert.deepEqual(edited.doc, expected);
  assert.equal(edited.bodies.bodies.length, 1);
  assert.equal(edited.bodies.bodies[0].key, opened.bodies.bodies[0].key);
  await f.runOracle({ body: edited.bodies.bodies[0], radius: 8, height: 12 }, 'studio-edit');
  assert.equal(await readFile(file, 'utf8'), b.bytes);
  f.report.observations.push({
    returnedSHA256: sha256(b.bytes), workers,
    owners: states.map(state => state.owner), frames: states.map(state => state.viewer.pixels),
  });
  assert.deepEqual(f.report.downloads, []);
}
