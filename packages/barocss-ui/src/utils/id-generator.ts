/**
 * ID Generator
 * 간단하고 일관된 ID 생성 유틸리티
 */

/**
 * 범용 ID 생성 함수
 * @param prefix ID 접두사 (예: 'scene', 'user', 'request')
 * @returns 고유한 ID 문자열
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 현재 타임스탬프 반환
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * UUID v4 생성 (필요시)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 편의를 위한 별칭들 (선택적 사용)
export const generateSceneId = () => generateId('scene');
export const generateChainId = () => generateId('chain');
export const generateRequestId = () => generateId('request');
export const generateInputId = () => generateId('input');
export const generateOutputId = () => generateId('output');
export const generateComponentId = () => generateId('comp');
export const generateCorrelationId = () => generateId('corr');
export const generateSessionId = () => generateId('session');
