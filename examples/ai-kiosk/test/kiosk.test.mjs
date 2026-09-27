// node --test examples/ai-kiosk/test/   (stub generator, no CLI; needs the prebuilt kit, see README)
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { sanitize, tokenize } from '../lib/sanitize.mjs';
import { claudeGenerator, stubGenerator, extractFragment } from '../lib/generators.mjs';
import { createKioskServer, safeResolve } from '../server.mjs';

// ---------------- sanitiser (generic adversarial shapes) ----------------
const S = (h) => sanitize(h, { itemIds: new Set(['latte']) }).html;

test('keeps allowed tags, class and valid data-* only', () => {
  assert.equal(S('<div class="p-4 text-lg"><button data-action="start" data-item="latte" data-option="M">Go</button></div>'),
    '<div class="p-4 text-lg"><button data-action="start" data-item="latte" data-option="M" type="button">Go</button></div>');
});
test('drops raw-text / embedding elements with their content', () => {
  for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'noscript', 'textarea', 'form'])
    assert.equal(S(`<p>a</p><${tag} x="1"><b>inner</b></${tag}><p>b</p>`), '<p>a</p><p>b</p>', tag);
  assert.equal(S('<p>a<link rel="x" href="y"><meta content="z">b</p>'), '<p>ab</p>');
});
test('nested and mixed-case dropped elements', () => {
  assert.equal(S('<SCRIPT>x<script>y</script>z</ScRiPt><p>ok</p>'), '<p>ok</p>');
});
test('strips every event-handler, style and URL-bearing attribute', () => {
  const out = S('<div onclick="x" OnMouseOver=y onx class="a" style="color:red" href="h" src="s" srcset="s" action="a" formaction="f" background="b" xlink:href="x" poster="p" data-url="u">t</div>');
  assert.equal(out, '<div class="a">t</div>');
});
test('drops class tokens carrying url( in any case', () => {
  assert.equal(S('<div class="p-4 bg-[url(x)] BG-[URL(y)] text-lg [mask:Url(z)]">t</div>'), '<div class="p-4 text-lg">t</div>');
});
test('removes non-contract data-action and unknown data-item', () => {
  const r = sanitize('<button data-action="delete-everything" data-item="nope">x</button>', { itemIds: new Set(['latte']) });
  assert.equal(r.html, '<button type="button">x</button>');
  assert.equal(r.removed.actions, 1);
});
test('unwraps disallowed but harmless tags, keeps text', () => {
  assert.equal(S('<a href="h"><img src="s">link</a><input value="v"><custom-el>c</custom-el>'), 'linkc');
});
test('escapes text and attribute values; entities cannot smuggle markup', () => {
  assert.equal(S('<p>&lt;b&gt; 1 &amp; 2 "q"</p>'), '<p>&lt;b&gt; 1 &amp; 2 &quot;q&quot;</p>');
  assert.equal(S('<p class="&quot;&gt;&lt;x">t</p>'), '<p>t</p>'); // quote / angle chars rejected in class tokens
  assert.equal(S('<p data-option="a&#x22;b">t</p>'), '<p>t</p>');
});
test('comments, doctype, processing instructions, CDATA vanish', () => {
  assert.equal(S('<!doctype html><!-- c <script> --><?pi x?><![CDATA[ d ]]><p>x</p>'), '<p>x</p>');
  assert.equal(S('<p>x</p><!-- unterminated <script>'), '<p>x</p>');
});
test('unterminated tags / quotes drop the rest instead of leaking', () => {
  assert.equal(S('<p>ok</p><div class="a'), '<p>ok</p>');
  assert.equal(S('<p>ok</p><div onclick=x'), '<p>ok</p>');
});
test('attribute parsing edge shapes', () => {
  assert.equal(S('<div/onclick="x"/class="a">t</div>'), '<div class="a">t</div>');
  assert.equal(S('<div class=a onclick = "x" class="b">t</div>'), '<div class="a">t</div>');
  assert.equal(S('<div ="x" class="a">t</div>'), '<div class="a">t</div>');
  assert.equal(S('<div\nclass\n=\n"a"\tonload=x>t</div>'), '<div class="a">t</div>');
});
test('stray and mismatched end tags are balanced', () => {
  assert.equal(S('</div><p><b>x</p>y</b>'), '<p><b>x</b></p>y');
  assert.equal(S('<div><span>open'), '<div><span>open</span></div>');
});
test('lone < and > in text are escaped', () => {
  assert.equal(S('a < b > c <3 </ 4'), 'a &lt; b &gt; c &lt;3 ');
});
test('sanitise is idempotent', () => {
  const once = S('<div class="a" onclick="x"><p>&amp;<b>t</div>');
  assert.equal(S(once), once);
});
test('tokenizer never emits a tag token for text-looking input', () => {
  assert.deepEqual(tokenize('1 <2').map((t) => t.type), ['text']);
});
test('extractFragment strips fences', () => {
  assert.equal(extractFragment('```html\n<p>x</p>\n```'), '<p>x</p>');
});

// ---------------- spawn args (mocked spawn, no CLI) ----------------
function fakeSpawn(calls, { stdout, code = 0, hang = false } = {}) {
  return (cmd, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    let stdin = '';
    child.stdin = Object.assign(new EventEmitter(), { end: (d) => { stdin += d; calls.push({ cmd, args, opts, stdin });
      if (!hang) setImmediate(() => { child.stdout.emit('data', stdout); child.emit('close', code); }); } });
    child.kill = (sig) => { child.killed = sig; };
    return child;
  };
}
test('claude generator: no shell, fixed argv, prompt only on stdin', async () => {
  const calls = [];
  const g = claudeGenerator({ model: 'sonnet', spawn: fakeSpawn(calls, { stdout: JSON.stringify({ result: '```html\n<p>hi</p>\n```', duration_api_ms: 5 }) }) });
  const prompt = 'PROMPT "$(x)" `y` ; | & --model opus';
  const out = await g.generate({ prompt });
  assert.equal(out.html, '<p>hi</p>');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'claude');
  assert.deepEqual(calls[0].args, ['-p', '--model', 'sonnet', '--output-format', 'json']);
  assert.equal(calls[0].opts.shell, false);
  assert.equal(calls[0].stdin, prompt);
  assert.ok(!calls[0].args.some((a) => a.includes('PROMPT')));
});
test('claude generator: rejects models outside the list', () => {
  assert.throws(() => claudeGenerator({ model: 'haiku; rm' }));
});
test('claude generator: timeout kills the child', async () => {
  const calls = [];
  const g = claudeGenerator({ timeoutMs: 20, spawn: fakeSpawn(calls, { hang: true }) });
  await assert.rejects(g.generate({ prompt: 'p' }), /timed out/);
});
test('claude generator: oversized output is rejected', async () => {
  const g = claudeGenerator({ maxOutput: 10, spawn: fakeSpawn([], { stdout: 'x'.repeat(50) }) });
  await assert.rejects(g.generate({ prompt: 'p' }), /too large/);
});
test('claude generator: non-zero exit / error result rejected', async () => {
  await assert.rejects(claudeGenerator({ spawn: fakeSpawn([], { stdout: '{}', code: 1 }) }).generate({ prompt: 'p' }), /exited 1/);
  await assert.rejects(claudeGenerator({ spawn: fakeSpawn([], { stdout: '{"is_error":true,"result":"x"}' }) }).generate({ prompt: 'p' }), /error result/);
});

// ---------------- static path traversal ----------------
test('safeResolve stays inside the root', () => {
  const root = '/srv/kiosk';
  assert.equal(safeResolve(root, '/kiosk.js'), path.join(root, 'kiosk.js'));
  for (const p of ['/../etc/x', '/%2e%2e/%2e%2e/x', '/a/../../x', '/..%5cx', '/x%00y', '/%E0%A4%A']) {
    const r = safeResolve(root, p);
    assert.ok(r === null || r.startsWith(root + path.sep), p);
  }
});

// ---------------- full flow (stub generator, real HTTP on 127.0.0.1) ----------------
async function withServer(fn) {
  const server = createKioskServer({ generator: stubGenerator() });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}
const post = async (base, body) => { const r = await fetch(`${base}/screen`, { method: 'POST', body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };

for (const persona of ['senior', 'regular', 'family', 'foreign']) {
  test(`full order flow: ${persona}`, async () => {
    await withServer(async (base) => {
      let { data } = await post(base, {});
      assert.equal(data.facts.step, 'start');
      const session = data.session;
      const act = async (action, item, option) => {
        const r = await post(base, { session, action, item, option });
        assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.data)}`);
        assert.deepEqual(r.data.noop.unstyled, [], `unstyled at ${r.data.facts.step}`);
        assert.ok(!/on\w+=|<script|href=|src=/i.test(r.data.html));
        return r.data;
      };
      data = await act('start'); assert.equal(data.facts.step, 'persona');
      data = await act('choose-persona', undefined, persona); assert.equal(data.facts.step, 'menu');
      assert.match(data.html, /data-action="select-item" data-item="latte"/);
      data = await act('select-item', 'latte'); assert.equal(data.facts.step, 'options');
      data = await act('set-size', undefined, 'L');
      data = await act('toggle-option', undefined, 'oat-milk');
      assert.equal(data.facts.current.price, 4500 + 1000 + 600);
      data = await act('add-to-cart'); assert.equal(data.facts.step, 'cart');
      data = await act('open-menu');
      data = await act('select-item', 'croissant');
      data = await act('add-to-cart');
      assert.equal(data.facts.total, 6100 + 3200);
      data = await act('checkout'); assert.equal(data.facts.step, 'pay');
      data = await act('pay'); assert.equal(data.facts.step, 'done');
      assert.ok(data.facts.orderNo >= 100);
      data = await act('restart'); assert.equal(data.facts.step, 'start');
    });
  });
}

test('server rejects actions outside the contract and bad items', async () => {
  await withServer(async (base) => {
    const { data } = await post(base, {});
    assert.equal((await post(base, { session: data.session, action: 'refund' })).status, 422);
    assert.equal((await post(base, { session: data.session, action: 'select-item', item: '../x' })).status, 422);
    assert.equal((await post(base, { session: data.session, action: 'pay' })).status, 422); // not at payment
  });
});
test('regenerate bumps the variant and keeps state', async () => {
  await withServer(async (base) => {
    const a = (await post(base, {})).data;
    const b = (await post(base, { session: a.session, action: 'regenerate' })).data;
    assert.equal(b.facts.step, 'start');
    assert.notEqual(a.html, b.html);
  });
});
test('static: serves only allowlisted files', async () => {
  await withServer(async (base) => {
    const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
    assert.match(csp, /default-src 'self'/); assert.match(csp, /img-src 'self';/); assert.match(csp, /style-src 'self';/);
    assert.ok(!csp.includes('unsafe-inline'));
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/lib/sanitize.mjs`)).status, 200);
    for (const p of ['/server.mjs', '/../package.json', '/%2e%2e/package.json', '/vendor/../server.mjs', '/test/kiosk.test.mjs'])
      assert.equal((await fetch(`${base}${p}`)).status, 404, p);
  });
});
