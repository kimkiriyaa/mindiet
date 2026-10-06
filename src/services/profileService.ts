import { UserProfile } from '../types/diet';

const PROFILE_STORAGE_KEY = 'min_diet_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  birthDate: '1995-01-01',
  gender: 'female',
  height: 165,
  weight: 60,
};

export const getStoredProfile = (): UserProfile => {
  const data = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!data) return DEFAULT_PROFILE;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_PROFILE;
  }
};

export const saveStoredProfile = (profile: UserProfile): void => {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  if (profile.geminiApiKey) {
    localStorage.setItem('min_diet_gemini_api_key', profile.geminiApiKey);
  }
};

export const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 25;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(1, age);
};

/**
 * Mifflin-St Jeor 공식을 이용한 BMR 계산
 * 남성: 10 * 체중(kg) + 6.25 * 키(cm) - 5 * 나이 + 5
 * 여성: 10 * 체중(kg) + 6.25 * 키(cm) - 5 * 나이 - 161
 */
export const calculateBMR = (profile: UserProfile): number => {
  const age = calculateAge(profile.birthDate);
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * age;
  const bmr = profile.gender === 'male' ? base + 5 : base - 161;
  return Math.round(Math.max(bmr, 1000));
};

/**
 * 기본 유지/다이어트 권장 일일 목표 칼로리 (TDEE * 적정 다이어트 계수)
 * 보통 가벼운 활동 계수 1.375 기준에서 약 300~500kcal 적자 목표 설정
 */
export const calculateTargetCalories = (profile: UserProfile): number => {
  const bmr = calculateBMR(profile);
  const tdee = bmr * 1.375;
  const deficitTarget = tdee - 300;
  return Math.round(deficitTarget);
};
