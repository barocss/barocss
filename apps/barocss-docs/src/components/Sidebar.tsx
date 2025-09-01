'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  BookOpenIcon,
  CodeBracketIcon,
  BeakerIcon,
  PuzzlePieceIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface NavItem {
  title: string
  href?: string
  children?: NavItem[]
  icon?: React.ComponentType<{ className?: string }>
  badge?: string
}

const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    href: '/docs/getting-started',
    icon: BookOpenIcon,
  },
  {
    title: 'Core Concepts',
    href: '/docs/core-concepts',
    icon: CodeBracketIcon,
  },
  {
    title: 'API Reference',
    href: '/docs/api-reference',
    icon: DocumentTextIcon,
  },
  {
    title: 'Examples',
    href: '/docs/examples',
    icon: BeakerIcon,
  },
  {
    title: 'Plugin System',
    href: '/docs/plugin-system',
    icon: PuzzlePieceIcon,
  },
  {
    title: 'Utilities',
    icon: WrenchScrewdriverIcon,
    children: [
      {
        title: 'Styling',
        href: '/docs/utilities/styling',
      },
      {
        title: 'Layout',
        href: '/docs/utilities/layout',
      },
      {
        title: 'Effects',
        href: '/docs/utilities/effects',
      },
      {
        title: 'Interactions',
        href: '/docs/utilities/interactions',
      },
      {
        title: 'Variants',
        href: '/docs/utilities/variants',
      },
    ],
  },
  {
    title: 'Installation',
    href: '/docs/installation',
    icon: BookOpenIcon,
  },
]

interface SidebarItemProps {
  item: NavItem
  level?: number
}

function SidebarItem({ item, level = 0 }: SidebarItemProps) {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(
    level === 0 || pathname.startsWith(item.href || '')
  )
  
  const isActive = item.href === pathname
  const hasChildren = item.children && item.children.length > 0
  const shouldExpand = hasChildren && isExpanded

  return (
    <div>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
          >
            {item.icon && (
              <item.icon className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-500" />
            )}
            <span className="flex-1">{item.title}</span>
            {shouldExpand ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            )}
          </button>
        ) : (
          <Link
            href={item.href || '#'}
            className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
              isActive
                ? 'text-blue-600 bg-blue-50 border border-blue-200'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {item.icon && (
              <item.icon className={`w-4 h-4 mr-3 ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`} />
            )}
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {item.badge}
              </span>
            )}
          </Link>
        )}
      </div>

      {hasChildren && shouldExpand && (
        <div className="ml-6 mt-1 space-y-1">
          {item.children?.map((child, index) => (
            <Link
              key={index}
              href={child.href || '#'}
              className={`block px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                pathname === child.href
                  ? 'text-blue-600 bg-blue-50 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Documentation</h2>
        <p className="text-sm text-gray-600">
          Learn how to use Barocss to build modern web applications with real-time CSS generation.
        </p>
      </div>

      {/* Navigation */}
      <nav className="p-6 space-y-2">
        {navigation.map((item, index) => (
          <SidebarItem key={index} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 mt-auto">
        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            v4.0.0 Latest
          </div>
          <p className="text-xs text-gray-500">
            Built with ❤️ for the web development community
          </p>
        </div>
      </div>
    </div>
  )
} 