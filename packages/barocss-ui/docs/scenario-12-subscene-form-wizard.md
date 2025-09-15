# 시나리오 12: SubScene 폼 위저드

## 개요
복잡한 다단계 폼을 SubScene으로 나누어 각 단계별로 독립적으로 관리하고, 사용자가 단계를 자유롭게 이동하며 수정할 수 있는 폼 위저드 시스템입니다.

## 시나리오 플로우

### 1단계: 폼 위저드 시작

#### 사용자 요청
```typescript
const scene1 = await aiAgentOS.request("사용자 등록 폼을 만들어줘. 여러 단계로 나누어서 단계별로 입력할 수 있게 해줘");
```

#### AI가 받는 컨텍스트
```typescript
{
  currentInput: "사용자 등록 폼을 만들어줘. 여러 단계로 나누어서 단계별로 입력할 수 있게 해줘",
  sceneHistory: [],
  userSession: {
    userId: "anonymous",
    formData: {},
    currentStep: 1,
    totalSteps: 4,
    completedSteps: []
  }
}
```

#### AI 응답 및 생성된 UI
```html
<!-- 사용자 등록 폼 위저드 -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <h1 class="text-3xl font-bold text-gray-900">👤 사용자 등록</h1>
        <div class="text-sm text-gray-600">
          <span class="font-medium">1단계</span> / 4단계
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
    <!-- 진행 단계 표시 -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
            <span class="ml-2 text-sm font-medium text-gray-900">기본 정보</span>
          </div>
          <div class="w-16 h-1 bg-gray-200 rounded"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
            <span class="ml-2 text-sm text-gray-500">연락처</span>
          </div>
          <div class="w-16 h-1 bg-gray-200 rounded"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
            <span class="ml-2 text-sm text-gray-500">선호도</span>
          </div>
          <div class="w-16 h-1 bg-gray-200 rounded"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
            <span class="ml-2 text-sm text-gray-500">확인</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 폼 컨테이너 -->
    <div class="bg-white shadow rounded-lg p-8">
      <!-- SubScene 1: 기본 정보 -->
      <div data-subscene="form-step-1" data-step="1" class="form-step">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">기본 정보 입력</h2>
        
        <form data-action="step-1-submit" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">이름</label>
              <input type="text" name="firstName" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                     placeholder="이름을 입력하세요">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">성</label>
              <input type="text" name="lastName" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                     placeholder="성을 입력하세요">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input type="email" name="email" required 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                   placeholder="이메일을 입력하세요">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">생년월일</label>
            <input type="date" name="birthDate" required 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">성별</label>
            <div class="flex space-x-4">
              <label class="flex items-center">
                <input type="radio" name="gender" value="male" class="mr-2">
                <span class="text-sm text-gray-700">남성</span>
              </label>
              <label class="flex items-center">
                <input type="radio" name="gender" value="female" class="mr-2">
                <span class="text-sm text-gray-700">여성</span>
              </label>
              <label class="flex items-center">
                <input type="radio" name="gender" value="other" class="mr-2">
                <span class="text-sm text-gray-700">기타</span>
              </label>
            </div>
          </div>

          <div class="flex justify-end">
            <button type="submit" 
                    class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
              다음 단계
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</div>
```

### 2단계: SubScene 업데이트 - 연락처 정보

#### 사용자 액션
사용자가 1단계 폼을 제출

#### AI 요청
```typescript
const scene2 = await aiAgentOS.request("1단계가 완료되었어. 2단계 연락처 정보 입력 폼으로 업데이트해줘");
```

#### AI 응답 및 SubScene 업데이트
```html
<!-- SubScene 업데이트: 2단계 연락처 정보 -->
<div data-subscene="form-step-2" data-step="2" class="form-step">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">연락처 정보 입력</h2>
  
  <form data-action="step-2-submit" class="space-y-6">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
      <input type="tel" name="phone" required 
             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
             placeholder="010-1234-5678">
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">주소</label>
      <div class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" name="postalCode" 
                 class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                 placeholder="우편번호">
          <button type="button" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
            주소 검색
          </button>
        </div>
        <input type="text" name="address1" 
               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               placeholder="기본 주소">
        <input type="text" name="address2" 
               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               placeholder="상세 주소">
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">비상연락처</label>
      <input type="tel" name="emergencyContact" 
             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
             placeholder="비상연락처 전화번호">
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">연락처 공개 설정</label>
      <div class="space-y-2">
        <label class="flex items-center">
          <input type="checkbox" name="phonePublic" class="mr-2">
          <span class="text-sm text-gray-700">전화번호 공개</span>
        </label>
        <label class="flex items-center">
          <input type="checkbox" name="emailPublic" class="mr-2">
          <span class="text-sm text-gray-700">이메일 공개</span>
        </label>
      </div>
    </div>

    <div class="flex justify-between">
      <button type="button" 
              class="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
              data-action="go-to-step" data-step="1">
        이전 단계
      </button>
      <button type="submit" 
              class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
        다음 단계
      </button>
    </div>
  </form>
</div>
```

### 3단계: SubScene 업데이트 - 선호도 설정

#### 사용자 액션
사용자가 2단계 폼을 제출

#### AI 요청
```typescript
const scene3 = await aiAgentOS.request("2단계가 완료되었어. 3단계 선호도 설정 폼으로 업데이트해줘");
```

#### AI 응답 및 SubScene 업데이트
```html
<!-- SubScene 업데이트: 3단계 선호도 설정 -->
<div data-subscene="form-step-3" data-step="3" class="form-step">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">선호도 설정</h2>
  
  <form data-action="step-3-submit" class="space-y-6">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">관심 분야</label>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label class="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" name="interests" value="technology" class="mr-2">
          <span class="text-sm text-gray-700">기술</span>
        </label>
        <label class="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" name="interests" value="business" class="mr-2">
          <span class="text-sm text-gray-700">비즈니스</span>
        </label>
        <label class="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" name="interests" value="design" class="mr-2">
          <span class="text-sm text-gray-700">디자인</span>
        </label>
        <label class="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" name="interests" value="marketing" class="mr-2">
          <span class="text-sm text-gray-700">마케팅</span>
        </label>
        <label class="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" name="interests" value="education" class="mr-2">
          <span class="text-sm text-gray-700">교육</span>
        </label>
        <label class="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" name="interests" value="health" class="mr-2">
          <span class="text-sm text-gray-700">건강</span>
        </label>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">알림 설정</label>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">이메일 알림</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="emailNotifications" class="sr-only peer" checked>
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">SMS 알림</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="smsNotifications" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">푸시 알림</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="pushNotifications" class="sr-only peer" checked>
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">언어 설정</label>
      <select name="language" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
        <option value="zh">中文</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">시간대</label>
      <select name="timezone" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
        <option value="Asia/Seoul">한국 표준시 (UTC+9)</option>
        <option value="America/New_York">미국 동부 (UTC-5)</option>
        <option value="Europe/London">영국 (UTC+0)</option>
        <option value="Asia/Tokyo">일본 표준시 (UTC+9)</option>
      </select>
    </div>

    <div class="flex justify-between">
      <button type="button" 
              class="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
              data-action="go-to-step" data-step="2">
        이전 단계
      </button>
      <button type="submit" 
              class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
        다음 단계
      </button>
    </div>
  </form>
</div>
```

### 4단계: SubScene 업데이트 - 최종 확인

#### 사용자 액션
사용자가 3단계 폼을 제출

#### AI 요청
```typescript
const scene4 = await aiAgentOS.request("3단계가 완료되었어. 4단계 최종 확인 페이지로 업데이트해줘");
```

#### AI 응답 및 SubScene 업데이트
```html
<!-- SubScene 업데이트: 4단계 최종 확인 -->
<div data-subscene="form-step-4" data-step="4" class="form-step">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">정보 확인</h2>
  
  <div class="space-y-6">
    <!-- 기본 정보 요약 -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">기본 정보</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span class="text-sm text-gray-600">이름:</span>
          <span class="ml-2 font-medium" data-field="firstName">홍길동</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">이메일:</span>
          <span class="ml-2 font-medium" data-field="email">hong@example.com</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">생년월일:</span>
          <span class="ml-2 font-medium" data-field="birthDate">1990-01-01</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">성별:</span>
          <span class="ml-2 font-medium" data-field="gender">남성</span>
        </div>
      </div>
    </div>

    <!-- 연락처 정보 요약 -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">연락처 정보</h3>
      <div class="space-y-2">
        <div>
          <span class="text-sm text-gray-600">전화번호:</span>
          <span class="ml-2 font-medium" data-field="phone">010-1234-5678</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">주소:</span>
          <span class="ml-2 font-medium" data-field="address">서울시 강남구 테헤란로 123</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">비상연락처:</span>
          <span class="ml-2 font-medium" data-field="emergencyContact">010-9876-5432</span>
        </div>
      </div>
    </div>

    <!-- 선호도 요약 -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">선호도 설정</h3>
      <div class="space-y-2">
        <div>
          <span class="text-sm text-gray-600">관심 분야:</span>
          <span class="ml-2 font-medium" data-field="interests">기술, 비즈니스, 디자인</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">알림 설정:</span>
          <span class="ml-2 font-medium" data-field="notifications">이메일, 푸시 알림</span>
        </div>
        <div>
          <span class="text-sm text-gray-600">언어:</span>
          <span class="ml-2 font-medium" data-field="language">한국어</span>
        </div>
      </div>
    </div>

    <!-- 수정 버튼들 -->
    <div class="flex flex-wrap gap-2">
      <button class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
              data-action="go-to-step" data-step="1">
        기본 정보 수정
      </button>
      <button class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
              data-action="go-to-step" data-step="2">
        연락처 수정
      </button>
      <button class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
              data-action="go-to-step" data-step="3">
        선호도 수정
      </button>
    </div>

    <!-- 최종 제출 -->
    <div class="flex justify-between pt-6 border-t border-gray-200">
      <button type="button" 
              class="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
              data-action="go-to-step" data-step="3">
        이전 단계
      </button>
      <button type="button" 
              class="bg-green-600 text-white px-8 py-2 rounded-md hover:bg-green-700"
              data-action="submit-form">
        등록 완료
      </button>
    </div>
  </div>
</div>
```

## 핵심 특징

### 1. 단계별 SubScene 관리
- **독립적 상태**: 각 단계가 독립적으로 폼 데이터 관리
- **유연한 이동**: 사용자가 이전 단계로 자유롭게 이동 가능
- **진행률 표시**: 현재 단계와 전체 진행률 시각화

### 2. 폼 데이터 지속성
- **상태 보존**: 단계 이동 시 입력된 데이터 유지
- **실시간 검증**: 각 단계별 실시간 유효성 검사
- **자동 저장**: 사용자 입력 자동 저장 및 복원

### 3. 사용자 경험 최적화
- **부드러운 전환**: 단계 간 자연스러운 애니메이션
- **명확한 안내**: 각 단계별 명확한 설명과 가이드
- **오류 처리**: 입력 오류 시 친화적인 피드백

### 4. SubScene 업데이트 패턴
```typescript
// 단계별 SubScene 업데이트
aiAgentOS.updateSubScene('form-step-2', {
  step: 2,
  formData: step1Data,
  validation: step2Validation
});

// 이전 단계로 이동
aiAgentOS.updateSubScene('form-step-1', {
  step: 1,
  formData: preservedData,
  allowEdit: true
});
```

이러한 폼 위저드 패턴은 복잡한 등록 프로세스나 설정 과정에서 사용자 경험을 크게 향상시킬 수 있습니다.
