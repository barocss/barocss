# 시나리오 13: SubScene 모달 오버레이

## 개요
메인 Scene 위에 모달이나 오버레이 형태로 SubScene을 표시하고, 사용자가 모달 내에서 복잡한 작업을 수행할 수 있는 시스템입니다. 모달은 독립적인 SubScene으로 관리되며 메인 Scene과 상호작용합니다.

## 시나리오 플로우

### 1단계: 메인 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await director.request("프로젝트 관리 대시보드를 만들어줘. 프로젝트를 클릭하면 상세 정보를 모달로 보여줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "프로젝트 관리 대시보드를 만들어줘. 프로젝트를 클릭하면 상세 정보를 모달로 보여줘",
  sceneHistory: [],
  userSession: {
    userId: "john@example.com",
    role: "project_manager",
    projects: [
      {
        id: "proj1",
        name: "AI 쇼핑몰 개발",
        status: "in_progress",
        progress: 65,
        team: ["john@example.com", "jane@example.com"],
        budget: 50000000,
        spent: 32500000
      },
      {
        id: "proj2", 
        name: "모바일 앱 리뉴얼",
        status: "planning",
        progress: 20,
        team: ["john@example.com", "alice@example.com"],
        budget: 30000000,
        spent: 6000000
      }
    ]
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 프로젝트 관리 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">📋 프로젝트 관리</h1>
        <div class="flex items-center space-x-4">
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                  data-action="open-modal" data-modal="create-project">
            + 새 프로젝트
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 프로젝트 카드 목록 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- AI 쇼핑몰 개발 프로젝트 -->
      <div class="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow" 
           data-action="open-project-modal" data-project="proj1">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-gray-900">AI 쇼핑몰 개발</h3>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            진행 중
          </span>
        </div>
        
        <div class="mb-4">
          <div class="flex justify-between text-sm text-gray-600 mb-2">
            <span>진행률</span>
            <span>65%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width: 65%"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600">예산:</span>
            <span class="font-medium">₩50M</span>
          </div>
          <div>
            <span class="text-gray-600">사용:</span>
            <span class="font-medium">₩32.5M</span>
          </div>
        </div>

        <div class="mt-4 flex items-center space-x-2">
          <div class="flex -space-x-2">
            <img class="w-6 h-6 rounded-full border-2 border-white" src="/api/placeholder/24/24" alt="John">
            <img class="w-6 h-6 rounded-full border-2 border-white" src="/api/placeholder/24/24" alt="Jane">
          </div>
          <span class="text-xs text-gray-500">2명</span>
        </div>
      </div>

      <!-- 모바일 앱 리뉴얼 프로젝트 -->
      <div class="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow" 
           data-action="open-project-modal" data-project="proj2">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-gray-900">모바일 앱 리뉴얼</h3>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            계획 중
          </span>
        </div>
        
        <div class="mb-4">
          <div class="flex justify-between text-sm text-gray-600 mb-2">
            <span>진행률</span>
            <span>20%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-yellow-600 h-2 rounded-full" style="width: 20%"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600">예산:</span>
            <span class="font-medium">₩30M</span>
          </div>
          <div>
            <span class="text-gray-600">사용:</span>
            <span class="font-medium">₩6M</span>
          </div>
        </div>

        <div class="mt-4 flex items-center space-x-2">
          <div class="flex -space-x-2">
            <img class="w-6 h-6 rounded-full border-2 border-white" src="/api/placeholder/24/24" alt="John">
            <img class="w-6 h-6 rounded-full border-2 border-white" src="/api/placeholder/24/24" alt="Alice">
          </div>
          <span class="text-xs text-gray-500">2명</span>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: SubScene 모달 열기

#### 사용자 액션
사용자가 "AI 쇼핑몰 개발" 프로젝트 카드 클릭

#### AI 요청
```typescript
const scene2 = await director.request("AI 쇼핑몰 개발 프로젝트의 상세 정보를 모달로 보여줘");
```

#### AI 응답 및 SubScene 모달 생성
```html
<!-- SubScene 모달 오버레이 -->
<div class="fixed inset-0 z-50 overflow-y-auto" data-subscene="project-modal" data-modal="project-detail">
  <!-- 배경 오버레이 -->
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
       data-action="close-modal" data-modal="project-detail"></div>
  
  <!-- 모달 컨테이너 -->
  <div class="flex min-h-full items-center justify-center p-4">
    <div class="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
      <!-- 모달 헤더 -->
      <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900">AI 쇼핑몰 개발</h3>
          <button class="text-gray-400 hover:text-gray-600" 
                  data-action="close-modal" data-modal="project-detail">
            <span class="sr-only">닫기</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 모달 콘텐츠 -->
      <div class="bg-white px-4 pb-4 sm:p-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- 프로젝트 정보 -->
          <div>
            <h4 class="text-lg font-semibold text-gray-900 mb-4">프로젝트 정보</h4>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">상태:</span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  진행 중
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">진행률:</span>
                <span class="font-medium">65%</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">시작일:</span>
                <span class="font-medium">2024-01-01</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">마감일:</span>
                <span class="font-medium">2024-03-31</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">예산:</span>
                <span class="font-medium">₩50,000,000</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600">사용:</span>
                <span class="font-medium">₩32,500,000</span>
              </div>
            </div>
          </div>

          <!-- 팀원 정보 -->
          <div>
            <h4 class="text-lg font-semibold text-gray-900 mb-4">팀원</h4>
            <div class="space-y-3">
              <div class="flex items-center space-x-3">
                <img class="w-8 h-8 rounded-full" src="/api/placeholder/32/32" alt="John">
                <div>
                  <p class="text-sm font-medium text-gray-900">John Kim</p>
                  <p class="text-xs text-gray-500">Project Manager</p>
                </div>
              </div>
              <div class="flex items-center space-x-3">
                <img class="w-8 h-8 rounded-full" src="/api/placeholder/32/32" alt="Jane">
                <div>
                  <p class="text-sm font-medium text-gray-900">Jane Lee</p>
                  <p class="text-xs text-gray-500">Frontend Developer</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 작업 목록 -->
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">작업 목록</h4>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span class="text-sm font-medium text-gray-900">사용자 인증 시스템 구현</span>
              </div>
              <span class="text-xs text-gray-500">진행 중</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span class="text-sm font-medium text-gray-900">결제 시스템 통합</span>
              </div>
              <span class="text-xs text-gray-500">대기 중</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                <span class="text-sm font-medium text-gray-900">프로젝트 기획서 작성</span>
              </div>
              <span class="text-xs text-gray-500">완료</span>
            </div>
          </div>
        </div>

        <!-- 액션 버튼들 -->
        <div class="mt-6 flex justify-end space-x-3">
          <button class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700" 
                  data-action="edit-project" data-project="proj1">
            편집
          </button>
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                  data-action="view-timeline" data-project="proj1">
            타임라인
          </button>
          <button class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700" 
                  data-action="add-task" data-project="proj1">
            작업 추가
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 3단계: SubScene 모달 내 상호작용

#### 사용자 액션
사용자가 "작업 추가" 버튼 클릭

#### AI 요청
```typescript
const scene3 = await director.request("프로젝트에 새 작업을 추가할 수 있는 폼을 모달 안에 보여줘");
```

#### AI 응답 및 SubScene 업데이트
```html
<!-- SubScene 업데이트: 작업 추가 폼 -->
<div class="fixed inset-0 z-50 overflow-y-auto" data-subscene="project-modal" data-modal="add-task">
  <!-- 배경 오버레이 -->
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
       data-action="close-modal" data-modal="add-task"></div>
  
  <!-- 모달 컨테이너 -->
  <div class="flex min-h-full items-center justify-center p-4">
    <div class="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
      <!-- 모달 헤더 -->
      <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900">새 작업 추가</h3>
          <button class="text-gray-400 hover:text-gray-600" 
                  data-action="close-modal" data-modal="add-task">
            <span class="sr-only">닫기</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 모달 콘텐츠 -->
      <div class="bg-white px-4 pb-4 sm:p-6">
        <form data-action="add-task-submit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">작업 제목</label>
            <input type="text" name="title" required 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                   placeholder="작업 제목을 입력하세요">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">작업 설명</label>
            <textarea name="description" rows="3" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="작업에 대한 자세한 설명을 입력하세요"></textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">담당자</label>
              <select name="assignee" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="john@example.com">John Kim</option>
                <option value="jane@example.com">Jane Lee</option>
              </select>
            </div>
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
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">시작일</label>
              <input type="date" name="startDate" 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">마감일</label>
              <input type="date" name="dueDate" 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">예상 소요 시간</label>
            <select name="estimatedHours" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="1">1시간</option>
              <option value="2">2시간</option>
              <option value="4" selected>4시간</option>
              <option value="8">8시간</option>
              <option value="16">1일</option>
              <option value="40">1주일</option>
            </select>
          </div>

          <!-- 액션 버튼들 -->
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" 
                    class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                    data-action="close-modal" data-modal="add-task">
              취소
            </button>
            <button type="submit" 
                    class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              작업 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
```

### 4단계: SubScene 모달 닫기 및 메인 Scene 업데이트

#### 사용자 액션
사용자가 작업 추가 폼을 제출

#### AI 요청
```typescript
const scene4 = await director.request("작업이 추가되었어. 모달을 닫고 메인 화면을 업데이트해줘");
```

#### AI 응답 및 SubScene 업데이트
```html
<!-- SubScene 모달 닫기 및 메인 Scene 업데이트 -->
<!-- 모달은 닫히고 메인 Scene의 프로젝트 카드가 업데이트됨 -->

<!-- 메인 Scene 업데이트: 프로젝트 카드 -->
<div class="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow" 
     data-action="open-project-modal" data-project="proj1">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-xl font-semibold text-gray-900">AI 쇼핑몰 개발</h3>
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      진행 중
    </span>
  </div>
  
  <div class="mb-4">
    <div class="flex justify-between text-sm text-gray-600 mb-2">
      <span>진행률</span>
      <span>65%</span>
    </div>
    <div class="w-full bg-gray-200 rounded-full h-2">
      <div class="bg-blue-600 h-2 rounded-full" style="width: 65%"></div>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4 text-sm">
    <div>
      <span class="text-gray-600">예산:</span>
      <span class="font-medium">₩50M</span>
    </div>
    <div>
      <span class="text-gray-600">사용:</span>
      <span class="font-medium">₩32.5M</span>
    </div>
  </div>

  <!-- 새로 추가된 작업 표시 -->
  <div class="mt-4 p-2 bg-green-50 border border-green-200 rounded-lg">
    <div class="flex items-center space-x-2">
      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      <span class="text-xs text-green-700">새 작업 추가됨</span>
    </div>
  </div>

  <div class="mt-4 flex items-center space-x-2">
    <div class="flex -space-x-2">
      <img class="w-6 h-6 rounded-full border-2 border-white" src="/api/placeholder/24/24" alt="John">
      <img class="w-6 h-6 rounded-full border-2 border-white" src="/api/placeholder/24/24" alt="Jane">
    </div>
    <span class="text-xs text-gray-500">2명</span>
  </div>
</div>
```

## 핵심 특징

### 1. 모달 SubScene 관리
- **독립적 렌더링**: 모달이 별도의 SubScene으로 관리
- **오버레이 처리**: 배경 클릭이나 ESC 키로 모달 닫기
- **중첩 모달**: 모달 안에서 다른 모달 열기 가능

### 2. 메인 Scene과의 상호작용
- **상태 동기화**: 모달에서의 변경사항이 메인 Scene에 반영
- **데이터 전달**: 모달 열 때 프로젝트 데이터 전달
- **실시간 업데이트**: 모달 닫을 때 메인 Scene 자동 갱신

### 3. 사용자 경험 최적화
- **부드러운 애니메이션**: 모달 열기/닫기 애니메이션
- **키보드 네비게이션**: Tab, Enter, Escape 키 지원
- **포커스 관리**: 모달 열 때 포커스 자동 이동

### 4. SubScene 모달 패턴
```typescript
// 모달 SubScene 열기
director.openModalSubScene('project-detail', {
  projectId: 'proj1',
  data: projectData,
  onClose: () => updateMainScene()
});

// 모달 SubScene 닫기
director.closeModalSubScene('project-detail', {
  updateMainScene: true
});

// 중첩 모달 처리
director.openModalSubScene('add-task', {
  parentModal: 'project-detail',
  projectId: 'proj1'
});
```

이러한 모달 SubScene 패턴은 복잡한 상세 정보 표시나 폼 입력에서 매우 유용하며, 사용자 경험을 크게 향상시킬 수 있습니다.
