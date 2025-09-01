import Navigation from './Navigation'
import Sidebar from './Sidebar'

interface DocsLayoutProps {
  children: React.ReactNode
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden lg:block w-80 bg-white border-r border-gray-200 min-h-screen sticky top-16">
          <Sidebar />
        </div>
        
        {/* Mobile sidebar overlay */}
        <div className="lg:hidden">
          {/* Mobile sidebar will be handled by Navigation component */}
        </div>
        
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 lg:p-12">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 