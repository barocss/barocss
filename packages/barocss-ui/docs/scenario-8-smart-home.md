# 시나리오 8: 스마트 홈 관리

## 개요
사용자의 스마트 홈 기기들을 통합 관리하고, AI가 자동으로 최적의 환경을 조성해주는 스마트 홈 관리 시스템입니다.

## 시나리오 플로우

### 1단계: 스마트 홈 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("스마트 홈 관리 시스템을 만들어줘. 집 안의 모든 기기를 제어하고 싶어");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "스마트 홈 관리 시스템을 만들어줘. 집 안의 모든 기기를 제어하고 싶어",
  sceneHistory: [
    // 이전 모든 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    smartHomeDevices: {
      lights: [
        { id: "living-room-light", name: "거실 조명", status: "off", brightness: 0, color: "white" },
        { id: "bedroom-light", name: "침실 조명", status: "off", brightness: 0, color: "white" },
        { id: "kitchen-light", name: "부엌 조명", status: "on", brightness: 80, color: "warm" }
      ],
      temperature: [
        { id: "living-room-ac", name: "거실 에어컨", status: "off", temperature: 24, mode: "cool" },
        { id: "bedroom-ac", name: "침실 에어컨", status: "off", temperature: 24, mode: "cool" }
      ],
      security: [
        { id: "front-door-camera", name: "현관 카메라", status: "on", recording: true },
        { id: "motion-sensor", name: "동작 감지기", status: "on", sensitivity: "medium" },
        { id: "door-lock", name: "스마트 도어락", status: "locked", autoLock: true }
      ],
      entertainment: [
        { id: "living-room-tv", name: "거실 TV", status: "off", channel: 1, volume: 50 },
        { id: "sound-system", name: "사운드 시스템", status: "off", volume: 0, source: "none" }
      ]
    },
    preferences: {
      defaultTemperature: 22,
      lightingMode: "auto",
      securityLevel: "high",
      energySaving: true
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 스마트 홈 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">🏠 AI 스마트 홈</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">john@example.com님의 집</span>
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 홈 상태 요약 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-blue-900 mb-4">🏠 홈 상태 요약</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">조명</h3>
          <p class="text-2xl font-bold text-yellow-600">1/3 켜짐</p>
          <p class="text-sm text-gray-600">부엌 조명만 켜져있음</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">온도</h3>
          <p class="text-2xl font-bold text-blue-600">24°C</p>
          <p class="text-sm text-gray-600">에어컨 꺼짐</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">보안</h3>
          <p class="text-2xl font-bold text-green-600">안전</p>
          <p class="text-sm text-gray-600">모든 센서 정상</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">에너지</h3>
          <p class="text-2xl font-bold text-purple-600">15W</p>
          <p class="text-sm text-gray-600">절약 모드</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 조명 제어 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6 mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">💡 조명 제어</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">거실 조명</h4>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" data-device="living-room-light">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div class="space-y-2">
                <label class="text-sm text-gray-600">밝기</label>
                <input type="range" min="0" max="100" value="0" 
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                       data-device="living-room-light" data-property="brightness">
                <div class="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <div class="mt-3">
                <label class="text-sm text-gray-600">색상</label>
                <div class="flex space-x-2 mt-1">
                  <button class="w-6 h-6 bg-white rounded-full border-2 border-gray-300" 
                          data-device="living-room-light" data-property="color" data-value="white"></button>
                  <button class="w-6 h-6 bg-yellow-300 rounded-full border-2 border-gray-300" 
                          data-device="living-room-light" data-property="color" data-value="warm"></button>
                  <button class="w-6 h-6 bg-blue-300 rounded-full border-2 border-gray-300" 
                          data-device="living-room-light" data-property="color" data-value="cool"></button>
                </div>
              </div>
            </div>

            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">침실 조명</h4>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" data-device="bedroom-light">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div class="space-y-2">
                <label class="text-sm text-gray-600">밝기</label>
                <input type="range" min="0" max="100" value="0" 
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                       data-device="bedroom-light" data-property="brightness">
                <div class="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <div class="mt-3">
                <label class="text-sm text-gray-600">색상</label>
                <div class="flex space-x-2 mt-1">
                  <button class="w-6 h-6 bg-white rounded-full border-2 border-gray-300" 
                          data-device="bedroom-light" data-property="color" data-value="white"></button>
                  <button class="w-6 h-6 bg-yellow-300 rounded-full border-2 border-gray-300" 
                          data-device="bedroom-light" data-property="color" data-value="warm"></button>
                  <button class="w-6 h-6 bg-blue-300 rounded-full border-2 border-gray-300" 
                          data-device="bedroom-light" data-property="color" data-value="cool"></button>
                </div>
              </div>
            </div>

            <div class="border border-gray-200 rounded-lg p-4 bg-green-50">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">부엌 조명</h4>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" checked data-device="kitchen-light">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div class="space-y-2">
                <label class="text-sm text-gray-600">밝기</label>
                <input type="range" min="0" max="100" value="80" 
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                       data-device="kitchen-light" data-property="brightness">
                <div class="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <div class="mt-3">
                <label class="text-sm text-gray-600">색상</label>
                <div class="flex space-x-2 mt-1">
                  <button class="w-6 h-6 bg-white rounded-full border-2 border-gray-300" 
                          data-device="kitchen-light" data-property="color" data-value="white"></button>
                  <button class="w-6 h-6 bg-yellow-300 rounded-full border-2 border-yellow-500" 
                          data-device="kitchen-light" data-property="color" data-value="warm"></button>
                  <button class="w-6 h-6 bg-blue-300 rounded-full border-2 border-gray-300" 
                          data-device="kitchen-light" data-property="color" data-value="cool"></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 온도 제어 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🌡️ 온도 제어</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-semibold text-gray-900">거실 에어컨</h4>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" data-device="living-room-ac">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div class="text-center">
                <div class="text-4xl font-bold text-blue-600 mb-2">24°C</div>
                <div class="flex justify-center space-x-2">
                  <button class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center" 
                          data-device="living-room-ac" data-action="temp-down">-</button>
                  <button class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center" 
                          data-device="living-room-ac" data-action="temp-up">+</button>
                </div>
              </div>
              <div class="mt-4">
                <label class="text-sm text-gray-600">모드</label>
                <select class="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md" 
                        data-device="living-room-ac" data-property="mode">
                  <option value="cool">냉방</option>
                  <option value="heat">난방</option>
                  <option value="fan">송풍</option>
                  <option value="auto">자동</option>
                </select>
              </div>
            </div>

            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-semibold text-gray-900">침실 에어컨</h4>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" data-device="bedroom-ac">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div class="text-center">
                <div class="text-4xl font-bold text-blue-600 mb-2">24°C</div>
                <div class="flex justify-center space-x-2">
                  <button class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center" 
                          data-device="bedroom-ac" data-action="temp-down">-</button>
                  <button class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center" 
                          data-device="bedroom-ac" data-action="temp-up">+</button>
                </div>
              </div>
              <div class="mt-4">
                <label class="text-sm text-gray-600">모드</label>
                <select class="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md" 
                        data-device="bedroom-ac" data-property="mode">
                  <option value="cool">냉방</option>
                  <option value="heat">난방</option>
                  <option value="fan">송풍</option>
                  <option value="auto">자동</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 보안 상태 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🔒 보안 상태</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span class="text-sm font-medium text-gray-900">현관 카메라</span>
              </div>
              <span class="text-sm text-green-600">녹화 중</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span class="text-sm font-medium text-gray-900">동작 감지기</span>
              </div>
              <span class="text-sm text-green-600">활성</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span class="text-sm font-medium text-gray-900">도어락</span>
              </div>
              <span class="text-sm text-green-600">잠김</span>
            </div>
          </div>
        </div>

        <!-- AI 추천 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 추천</h3>
          <div class="space-y-3">
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">💡 에너지 절약</h4>
              <p class="text-sm text-blue-700">사용하지 않는 방의 조명을 끄면 전기요금을 절약할 수 있습니다.</p>
            </div>
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">🌡️ 온도 최적화</h4>
              <p class="text-sm text-green-700">현재 온도가 적절합니다. 에어컨을 켜지 않아도 됩니다.</p>
            </div>
            <div class="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 class="font-semibold text-purple-900">🔒 보안 강화</h4>
              <p class="text-sm text-purple-700">모든 보안 시스템이 정상 작동 중입니다.</p>
            </div>
          </div>
        </div>

        <!-- 빠른 액션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">⚡ 빠른 액션</h3>
          <div class="space-y-3">
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="all-lights-on">
              💡 모든 조명 켜기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="all-lights-off">
              🔌 모든 조명 끄기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="comfort-mode">
              😌 편안한 모드
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="sleep-mode">
              😴 수면 모드
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: AI 자동화 설정

#### 사용자 액션
사용자가 "편안한 모드" 버튼 클릭

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("편안한 모드로 설정해줘. 집 안을 편안하게 만들어줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- AI 자동화 설정 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 편안한 모드 활성화 -->
    <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-green-900 mb-4">😌 편안한 모드 활성화</h2>
      <p class="text-green-700 mb-4">AI가 최적의 편안한 환경을 조성하고 있습니다.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">조명</h3>
          <p class="text-lg font-bold text-yellow-600">따뜻한 색온도</p>
          <p class="text-sm text-gray-600">눈의 피로 감소</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">온도</h3>
          <p class="text-lg font-bold text-blue-600">22°C</p>
          <p class="text-sm text-gray-600">최적의 실내온도</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">음악</h3>
          <p class="text-lg font-bold text-purple-600">재생 중</p>
          <p class="text-sm text-gray-600">편안한 재즈</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">공기질</h3>
          <p class="text-lg font-bold text-green-600">양호</p>
          <p class="text-sm text-gray-600">공기청정기 작동</p>
        </div>
      </div>
    </div>

    <!-- 자동화 설정 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 자동화 설정</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 class="font-semibold text-gray-900">스마트 조명</h4>
              <p class="text-sm text-gray-600">시간대별 자동 조절</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 class="font-semibold text-gray-900">온도 자동 조절</h4>
              <p class="text-sm text-gray-600">외부 온도에 따른 자동 조절</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 class="font-semibold text-gray-900">음악 자동 재생</h4>
              <p class="text-sm text-gray-600">시간대별 맞춤 음악</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 class="font-semibold text-gray-900">보안 자동 모드</h4>
              <p class="text-sm text-gray-600">외출 시 자동 보안 활성화</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">⏰ 시간대별 설정</h3>
        <div class="space-y-4">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 class="font-semibold text-blue-900">아침 (06:00-09:00)</h4>
            <ul class="text-sm text-blue-700 mt-2 space-y-1">
              <li>• 거실 조명 자동 켜기</li>
              <li>• 부엌 조명 밝기 100%</li>
              <li>• 상쾌한 음악 재생</li>
            </ul>
          </div>
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 class="font-semibold text-green-900">낮 (09:00-18:00)</h4>
            <ul class="text-sm text-green-700 mt-2 space-y-1">
              <li>• 자연광 활용</li>
              <li>• 에너지 절약 모드</li>
              <li>• 업무용 음악</li>
            </ul>
          </div>
          <div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="font-semibold text-purple-900">저녁 (18:00-22:00)</h4>
            <ul class="text-sm text-purple-700 mt-2 space-y-1">
              <li>• 따뜻한 조명</li>
              <li>• 편안한 온도</li>
              <li>• 휴식용 음악</li>
            </ul>
          </div>
          <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 class="font-semibold text-indigo-900">밤 (22:00-06:00)</h4>
            <ul class="text-sm text-indigo-700 mt-2 space-y-1">
              <li>• 어두운 조명</li>
              <li>• 수면 모드</li>
              <li>• 보안 강화</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 현재 상태 -->
    <div class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">📊 현재 상태</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="text-center">
          <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">💡</span>
          </div>
          <h4 class="font-semibold text-gray-900">조명</h4>
          <p class="text-sm text-gray-600">따뜻한 색온도</p>
          <p class="text-xs text-gray-500">편안한 모드</p>
        </div>
        <div class="text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">🌡️</span>
          </div>
          <h4 class="font-semibold text-gray-900">온도</h4>
          <p class="text-sm text-gray-600">22°C</p>
          <p class="text-xs text-gray-500">최적 온도</p>
        </div>
        <div class="text-center">
          <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">🎵</span>
          </div>
          <h4 class="font-semibold text-gray-900">음악</h4>
          <p class="text-sm text-gray-600">편안한 재즈</p>
          <p class="text-xs text-gray-500">볼륨 30%</p>
        </div>
        <div class="text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">🔒</span>
          </div>
          <h4 class="font-semibold text-gray-900">보안</h4>
          <p class="text-sm text-gray-600">활성화</p>
          <p class="text-xs text-gray-500">모든 센서 정상</p>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 통합 기기 제어
- 모든 스마트 홈 기기 통합 관리
- 실시간 상태 모니터링
- 원클릭 제어

### 2. AI 자동화
- 사용자 패턴 학습
- 시간대별 자동 설정
- 상황별 최적화

### 3. 에너지 효율성
- 사용 패턴 분석
- 자동 절약 모드
- 비용 최적화

### 4. 보안 및 안전
- 실시간 보안 모니터링
- 자동 알림 시스템
- 응급상황 대응
