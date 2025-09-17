/**
 * FormData Helper Functions
 * FormData의 타입 안전한 처리를 위한 유틸리티
 */

/**
 * FormData.entries()를 안전하게 사용하기 위한 타입 가드
 */
export function getFormDataEntries(formData: FormData): [string, FormDataEntryValue][] {
  const entries: [string, FormDataEntryValue][] = [];
  
  // FormData.entries()가 있는지 확인하고 안전하게 사용
  if (typeof formData.entries === 'function') {
    for (const [key, value] of formData.entries()) {
      entries.push([key, value]);
    }
  } else {
    // Fallback for older browsers (매우 드물지만)
    console.warn('FormData.entries() not supported, using fallback');
    // 이 경우는 현대 브라우저에서는 거의 발생하지 않음
  }
  
  return entries;
}

/**
 * FormData를 Record<string, FormDataEntryValue>로 변환
 */
export function formDataToRecord(formData: FormData): Record<string, FormDataEntryValue> {
  const data: Record<string, FormDataEntryValue> = {};
  
  for (const [key, value] of getFormDataEntries(formData)) {
    data[key] = value;
  }
  
  return data;
}

/**
 * FormData를 Record<string, string>로 변환 (문자열만)
 */
export function formDataToStringRecord(formData: FormData): Record<string, string> {
  const data: Record<string, string> = {};
  
  for (const [key, value] of getFormDataEntries(formData)) {
    data[key] = typeof value === 'string' ? value : value.name || '';
  }
  
  return data;
}
