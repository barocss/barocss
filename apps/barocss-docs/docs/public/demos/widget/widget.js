// #379 widget demo: a Shadow DOM chat widget on a strict-CSP host (no inline script or style allowed).
(function () {
  var rt = new URLSearchParams(location.search).get('rt') || 'baro';
  document.querySelectorAll('[data-rt]').forEach(function (a) { if (a.dataset.rt === rt) a.setAttribute('aria-current', 'true'); });
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
  var violations = 0, status = document.getElementById('status'), done = false, sr;
  document.addEventListener('securitypolicyviolation', function () { violations++; report(); });
  var PROPS = ['font-family', 'color', 'margin-top', 'font-size', 'display', 'background-color', 'border-top-style', 'letter-spacing', 'box-sizing', 'line-height'];
  var hostEls = Array.prototype.slice.call(document.querySelectorAll('.host, .host *:not(chat-widget)'));
  function snap() { return hostEls.map(function (el) { var cs = getComputedStyle(el); return PROPS.map(function (p) { return cs.getPropertyValue(p); }).join('|'); }); }
  var before = snap();
  function report() {
    var now = snap(), changed = now.filter(function (v, i) { return v !== before[i]; }).length;
    var hero = sr && sr.querySelector('.bg-indigo-600');
    var styled = !!hero && getComputedStyle(hero).backgroundColor !== 'rgba(0, 0, 0, 0)';
    status.textContent = 'runtime: ' + rt + ' | widget styled: ' + (styled ? 'yes' : 'no') + ' | host elements changed: ' + changed + '/' + hostEls.length + ' | CSP violations: ' + violations;
    window.__demo = { rt: rt, styled: styled, hostChanged: changed, hostEls: hostEls.length, violations: violations, done: done };
  }
  function start() {
    sr = document.querySelector('chat-widget').attachShadow({ mode: 'open' });
    sr.innerHTML = '<div class="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"><div class="flex items-center gap-3 bg-indigo-600 px-5 py-3 text-white"><span class="size-2.5 rounded-full bg-emerald-400"></span><span class="font-semibold">Assistant</span><span class="ml-auto text-xs text-indigo-100">recorded replies</span></div><div id="log" class="space-y-6 p-5"><div class="w-fit rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-800">Build me a landing page for our spring release.</div></div></div>';
    if (rt === 'baro') new BaroCSS.BrowserRuntime({ root: sr, config: {} });
    var log = sr.getElementById('log'), i = 0, B = window.WIDGET_BLOCKS;
    (function next() {
      if (i >= B.length) { done = true; setTimeout(report, 200); return; }
      var d = document.createElement('div'); d.setAttribute('data-block', B[i].type); d.innerHTML = B[i].html; log.appendChild(d); i++;
      report(); setTimeout(next, 250);
    })();
  }
  if (rt === 'baro') load("https://cdn.jsdelivr.net/npm/@barocss/browser@0.10.1/dist/cdn/barocss.umd.cjs", start);
  else if (rt === 'twb') load("https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.13/dist/index.global.js", start);
  else start();
})();
