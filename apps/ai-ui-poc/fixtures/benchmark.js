// Fixed prompts and expected text. The mock turns these records into UI JSON.
// Three repeats per record test the local pipeline, not model generation quality.
const cases = [
  ['01', '환영 제목을 보여 주세요', '환영합니다', '첫 화면', 'simple', 'desktop'],
  ['02', '신규 기능 안내를 보여 주세요', '새 기능', '바로 시작할 수 있습니다', 'card', 'desktop'],
  ['03', '가입 안내와 버튼을 보여 주세요', '가입 안내', '계정을 만들 준비가 됐습니다', 'button', 'mobile'],
  ['04', '상품 요약 카드를 보여 주세요', '상품 요약', '핵심 정보를 확인하세요', 'card', 'desktop'],
  ['05', '사진 안내를 보여 주세요', '사진 안내', '등록된 이미지 미리보기', 'image', 'mobile'],
  ['06', '도움말 첫 화면을 보여 주세요', '도움말', '필요한 항목을 찾으세요', 'simple', 'desktop'],
  ['07', '일정 안내를 보여 주세요', '일정 안내', '오늘 할 일을 확인하세요', 'grid', 'desktop'],
  ['08', '모바일 공지를 보여 주세요', '모바일 공지', '작은 화면용 요약', 'responsive', 'mobile'],
  ['09', '데스크톱 공지를 보여 주세요', '데스크톱 공지', '큰 화면용 요약', 'responsive', 'desktop'],
  ['10', '행동 버튼이 있는 경고를 보여 주세요', '확인 필요', '내용을 읽고 계속하세요', 'button', 'desktop'],
  ['11', '가격 요약을 보여 주세요', '가격 요약', '요금 정보', 'card', 'mobile'],
  ['12', '팀 소개를 보여 주세요', '팀 소개', '함께 만드는 도구', 'image', 'desktop'],
  ['13', '두 항목의 목록을 보여 주세요', '목록', '첫째와 둘째', 'grid', 'mobile'],
  ['14', '시작 안내를 보여 주세요', '시작 안내', '단계를 따라오세요', 'simple', 'desktop'],
  ['15', '계정 상태를 보여 주세요', '계정 상태', '정상', 'card', 'mobile'],
  ['16', '업데이트 안내를 보여 주세요', '업데이트', '변경 사항을 확인하세요', 'button', 'desktop'],
  ['17', '지역 안내를 보여 주세요', '지역 안내', '지도 대신 안내 이미지', 'image', 'mobile'],
  ['18', '반응형 도움말을 보여 주세요', '반응형 도움말', '화면 크기에 맞게 표시', 'responsive', 'desktop'],
  ['19', '간단한 대시보드를 보여 주세요', '대시보드', '두 항목 요약', 'grid', 'desktop'],
  ['20', '완료 메시지를 보여 주세요', '완료', '작업이 끝났습니다', 'simple', 'mobile'],
];

function node(id, component, props = {}, classes = [], children = []) {
  return { id, component, props, classes, children };
}

export const BENCHMARK_FIXTURES = Object.freeze(cases.map(([number, prompt, title, detail, kind, viewport]) => {
  const id = `ui-${number}`;
  const children = [node(`${id}-title`, 'Text', { text: title }, ['block'])];
  if (kind === 'card') {
    children.push(node(`${id}-card`, 'Card', {}, ['overflow-hidden'], [
      node(`${id}-detail`, 'Text', { text: detail }, ['block']),
    ]));
  } else {
    children.push(node(`${id}-detail`, 'Text', { text: detail }, ['block']));
  }
  if (kind === 'button') children.push(node(`${id}-action`, 'Button', { label: '확인', actionId: 'show_notice' }, ['block', 'bg-red-500']));
  if (kind === 'image') children.push(node(`${id}-image`, 'Image', { src: '/ai-ui-placeholder.svg', alt: '등록된 풍경 그림' }, ['block']));
  const classes = ['block', 'text-center'];
  if (kind === 'grid') classes.push('grid-cols-2');
  if (kind === 'responsive') classes.push('md:block');
  return Object.freeze({
    id, prompt, themeId: 'default', viewport,
    mockTree: node(id, 'Stack', {}, classes, children),
    expect: { texts: [title, detail], components: kind === 'button' ? ['Button'] : kind === 'image' ? ['Image'] : kind === 'card' ? ['Card'] : ['Stack'] },
  });
}));
