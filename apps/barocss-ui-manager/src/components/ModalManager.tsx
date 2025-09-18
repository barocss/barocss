import React from 'react'
import { useWindowManager } from '../providers/WindowManagerProvider'
import { Modal } from './Modal'

export const ModalManager: React.FC = () => {
  const { state } = useWindowManager()

  return (
    <>
      {state.modals.map((modal) => (
        <Modal key={modal.id} modal={modal} />
      ))}
    </>
  )
}


