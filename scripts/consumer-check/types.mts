// Type-checks every entry from an ES module (resolves the import condition).
import { parseClassToAst } from '@barocss/kit';
import { defaultTheme } from '@barocss/kit/theme/default';
import { BrowserRuntime } from '@barocss/browser';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';

export const probe = [parseClassToAst, defaultTheme, BrowserRuntime, ServerRuntime, ssrStyleTag] as const;
