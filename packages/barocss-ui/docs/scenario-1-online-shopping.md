# 시나리오 1: 온라인 쇼핑몰

## 개요
사용자가 온라인 쇼핑몰에서 상품을 검색하고, 장바구니에 추가하며, 결제까지 완료하는 전형적인 전자상거래 시나리오입니다.

## 시나리오 플로우

### 1단계: 메인 페이지 진입

#### 사용자 요청
```typescript
const scene1 = await director.request("온라인 쇼핑몰을 만들어줘. 상품을 검색하고 구매할 수 있게 해줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "온라인 쇼핑몰을 만들어줘. 상품을 검색하고 구매할 수 있게 해줘",
  sceneHistory: [],
  userSession: {
    userId: "anonymous",
    preferences: {
      language: "ko",
      currency: "KRW",
      theme: "light"
    },
    cart: [],
    wishlist: [],
    recentSearches: []
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 온라인 쇼핑몰 메인 페이지 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">🛍️ AI 쇼핑몰</h1>
        <div class="flex items-center space-x-4">
          <button class="text-gray-700 hover:text-gray-900" 
                  data-action="show-login">로그인</button>
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                  data-action="show-register">회원가입</button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 검색 바 -->
    <div class="mb-8">
      <div class="flex">
        <input type="text" placeholder="상품을 검색하세요..." 
               class="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               data-action="search-products">
        <button class="bg-blue-600 text-white px-6 py-2 rounded-r-md hover:bg-blue-700" 
                data-action="search-products">
          검색
        </button>
      </div>
    </div>

    <!-- 카테고리 -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">카테고리</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
             data-action="filter-category" data-category="electronics">
          <div class="text-4xl mb-2">📱</div>
          <div class="text-sm font-medium">전자제품</div>
        </div>
        <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
             data-action="filter-category" data-category="clothing">
          <div class="text-4xl mb-2">👕</div>
          <div class="text-sm font-medium">의류</div>
        </div>
        <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
             data-action="filter-category" data-category="home">
          <div class="text-4xl mb-2">🏠</div>
          <div class="text-sm font-medium">홈&리빙</div>
        </div>
        <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
             data-action="filter-category" data-category="books">
          <div class="text-4xl mb-2">📚</div>
          <div class="text-sm font-medium">도서</div>
        </div>
        <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
             data-action="filter-category" data-category="sports">
          <div class="text-4xl mb-2">⚽</div>
          <div class="text-sm font-medium">스포츠</div>
        </div>
        <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
             data-action="filter-category" data-category="beauty">
          <div class="text-4xl mb-2">💄</div>
          <div class="text-sm font-medium">뷰티</div>
        </div>
      </div>
    </div>

    <!-- 인기 상품 -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">인기 상품</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <img src="/api/placeholder/300/200" alt="iPhone 15 Pro" class="w-full h-48 object-cover">
          <div class="p-4">
            <h3 class="font-semibold text-lg">iPhone 15 Pro</h3>
            <p class="text-gray-600">Apple</p>
            <div class="mt-2 flex justify-between items-center">
              <span class="text-xl font-bold text-blue-600">₩1,350,000</span>
              <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                      data-action="add-to-cart" data-product="iphone-15-pro">
                장바구니
              </button>
            </div>
          </div>
        </div>
        <!-- 다른 상품들... -->
      </div>
    </div>
  </main>
</div>
```

### 2단계: 상품 검색 및 필터링

#### 사용자 액션
사용자가 "전자제품" 카테고리 클릭

#### AI 요청
```typescript
const scene2 = await director.request("전자제품 카테고리의 상품들을 보여줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 전자제품 카테고리 페이지 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 필터 및 정렬 -->
    <div class="mb-8 bg-white p-4 rounded-lg shadow">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center space-x-4">
          <span class="text-sm font-medium text-gray-700">필터:</span>
          <select class="px-3 py-2 border border-gray-300 rounded-md" data-action="filter-price">
            <option value="">가격대</option>
            <option value="0-100000">10만원 이하</option>
            <option value="100000-500000">10-50만원</option>
            <option value="500000-1000000">50-100만원</option>
            <option value="1000000+">100만원 이상</option>
          </select>
          <select class="px-3 py-2 border border-gray-300 rounded-md" data-action="filter-brand">
            <option value="">브랜드</option>
            <option value="apple">Apple</option>
            <option value="samsung">Samsung</option>
            <option value="lg">LG</option>
          </select>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm font-medium text-gray-700">정렬:</span>
          <select class="px-3 py-2 border border-gray-300 rounded-md" data-action="sort-products">
            <option value="popularity">인기순</option>
            <option value="price-low">가격 낮은순</option>
            <option value="price-high">가격 높은순</option>
            <option value="newest">최신순</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 상품 목록 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow-md overflow-hidden">
        <img src="/api/placeholder/300/200" alt="iPhone 15 Pro" class="w-full h-48 object-cover">
        <div class="p-4">
          <h3 class="font-semibold text-lg">iPhone 15 Pro</h3>
          <p class="text-gray-600">Apple</p>
          <div class="mt-2 flex justify-between items-center">
            <span class="text-xl font-bold text-blue-600">₩1,350,000</span>
            <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                    data-action="add-to-cart" data-product="iphone-15-pro">
              장바구니
            </button>
          </div>
        </div>
      </div>
      <!-- 다른 전자제품들... -->
    </div>
  </main>
</div>
```

### 3단계: 장바구니 및 결제

#### 사용자 액션
사용자가 iPhone 15 Pro를 장바구니에 추가

#### AI 요청
```typescript
const scene3 = await director.request("iPhone 15 Pro를 장바구니에 추가했어. 장바구니를 보여줘");
```

#### AI 응답 및 생성된 UI
```html
<!-- 장바구니 페이지 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <!-- ... 헤더 내용 ... -->
  </header>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">장바구니</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 장바구니 아이템 -->
      <div class="lg:col-span-2">
        <div class="bg-white shadow rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">장바구니 아이템</h2>
            <span class="text-sm text-gray-600">1개 상품</span>
          </div>
          
          <div class="space-y-4">
            <div class="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
              <img src="/api/placeholder/100/100" alt="iPhone 15 Pro" class="w-20 h-20 object-cover rounded">
              <div class="flex-1">
                <h3 class="font-semibold text-lg">iPhone 15 Pro</h3>
                <p class="text-gray-600">Apple</p>
                <div class="flex items-center space-x-4 mt-2">
                  <div class="flex items-center space-x-2">
                    <button class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center" 
                            data-action="decrease-quantity" data-product="iphone-15-pro">-</button>
                    <span class="w-8 text-center">1</span>
                    <button class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center" 
                            data-action="increase-quantity" data-product="iphone-15-pro">+</button>
                  </div>
                  <span class="text-lg font-semibold">₩1,350,000</span>
                </div>
              </div>
              <button class="text-red-600 hover:text-red-800" 
                      data-action="remove-from-cart" data-product="iphone-15-pro">
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 주문 요약 -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">주문 요약</h2>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600">상품 금액</span>
            <span class="font-semibold">₩1,350,000</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">배송비</span>
            <span class="font-semibold">₩3,000</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">할인</span>
            <span class="font-semibold text-green-600">-₩0</span>
          </div>
          <hr>
          <div class="flex justify-between text-lg font-bold">
            <span>총 결제금액</span>
            <span>₩1,353,000</span>
          </div>
        </div>
        
        <button class="w-full mt-6 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 font-semibold" 
                data-action="proceed-to-checkout">
          결제하기
        </button>
      </div>
    </div>
  </main>
</div>
```

## 핵심 특징

### 1. 직관적인 상품 탐색
- 카테고리별 상품 분류
- 실시간 검색 및 필터링
- 상품 상세 정보 제공

### 2. 스마트 장바구니
- 실시간 가격 계산
- 수량 조절 기능
- 상품 추가/제거

### 3. 원활한 결제 프로세스
- 단계별 결제 안내
- 다양한 결제 수단 지원
- 주문 확인 및 추적
