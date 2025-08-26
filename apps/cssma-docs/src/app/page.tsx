import Link from 'next/link'
import { ArrowRightIcon, BoltIcon, CodeBracketIcon, SparklesIcon, RocketLaunchIcon, CpuChipIcon, PaintBrushIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="relative z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <CpuChipIcon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    CSSMA
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <Link href="/docs/getting-started" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
                  Docs
                </Link>
                <Link href="/docs/examples" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
                  Examples
                </Link>
                <Link href="/docs/plugin-system" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
                  Plugins
                </Link>
                <Link href="https://github.com/your-org/cssma" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
                  GitHub
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/docs/getting-started"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium mb-8">
              <SparklesIcon className="w-4 h-4 mr-2" />
              v4.0.0 Released
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Real-time CSS
              <span className="block bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Utility Engine
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-10 max-w-4xl mx-auto leading-relaxed">
              Generate CSS utilities instantly in the browser. No build step, no waiting — 
              just add classes and watch styles appear in real-time. Like Tailwind CSS, but 
              <span className="font-semibold text-gray-900"> truly instant</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/docs/getting-started"
                className="inline-flex items-center px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Get Started
                <ArrowRightIcon className="ml-2 w-5 h-5" />
              </Link>
              <Link 
                href="/docs/examples"
                className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                View Examples
              </Link>
            </div>
            
            {/* Code Preview */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-left">
                  <div className="text-green-400 text-sm mb-2">// Add classes to any element</div>
                  <div className="text-white text-lg">
                    <span className="text-blue-400">&lt;div</span> <span className="text-green-400">class=</span><span className="text-yellow-400">"bg-linear-to-r from-blue-500 to-purple-600 p-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105"</span><span className="text-blue-400">&gt;</span>
                  </div>
                  <div className="text-green-400 text-sm mt-2">// CSS generates instantly in real-time!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Choose CSSMA?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built for the modern web with real-time generation, zero runtime overhead, and 
              the most advanced CSS features available.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BoltIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Real-time Generation</h3>
              <p className="text-gray-600 leading-relaxed">
                CSS generates instantly as you add classes to the DOM. No build step, no waiting — 
                just instant styling like you've never seen before.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CpuChipIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Zero Runtime Overhead</h3>
              <p className="text-gray-600 leading-relaxed">
                Built with performance in mind. CSSMA generates static CSS at build-time, 
                ensuring your production builds are as fast as possible.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-pink-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <PaintBrushIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Modern CSS Features</h3>
              <p className="text-gray-600 leading-relaxed">
                Support for CSS Grid, Container Queries, OKLCH colors, and more. 
                CSSMA uses the latest web standards to give you the best developer experience.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CodeBracketIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">TypeScript First</h3>
              <p className="text-gray-600 leading-relaxed">
                Built with TypeScript from the ground up. Get full IntelliSense support, 
                type safety, and the best developer experience possible.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <RocketLaunchIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Plugin System</h3>
              <p className="text-gray-600 leading-relaxed">
                Extend CSSMA with custom utilities, variants, and themes. 
                Create your own design system with powerful plugin architecture.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <GlobeAltIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Framework Agnostic</h3>
              <p className="text-gray-600 leading-relaxed">
                Works with React, Vue, Angular, or vanilla JavaScript. 
                CSSMA integrates seamlessly with any frontend framework.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Section */}
      <div className="py-24 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Performance That Speaks for Itself
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              CSSMA delivers unmatched performance with real-time generation and 
              build-time optimization.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">6.4x</div>
              <div className="text-gray-300">Faster than traditional CSS-in-JS</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">&lt;1ms</div>
              <div className="text-gray-300">Real-time CSS generation</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">0</div>
              <div className="text-gray-300">Runtime overhead</div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-2xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Real-time vs Build-time
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">Instant CSS generation</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">No build step required</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">Arbitrary values work immediately</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">Dynamic class addition</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-6">
                <div className="text-green-400 text-sm mb-2">// Add classes dynamically</div>
                <div className="text-white text-sm">
                  <div>element.classList.add(</div>
                  <div className="ml-4">'bg-[#ff6b6b]',</div>
                  <div className="ml-4">'p-[2.5rem]',</div>
                  <div className="ml-4">'rounded-[12px]'</div>
                  <div>);</div>
                  <div className="text-green-400 mt-2">// CSS appears instantly!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            Ready to Experience Real-time CSS?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join thousands of developers who are already building faster with CSSMA v4.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/docs/getting-started"
              className="inline-flex items-center px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Get Started Now
              <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Link>
            <Link 
              href="/docs/examples"
              className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
            >
              View Examples
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <CpuChipIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  CSSMA
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                Real-time CSS utility engine for modern web development.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">Documentation</h3>
              <ul className="space-y-2">
                <li><Link href="/docs/getting-started" className="text-gray-600 hover:text-gray-900 text-sm">Getting Started</Link></li>
                <li><Link href="/docs/core-concepts" className="text-gray-600 hover:text-gray-900 text-sm">Core Concepts</Link></li>
                <li><Link href="/docs/api-reference" className="text-gray-600 hover:text-gray-900 text-sm">API Reference</Link></li>
                <li><Link href="/docs/examples" className="text-gray-600 hover:text-gray-900 text-sm">Examples</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="/docs/plugin-system" className="text-gray-600 hover:text-gray-900 text-sm">Plugin System</Link></li>
                <li><Link href="/docs/utilities" className="text-gray-600 hover:text-gray-900 text-sm">Utilities</Link></li>
                <li><Link href="/docs/variants" className="text-gray-600 hover:text-gray-900 text-sm">Variants</Link></li>
                <li><Link href="/docs/installation" className="text-gray-600 hover:text-gray-900 text-sm">Installation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">Community</h3>
              <ul className="space-y-2">
                <li><a href="https://github.com/your-org/cssma" className="text-gray-600 hover:text-gray-900 text-sm">GitHub</a></li>
                <li><a href="https://discord.gg/cssma" className="text-gray-600 hover:text-gray-900 text-sm">Discord</a></li>
                <li><a href="https://twitter.com/cssma" className="text-gray-600 hover:text-gray-900 text-sm">Twitter</a></li>
                <li><a href="https://blog.cssma.dev" className="text-gray-600 hover:text-gray-900 text-sm">Blog</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-gray-400 text-sm text-center">
              © 2024 CSSMA. Built with ❤️ for the web development community.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
