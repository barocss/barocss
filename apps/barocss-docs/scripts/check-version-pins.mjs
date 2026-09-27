// Fails on a literal pinned `@barocss/<pkg>@<x.y.z>` in the docs sources or the root README (#419).
// Write `__BAROCSS_VERSION__` instead (the docs build fills it in), or leave the README unpinned.
// A historical statement may keep its pin with `pin-ok` on the same line (e.g. `<!-- pin-ok -->`).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const docs = join(root, 'apps/barocss-docs/docs')
const publishedVersion = JSON.parse(readFileSync(join(root, 'apps/barocss-docs/published-version.json'), 'utf8')).version
const sourceVersion = JSON.parse(readFileSync(join(root, 'packages/barocss-browser/package.json'), 'utf8')).version
const parseVersion = (version) => {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Expected an exact published version, got ${JSON.stringify(version)}`)
  }
  return version.split('.').map(Number)
}
const published = parseVersion(publishedVersion)
const source = parseVersion(sourceVersion)
for (let i = 0; i < published.length; i++) {
  if (published[i] === source[i]) continue
  if (published[i] > source[i]) {
    throw new Error(`Published Docs version ${publishedVersion} exceeds source version ${sourceVersion}`)
  }
  break
}
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
console.log(`version pins: ok (${files.length} files; published ${publishedVersion}, source ${sourceVersion})`)
