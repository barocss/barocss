# 시나리오 11: SubScene 업데이트 패턴

## 개요
전체 Scene을 교체하는 것이 아니라 특정 부분만 업데이트하는 SubScene 개념을 보여주는 시나리오입니다. 사용자가 실시간으로 데이터를 조작하고, AI가 해당 부분만 동적으로 업데이트하는 패턴을 다룹니다.

## 시나리오 플로우

### 1단계: 메인 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("실시간 데이터 모니터링 대시보드를 만들어줘. 차트와 테이블이 실시간으로 업데이트되어야 해");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "실시간 데이터 모니터링 대시보드를 만들어줘. 차트와 테이블이 실시간으로 업데이트되어야 해",
  sceneHistory: [],
  userSession: {
    userId: "john@example.com",
    role: "data_analyst",
    preferences: {
      refreshInterval: 5000, // 5초
      chartType: "line",
      dataRange: "24h"
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 실시간 데이터 모니터링 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">📊 실시간 데이터 모니터링</h1>
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span class="text-sm text-gray-600">실시간 연결</span>
          </div>
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                  data-action="toggle-auto-refresh">
            자동 새로고침
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 실시간 차트 (SubScene 1) -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6" data-subscene="realtime-chart">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">실시간 트래픽 차트</h3>
            <div class="flex items-center space-x-2">
              <select class="px-3 py-1 border border-gray-300 rounded-md text-sm" 
                      data-action="change-time-range" data-subscene="realtime-chart">
                <option value="1h">1시간</option>
                <option value="6h">6시간</option>
                <option value="24h" selected>24시간</option>
                <option value="7d">7일</option>
              </select>
              <button class="text-gray-600 hover:text-gray-800" 
                      data-action="refresh-chart" data-subscene="realtime-chart">
                🔄
              </button>
            </div>
          </div>
          
          <!-- 차트 영역 (SubScene 업데이트 대상) -->
          <div id="chart-container" class="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div class="text-center">
              <div class="text-4xl mb-2">📈</div>
              <p class="text-gray-600">차트 로딩 중...</p>
            </div>
          </div>
          
          <!-- 실시간 데이터 표시 -->
          <div class="mt-4 grid grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-2xl font-bold text-blue-600" data-metric="current-users">1,234</p>
              <p class="text-sm text-gray-600">현재 사용자</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-green-600" data-metric="requests-per-minute">456</p>
              <p class="text-sm text-gray-600">분당 요청</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-purple-600" data-metric="response-time">89ms</p>
              <p class="text-sm text-gray-600">평균 응답시간</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 실시간 로그 (SubScene 2) -->
      <div class="bg-white shadow rounded-lg p-6" data-subscene="realtime-logs">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">실시간 로그</h3>
          <div class="flex items-center space-x-2">
            <select class="px-3 py-1 border border-gray-300 rounded-md text-sm" 
                    data-action="change-log-level" data-subscene="realtime-logs">
              <option value="all">모든 로그</option>
              <option value="error">에러만</option>
              <option value="warning">경고 이상</option>
              <option value="info">정보 이상</option>
            </select>
            <button class="text-gray-600 hover:text-gray-800" 
                    data-action="clear-logs" data-subscene="realtime-logs">
              🗑️
            </button>
          </div>
        </div>
        
        <!-- 로그 목록 (SubScene 업데이트 대상) -->
        <div id="log-container" class="h-64 overflow-y-auto bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
          <div class="space-y-1">
            <div class="text-gray-500">[14:30:15] 시스템 시작</div>
            <div class="text-green-400">[14:30:16] 사용자 로그인: john@example.com</div>
            <div class="text-yellow-400">[14:30:17] 경고: 메모리 사용률 85%</div>
            <div class="text-green-400">[14:30:18] API 요청 처리 완료</div>
            <div class="text-red-400">[14:30:19] 에러: 데이터베이스 연결 실패</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 실시간 테이블 (SubScene 3) -->
    <div class="mt-8 bg-white shadow rounded-lg p-6" data-subscene="realtime-table">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">실시간 사용자 활동</h3>
        <div class="flex items-center space-x-2">
          <input type="text" placeholder="사용자 검색..." 
                 class="px-3 py-1 border border-gray-300 rounded-md text-sm"
                 data-action="search-users" data-subscene="realtime-table">
          <button class="text-gray-600 hover:text-gray-800" 
                  data-action="refresh-table" data-subscene="realtime-table">
            🔄
          </button>
        </div>
      </div>
      
      <!-- 테이블 (SubScene 업데이트 대상) -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">활동</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
            </tr>
          </thead>
          <tbody id="user-activity-table" class="bg-white divide-y divide-gray-200">
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">john@example.com</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">로그인</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">14:30:16</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  활성
                </span>
              </td>
            </tr>
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">jane@example.com</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">파일 업로드</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">14:29:45</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  처리중
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>
</div>

<script>
// 실시간 업데이트를 위한 JavaScript
let autoRefreshInterval;

function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    updateSubScenes();
  }, 5000);
}

function updateSubScenes() {
  // SubScene 1: 차트 업데이트
  updateChart();
  
  // SubScene 2: 로그 업데이트
  updateLogs();
  
  // SubScene 3: 테이블 업데이트
  updateTable();
}

function updateChart() {
  // 차트 데이터 업데이트
  const metrics = {
    'current-users': Math.floor(Math.random() * 1000) + 1000,
    'requests-per-minute': Math.floor(Math.random() * 200) + 300,
    'response-time': Math.floor(Math.random() * 50) + 50
  };
  
  Object.entries(metrics).forEach(([key, value]) => {
    const element = document.querySelector(`[data-metric="${key}"]`);
    if (element) {
      element.textContent = value;
    }
  });
}

function updateLogs() {
  const logContainer = document.getElementById('log-container');
  const newLog = generateRandomLog();
  const logElement = document.createElement('div');
  logElement.className = 'text-green-400';
  logElement.textContent = newLog;
  
  logContainer.appendChild(logElement);
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // 최대 50개 로그만 유지
  const logs = logContainer.children;
  if (logs.length > 50) {
    logContainer.removeChild(logs[0]);
  }
}

function updateTable() {
  const tableBody = document.getElementById('user-activity-table');
  const newRow = generateRandomUserActivity();
  const rowElement = document.createElement('tr');
  rowElement.innerHTML = newRow;
  
  tableBody.insertBefore(rowElement, tableBody.firstChild);
  
  // 최대 20개 행만 유지
  const rows = tableBody.children;
  if (rows.length > 20) {
    tableBody.removeChild(rows[rows.length - 1]);
  }
}

function generateRandomLog() {
  const timestamp = new Date().toLocaleTimeString();
  const activities = [
    '사용자 로그인',
    'API 요청 처리',
    '데이터베이스 쿼리 실행',
    '파일 업로드 완료',
    '에러 발생',
    '경고 메시지'
  ];
  const activity = activities[Math.floor(Math.random() * activities.length)];
  return `[${timestamp}] ${activity}`;
}

function generateRandomUserActivity() {
  const users = ['john@example.com', 'jane@example.com', 'bob@example.com', 'alice@example.com'];
  const activities = ['로그인', '파일 업로드', '데이터 조회', '설정 변경'];
  const statuses = ['활성', '처리중', '완료', '에러'];
  
  const user = users[Math.floor(Math.random() * users.length)];
  const activity = activities[Math.floor(Math.random() * activities.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const time = new Date().toLocaleTimeString();
  
  const statusClass = {
    '활성': 'bg-green-100 text-green-800',
    '처리중': 'bg-blue-100 text-blue-800',
    '완료': 'bg-gray-100 text-gray-800',
    '에러': 'bg-red-100 text-red-800'
  }[status];
  
  return `
    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user}</td>
    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${activity}</td>
    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${time}</td>
    <td class="px-6 py-4 whitespace-nowrap">
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
        ${status}
      </span>
    </td>
  `;
}

// 자동 새로고침 시작
startAutoRefresh();
</script>
```

### 2단계: SubScene 개별 업데이트

#### 사용자 액션
사용자가 차트의 시간 범위를 "6시간"으로 변경

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("차트의 시간 범위를 6시간으로 변경해줘. 차트 데이터만 업데이트하면 돼");
```

#### AI 응답 및 SubScene 업데이트
```html
<!-- SubScene 1 업데이트: 차트 영역만 변경 -->
<div data-subscene="realtime-chart" data-update="partial">
  <!-- 기존 헤더는 유지 -->
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-medium text-gray-900">실시간 트래픽 차트</h3>
    <div class="flex items-center space-x-2">
      <select class="px-3 py-1 border border-gray-300 rounded-md text-sm" 
              data-action="change-time-range" data-subscene="realtime-chart">
        <option value="1h">1시간</option>
        <option value="6h" selected>6시간</option>
        <option value="24h">24시간</option>
        <option value="7d">7일</option>
      </select>
      <button class="text-gray-600 hover:text-gray-800" 
              data-action="refresh-chart" data-subscene="realtime-chart">
        🔄
      </button>
    </div>
  </div>
  
  <!-- 차트 영역만 업데이트 -->
  <div id="chart-container" class="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
    <div class="text-center">
      <div class="text-4xl mb-2">📈</div>
      <p class="text-gray-600">6시간 데이터 로딩 중...</p>
      <div class="mt-2 text-sm text-blue-600">
        최근 6시간 트래픽 패턴 분석 중...
      </div>
    </div>
  </div>
  
  <!-- 실시간 데이터 표시 (6시간 기준으로 업데이트) -->
  <div class="mt-4 grid grid-cols-3 gap-4">
    <div class="text-center">
      <p class="text-2xl font-bold text-blue-600" data-metric="current-users">1,456</p>
      <p class="text-sm text-gray-600">현재 사용자</p>
    </div>
    <div class="text-center">
      <p class="text-2xl font-bold text-green-600" data-metric="requests-per-minute">523</p>
      <p class="text-sm text-gray-600">분당 요청</p>
    </div>
    <div class="text-center">
      <p class="text-2xl font-bold text-purple-600" data-metric="response-time">76ms</p>
      <p class="text-sm text-gray-600">평균 응답시간</p>
    </div>
  </div>
</div>
```

### 3단계: 다중 SubScene 동시 업데이트

#### 사용자 액션
사용자가 로그 레벨을 "에러만"으로 변경하고 테이블에서 사용자 검색

#### AI 요청
```typescript
const scene3 = await aiAgentOS.request("로그를 에러만 보이게 하고, 테이블에서 'john'으로 검색해줘");
```

#### AI 응답 및 다중 SubScene 업데이트
```html
<!-- SubScene 2 업데이트: 로그 필터링 -->
<div data-subscene="realtime-logs" data-update="partial">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-medium text-gray-900">실시간 로그</h3>
    <div class="flex items-center space-x-2">
      <select class="px-3 py-1 border border-gray-300 rounded-md text-sm" 
              data-action="change-log-level" data-subscene="realtime-logs">
        <option value="all">모든 로그</option>
        <option value="error" selected>에러만</option>
        <option value="warning">경고 이상</option>
        <option value="info">정보 이상</option>
      </select>
      <button class="text-gray-600 hover:text-gray-800" 
              data-action="clear-logs" data-subscene="realtime-logs">
        🗑️
      </button>
    </div>
  </div>
  
  <!-- 에러 로그만 표시 -->
  <div id="log-container" class="h-64 overflow-y-auto bg-gray-900 text-red-400 p-4 rounded-lg font-mono text-sm">
    <div class="space-y-1">
      <div class="text-red-400">[14:30:19] 에러: 데이터베이스 연결 실패</div>
      <div class="text-red-400">[14:28:45] 에러: API 인증 실패</div>
      <div class="text-red-400">[14:25:12] 에러: 파일 업로드 실패</div>
      <div class="text-red-400">[14:22:33] 에러: 메모리 부족</div>
    </div>
  </div>
</div>

<!-- SubScene 3 업데이트: 테이블 검색 결과 -->
<div data-subscene="realtime-table" data-update="partial">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-medium text-gray-900">실시간 사용자 활동</h3>
    <div class="flex items-center space-x-2">
      <input type="text" placeholder="사용자 검색..." 
             class="px-3 py-1 border border-gray-300 rounded-md text-sm"
             data-action="search-users" data-subscene="realtime-table" value="john">
      <button class="text-gray-600 hover:text-gray-800" 
              data-action="refresh-table" data-subscene="realtime-table">
        🔄
      </button>
    </div>
  </div>
  
  <!-- 검색 결과 테이블 -->
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">활동</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
        </tr>
      </thead>
      <tbody id="user-activity-table" class="bg-white divide-y divide-gray-200">
        <tr class="bg-yellow-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">john@example.com</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">로그인</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">14:30:16</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              활성
            </span>
          </td>
        </tr>
        <tr class="bg-yellow-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">john.doe@example.com</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">파일 다운로드</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">14:28:32</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              처리중
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="mt-2 text-sm text-gray-600 text-center">
      "john" 검색 결과: 2건
    </div>
  </div>
</div>
```

### 4단계: SubScene 간 상호작용

#### 사용자 액션
사용자가 테이블에서 특정 사용자 행을 클릭

#### AI 요청
```typescript
const scene4 = await aiAgentOS.request("john@example.com 사용자의 상세 정보를 차트에 표시해줘");
```

#### AI 응답 및 SubScene 간 연동
```html
<!-- SubScene 1 업데이트: 사용자별 차트 -->
<div data-subscene="realtime-chart" data-update="partial">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-medium text-gray-900">john@example.com 사용자 활동 차트</h3>
    <div class="flex items-center space-x-2">
      <span class="text-sm text-blue-600">👤 사용자별 분석</span>
      <button class="text-gray-600 hover:text-gray-800" 
              data-action="back-to-overview" data-subscene="realtime-chart">
        ← 전체 보기
      </button>
    </div>
  </div>
  
  <!-- 사용자별 차트 -->
  <div id="chart-container" class="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
    <div class="text-center">
      <div class="text-4xl mb-2">👤</div>
      <p class="text-gray-600">john@example.com 사용자 활동 분석</p>
      <div class="mt-2 text-sm text-blue-600">
        최근 6시간 활동 패턴 로딩 중...
      </div>
    </div>
  </div>
  
  <!-- 사용자별 실시간 데이터 -->
  <div class="mt-4 grid grid-cols-3 gap-4">
    <div class="text-center">
      <p class="text-2xl font-bold text-blue-600" data-metric="user-sessions">12</p>
      <p class="text-sm text-gray-600">세션 수</p>
    </div>
    <div class="text-center">
      <p class="text-2xl font-bold text-green-600" data-metric="user-requests">89</p>
      <p class="text-sm text-gray-600">요청 수</p>
    </div>
    <div class="text-center">
      <p class="text-2xl font-bold text-purple-600" data-metric="user-duration">2h 15m</p>
      <p class="text-sm text-gray-600">활동 시간</p>
    </div>
  </div>
</div>

<!-- SubScene 3 업데이트: 선택된 사용자 하이라이트 -->
<div data-subscene="realtime-table" data-update="partial">
  <!-- 기존 테이블 유지하되 선택된 행 강조 -->
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">활동</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
        </tr>
      </thead>
      <tbody id="user-activity-table" class="bg-white divide-y divide-gray-200">
        <tr class="bg-blue-100 border-2 border-blue-300">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">john@example.com</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">로그인</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">14:30:16</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              활성
            </span>
          </td>
        </tr>
        <tr class="bg-yellow-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">john.doe@example.com</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">파일 다운로드</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">14:28:32</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              처리중
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="mt-2 text-sm text-blue-600 text-center">
      👤 john@example.com 선택됨 - 차트에서 상세 분석 중
    </div>
  </div>
</div>
```

## 핵심 특징

### 1. SubScene 개념
- **부분 업데이트**: 전체 Scene이 아닌 특정 부분만 업데이트
- **독립적 관리**: 각 SubScene이 독립적으로 상태 관리
- **선택적 렌더링**: 필요한 부분만 다시 렌더링

### 2. 실시간 상호작용
- **자동 업데이트**: 주기적으로 SubScene 자동 갱신
- **사용자 트리거**: 사용자 액션에 따른 즉시 업데이트
- **상태 동기화**: 여러 SubScene 간 상태 공유

### 3. 효율적인 렌더링
- **최소 DOM 조작**: 변경된 부분만 업데이트
- **성능 최적화**: 불필요한 전체 렌더링 방지
- **부드러운 UX**: 깜빡임 없는 자연스러운 업데이트

### 4. 유연한 구조
- **모듈화**: 각 SubScene이 독립적으로 동작
- **재사용성**: SubScene을 다른 Scene에서 재사용 가능
- **확장성**: 새로운 SubScene 쉽게 추가 가능

## SubScene 업데이트 패턴

### 1. 단일 SubScene 업데이트
```typescript
// 특정 SubScene만 업데이트
aiAgentOS.updateSubScene('realtime-chart', {
  data: newChartData,
  config: { timeRange: '6h' }
});
```

### 2. 다중 SubScene 업데이트
```typescript
// 여러 SubScene 동시 업데이트
aiAgentOS.updateMultipleSubScenes([
  { id: 'realtime-chart', data: chartData },
  { id: 'realtime-logs', data: filteredLogs },
  { id: 'realtime-table', data: searchResults }
]);
```

### 3. SubScene 간 연동
```typescript
// SubScene 간 상호작용
aiAgentOS.linkSubScenes('realtime-table', 'realtime-chart', {
  onUserSelect: (userData) => {
    // 테이블에서 사용자 선택 시 차트 업데이트
    updateUserChart(userData);
  }
});
```

이러한 SubScene 패턴은 복잡한 대시보드나 실시간 모니터링 시스템에서 매우 유용하며, 사용자 경험을 크게 향상시킬 수 있습니다.
