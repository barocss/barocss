// Imports every documented entry point via ESM.
const checks = {
  '@barocss/kit': (m) => typeof m.parseClassToAst === 'function',
  '@barocss/kit/theme/default': (m) => typeof m.defaultTheme === 'object',
  '@barocss/browser': (m) => typeof m.BrowserRuntime === 'function',
  '@barocss/server': (m) => typeof m.ServerRuntime === 'function' && typeof m.ssrStyleTag === 'function',
};
let fail = 0;
for (const [id, ok] of Object.entries(checks)) {
  try {
    const r = ok(await import(id));
    console.log(`${r ? 'PASS' : 'FAIL'} esm ${id}`);
    if (!r) fail = 1;
  } catch (e) {
    console.log(`FAIL esm ${id}: ${e.code || e.message}`);
    fail = 1;
  }
}
process.exit(fail);
