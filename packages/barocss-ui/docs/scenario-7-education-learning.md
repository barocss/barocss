# 시나리오 7: 교육 및 학습 관리

## 개요
사용자의 학습 목표를 설정하고, 개인화된 학습 계획을 수립하며, AI가 학습 진도를 분석하여 최적화 방안을 제안하는 스마트 교육 시스템입니다.

## 시나리오 플로우

### 1단계: 학습 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("교육 및 학습 관리 시스템을 만들어줘. 내 학습 목표를 달성할 수 있도록 도와줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "교육 및 학습 관리 시스템을 만들어줘. 내 학습 목표를 달성할 수 있도록 도와줘",
  sceneHistory: [
    // 이전 모든 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    learningProfile: {
      currentLevel: "intermediate",
      learningStyle: "visual",
      preferredTime: "evening",
      dailyStudyTime: 120, // minutes
      goals: ["web_development", "data_science", "ai_ml"],
      completedCourses: 5,
      currentStreak: 12 // days
    },
    currentCourses: [
      {
        id: "course1",
        title: "React 완전 정복",
        progress: 65,
        totalLessons: 40,
        completedLessons: 26,
        estimatedTime: 120,
        actualTime: 78,
        difficulty: "intermediate",
        category: "web_development"
      },
      {
        id: "course2",
        title: "Python 데이터 분석",
        progress: 30,
        totalLessons: 30,
        completedLessons: 9,
        estimatedTime: 90,
        actualTime: 27,
        difficulty: "beginner",
        category: "data_science"
      }
    ],
    learningStats: {
      totalStudyTime: 1800, // minutes
      weeklyGoal: 840, // minutes
      completedThisWeek: 420,
      averageScore: 85,
      improvementRate: 12
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 교육 및 학습 관리 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">🎓 AI 학습 관리</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">john@example.com님의 학습</span>
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 학습 현황 요약 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-blue-900 mb-4">📊 학습 현황</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">연속 학습</h3>
          <p class="text-2xl font-bold text-green-600">12일</p>
          <p class="text-sm text-gray-600">새로운 기록!</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">이번 주 학습</h3>
          <p class="text-2xl font-bold text-blue-600">7시간</p>
          <p class="text-sm text-gray-600">목표의 50%</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">평균 점수</h3>
          <p class="text-2xl font-bold text-purple-600">85점</p>
          <p class="text-sm text-gray-600">+12% 향상</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">완료 코스</h3>
          <p class="text-2xl font-bold text-orange-600">5개</p>
          <p class="text-sm text-gray-600">진행 중 2개</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 진행 중인 코스 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6 mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📚 진행 중인 코스</h3>
          <div class="space-y-6">
            <!-- React 완전 정복 -->
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-xl font-semibold text-gray-900">React 완전 정복</h4>
                  <p class="text-sm text-gray-600">웹 개발 • 중급 • 40강</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    진행 중
                  </span>
                  <span class="text-sm text-gray-600">65%</span>
                </div>
              </div>
              
              <div class="mb-4">
                <div class="flex justify-between text-sm text-gray-600 mb-2">
                  <span>진행률</span>
                  <span>26/40 강의</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div class="bg-blue-600 h-3 rounded-full" style="width: 65%"></div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p class="text-sm text-gray-600">예상 시간</p>
                  <p class="text-lg font-semibold text-gray-900">120분</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">실제 시간</p>
                  <p class="text-lg font-semibold text-gray-900">78분</p>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div class="flex items-center">
                    <span class="text-sm text-gray-600">다음 강의:</span>
                    <span class="ml-2 text-sm font-medium text-gray-900">컴포넌트 생명주기</span>
                  </div>
                </div>
                <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                        data-action="continue-course" data-course="course1">
                  계속 학습
                </button>
              </div>
            </div>

            <!-- Python 데이터 분석 -->
            <div class="border border-gray-200 rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-xl font-semibold text-gray-900">Python 데이터 분석</h4>
                  <p class="text-sm text-gray-600">데이터 사이언스 • 초급 • 30강</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    시작됨
                  </span>
                  <span class="text-sm text-gray-600">30%</span>
                </div>
              </div>
              
              <div class="mb-4">
                <div class="flex justify-between text-sm text-gray-600 mb-2">
                  <span>진행률</span>
                  <span>9/30 강의</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div class="bg-yellow-600 h-3 rounded-full" style="width: 30%"></div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p class="text-sm text-gray-600">예상 시간</p>
                  <p class="text-lg font-semibold text-gray-900">90분</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">실제 시간</p>
                  <p class="text-lg font-semibold text-gray-900">27분</p>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div class="flex items-center">
                    <span class="text-sm text-gray-600">다음 강의:</span>
                    <span class="ml-2 text-sm font-medium text-gray-900">NumPy 기초</span>
                  </div>
                </div>
                <button class="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm" 
                        data-action="continue-course" data-course="course2">
                  계속 학습
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 오늘의 학습 계획 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📅 오늘의 학습 계획</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <h4 class="font-semibold text-gray-900">React 컴포넌트 생명주기</h4>
                  <p class="text-sm text-gray-600">React 완전 정복 • 30분</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">오후 7:00</p>
                <button class="text-blue-600 hover:text-blue-800 text-sm" 
                        data-action="start-lesson" data-lesson="react-lifecycle">
                  시작
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <div>
                  <h4 class="font-semibold text-gray-900">NumPy 기초</h4>
                  <p class="text-sm text-gray-600">Python 데이터 분석 • 20분</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">오후 8:00</p>
                <button class="text-yellow-600 hover:text-yellow-800 text-sm" 
                        data-action="start-lesson" data-lesson="numpy-basics">
                  시작
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <div>
                  <h4 class="font-semibold text-gray-900">퀴즈 복습</h4>
                  <p class="text-sm text-gray-600">React 기초 • 15분</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">오후 9:00</p>
                <button class="text-green-600 hover:text-green-800 text-sm" 
                        data-action="start-quiz" data-quiz="react-basics">
                  시작
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 학습 목표 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 학습 목표</h3>
          <div class="space-y-4">
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">웹 개발</h4>
              <p class="text-sm text-blue-700">React 완전 정복 완료</p>
              <div class="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 65%"></div>
              </div>
            </div>
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">데이터 사이언스</h4>
              <p class="text-sm text-green-700">Python 데이터 분석 완료</p>
              <div class="w-full bg-green-200 rounded-full h-2 mt-2">
                <div class="bg-green-600 h-2 rounded-full" style="width: 30%"></div>
              </div>
            </div>
            <div class="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 class="font-semibold text-purple-900">AI/ML</h4>
              <p class="text-sm text-purple-700">머신러닝 기초 시작</p>
              <div class="w-full bg-purple-200 rounded-full h-2 mt-2">
                <div class="bg-purple-600 h-2 rounded-full" style="width: 0%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 추천 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 학습 조언</h3>
          <div class="space-y-3">
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">💡 학습 패턴</h4>
              <p class="text-sm text-green-700">저녁 시간대 학습이 가장 효과적입니다. 계속 유지하세요!</p>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">📈 진도 최적화</h4>
              <p class="text-sm text-blue-700">React 코스를 먼저 완료한 후 Python을 집중하는 것을 추천합니다.</p>
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 class="font-semibold text-yellow-900">⚠️ 주의사항</h4>
              <p class="text-sm text-yellow-700">이번 주 학습량이 목표의 50%입니다. 주말에 보충하세요.</p>
            </div>
          </div>
        </div>

        <!-- 빠른 액션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">⚡ 빠른 액션</h3>
          <div class="space-y-3">
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="start-study">
              📚 학습 시작
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="take-quiz">
              🧠 퀴즈 풀기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="find-course">
              🔍 새 코스 찾기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="study-report">
              📊 학습 리포트
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 개인화된 학습 계획 수립

#### 사용자 액션
사용자가 "새 코스 찾기" 버튼 클릭

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("내 학습 목표에 맞는 새로운 코스를 추천해줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 개인화된 코스 추천 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- AI 추천 코스 -->
    <div class="mb-8 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-purple-900 mb-4">🎯 AI 맞춤 코스 추천</h2>
      <p class="text-purple-700 mb-4">당신의 학습 패턴과 목표를 분석한 결과, 다음과 같은 코스를 추천합니다.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">학습 스타일</h3>
          <p class="text-lg font-bold text-purple-600">시각적 학습</p>
          <p class="text-sm text-gray-600">동영상 중심</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">선호 시간</h3>
          <p class="text-lg font-bold text-blue-600">저녁</p>
          <p class="text-sm text-gray-600">7-9시</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">학습 수준</h3>
          <p class="text-lg font-bold text-green-600">중급</p>
          <p class="text-sm text-gray-600">기초 완료</p>
        </div>
      </div>
    </div>

    <!-- 추천 코스 목록 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🔥 인기 추천</h3>
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-900">Node.js 백엔드 개발</h4>
              <span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">추천</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">React와 연계하여 풀스택 개발자로 성장</p>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">난이도</span>
                <span class="font-medium text-orange-600">중급</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">소요시간</span>
                <span class="font-medium text-gray-900">60시간</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">완성률</span>
                <span class="font-medium text-green-600">95%</span>
              </div>
            </div>
            <button class="w-full mt-3 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm">
              코스 시작
            </button>
          </div>

          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-900">머신러닝 기초</h4>
              <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">AI 추천</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">Python 데이터 분석 후 자연스러운 다음 단계</p>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">난이도</span>
                <span class="font-medium text-blue-600">중급</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">소요시간</span>
                <span class="font-medium text-gray-900">80시간</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">완성률</span>
                <span class="font-medium text-green-600">92%</span>
              </div>
            </div>
            <button class="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm">
              코스 시작
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 목표 기반 추천</h3>
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-900">TypeScript 완전 정복</h4>
              <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">완벽 매치</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">React 개발자에게 필수적인 TypeScript</p>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">난이도</span>
                <span class="font-medium text-green-600">중급</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">소요시간</span>
                <span class="font-medium text-gray-900">40시간</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">완성률</span>
                <span class="font-medium text-green-600">98%</span>
              </div>
            </div>
            <button class="w-full mt-3 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm">
              코스 시작
            </button>
          </div>

          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-900">데이터베이스 설계</h4>
              <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">보완</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">백엔드 개발을 위한 데이터베이스 지식</p>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">난이도</span>
                <span class="font-medium text-purple-600">중급</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">소요시간</span>
                <span class="font-medium text-gray-900">50시간</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">완성률</span>
                <span class="font-medium text-green-600">90%</span>
              </div>
            </div>
            <button class="w-full mt-3 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 text-sm">
              코스 시작
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 학습 경로 -->
    <div class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">🛤️ 추천 학습 경로</h3>
      <div class="space-y-6">
        <div class="flex items-center space-x-4">
          <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span class="text-white text-sm font-bold">1</span>
          </div>
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">React 완전 정복 완료</h4>
            <p class="text-sm text-gray-600">현재 진행 중 • 65% 완료</p>
          </div>
          <span class="text-sm text-green-600">진행 중</span>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span class="text-white text-sm font-bold">2</span>
          </div>
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">TypeScript 완전 정복</h4>
            <p class="text-sm text-gray-600">React 개발자 필수 • 40시간</p>
          </div>
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
            시작하기
          </button>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span class="text-gray-600 text-sm font-bold">3</span>
          </div>
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">Node.js 백엔드 개발</h4>
            <p class="text-sm text-gray-600">풀스택 개발자로 성장 • 60시간</p>
          </div>
          <span class="text-sm text-gray-500">대기 중</span>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span class="text-gray-600 text-sm font-bold">4</span>
          </div>
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">머신러닝 기초</h4>
            <p class="text-sm text-gray-600">AI/ML 분야 진출 • 80시간</p>
          </div>
          <span class="text-sm text-gray-500">대기 중</span>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 개인화된 학습 계획
- 사용자 학습 스타일 분석
- 목표 기반 코스 추천
- 학습 진도 자동 추적

### 2. AI 기반 최적화
- 학습 패턴 분석
- 최적 학습 시간 추천
- 개인화된 학습 경로

### 3. 동기부여 시스템
- 연속 학습 기록 추적
- 성취 배지 시스템
- 학습 목표 달성률 표시

### 4. 적응형 학습
- 학습 속도에 따른 조정
- 약점 보완 학습 제안
- 실시간 피드백 제공
