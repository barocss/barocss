// #231 in-page script: a json-render-style renderer for the shadcn catalog (component base classes are shipped by the
// app build; the spec's className is appended), plus the measurement from ../page.js. Mounts ONE spec per page.
(function () {
  var P = window.__PROBE, C = P.comp;
  var PROPS = ['display', 'position', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width',
    'height', 'top', 'left', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color',
    'background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius',
    'box-shadow', 'opacity', 'translate', 'gap', 'grid-template-columns', 'flex-direction', 'justify-content',
    'align-items', 'backdrop-filter', 'outline-style', 'box-sizing', 'text-align', 'background-image', 'row-gap'];
  function sig(sel) {
    return [].map.call(document.querySelectorAll(sel), function (el) {
      var cs = getComputedStyle(el); return PROPS.map(function (p) { return cs.getPropertyValue(p); });
    });
  }
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function render(spec, id) {
    var el = spec.elements[id] || { type: 'Missing' }, p = el.props || {}, t = el.type, n;
    var extra = typeof p.className === 'string' ? ' ' + p.className : '';
    if (t === 'Text') { var v = p.variant || 'body'; n = h(/^h\d$/.test(v) ? v : 'p', (C['Text.' + v] || C['Text.body']) + extra, p.text || p.content || ''); }
    else if (t === 'Button') n = h('button', C.Button + ' ' + (C['Button.' + (p.variant || 'default')] || C['Button.default']) + ' ' + (C['Button.size.' + (p.size || 'default')] || C['Button.size.default']) + extra, p.label || p.text || '');
    else if (t === 'Badge') n = h('span', C.Badge + ' ' + (C['Badge.' + (p.variant || 'default')] || C['Badge.default']) + extra, p.text || p.label || '');
    else if (t === 'Input') { n = h('div', C.Field + extra); if (p.label) n.appendChild(h('label', C.Label, p.label)); var i = h('input', C.Input); i.placeholder = p.placeholder || ''; i.type = p.type || 'text'; n.appendChild(i); }
    else if (t === 'Switch') { n = h('div', C.SwitchRow + extra); var s = h('button', C.Switch + ' ' + (p.checked ? C['Switch.on'] : C['Switch.off'])); s.appendChild(h('span', C.Thumb + ' ' + (p.checked ? C['Thumb.on'] : C['Thumb.off']))); n.appendChild(s); n.appendChild(h('label', C.Label, p.label || '')); }
    else if (t === 'Separator') n = h('div', C.Separator + extra);
    else if (t === 'Progress') { n = h('div', C.Progress + extra); var b = h('div', C.Indicator); b.style.transform = 'translateX(-' + (100 - (+p.value || 0)) + '%)'; n.appendChild(b); }
    else if (t === 'Table') {
      n = h('div', C.TableWrap + extra); var tb = h('table', C.Table), th = h('thead', C.THead), tr = h('tr', C.Tr);
      (p.columns || []).forEach(function (c) { tr.appendChild(h('th', C.Th, typeof c === 'string' ? c : (c.label || c.header || c.key || ''))); });
      th.appendChild(tr); tb.appendChild(th); var bd = h('tbody', C.TBody);
      (p.rows || []).forEach(function (r) { var rr = h('tr', C.Tr); (Array.isArray(r) ? r : Object.values(r)).forEach(function (c) { rr.appendChild(h('td', C.Td, String(c))); }); bd.appendChild(rr); });
      tb.appendChild(bd); n.appendChild(tb);
    } else n = h('div', (C[t] || '') + extra);
    n.setAttribute('data-spec', id);
    if (t === 'Card' || t === 'Stack' || t === 'Grid' || !(t in { Text: 1, Button: 1, Badge: 1, Input: 1, Switch: 1, Separator: 1, Progress: 1, Table: 1 }))
      (el.children || []).forEach(function (c) { n.appendChild(render(spec, c)); });
    return n;
  }
  function audit() {
    var sheets = [].slice.call(document.styleSheets).concat(document.adoptedStyleSheets || []), bytes = 0, rules = 0;
    sheets.forEach(function (sh) {
      if (sh.ownerNode && sh.ownerNode.tagName === 'LINK') return;
      var rs; try { rs = sh.cssRules; } catch (e) { return; }
      for (var i = 0; i < rs.length; i++) { bytes += rs[i].cssText.length; rules++; }
    });
    return { injectedBytes: bytes, injectedTopRules: rules };
  }
  function run() {
    var shellBefore = sig('[data-shell]');
    if (P.arm === 'baro') BaroCSS.preloadJsonRenderClasses(P.spec, BaroCSS.getRuntime());
    var out = document.getElementById('out'), t0 = performance.now();
    out.appendChild(render(P.spec, P.spec.root));
    var frames = [];
    (function tick() {
      var now = performance.now();
      frames.push([now - t0, JSON.stringify(sig('[data-spec]'))]);
      if (now - t0 < 1500) return requestAnimationFrame(tick);
      var fin = frames[frames.length - 1][1], first = null;
      for (var i = 0; i < frames.length; i++) if (frames[i][1] === fin) { first = frames[i][0]; break; }
      window.__r = { mountToFinalMs: first, specSig: JSON.parse(fin),
        specEls: [].map.call(document.querySelectorAll('[data-spec]'), function (e) { return [e.getAttribute('data-spec'), e.className]; }),
        shellSig: sig('[data-shell]'), shellSigBefore: shellBefore, audit: audit(), props: PROPS };
    })();
  }
  addEventListener('load', function () { setTimeout(run, 500); });
})();
