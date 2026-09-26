// #266 in-page probe (inlined first in <head>): sample the block elements' computed style every rAF (i.e. what the
// next paint shows), plus FCP / LCP / CLS, until load + 2s. Reports window.__r.
(function () {
  var PROPS = ['display', 'padding-top', 'padding-left', 'margin-top', 'font-size', 'font-weight', 'color', 'background-color',
    'border-top-width', 'border-top-left-radius', 'grid-template-columns', 'gap', 'max-width', 'text-align', 'box-shadow'];
  var frames = [], fcp = null, lcp = null, cls = 0, loaded = null;
  function sig() {
    var els = document.querySelectorAll('#blocks *'), out = [];
    for (var i = 0; i < els.length; i++) { var cs = getComputedStyle(els[i]), s = ''; for (var j = 0; j < PROPS.length; j++) s += cs.getPropertyValue(PROPS[j]) + '|'; out.push(s); }
    return out;
  }
  try {
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (e.name === 'first-contentful-paint') fcp = e.startTime; }); }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver(function (l) { var e = l.getEntries(); lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (!e.hadRecentInput) cls += e.value; }); }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  function runtimeBytes() {
    var n = 0, sh = [].slice.call(document.styleSheets).concat(document.adoptedStyleSheets || []);
    sh.forEach(function (s) { var o = s.ownerNode; if (o && (o.tagName === 'LINK' || o.hasAttribute('data-barocss-ssr') || /animation:none/.test(o.textContent))) return;
      try { for (var i = 0; i < s.cssRules.length; i++) n += s.cssRules[i].cssText.length; } catch (e) {} });
    return n;
  }
  // #268: duplicate class style rules (same @media/@container context + selector containing a class) across inline <style> sheets (server + client).
  function dupRules() {
    var seen = {}, d = 0;
    function walk(rules, ctx) { for (var i = 0; i < rules.length; i++) { var r = rules[i];
      if (r.selectorText && r.selectorText.indexOf('.') >= 0) { var k = ctx + '|' + r.selectorText; if (seen[k]) { d++; (window.__dupKeys = window.__dupKeys || []).push(k); } else seen[k] = 1; }
      else if (r.cssRules) walk(r.cssRules, ctx + (r.conditionText || r.name || '') + ';'); } }
    [].slice.call(document.styleSheets).forEach(function (s) { var o = s.ownerNode; if (!o || o.tagName !== 'STYLE' || /animation:none/.test(o.textContent)) return;
      try { walk(s.cssRules, ''); } catch (e) {} });
    return d;
  }
  var addT = null;
  // #268 later client addition: one block of new classes, inserted 1s after load (after hydration).
  addEventListener('load', function () { loaded = performance.now(); setTimeout(function () {
    addT = performance.now(); document.getElementById('blocks').insertAdjacentHTML('beforeend', window.__ADD); }, 1000); });
  (function tick() {
    var t = performance.now();
    if (document.getElementById('blocks')) frames.push({ t: t, sig: sig() });
    if (loaded == null || t - loaded < 2500) return requestAnimationFrame(tick);
    window.__r = { frames: frames, final: frames[frames.length - 1].sig, fcp: fcp, lcp: lcp, cls: cls, load: loaded, runtimeBytes: runtimeBytes(), addT: addT, dupRules: dupRules(), dupKeys: (window.__dupKeys || []).slice(0, 12) };
  })();
})();
