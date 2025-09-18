import React from 'react'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { Notification } from './Notification'

export const NotificationManager: React.FC = () => {
  const { state } = useWindowManager()

  return (
    <>
      {state.notifications.map((notification) => (
        <Notification key={notification.id} notification={notification} />
      ))}
    </>
  )
}

