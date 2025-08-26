'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface NavItem {
  title: string
  href?: string
  children?: NavItem[]
  icon?: React.ComponentType<{ className?: string }>
}

const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    children: [
      { title: 'Installation', href: '/docs/installation' },
      { title: 'Quick Start', href: '/docs/getting-started' },
      { title: 'Core Concepts', href: '/docs/core-concepts' },
    ]
  },
  {
    title: 'Guides',
    children: [
      { title: 'Examples', href: '/docs/examples' },
      { title: 'Plugin System', href: '/docs/plugin-system' },
    ]
  },
  {
    title: 'Reference',
    children: [
      { title: 'API Reference', href: '/docs/api-reference' },
      { title: 'Utilities', href: '/docs/utilities/styling' },
      { title: 'Variants', href: '/docs/utilities/variants' },
      { title: 'Layout', href: '/docs/utilities/layout' },
      { title: 'Effects', href: '/docs/utilities/effects' },
      { title: 'Interactions', href: '/docs/utilities/interactions' },
    ]
  }
]

interface SidebarItemProps {
  item: NavItem
  level?: number
}

function SidebarItem({ item, level = 0 }: SidebarItemProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(level === 0)
  const hasChildren = item.children && item.children.length > 0
  const isActive = item.href === pathname
  const hasActiveChild = hasChildren && item.children?.some(child => child.href === pathname)

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex w-full items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            hasActiveChild 
              ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600' 
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center">
            {item.icon && <item.icon className="w-4 h-4 mr-2" />}
            {item.title}
          </span>
          {isOpen ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </button>
        {isOpen && (
          <div className="ml-4 space-y-1">
            {item.children?.map((child, index) => (
              <SidebarItem key={index} item={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href!}
      className={`block px-3 py-2 text-sm rounded-md transition-colors ${
        isActive
          ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600 font-medium'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {item.title}
    </Link>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Documentation</h2>
          <p className="text-sm text-gray-600">Learn how to use CSSMA v4</p>
        </div>
        
        <nav className="space-y-2">
          {navigation.map((item, index) => (
            <SidebarItem key={index} item={item} />
          ))}
        </nav>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p className="mb-2">CSSMA v4</p>
            <p>Real-time CSS utility engine</p>
          </div>
        </div>
      </div>
    </aside>
  )
} 