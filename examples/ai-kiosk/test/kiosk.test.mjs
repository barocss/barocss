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
test('img: kept only with an allow-listed same-origin asset src, plus class and alt', () => {
  assert.equal(S('<img src="/assets/a-b1.svg" alt="A cup" class="h-10 w-10">'), '<img src="/assets/a-b1.svg" alt="A cup" class="h-10 w-10">');
  assert.equal(S('<img alt="x" src="/assets/x.png"><img src="/assets/y.webp">'), '<img alt="x" src="/assets/x.png"><img src="/assets/y.webp">');
  assert.equal(S('<img src="/assets/x.svg" onerror="z" style="s" data-action="start" width="9">'), '<img src="/assets/x.svg">');
  assert.equal(S('<p><img src="/assets/x.svg">t</img></p>'), '<p><img src="/assets/x.svg">t</p>');
});
test('img: every other src form drops the whole tag', () => {
  for (const src of ['https://e.example/x.svg', '//e.example/x.svg', 'http://127.0.0.1/assets/x.svg', 'data:image/svg+xml,<svg>', 'javascript:x',
    '/assets/../server.mjs', '/assets/%2e%2e/x.svg', '/assets/x.svg?y=1', '/assets/x.svg#f', '/assets/X.SVG', '/assets/x.gif', '/assets/sub/x.svg',
    '/assets/x.svg/', ' /assets/x.svg', 'assets/x.svg', '/vendor/x.svg', '/assets/.svg', '/assets/x.svg\n', '&#47;assets&#47;x.svg&#10;', ''])
    assert.equal(S(`<p>a<img src="${src}" alt="z">b</p>`), '<p>ab</p>', src);
  assert.equal(S('<p>a<img alt="no src">b</p>'), '<p>ab</p>');
  assert.equal(S('<p>a<img src="/assets/x.svg" src="https://e.example/y">b</p>'), '<p>ab</p>'); // duplicate src
  assert.equal(S('<p>a<img srcset="/assets/x.svg 1x">b</p>'), '<p>ab</p>');
  assert.equal(S('<div src="/assets/x.svg" alt="x">t</div>'), '<div>t</div>'); // src/alt only on img
});
test('img: alt is plain escaped text, control characters rejected, length capped', () => {
  assert.equal(S('<img src="/assets/x.svg" alt="&quot;&gt;<b>">'), '<img src="/assets/x.svg" alt="&quot;&gt;<b>">'.replace('<b>', '&lt;b&gt;'));
  assert.equal(S('<img src="/assets/x.svg" alt="a&#10;b">'), '<img src="/assets/x.svg">');
  assert.equal(S(`<img src="/assets/x.svg" alt="${'a'.repeat(300)}">`), `<img src="/assets/x.svg" alt="${'a'.repeat(120)}">`);
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
        assert.ok(!/on\w+=|<script|href=/i.test(r.data.html));
        for (const [, src] of r.data.html.matchAll(/src="([^"]*)"/g)) assert.match(src, /^\/assets\/[a-z0-9-]+\.svg$/);
        assert.ok(r.data.facts.step === 'start' || r.data.facts.step === 'done' || /<img src="\/assets\//.test(r.data.html));
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
test('static: /assets serves only plain asset names with the right type', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/assets/latte.svg`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/svg+xml');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await r.text(), /^<svg /);
    for (const p of ['/assets/../server.mjs', '/assets/%2e%2e/server.mjs', '/assets/..%2fserver.mjs', '/assets/nope.svg', '/assets/LATTE.svg',
      '/assets/latte.svg.bak', '/assets/', '/assets/sub/x.svg', '/assets/%6catte.svg'])
      assert.equal((await fetch(`${base}${p}`)).status, 404, p);
  });
});
test('every image the menu and stub use exists and matches the asset rule', async () => {
  const fs = await import('node:fs');
  const { menu } = await import('../server.mjs');
  const { isAsset } = await import('../lib/contract.mjs');
  const srcs = [...menu.items.map((i) => i.image), ...menu.categories.map((c) => c.icon), ...Object.values(menu.assets)];
  for (const s of srcs) {
    assert.ok(isAsset(s), s);
    assert.ok(fs.existsSync(new URL(`..${s}`, import.meta.url)), s);
  }
});

// ---------------- #443: order method, chrome, menu variety, required options ----------------
async function session(base) {
  const { data } = await post(base, {});
  const id = data.session;
  return async (action, item, option, want = 200) => {
    const r = await post(base, { session: id, action, item, option });
    assert.equal(r.status, want, `${action} ${item ?? ''} ${option ?? ''}: ${JSON.stringify(r.data).slice(0, 200)}`);
    if (want === 200) assert.deepEqual(r.data.noop.unstyled, [], `unstyled at ${r.data.facts.step}`);
    return r.data;
  };
}
test('order-method screen: touch, low-posture and voice (mock) entries; bad method rejected', async () => {
  await withServer(async (base) => {
    const act = await session(base);
    const d0 = (await post(base, {})).data;
    for (const m of ['touch', 'low', 'voice']) assert.match(d0.html, new RegExp(`data-action="order-method" data-option="${m}"`));
    assert.match(d0.html, /data-action="toggle-contrast"/);
    await act('order-method', undefined, 'wheelchair', 422);
    await act('voice-start', undefined, undefined, 422); // only on the voice screen
    let d = await act('order-method', undefined, 'voice'); assert.equal(d.facts.step, 'voice');
    assert.match(d.html, /data-action="voice-start"/);
    d = await act('back'); assert.equal(d.facts.step, 'start');
    await act('order-method', undefined, 'voice');
    d = await act('voice-start'); assert.equal(d.facts.step, 'persona');
  });
});
test('low-posture mode: content in the lower part, fewer items per page, a way back', async () => {
  await withServer(async (base) => {
    const act = await session(base);
    let d = await act('order-method', undefined, 'low');
    assert.equal(d.facts.ui.mode, 'low'); assert.equal(d.facts.step, 'persona');
    d = await act('choose-persona', undefined, 'family');
    assert.equal(d.facts.view.pageSize, 3); assert.equal(d.facts.view.items.length, 3);
    assert.match(d.html, /<main class="flex h-full flex-col[^"]*"><div class="flex h-2\/5 shrink-0/);
    assert.match(d.html, /data-action="order-method" data-option="touch"/);
    d = await act('order-method', undefined, 'touch');
    assert.equal(d.facts.ui.mode, 'touch'); assert.equal(d.facts.view.pageSize, 6);
    assert.doesNotMatch(d.html, /h-2\/5/);
  });
});
test('chrome on every step: home, language, breadcrumb, back, zoom, call and the live order-N button', async () => {
  await withServer(async (base) => {
    const act = await session(base);
    await act('start');
    let d = await act('choose-persona', undefined, 'senior');
    for (const re of [/data-action="restart"/, /data-action="set-lang" data-option="en"/, /data-action="back"/, /data-action="toggle-zoom"/, /data-action="call-staff"/, /메뉴보기/])
      assert.match(d.html, re);
    assert.doesNotMatch(d.html, /data-action="view-cart"/); // 0 items: the order button is a greyed span
    assert.match(d.html, /0개 주문하기/);
    d = await act('select-item', 'latte'); await act('set-size', undefined, 'M');
    d = await act('set-qty', undefined, 'inc'); assert.equal(d.facts.current.qty, 2); assert.equal(d.facts.current.lineTotal, 10000);
    await act('set-qty', undefined, 'up', 422);
    d = await act('add-to-cart'); assert.equal(d.facts.cartCount, 2); assert.equal(d.facts.crumb, 'review');
    d = await act('open-menu');
    assert.match(d.html, /data-action="view-cart"[^>]*>2개 주문하기</);
    d = await act('add-to-cart', 'croissant'); assert.equal(d.facts.cartCount, 3); assert.equal(d.facts.total, 10000 + 3200);
    d = await act('open-menu'); assert.match(d.html, />3개 주문하기</);
    d = await act('call-staff'); assert.equal(d.facts.ui.toast, 'staff'); assert.match(d.html, /직원을 호출했어요/);
    d = await act('set-lang', undefined, 'en'); assert.equal(d.facts.ui.toast, null); assert.match(d.html, />Order 3 items</);
    d = await act('toggle-contrast'); assert.match(d.html, /bg-black text-white/);
    d = await act('toggle-zoom'); assert.equal(d.facts.ui.zoom, true); assert.equal(d.facts.view.pageSize, 4);
    d = await act('toggle-zoom'); assert.equal(d.facts.ui.zoom, false);
    await act('set-lang', undefined, 'fr', 422);
  });
});
test('pagination within a category; out-of-range pages rejected', async () => {
  await withServer(async (base) => {
    const act = await session(base);
    await act('start'); await act('choose-persona', undefined, 'foreign');
    let d = await act('set-category', undefined, 'coffee');
    assert.equal(d.facts.view.pages, 2); assert.equal(d.facts.view.items.length, 6);
    assert.match(d.html, /1\/2/); assert.match(d.html, /data-action="page" data-option="next"/); assert.doesNotMatch(d.html, /data-option="prev"/);
    await act('page', undefined, 'prev', 422);
    d = await act('page', undefined, 'next'); assert.equal(d.facts.view.page, 1); assert.equal(d.facts.view.items.length, 2);
    assert.match(d.html, /2\/2/); assert.doesNotMatch(d.html, /data-option="next"/);
    await act('page', undefined, 'next', 422);
    await act('page', undefined, '3', 422);
    await act('set-category', undefined, 'secret', 422);
    d = await act('set-category', undefined, 'bundle');
    assert.ok(d.facts.view.items.every((i) => i.bundle)); assert.match(d.html, /translate-x-2 -translate-y-2/); assert.match(d.html, /x10/);
  });
});
test('sold-out items are labelled, not tappable, and rejected by the server', async () => {
  await withServer(async (base) => {
    const act = await session(base);
    await act('start'); await act('choose-persona', undefined, 'regular');
    const d = await act('set-category', undefined, 'coffee');
    assert.equal(d.facts.view.pages, 1); // 8 per page for the busy regular
    assert.ok(d.facts.view.items.find((i) => i.id === 'cold-brew').soldOut);
    assert.doesNotMatch(d.html, /data-item="cold-brew"/);
    assert.match(d.html, /grayscale/); assert.match(d.html, /품절/);
    await act('select-item', 'cold-brew', undefined, 422);
    await act('add-to-cart', 'cold-brew', undefined, 422);
  });
});
test('required options: add stays disabled and the server rejects it until size and temperature are chosen', async () => {
  await withServer(async (base) => {
    const act = await session(base);
    await act('start'); await act('choose-persona', undefined, 'family');
    await act('add-to-cart', 'vanilla-latte', undefined, 422); // no one-tap for items with required choices
    let d = await act('select-item', 'americano');
    assert.deepEqual(d.facts.current.missing, ['size', 'temp']); assert.equal(d.facts.current.ready, false);
    assert.doesNotMatch(d.html, /data-action="add-to-cart"/); assert.match(d.html, /옵션을 선택해주세요/);
    assert.match(d.html, /\(필수\)/); assert.match(d.html, /\(선택\)/);
    await act('add-to-cart', undefined, undefined, 422);
    d = await act('set-size', undefined, 'L'); assert.deepEqual(d.facts.current.missing, ['temp']);
    await act('add-to-cart', undefined, undefined, 422);
    await act('set-temp', undefined, 'warm', 422);
    d = await act('set-temp', undefined, 'iced'); assert.equal(d.facts.current.ready, true);
    assert.match(d.html, /data-action="add-to-cart"/);
    d = await act('toggle-option', undefined, 'extra-shot'); assert.equal(d.facts.current.price, 3500 + 1000 + 500); // menu.json only
    d = await act('add-to-cart'); assert.equal(d.facts.total, 5000);
    await act('open-menu');
    await act('set-temp', undefined, 'hot', 422); // nothing being customised
    d = await act('select-item', 'croissant'); assert.equal(d.facts.current.ready, true); // no required groups
  });
});
test('client pre-check mirrors the fixed option sets', async () => {
  const { isValidPress } = await import('../lib/contract.mjs');
  assert.ok(isValidPress('order-method', 'low')); assert.ok(!isValidPress('order-method', 'x'));
  assert.ok(isValidPress('select-item', undefined)); assert.ok(!isValidPress('refund', undefined));
  assert.ok(!isValidPress('page', undefined)); assert.ok(isValidPress('set-size', 'L'));
});
test('prompt carries the chrome and the new step goals', async () => {
  const { buildPrompt } = await import('../lib/prompt.mjs');
  const { facts, newState } = await import('../lib/order.mjs');
  const { menu } = await import('../server.mjs');
  const p = buildPrompt({ menu, facts: facts(menu, newState()) });
  for (const s of ['CHROME', 'order-method', 'set-temp', 'soldOut', 'facts.cartCount', 'low-posture']) assert.ok(p.includes(s), s);
  assert.ok(!p.includes('"usual"'));
});
