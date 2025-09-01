import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <Logo size="sm" showText={true} />
            <p className="text-gray-400 text-sm">
              Instant CSS with Baroque Elegance. Transform your development workflow.
            </p>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Product</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link to="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link to="/examples" className="hover:text-white transition-colors">Examples</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Community</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Company</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400">
            &copy; 2025 BaroCSS. Made with ❤️ for instant CSS development.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
