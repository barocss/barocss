# Local GPU scene example

Build the private package, then start the loopback server from the repository root:

```sh
pnpm --filter @barocss/gpu build:library
node examples/gpu-scene/server.mjs
```

Open `http://127.0.0.1:5180`. `PORT` can select another port. The server binds to
127.0.0.1 and serves only three exact local routes. It has no model endpoint.
The textarea is parsed as scene data; it is never evaluated as code or HTML.
Apply accepts valid changes and displays diagnostics for invalid changes while
keeping the accepted scene. Reset restores the authored sphere/box fixture.

Run the real browser evidence suite with the installed Chrome and bundled
Playwright (no browser download):

```sh
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm --filter @barocss/gpu test:browser
```

`BAROCSS_GPU_EVIDENCE_DIR` selects a retained evidence directory. Each fixture
retains source, validated scene, generated shaders, PNG, and JSON hashes/readback
assertions. Software WebGL is functional evidence, not physical GPU or performance
proof. Missing Chrome or WebGL2 fails the suite.
