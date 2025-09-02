# Detecting classes in source files

BaroCSS runtime detects classes present in the DOM at runtime. For SSR or build-time extraction, use the server parser.

- Client: `runtime.observe(document.body, { scan: true })`
- Server: process classes via parser and embed generated CSS
