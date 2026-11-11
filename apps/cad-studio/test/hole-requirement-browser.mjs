// D712: Studio Chat, external MCP, and an independent check of the authored native geometry.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFlow, sha256 } from './flow-helper.mjs';
import { readRequirements } from './fixtures/hole-requirement-claude.mjs';

const [output] = process.argv.slice(2);
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
process.env.CAD_STUDIO_CHAT_PORT = String(probe.address().port);
await new Promise((done, reject) => probe.close(error => error ? reject(error) : done()));
const pins = [
  'apps/cad-studio/test/hole-requirement-browser.mjs',
  'apps/cad-studio/test/fixtures/hole-requirement-claude.mjs',
  'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/server/chatServer.ts',
  'apps/cad-studio/scripts/chat-server.mjs',
  'apps/cad-studio/scripts/cad-mcp.mjs',
  'packages/barocss-cad/src/brep/cylindrical-bore.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
  ...['spec', 'names', 'part/requirements', 'requirementEvidence'].map(file => 'packages/barocss-cad-model/src/chat/' + file + '.ts'),
];
const f = await createFlow({
  name: 'hole-requirement', envFrozen: 'D712_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'Read only supported cylindrical bore diameters through Studio and the external grouped MCP tools',
  limits: ['Local scripted Chat, no live provider. Geometry oracle covers these authored fixtures.'],
  inspectorSource: String.raw`
import assert from 'node:assert/strict';
import { evaluateSurface, surfaceDomain } from '@barocss/cad';
import { emptyDoc, rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { evaluatePart, partBreps } from '@barocss/cad-model/engine/evaluate';
import { runTool } from '@barocss/cad-model/chat/tools';
const label = JSON.parse(process.argv[3]);
assert.ok(['pair', 'rotated', 'sphere', 'channel', 'suppressed', 'deleted', 'assembly'].includes(label), label);
const req = (id, fn, face, value) => ({ id, source: id, hard: true, check: { op: '==', query: { fn, face }, value, tol: 0.001, unit: 'mm' } });
const hole = (id, face, value = 8) => req(id, 'hole_diameter', face, value);
const radius = face => req('radius', 'radius', face, 4);
const plate = rectanglePart(20, 10, 5);
const drill = (doc, center) => withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center, radius: 4 });
const cylinder = (doc, center) => {
  const index = doc.nodes.length;
  return withNode(withNode(doc, { kind: 'sketch', profile: 'circle', center, radius: 4 }), { kind: 'extrude', sketch: index, height: 5 });
};
const bore = drill(plate, [5, 5]);
const shaft = cylinder(emptyDoc(), [0, 0]);
const evaluate = async doc => evaluatePart(doc, 1);
let doc, measuredFaces = [];
if (label === 'pair' || label === 'rotated') {
  doc = cylinder(bore, [30, 5]);
  if (label === 'rotated') {
    doc = withNode(doc, { kind: 'rotate', parent: { node: 2, side: 'solid' }, axis: 'y', angle: 90 });
    doc = withNode(doc, { kind: 'translate', parent: { node: 5, side: 'solid' }, offset: [19, -11, 22] });
  }
  const owner = label === 'rotated' ? 'b6' : 'b2';
  doc = { ...doc, requirements: [hole('bore', { feature: 2, role: 'side0', on: owner }), hole('oversize', 'n2.side0', 10),
    hole('shaft', 'n4.side0'), radius('n4.side0'), hole('wrongBody', { feature: 2, role: 'side0', on: 'b4' })] };
  measuredFaces = ['n2.side0', 'n4.side0'];
} else if (label === 'sphere') {
  const made = await runTool({ doc: emptyDoc(), bodies: [] }, 'features',
    { action: 'command', command: 'sphere', values: { r: 4, x: 0, y: 0, z: 0 } }, evaluate);
  assert.equal(made.isError, false, made.content);
  doc = { ...made.state.doc, requirements: [hole('sphere', 'n1.side0'), radius('n1.side0')] };
  measuredFaces = ['n1.side0'];
} else if (label === 'channel') {
  doc = { ...drill(plate, [0, 5]), requirements: [hole('channel', 'n2.side0'), radius('n2.side0')] };
  measuredFaces = ['n2.side0'];
} else if (label === 'assembly') {
  const place = (id, child, position, rotation) => ({ id, name: id, doc: child, position, rotation, grounded: true });
  doc = { ...emptyDoc(), instances: [
    place('bored', { ...bore, requirements: [hole('bore', 'n2.side0')] }, [0, 0, 0], [0, 0, 0]),
    place('shaft', { ...shaft, requirements: [hole('shaft', 'n1.side0'), hole('foreign', 'n2.side0'), radius('n1.side0')] }, [42, 4, 5], [0, 27, 0]),
  ] };
} else {
  doc = label === 'suppressed' ? { ...bore, nodes: bore.nodes.map((node, i) => i === 2 ? { ...node, suppressed: true } : node) } : plate;
  doc = { ...doc, requirements: [hole('missing', 'n2.side0')] };
}
const bytes = encodeStudioFile(doc);
const opened = await readStudioFile(bytes);
assert.ok(!('error' in opened), JSON.stringify(opened));
const model = await evaluate(opened.doc);
assert.ok(model.ok, JSON.stringify(model));
const native = partBreps(opened.doc).flatMap(({ key, brep }) => brep.faces.flatMap(face => {
  const name = face.name?.replace(/#\d+$/, '');
  if (!measuredFaces.includes(name) || face.surface.kind !== 'surface') return [];
  const { u, v } = surfaceDomain(face.surface);
  const at = (range, fraction) => range[0] + fraction * (range[1] - range[0]);
  const uv = (uf, vf) => evaluateSurface(face.surface, at(u, uf), at(v, vf));
  return [{ key, name, sense: face.sense, point: uv(0.43, 0.43),
    left: uv(0.42999, 0.43), right: uv(0.43001, 0.43), lower: uv(0.43, 0.42999), upper: uv(0.43, 0.43001) }];
}));
console.log(JSON.stringify({ doc: opened.doc, bytes: Buffer.from(bytes).toString('base64'),
  volumes: model.bodies.map(b => b.volume).sort((a, b) => a - b), native }));
`,
  oracleSource: String.raw`
import base64, hashlib, json, math, sys

d = json.load(sys.stdin)
label = d['label']
expected = {
    'pair': {'base': {'bore': ('pass', 8), 'oversize': ('fail', 8), 'shaft': ('unknown', None), 'radius': ('pass', 4), 'wrongBody': ('unknown', None)}},
    'rotated': {'base': {'bore': ('pass', 8), 'oversize': ('fail', 8), 'shaft': ('unknown', None), 'radius': ('pass', 4), 'wrongBody': ('unknown', None)}},
    'sphere': {'base': {'sphere': ('unknown', None), 'radius': ('pass', 4)}},
    'channel': {'base': {'channel': ('unknown', None), 'radius': ('pass', 4)}},
    'suppressed': {'base': {'missing': ('unknown', None)}},
    'deleted': {'base': {'missing': ('unknown', None)}},
    'assembly': {'bored': {'bore': ('pass', 8)}, 'shaft': {'shaft': ('unknown', None), 'foreign': ('unknown', None), 'radius': ('pass', 4)}},
}[label]
for part, requirements in expected.items():
    report = d['calls'][part]
    assert not report['check']['isError'] and not report['evidence']['isError']
    check = report['check']['text']
    evidence = json.loads(report['evidence']['text']['files'][0]['text'])
    assert evidence['part'] == part and evidence['checker'] == 'checkSpec'
    summary = check['summary']
    assert [summary[k] for k in ('pass','fail','unknown')] == [sum(status == k for status, _ in requirements.values()) for k in ('pass','fail','unknown')], check
    assert check['policy']['best']['hard_fulfilled'] == all(status == 'pass' for status, _ in requirements.values()), check
    for row in evidence['evidence']:
        if 'requirement' not in row:
            continue
        req = row['requirement']['id']
        status, number = requirements[req]
        result = row['result']
        assert result['number'] == number, row
        if status == 'unknown':
            why = next(r['why'] for r in check['unknowns'] if r['req_id'] == req)
            assert result['status'] == 'unsupported' and 'verdict' not in result and result['why'] == why, row
            if req in ('sphere', 'shaft', 'channel'):
                assert 'no verified cylindrical bore wall' in why, why
            elif req == 'wrongBody':
                assert 'no face "side0"' in why, why
            else:
                assert 'No face named' in why, why
        else:
            assert result['status'] == 'ok' and result['verdict'] == status, row
        if status == 'fail':
            failure = next(r for r in check['failures'] if r['req_id'] == req)
            assert failure['measured'] == 8 and failure['delta'] == -2, failure
    assert {row['requirement']['id'] for row in evidence['evidence'] if 'requirement' in row} == set(requirements)
if label == 'assembly':
    assert all(r['isError'] and 'No part' in r['text']['error'] for r in d['calls']['missing'].values())

volumes = {
    'pair': [80*math.pi, 1000-80*math.pi], 'rotated': [80*math.pi, 1000-80*math.pi],
    'sphere': [4*math.pi*4**3/3], 'channel': [1000-40*math.pi],
    'suppressed': [1000], 'deleted': [1000], 'assembly': [],
}[label]
assert len(volumes) == len(d['volumes']), d['volumes']
assert all(abs(a-b) < 1e-8 for a,b in zip(volumes, d['volumes'])), d['volumes']
expected_faces = {'pair': {'n2.side0','n4.side0'}, 'rotated': {'n2.side0','n4.side0'}, 'sphere': {'n1.side0'}, 'channel': {'n2.side0'}}
assert {s['name'] for s in d['native']} == expected_faces.get(label, set())
dot = lambda a,b: sum(x*y for x,y in zip(a,b))
def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def material(point, inward, center):
    if label == 'sphere':
        return math.dist(point,center) < 4
    if not inward:
        return math.hypot(point[0]-center[0],point[1]-center[1]) < 4 and 0 < point[2] < 5
    x,y,z = point
    if label == 'rotated':
        x,y,z = 22-z, y+11, x-19
    return 0 < x < 20 and 0 < y < 10 and 0 < z < 5 and math.hypot(x-(0 if label == 'channel' else 5),y-5) > 4

cosines = []
for sample in d['native']:
    name = sample['name']
    inward = name == 'n2.side0'
    if label == 'sphere':
        center, axis = [0,0,4], None
    elif label == 'channel':
        center, axis = [0,5,0], [0,0,1]
    elif label == 'rotated' and inward:
        center, axis = [19,-6,17], [1,0,0]
    else:
        center, axis = [5 if inward else 30,5,0], [0,0,1]
    radial = [x-y for x,y in zip(sample['point'], center)]
    if axis is not None:
        station = dot(radial,axis)
        radial = [x-station*a for x,a in zip(radial,axis)]
    assert abs(math.hypot(*radial)-4) < 1e-8, sample
    du = [b-a for a,b in zip(sample['left'],sample['right'])]
    dv = [b-a for a,b in zip(sample['lower'],sample['upper'])]
    normal = cross(du,dv)
    sign = 1 if sample['sense'] == 'forward' else -1
    cosine = sign*dot(normal,radial)/(math.hypot(*normal)*math.hypot(*radial))
    assert abs(cosine-(-1 if inward else 1)) < 1e-8, sample
    near = [p-r/16 for p,r in zip(sample['point'],radial)]
    far = [p+r/16 for p,r in zip(sample['point'],radial)]
    assert material(near,inward,center) == (not inward) and material(far,inward,center) == inward, sample
    cosines.append(cosine)
print(json.dumps({'status': 'PASS', 'label': label, 'volumeMm3': d['volumes'], 'nativeCosines': cosines,
                  'sha256': hashlib.sha256(base64.b64decode(d['bytes'])).hexdigest()}))
`,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const traceFile = join(output, 'studio-protocol.jsonl');
  const env = { ...process.env, CAD_STUDIO_CLAUDE: fileURLToPath(new URL('./fixtures/hole-requirement-claude.mjs', import.meta.url)),
    CAD_STUDIO_CHAT_ORIGINS: origin, CAD_D712_TRACE: traceFile };
  const chat = spawn(process.execPath, [join(f.app, 'scripts/chat-server.mjs')], { cwd: f.app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(chat, 'close');
  let stdout = '', stderr = '';
  chat.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  const ready = new Promise(done => chat.stdout.on('data', chunk => {
    stdout += chunk;
    if (stdout.includes('chat server on')) done(true);
  }));
  try {
    assert.ok(await Promise.race([ready, closed.then(() => false), new Promise(done => setTimeout(() => done(false), 15000).unref())]), stderr);
    for (const label of ['pair', 'rotated', 'sphere', 'channel', 'suppressed', 'deleted', 'assembly']) {
      f.phase = 'Check ' + label;
      const name = label + '.bcad', path = join(output, name);
      const fixture = await f.inspect(label + '-fixture', {}, label);
      const bytes = Buffer.from(fixture.bytes, 'base64');
      await writeFile(path, bytes);
      const parts = label === 'assembly' ? ['bored', 'shaft', 'missing'] : ['base'];
      const calls = await readRequirements({ command: process.execPath, args: [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', path] }, parts);
      await f.newPage();
      const page = f.page, button = name => page.getByRole('button', { name, exact: true });
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
      await chooser.setFiles(path);
      await f.same(fixture.doc);
      const before = await f.snapshot(label + '-before');
      const input = page.getByRole('textbox', { name: 'Chat message', exact: true });
      if (!(await input.isVisible())) await button('Chat').first().click();
      const response = page.waitForResponse(reply => new URL(reply.url()).pathname === '/api/chat/turn' && reply.request().method() === 'POST');
      await input.fill('D712 ' + label);
      await input.press('Enter');
      const reply = await response;
      assert.ok(reply.ok());
      const events = (await reply.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
      assert.equal(events.at(-1).end, 'done', JSON.stringify(events.at(-1)));
      assert.equal(events.some(event => event.type === 'state'), false);
      await page.getByText('Requirement evidence read.', { exact: true }).waitFor();
      const trace = (await readFile(traceFile, 'utf8')).trim().split('\n').map(JSON.parse).at(-1);
      assert.equal(trace.label, label);
      // Session counters differ. Geometry, evidence and input errors must agree across transports.
      for (const part of parts) {
        const strip = ({ policy, ...report }) => report;
        assert.equal(trace.calls[part].check.isError, calls[part].check.isError);
        assert.deepEqual(strip(trace.calls[part].check.text), strip(calls[part].check.text));
        assert.deepEqual(trace.calls[part].evidence, calls[part].evidence);
      }
      const after = await f.snapshot(label + '-after');
      for (const field of ['doc', 'bodies', 'selection', 'history']) assert.deepEqual(after[field], before[field], field);
      assert.deepEqual(await readFile(path), bytes);
      await f.runOracle({ ...fixture, label, calls: trace.calls }, label);
      f.report.observations.push({ label, nativeSHA256: sha256(bytes), toolEvents: events.filter(event => event.type === 'tool').length });
    }
  } finally {
    if (chat.exitCode === null && chat.signalCode === null) chat.kill('SIGTERM');
    await closed;
    await writeFile(join(output, 'chat.stderr.txt'), stderr);
  }
});
