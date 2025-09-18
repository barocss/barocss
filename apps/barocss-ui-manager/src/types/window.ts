// AI Response Types
export type AIRenderType = 'window' | 'modal' | 'notification' | 'content'

export interface AIResponse {
  type: AIRenderType
  id: string
  title: string
  content: string
  metadata?: {
    size?: WindowSize
    position?: WindowPosition
    resizable?: boolean
    draggable?: boolean
    closable?: boolean
    minimizable?: boolean
    maximizable?: boolean
    modal?: boolean
    duration?: number // for notifications
    actions?: ActionButton[]
  }
}

export interface ActionButton {
  id: string
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void
}

// Window Management Types
export interface WindowSize {
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

export interface WindowPosition {
  x: number
  y: number
}

export interface WindowState {
  id: string
  title: string
  content: string
  size: WindowSize
  position: WindowPosition
  zIndex: number
  isMinimized: boolean
  isMaximized: boolean
  isFocused: boolean
  isDragging: boolean
  isResizing: boolean
  metadata: WindowMetadata
}

export interface WindowMetadata {
  resizable: boolean
  draggable: boolean
  closable: boolean
  minimizable: boolean
  maximizable: boolean
  modal: boolean
  actions?: ActionButton[]
}

// Modal Types
export interface ModalState {
  id: string
  title: string
  content: string
  size: WindowSize
  position: WindowPosition
  zIndex: number
  isOpen: boolean
  actions?: ActionButton[]
  onClose?: () => void
}

// Notification Types
export interface NotificationState {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration: number
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  isVisible: boolean
  actions?: ActionButton[]
}

// Window Manager State
export interface WindowManagerState {
  windows: WindowState[]
  modals: ModalState[]
  notifications: NotificationState[]
  nextZIndex: number
  focusedWindowId: string | null
}

// Window Manager Actions
export type WindowManagerAction =
  | { type: 'CREATE_WINDOW'; payload: Omit<WindowState, 'zIndex' | 'isMinimized' | 'isMaximized' | 'isFocused' | 'isDragging' | 'isResizing'> }
  | { type: 'UPDATE_WINDOW'; payload: { id: string; updates: Partial<WindowState> } }
  | { type: 'CLOSE_WINDOW'; payload: { id: string } }
  | { type: 'MINIMIZE_WINDOW'; payload: { id: string } }
  | { type: 'MAXIMIZE_WINDOW'; payload: { id: string } }
  | { type: 'RESTORE_WINDOW'; payload: { id: string } }
  | { type: 'FOCUS_WINDOW'; payload: { id: string } }
  | { type: 'BRING_TO_FRONT'; payload: { id: string } }
  | { type: 'CREATE_MODAL'; payload: Omit<ModalState, 'zIndex' | 'isOpen'> }
  | { type: 'CLOSE_MODAL'; payload: { id: string } }
  | { type: 'CREATE_NOTIFICATION'; payload: Omit<NotificationState, 'isVisible'> }
  | { type: 'REMOVE_NOTIFICATION'; payload: { id: string } }
  | { type: 'SET_FOCUSED_WINDOW'; payload: { id: string | null } }

// Event Types
export interface WindowEvent {
  type: 'window-created' | 'window-closed' | 'window-focused' | 'window-moved' | 'window-resized'
  windowId: string
  data?: any
}

export interface ModalEvent {
  type: 'modal-opened' | 'modal-closed'
  modalId: string
  data?: any
}

export interface NotificationEvent {
  type: 'notification-shown' | 'notification-hidden'
  notificationId: string
  data?: any
}

export type SystemEvent = WindowEvent | ModalEvent | NotificationEvent
