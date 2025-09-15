# 시나리오 5: 개인 비서 시스템

## 개요
사용자의 일상 업무를 도와주고, 스케줄을 관리하며, 업무 효율성을 높이는 AI 개인 비서 시스템입니다.

## 시나리오 플로우

### 1단계: 개인 비서 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("개인 비서 시스템을 만들어줘. 내 일정과 업무를 관리해줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "개인 비서 시스템을 만들어줘. 내 일정과 업무를 관리해줘",
  sceneHistory: [
    // 이전 모든 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    preferences: {
      workHours: "09:00-18:00",
      timezone: "Asia/Seoul",
      language: "ko",
      notificationSettings: {
        email: true,
        push: true,
        sms: false
      }
    },
    currentTasks: [],
    upcomingEvents: [],
    recentActivities: []
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 개인 비서 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">🤖 AI 개인 비서</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">안녕하세요, john@example.com님!</span>
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 오늘의 요약 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-blue-900 mb-4">📅 오늘의 요약</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">오늘의 일정</h3>
          <p class="text-2xl font-bold text-blue-600">3건</p>
          <p class="text-sm text-gray-600">다음: 14:00 회의</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">완료된 업무</h3>
          <p class="text-2xl font-bold text-green-600">5건</p>
          <p class="text-sm text-gray-600">진행률: 83%</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">중요 알림</h3>
          <p class="text-2xl font-bold text-yellow-600">2건</p>
          <p class="text-sm text-gray-600">확인 필요</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 오늘의 일정 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📅 오늘의 일정</h3>
          <div class="space-y-4">
            <div class="flex items-center p-4 border border-gray-200 rounded-lg">
              <div class="w-4 h-4 bg-blue-500 rounded-full mr-4"></div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">팀 미팅</h4>
                <p class="text-sm text-gray-600">프로젝트 진행 상황 논의</p>
                <p class="text-xs text-gray-500">14:00 - 15:00 (1시간)</p>
              </div>
              <button class="text-blue-600 hover:text-blue-800 text-sm" data-action="edit-event" data-event="team-meeting">
                수정
              </button>
            </div>

            <div class="flex items-center p-4 border border-gray-200 rounded-lg">
              <div class="w-4 h-4 bg-green-500 rounded-full mr-4"></div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">고객 상담</h4>
                <p class="text-sm text-gray-600">신규 고객 온보딩</p>
                <p class="text-xs text-gray-500">16:00 - 17:00 (1시간)</p>
              </div>
              <button class="text-blue-600 hover:text-blue-800 text-sm" data-action="edit-event" data-event="customer-consultation">
                수정
              </button>
            </div>

            <div class="flex items-center p-4 border border-gray-200 rounded-lg">
              <div class="w-4 h-4 bg-yellow-500 rounded-full mr-4"></div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">보고서 작성</h4>
                <p class="text-sm text-gray-600">월간 실적 보고서</p>
                <p class="text-xs text-gray-500">18:00 - 19:00 (1시간)</p>
              </div>
              <button class="text-blue-600 hover:text-blue-800 text-sm" data-action="edit-event" data-event="report-writing">
                수정
              </button>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-gray-200">
            <button class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700" 
                    data-action="add-event">
              + 새 일정 추가
            </button>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 빠른 액션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">⚡ 빠른 액션</h3>
          <div class="space-y-3">
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="add-task">
              📝 새 업무 추가
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="schedule-meeting">
              📅 회의 일정 잡기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="send-email">
              📧 이메일 보내기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="check-weather">
              🌤️ 날씨 확인
            </button>
          </div>
        </div>

        <!-- 알림 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🔔 알림</h3>
          <div class="space-y-3">
            <div class="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div class="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <p class="text-sm font-medium text-gray-900">회의 30분 전</p>
                <p class="text-xs text-gray-600">팀 미팅 준비하세요</p>
              </div>
            </div>
            <div class="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div class="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
              <div>
                <p class="text-sm font-medium text-gray-900">중요</p>
                <p class="text-xs text-gray-600">보고서 마감일 임박</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 오늘의 할 일 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">✅ 오늘의 할 일</h3>
          <div class="space-y-3">
            <div class="flex items-center space-x-3">
              <input type="checkbox" checked class="rounded border-gray-300 text-blue-600">
              <span class="text-sm text-gray-600 line-through">이메일 확인</span>
            </div>
            <div class="flex items-center space-x-3">
              <input type="checkbox" checked class="rounded border-gray-300 text-blue-600">
              <span class="text-sm text-gray-600 line-through">프로젝트 계획 수립</span>
            </div>
            <div class="flex items-center space-x-3">
              <input type="checkbox" class="rounded border-gray-300 text-blue-600">
              <span class="text-sm text-gray-900">보고서 작성</span>
            </div>
            <div class="flex items-center space-x-3">
              <input type="checkbox" class="rounded border-gray-300 text-blue-600">
              <span class="text-sm text-gray-900">고객 피드백 검토</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 새 업무 추가

#### 사용자 액션
사용자가 "새 업무 추가" 버튼 클릭

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("새 업무를 추가할 수 있는 폼을 만들어줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 새 업무 추가 폼 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="bg-white shadow rounded-lg p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">📝 새 업무 추가</h2>
        <p class="text-gray-600">새로운 업무를 추가하고 일정을 관리하세요</p>
      </div>

      <form data-action="add-task-submit" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">업무 제목</label>
          <input type="text" name="title" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                 placeholder="업무 제목을 입력하세요">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">업무 설명</label>
          <textarea name="description" rows="4" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="업무에 대한 자세한 설명을 입력하세요"></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
            <select name="priority" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="low">낮음</option>
              <option value="medium" selected>보통</option>
              <option value="high">높음</option>
              <option value="urgent">긴급</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <select name="category" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="work">업무</option>
              <option value="personal">개인</option>
              <option value="meeting">회의</option>
              <option value="project">프로젝트</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">시작 날짜</label>
            <input type="date" name="start-date" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">마감 날짜</label>
            <input type="date" name="due-date" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">시작 시간</label>
            <input type="time" name="start-time" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">예상 소요 시간</label>
            <select name="duration" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="15">15분</option>
              <option value="30">30분</option>
              <option value="60" selected>1시간</option>
              <option value="120">2시간</option>
              <option value="240">4시간</option>
              <option value="480">8시간</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">알림 설정</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input type="checkbox" name="reminder-15min" class="rounded border-gray-300 text-blue-600">
              <span class="ml-2 text-sm text-gray-700">15분 전 알림</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="reminder-1hour" checked class="rounded border-gray-300 text-blue-600">
              <span class="ml-2 text-sm text-gray-700">1시간 전 알림</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="reminder-1day" class="rounded border-gray-300 text-blue-600">
              <span class="ml-2 text-sm text-gray-700">1일 전 알림</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end space-x-4">
          <button type="button" 
                  class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  data-action="cancel-add-task">
            취소
          </button>
          <button type="submit" 
                  class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            업무 추가
          </button>
        </div>
      </form>
    </div>
  </main>
</div>
```

### 3단계: 스마트 일정 제안

#### 사용자 액션
사용자가 업무를 추가한 후

#### AI 요청
```typescript
const scene3 = await aiAgentOS.request("내 일정을 분석해서 최적의 시간을 제안해줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 스마트 일정 제안 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- AI 일정 제안 -->
    <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-green-900 mb-4">🤖 AI 일정 제안</h2>
      <p class="text-green-700 mb-4">당신의 업무 패턴을 분석한 결과, 다음과 같은 시간대를 추천합니다.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm border-2 border-green-200">
          <h3 class="font-semibold text-gray-900 mb-2">🥇 최적 시간</h3>
          <p class="text-lg font-bold text-green-600">내일 오전 9:00-10:00</p>
          <p class="text-sm text-gray-600">집중도: 95%</p>
          <p class="text-xs text-gray-500">다른 업무와 충돌 없음</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900 mb-2">🥈 대안 1</h3>
          <p class="text-lg font-bold text-blue-600">내일 오후 2:00-3:00</p>
          <p class="text-sm text-gray-600">집중도: 85%</p>
          <p class="text-xs text-gray-500">점심 후 집중 시간</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900 mb-2">🥉 대안 2</h3>
          <p class="text-lg font-bold text-yellow-600">오늘 저녁 7:00-8:00</p>
          <p class="text-sm text-gray-600">집중도: 75%</p>
          <p class="text-xs text-gray-500">퇴근 후 집중 시간</p>
        </div>
      </div>
    </div>

    <!-- 일정 분석 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📊 집중도 분석</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">오전 9-10시</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-green-600 h-2 rounded-full" style="width: 95%"></div>
              </div>
              <span class="text-sm text-gray-600">95%</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">오후 2-3시</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 85%"></div>
              </div>
              <span class="text-sm text-gray-600">85%</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">저녁 7-8시</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-yellow-600 h-2 rounded-full" style="width: 75%"></div>
              </div>
              <span class="text-sm text-gray-600">75%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">⏰ 시간대별 패턴</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <span class="text-sm font-medium text-gray-900">오전 9-12시</span>
            <span class="text-sm text-green-600">고집중 시간</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <span class="text-sm font-medium text-gray-900">오후 1-3시</span>
            <span class="text-sm text-yellow-600">중간 집중</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <span class="text-sm font-medium text-gray-900">오후 3-6시</span>
            <span class="text-sm text-red-600">낮은 집중</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 일정 확정 버튼 -->
    <div class="mt-8 text-center">
      <button class="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-semibold" 
              data-action="confirm-schedule" data-time="09:00-10:00">
        ✅ 내일 오전 9:00-10:00로 일정 확정
      </button>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 지능형 일정 관리
- AI가 최적의 시간대 제안
- 집중도 기반 일정 배치
- 충돌 방지 자동 체크

### 2. 개인화된 업무 관리
- 사용자 패턴 학습
- 맞춤형 알림 설정
- 우선순위 자동 분류

### 3. 실시간 업데이트
- 일정 변경 즉시 반영
- 알림 자동 조정
- 상태 동기화

### 4. 생산성 최적화
- 집중도 분석
- 시간대별 패턴 파악
- 효율적인 업무 배치
