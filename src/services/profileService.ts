import { UserProfile } from '../types/diet';

const PROFILE_STORAGE_KEY = 'min_diet_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  birthDate: '1995-01-01',
  gender: 'female',
  height: 165,
  weight: 60,
  activityLevel: 'moderate',
  targetWeight: 55,
  targetCalories: 1800,
  targetWater: 2000,
};

export const getStoredProfile = (): UserProfile => {
  const data = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!data) return DEFAULT_PROFILE;
  try {
    const parsed = JSON.parse(data);
    return { ...DEFAULT_PROFILE, ...parsed };
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

export const loadUserProfile = getStoredProfile;
export const saveUserProfile = saveStoredProfile;

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

export const calculateBMR = (profile: UserProfile): number => {
  const age = calculateAge(profile.birthDate);
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * age;
  const bmr = profile.gender === 'male' ? base + 5 : base - 161;
  return Math.round(Math.max(bmr, 1000));
};

export const calculateTargetCalories = (profile: UserProfile): number => {
  const bmr = calculateBMR(profile);
  const multiplierMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const factor = (profile.activityLevel && multiplierMap[profile.activityLevel]) || 1.375;
  const tdee = bmr * factor;
  return Math.round(tdee - 300);
};
