# Server Runtime

Use the server runtime or core parser to pre-generate CSS on the server.

- Parse classes and embed CSS in HTML for SSR
- Use `createContext` and parser APIs directly

```ts
import { createContext } from 'barocss';
import { IncrementalParser } from 'barocss';

const ctx = createContext({ /* config */ });
const parser = new IncrementalParser(ctx);
const results = parser.processClasses(['bg-blue-500', 'text-lg']);
const css = results.flatMap(r => r.cssList).join('\n');
```
