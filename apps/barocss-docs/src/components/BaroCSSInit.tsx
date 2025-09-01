'use client'

import { useEffect } from 'react'
import { StyleRuntime } from 'barocss/runtime/browser' // Static import for type safety

export default function BAROCSSInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    console.log('[BAROCSS] Initializing real-time CSS engine...')

    const runtime = new StyleRuntime({
      styleId: 'barocss-docs-runtime',
      enableDev: true,
      maxRulesPerPartition: 10,
    })
    runtime.observe(document.body, { scan: true })

    console.log('[BAROCSS] Real-time DOM scanning active! 🚀')

    // Cleanup function
    return () => {
      runtime.destroy()
    }
  }, [])
  return null
}
