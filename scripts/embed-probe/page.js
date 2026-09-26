// #320 in-page script: embed N widgets (open shadow / closed shadow / plain div) after load, then measure.
(function () {
  var P = window.__PROBE; // { mode, arm, n, html, refCss }
  var PROPS = ['display', 'position', 'margin-top', 'margin-bottom', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width',
    'height', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'color',
    'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color', 'border-left-width',
    'border-top-left-radius', 'box-shadow', 'opacity', 'transform', 'gap', 'grid-template-columns', 'flex-direction',
    'justify-content', 'align-items', 'text-align', 'text-decoration-line', 'list-style-type', 'visibility'];
  var roots = []; // widget wrappers ([data-w]) and their tree roots (ShadowRoot or document)
  function sigEls(els) { return els.map(function (el) { var cs = getComputedStyle(el); return PROPS.map(function (p) { return cs.getPropertyValue(p); }); }); }
  function hostSig() { return sigEls([].slice.call(document.querySelectorAll('[data-host]'))); }
  function widgetEls(i) { var w = roots[i].wrap; return [w].concat([].slice.call(w.querySelectorAll('*'))); }
  function sheetBytes(list) {
    var b = 0;
    [].forEach.call(list, function (sh) {
      if (sh.ownerNode && sh.ownerNode.hasAttribute && sh.ownerNode.hasAttribute('data-hostcss')) return;
      var rs; try { rs = sh.cssRules; } catch (e) { return; }
      for (var i = 0; i < rs.length; i++) b += rs[i].cssText.length;
    });
    return b;
  }
  function styleBytes() {
    var b = sheetBytes(document.styleSheets) + sheetBytes(document.adoptedStyleSheets || []);
    roots.forEach(function (r) { if (r.sr) b += sheetBytes(r.sr.styleSheets) + sheetBytes(r.sr.adoptedStyleSheets || []); });
    return b;
  }
  var containerRt = null;
  function embed(i, box) {
    var wrap = document.createElement('div'); wrap.setAttribute('data-w', i); wrap.className = 'widget-root';
    var sr = null, tree;
    if (P.mode === 'open' || P.mode === 'closed') {
      var el = document.createElement('ai-widget'); box.appendChild(el);
      sr = el.attachShadow({ mode: P.mode }); tree = sr; // closed: only the embedder holds the reference
    } else {
      tree = document.createElement('div'); tree.setAttribute('data-embed', i); box.appendChild(tree);
    }
    if (P.arm === 'ref' && sr) { var s = document.createElement('style'); s.textContent = P.refCss; sr.appendChild(s); }
    var styleHost = null;
    if (P.arm.indexOf('baroRoute') === 0 && sr) { styleHost = document.createElement('div'); styleHost.setAttribute('data-stylehost', ''); styleHost.style.display = 'none'; sr.appendChild(styleHost); }
    tree.appendChild(wrap);
    wrap.innerHTML = P.html + '<p data-dyn>dynamic</p>';
    if (P.arm.indexOf('baroRoute') === 0) {
      var cfg = P.arm === 'baroRouteP' ? {} : { preflight: false };
      if (sr) new BaroCSS.BrowserRuntime({ insertionPoint: styleHost, config: cfg }).observe(wrap, { scan: true });
      else { containerRt = containerRt || BaroCSS.getRuntime({ config: cfg }); containerRt.observe(document.getElementById('widgets'), { scan: true }); }
    }
    roots.push({ wrap: wrap, sr: sr });
  }
  function run() {
    var hostBefore = hostSig(), bytesBefore = styleBytes(), box = document.getElementById('widgets'), t0 = performance.now();
    for (var i = 0; i < P.n; i++) embed(i, box);
    var frames = [];
    (function tick() {
      var now = performance.now();
      frames.push([now - t0, JSON.stringify(sigEls(widgetEls(P.n - 1)))]);
      if (now - t0 < 1500) return requestAnimationFrame(tick);
      var fin = frames[frames.length - 1][1], first = null;
      for (var k = 0; k < frames.length; k++) if (frames[k][1] === fin) { first = frames[k][0]; break; }
      var dyn = roots[0].wrap.querySelector('[data-dyn]');
      dyn.className = 'mt-[37px] bg-[#123456] text-[13px]';
      setTimeout(function () {
        var cs = getComputedStyle(dyn);
        window.__r = { insertToFinalMs: first, widgetSig: sigEls(widgetEls(0)).slice(0, -1), hostSig: hostSig(), hostBefore: hostBefore,
          bytesBefore: bytesBefore, bytesAfter: styleBytes(), dyn: [cs.marginTop, cs.backgroundColor, cs.fontSize] };
      }, 400);
    })();
  }
  window.addEventListener('load', function () { requestAnimationFrame(function () { requestAnimationFrame(run); }); });
})();
