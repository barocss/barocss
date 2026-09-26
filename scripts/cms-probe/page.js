// #253 in-page script: after load, insert the model's CMS blocks into the article via innerHTML, then measure.
(function () {
  var P = window.__PROBE;
  var PROPS = ['display', 'position', 'margin-top', 'margin-bottom', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width',
    'height', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'color',
    'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color', 'border-left-width',
    'border-top-left-radius', 'box-shadow', 'opacity', 'transform', 'translate', 'gap', 'grid-template-columns', 'flex-direction',
    'justify-content', 'align-items', 'text-align', 'text-decoration-line', 'list-style-type', 'filter', 'backdrop-filter', 'z-index'];
  function sig(sel) {
    return [].map.call(document.querySelectorAll(sel), function (el) {
      var cs = getComputedStyle(el); return PROPS.map(function (p) { return cs.getPropertyValue(p); });
    });
  }
  function audit() {
    var sheets = [].slice.call(document.styleSheets).concat(document.adoptedStyleSheets || []), bytes = 0;
    sheets.forEach(function (sh) {
      if (sh.ownerNode && sh.ownerNode.tagName === 'LINK') return;
      var rs; try { rs = sh.cssRules; } catch (e) { return; }
      for (var i = 0; i < rs.length; i++) bytes += rs[i].cssText.length;
    });
    return bytes;
  }
  var SHELL = '[data-shell],[data-prose]', BLOCK = '#blocks *';
  function run() {
    var before = audit(), shellBefore = sig(SHELL), box = document.getElementById('blocks'), t0 = performance.now();
    box.innerHTML = P.html;
    var frames = [];
    (function tick() {
      var now = performance.now();
      frames.push([now - t0, JSON.stringify(sig(BLOCK))]);
      if (now - t0 < 1500) return requestAnimationFrame(tick);
      var fin = frames[frames.length - 1][1], first = null;
      for (var i = 0; i < frames.length; i++) if (frames[i][1] === fin) { first = frames[i][0]; break; }
      var all = [].slice.call(document.querySelectorAll(BLOCK));
      window.__r = { insertToFinalMs: first, blockSig: JSON.parse(fin), shellSig: sig(SHELL), shellSigBefore: shellBefore,
        blockEls: all.map(function (e) { return [e.tagName, e.getAttribute('class') || '', e.closest('[data-block]').getAttribute('data-block'), all.indexOf(e.parentElement)]; }),
        injectedBytes: audit(), injectedBeforeInsert: before, props: PROPS };
    })();
  }
  // "after load": wait for load plus two frames so a runtime has done its initial scan.
  window.addEventListener('load', function () { requestAnimationFrame(function () { requestAnimationFrame(run); }); });
})();
