/**
 * 체중과 걸음 수를 기반으로 소모 칼로리를 연산하는 공식
 */
export const calculateStepCalories = (steps: number = 0, weight: number = 65): number => {
  if (steps <= 0) return 0;
  return Math.round(steps * 0.0005 * (weight || 65) * 1.036);
};

/**
 * 생년월일 기준 만 나이 계산
 */
export const calculateAge = (birthDateStr: string): number => {
  if (!birthDateStr) return 30;
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(1, age);
};

export interface BMIResult {
  bmi: number;
  status: '저체중' | '정상' | '과체중' | '비만';
  color: string;
}

/**
 * BMI(체질량 지수) 계산
 * BMI = 체중(kg) / (신장(m) * 신장(m))
 */
export const calculateBMI = (heightCm: number, weightKg: number): BMIResult => {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    return { bmi: 0, status: '정상', color: 'text-slate-500' };
  }
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));

  if (bmi < 18.5) {
    return { bmi, status: '저체중', color: 'text-sky-500' };
  }
  if (bmi < 23) {
    return { bmi, status: '정상', color: 'text-emerald-500' };
  }
  if (bmi < 25) {
    return { bmi, status: '과체중', color: 'text-amber-500' };
  }
  return { bmi, status: '비만', color: 'text-rose-500' };
};
