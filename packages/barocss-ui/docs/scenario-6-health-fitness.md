# 시나리오 6: 건강 및 피트니스 관리

## 개요
사용자의 건강 데이터를 추적하고, 운동 계획을 수립하며, 건강 목표를 달성하도록 도와주는 AI 건강 관리 시스템입니다.

## 시나리오 플로우

### 1단계: 건강 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("건강 관리 시스템을 만들어줘. 운동과 식단을 관리하고 싶어");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "건강 관리 시스템을 만들어줘. 운동과 식단을 관리하고 싶어",
  sceneHistory: [
    // 이전 모든 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    healthProfile: {
      age: 30,
      gender: "male",
      height: 175,
      weight: 75,
      activityLevel: "moderate",
      goals: ["weight_loss", "muscle_gain"],
      medicalConditions: [],
      allergies: []
    },
    fitnessData: {
      dailySteps: 0,
      caloriesBurned: 0,
      workoutsThisWeek: 0,
      currentStreak: 0
    },
    preferences: {
      workoutTime: "evening",
      preferredActivities: ["running", "weight_training"],
      dietaryRestrictions: [],
      notificationFrequency: "daily"
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 건강 관리 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">💪 AI 건강 관리</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">안녕하세요, john@example.com님!</span>
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 오늘의 건강 요약 -->
    <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-green-900 mb-4">📊 오늘의 건강 현황</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">걸음 수</h3>
          <p class="text-2xl font-bold text-blue-600">0 / 10,000</p>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
          </div>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">칼로리</h3>
          <p class="text-2xl font-bold text-red-600">0 / 2,000</p>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div class="bg-red-600 h-2 rounded-full" style="width: 0%"></div>
          </div>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">운동 시간</h3>
          <p class="text-2xl font-bold text-purple-600">0분</p>
          <p class="text-sm text-gray-600">목표: 30분</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">연속 일수</h3>
          <p class="text-2xl font-bold text-orange-600">0일</p>
          <p class="text-sm text-gray-600">새로운 시작!</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 오늘의 운동 계획 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6 mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🏃‍♂️ 오늘의 운동 계획</h3>
          <div class="space-y-4">
            <div class="flex items-center p-4 border border-gray-200 rounded-lg">
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <span class="text-2xl">🏃‍♂️</span>
              </div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">조깅</h4>
                <p class="text-sm text-gray-600">30분간 가벼운 조깅</p>
                <p class="text-xs text-gray-500">예상 칼로리 소모: 300kcal</p>
              </div>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="start-workout" data-workout="running">
                시작
              </button>
            </div>

            <div class="flex items-center p-4 border border-gray-200 rounded-lg">
              <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <span class="text-2xl">💪</span>
              </div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">웨이트 트레이닝</h4>
                <p class="text-sm text-gray-600">상체 근력 운동</p>
                <p class="text-xs text-gray-500">예상 칼로리 소모: 250kcal</p>
              </div>
              <button class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm" 
                      data-action="start-workout" data-workout="weight_training">
                시작
              </button>
            </div>

            <div class="flex items-center p-4 border border-gray-200 rounded-lg">
              <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                <span class="text-2xl">🧘‍♂️</span>
              </div>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">스트레칭</h4>
                <p class="text-sm text-gray-600">15분간 전신 스트레칭</p>
                <p class="text-xs text-gray-500">예상 칼로리 소모: 50kcal</p>
              </div>
              <button class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm" 
                      data-action="start-workout" data-workout="stretching">
                시작
              </button>
            </div>
          </div>
        </div>

        <!-- 식단 관리 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🍎 오늘의 식단</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <span class="text-xl">🌅</span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900">아침</h4>
                  <p class="text-sm text-gray-600">아직 기록되지 않음</p>
                </div>
              </div>
              <button class="text-blue-600 hover:text-blue-800 text-sm" 
                      data-action="add-meal" data-meal="breakfast">
                추가
              </button>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span class="text-xl">☀️</span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900">점심</h4>
                  <p class="text-sm text-gray-600">아직 기록되지 않음</p>
                </div>
              </div>
              <button class="text-blue-600 hover:text-blue-800 text-sm" 
                      data-action="add-meal" data-meal="lunch">
                추가
              </button>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                  <span class="text-xl">🌙</span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900">저녁</h4>
                  <p class="text-sm text-gray-600">아직 기록되지 않음</p>
                </div>
              </div>
              <button class="text-blue-600 hover:text-blue-800 text-sm" 
                      data-action="add-meal" data-meal="dinner">
                추가
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 건강 목표 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 건강 목표</h3>
          <div class="space-y-4">
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">체중 감량</h4>
              <p class="text-sm text-blue-700">목표: 70kg (현재 75kg)</p>
              <div class="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 20%"></div>
              </div>
            </div>
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">근육 증가</h4>
              <p class="text-sm text-green-700">목표: 주 3회 운동</p>
              <div class="w-full bg-green-200 rounded-full h-2 mt-2">
                <div class="bg-green-600 h-2 rounded-full" style="width: 0%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 추천 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 추천</h3>
          <div class="space-y-3">
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 class="font-semibold text-yellow-900">💡 팁</h4>
              <p class="text-sm text-yellow-700">아침에 물을 한 잔 마시면 신진대사가 활발해집니다.</p>
            </div>
            <div class="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 class="font-semibold text-purple-900">🏃‍♂️ 운동</h4>
              <p class="text-sm text-purple-700">오늘은 가벼운 조깅을 추천합니다.</p>
            </div>
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 class="font-semibold text-red-900">🍎 식단</h4>
              <p class="text-sm text-red-700">단백질 섭취를 늘려보세요.</p>
            </div>
          </div>
        </div>

        <!-- 빠른 액션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">⚡ 빠른 액션</h3>
          <div class="space-y-3">
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="log-water">
              💧 물 마시기 기록
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="log-weight">
              ⚖️ 체중 기록
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="log-sleep">
              😴 수면 기록
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="emergency">
              🚨 응급상황
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 운동 시작 및 추적

#### 사용자 액션
사용자가 "조깅" 운동 시작 버튼 클릭

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("조깅 운동을 시작했어. 실시간으로 추적하고 동기부여를 해줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 실시간 운동 추적 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 운동 진행 상황 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-blue-900 mb-4">🏃‍♂️ 조깅 진행 중</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">경과 시간</h3>
          <p class="text-2xl font-bold text-blue-600" id="elapsed-time">00:00</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">거리</h3>
          <p class="text-2xl font-bold text-green-600" id="distance">0.0 km</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">칼로리</h3>
          <p class="text-2xl font-bold text-red-600" id="calories">0 kcal</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">페이스</h3>
          <p class="text-2xl font-bold text-purple-600" id="pace">--:-- /km</p>
        </div>
      </div>
    </div>

    <!-- 실시간 동기부여 -->
    <div class="mb-8 bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">💪 AI 동기부여</h3>
      <div class="space-y-4">
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 class="font-semibold text-green-900">🎉 잘하고 있어요!</h4>
          <p class="text-sm text-green-700">첫 5분을 완주했습니다. 계속해서 좋은 페이스를 유지하세요!</p>
        </div>
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 class="font-semibold text-blue-900">📊 목표까지</h4>
          <p class="text-sm text-blue-700">목표 시간 30분까지 25분 남았습니다. 절반 이상 완주했어요!</p>
        </div>
        <div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 class="font-semibold text-purple-900">🔥 칼로리 소모</h4>
          <p class="text-sm text-purple-700">현재까지 150kcal를 소모했습니다. 목표 300kcal의 50%입니다!</p>
        </div>
      </div>
    </div>

    <!-- 운동 제어 -->
    <div class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">🎮 운동 제어</h3>
      <div class="flex justify-center space-x-4">
        <button class="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-semibold" 
                data-action="pause-workout">
          ⏸️ 일시정지
        </button>
        <button class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold" 
                data-action="resume-workout">
          ▶️ 재개
        </button>
        <button class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold" 
                data-action="stop-workout">
          ⏹️ 종료
        </button>
      </div>
    </div>

    <!-- 실시간 팁 -->
    <div class="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-yellow-900 mb-4">💡 실시간 팁</h3>
      <div class="space-y-3">
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
            <span class="text-yellow-600 text-sm">1</span>
          </div>
          <div>
            <p class="font-medium text-yellow-900">호흡 조절</p>
            <p class="text-sm text-yellow-700">코로 들이마시고 입으로 내쉬는 리듬을 유지하세요.</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
            <span class="text-yellow-600 text-sm">2</span>
          </div>
          <div>
            <p class="font-medium text-yellow-900">자세 유지</p>
            <p class="text-sm text-yellow-700">어깨를 뒤로 빼고 가슴을 펴고 뛰세요.</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
            <span class="text-yellow-600 text-sm">3</span>
          </div>
          <div>
            <p class="font-medium text-yellow-900">물 섭취</p>
            <p class="text-sm text-yellow-700">15분마다 물을 조금씩 마시세요.</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<script>
// 실시간 운동 추적 JavaScript
let startTime = Date.now();
let isRunning = true;

function updateWorkoutStats() {
  if (!isRunning) return;
  
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  document.getElementById('elapsed-time').textContent = 
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // 거리 계산 (예시: 평균 속도 10km/h)
  const distance = (elapsed / 3600) * 10;
  document.getElementById('distance').textContent = distance.toFixed(1) + ' km';
  
  // 칼로리 계산 (예시: 70kg 기준 10kcal/min)
  const calories = Math.floor((elapsed / 60) * 10);
  document.getElementById('calories').textContent = calories + ' kcal';
  
  // 페이스 계산
  if (distance > 0) {
    const pace = elapsed / distance;
    const paceMinutes = Math.floor(pace / 60);
    const paceSeconds = Math.floor(pace % 60);
    document.getElementById('pace').textContent = 
      `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')} /km`;
  }
}

setInterval(updateWorkoutStats, 1000);
</script>
```

### 3단계: 운동 완료 및 결과 분석

#### 사용자 액션
사용자가 운동 종료 버튼 클릭

#### AI 요청
```typescript
const scene3 = await aiAgentOS.request("조깅을 완료했어. 결과를 분석하고 다음 운동 계획을 세워줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 운동 완료 및 결과 분석 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 운동 완료 축하 -->
    <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-green-900 mb-4">🎉 운동 완료!</h2>
      <p class="text-green-700 mb-4">훌륭한 운동이었습니다! 결과를 확인해보세요.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">총 시간</h3>
          <p class="text-2xl font-bold text-green-600">30분</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">총 거리</h3>
          <p class="text-2xl font-bold text-blue-600">5.2km</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">칼로리 소모</h3>
          <p class="text-2xl font-bold text-red-600">320kcal</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">평균 페이스</h3>
          <p class="text-2xl font-bold text-purple-600">5:46/km</p>
        </div>
      </div>
    </div>

    <!-- AI 분석 결과 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📊 성과 분석</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">목표 달성률</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-green-600 h-2 rounded-full" style="width: 100%"></div>
              </div>
              <span class="text-sm text-gray-600">100%</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">칼로리 목표</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-red-600 h-2 rounded-full" style="width: 107%"></div>
              </div>
              <span class="text-sm text-gray-600">107%</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">일관성</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 85%"></div>
              </div>
              <span class="text-sm text-gray-600">85%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🏆 성취</h3>
        <div class="space-y-3">
          <div class="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span class="text-2xl">🏃‍♂️</span>
            <div>
              <p class="font-semibold text-yellow-900">첫 조깅 완주</p>
              <p class="text-sm text-yellow-700">30분 조깅을 완주했습니다!</p>
            </div>
          </div>
          <div class="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <span class="text-2xl">🔥</span>
            <div>
              <p class="font-semibold text-green-900">칼로리 목표 초과</p>
              <p class="text-sm text-green-700">목표보다 20kcal 더 소모했습니다!</p>
            </div>
          </div>
          <div class="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span class="text-2xl">⚡</span>
            <div>
              <p class="font-semibold text-blue-900">일관된 페이스</p>
              <p class="text-sm text-blue-700">안정적인 속도를 유지했습니다!</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 다음 운동 계획 -->
    <div class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">📅 다음 운동 계획</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-2">내일 (화요일)</h4>
          <p class="text-sm text-gray-600 mb-3">웨이트 트레이닝</p>
          <ul class="text-xs text-gray-500 space-y-1">
            <li>• 벤치프레스 3세트</li>
            <li>• 스쿼트 3세트</li>
            <li>• 데드리프트 3세트</li>
          </ul>
          <button class="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm">
            계획 확인
          </button>
        </div>
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-2">모레 (수요일)</h4>
          <p class="text-sm text-gray-600 mb-3">휴식일</p>
          <ul class="text-xs text-gray-500 space-y-1">
            <li>• 가벼운 스트레칭</li>
            <li>• 충분한 수면</li>
            <li>• 영양 보충</li>
          </ul>
          <button class="mt-3 w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 text-sm">
            휴식 계획
          </button>
        </div>
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-2">목요일</h4>
          <p class="text-sm text-gray-600 mb-3">조깅 + 스트레칭</p>
          <ul class="text-xs text-gray-500 space-y-1">
            <li>• 25분 조깅</li>
            <li>• 10분 스트레칭</li>
            <li>• 목표: 250kcal</li>
          </ul>
          <button class="mt-3 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm">
            계획 확인
          </button>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 실시간 운동 추적
- GPS 기반 거리 측정
- 칼로리 소모 실시간 계산
- 페이스 및 속도 모니터링

### 2. AI 동기부여
- 실시간 격려 메시지
- 목표 달성률 표시
- 성취 배지 시스템

### 3. 개인화된 운동 계획
- 사용자 체력 수준 분석
- 목표 기반 운동 설계
- 진행 상황에 따른 계획 조정

### 4. 종합적인 건강 관리
- 운동, 식단, 수면 통합 관리
- 건강 데이터 시각화
- 의료진 연동 가능
