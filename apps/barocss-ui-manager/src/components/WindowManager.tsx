import React from 'react'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { Window } from './Window'

export const WindowManager: React.FC = () => {
  const { state } = useWindowManager()

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Windows */}
      {state.windows.map((window) => (
        <div key={window.id} className="pointer-events-auto">
          <Window window={window} />
        </div>
      ))}
    </div>
  )
}
