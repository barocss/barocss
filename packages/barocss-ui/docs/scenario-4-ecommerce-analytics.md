# 시나리오 4: 전자상거래 분석 대시보드

## 개요
사용자의 구매 데이터를 분석하여 인사이트를 제공하고, 비즈니스 의사결정을 지원하는 분석 대시보드입니다.

## 시나리오 플로우

### 1단계: 분석 대시보드 생성

#### 사용자 요청
```typescript
const scene1 = await director.request("내 쇼핑 데이터를 분석해서 인사이트를 보여줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "내 쇼핑 데이터를 분석해서 인사이트를 보여줘",
  sceneHistory: [
    // 이전 모든 쇼핑 시나리오들...
  ],
  userSession: {
    userId: "john@example.com",
    purchaseHistory: [
      { product: "iphone-15-pro", price: 1350000, date: 1234567896, category: "electronics" },
      { product: "airpods-pro", price: 350000, date: 1234567897, category: "electronics" },
      { product: "macbook-pro-16", price: 3200000, date: 1234567898, category: "electronics" },
      { product: "magic-mouse", price: 89000, date: 1234567899, category: "accessories" }
    ],
    totalSpent: 5029000,
    averageOrderValue: 1257250,
    purchaseFrequency: "weekly",
    preferredCategories: ["electronics", "accessories"],
    brandPreference: ["Apple"]
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 분석 대시보드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">📊 구매 분석 대시보드</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">john@example.com님의 데이터</span>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 주요 지표 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <span class="text-white text-sm font-bold">₩</span>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">총 구매액</dt>
                <dd class="text-lg font-medium text-gray-900">₩5,029,000</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <span class="text-white text-sm font-bold">📦</span>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">총 주문 수</dt>
                <dd class="text-lg font-medium text-gray-900">4건</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                <span class="text-white text-sm font-bold">📈</span>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">평균 주문액</dt>
                <dd class="text-lg font-medium text-gray-900">₩1,257,250</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                <span class="text-white text-sm font-bold">🔄</span>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">구매 빈도</dt>
                <dd class="text-lg font-medium text-gray-900">주 1회</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 구매 트렌드 차트 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📈 구매 트렌드</h3>
        <div class="h-64 flex items-center justify-center bg-gray-50 rounded">
          <div class="text-center">
            <div class="text-4xl mb-2">📊</div>
            <p class="text-gray-600">월별 구매 금액 차트</p>
            <p class="text-sm text-gray-500">최근 3개월간 지속적인 구매 증가</p>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">🏷️ 카테고리별 구매</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-blue-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-900">전자제품</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">₩4,900,000</div>
              <div class="text-xs text-gray-500">97.4%</div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <span class="text-sm font-medium text-gray-900">액세서리</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">₩89,000</div>
              <div class="text-xs text-gray-500">1.8%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 브랜드 분석 -->
    <div class="bg-white shadow rounded-lg p-6 mb-8">
      <h3 class="text-lg font-medium text-gray-900 mb-4">🏢 브랜드 선호도</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">🍎</span>
          </div>
          <h4 class="font-semibold text-gray-900">Apple</h4>
          <p class="text-sm text-gray-600">100%</p>
          <p class="text-xs text-gray-500">모든 구매가 Apple 제품</p>
        </div>
        <div class="text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">📱</span>
          </div>
          <h4 class="font-semibold text-gray-900">전자제품</h4>
          <p class="text-sm text-gray-600">97.4%</p>
          <p class="text-xs text-gray-500">주요 구매 카테고리</p>
        </div>
        <div class="text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-2xl">💎</span>
          </div>
          <h4 class="font-semibold text-gray-900">프리미엄</h4>
          <p class="text-sm text-gray-600">100%</p>
          <p class="text-xs text-gray-500">고가 제품 선호</p>
        </div>
      </div>
    </div>

    <!-- AI 인사이트 -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-blue-900 mb-4">🤖 AI 분석 인사이트</h3>
      <div class="space-y-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h4 class="font-semibold text-gray-900 mb-2">💡 구매 패턴 분석</h4>
          <p class="text-sm text-gray-700">Apple 생태계에 집중하는 프리미엄 구매자입니다. 주 1회 꾸준한 구매로 안정적인 고객군에 속합니다.</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h4 class="font-semibold text-gray-900 mb-2">📊 예측 분석</h4>
          <p class="text-sm text-gray-700">다음 구매 가능성: iPad Pro (85%), Apple Watch (70%), Studio Display (60%)</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h4 class="font-semibold text-gray-900 mb-2">🎯 추천 전략</h4>
          <p class="text-sm text-gray-700">Apple 생태계 완성을 위한 액세서리와 추가 기기 추천이 효과적일 것으로 예상됩니다.</p>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 상세 분석 리포트

#### 사용자 액션
사용자가 "더 자세한 분석을 보고 싶어" 클릭

#### AI 요청
```typescript
const scene2 = await director.request("더 자세한 구매 분석 리포트를 만들어줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 상세 분석 리포트 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 구매 이력 상세 -->
    <div class="bg-white shadow rounded-lg p-6 mb-8">
      <h3 class="text-lg font-medium text-gray-900 mb-4">📋 구매 이력 상세</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구매일</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">만족도</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <img class="h-10 w-10 rounded-full" src="/api/placeholder/40/40" alt="iPhone">
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">iPhone 15 Pro</div>
                    <div class="text-sm text-gray-500">Apple</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">전자제품</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₩1,350,000</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2024-01-15</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ⭐⭐⭐⭐⭐
                </span>
              </td>
            </tr>
            <!-- 다른 상품들... -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- 월별 구매 분석 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">📅 월별 구매 분석</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">1월</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 100%"></div>
              </div>
              <span class="text-sm text-gray-600">₩5,029,000</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">12월</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
              </div>
              <span class="text-sm text-gray-600">₩0</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white shadow rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">💰 가격대별 구매</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">₩1,000,000+</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-green-600 h-2 rounded-full" style="width: 75%"></div>
              </div>
              <span class="text-sm text-gray-600">3건</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-900">₩100,000-999,999</span>
            <div class="flex items-center">
              <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-yellow-600 h-2 rounded-full" style="width: 25%"></div>
              </div>
              <span class="text-sm text-gray-600">1건</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 추천 액션 -->
    <div class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">🎯 AI 추천 액션</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-2">💳 결제 최적화</h4>
          <p class="text-sm text-gray-600 mb-3">할인 혜택을 최대한 활용하세요</p>
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
            할인 쿠폰 확인
          </button>
        </div>
        <div class="border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-2">📦 번들 구매</h4>
          <p class="text-sm text-gray-600 mb-3">관련 상품을 함께 구매하면 할인</p>
          <button class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
            번들 상품 보기
          </button>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 실시간 데이터 분석
- 구매 패턴 실시간 분석
- 트렌드 변화 즉시 감지
- 개인화된 인사이트 제공

### 2. 예측 분석
- 다음 구매 가능성 예측
- 구매 시기 추천
- 가격 변동 예측

### 3. 액션 가능한 인사이트
- 구체적인 추천 액션 제공
- 할인 기회 알림
- 구매 최적화 제안

### 4. 시각적 데이터 표현
- 직관적인 차트와 그래프
- 색상 코딩을 통한 구분
- 반응형 디자인
