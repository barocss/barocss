import Navigation from './Navigation'
import Sidebar from './Sidebar'

interface DocsLayoutProps {
  children: React.ReactNode
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="flex pt-16">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
            <div className="docs-content">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 