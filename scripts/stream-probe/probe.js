// #290 in-page probe (first script in <body>): per rAF, the computed-style signature of each VISIBLE [data-chunk]
// section's elements. Ends 2.5s after load; reports window.__r.
(function () {
  var PROPS = ['display', 'padding-top', 'padding-left', 'margin-top', 'font-size', 'font-weight', 'color', 'background-color',
    'border-top-width', 'border-top-left-radius', 'grid-template-columns', 'gap', 'max-width', 'text-align', 'box-shadow'];
  var t0 = performance.now(), chunks = {}, loaded = null;
  function sig(sec) { var els = sec.querySelectorAll('*'), out = [];
    for (var i = 0; i < els.length; i++) { var cs = getComputedStyle(els[i]), s = ''; for (var j = 0; j < PROPS.length; j++) s += cs.getPropertyValue(PROPS[j]) + '|'; out.push(s); }
    return out; }
  function dupRules() { var seen = {}, d = 0;
    function walk(rules, ctx) { for (var i = 0; i < rules.length; i++) { var r = rules[i];
      if (r.selectorText && r.selectorText.indexOf('.') >= 0) { var k = ctx + '|' + r.selectorText; if (seen[k]) d++; else seen[k] = 1; }
      else if (r.cssRules) walk(r.cssRules, ctx + (r.conditionText || r.name || '') + ';'); } }
    [].slice.call(document.styleSheets).forEach(function (s) { var o = s.ownerNode; if (!o || o.tagName !== 'STYLE') return; try { walk(s.cssRules, ''); } catch (e) {} });
    return d; }
  addEventListener('load', function () { loaded = performance.now(); });
  (function tick() {
    var t = performance.now();
    document.querySelectorAll('[data-chunk]').forEach(function (sec) {
      if (!sec.getClientRects().length) return; // still in React's hidden streaming container
      var i = sec.getAttribute('data-chunk'); (chunks[i] = chunks[i] || []).push({ t: t, sig: sig(sec) }); });
    if (loaded == null || t - loaded < 2500) return requestAnimationFrame(tick);
    var sheets = [].slice.call(document.querySelectorAll('style[data-barocss-ssr]')).map(function (s) {
      return { inHead: s.parentNode === document.head, adopted: s.hasAttribute('data-barocss-adopted'), rules: s.sheet ? s.sheet.cssRules.length : -1, bytes: s.textContent.length }; });
    window.__r = { chunks: chunks, dups: dupRules(), sheets: sheets, load: loaded };
  })();
})();
