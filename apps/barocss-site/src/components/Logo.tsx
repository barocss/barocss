import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill="url(#gradient)" stroke="url(#gradient)" strokeWidth="2"/>
      
      {/* CSS brackets */}
      <path d="M20 20 L32 32 L20 44" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M44 20 L32 32 L44 44" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Center dot */}
      <circle cx="32" cy="32" r="3" fill="white"/>
      
      {/* Decorative elements */}
      <circle cx="24" cy="24" r="2" fill="rgba(255,255,255,0.6)"/>
      <circle cx="40" cy="40" r="2" fill="rgba(255,255,255,0.6)"/>
      <circle cx="24" cy="40" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="40" cy="24" r="1.5" fill="rgba(255,255,255,0.4)"/>
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  );
};

export default Logo;
