'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, BookOpen, Code, Lightbulb, Zap, Layers, Palette, Sparkles, MousePointer, ToggleLeft } from 'lucide-react'

const sidebarItems = [
  {
    title: 'Getting Started',
    icon: BookOpen,
    items: [
      { name: 'Introduction', href: '/docs/getting-started' },
      { name: 'Installation', href: '/docs/installation' },
    ],
  },
  {
    title: 'Utility Categories',
    icon: Layers,
    items: [
      { name: 'Layout & Flexbox', href: '/docs/utilities/layout' },
      { name: 'Styling', href: '/docs/utilities/styling' },
      { name: 'Effects & Filters', href: '/docs/utilities/effects' },
      { name: 'Interactions & Animations', href: '/docs/utilities/interactions' },
      { name: 'Variants', href: '/docs/utilities/variants' },
    ],
  },
  {
    title: 'Core Concepts',
    icon: Lightbulb,
    items: [
      { name: 'Overview', href: '/docs/core-concepts' },
      { name: 'Context & Theme', href: '/docs/core-concepts#context' },
      { name: 'AST System', href: '/docs/core-concepts#ast' },
      { name: 'Parsing & Generation', href: '/docs/core-concepts#parsing' },
    ],
  },
  {
    title: 'Plugin System',
    icon: Code,
    items: [
      { name: 'Overview', href: '/docs/plugin-system' },
      { name: 'Utility Plugins', href: '/docs/plugin-system#utility-plugins' },
      { name: 'Variant Plugins', href: '/docs/plugin-system#variant-plugins' },
      { name: 'Theme Plugins', href: '/docs/plugin-system#theme-plugins' },
      { name: 'AST Functions', href: '/docs/plugin-system#ast-functions' },
      { name: 'Configuration', href: '/docs/plugin-system#plugin-configuration' },
      { name: 'Best Practices', href: '/docs/plugin-system#best-practices' },
    ],
  },
  {
    title: 'API Reference',
    icon: FileText,
    items: [
      { name: 'Core Functions', href: '/docs/api-reference#core-functions' },
      { name: 'AST Functions', href: '/docs/api-reference#ast-functions' },
      { name: 'Plugin System', href: '/docs/api-reference#plugin-system' },
      { name: 'Registry Functions', href: '/docs/api-reference#registry-functions' },
      { name: 'Context API', href: '/docs/api-reference#context-api' },
      { name: 'Types', href: '/docs/api-reference#types' },
    ],
  },
  {
    title: 'Examples',
    icon: Zap,
    items: [
      { name: 'Basic Usage', href: '/docs/examples#basic-usage' },
      { name: 'Plugin Examples', href: '/docs/examples#plugin-examples' },
      { name: 'Advanced Examples', href: '/docs/examples#advanced-examples' },
      { name: 'Integration Examples', href: '/docs/examples#integration-examples' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-screen overflow-y-auto sticky top-0">
      <div className="p-4">
        <div className="mb-6 pt-4"> {/* 상단 여백 추가 */}
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
            <Code className="h-6 w-6 text-blue-600" />
            CSSMA v4
          </Link>
        </div>
        
        <nav className="space-y-6">
          {sidebarItems.map((section) => {
            const hasActiveItem = section.items.some(item => pathname === item.href)
            
            return (
              <div key={section.title}>
                <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                  hasActiveItem
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600'
                }`}>
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </div>
                
                <div className="ml-6 mt-2 space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
} 