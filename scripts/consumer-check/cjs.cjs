// Requires every documented entry point via CommonJS.
const checks = {
  '@barocss/kit': (m) => typeof m.parseClassToAst === 'function',
  '@barocss/kit/theme/default': (m) => typeof m.defaultTheme === 'object',
  '@barocss/browser': (m) => typeof m.BrowserRuntime === 'function',
  '@barocss/server': (m) => typeof m.ServerRuntime === 'function' && typeof m.ssrStyleTag === 'function',
};
let fail = 0;
for (const [id, ok] of Object.entries(checks)) {
  try {
    const r = ok(require(id));
    console.log(`${r ? 'PASS' : 'FAIL'} cjs ${id}`);
    if (!r) fail = 1;
  } catch (e) {
    console.log(`FAIL cjs ${id}: ${e.code || e.message}`);
    fail = 1;
  }
}
process.exit(fail);
