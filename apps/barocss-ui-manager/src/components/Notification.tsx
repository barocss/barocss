import React, { useEffect } from 'react'
import { NotificationState } from '../types/window'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { Button } from './ui/Button'

interface NotificationProps {
  notification: NotificationState
}

export const Notification: React.FC<NotificationProps> = ({ notification }) => {
  const { removeNotification } = useWindowManager()

  // Auto remove notification after duration
  useEffect(() => {
    if (notification.duration > 0) {
      const timer = setTimeout(() => {
        removeNotification(notification.id)
      }, notification.duration)

      return () => clearTimeout(timer)
    }
  }, [notification.id, notification.duration, removeNotification])

  // Handle action button click
  const handleActionClick = (actionId: string) => {
    // Find the action and execute its onClick if available
    const action = notification.actions?.find(a => a.id === actionId)
    if (action?.onClick) {
      action.onClick()
    }
    
    // Remove notification after action
    removeNotification(notification.id)
  }

  if (!notification.isVisible) {
    return null
  }

  const getTypeStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      default:
        return 'ℹ️'
    }
  }

  const getPositionStyles = () => {
    switch (notification.position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2'
      case 'bottom-right':
        return 'bottom-4 right-4'
      default:
        return 'top-4 right-4'
    }
  }

  return (
    <div
      className={`fixed z-50 max-w-sm w-full ${getPositionStyles()}`}
    >
      <div
        className={`p-4 rounded-lg border shadow-lg ${getTypeStyles()}`}
      >
        <div className="flex items-start gap-3">
          <div className="text-lg">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-1">
              {notification.title}
            </h3>
            <p className="text-sm">
              {notification.message}
            </p>
            
            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {notification.actions.map((action) => (
                  <Button
                    key={action.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleActionClick(action.id)}
                    className="text-xs h-6 px-2"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeNotification(notification.id)}
            className="h-6 w-6 p-0 hover:bg-gray-200"
          >
            ×
          </Button>
        </div>
      </div>
    </div>
  )
}


