import Link from 'next/link'
import Navigation from '@/components/Navigation'
import { ArrowRight, Code, Zap, Shield, Palette, Sparkles, Globe, Rocket, Copy, Check, Star, Github } from 'lucide-react'

const features = [
  {
    name: 'Real-time Processing',
    description: 'Instantly generates CSS when DOM classes are detected - no build step required.',
    icon: Zap,
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    name: 'Arbitrary Value Support',
    description: 'Runtime support for arbitrary values like w-[123px] and bg-[#ff0000] - just like Tailwind but real-time.',
    icon: Code,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Plugin System',
    description: 'Extensible plugin architecture for custom utilities and runtime theme extensions.',
    icon: Palette,
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    name: 'TypeScript Support',
    description: 'Full TypeScript support with comprehensive type definitions and IntelliSense.',
    icon: Shield,
    gradient: 'from-purple-500 to-pink-500',
  },
]

const stats = [
  { label: 'CSS Generation Speed', value: '< 1ms' },
  { label: 'DOM Scan Rate', value: '60fps' },
  { label: 'Arbitrary Value Support', value: '100%' },
  { label: 'Runtime Bundle', value: '< 50KB' },
]

export default function Home() {
  return (
    <div className="bg-white">
      <Navigation />
      
      {/* Hero section */}
      <div className="relative isolate overflow-hidden pt-16 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Background gradient mesh */}
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[-30deg] bg-gradient-to-tr from-[#4ade80] to-[#06b6d4] opacity-15 sm:left-[calc(50%+30rem)] sm:w-[72.1875rem]" />
        </div>
        
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
            <div className="mb-8">
              <div className="relative rounded-full px-4 py-1.5 text-sm leading-6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20 transition-all duration-200 inline-block">
                <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">CSSMA v4</span> is now available
                <span className="absolute inset-x-0 -top-px mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              </div>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-7xl">
              Real-time
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                CSS Utility
              </span>
              <span className="block text-gray-900">Engine</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              A revolutionary real-time CSS utility engine that generates styles instantly when DOM classes are detected.
              No build step required - arbitrary values and custom utilities work out of the box.
            </p>
            <div className="mt-10 flex items-center gap-x-6">
              <Link
                href="/docs/getting-started"
                className="group relative rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-blue-500/25"
              >
                Get started
                <ArrowRight className="ml-2 h-4 w-4 inline transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/docs/examples"
                className="group text-sm font-semibold leading-6 text-gray-900 flex items-center gap-2 hover:text-blue-600 transition-colors"
              >
                View examples <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            
            {/* Quick install */}
            <div className="mt-16">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600">Quick install</span>
              </div>
              <div className="relative">
                <div className="rounded-lg bg-gray-900 p-4 pr-12 font-mono text-sm text-gray-100 border border-gray-200 shadow-sm">
                  npm install cssma@latest
                </div>
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Hero code example */}
          <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
            <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
              <div className="rounded-xl bg-white/80 p-6 ring-1 ring-gray-200 backdrop-blur-sm shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-red-400"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                  <span className="ml-2 text-sm text-gray-500">real-time-example.html</span>
                </div>
                <pre className="text-sm text-gray-800 overflow-x-auto">
                  <code className="language-html">{`<!-- Just add classes to DOM - CSS generates automatically! -->
<div class="bg-blue-500 p-4 rounded-lg shadow-md">
  Real-time styling in action
</div>

<!-- Arbitrary values work instantly -->
<div class="w-[423px] h-[123px] bg-[#ff6b6b] text-[14px]">
  Custom dimensions and colors
</div>

<!-- Complex layouts, real-time -->
<div class="grid grid-cols-[200px_1fr_100px] gap-[20px] p-[2rem]">
  <aside>Sidebar</aside>
  <main>Content</main>
  <nav>Navigation</nav>
</div>

<!-- Hover states and animations -->
<button class="bg-gradient-to-r from-purple-500 to-pink-500 
               hover:scale-105 transition-transform duration-300
               px-6 py-3 rounded-full text-white font-medium">
  Interactive Button
</button>`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" />
        </div>
      </div>

      {/* Stats section */}
      <div className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:max-w-none">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Real-time performance metrics
              </h2>
              <p className="mt-4 text-lg leading-8 text-gray-600">
                Lightning-fast CSS generation that works at runtime
              </p>
            </div>
            <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col bg-white/60 p-8 shadow-sm">
                  <dt className="text-sm font-semibold leading-6 text-gray-600">{stat.label}</dt>
                  <dd className="order-first text-3xl font-bold tracking-tight text-gray-900">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Advanced Framework</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need for real-time styling
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              CSSMA v4 revolutionizes CSS utilities by generating styles instantly when DOM classes are detected.
              No build step, no compilation - just pure real-time magic.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.name} className="group relative rounded-2xl bg-gray-50 p-8 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 hover:scale-105">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r ${feature.gradient} mb-6`}>
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <dt className="text-lg font-semibold leading-7 text-gray-900 group-hover:text-blue-600 transition-colors">
                    {feature.name}
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Code example section */}
      <div className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Real-time Magic</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Add classes, get styles instantly
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Watch CSSMA detect DOM changes and generate CSS in real-time - no build required
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="relative rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-gray-200 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                  <span className="ml-3 text-sm text-gray-500 font-mono">dom-detection.js</span>
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors">
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </div>
              <pre className="text-sm text-gray-800 overflow-x-auto">
                <code className="language-javascript">{`// Initialize CSSMA - it starts watching the DOM immediately
import { initCSSMA } from 'cssma'

initCSSMA({
  theme: {
    colors: { brand: '#3b82f6', accent: '#64748b' },
    spacing: { tight: '0.5rem', normal: '1rem' }
  }
})

// That's it! Now just add classes to your HTML:

// Regular utilities work instantly
document.body.innerHTML = \`
  <div class="bg-brand p-normal rounded-lg shadow-md">
    Real-time styling!
  </div>
\`

// Arbitrary values work immediately  
const dynamicDiv = document.createElement('div')
dynamicDiv.className = 'w-[250px] h-[100px] bg-[#ff6b6b] text-[18px]'
document.body.appendChild(dynamicDiv)
// ↑ CSS is generated and applied instantly!

// Even complex responsive layouts
const complexLayout = \`
  <div class="grid grid-cols-[minmax(200px,1fr)_3fr_200px] 
             gap-[clamp(1rem,5vw,3rem)] p-[2rem]">
    <aside class="bg-gray-100 p-[1.5rem]">Sidebar</aside>
    <main class="bg-white border-[2px] border-[#e5e7eb]">Content</main>
    <nav class="bg-blue-50 rounded-[12px]">Nav</nav>
  </div>
\`
// All styles generate in < 1ms ⚡️`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Start building with CSSMA v4 today. Check out our documentation and examples to get up and running quickly.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/docs/installation"
                className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                Installation Guide
              </Link>
              <Link
                href="/docs/plugin-system"
                className="group text-sm font-semibold leading-6 text-gray-900 flex items-center gap-2 hover:text-blue-600 transition-colors"
              >
                Plugin System <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <a href="https://github.com/your-org/figmaikr" className="text-gray-400 hover:text-gray-600 transition-colors">
              <span className="sr-only">GitHub</span>
              <Github className="h-6 w-6" />
            </a>
            <a href="https://www.npmjs.com/package/cssma" className="text-gray-400 hover:text-gray-600 transition-colors">
              <span className="sr-only">NPM</span>
              <Globe className="h-6 w-6" />
            </a>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <div className="flex items-center justify-center md:justify-start">
              <span className="text-xl font-bold text-gray-900">CSSMA v4</span>
              <div className="ml-4 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-1 text-sm text-gray-500">by developers</span>
              </div>
            </div>
            <p className="text-center text-xs leading-5 text-gray-500 md:text-left mt-2">
              &copy; 2025 CSSMA. Built with ❤️ for the developer community.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
