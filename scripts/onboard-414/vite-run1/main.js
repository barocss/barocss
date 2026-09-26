import './style.css'
import { getRuntime } from '@barocss/browser'

const runtime = getRuntime({
  skipExisting: true,
  config: {
    cssVarPrefix: 'tw',
    darkMode: 'class',
    darkModeSelector: '.dark &',
  },
})

runtime.observe(document.body, { scan: true })

// Simulate HTML fetched/generated at runtime, with classes not present in source
setTimeout(() => {
  const el = document.getElementById('runtime-target')
  const html = '<div id="runtime-el" class="bg-emerald-700 ring-4 ring-emerald-300 rotate-3 p-6 rounded-lg">Runtime inserted box</div>'
  el.innerHTML = html
}, 200)
