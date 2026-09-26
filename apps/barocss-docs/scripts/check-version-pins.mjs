// Fails on a literal pinned `@barocss/<pkg>@<x.y.z>` in the docs sources or the root README (#419).
// Write `__BAROCSS_VERSION__` instead (the docs build fills it in), or leave the README unpinned.
// A historical statement may keep its pin with `pin-ok` on the same line (e.g. `<!-- pin-ok -->`).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const docs = join(root, 'apps/barocss-docs/docs')
const PIN = /@barocss\/[a-z-]+@\d+\.\d+\.\d+/

const files = [join(root, 'README.md')]
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'cache', 'dist', 'public'].includes(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.md')) files.push(p)
  }
}
walk(docs)

const hits = []
for (const f of files) {
  const rel = relative(root, f)
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (PIN.test(line) && !line.includes('pin-ok')) hits.push(`${rel}:${i + 1}: ${line.trim()}`)
  })
}
if (hits.length) {
  console.error(`Literal version pins found (use __BAROCSS_VERSION__ or add pin-ok):\n${hits.join('\n')}`)
  process.exit(1)
}
console.log(`version pins: ok (${files.length} files)`)
