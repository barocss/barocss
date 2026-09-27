// Parse every JavaScript example in the Vanilla HTML guide so incomplete snippets fail the Docs build.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const guide = new URL('../docs/guide/integration/vanilla-html.md', import.meta.url)
const source = readFileSync(guide, 'utf8')
const examples = [...source.matchAll(/^```javascript[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)]

if (examples.length !== 5) {
  console.error(`Expected 5 Vanilla HTML JavaScript examples, found ${examples.length}`)
  process.exit(1)
}

let failed = false
for (const [index, example] of examples.entries()) {
  const result = spawnSync(process.execPath, ['--check', '-'], {
    input: example[1],
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    console.error(`Vanilla HTML JavaScript example ${index + 1} is invalid:\n${result.stderr}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`Vanilla HTML examples: syntax ok (${examples.length} JavaScript blocks)`)
