// D705: actual desktop Studio Chat and the external MCP CLI, against the same native bytes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover } from './fixtures/assembly-identity-claude.mjs';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/assembly-identity-browser.mjs',
  'apps/cad-studio/test/fixtures/assembly-identity-claude.mjs',
  'apps/cad-studio/test/task-run-fixture.ts',
  'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/server/chatServer.ts',
  'apps/cad-studio/scripts/cad-mcp.mjs',
  'apps/cad-studio/scripts/chat-server.mjs',
  ...['chat/assembly', 'chat/groups', 'chat/contract', 'chat/part/requirements', 'team/localHeightPlan']
    .map(file => 'packages/barocss-cad-model/src/' + file + '.ts'),
];
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
process.env.CAD_STUDIO_CHAT_PORT = String(probe.address().port);
await new Promise((done, reject) => probe.close(error => error ? reject(error) : done()));

const f = await createFlow({
  name: 'assembly-identity', envFrozen: 'D705_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce rewritten assembly identity before the correction' : 'Pass exact discovered identities to the Studio and external MCP planners',
  limits: ['Controlled local tools, one nested path, one authored mate, no task execution.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { assemblyIdentityDoc } from './test/task-run-fixture';
const source = assemblyIdentityDoc(JSON.parse(process.argv[3]));
const bytes = encodeStudioFile(source);
const reopened = await readStudioFile(bytes);
assert.ok(!('error' in reopened), JSON.stringify(reopened));
assert.deepEqual(reopened.doc, source);
const volumes = source.instances.map(part => {
  if (part.doc.instances?.length) return null;
  const result = evaluatePart(part.doc, 0);
  assert.ok(result.ok);
  assert.equal(result.bodies.length, 1);
  return result.bodies[0].volume;
});
console.log(JSON.stringify({ source, bytes: Buffer.from(bytes).toString('base64'), volumes }));
`,
  oracleSource: String.raw`
import base64, hashlib, json, sys
d = json.load(sys.stdin)
doc = json.loads(base64.b64decode(d['bytes']))
kind, baseline = d['kind'], d['baseline']
collision = kind != 'single'
parts = doc['instances']
ids = [part['id'] for part in parts]
assert ids == ['check_spec', 'p2'] + (['requirements.check', 'sub'] if collision else [])
volumes = [1000, 288] + ([112, None] if collision else [])
assert all(a is None if b is None else abs(a-b) < 1e-8 for a,b in zip(d['volumes'], volumes, strict=True))
for trace in d['traces']:
    assert trace['init']['serverInfo']['version'] == 'barocss-cad-tools-v2'
    tools = {tool['name']: tool for tool in trace['tools']}
    assert 'get' in tools['assembly']['inputSchema']['properties']['action']['enum']
    assert 'plan_tasks' in tools['requirements']['inputSchema']['properties']['action']['enum']
    c = trace['calls']
    assert c['old-tool']['error']['code'] == -32602
    assert 'faces_of' in c['describe-assembly']['text']['input']['properties']
    assert 'assembly.get' in c['describe-plan']['text']['description']
    assert 'occurrences' in c['describe-plan']['text']['input']['properties']
    assert c['assembly']['structured'] == c['assembly']['text']
    for reply in c.values():
        if 'structured' in reply:
            assert reply['text'] == reply['structured']
    assembly = c['assembly']['text']
    assert 'assembly.get' in assembly['note']
    assert [p['id'] for p in assembly['instances']] == (['requirements.check', *ids[1:]] if baseline else ids)
    assert [p['volume'] for p in assembly['instances']] == [1000, 288] + ([112, 1000] if collision else [])
    def blocked(plan, code):
        assert plan['status'] == 'blocked' and not plan['tasks'] and not plan['targets'], plan
        assert plan['issues'][0]['code'] == code, plan

    def ready(plan, indices):
        assert plan['status'] == 'ready' and not plan['issues'], plan
        for i, index in enumerate(indices):
            part = parts[index]
            node = part['doc']['nodes'][1]
            req = part['doc']['requirements'][0]
            assert plan['tasks'][i] == {'occurrence': part['id'], 'feature': node['id'], 'field': 'height'}
            assert plan['targets'][i] == {'id': part['id'], 'requirementId': req['id'], 'currentHeightMm': node['height'],
                                           'heightMm': req['check']['value'], 'toleranceMm': req['check']['tol']}

    def plan(label, indices):
        reply = c[label]
        discovered = [assembly['instances'][i]['id'] for i in indices]
        assert reply['args']['occurrences'] == discovered
        assert reply['structured'] == reply['text']
        assert reply['text']['occurrences'] == discovered
        return reply['text']

    if kind == 'single':
        base = plan('base-plan', [0, 1])
        if baseline:
            blocked(base, 'BAD_TASK')
        else:
            ready(base, [0, 1])
    elif kind == 'substitution':
        base = plan('base-plan', [0])
        if baseline:
            ready(base, [2])
        else:
            blocked(base, 'UNCOVERED_REQUIREMENT')
            assert 'requirements.check' in base['issues'][0]['message']
        ready(plan('literal-plan', [2]), [2])
    else:
        base = plan('base-plan', [0, 1])
        literal = plan('literal-plan', [2, 1])
        blocked(base, 'UNCOVERED_REQUIREMENT')
        blocked(literal, 'UNCOVERED_REQUIREMENT')
        assert 'of check_spec.' in literal['issues'][0]['message']
        assert ('of check_spec.' if baseline else 'of requirements.check.') in base['issues'][0]['message']
        if baseline:
            assert c['all-plan']['isError']
            assert 'distinct occurrence IDs' in c['all-plan']['text']['error']
        else:
            ready(plan('all-plan', [0, 1, 2]), [0, 1, 2])
    assert assembly['instances'][0]['name'] == ('Base requirements.check' if baseline else parts[0]['name'])
    if kind == 'collision':
        sub = assembly['instances'][3]
        path = 'sub/requirements.check' if baseline else 'sub/check_spec'
        assert sub['parts_inside'][0]['path'] == path and 'assembly.get' in sub['note']
        mate = assembly['mates'][0]
        assert mate['id'] == ('assembly.place' if baseline else doc['mates'][0]['id'])
        assert mate['a'] == doc['mates'][0]['a']
        assert mate['b'] == {**doc['mates'][0]['b'], 'part': path}
        faces = c['nested-faces']
        assert faces['args']['faces_of'] == path
        if baseline:
            assert faces['isError']
        else:
            assert not faces['isError']
            assert any(face['name'] == 'n1.top' for face in faces['text']['instances'][3]['faces'])
        missing = c['missing-faces']
        assert missing['isError'] and 'no part "missing"' in missing['text']['error']
        assert ('its parts: requirements.check' if baseline else 'its parts: check_spec') in missing['text']['error']
        refused = c['nested-plan']['text']
        assert refused['status'] == 'blocked' and not refused['tasks'] and not refused['targets']
        assert refused['issues'][0]['code'] == 'BAD_TASK'
print(json.dumps({'status': 'PASS', 'baseline': baseline, 'ids': ids, 'volumeMm3': volumes,
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
  const traceFile = join(output, 'studio-protocol.jsonl'), runDir = join(output, 'service-runs');
  const env = { ...process.env, CAD_STUDIO_CLAUDE: fileURLToPath(new URL('./fixtures/assembly-identity-claude.mjs', import.meta.url)),
    CAD_STUDIO_CHAT_ORIGINS: origin, CAD_STUDIO_TASK_RUN_DIR: runDir, CAD_D705_TRACE: traceFile };
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
    await f.newPage();
    const page = f.page, button = name => page.getByRole('button', { name, exact: true });
    const project = 'D705 Assembly identity';
    const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
    await button('Project and versions').click();
    await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    const saved = async name => Buffer.from(await page.evaluate(async ({ project, name }) => {
      const root = await navigator.storage.getDirectory();
      const directory = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
      return [...new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer())];
    }, { project, name }));
    const requested = [];
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/chat/task-runs/start') requested.push(request);
    });
    for (const [index, kind] of ['single', 'collision', 'substitution'].entries()) {
      f.phase = 'Discover and reuse IDs in ' + kind;
      const name = kind + '.bcad', path = join(output, name);
      const fixture = await f.inspect(kind + '-fixture', {}, kind);
      const bytes = Buffer.from(fixture.bytes, 'base64');
      await writeFile(path, bytes);
      const stdio = await discover({ command: process.execPath, args: [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', path] }, kind);
      await writeFile(join(output, kind + '-stdio.json'), JSON.stringify(stdio));
      assert.deepEqual(await readFile(path), bytes);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
      await chooser.setFiles(path);
      await f.same(fixture.source);
      await button('Save').click();
      await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
      assert.deepEqual(await saved(name), bytes);
      const before = await f.snapshot(kind + '-before');
      const input = page.getByRole('textbox', { name: 'Chat message', exact: true });
      if (!(await input.isVisible())) await button('Chat').first().click();
      const response = page.waitForResponse(reply => new URL(reply.url()).pathname === '/api/chat/turn' && reply.request().method() === 'POST');
      await input.fill('D705 ' + kind);
      await input.press('Enter');
      const reply = await response;
      assert.ok(reply.ok());
      const events = (await reply.text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
      const done = events.at(-1);
      assert.equal(done.end, 'done', JSON.stringify(done));
      assert.equal(events.some(event => event.type === 'state'), false);
      for (const field of ['versions', 'selection', 'doc', 'ops']) assert.equal(done[field], undefined, field);
      await page.getByText('Assembly discovery complete.', { exact: true }).nth(index).waitFor();
      const studio = (await readFile(traceFile, 'utf8')).trim().split('\n').map(JSON.parse).at(index);
      assert.deepEqual(Object.keys(studio.calls), Object.keys(stdio.calls));
      await f.same(fixture.source);
      const after = await f.snapshot(kind + '-after');
      for (const field of ['doc', 'bodies', 'selection', 'history']) assert.deepEqual(after[field], before[field], field);
      assert.deepEqual(await saved(name), bytes);
      assert.deepEqual(await readFile(path), bytes);
      await assert.rejects(readdir(runDir), { code: 'ENOENT' });
      f.report.observations.push({ label: kind, nativeSHA256: sha256(bytes), toolEvents: events.filter(event => event.type === 'tool').length });
      await f.runOracle({ bytes: fixture.bytes, volumes: fixture.volumes, kind, baseline, traces: [stdio, studio] }, kind);
    }
    assert.deepEqual(requested, []);
  } finally {
    if (chat.exitCode === null && chat.signalCode === null) chat.kill('SIGTERM');
    await closed;
    await writeFile(join(output, 'chat.stderr.txt'), stderr);
  }
});
