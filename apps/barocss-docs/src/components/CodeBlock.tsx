'use client'

import { useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'

interface CodeBlockProps {
  children: string
  language?: string
  filename?: string
}

export default function CodeBlock({ children, language = 'typescript', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="code-block my-8">
      {/* Header */}
      {(filename || language) && (
        <div className="code-block-header">
          <div className="flex items-center space-x-3">
            {filename && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="code-block-title ml-2">{filename}</span>
              </div>
            )}
            {language && (
              <span className="code-block-title text-gray-400">
                {language}
              </span>
            )}
          </div>
          
          <div className="code-block-actions">
            <button
              onClick={copyToClipboard}
              className="p-2 text-gray-400 hover:text-gray-200 transition-colors duration-200 rounded-lg hover:bg-gray-800"
              title="Copy code"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-400" />
              ) : (
                <ClipboardDocumentIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Code content */}
      <pre className="text-sm leading-relaxed">
        <code className={`language-${language}`}>
          {children}
        </code>
      </pre>
    </div>
  )
} 