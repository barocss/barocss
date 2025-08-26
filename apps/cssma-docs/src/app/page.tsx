import Link from 'next/link'
import { ArrowRightIcon, BoltIcon, CodeBracketIcon, SparklesIcon } from '@heroicons/react/24/outline'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              CSSMA v4
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Real-time CSS utility engine that generates styles on-the-fly. 
              No build step, no waiting - just instant styling like Tailwind CSS, but in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/docs/getting-started"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link 
                href="/docs/examples"
                className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                View Examples
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why CSSMA v4?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Experience the future of CSS utilities with real-time generation and zero build time.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BoltIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Generation</h3>
              <p className="text-gray-600">
                CSS is generated instantly as you add classes to your HTML. No waiting, no build step.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CodeBracketIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Tailwind Compatible</h3>
              <p className="text-gray-600">
                Use the same utility classes you know from Tailwind CSS. Drop-in replacement with real-time benefits.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SparklesIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Advanced Features</h3>
              <p className="text-gray-600">
                Support for arbitrary values, variants, and custom plugins. Extend and customize as needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join the future of CSS utilities with CSSMA v4.
          </p>
          <Link 
            href="/docs/installation"
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            Install CSSMA v4
            <ArrowRightIcon className="ml-2 h-6 w-6" />
          </Link>
        </div>
      </div>
    </div>
  )
}
