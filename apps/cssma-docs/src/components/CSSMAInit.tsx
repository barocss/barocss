'use client'

import { useEffect } from 'react'
import { StyleRuntime } from 'cssma-v4/runtime/browser'



export default function CSSMAInit() {
  useEffect(() => {
    // Browser에서만 실행
    if (typeof window === 'undefined') return

    const runtime = new StyleRuntime({
      styleId: 'cssma-docs-runtime',
      enableDev: process.env.NODE_ENV === 'development',
    })
    runtime.observe(document.body, { scan: true })

    console.log('[CSSMA] Initializing real-time CSS engine...')
  }, [])

  return null // UI 없는 초기화 컴포넌트
}
