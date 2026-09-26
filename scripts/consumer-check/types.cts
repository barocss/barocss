// Type-checks every entry from a CommonJS module (resolves the require condition).
import kit = require('@barocss/kit');
import theme = require('@barocss/kit/theme/default');
import browser = require('@barocss/browser');
import server = require('@barocss/server');

export const probe = [kit.parseClassToAst, theme.defaultTheme, browser.BrowserRuntime, server.ServerRuntime, server.ssrStyleTag] as const;
