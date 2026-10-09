/**
 * 안전한 정수 변환 헬퍼 (NaN 원천 방어)
 */
export const safeVal = (v: any, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v)) {
    return v;
  }
  const parsed = Number(v);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
};

/**
 * 체중과 걸음 수를 기반으로 소모 칼로리를 연산하는 공식
 */
export const calculateStepCalories = (steps: number = 0, weight: number = 65): number => {
  const safeSteps = Math.max(0, safeVal(steps, 0));
  const safeWeight = safeVal(weight, 65) > 0 ? safeVal(weight, 65) : 65;
  if (safeSteps <= 0) return 0;
  const burned = Math.round(safeSteps * 0.0005 * safeWeight * 1.036);
  return safeVal(burned,