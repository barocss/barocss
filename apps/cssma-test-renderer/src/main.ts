import { createContext, generateCss, defaultTheme, StyleRuntime } from 'cssma-v4';

const runtime = new StyleRuntime();
runtime.observe(document.body, { scan: true });

const ctx = createContext({
    theme: defaultTheme
})

// 테스트 케이스들
const testCases = [
    {
        title: '기본 스타일링',
        classes: 'bg-blue-500 text-white p-4 rounded-lg',
        description: '배경색, 텍스트 색상, 패딩, 둥근 모서리'
    },
    {
        title: '그라디언트 & 애니메이션',
        classes: 'bg-linear-to-r from-purple-500 to-pink-500 animate-pulse',
        description: '그라디언트 배경과 펄스 애니메이션'
    },
    {
        title: '플렉스박스 레이아웃',
        classes: 'flex items-center justify-between p-6 bg-gray-100 rounded-xl',
        description: '플렉스박스를 이용한 레이아웃'
    },
    {
        title: '호버 효과',
        classes: 'bg-green-500 hover:bg-green-600 text-white p-3 rounded transition-colors duration-200',
        description: '호버 시 색상 변경과 트랜지션'
    },
    {
        title: '그리드 레이아웃',
        classes: 'grid grid-cols-3 gap-4 p-4 bg-gray-50',
        description: '3열 그리드 레이아웃'
    },
    {
        title: '반응형 디자인',
        classes: 'w-full md:w-1/2 lg:w-1/3 p-4 bg-indigo-500 text-white',
        description: '반응형 너비 조정'
    },
    {
        title: '복잡한 조합',
        classes: 'relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white p-8 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300',
        description: '여러 효과의 복합적 사용'
    }
];

// 클래스를 CSS로 변환하고 적용하는 함수
function renderClasses(classes: string, targetElement: HTMLElement, cssDisplayElement: HTMLElement) {
    try {

        targetElement.className = classes;

        // CSSMA를 사용해 CSS 생성
        const css = generateCss(classes, ctx);
        
        // CSS 표시
        cssDisplayElement.textContent = css || '생성된 CSS가 없습니다.';
        
        return css;
    } catch (error) {
        console.error('CSS 생성 중 오류:', error);
        cssDisplayElement.textContent = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        return '';
    }
}

// 실시간 입력 처리
function setupLiveTest() {
    const classInput = document.getElementById('classInput') as HTMLInputElement;
    const testElement = document.getElementById('testElement') as HTMLElement;
    const generatedCss = document.getElementById('generatedCss') as HTMLElement;
    
    if (!classInput || !testElement || !generatedCss) {
        console.error('필요한 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 초기 렌더링
    renderClasses(classInput.value, testElement, generatedCss);
    
    // 입력 이벤트 리스너
    classInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        renderClasses(target.value, testElement, generatedCss);
    });
}

// 테스트 케이스 UI 생성
function setupTestCases() {
    const testCasesContainer = document.getElementById('testCases');
    if (!testCasesContainer) return;
    
    testCases.forEach((testCase, index) => {
        const caseElement = document.createElement('div');
        caseElement.style.cssText = `
            margin-bottom: 2rem;
            padding: 1rem;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #fafafa;
        `;
        
        caseElement.innerHTML = `
            <h4 style="margin: 0 0 0.5rem 0; color: #333;">${testCase.title}</h4>
            <p style="margin: 0 0 1rem 0; color: #666; font-size: 0.9em;">${testCase.description}</p>
            <code style="display: block; background: #f0f0f0; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; font-family: monospace; word-break: break-all;">
                ${testCase.classes}
            </code>
            <div class="test-render-${index}" style="min-height: 60px; padding: 1rem; border: 1px dashed #ccc; border-radius: 4px; margin-bottom: 1rem;">
                <div class="test-element-${index}">테스트 요소</div>
            </div>
            <details style="margin-top: 1rem;">
                <summary style="cursor: pointer; font-weight: bold;">생성된 CSS 보기</summary>
                <pre class="test-css-${index}" style="background: #f8f8f8; padding: 1rem; border-radius: 4px; font-family: monospace; font-size: 0.8em; white-space: pre-wrap; margin-top: 0.5rem; max-height: 200px; overflow-y: auto;"></pre>
            </details>
        `;
        
        testCasesContainer.appendChild(caseElement);
        
        // 테스트 케이스 렌더링
        const testElement = caseElement.querySelector(`.test-element-${index}`) as HTMLElement;
        const cssElement = caseElement.querySelector(`.test-css-${index}`) as HTMLElement;
        
        if (testElement && cssElement) {
            renderClasses(testCase.classes, testElement, cssElement);
        }
    });
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 CSSMA-v4 Test Renderer 시작');
    setupLiveTest();
    setupTestCases();
});