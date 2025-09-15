# 시나리오 10: 프로젝트 관리 시스템

## 개요
사용자의 프로젝트를 체계적으로 관리하고, 팀원과 협업하며, AI가 프로젝트 진행 상황을 분석하여 최적화 방안을 제안하는 스마트 프로젝트 관리 시스템입니다.

## 시나리오 플로우

### 1단계: 프로젝트 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("프로젝트 관리 시스템을 만들어줘. 팀 프로젝트를 체계적으로 관리하고 싶어");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "프로젝트 관리 시스템을 만들어줘. 팀 프로젝트를 체계적으로 관리하고 싶어",
  sceneHistory: [
    // 이전 모든 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    role: "project_manager",
    currentProjects: [
      {
        id: "proj1",
        name: "AI 쇼핑몰 개발",
        status: "in_progress",
        progress: 65,
        startDate: "2024-01-01",
        endDate: "2024-03-31",
        priority: "high",
        team: ["john@example.com", "jane@example.com", "bob@example.com"],
        budget: 50000000,
        spent: 32500000
      },
      {
        id: "proj2",
        name: "모바일 앱 리뉴얼",
        status: "planning",
        progress: 20,
        startDate: "2024-02-01",
        endDate: "2024-05-31",
        priority: "medium",
        team: ["john@example.com", "alice@example.com"],
        budget: 30000000,
        spent: 6000000
      }
    ],
    tasks: [
      {
        id: "task1",
        projectId: "proj1",
        title: "사용자 인증 시스템 구현",
        assignee: "jane@example.com",
        status: "in_progress",
        priority: "high",
        dueDate: "2024-01-25",
        estimatedHours: 40,
        actualHours: 25
      },
      {
        id: "task2",
        projectId: "proj1",
        title: "결제 시스템 통합",
        assignee: "bob@example.com",
        status: "pending",
        priority: "high",
        dueDate: "2024-01-30",
        estimatedHours: 60,
        actualHours: 0
      }
    ],
    teamMembers: [
      { id: "john@example.com", name: "John Kim", role: "Project Manager", avatar: "/api/placeholder/40/40" },
      { id: "jane@example.com", name: "Jane Lee", role: "Frontend Developer", avatar: "/api/placeholder/40/40" },
      { id: "bob@example.com", name: "Bob Park", role: "Backend Developer", avatar: "/api/placeholder/40/40" },
      { id: "alice@example.com", name: "Alice Choi", role: "UI/UX Designer", avatar: "/api/placeholder/40/40" }
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
        <h1 class="text-3xl font-bold text-gray-900">📋 AI 프로젝트 관리</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">john@example.com님의 프로젝트</span>
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 프로젝트 현황 요약 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-blue-900 mb-4">📊 프로젝트 현황</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">진행 중</h3>
          <p class="text-2xl font-bold text-blue-600">1</p>
          <p class="text-sm text-gray-600">AI 쇼핑몰 개발</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">계획 중</h3>
          <p class="text-2xl font-bold text-yellow-600">1</p>
          <p class="text-sm text-gray-600">모바일 앱 리뉴얼</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">완료</h3>
          <p class="text-2xl font-bold text-green-600">0</p>
          <p class="text-sm text-gray-600">이번 달</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">팀원</h3>
          <p class="text-2xl font-bold text-purple-600">4</p>
          <p class="text-sm text-gray-600">활성 팀원</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 프로젝트 목록 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6 mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🚀 진행 중인 프로젝트</h3>
          <div class="space-y-6">
            <!-- AI 쇼핑몰 개발 프로젝트 -->
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-xl font-semibold text-gray-900">AI 쇼핑몰 개발</h4>
                  <p class="text-sm text-gray-600">2024.01.01 - 2024.03.31</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    진행 중
                  </span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    높음
                  </span>
                </div>
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

              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p class="text-sm text-gray-600">예산</p>
                  <p class="text-lg font-semibold text-gray-900">₩50,000,000</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">사용</p>
                  <p class="text-lg font-semibold text-gray-900">₩32,500,000</p>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex -space-x-2">
                  <img class="w-8 h-8 rounded-full border-2 border-white" src="/api/placeholder/32/32" alt="John">
                  <img class="w-8 h-8 rounded-full border-2 border-white" src="/api/placeholder/32/32" alt="Jane">
                  <img class="w-8 h-8 rounded-full border-2 border-white" src="/api/placeholder/32/32" alt="Bob">
                </div>
                <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                        data-action="view-project" data-project="proj1">
                  상세 보기
                </button>
              </div>
            </div>

            <!-- 모바일 앱 리뉴얼 프로젝트 -->
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-xl font-semibold text-gray-900">모바일 앱 리뉴얼</h4>
                  <p class="text-sm text-gray-600">2024.02.01 - 2024.05.31</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    계획 중
                  </span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    보통
                  </span>
                </div>
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

              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p class="text-sm text-gray-600">예산</p>
                  <p class="text-lg font-semibold text-gray-900">₩30,000,000</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">사용</p>
                  <p class="text-lg font-semibold text-gray-900">₩6,000,000</p>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex -space-x-2">
                  <img class="w-8 h-8 rounded-full border-2 border-white" src="/api/placeholder/32/32" alt="John">
                  <img class="w-8 h-8 rounded-full border-2 border-white" src="/api/placeholder/32/32" alt="Alice">
                </div>
                <button class="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm" 
                        data-action="view-project" data-project="proj2">
                  상세 보기
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 최근 작업 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📝 최근 작업</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <h4 class="font-semibold text-gray-900">사용자 인증 시스템 구현</h4>
                  <p class="text-sm text-gray-600">AI 쇼핑몰 개발 • Jane Lee</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">2024-01-25</p>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  진행 중
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <div>
                  <h4 class="font-semibold text-gray-900">결제 시스템 통합</h4>
                  <p class="text-sm text-gray-600">AI 쇼핑몰 개발 • Bob Park</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">2024-01-30</p>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  대기 중
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 팀 현황 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">👥 팀 현황</h3>
          <div class="space-y-4">
            <div class="flex items-center space-x-3">
              <img class="w-10 h-10 rounded-full" src="/api/placeholder/40/40" alt="John">
              <div>
                <h4 class="font-semibold text-gray-900">John Kim</h4>
                <p class="text-sm text-gray-600">Project Manager</p>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <img class="w-10 h-10 rounded-full" src="/api/placeholder/40/40" alt="Jane">
              <div>
                <h4 class="font-semibold text-gray-900">Jane Lee</h4>
                <p class="text-sm text-gray-600">Frontend Developer</p>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <img class="w-10 h-10 rounded-full" src="/api/placeholder/40/40" alt="Bob">
              <div>
                <h4 class="font-semibold text-gray-900">Bob Park</h4>
                <p class="text-sm text-gray-600">Backend Developer</p>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <img class="w-10 h-10 rounded-full" src="/api/placeholder/40/40" alt="Alice">
              <div>
                <h4 class="font-semibold text-gray-900">Alice Choi</h4>
                <p class="text-sm text-gray-600">UI/UX Designer</p>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 추천 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 추천</h3>
          <div class="space-y-3">
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">📈 진행률 최적화</h4>
              <p class="text-sm text-blue-700">AI 쇼핑몰 프로젝트의 진행률이 예상보다 빠릅니다. 일정을 앞당길 수 있습니다.</p>
            </div>
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">👥 팀 리소스</h4>
              <p class="text-sm text-green-700">Jane이 현재 작업을 완료하면 Bob의 작업을 시작할 수 있습니다.</p>
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 class="font-semibold text-yellow-900">⚠️ 주의사항</h4>
              <p class="text-sm text-yellow-700">모바일 앱 프로젝트의 계획 단계가 지연되고 있습니다.</p>
            </div>
          </div>
        </div>

        <!-- 빠른 액션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">⚡ 빠른 액션</h3>
          <div class="space-y-3">
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="create-project">
              ➕ 새 프로젝트
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="add-task">
              📝 작업 추가
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="team-meeting">
              👥 팀 미팅
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="project-report">
              📊 프로젝트 리포트
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 프로젝트 상세 관리

#### 사용자 액션
사용자가 "AI 쇼핑몰 개발" 프로젝트 상세 보기 클릭

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("AI 쇼핑몰 개발 프로젝트의 상세 정보를 보여주고 작업을 관리할 수 있게 해줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 프로젝트 상세 관리 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 프로젝트 헤더 -->
    <div class="mb-8 bg-white shadow rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">AI 쇼핑몰 개발</h1>
          <p class="text-gray-600">2024.01.01 - 2024.03.31 • 예산: ₩50,000,000</p>
        </div>
        <div class="flex items-center space-x-4">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            진행 중
          </span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            높음
          </span>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="text-center">
          <p class="text-2xl font-bold text-blue-600">65%</p>
          <p class="text-sm text-gray-600">진행률</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-green-600">₩32.5M</p>
          <p class="text-sm text-gray-600">사용 예산</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-purple-600">3</p>
          <p class="text-sm text-gray-600">팀원</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-orange-600">45일</p>
          <p class="text-sm text-gray-600">남은 기간</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 작업 목록 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6 mb-8">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">📋 작업 목록</h3>
            <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                    data-action="add-task">
              + 작업 추가
            </button>
          </div>
          
          <div class="space-y-4">
            <!-- 진행 중인 작업 -->
            <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">사용자 인증 시스템 구현</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  진행 중
                </span>
              </div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-4">
                  <div class="flex items-center">
                    <img class="w-6 h-6 rounded-full mr-2" src="/api/placeholder/24/24" alt="Jane">
                    <span class="text-sm text-gray-600">Jane Lee</span>
                  </div>
                  <div class="text-sm text-gray-600">
                    <span class="font-medium">25시간</span> / 40시간
                  </div>
                </div>
                <div class="text-sm text-gray-600">2024-01-25 마감</div>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 62.5%"></div>
              </div>
            </div>

            <!-- 대기 중인 작업 -->
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">결제 시스템 통합</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  대기 중
                </span>
              </div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-4">
                  <div class="flex items-center">
                    <img class="w-6 h-6 rounded-full mr-2" src="/api/placeholder/24/24" alt="Bob">
                    <span class="text-sm text-gray-600">Bob Park</span>
                  </div>
                  <div class="text-sm text-gray-600">
                    <span class="font-medium">0시간</span> / 60시간
                  </div>
                </div>
                <div class="text-sm text-gray-600">2024-01-30 마감</div>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-yellow-600 h-2 rounded-full" style="width: 0%"></div>
              </div>
            </div>

            <!-- 완료된 작업 -->
            <div class="border border-green-200 rounded-lg p-4 bg-green-50">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">프로젝트 기획 및 설계</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  완료
                </span>
              </div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-4">
                  <div class="flex items-center">
                    <img class="w-6 h-6 rounded-full mr-2" src="/api/placeholder/24/24" alt="John">
                    <span class="text-sm text-gray-600">John Kim</span>
                  </div>
                  <div class="text-sm text-gray-600">
                    <span class="font-medium">80시간</span> / 80시간
                  </div>
                </div>
                <div class="text-sm text-gray-600">2024-01-15 완료</div>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-green-600 h-2 rounded-full" style="width: 100%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 팀 커뮤니케이션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">💬 팀 커뮤니케이션</h3>
          <div class="space-y-4">
            <div class="flex items-start space-x-3">
              <img class="w-8 h-8 rounded-full" src="/api/placeholder/32/32" alt="Jane">
              <div class="flex-1">
                <div class="bg-gray-100 rounded-lg p-3">
                  <p class="text-sm text-gray-900">사용자 인증 시스템의 기본 구조를 완성했습니다. 다음 단계로 OAuth 연동을 진행하겠습니다.</p>
                  <p class="text-xs text-gray-500 mt-1">Jane Lee • 2시간 전</p>
                </div>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <img class="w-8 h-8 rounded-full" src="/api/placeholder/32/32" alt="Bob">
              <div class="flex-1">
                <div class="bg-gray-100 rounded-lg p-3">
                  <p class="text-sm text-gray-900">결제 시스템 API 문서를 검토했습니다. 다음 주부터 개발을 시작할 예정입니다.</p>
                  <p class="text-xs text-gray-500 mt-1">Bob Park • 4시간 전</p>
                </div>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <img class="w-8 h-8 rounded-full" src="/api/placeholder/32/32" alt="John">
              <div class="flex-1">
                <div class="bg-blue-100 rounded-lg p-3">
                  <p class="text-sm text-gray-900">팀 미팅 일정을 다음 주 화요일 오후 2시로 변경했습니다. 모두 참석 가능한지 확인해주세요.</p>
                  <p class="text-xs text-gray-500 mt-1">John Kim • 6시간 전</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-200">
            <div class="flex space-x-3">
              <input type="text" placeholder="메시지를 입력하세요..." 
                     class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                전송
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 프로젝트 통계 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📊 프로젝트 통계</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">완료된 작업</span>
              <span class="text-sm text-gray-600">1/3</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">진행 중인 작업</span>
              <span class="text-sm text-gray-600">1/3</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">대기 중인 작업</span>
              <span class="text-sm text-gray-600">1/3</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">평균 작업 시간</span>
              <span class="text-sm text-gray-600">55시간</span>
            </div>
          </div>
        </div>

        <!-- AI 분석 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 분석</h3>
          <div class="space-y-3">
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">✅ 진행 상황</h4>
              <p class="text-sm text-green-700">프로젝트가 계획보다 5% 빠르게 진행되고 있습니다.</p>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">💡 최적화 제안</h4>
              <p class="text-sm text-blue-700">Bob의 작업을 1주일 앞당겨 시작하면 전체 일정을 단축할 수 있습니다.</p>
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 class="font-semibold text-yellow-900">⚠️ 주의사항</h4>
              <p class="text-sm text-yellow-700">결제 시스템 통합 작업이 지연될 경우 전체 프로젝트에 영향을 줄 수 있습니다.</p>
            </div>
          </div>
        </div>

        <!-- 다음 단계 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 다음 단계</h3>
          <div class="space-y-3">
            <div class="flex items-center space-x-3">
              <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span class="text-blue-600 text-sm">1</span>
              </div>
              <span class="text-sm text-gray-900">사용자 인증 완료</span>
            </div>
            <div class="flex items-center space-x-3">
              <div class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <span class="text-gray-600 text-sm">2</span>
              </div>
              <span class="text-sm text-gray-900">결제 시스템 통합</span>
            </div>
            <div class="flex items-center space-x-3">
              <div class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <span class="text-gray-600 text-sm">3</span>
              </div>
              <span class="text-sm text-gray-900">프론트엔드 개발</span>
            </div>
            <div class="flex items-center space-x-3">
              <div class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <span class="text-gray-600 text-sm">4</span>
              </div>
              <span class="text-sm text-gray-900">테스트 및 배포</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 통합 프로젝트 관리
- 모든 프로젝트 통합 조회
- 실시간 진행 상황 추적
- 팀원별 작업 분배

### 2. AI 기반 최적화
- 프로젝트 진행률 분석
- 리소스 최적화 제안
- 일정 조정 권장사항

### 3. 팀 협업 도구
- 실시간 커뮤니케이션
- 작업 상태 공유
- 파일 공유 및 버전 관리

### 4. 예산 및 리소스 관리
- 예산 사용 현황 추적
- 팀원별 작업량 분석
- 프로젝트 수익성 분석
