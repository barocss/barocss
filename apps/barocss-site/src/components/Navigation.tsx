import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <Logo size="md" />
            <span className="text-2xl font-bold text-gray-900">BaroCSS</span>
          </Link>
          
          <div className="flex items-center space-x-1">
            <Link 
              to="/" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                isActive('/') 
                  ? 'text-blue-600 bg-blue-50 border-blue-200' 
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 hover:border-gray-200 border-transparent'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/examples" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                isActive('/examples') 
                  ? 'text-blue-600 bg-blue-50 border-blue-200' 
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 hover:border-gray-200 border-transparent'
              }`}
            >
              Examples
            </Link>
            <a 
              href="https://docs.barocss.com" 
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border text-gray-700 hover:text-blue-600 hover:bg-gray-50 hover:border-gray-200 border-transparent"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
