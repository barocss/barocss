import React from 'react';

const ExamplesPage: React.FC = () => {
  const examples = [
    {
      title: 'React App',
      description: 'Complete React application with BaroCSS integration',
      icon: '⚛️',
      link: '#react'
    },
    {
      title: 'Vue App',
      description: 'Vue.js application styled with BaroCSS utilities',
      icon: '💚',
      link: '#vue'
    },
    {
      title: 'Landing Page',
      description: 'Modern marketing landing page with BaroCSS',
      icon: '🚀',
      link: '#landing'
    },
    {
      title: 'Dashboard',
      description: 'Admin dashboard with comprehensive UI components',
      icon: '📊',
      link: '#dashboard'
    }
  ];

  return (
    <main className="flex-1 py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            BaroCSS Examples
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore real-world examples and learn how to use BaroCSS in your projects.
          </p>
        </div>

        {/* Examples Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-16">
          {examples.map((example, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm p-8 hover:shadow-lg transition-shadow duration-200">
              <div className="text-4xl mb-4">{example.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{example.title}</h3>
              <p className="text-gray-600 mb-6">{example.description}</p>
              <a 
                href={example.link}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                View Example
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          ))}
        </div>

        {/* Quick Start Example */}
        <section className="bg-white rounded-xl shadow-sm p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Start Example</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">HTML Structure</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <div>&lt;!DOCTYPE html&gt;</div>
                <div>&lt;html lang="en"&gt;</div>
                <div>&lt;head&gt;</div>
                <div>&nbsp;&nbsp;&lt;script src="barocss"&gt;&lt;/script&gt;</div>
                <div>&lt;/head&gt;</div>
                <div>&lt;body&gt;</div>
                <div>&nbsp;&nbsp;&lt;div className="bg-blue-500 text-white p-4 rounded"&gt;</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;Hello BaroCSS!</div>
                <div>&nbsp;&nbsp;&lt;/div&gt;</div>
                <div>&lt;/body&gt;</div>
                <div>&lt;/html&gt;</div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Result</h3>
              <div className="bg-blue-500 text-white p-4 rounded text-center">
                Hello BaroCSS!
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-blue-600 text-white rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Build?</h2>
          <p className="text-blue-100 mb-6">
            Start building your own examples with BaroCSS today.
          </p>
          <a 
            href="https://docs.barocss.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200 inline-block"
          >
            Get Started
          </a>
        </section>
      </div>
    </main>
  );
};

export default ExamplesPage;
