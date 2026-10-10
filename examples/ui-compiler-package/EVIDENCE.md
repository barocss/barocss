# #1367 native receipt

- Base: local Integration `be10f2ecca04800b0d344dc93a855e74d04fc305`.
- Branch: `codex/ui-compiler-1367`.
- Owned paths: `packages/barocss-ui-compiler/**`, `examples/ui-compiler-package/**`.
- Dependency lease: existing Node 22.19.0 and installed React 19.2.3, ReactDOM 19.2.3, esbuild 0.25.12, TypeScript 5.9.3. Staged compiled public Render/Server/Kit from the existing local Integration checkout. No dependency download.
- Build: `node packages/barocss-ui-compiler/build.mjs` passed.
- Consumer: `PUBLIC_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration PACKAGE_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/ui-compiler-package/stage.mjs` passed.
- Browser: `PLAYWRIGHT_CORE_DIR=<installed playwright-core> node examples/ui-compiler-package/flow.mjs` passed in installed Chrome. First run passed; no failure was overwritten.
- Result: counter 2 to 3, total 3600 to 5400, name Min to Lee, selected state `{ "name": "Lee", "count": 3 }`, page errors 0. Opaque child message origin was `null`. Save stayed disabled.
- Refusals: malformed JSX, foreign import and dynamic import produced no artifact.
- Source SHA256: `2ec9ee05fdf2d1c478808001e83ee9c8ca1a1590e4d6ca3ad234be90f7c85f3f`.
- Bundle SHA256: `27765ede184ade6ad761098057b1b50421998c213991e589ccc716d2d94c5421`.
- React production runtime SHA256: `87723665d096fd57a2974c64b754c63111e2e6f35555794939e308cf252b4ee7`; JSX runtime SHA256: `1e46f15002696985e80c61d47aaa30dabb03c954270a690f5f7dfbbacfa9002b`.
- ReactDOM client production runtime SHA256: `3e472cce088eb5f01d931ba75ac64b27b52bd46a009e0657b56b45c97ed42044`.
- Staged compiled public entry SHA256: compiler `01c5378c69b3ae9ef04f85a27886a72dcc017719c61fcab93e7188b83db98f6a`, Render `a62ec1b3926383fc03f519192bc8142444060253e6d9d73ebad3c140999d8c2f`, Server `99c05368fe1f22f557fed0a7a452729d092f4a08601eac6a133ae59fc5f97385`, Kit `7e94f5100289b412611074ae2da51c2223ea705bd6b1b75436216cdcfec67410`.
- Bundle 614060 bytes; generated CSS 494 bytes.
- Actual model/provider calls: zero.

The flow covers one authored module and one browser interaction path. Integrated UI Runtime consumption and local Integration merge remain separate steps.
