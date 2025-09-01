import React from 'react';
import { 
  BoltIcon, 
  CodeBracketIcon, 
  SparklesIcon 
} from '@heroicons/react/24/outline';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Logo Icon - CSS + Lightning + Sparkles for elegance */}
      <div className={`${sizeClasses[size]} relative bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105 overflow-hidden`}>
        <BoltIcon className="w-5 h-5 text-white" />
      </div>
      
      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`${textSizes[size]} font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-blue-800 bg-clip-text text-transparent leading-tight`}>
            BaroCSS
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
