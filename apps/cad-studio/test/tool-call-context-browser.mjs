// D583 / #2398. Run under the heavy gate from apps/cad-studio.
// D583_SOURCE_FROZEN=1 node test/tool-call-context-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));

const pins = [
  'apps/cad-studio/test/tool-call-context-browser.mjs',
  'apps/cad-studio/server/cadMcp.ts',
  'apps/cad-studio/server/chatServer.ts',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/chat/client.ts',
  'apps/cad-studio/src/chat/transport.ts',
  'apps/cad-studio/src/chat/useStudioChat.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/state/useModelChecks.ts',
  'apps/cad-studio/src/storage/project.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/ui/ChatPanel.tsx',
  'apps/cad-studio/src/ui/RequirementsBrowser.tsx',
  'packages/barocss-cad-model/src/chat/toolKit.ts',
  'packages/barocss-cad-model/src/chat/tools.ts',
  'packages/barocss-cad-model/src/chat/part/features.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { v1Call, v2Result } from '@barocss/cad-model/chat/groups';
import { captureOp } from '@barocss/cad-model/chat/merge';
import { runTool, type ChatState, type Evaluate, type ToolOutcome } from '@barocss/cad-model/chat/tools';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { summarize } from './server/chatServer';

const [docFile, options] = process.argv.slice(2);
const input = JSON.parse(options);
const plate = (id: string): StudioDoc => ({
  ...rectanglePart(40, 20, 8),
  requirements: [{
    id, source: '40 mm plate width', hard: true, basis: 'stated',
    check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1, unit: 'mm' },
  }],
});
if (input === 'fixture') {
  console.log(JSON.stringify(plate('WIDTH')));
} else {
  assert.equal(input.autonomy, 3);
  process.env.CAD_AUTONOMY = '3';
  const doc = JSON.parse(readFileSync(docFile, 'utf8')) as StudioDoc;
  const other = plate('OTHER');
  let revision = 0;
  const evaluate: Evaluate = async candidate => evaluatePart(candidate, ++revision, 8, 'agent');
  const evaluateOther: Evaluate = async candidate => evaluatePart(candidate, ++revision, 8, 'probe');

  async function checked(base: StudioDoc, evaluate: Evaluate): Promise<ChatState> {
    const result = await evaluate(base);
    assert.ok(result?.ok);
    const check = await runTool({ doc: base, turnBase: base, bodies: result.bodies }, 'requirements', { action: 'check' }, evaluate);
    assert.equal(check.isError, false, check.content);
    assert.deepEqual(check.state.policy?.passedHard, [base.requirements![0].id]);
    return check.state;
  }

  const first = await checked(doc, evaluate);
  const second = await checked(other, evaluateOther);
  const before = structuredClone(first.doc);
  const otherBefore = structuredClone(second.doc);
  const scale = { action: 'command', command: 'scale', bodies: ['b1'], values: { factor: 1.5, px: 0, py: 0, pz: 0 } };
  const firstInput = { ...scale, response_format: 'concise', ...(input.allowed ? { because: 'Use 60 mm for the trial plate' } : {}) };
  const secondInput = { ...scale, response_format: 'detailed', ...(!input.allowed ? { because: 'Use 60 mm for the companion plate' } : {}) };
  const trace: string[] = [];
  let entered!: () => void;
  let release!: () => void;
  const atEvaluation = new Promise<void>(resolve => { entered = resolve; });
  const resumeEvaluation = new Promise<void>(resolve => { release = resolve; });
  const held: Evaluate = async candidate => {
    const result = await evaluate(candidate);
    assert.ok(result?.ok);
    assert.equal(candidate.nodes.at(-1)?.kind, 'scale');
    trace.push('primary native result held');
    entered();
    await resumeEvaluation;
    trace.push('primary native result released');
    return result;
  };

  const primary = runTool(first, 'features', firstInput, held);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Tool overlap timed out')), 15000); });
  let companion: ToolOutcome;
  try {
    await Promise.race([atEvaluation, primary.then(out => { throw new Error('Primary returned before evaluation: ' + out.content); }), deadline]);
    companion = await Promise.race([runTool(second, 'features', secondInput, evaluateOther), deadline]);
    trace.push('companion finished');
  } finally {
    release();
    clearTimeout(timer);
  }
  const result = await primary;
  assert.deepEqual(trace, ['primary native result held', 'companion finished', 'primary native result released']);
  assert.deepEqual(first.doc, before);
  assert.deepEqual(second.doc, otherBefore);

  const witness = (out: ToolOutcome, initial: ChatState, args: typeof firstInput, allowed: boolean) => {
    assert.equal(out.isError, !allowed, out.content);
    assert.equal(out.changed, allowed);
    const text = v2Result(out.content);
    const content = JSON.parse(text);
    if (!allowed) {
      assert.equal(out.state, initial);
      assert.match(content.error, new RegExp('breaks hard requirement that passed: ' + initial.doc.requirements![0].id));
      assert.match(content.error, /measured 60/);
    } else {
      assert.deepEqual(content.facts.bbox, { min: [0, 0, 0], max: [60, 30, 12] });
      assert.equal(content.facts.volume, 21600);
      if (args.response_format === 'concise') assert.equal(Object.hasOwn(content, 'bodies'), false);
      else {
        assert.equal(content.bodies.length, 1);
        assert.equal(content.bodies[0].faces.length, 6);
        assert.equal(content.bodies[0].edges.length, 12);
      }
    }
    const call = v1Call('features', args);
    assert.ok(call && !('error' in call));
    const ops = out.changed ? [captureOp(initial.doc, out.state.doc, call.name, call.args)] : [];
    return { input: args, doc: out.state.doc, summary: summarize(call.name, text, out.isError), isError: out.isError, changed: out.changed, content, ops };
  };
  console.log(JSON.stringify({
    trace,
    primary: witness(result, first, firstInput, input.allowed),
    companion: witness(companion, second, secondInput, !input.allowed),
  }));
}
`;

const f = await createFlow({
  name: 'tool-call-context', envFrozen: 'D583_SOURCE_FROZEN', output,
  qualification: 'D583 #2398 grouped native tool overlap and desktop Studio chat consumer',
  initialFiles: pins, requiredFrozen: pins, inspectorSource,
  limits: [
    'A controlled same-origin chat response uses two independent grouped Model calls in one bundled Node process per turn. A barrier delays delivery of an actual native result.',
    'Only the primary result reaches Studio. The public Chat panel sends one turn at a time. The live chat backend, concurrent public Studio turns, and stdio MCP execution are outside this run.',
    'Studio renders the tool summary. The inspector checks the concise and detailed response bodies.',
    'Desktop WebGPU and public Chat, Undo, Redo, OPFS Save, and native Open in a fresh browser context. No downloads.',
  ],
  snapshotExtra: () => ({
    requirement: document.querySelector('[aria-label="Requirement WIDTH"]')?.textContent ?? null,
    toolCards: [...document.querySelectorAll('[data-slot="tool"]')].map(card => ({
      state: card.getAttribute('data-state'), summary: card.querySelector('.chat-sum')?.textContent,
    })),
  }),
});

const button = name => f.page.getByRole('button', { name, exact: true });
const dirty = () => f.page.getByLabel('Unsaved changes', { exact: true });
const chat = () => f.page.getByRole('complementary', { name: 'Chat', exact: true });
const file = 'D583-tool-call-context.bcad';
const project = 'D583 tool call context';
const refusedPrompt = 'Try the scale without a reason.';
const allowedPrompt = 'Use 60 mm for the trial plate.';
const tolerance = 1e-8;

async function open(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
}

async function checkPlate(label, width) {
  const failed = width === 60;
  const row = f.page.getByRole('listitem', { name: 'Requirement WIDTH', exact: true });
  const mark = row.getByText(failed ? '✗' : '✓', { exact: true });
  await mark.waitFor();
  assert.match(await row.innerText(), /40 mm plate width.*hard/);
  if (failed) assert.match(await row.innerText(), /60 \(want/);
  const state = await f.snapshot(label);
  const factor = width / 40;
  const [body] = state.bodies.bodies;
  assert.equal(state.bodies.bodies.length, 1);
  assert.equal(body.key, failed ? 'b2' : 'b1');
  assert.ok(Math.abs(body.volume - width * (20 * factor) * (8 * factor)) <= tolerance);
  for (const [i, coordinate] of [width / 2, 10 * factor, 4 * factor].entries()) {
    assert.ok(Math.abs(body.centroid[i] - coordinate) <= tolerance);
  }
  return state;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  f.report.absoluteTolerance = tolerance;
  const fixture = await f.inspect('fixture', {}, 'fixture');
  const replies = [];
  let turnError;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) return route.abort();
        if (url.origin !== origin || !url.pathname.startsWith('/api/chat/')) return route.continue();
        if (url.pathname === '/api/chat/status' && request.method() === 'GET') {
          return route.fulfill({ json: { enabled: true, model: 'D583 controlled local tools' } });
        }
        if (url.pathname !== '/api/chat/turn' || request.method() !== 'POST') return route.abort();
        let events;
        try {
          const sent = request.postDataJSON();
          assert.ok(replies.length < 2);
          const allowed = replies.length === 1;
          assert.equal(sent.text, allowed ? allowedPrompt : refusedPrompt);
          assert.deepEqual(sent.doc, fixture);
          const pair = await f.inspect(allowed ? 'permitted-model-turn' : 'refused-model-turn', sent.doc, { autonomy: sent.autonomy, allowed });
          const outcome = pair.primary;
          events = [{ type: 'tool', name: 'features', input: outcome.input, isError: outcome.isError, summary: outcome.summary }];
          if (outcome.changed) events.push({ type: 'state', doc: outcome.doc, ops: outcome.ops });
          events.push({ type: 'done', end: 'done', ...(outcome.changed ? { doc: outcome.doc } : {}) });
          replies.push(pair);
          f.report.observations.push({ label: allowed ? 'permitted-model-turn' : 'refused-model-turn', pair, studioEvents: events });
          await f.persist();
        } catch (error) {
          turnError = error;
          events = [{ type: 'done', end: 'error', error: 'Controlled native turn failed' }];
        }
        return route.fulfill({
          status: 200, contentType: 'text/event-stream',
          body: events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join(''),
        });
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  f.phase = '01 open and check the original plate';
  await f.newPage();
  await open(Buffer.from(JSON.stringify(fixture)));
  const base = (await checkPlate('01-original-plate', 40)).doc;
  assert.deepEqual(base, fixture);
  assert.equal(await dirty().isVisible(), false);
  await button('Open chat').click();
  await chat().getByLabel('Autonomy', { exact: true }).selectOption('3');
  const message = chat().getByLabel('Chat message', { exact: true });

  async function send(prompt, state) {
    await message.fill(prompt);
    await chat().getByRole('button', { name: 'Send', exact: true }).click();
    const card = chat().locator('[data-slot="tool"][data-state="' + state + '"]');
    await card.or(chat().getByText('Controlled native turn failed', { exact: true })).waitFor();
    assert.ifError(turnError);
    await chat().getByRole('button', { name: 'Send', exact: true }).waitFor();
    assert.equal(await card.locator('.mono').innerText(), 'features.command');
    return card.locator('.chat-sum').innerText();
  }

  f.phase = '02 show the blocked primary result while the companion is allowed';
  assert.match(await send(refusedPrompt, 'error'), /breaks hard requirement that passed: WIDTH .*measured 60/);
  assert.equal(replies.length, 1);
  await f.same(base);
  await checkPlate('02-blocked-primary', 40);
  assert.equal(await dirty().isVisible(), false);

  f.phase = '03 apply the primary result with its own reason while the companion is refused';
  assert.match(await send(allowedPrompt, 'done'), /^Scale .*"factor":1\.5/);
  assert.equal(replies.length, 2);
  await f.changed(base);
  const accepted = (await checkPlate('03-permitted-primary', 60)).doc;
  const { history, ...geometry } = accepted;
  assert.deepEqual(geometry, replies[1].primary.doc);
  assert.equal(history.length, 1);
  assert.equal(history[0].kind, 'prompt');
  assert.equal(history[0].prompt, allowedPrompt);
  assert.deepEqual(accepted.requirements, base.requirements);
  await dirty().waitFor();

  f.phase = '04 undo and redo the exact accepted document';
  await chat().getByRole('button', { name: 'Close chat', exact: true }).click();
  await f.undo();
  await f.same(base);
  await checkPlate('04-undo', 40);
  await f.redo();
  await f.same(accepted);
  await checkPlate('05-redo', 60);

  f.phase = '06 save through the Studio project UI to OPFS';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await dirty().waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ({ project, file }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const dir = await projects.getDirectoryHandle(project);
    const handle = await dir.getFileHandle(file);
    return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
  }, { project, file }));
  assert.deepEqual(JSON.parse(bytes), accepted);
  const saved = join(f.output, 'saved-project-document.bcad');
  await writeFile(saved, bytes);
  f.report.files.push({ file: saved, hash: sha256(bytes), semanticEquality: true, source: 'OPFS' });
  await f.same(accepted);
  await checkPlate('06-project-saved', 60);

  f.phase = '07 open the same OPFS bytes through the public chooser in a fresh context';
  const previous = f.context;
  await f.newPage();
  assert.notEqual(f.context, previous);
  await open(bytes);
  await f.same(accepted);
  await checkPlate('07-fresh-open', 60);
  assert.equal(await dirty().isVisible(), false);
  assert.deepEqual(f.report.downloads, []);
});
