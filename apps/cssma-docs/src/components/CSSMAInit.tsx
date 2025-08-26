'use client'

import { useEffect } from 'react'
import { StyleRuntime } from 'cssma-v4/runtime/browser' // Static import for type safety

export default function CSSMAInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    console.log('[CSSMA] Initializing real-time CSS engine...')

    const runtime = new StyleRuntime({
      styleId: 'cssma-docs-runtime',
      enableDev: true
    })
    runtime.observe(document.body, { scan: true })

    console.log('[CSSMA] Real-time DOM scanning active! 🚀')

    // Cleanup function
    return () => {
      runtime.destroy()
    }
  }, [])
  return null
}
