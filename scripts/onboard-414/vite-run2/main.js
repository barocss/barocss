import './style.css'
import { BrowserRuntime } from '@barocss/browser'

// Initialize BaroCSS browser runtime
const runtime = new BrowserRuntime({
  scan: true,
  observe: true
})

// Start observing the document for dynamic class changes
runtime.observe(document.body, { scan: true })

// Test: Insert a dynamic element with runtime-generated classes
function insertRuntimeElement() {
  const div = document.createElement('div')
  // These classes should not exist in the build but should be styled at runtime
  div.className = 'bg-violet-800 text-violet-50 p-6 rounded-lg grid grid-cols-3 gap-4 hover:bg-violet-900'
  div.textContent = 'Runtime-inserted element with BaroCSS styling'
  document.body.appendChild(div)
  return div
}

// Wait a moment then insert the element
setTimeout(insertRuntimeElement, 100)
