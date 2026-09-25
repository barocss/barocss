// #182 in-page script: a minimal json-render-style client renderer plus the measurement. After load (runtimes have
// settled on the shell), it mounts every frozen spec into #out, samples computed-style signatures each frame to find
// the time from mount to the final styled state, then reports shell/spec signatures and a stylesheet audit.
(function () {
  var P = window.__PROBE;
  var PROPS = ['display', 'position', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width',
    'height', 'top', 'left', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color',
    'background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius',
    'box-shadow', 'opacity', 'translate', 'gap', 'grid-template-columns', 'flex-direction', 'justify-content',
    'align-items', 'backdrop-filter', 'outline-style', 'box-sizing'];
  function sig(sel) {
    var els = document.querySelectorAll(sel), out = [];
    for (var i = 0; i < els.length; i++) {
      var cs = getComputedStyle(els[i]);
      out.push(PROPS.map(function (p) { return cs.getPropertyValue(p); }));
    }
    return out;
  }
  // json-render-style renderer: flat elements map, Card/Stack/Grid/Text expose className.
  function render(spec, id) {
    var el = spec.elements[id], tag = el.type === 'Text' ? 'p' : 'div';
    var n = document.createElement(tag);
    n.setAttribute('data-spec', id);
    if (el.props && el.props.className) n.className = el.props.className;
    if (el.props && el.props.text) n.textContent = el.props.text;
    (el.children || []).forEach(function (c) { n.appendChild(render(spec, c)); });
    return n;
  }
  // PR #101's preloadJsonRenderClasses(spec, runtime), reproduced verbatim in behaviour.
  function collect(spec) {
    var set = {};
    Object.keys(spec.elements || {}).forEach(function (k) {
      var p = spec.elements[k] && spec.elements[k].props;
      if (p && typeof p.className === 'string') p.className.split(/\s+/).forEach(function (c) { if (c) set[c] = 1; });
    });
    return Object.keys(set);
  }
  function preload(spec, runtime) { var c = collect(spec); if (c.length) runtime.addClass(c); }

  function cls(sel) {
    var out = [], re = /\.((?:\\.|[^\s.:>,\[\]()#~+*])+)/g, m;
    while ((m = re.exec(sel))) out.push(m[1].replace(/\\(.)/g, '$1'));
    return out;
  }
  function walk(rules, acc) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.selectorText != null) acc.push(r.selectorText);
      if (r.cssRules && r.cssRules.length) walk(r.cssRules, acc);
    }
    return acc;
  }
  function audit() {
    var sheets = [].slice.call(document.styleSheets).concat(document.adoptedStyleSheets || []);
    var built = {}, injected = [], injectedBytes = 0, preflights = { built: 0, injected: 0 };
    var isPreflight = function (s) { return /^\*,\s*::after,\s*::before/.test(s) || /^\*, ::before, ::after/.test(s) || /^html,\s*:host$/.test(s); };
    sheets.forEach(function (sh) {
      var isBuilt = sh.ownerNode && sh.ownerNode.tagName === 'LINK';
      var rules; try { rules = sh.cssRules; } catch (e) { return; }
      var sels = walk(rules, []);
      if (isBuilt) {
        sels.forEach(function (s) { cls(s).forEach(function (c) { built[c] = 1; }); if (isPreflight(s)) preflights.built++; });
      } else {
        for (var i = 0; i < rules.length; i++) injectedBytes += rules[i].cssText.length;
        sels.forEach(function (s) { injected.push(s); if (isPreflight(s)) preflights.injected++; });
      }
    });
    var dupSet = {};
    injected.forEach(function (s) { cls(s).forEach(function (c) { if (built[c]) dupSet[c] = 1; }); });
    return { injectedRules: injected.length, injectedBytes: injectedBytes, preflights: preflights,
      duplicateClasses: Object.keys(dupSet).length, duplicateSample: Object.keys(dupSet).slice(0, 8),
      sheets: sheets.length };
  }

  function run() {
    var shellBefore = JSON.stringify(sig('[data-shell]'));
    if (P.arm === 'baropre') {
      var rt = BaroCSS.getRuntime({});
      P.specNames.forEach(function (k) { preload(P.specs[k], rt); });
    }
    var out = document.getElementById('out'), t0 = performance.now();
    P.specNames.forEach(function (k) { var w = document.createElement('section'); w.setAttribute('data-specroot', k); w.appendChild(render(P.specs[k], P.specs[k].root)); out.appendChild(w); });
    var frames = [];
    (function tick() {
      var now = performance.now();
      frames.push([now - t0, JSON.stringify(sig('[data-spec]'))]);
      if (now - t0 < 2000) return requestAnimationFrame(tick);
      var fin = frames[frames.length - 1][1], first = null;
      for (var i = 0; i < frames.length; i++) if (frames[i][1] === fin) { first = frames[i][0]; break; }
      window.__r = { arm: P.arm, mountToFinalMs: first, specSig: JSON.parse(fin), specIds: [].map.call(document.querySelectorAll('[data-spec]'), function (e) { return e.getAttribute('data-spec'); }),
        shellSig: sig("[data-shell]"), shellSigBefore: JSON.parse(shellBefore),
        audit: audit(), props: PROPS };
    })();
  }
  addEventListener('load', function () { setTimeout(run, 500); });
})();
