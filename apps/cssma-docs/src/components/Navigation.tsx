'use client'

import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-xl font-bold text-gray-900">CSSMA</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/docs/getting-started" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
              Docs
            </Link>
            <Link href="/docs/examples" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
              Examples
            </Link>
            <Link href="/docs/api-reference" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
              API
            </Link>
            <a 
              href="https://github.com/your-org/cssma" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
            >
              GitHub
            </a>
          </div>
          
          <div className="md:hidden">
            <button className="text-gray-600 hover:text-gray-900 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
} 