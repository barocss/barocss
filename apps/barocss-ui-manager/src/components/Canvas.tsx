import React from 'react'
import { ComputerDesktopIcon } from '@heroicons/react/24/outline'

interface CanvasProps {
  className?: string
}

export const Canvas: React.FC<CanvasProps> = ({ className = '' }) => {
  return (
    <div className={`flex-1 relative overflow-hidden ${className}`}>
      {/* Canvas window */}
      <div 
        id="bc-output" 
        className="h-full w-full relative overflow-hidden"
      >
        <div className="h-full w-full grid place-items-center text-center text-gray-600 select-none bg-white rounded-t-2xl shadow-lg">
          <div className="max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
              <ComputerDesktopIcon className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Application Canvas</h3>
            <p className="text-sm text-gray-500 mb-4">
              This is where your application will live. Use the chat to add features and components.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">Interactive UI</span>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">Dynamic Content</span>
              <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full">Real-time Updates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
