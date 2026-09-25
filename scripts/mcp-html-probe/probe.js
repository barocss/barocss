// #198 in-iframe probe, loaded from the allowlisted CDN before any styling runtime. It reports, via postMessage to the
// host: computed-style signatures over time (time to the final styled state), CSP violations, and whether classes
// added after load get styled.
(function () {
  var P = window.__PROBE;
  var PROPS = ['display', 'position', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width',
    'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'color',
    'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color',
    'border-top-left-radius', 'box-shadow', 'opacity', 'transform', 'translate', 'scale', 'gap',
    'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'outline-style', 'outline-width'];
  var violations = [];
  document.addEventListener('securitypolicyviolation', function (e) {
    violations.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline') + (e.sample ? ' ' + e.sample.slice(0, 60) : ''));
  });
  function sig(root) {
    var els = (root || document.body).querySelectorAll('[class]');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].hasAttribute('data-probe')) continue;
      var cs = getComputedStyle(els[i]);
      out.push(PROPS.map(function (p) { return cs.getPropertyValue(p); }));
    }
    return out;
  }
  function hash(s) { return JSON.stringify(s); }
  var frames = [];
  var t0 = performance.now();
  function tick() {
    if (!document.body) return requestAnimationFrame(tick);
    var now = performance.now();
    frames.push([now, hash(sig())]);
    if (now - t0 < 3000) return requestAnimationFrame(tick);
    finish();
  }
  function finish() {
    var finalHash = frames[frames.length - 1][1];
    var firstFinal = null;
    for (var i = 0; i < frames.length; i++) if (frames[i][1] === finalHash) { firstFinal = frames[i][0]; break; }
    var finalSig = sig();
    // Classes added after load (none appear in the section, so a build can't have them).
    var el = document.createElement('div');
    el.setAttribute('data-probe', '1');
    el.textContent = 'dynamic';
    document.body.appendChild(el);
    var d0 = performance.now();
    el.className = P.dynamic;
    var dyn = null;
    (function poll() {
      var cs = getComputedStyle(el);
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.paddingTop === '28px') {
        dyn = performance.now() - d0;
        return report(cs);
      }
      if (performance.now() - d0 > 1500) return report(cs);
      requestAnimationFrame(poll);
    })();
    function report(cs) {
      parent.postMessage({
        probe: true, arm: P.arm, sec: P.sec,
        timeToFinalStyled: firstFinal, navStartOffset: t0,
        finalSig: finalSig, props: PROPS, violations: violations,
        dynamicMs: dyn,
        dynamicSig: ['background-color', 'padding-top', 'border-top-left-radius', 'translate', 'box-shadow'].map(function (p) { return cs.getPropertyValue(p); }),
        styleSheets: document.styleSheets.length,
      }, '*');
    }
  }
  requestAnimationFrame(tick);
})();
