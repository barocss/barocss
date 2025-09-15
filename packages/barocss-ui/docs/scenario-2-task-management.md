# 시나리오 2: 작업 관리 시스템

## 개요
사용자가 개인 및 팀 작업을 체계적으로 관리하고, 우선순위를 설정하며, 진행 상황을 추적할 수 있는 스마트 작업 관리 시스템입니다.

## 시나리오 플로우

### 1단계: 작업 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await director.request("작업 관리 시스템을 만들어줘. 내 할 일을 체계적으로 관리하고 싶어");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "작업 관리 시스템을 만들어줘. 내 할 일을 체계적으로 관리하고 싶어",
  sceneHistory: [
    // 이전 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    currentTasks: [
      {
        id: "task1",
        title: "프로젝트 기획서 작성",
        description: "Q1 프로젝트 기획서 초안 작성",
        priority: "high",
        status: "in_progress",
        dueDate: "2024-01-25",
        assignee: "john@example.com",
        tags: ["work", "planning"],
        estimatedTime: 4,
        actualTime: 2
      },
      {
        id: "task2",
        title: "팀 미팅 준비",
        description: "주간 팀 미팅 자료 준비",
        priority: "medium",
        status: "pending",
        dueDate: "2024-01-24",
        assignee: "john@example.com",
        tags: ["work", "meeting"],
        estimatedTime: 2,
        actualTime: 0
      }
    ],
    preferences: {
      defaultView: "kanban",
      showCompleted: false,
      sortBy: "dueDate"
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 작업 관리 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">📋 작업 관리</h1>
        <div class="flex items-center space-x-4">
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                  data-action="add-task">
            + 새 작업
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 작업 통계 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-blue-900 mb-4">📊 작업 현황</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">전체 작업</h3>
          <p class="text-2xl font-bold text-blue-600">2</p>
          <p class="text-sm text-gray-600">진행 중 1개</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">완료</h3>
          <p class="text-2xl font-bold text-green-600">0</p>
          <p class="text-sm text-gray-600">이번 주</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">지연</h3>
          <p class="text-2xl font-bold text-red-600">0</p>
          <p class="text-sm text-gray-600">마감일 지남</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">우선순위</h3>
          <p class="text-2xl font-bold text-orange-600">1</p>
          <p class="text-sm text-gray-600">높음</p>
        </div>
      </div>
    </div>

    <!-- 칸반 보드 -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- 대기 중 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📝 대기 중</h3>
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-lg p-4 bg-yellow-50">
            <h4 class="font-semibold text-gray-900">팀 미팅 준비</h4>
            <p class="text-sm text-gray-600 mt-1">주간 팀 미팅 자료 준비</p>
            <div class="flex items-center justify-between mt-3">
              <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">보통</span>
              <span class="text-xs text-gray-500">2024-01-24</span>
            </div>
            <div class="mt-3 flex space-x-2">
              <button class="text-blue-600 hover:text-blue-800 text-sm" 
                      data-action="start-task" data-task="task2">
                시작
              </button>
              <button class="text-gray-600 hover:text-gray-800 text-sm" 
                      data-action="edit-task" data-task="task2">
                편집
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 진행 중 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🔄 진행 중</h3>
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-lg p-4 bg-blue-50">
            <h4 class="font-semibold text-gray-900">프로젝트 기획서 작성</h4>
            <p class="text-sm text-gray-600 mt-1">Q1 프로젝트 기획서 초안 작성</p>
            <div class="flex items-center justify-between mt-3">
              <span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">높음</span>
              <span class="text-xs text-gray-500">2024-01-25</span>
            </div>
            <div class="mt-3">
              <div class="flex justify-between text-xs text-gray-600 mb-1">
                <span>진행률</span>
                <span>50%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 50%"></div>
              </div>
            </div>
            <div class="mt-3 flex space-x-2">
              <button class="text-green-600 hover:text-green-800 text-sm" 
                      data-action="complete-task" data-task="task1">
                완료
              </button>
              <button class="text-gray-600 hover:text-gray-800 text-sm" 
                      data-action="edit-task" data-task="task1">
                편집
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 검토 중 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">👀 검토 중</h3>
        <div class="space-y-4">
          <div class="text-center py-8 text-gray-500">
            <div class="text-4xl mb-2">📋</div>
            <p class="text-sm">검토 중인 작업이 없습니다</p>
          </div>
        </div>
      </div>

      <!-- 완료 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">✅ 완료</h3>
        <div class="space-y-4">
          <div class="text-center py-8 text-gray-500">
            <div class="text-4xl mb-2">🎉</div>
            <p class="text-sm">완료된 작업이 없습니다</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 새 작업 추가

#### 사용자 액션
사용자가 "새 작업" 버튼 클릭

#### AI 요청
```typescript
const scene2 = await director.request("새 작업을 추가할 수 있는 폼을 만들어줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 새 작업 추가 폼 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="bg-white shadow rounded-lg p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">새 작업 추가</h2>
        <p class="text-gray-600">새로운 작업을 생성하고 관리하세요</p>
      </div>

      <form data-action="create-task" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">작업 제목</label>
          <input type="text" name="title" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                 placeholder="작업 제목을 입력하세요">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">작업 설명</label>
          <textarea name="description" rows="4" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="작업에 대한 자세한 설명을 입력하세요"></textarea>
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
            <label class="block text-sm font-medium text-gray-700 mb-2">마감일</label>
            <input type="date" name="dueDate" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">예상 소요 시간</label>
            <select name="estimatedTime" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="0.5">30분</option>
              <option value="1">1시간</option>
              <option value="2" selected>2시간</option>
              <option value="4">4시간</option>
              <option value="8">8시간</option>
              <option value="16">1일</option>
              <option value="40">1주일</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">태그</label>
            <input type="text" name="tags" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                   placeholder="work, planning, urgent">
            <p class="text-xs text-gray-500 mt-1">쉼표로 구분하여 입력하세요</p>
          </div>
        </div>

        <div class="flex justify-end space-x-4">
          <button type="button" 
                  class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  data-action="cancel-create-task">
            취소
          </button>
          <button type="submit" 
                  class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            작업 생성
          </button>
        </div>
      </form>
    </div>
  </main>
</div>
```

### 3단계: 작업 진행 상황 업데이트

#### 사용자 액션
사용자가 "프로젝트 기획서 작성" 작업의 "완료" 버튼 클릭

#### AI 요청
```typescript
const scene3 = await director.request("프로젝트 기획서 작성 작업을 완료했어. 작업 상태를 업데이트해줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 작업 완료 확인 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 작업 완료 확인 -->
    <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-green-900 mb-4">🎉 작업 완료!</h2>
      <p class="text-green-700 mb-4">프로젝트 기획서 작성 작업이 완료되었습니다.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">작업 시간</h3>
          <p class="text-2xl font-bold text-green-600">4시간</p>
          <p class="text-sm text-gray-600">예상 4시간</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">완료율</h3>
          <p class="text-2xl font-bold text-blue-600">100%</p>
          <p class="text-sm text-gray-600">목표 달성</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">다음 작업</h3>
          <p class="text-2xl font-bold text-purple-600">1개</p>
          <p class="text-sm text-gray-600">대기 중</p>
        </div>
      </div>
    </div>

    <!-- 업데이트된 칸반 보드 -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- 대기 중 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📝 대기 중</h3>
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-lg p-4 bg-yellow-50">
            <h4 class="font-semibold text-gray-900">팀 미팅 준비</h4>
            <p class="text-sm text-gray-600 mt-1">주간 팀 미팅 자료 준비</p>
            <div class="flex items-center justify-between mt-3">
              <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">보통</span>
              <span class="text-xs text-gray-500">2024-01-24</span>
            </div>
            <div class="mt-3 flex space-x-2">
              <button class="text-blue-600 hover:text-blue-800 text-sm" 
                      data-action="start-task" data-task="task2">
                시작
              </button>
              <button class="text-gray-600 hover:text-gray-800 text-sm" 
                      data-action="edit-task" data-task="task2">
                편집
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 진행 중 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🔄 진행 중</h3>
        <div class="space-y-4">
          <div class="text-center py-8 text-gray-500">
            <div class="text-4xl mb-2">📋</div>
            <p class="text-sm">진행 중인 작업이 없습니다</p>
          </div>
        </div>
      </div>

      <!-- 검토 중 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">👀 검토 중</h3>
        <div class="space-y-4">
          <div class="text-center py-8 text-gray-500">
            <div class="text-4xl mb-2">📋</div>
            <p class="text-sm">검토 중인 작업이 없습니다</p>
          </div>
        </div>
      </div>

      <!-- 완료 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">✅ 완료</h3>
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-lg p-4 bg-green-50">
            <h4 class="font-semibold text-gray-900">프로젝트 기획서 작성</h4>
            <p class="text-sm text-gray-600 mt-1">Q1 프로젝트 기획서 초안 작성</p>
            <div class="flex items-center justify-between mt-3">
              <span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">높음</span>
              <span class="text-xs text-gray-500">2024-01-25</span>
            </div>
            <div class="mt-3 text-xs text-green-600">
              ✅ 2024-01-23 완료
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 직관적인 칸반 보드
- 작업 상태별 시각적 분류
- 드래그 앤 드롭으로 상태 변경
- 실시간 진행 상황 추적

### 2. 스마트 작업 관리
- 우선순위 자동 정렬
- 마감일 기반 알림
- 작업 시간 추적

### 3. 팀 협업 기능
- 작업 할당 및 위임
- 댓글 및 피드백
- 진행 상황 공유

### 4. 생산성 분석
- 작업 완료율 통계
- 시간 사용 패턴 분석
- 개선 제안 제공
