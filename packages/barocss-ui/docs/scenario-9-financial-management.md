# 시나리오 9: 금융 관리 시스템

## 개요
사용자의 수입, 지출, 투자를 통합 관리하고, AI가 개인화된 금융 조언을 제공하는 스마트 금융 관리 시스템입니다.

## 시나리오 플로우

### 1단계: 금융 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await director.request("금융 관리 시스템을 만들어줘. 내 수입과 지출을 관리하고 투자 조언을 받고 싶어");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "금융 관리 시스템을 만들어줘. 내 수입과 지출을 관리하고 투자 조언을 받고 싶어",
  sceneHistory: [
    // 이전 모든 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    financialProfile: {
      monthlyIncome: 5000000,
      monthlyExpenses: 3500000,
      savings: 15000000,
      investments: 25000000,
      creditScore: 750,
      riskTolerance: "moderate",
      financialGoals: ["emergency_fund", "retirement", "house_purchase"]
    },
    accounts: [
      { id: "checking", name: "입출금 통장", balance: 5000000, type: "checking" },
      { id: "savings", name: "저축 통장", balance: 15000000, type: "savings" },
      { id: "investment", name: "투자 계좌", balance: 25000000, type: "investment" }
    ],
    recentTransactions: [
      { id: "tx1", date: "2024-01-15", description: "급여", amount: 5000000, type: "income", category: "salary" },
      { id: "tx2", date: "2024-01-14", description: "아파트 관리비", amount: -150000, type: "expense", category: "housing" },
      { id: "tx3", date: "2024-01-13", description: "식비", amount: -80000, type: "expense", category: "food" },
      { id: "tx4", date: "2024-01-12", description: "교통비", amount: -120000, type: "expense", category: "transportation" }
    ],
    budget: {
      housing: 2000000,
      food: 500000,
      transportation: 300000,
      entertainment: 200000,
      savings: 1000000,
      investments: 500000
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 금융 관리 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">💰 AI 금융 관리</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">john@example.com님의 자산</span>
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 자산 요약 -->
    <div class="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-green-900 mb-4">📊 자산 현황</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">총 자산</h3>
          <p class="text-2xl font-bold text-green-600">₩45,000,000</p>
          <p class="text-sm text-gray-600">전월 대비 +5.2%</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">월 수입</h3>
          <p class="text-2xl font-bold text-blue-600">₩5,000,000</p>
          <p class="text-sm text-gray-600">안정적</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">월 지출</h3>
          <p class="text-2xl font-bold text-red-600">₩3,500,000</p>
          <p class="text-sm text-gray-600">예산 내</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">월 저축</h3>
          <p class="text-2xl font-bold text-purple-600">₩1,500,000</p>
          <p class="text-sm text-gray-600">저축률 30%</p>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 계좌 현황 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6 mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🏦 계좌 현황</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span class="text-2xl">💳</span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900">입출금 통장</h4>
                  <p class="text-sm text-gray-600">KB국민은행</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold text-gray-900">₩5,000,000</p>
                <p class="text-sm text-gray-600">사용 가능</p>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <span class="text-2xl">💰</span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900">저축 통장</h4>
                  <p class="text-sm text-gray-600">신한은행</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold text-gray-900">₩15,000,000</p>
                <p class="text-sm text-gray-600">이자 2.5%</p>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div class="flex items-center">
                <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <span class="text-2xl">📈</span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900">투자 계좌</h4>
                  <p class="text-sm text-gray-600">키움증권</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-bold text-gray-900">₩25,000,000</p>
                <p class="text-sm text-gray-600">수익률 +8.5%</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 최근 거래 내역 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📋 최근 거래 내역</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">내용</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-15</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">급여</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      수입
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">+₩5,000,000</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-14</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">아파트 관리비</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      주거
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">-₩150,000</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-13</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">식비</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      식비
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">-₩80,000</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-12</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">교통비</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      교통
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">-₩120,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 사이드바 -->
      <div class="space-y-6">
        <!-- 예산 현황 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">📊 예산 현황</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">주거비</span>
              <div class="flex items-center">
                <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div class="bg-red-600 h-2 rounded-full" style="width: 75%"></div>
                </div>
                <span class="text-sm text-gray-600">₩1.5M/₩2M</span>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">식비</span>
              <div class="flex items-center">
                <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div class="bg-orange-600 h-2 rounded-full" style="width: 16%"></div>
                </div>
                <span class="text-sm text-gray-600">₩80K/₩500K</span>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">교통비</span>
              <div class="flex items-center">
                <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div class="bg-blue-600 h-2 rounded-full" style="width: 40%"></div>
                </div>
                <span class="text-sm text-gray-600">₩120K/₩300K</span>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-900">저축</span>
              <div class="flex items-center">
                <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div class="bg-green-600 h-2 rounded-full" style="width: 100%"></div>
                </div>
                <span class="text-sm text-gray-600">₩1M/₩1M</span>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 추천 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">🤖 AI 금융 조언</h3>
          <div class="space-y-3">
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 class="font-semibold text-green-900">💡 저축 최적화</h4>
              <p class="text-sm text-green-700">현재 저축률이 30%로 우수합니다. 목표 달성을 위해 계속 유지하세요.</p>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 class="font-semibold text-blue-900">📈 투자 기회</h4>
              <p class="text-sm text-blue-700">글로벌 ETF 투자를 고려해보세요. 분산투자로 리스크를 줄일 수 있습니다.</p>
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 class="font-semibold text-yellow-900">⚠️ 주의사항</h4>
              <p class="text-sm text-yellow-700">주거비가 예산의 75%를 차지하고 있습니다. 추가 비용 발생에 주의하세요.</p>
            </div>
          </div>
        </div>

        <!-- 빠른 액션 -->
        <div class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">⚡ 빠른 액션</h3>
          <div class="space-y-3">
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="add-transaction">
              💰 거래 추가
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="transfer-money">
              💸 이체하기
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="investment-advice">
              📈 투자 조언
            </button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" 
                    data-action="quick-action" data-action-type="budget-analysis">
              📊 예산 분석
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 투자 조언 및 포트폴리오 관리

#### 사용자 액션
사용자가 "투자 조언" 버튼 클릭

#### AI 요청
```typescript
const scene2 = await director.request("내 투자 포트폴리오를 분석하고 개선 방안을 제안해줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 투자 조언 및 포트폴리오 관리 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 투자 현황 요약 -->
    <div class="mb-8 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-purple-900 mb-4">📈 투자 포트폴리오 분석</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">총 투자금</h3>
          <p class="text-2xl font-bold text-purple-600">₩25,000,000</p>
          <p class="text-sm text-gray-600">현재 가치</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">수익률</h3>
          <p class="text-2xl font-bold text-green-600">+8.5%</p>
          <p class="text-sm text-gray-600">연간 수익률</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">수익금</h3>
          <p class="text-2xl font-bold text-blue-600">+₩2,125,000</p>
          <p class="text-sm text-gray-600">실현 수익</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">리스크 등급</h3>
          <p class="text-2xl font-bold text-yellow-600">중간</p>
          <p class="text-sm text-gray-600">적정 수준</p>
        </div>
      </div>
    </div>

    <!-- 포트폴리오 구성 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📊 포트폴리오 구성</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-blue-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-900">주식</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">60%</div>
              <div class="text-xs text-gray-500">₩15,000,000</div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-900">채권</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">25%</div>
              <div class="text-xs text-gray-500">₩6,250,000</div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-purple-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-900">ETF</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">15%</div>
              <div class="text-xs text-gray-500">₩3,750,000</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 AI 추천 포트폴리오</h3>
        <div class="space-y-4">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 class="font-semibold text-blue-900">현재 포트폴리오</h4>
            <p class="text-sm text-blue-700">주식 60%, 채권 25%, ETF 15%</p>
            <p class="text-xs text-blue-600">수익률: +8.5%</p>
          </div>
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 class="font-semibold text-green-900">AI 추천 포트폴리오</h4>
            <p class="text-sm text-green-700">주식 50%, 채권 30%, ETF 20%</p>
            <p class="text-xs text-green-600">예상 수익률: +9.2%</p>
          </div>
          <div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="font-semibold text-purple-900">리스크 조정</h4>
            <p class="text-sm text-purple-700">더 안정적인 분산투자</p>
            <p class="text-xs text-purple-600">변동성 감소</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 투자 추천 상품 -->
    <div class="bg-white shadow rounded-lg p-6 mb-8">
      <h3 class="text-lg font-medium text-gray-900 mb-4">💎 AI 추천 투자 상품</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-gray-900">글로벌 ETF</h4>
            <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">추천</span>
          </div>
          <p class="text-sm text-gray-600 mb-3">S&P 500 지수 추종 ETF</p>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">예상 수익률</span>
              <span class="font-medium text-green-600">+12%</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">리스크</span>
              <span class="font-medium text-yellow-600">중간</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">최소 투자</span>
              <span class="font-medium text-gray-900">₩100,000</span>
            </div>
          </div>
          <button class="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm">
            투자하기
          </button>
        </div>

        <div class="border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-gray-900">국채 ETF</h4>
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">안전</span>
          </div>
          <p class="text-sm text-gray-600 mb-3">한국 국채 지수 추종 ETF</p>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">예상 수익률</span>
              <span class="font-medium text-blue-600">+4%</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">리스크</span>
              <span class="font-medium text-green-600">낮음</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">최소 투자</span>
              <span class="font-medium text-gray-900">₩50,000</span>
            </div>
          </div>
          <button class="w-full mt-3 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm">
            투자하기
          </button>
        </div>

        <div class="border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-gray-900">테마 ETF</h4>
            <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">성장</span>
          </div>
          <p class="text-sm text-gray-600 mb-3">반도체 테마 ETF</p>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">예상 수익률</span>
              <span class="font-medium text-purple-600">+15%</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">리스크</span>
              <span class="font-medium text-red-600">높음</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">최소 투자</span>
              <span class="font-medium text-gray-900">₩200,000</span>
            </div>
          </div>
          <button class="w-full mt-3 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 text-sm">
            투자하기
          </button>
        </div>
      </div>
    </div>

    <!-- 투자 전략 -->
    <div class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 AI 투자 전략</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 class="font-semibold text-blue-900">단기 전략 (1-2년)</h4>
            <ul class="text-sm text-blue-700 mt-2 space-y-1">
              <li>• 글로벌 ETF 30% 투자</li>
              <li>• 국채 ETF 20% 투자</li>
              <li>• 현금 보유 50%</li>
            </ul>
          </div>
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 class="font-semibold text-green-900">중기 전략 (3-5년)</h4>
            <ul class="text-sm text-green-700 mt-2 space-y-1">
              <li>• 주식 50%, 채권 30%, ETF 20%</li>
              <li>• 분기별 리밸런싱</li>
              <li>• 테마 투자 10%</li>
            </ul>
          </div>
        </div>
        <div class="space-y-4">
          <div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="font-semibold text-purple-900">장기 전략 (5년+)</h4>
            <ul class="text-sm text-purple-700 mt-2 space-y-1">
              <li>• 주식 60%, 채권 25%, ETF 15%</li>
              <li>• 연간 리밸런싱</li>
              <li>• 글로벌 분산투자</li>
            </ul>
          </div>
          <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 class="font-semibold text-yellow-900">리스크 관리</h4>
            <ul class="text-sm text-yellow-700 mt-2 space-y-1">
              <li>• 손실 한도 설정</li>
              <li>• 분산투자 원칙</li>
              <li>• 정기적 모니터링</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 통합 자산 관리
- 모든 계좌 통합 조회
- 실시간 잔액 업데이트
- 거래 내역 자동 분류

### 2. AI 투자 조언
- 개인화된 포트폴리오 추천
- 리스크 분석 및 조정
- 시장 상황 반영

### 3. 예산 관리
- 카테고리별 예산 설정
- 실시간 지출 추적
- 예산 초과 알림

### 4. 금융 목표 달성
- 목표 설정 및 추적
- 자동 저축 계획
- 투자 성과 분석
