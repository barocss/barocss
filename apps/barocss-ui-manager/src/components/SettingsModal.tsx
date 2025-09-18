import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange }) => {
  const [settings, setSettings] = useState({
    model: 'mock',
    temperature: 0.7,
    maxTokens: 1000,
    theme: 'light',
    language: 'ko'
  })

  const handleSave = () => {
    // 설정 저장 로직
    console.log('Settings saved:', settings)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>
            BaroCSS UI Manager의 설정을 변경하세요.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">일반</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="ui">UI</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">언어</label>
              <select 
                value={settings.language}
                onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">테마</label>
              <select 
                value={settings.theme}
                onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="light">라이트</option>
                <option value="dark">다크</option>
                <option value="auto">자동</option>
              </select>
            </div>
          </TabsContent>
          
          <TabsContent value="ai" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">모델</label>
              <select 
                value={settings.model}
                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="mock">Mock Agent</option>
                <option value="gpt-4">GPT-4</option>
                <option value="claude">Claude</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Temperature: {settings.temperature}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">최대 토큰 수</label>
              <Input
                type="number"
                value={settings.maxTokens}
                onChange={(e) => setSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                min="100"
                max="4000"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="ui" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">채팅 폭</label>
              <select className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500">
                <option value="narrow">좁음 (320px)</option>
                <option value="medium">보통 (360px)</option>
                <option value="wide">넓음 (400px)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">메시지 애니메이션</label>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="animations" defaultChecked />
                <label htmlFor="animations" className="text-sm">애니메이션 사용</label>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">자동 스크롤</label>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="autoScroll" defaultChecked />
                <label htmlFor="autoScroll" className="text-sm">새 메시지 시 자동 스크롤</label>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
