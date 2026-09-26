// #379 CMS demo: the site ships a Tailwind build of its own templates; CMS blocks (recorded model output) arrive at runtime.
(function () {
  var rt = new URLSearchParams(location.search).get('rt') || 'baro';
  document.querySelectorAll('[data-rt]').forEach(function (a) { if (a.dataset.rt === rt) a.setAttribute('aria-current', 'true'); });
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
  function insert() {
    document.getElementById('blocks').innerHTML = window.CMS_BLOCKS.map(function (b) { return '<div data-block="' + b.type + '">' + b.html + '</div>'; }).join('\n');
    setTimeout(function () {
      var hero = document.querySelector('[data-block="hero"] > *');
      var styled = !!hero && getComputedStyle(hero).backgroundImage !== 'none';
      document.getElementById('status').textContent = 'runtime: ' + rt + ' | hero block styled: ' + (styled ? 'yes' : 'no');
      window.__demo = { rt: rt, styled: styled };
    }, 300);
  }
  if (rt === 'baro') load("https://cdn.jsdelivr.net/npm/@barocss/browser@0.10.1/dist/cdn/barocss.umd.cjs", function () {
    BaroCSS.getRuntime({ skipExisting: true, config: {"cssVarPrefix":"tw","theme":{"extend":{"colors":{"brand":{"50":"#eef6ff","100":"#d9eaff","200":"#bcd9ff","300":"#8ec1ff","400":"#599dff","500":"#3377ff","600":"#1f58f5","700":"#1843e1","800":"#1a37b6","900":"#1b348f","950":"#152258"},"accent":{"400":"#fbbf5a","500":"#f59e0b","600":"#d97706"}},"fontFamily":{"display":["\"Georgia\"","\"Times New Roman\"","serif"],"sans":["\"Inter\"","\"Helvetica Neue\"","Arial","sans-serif"]}}}} }).observe(document.body, { scan: true });
    insert();
  });
  else if (rt === 'twb') { var st = document.createElement('style'); st.type = 'text/tailwindcss'; st.textContent = "@theme {\n  --color-brand-50: #eef6ff;\n  --color-brand-100: #d9eaff;\n  --color-brand-200: #bcd9ff;\n  --color-brand-300: #8ec1ff;\n  --color-brand-400: #599dff;\n  --color-brand-500: #3377ff;\n  --color-brand-600: #1f58f5;\n  --color-brand-700: #1843e1;\n  --color-brand-800: #1a37b6;\n  --color-brand-900: #1b348f;\n  --color-brand-950: #152258;\n  --color-accent-400: #fbbf5a;\n  --color-accent-500: #f59e0b;\n  --color-accent-600: #d97706;\n  --font-display: \"Georgia\", \"Times New Roman\", serif;\n  --font-sans: \"Inter\", \"Helvetica Neue\", Arial, sans-serif;\n}"; document.head.appendChild(st); load("https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.13/dist/index.global.js", insert); }
  else insert();
})();
