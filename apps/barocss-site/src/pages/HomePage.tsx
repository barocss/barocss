import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BoltIcon, 
  SparklesIcon, 
  HeartIcon,
  ClockIcon,
  CpuChipIcon,
  RocketLaunchIcon,
  CodeBracketIcon,
  PaintBrushIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  StarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Logo from '../components/Logo';

const HomePage: React.FC = () => {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-20 lg:py-32">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto">
            {/* Logo in Hero */}
            <div className="flex justify-center mb-8">
              <Logo size="lg" />
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight">
              Instant CSS with
              <span className="block bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Baroque Elegance
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              BaroCSS is a revolutionary real-time CSS library that implements Tailwind CSS's JIT mode. 
              Generate beautiful, responsive styles instantly without any build process.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link to="/docs" className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 transform">
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
              <Link to="/examples" className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-lg hover:border-blue-300 hover:text-blue-600 transition-all duration-300 hover:bg-blue-50">
                View Examples
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Why Choose BaroCSS?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of CSS development with our cutting-edge features
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            <div className="group text-center p-8 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <BoltIcon className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Instant Generation</h3>
              <p className="text-gray-600 leading-relaxed">
                CSS is generated in real-time as you type. No build process, no waiting, no frustration.
              </p>
            </div>
            
            <div className="group text-center p-8 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <SparklesIcon className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">AI-Powered</h3>
              <p className="text-gray-600 leading-relaxed">
                Intelligent CSS generation with AI assistance for complex layouts, animations, and responsive design.
              </p>
            </div>
            
            <div className="group text-center p-8 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <HeartIcon className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Baroque Elegance</h3>
              <p className="text-gray-600 leading-relaxed">
                Beautiful, artistic CSS with attention to detail, visual harmony, and sophisticated design patterns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Technical Excellence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built with modern technologies for maximum performance and developer experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClockIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">0ms Build Time</h3>
              <p className="text-gray-600">No compilation, instant results</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CpuChipIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">JIT Engine</h3>
              <p className="text-gray-600">Just-In-Time CSS generation</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RocketLaunchIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tree Shaking</h3>
              <p className="text-gray-600">Unused CSS automatically removed</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CodeBracketIcon className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">TypeScript</h3>
              <p className="text-gray-600">Full type safety support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Comparison */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Performance That Speaks
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how BaroCSS outperforms traditional CSS frameworks
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-8 rounded-2xl border border-red-200">
              <h3 className="text-2xl font-bold text-red-900 mb-4">Traditional CSS</h3>
              <ul className="space-y-3 text-red-800">
                <li className="flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Build time: 30s+
                </li>
                <li className="flex items-center">
                  <CpuChipIcon className="w-5 h-5 mr-2" />
                  Large bundle size
                </li>
                <li className="flex items-center">
                  <CodeBracketIcon className="w-5 h-5 mr-2" />
                  Static generation
                </li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl border border-blue-200 transform scale-105 shadow-xl">
              <h3 className="text-2xl font-bold text-blue-900 mb-4">BaroCSS</h3>
              <ul className="space-y-3 text-blue-800">
                <li className="flex items-center">
                  <BoltIcon className="w-5 h-5 mr-2" />
                  Build time: 0ms
                </li>
                <li className="flex items-center">
                  <RocketLaunchIcon className="w-5 h-5 mr-2" />
                  Minimal bundle size
                </li>
                <li className="flex items-center">
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  Dynamic generation
                </li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-2xl border border-green-200">
              <h3 className="text-2xl font-bold text-green-900 mb-4">Other JIT Tools</h3>
              <ul className="space-y-3 text-green-800">
                <li className="flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Build time: 5-10s
                </li>
                <li className="flex items-center">
                  <CpuChipIcon className="w-5 h-5 mr-2" />
                  Medium bundle size
                </li>
                <li className="flex items-center">
                  <CodeBracketIcon className="w-5 h-5 mr-2" />
                  Limited features
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Advanced Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover the powerful capabilities that make BaroCSS unique
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PaintBrushIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Variants</h3>
                  <p className="text-gray-600">Create your own utility classes and variants with ease</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <GlobeAltIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Responsive Design</h3>
                  <p className="text-gray-600">Built-in responsive utilities for all screen sizes</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheckIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Type Safety</h3>
                  <p className="text-gray-600">Full TypeScript support with autocomplete and error checking</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Performance Optimized</h3>
                  <p className="text-gray-600">Lightning-fast CSS generation with intelligent caching</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserGroupIcon className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Developer Experience</h3>
                  <p className="text-gray-600">Intuitive API with comprehensive documentation and examples</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <StarIcon className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Extensible</h3>
                  <p className="text-gray-600">Plugin system for custom functionality and integrations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Trusted by Developers Worldwide
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Join thousands of developers who've already discovered the power of instant CSS generation
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-bold text-blue-300">10K+</div>
              <div className="text-blue-100">Active Users</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-bold text-purple-300">50M+</div>
              <div className="text-purple-100">CSS Rules Generated</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-bold text-green-300">99.9%</div>
              <div className="text-green-100">Uptime</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-bold text-pink-300">24/7</div>
              <div className="text-pink-100">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-3xl p-12 lg:p-16 text-white text-center">
            <div className="relative z-10">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                Ready to Transform Your CSS Workflow?
              </h2>
              <p className="text-xl lg:text-2xl mb-10 opacity-90 max-w-3xl mx-auto">
                Experience the future of CSS development with BaroCSS. No more waiting, no more build processes.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <Link to="/docs" className="group px-10 py-4 bg-white text-purple-600 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 transform">
                  Start Building Now
                </Link>
                <Link to="/examples" className="px-10 py-4 border-2 border-white/30 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all duration-300">
                  Explore Examples
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
