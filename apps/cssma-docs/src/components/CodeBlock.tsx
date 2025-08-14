'use client'

import { useEffect } from 'react'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'

interface CodeBlockProps {
  children: string
  language?: string
  filename?: string
}

export default function CodeBlock({ children, language = 'typescript', filename }: CodeBlockProps) {
  useEffect(() => {
    Prism.highlightAll()
  }, [children])

  return (
    <div className="code-block">
      {filename && (
        <div className="code-block-header">
          <span>{filename}</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
      )}
      <div className="code-block-content">
        <pre className="!bg-transparent !p-0 !m-0">
          <code className={`language-${language}`}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  )
} 