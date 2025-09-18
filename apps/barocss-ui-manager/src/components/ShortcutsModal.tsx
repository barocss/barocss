import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog'

interface ShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  { key: 'Ctrl/Cmd + Enter', description: '메시지 전송' },
  { key: 'Ctrl/Cmd + N', description: '새 채팅' },
  { key: 'Ctrl/Cmd + K', description: '입력창 포커스' },
  { key: 'Ctrl/Cmd + \\', description: '채팅 토글 (숨기기/보이기)' },
  { key: 'Ctrl/Cmd + /', description: '단축키 도움말' },
  { key: 'Escape', description: '모달 닫기' },
]

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onOpenChange }) => {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-1/2 top-1/2 z-[90] grid w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:opacity-0 data-[state=closed]:pointer-events-none data-[state=closed]:hidden">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
          <DialogDescription>
            BaroCSS UI Manager에서 사용할 수 있는 키보드 단축키입니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid gap-3">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 rounded-md bg-gray-50">
                <span className="text-sm font-medium text-gray-900">
                  {shortcut.description}
                </span>
                <kbd className="px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded shadow-sm">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500">
              💡 팁: 대부분의 단축키는 Ctrl (Windows/Linux) 또는 Cmd (Mac) 키와 함께 사용합니다.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
