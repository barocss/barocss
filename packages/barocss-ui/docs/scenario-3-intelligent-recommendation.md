# 시나리오 3: 지능형 추천 시스템

## 개요
사용자의 구매 이력, 선호도, 행동 패턴을 분석하여 개인화된 상품을 추천하는 지능형 시스템입니다.

## 시나리오 플로우

### 1단계: 사용자 프로필 분석

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("내 구매 패턴을 분석해서 맞춤 상품을 추천해줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "내 구매 패턴을 분석해서 맞춤 상품을 추천해줘",
  sceneHistory: [
    // 이전 쇼핑몰 시나리오의 모든 Scene들...
    {
      id: "scene-7",
      type: "main",
      title: "개인화된 메인 페이지",
      userActions: [
        { type: "click", target: "view-product", data: { product: "iphone-15-pro" } },
        { type: "click", target: "add-to-cart", data: { product: "airpods-pro" } }
      ],
      formData: {
        cart: [
          { product: "iphone-15-pro", quantity: 1, price: 1350000 },
          { product: "airpods-pro", quantity: 1, price: 350000 }
        ]
      }
    }
  ],
  userSession: {
    userId: "john@example.com",
    purchaseHistory: [
      { product: "iphone-15-pro", price: 1350000, date: 1234567896, category: "electronics" },
      { product: "airpods-pro", price: 350000, date: 1234567897, category: "electronics" }
    ],
    preferences: {
      categories: ["electronics"],
      budgetRange: "premium",
      brandPreference: ["Apple"],
      purchaseFrequency: "monthly"
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- AI 분석 기반 추천 페이지 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">AI 추천 상품</h1>
        <div class="flex items-center space-x-4">
          <span class="text-gray-700">john@example.com님의 맞춤 추천</span>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- AI 분석 결과 -->
    <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-blue-900 mb-4">🤖 AI 분석 결과</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">구매 패턴</h3>
          <p class="text-sm text-gray-600">프리미엄 전자제품 선호</p>
          <p class="text-xs text-gray-500">Apple 브랜드 집중</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">예산 범위</h3>
          <p class="text-sm text-gray-600">₩500,000 - ₩2,000,000</p>
          <p class="text-xs text-gray-500">고가 제품 선호</p>
        </div>
        <div class="bg-white rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-gray-900">구매 빈도</h3>
          <p class="text-sm text-gray-600">월 1-2회</p>
          <p class="text-xs text-gray-500">정기적 구매</p>
        </div>
      </div>
    </div>

    <!-- 맞춤 추천 상품 -->
    <div class="mb-8">
      <h3 class="text-2xl font-bold text-gray-900 mb-6">🎯 당신을 위한 추천</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <!-- MacBook Pro 16" -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">AI 추천</div>
          <img src="/api/placeholder/300/200" alt="MacBook Pro 16" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">MacBook Pro 16"</h4>
            <p class="text-gray-600 text-sm">iPhone과 완벽한 생태계</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩3,200,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="macbook-pro-16">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 구매 패턴과 일치하는 상품
            </div>
          </div>
        </div>

        <!-- Apple Watch Ultra -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">AI 추천</div>
          <img src="/api/placeholder/300/200" alt="Apple Watch Ultra" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">Apple Watch Ultra</h4>
            <p class="text-gray-600 text-sm">iPhone과 연동되는 최고급 워치</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩1,250,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="apple-watch-ultra">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 선호 브랜드 상품
            </div>
          </div>
        </div>

        <!-- iPad Pro -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">AI 추천</div>
          <img src="/api/placeholder/300/200" alt="iPad Pro" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">iPad Pro 12.9"</h4>
            <p class="text-gray-600 text-sm">생산성을 높이는 태블릿</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩1,450,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="ipad-pro">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 예산 범위 내 상품
            </div>
          </div>
        </div>

        <!-- Studio Display -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">AI 추천</div>
          <img src="/api/placeholder/300/200" alt="Studio Display" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">Studio Display</h4>
            <p class="text-gray-600 text-sm">MacBook과 완벽한 조합</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩1,890,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="studio-display">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 생태계 완성 상품
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 추천 이유 설명 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">💡 추천 이유</h3>
      <div class="space-y-3">
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <span class="text-blue-600 text-sm">1</span>
          </div>
          <div>
            <p class="font-medium text-gray-900">Apple 생태계 완성</p>
            <p class="text-sm text-gray-600">iPhone, AirPods를 보유하고 계시므로 MacBook과 Apple Watch로 생태계를 완성하세요.</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <span class="text-blue-600 text-sm">2</span>
          </div>
          <div>
            <p class="font-medium text-gray-900">프리미엄 제품 선호</p>
            <p class="text-sm text-gray-600">고가 제품을 선호하시는 패턴을 분석하여 최고급 제품들을 추천했습니다.</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <span class="text-blue-600 text-sm">3</span>
          </div>
          <div>
            <p class="font-medium text-gray-900">생산성 향상</p>
            <p class="text-sm text-gray-600">MacBook과 iPad Pro 조합으로 업무 효율성을 극대화할 수 있습니다.</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### 2단계: 실시간 추천 업데이트

#### 사용자 액션
사용자가 MacBook Pro를 장바구니에 추가

#### Scene 상태 업데이트
```typescript
{
  "scene-1": {
    userActions: [
      { type: "click", target: "add-to-cart", data: { product: "macbook-pro-16" }, timestamp: 1234567898 }
    ],
    formData: {
      cart: [
        { product: "iphone-15-pro", quantity: 1, price: 1350000 },
        { product: "airpods-pro", quantity: 1, price: 350000 },
        { product: "macbook-pro-16", quantity: 1, price: 3200000 }
      ]
    },
    uiState: { currentView: "recommendations", cartUpdated: true }
  }
}
```

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("장바구니에 MacBook을 추가했어. 이제 액세서리나 추가 상품을 추천해줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "장바구니에 MacBook을 추가했어. 이제 액세서리나 추가 상품을 추천해줘",
  sceneHistory: [
    // ... 이전 Scene들
    {
      id: "scene-1",
      type: "recommendations",
      title: "AI 추천 상품",
      userActions: [
        { type: "click", target: "add-to-cart", data: { product: "macbook-pro-16" } }
      ],
      formData: {
        cart: [
          { product: "iphone-15-pro", quantity: 1, price: 1350000 },
          { product: "airpods-pro", quantity: 1, price: 350000 },
          { product: "macbook-pro-16", quantity: 1, price: 3200000 }
        ]
      }
    }
  ],
  userSession: {
    userId: "john@example.com",
    purchaseHistory: [
      { product: "iphone-15-pro", price: 1350000, date: 1234567896, category: "electronics" },
      { product: "airpods-pro", price: 350000, date: 1234567897, category: "electronics" }
    ],
    currentCart: [
      { product: "iphone-15-pro", quantity: 1, price: 1350000 },
      { product: "airpods-pro", quantity: 1, price: 350000 },
      { product: "macbook-pro-16", quantity: 1, price: 3200000 }
    ],
    preferences: {
      categories: ["electronics"],
      budgetRange: "premium",
      brandPreference: ["Apple"],
      purchaseFrequency: "monthly"
    }
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- MacBook 액세서리 추천 페이지 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 현재 장바구니 -->
    <div class="mb-8 bg-green-50 border border-green-200 rounded-lg p-6">
      <h2 class="text-xl font-bold text-green-900 mb-4">✅ 장바구니에 추가됨</h2>
      <div class="flex items-center space-x-4">
        <img src="/api/placeholder/80/80" alt="MacBook Pro" class="w-20 h-20 object-cover rounded">
        <div>
          <h3 class="font-semibold text-lg">MacBook Pro 16"</h3>
          <p class="text-green-700">₩3,200,000</p>
        </div>
      </div>
    </div>

    <!-- MacBook 액세서리 추천 -->
    <div class="mb-8">
      <h3 class="text-2xl font-bold text-gray-900 mb-6">🔧 MacBook 액세서리 추천</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <!-- Magic Mouse -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">완벽한 조합</div>
          <img src="/api/placeholder/300/200" alt="Magic Mouse" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">Magic Mouse</h4>
            <p class="text-gray-600 text-sm">MacBook과 완벽한 조합</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩89,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="magic-mouse">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ MacBook과 함께 사용하면 완벽
            </div>
          </div>
        </div>

        <!-- Magic Keyboard -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">완벽한 조합</div>
          <img src="/api/placeholder/300/200" alt="Magic Keyboard" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">Magic Keyboard</h4>
            <p class="text-gray-600 text-sm">외부 키보드로 편안한 타이핑</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩159,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="magic-keyboard">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 데스크톱 환경 완성
            </div>
          </div>
        </div>

        <!-- Thunderbolt 4 Hub -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">생산성 향상</div>
          <img src="/api/placeholder/300/200" alt="Thunderbolt Hub" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">Thunderbolt 4 Hub</h4>
            <p class="text-gray-600 text-sm">다양한 외부 기기 연결</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩299,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="thunderbolt-hub">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 확장성 극대화
            </div>
          </div>
        </div>

        <!-- MacBook 케이스 -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden border-2 border-blue-200">
          <div class="bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">보호 필수</div>
          <img src="/api/placeholder/300/200" alt="MacBook Case" class="w-full h-48 object-cover">
          <div class="p-4">
            <h4 class="font-semibold text-lg">MacBook Pro 케이스</h4>
            <p class="text-gray-600 text-sm">고가 제품 보호 필수</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩45,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm" 
                      data-action="add-to-cart" data-product="macbook-case">
                장바구니
              </button>
            </div>
            <div class="mt-2 text-xs text-green-600">
              ✓ 투자 보호 필수
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 번들 추천 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">🎁 번들 추천</h3>
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-semibold text-purple-900">MacBook Pro 완벽 세트</h4>
            <p class="text-sm text-purple-700">MacBook + Magic Mouse + Magic Keyboard + 케이스</p>
            <p class="text-xs text-purple-600">개별 구매 대비 15% 할인</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-purple-900">₩3,492,000</p>
            <p class="text-sm text-purple-600 line-through">₩4,108,000</p>
            <button class="mt-2 bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700" 
                    data-action="add-bundle" data-bundle="macbook-complete">
              번들 구매
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 실시간 학습
- 사용자 행동을 실시간으로 분석
- 구매 패턴 변화에 즉시 대응
- 개인화 수준 지속적 향상

### 2. 컨텍스트 기반 추천
- 현재 장바구니 상태 고려
- 이전 구매 이력 반영
- 브랜드 선호도 분석

### 3. 지능형 번들링
- 관련 상품 자동 그룹화
- 할인 혜택 자동 계산
- 사용자 만족도 최적화

### 4. 예측적 추천
- 다음 구매 가능성 예측
- 계절성 상품 추천
- 트렌드 반영 추천
