// #379 SSR demo: start the client runtime after ?delay= ms (default 1500) so the first paint stays visible.
(function () {
  var delay = Number(new URLSearchParams(location.search).get('delay') || 1500), t = document.getElementById('status');
  setTimeout(function () {
    var s = document.createElement('script'); s.src = "https://cdn.jsdelivr.net/npm/@barocss/browser@0.10.1/dist/cdn/barocss.umd.cjs";
    s.onload = function () { BaroCSS.getRuntime({ skipExisting: true, config: {"cssVarPrefix":"tw","theme":{"extend":{"colors":{"brand":{"50":"#eef6ff","100":"#d9eaff","200":"#bcd9ff","300":"#8ec1ff","400":"#599dff","500":"#3377ff","600":"#1f58f5","700":"#1843e1","800":"#1a37b6","900":"#1b348f","950":"#152258"},"accent":{"400":"#fbbf5a","500":"#f59e0b","600":"#d97706"}},"fontFamily":{"display":["\"Georgia\"","\"Times New Roman\"","serif"],"sans":["\"Inter\"","\"Helvetica Neue\"","Arial","sans-serif"]}}}} }).observe(document.body, { scan: true }); t.textContent = 'client runtime started after ' + delay + ' ms'; window.__demoHydrated = true; };
    document.head.appendChild(s);
  }, delay);
})();
