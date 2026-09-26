---
"@barocss/kit": minor
---

New config option `utilities` (#287): static custom utilities, the runtime mirror of a stylesheet's static `@utility name { ... }`. Pass name → declarations (`{ 'max-w-app': { 'max-width': '72rem', 'margin-inline': 'auto' } }`, custom properties allowed). Each is registered on its own context ahead of the built-ins, so variants and `!` apply and a same-named built-in is overridden. Names must be plain class idents and declarations pass the usual value guards; invalid entries are skipped. The browser and server runtimes pass it through unchanged. New exports: `CustomUtilities`, `CustomUtilityDeclarations`, `validateCustomUtility`.
