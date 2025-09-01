'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bars3Icon, XMarkIcon, CpuChipIcon } from '@heroicons/react/24/outline'

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <CpuChipIcon className="w-5 h-5 text-white" />
              </div>
                      <span className="text-xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          BAROCSS
        </span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/docs/getting-started" className="nav-link">
              Getting Started
            </Link>
            <Link href="/docs/core-concepts" className="nav-link">
              Core Concepts
            </Link>
            <Link href="/docs/api-reference" className="nav-link">
              API Reference
            </Link>
            <Link href="/docs/examples" className="nav-link">
              Examples
            </Link>
            <Link href="/docs/plugin-system" className="nav-link">
              Plugins
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            <Link
              href="/docs/getting-started"
              className="hidden sm:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Get Started
            </Link>
            
            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" />
              ) : (
                <Bars3Icon className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/docs/getting-started"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Getting Started
            </Link>
            <Link
              href="/docs/core-concepts"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Core Concepts
            </Link>
            <Link
              href="/docs/api-reference"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              API Reference
            </Link>
            <Link
              href="/docs/examples"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Examples
            </Link>
            <Link
              href="/docs/plugin-system"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Plugins
            </Link>
            <div className="pt-4 border-t border-gray-200">
              <Link
                href="/docs/getting-started"
                className="block w-full text-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
} 