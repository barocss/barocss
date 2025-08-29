import Link from 'next/link'
import { ArrowRightIcon, BoltIcon, CodeBracketIcon, SparklesIcon, RocketLaunchIcon, CpuChipIcon, PaintBrushIcon, GlobeAltIcon, CommandLineIcon, CubeIcon, BeakerIcon } from '@heroicons/react/24/outline'

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
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
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
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
                className="inline-flex items-center px-4 py-2 border border-blue-600 text-sm font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23666%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium mb-8">
              <SparklesIcon className="w-4 h-4 mr-2" />
              AI-Powered v4.0.0 Released
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              The Future of
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Design Intelligence
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-10 max-w-4xl mx-auto leading-relaxed">
              Where AI meets Design meets Agent meets OS. CSSMA is the world&apos;s first 
              <span className="font-semibold text-gray-900"> intelligent CSS utility engine</span> that thinks, 
              learns, and creates in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/docs/getting-started"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Experience the Future
                <ArrowRightIcon className="ml-2 w-5 h-5" />
              </Link>
              <Link 
                href="/docs/examples"
                className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                View AI Examples
              </Link>
            </div>
            
            {/* AI Code Preview */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="ml-2 text-xs text-gray-400">AI Agent Active</div>
                </div>
                <div className="text-left">
                  <div className="text-green-400 text-sm mb-2">{/* AI Agent analyzing design intent */}</div>
                  <div className="text-white text-lg">
                    <span className="text-blue-400">&lt;div</span> <span className="text-green-400">class=</span><span className="text-yellow-400">&quot;ai-generated bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 p-8 rounded-2xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-500 hover:scale-105 animate-pulse&quot;</span><span className="text-blue-400">&gt;</span>
                  </div>
                  <div className="text-green-400 text-sm mt-2">{/* AI Agent: CSS generated with design intelligence */}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI + Design + Agent + OS Concept Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              The Four Pillars of Design Intelligence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              CSSMA combines the power of AI, Design, Agent, and OS to create the most 
              intelligent CSS generation system ever built.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CpuChipIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">🤖 AI Intelligence</h3>
              <p className="text-gray-600 leading-relaxed">
                Machine learning algorithms that understand design patterns, user intent, and 
                create optimal CSS solutions automatically. The AI learns from every interaction.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <PaintBrushIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">🎨 Design Mastery</h3>
              <p className="text-gray-600 leading-relaxed">
                Advanced design system understanding with support for modern CSS features, 
                accessibility standards, and responsive design principles.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CommandLineIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">🤝 Agent Collaboration</h3>
              <p className="text-gray-600 leading-relaxed">
                Intelligent agents that work alongside developers, suggesting improvements, 
                catching errors, and automating repetitive design tasks.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CubeIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">💻 OS Integration</h3>
              <p className="text-gray-600 leading-relaxed">
                Seamless integration with development environments, build tools, and 
                deployment pipelines. Works everywhere, from local development to production.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why CSSMA is Revolutionary?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The first CSS utility engine that thinks, learns, and creates like a human designer.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BoltIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Real-time AI Generation</h3>
              <p className="text-gray-600 leading-relaxed">
                CSS generates instantly with AI-powered intelligence. The system learns your 
                design patterns and suggests optimizations in real-time.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BeakerIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Design Intelligence</h3>
              <p className="text-gray-600 leading-relaxed">
                Advanced algorithms understand design principles, accessibility requirements, 
                and create pixel-perfect CSS that follows best practices.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CodeBracketIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">TypeScript First</h3>
              <p className="text-gray-600 leading-relaxed">
                Built with TypeScript from the ground up. Get full IntelliSense support, 
                type safety, and AI-powered code suggestions.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <RocketLaunchIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Plugin System</h3>
              <p className="text-gray-600 leading-relaxed">
                Extend CSSMA with custom AI agents, design patterns, and intelligent 
                utilities. Create your own design intelligence.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <GlobeAltIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Universal Compatibility</h3>
              <p className="text-gray-600 leading-relaxed">
                Works with React, Vue, Angular, or vanilla JavaScript. The AI adapts to 
                your framework and development environment.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-pink-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CpuChipIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Zero Runtime Overhead</h3>
              <p className="text-gray-600 leading-relaxed">
                AI-generated CSS is optimized at build-time, ensuring your production builds 
                are as fast as possible with zero performance impact.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              AI Performance That Defies Expectations
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              CSSMA&apos;s AI engine delivers unmatched performance with intelligent optimization 
              and real-time learning.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">10x</div>
              <div className="text-gray-600">Faster than traditional CSS-in-JS</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">&lt;0.5ms</div>
              <div className="text-gray-600">AI-powered CSS generation</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">∞</div>
              <div className="text-gray-600">Learning iterations</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  AI vs Traditional Approach
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">AI understands design intent</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Learns from every interaction</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Suggests optimizations automatically</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Adapts to your design patterns</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-6">
                <div className="text-green-400 text-sm mb-2">{/* AI Agent analyzing design */}</div>
                <div className="text-white text-sm">
                  <div>aiAgent.analyzeDesign(</div>
                  <div className="ml-4">&apos;modern-card-layout&apos;,</div>
                  <div className="ml-4">&apos;accessible-colors&apos;,</div>
                  <div className="ml-4">&apos;responsive-grid&apos;</div>
                  <div>);</div>
                  <div className="text-green-400 mt-2">{/* AI: CSS generated with intelligence */}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            Ready to Experience AI-Powered Design?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join the future of web development with CSSMA&apos;s intelligent CSS generation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/docs/getting-started"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Start Building with AI
              <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Link>
            <Link 
              href="/docs/examples"
              className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
            >
              Explore AI Examples
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <CpuChipIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  CSSMA
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                AI-powered CSS utility engine for the future of web development.
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
                <li><Link href="/docs/plugin-system" className="text-gray-600 hover:text-gray-900 text-sm">AI Plugin System</Link></li>
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
              © 2025 CSSMA. Built with ❤️ and AI for the future of web development.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
