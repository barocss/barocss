import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";
import {
  type WindowManagerState,
  type WindowManagerAction,
  type WindowState,
  type ModalState,
  type NotificationState,
  type AIResponse,
} from "../types/window";

// Initial state
const initialState: WindowManagerState = {
  windows: [],
  modals: [],
  notifications: [],
  nextZIndex: 1000,
  focusedWindowId: null,
};

// Reducer
function windowManagerReducer(
  state: WindowManagerState,
  action: WindowManagerAction
): WindowManagerState {
  switch (action.type) {
    case "CREATE_WINDOW": {
      const newWindow: WindowState = {
        ...action.payload,
        zIndex: state.nextZIndex,
        isMinimized: false,
        isMaximized: false,
        isFocused: true,
        isDragging: false,
        isResizing: false,
      };
      return {
        ...state,
        windows: [...state.windows, newWindow],
        nextZIndex: state.nextZIndex + 1,
        focusedWindowId: newWindow.id,
      };
    }

    case "UPDATE_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.payload.id
            ? { ...window, ...action.payload.updates }
            : window
        ),
      };
    }

    case "CLOSE_WINDOW": {
      return {
        ...state,
        windows: state.windows.filter(
          (window) => window.id !== action.payload.id
        ),
        focusedWindowId:
          state.focusedWindowId === action.payload.id
            ? null
            : state.focusedWindowId,
      };
    }

    case "MINIMIZE_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.payload.id
            ? { ...window, isMinimized: true, isFocused: false }
            : window
        ),
        focusedWindowId:
          state.focusedWindowId === action.payload.id
            ? null
            : state.focusedWindowId,
      };
    }

    case "MAXIMIZE_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.payload.id
            ? { ...window, isMaximized: true }
            : window
        ),
      };
    }

    case "RESTORE_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.payload.id
            ? { ...window, isMaximized: false, isMinimized: false }
            : window
        ),
      };
    }

    case "FOCUS_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.payload.id
            ? { ...window, isFocused: true, zIndex: state.nextZIndex }
            : { ...window, isFocused: false }
        ),
        nextZIndex: state.nextZIndex + 1,
        focusedWindowId: action.payload.id,
      };
    }

    case "BRING_TO_FRONT": {
      return {
        ...state,
        windows: state.windows.map((window) =>
          window.id === action.payload.id
            ? { ...window, zIndex: state.nextZIndex, isFocused: true }
            : { ...window, isFocused: false }
        ),
        nextZIndex: state.nextZIndex + 1,
        focusedWindowId: action.payload.id,
      };
    }

    case "CREATE_MODAL": {
      const newModal: ModalState = {
        ...action.payload,
        zIndex: state.nextZIndex,
        isOpen: true,
      };
      return {
        ...state,
        modals: [...state.modals, newModal],
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case "CLOSE_MODAL": {
      return {
        ...state,
        modals: state.modals.filter((modal) => modal.id !== action.payload.id),
      };
    }

    case "CREATE_NOTIFICATION": {
      const newNotification: NotificationState = {
        ...action.payload,
        isVisible: true,
      };
      return {
        ...state,
        notifications: [...state.notifications, newNotification],
      };
    }

    case "REMOVE_NOTIFICATION": {
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== action.payload.id
        ),
      };
    }

    case "SET_FOCUSED_WINDOW": {
      return {
        ...state,
        focusedWindowId: action.payload.id,
      };
    }

    default:
      return state;
  }
}

// Context
interface WindowManagerContextType {
  state: WindowManagerState;
  dispatch: React.Dispatch<WindowManagerAction>;
  createWindow: (
    window: Omit<
      WindowState,
      | "zIndex"
      | "isMinimized"
      | "isMaximized"
      | "isFocused"
      | "isDragging"
      | "isResizing"
    >
  ) => void;
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  createModal: (modal: Omit<ModalState, "zIndex" | "isOpen">) => void;
  closeModal: (id: string) => void;
  createNotification: (
    notification: Omit<NotificationState, "isVisible">
  ) => void;
  removeNotification: (id: string) => void;
  handleAIResponse: (response: AIResponse) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(
  null
);

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error(
      "useWindowManager must be used within WindowManagerProvider"
    );
  }
  return context;
};

// Provider
interface WindowManagerProviderProps {
  children: React.ReactNode;
}

export const WindowManagerProvider: React.FC<WindowManagerProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(windowManagerReducer, initialState);

  // Window actions
  const createWindow = useCallback(
    (
      window: Omit<
        WindowState,
        | "zIndex"
        | "isMinimized"
        | "isMaximized"
        | "isFocused"
        | "isDragging"
        | "isResizing"
      >
    ) => {
      dispatch({ type: "CREATE_WINDOW", payload: window });
    },
    []
  );

  const updateWindow = useCallback(
    (id: string, updates: Partial<WindowState>) => {
      dispatch({ type: "UPDATE_WINDOW", payload: { id, updates } });
    },
    []
  );

  const closeWindow = useCallback((id: string) => {
    dispatch({ type: "CLOSE_WINDOW", payload: { id } });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    dispatch({ type: "MINIMIZE_WINDOW", payload: { id } });
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    dispatch({ type: "MAXIMIZE_WINDOW", payload: { id } });
  }, []);

  const restoreWindow = useCallback((id: string) => {
    dispatch({ type: "RESTORE_WINDOW", payload: { id } });
  }, []);

  const focusWindow = useCallback((id: string) => {
    dispatch({ type: "FOCUS_WINDOW", payload: { id } });
  }, []);

  const bringToFront = useCallback((id: string) => {
    dispatch({ type: "BRING_TO_FRONT", payload: { id } });
  }, []);

  // Modal actions
  const createModal = useCallback(
    (modal: Omit<ModalState, "zIndex" | "isOpen">) => {
      dispatch({ type: "CREATE_MODAL", payload: modal });
    },
    []
  );

  const closeModal = useCallback((id: string) => {
    dispatch({ type: "CLOSE_MODAL", payload: { id } });
  }, []);

  // Notification actions
  const createNotification = useCallback(
    (notification: Omit<NotificationState, "isVisible">) => {
      dispatch({ type: "CREATE_NOTIFICATION", payload: notification });
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: { id } });
  }, []);

  // AI Response handler
  const handleAIResponse = useCallback(
    (response: AIResponse) => {
      const { type, id, title, content, metadata } = response;

      switch (type) {
        case "window": {
          createWindow({
            id,
            title,
            content,
            size: metadata?.size || { width: 800, height: 600 },
            position: metadata?.position || { x: 100, y: 100 },
            metadata: {
              resizable: metadata?.resizable ?? true,
              draggable: metadata?.draggable ?? true,
              closable: metadata?.closable ?? true,
              minimizable: metadata?.minimizable ?? true,
              maximizable: metadata?.maximizable ?? true,
              modal: metadata?.modal ?? false,
              actions: metadata?.actions,
            },
          });
          break;
        }

        case "modal": {
          createModal({
            id,
            title,
            content,
            size: metadata?.size || { width: 400, height: 300 },
            position: metadata?.position || { x: 0, y: 0 }, // Centered
            actions: metadata?.actions,
          });
          break;
        }

        case "notification": {
          createNotification({
            id,
            title,
            message: content,
            type: "info",
            duration: metadata?.duration || 5000,
            position: "top-right",
            actions: metadata?.actions,
          });
          break;
        }

        case "content": {
          // Update existing window or create new one
          const existingWindow = state.windows.find((w) => w.id === id);
          if (existingWindow) {
            updateWindow(id, { content });
          } else {
            createWindow({
              id,
              title,
              content,
              size: { width: 800, height: 600 },
              position: { x: 100, y: 100 },
              metadata: {
                resizable: true,
                draggable: true,
                closable: true,
                minimizable: true,
                maximizable: true,
                modal: false,
              },
            });
          }
          break;
        }
      }
    },
    [state.windows, createWindow, updateWindow, createModal, createNotification]
  );

  const value: WindowManagerContextType = {
    state,
    dispatch,
    createWindow,
    updateWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    focusWindow,
    bringToFront,
    createModal,
    closeModal,
    createNotification,
    removeNotification,
    handleAIResponse,
  };

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
};
