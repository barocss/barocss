// #193 in-iframe stream driver + probe. Loaded from the allowlisted CDN after the styling runtime. window.__CFG =
// { arm, mode, rate, preload, chunks }. Modes: O one-shot innerHTML; A innerHTML re-assignment of the growing prefix;
// R repaired prefix (see repair()); B incremental DOM ops per completed element (class set once); J class set once with half its tokens, then extended
// to the full list at the element's close tag (json-render JSONL-patch style).
(function () {
  var C = window.__CFG, root = document.getElementById('root');
  var HTML = C.chunks.join('');
  // Class-driven, layout-independent properties (width/height change as content streams in, so they are excluded).
  var PROPS = ['display', 'position', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'max-width',
    'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'color',
    'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color',
    'border-top-left-radius', 'box-shadow', 'opacity', 'transform', 'gap', 'grid-template-columns',
    'flex-direction', 'justify-content', 'align-items'];
  var FINAL = []; HTML.replace(/class="([^"]*)"/g, function (_, c) { FINAL.push(c); });
  var FINAL_TOK = {}; FINAL.forEach(function (c) { c.split(/\s+/).forEach(function (t) { if (t) FINAL_TOK[t] = 1; }); });
  var seenTok = {}, tFinal = [], frames = [], dict = {}, dictN = 0;
  var churn = { samples: 0, added: 0, removed: 0, everRules: 0, maxRules: 0 }, prevRules = null, ever = {};

  function sig(el) { var cs = getComputedStyle(el); var s = PROPS.map(function (p) { return cs.getPropertyValue(p); }).join('|'); if (!(s in dict)) dict[s] = dictN++; return dict[s]; }
  function leafRules() {
    var out = [];
    (function walk(list) { for (var i = 0; i < list.length; i++) { var r = list[i]; if (r.cssRules && r.cssRules.length && !r.selectorText) walk(r.cssRules); else out.push(r.cssText); } })
    ([].concat.apply([], [].map.call(document.styleSheets, function (s) { try { return [].slice.call(s.cssRules); } catch (e) { return []; } })));
    return out;
  }
  function sheetBytes() { var n = 0; [].forEach.call(document.styleSheets, function (s) { try { [].forEach.call(s.cssRules, function (r) { n += r.cssText.length; }); } catch (e) {} }); return n; }
  function scan() { // after every DOM step: which elements now carry their final class list; which tokens were ever seen
    var els = root.querySelectorAll('[class]'), now = performance.now();
    for (var k = 0; k < els.length; k++) {
      var c = els[k].getAttribute('class');
      c.split(/\s+/).forEach(function (t) { if (t) seenTok[t] = 1; });
      if (tFinal[k] == null && c === FINAL[k]) tFinal[k] = now;
    }
  }
  var streaming = true;
  function frame(now) {
    var els = root.querySelectorAll('[class]'), row = [];
    for (var k = 0; k < els.length; k++) row.push(tFinal[k] != null && els[k].getAttribute('class') === FINAL[k] && els[k].getClientRects().length ? sig(els[k]) : -1);
    frames.push([now, row]);
    if (streaming) {
      var rules = leafRules(), set = {}; churn.samples++;
      rules.forEach(function (r) { set[r] = 1; if (!ever[r]) { ever[r] = 1; churn.everRules++; } });
      if (prevRules) { for (var r in set) if (!prevRules[r]) churn.added++; for (var q in prevRules) if (!set[q]) churn.removed++; }
      prevRules = set; if (rules.length > churn.maxRules) churn.maxRules = rules.length;
    }
    if (!done) requestAnimationFrame(frame);
  }

  // Tag-level events with source offsets, for modes B and J.
  var VOID = { area: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, wbr: 1 };
  var ev = [], re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|[^<]+/g, m;
  var ta = document.createElement('textarea');
  while ((m = re.exec(HTML))) {
    var end = m.index + m[0].length;
    if (m[1]) ev.push({ at: end, t: 'close' });
    else if (m[2]) {
      var attrs = [], ar = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, a;
      while ((a = ar.exec(m[3] || ''))) attrs.push([a[1], a[2] != null ? a[2] : a[3] != null ? a[3] : a[4] != null ? a[4] : '']);
      var o = { at: end, t: 'open', tag: m[2], attrs: attrs };
      ev.push(o);
      if (VOID[m[2].toLowerCase()]) ev.push({ at: end, t: 'close', v: 1 });
    } else if (m[0][0] !== '<') { ta.innerHTML = m[0]; ev.push({ at: end, t: 'text', s: ta.value }); }
  }
  ev.sort(function (x, y) { return x.at - y.at; });
  var stack = [root], ei = 0, pendingExt = [];
  function rt() { return window.BaroCSS && BaroCSS.getRuntime({}); }
  function setCls(el, c) { if (C.preload && c) rt().addClass(c.split(/\s+/).filter(Boolean)); el.setAttribute('class', c); }
  function applyTo(cursor) {
    while (ei < ev.length && ev[ei].at <= cursor) {
      var e = ev[ei++], top = stack[stack.length - 1];
      if (e.t === 'text') top.appendChild(document.createTextNode(e.s));
      else if (e.t === 'open') {
        var el = document.createElement(e.tag), cls = null;
        e.attrs.forEach(function (p) { if (p[0] === 'class') cls = p[1]; else el.setAttribute(p[0], p[1]); });
        if (cls != null) {
          if (C.mode === 'J') { var tk = cls.split(/\s+/).filter(Boolean); setCls(el, tk.slice(0, Math.ceil(tk.length / 2)).join(' ')); el.__full = cls; }
          else setCls(el, cls);
        }
        top.appendChild(el); stack.push(el);
      } else { var c = stack.pop(); if (c.__full != null) setCls(c, c.__full); }
    }
  }

  // Mode R: like A, but the prefix is "repaired" the way partial-HTML renderers do (close an open attribute quote and
  // the tag), so a truncated class attribute such as class="bg-blu reaches the DOM. Plain innerHTML drops a tag cut
  // at EOF inside an attribute (HTML spec eof-in-tag), so mode A never shows partial tokens.
  function repair(s) {
    var lt = s.lastIndexOf('<'), gt = s.lastIndexOf('>');
    if (lt <= gt) return s;
    var tail = s.slice(lt);
    if (!/^<[a-zA-Z]/.test(tail)) return s.slice(0, lt);
    return s + (((tail.match(/"/g) || []).length % 2) ? '"' : '') + '>';
  }
  var done = false, t0, i = 0, cursor = 0;
  function step() {
    var now = performance.now(), n0 = i;
    while (i < C.chunks.length && t0 + i * 1000 / C.rate <= now) cursor += C.chunks[i++].length;
    if (i > n0) { if (C.mode === 'A') root.innerHTML = HTML.slice(0, cursor); else if (C.mode === 'R') root.innerHTML = repair(HTML.slice(0, cursor)); else applyTo(cursor); scan(); }
    if (i < C.chunks.length) return setTimeout(step, Math.max(0, t0 + i * 1000 / C.rate - performance.now()));
    endStream();
  }
  function endStream() { streaming = false; setTimeout(finish, 1500); }
  function finish() {
    done = true;
    var els = root.querySelectorAll('[class]'), fin = [].map.call(els, sig);
    var lat = [], unstyled = 0, anyUnstyledFrames = 0, never = 0;
    frames.forEach(function (f) { var bad = 0; f[1].forEach(function (s, k) { if (s >= 0 && s !== fin[k]) { unstyled++; bad = 1; } }); anyUnstyledFrames += bad; });
    for (var k = 0; k < els.length; k++) {
      var hit = null;
      for (var j = 0; j < frames.length; j++) if (frames[j][0] >= tFinal[k] && frames[j][1][k] === fin[k]) { hit = frames[j][0]; break; }
      if (hit == null) never++; else lat.push(hit - tFinal[k]);
    }
    var partial = Object.keys(seenTok).filter(function (t) { return !FINAL_TOK[t]; });
    var rules = leafRules(), sels = [];
    rules.forEach(function (r) { var s = r.slice(0, r.indexOf('{')).trim(); sels.push(s); });
    var esc = function (t) { return '.' + CSS.escape(t); };
    var partialHits = partial.filter(function (t) { var e = esc(t); return sels.some(function (s) { var i = s.indexOf(e); while (i >= 0) { var nx = s.charAt(i + e.length); if (!/[\w\\-]/.test(nx)) return true; i = s.indexOf(e, i + 1); } return false; }); });
    var inv = {}; for (var s in dict) inv[dict[s]] = s;
    parent.postMessage({ probe: true, arm: C.arm, mode: C.mode, rate: C.rate, preload: !!C.preload,
      elements: els.length, finalSig: fin.map(function (x) { return inv[x]; }), latencies: lat, never: never,
      unstyledElementFrames: unstyled, framesWithUnstyled: anyUnstyledFrames, frames: frames.length,
      partialTokens: partial, partialTokensWithRules: partialHits, selectors: sels, rules: rules.length, bytes: sheetBytes(),
      churn: churn, classesMatch: [].every.call(els, function (e, k) { return e.getAttribute('class') === FINAL[k]; }) }, '*');
  }
  setTimeout(function () {
    requestAnimationFrame(frame);
    t0 = performance.now();
    if (C.mode === 'O') { root.innerHTML = HTML; scan(); endStream(); } else step();
  }, 800);
})();
