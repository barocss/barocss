# Preflight

Base styles that reset and normalize defaults.

Enable level in runtime config:

```ts
new BrowserRuntime({ config: { preflight: 'standard' } });
```

- `true`: full preflight
- `false`: disabled
- `'minimal' | 'standard' | 'full'`
