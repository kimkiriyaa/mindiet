import { DailyLog, AuthUser, UserSession, UserProfile } from '../types/diet';

export const GOOGLE_SHEET_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwQ2A-RTrbZs3oNp5G2j-3cH2M-1UfSEI28E18X1ZRCF1Y9YjikTqNa9yvRAZU09V1u/exec';

const DEFAULT_TARGET_CALORIES = 2000;
const REGISTERED_USERS_KEY = 'registered_users';
const CURRENT_SESSION_KEY = 'min_diet_session';
const LEGACY_STORAGE_KEY_PREFIX = 'diet_logs_';

const sanitizeUserId = (userId?: string): string => {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return 'default';
  }
  return userId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

const getLogStorageKey = (date: string, userId?: string): string => {
  const safeId = sanitizeUserId(userId);
  return `min_diet_${safeId}_log_${date}`;
};

export const getProfileKey = (userId?: string): string => {
  const safeId = sanitizeUserId(userId);
  return `min_diet_${safeId}_profile`;
};

export const loadUserProfile = (userId?: string): UserProfile | null => {
  const safeKey = getProfileKey(userId);
  try {
    const raw = localStorage.getItem(safeKey);
    if (raw) {
      return JSON.parse(raw) as UserProfile;
    }

    // 마이그레이션: 기존 공통 키에 저장된 프로필이 있다면 가져와서 현재 유저 키로 저장
    const legacyCommonKeys = ['user_profile', 'min_diet_profile'];
    for (const legacyKey of legacyCommonKeys) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as UserProfile;
          if (parsed && typeof parsed === 'object') {
            localStorage.setItem(safeKey, JSON.stringify(parsed));
            return parsed;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  } catch (e) {
    console.error('Failed to load user profile from localStorage:', e);
  }
  return null;
};

export const saveUserProfile = (profile: UserProfile, userId?: string): void => {
  const safeKey = getProfileKey(userId);
  try {
    localStorage.setItem(safeKey, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save user profile to localStorage:', e);
  }
};

export const getRegisteredUsers = (): AuthUser[] => {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRegisteredUsers = (users: AuthUser[]): void => {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save registered users to localStorage:', e);
  }
};

export interface LocalAuthResult {
  success: boolean;
  message?: string;
  user?: {
    userId: string;
    name: string;
    userName?: string;
  };
}

export const registerUserLocal = (
  userId: string,
  password: string,
  name: string
): LocalAuthResult => {
  const trimmedId = userId.trim();
  const trimmedName = name.trim();
  const trimmedPassword = password.trim();

  if (!trimmedId || !trimmedPassword || !trimmedName) {
    return { success: false, message: '모든 필드를 입력해 주세요.' };
  }

  const users = getRegisteredUsers();
  const exists = users.some(
    (u) => u.userId.toLowerCase() === trimmedId.toLowerCase()
  );

  if (exists) {
    return { success: false, message: '이미 존재하는 아이디입니다.' };
  }

  const newUser: AuthUser = {
    userId: trimmedId,
    userName: trimmedName,
    password: trimmedPassword,
    createdAt: new Date().toISOString(),
  };

  saveRegisteredUsers([...users, newUser]);
  return {
    success: true,
    message: '회원가입이 완료되었습니다.',
    user: {
      userId: trimmedId,
      name: trimmedName,
      userName: trimmedName,
    },
  };
};

export const loginUserLocal = (
  userId: string,
  password: string
): LocalAuthResult => {
  const trimmedId = userId.trim();
  const trimmedPassword = password.trim();

  const users = getRegisteredUsers();
  const found = users.find(
    (u) =>
      u.userId.toLowerCase() === trimmedId.toLowerCase() &&
      u.password === trimmedPassword
  );

  if (!found) {
    return { success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' };
  }

  return {
    success: true,
    user: {
      userId: found.userId,
      name: found.userName,
      userName: found.userName,
    },
  };
};

export const syncAuthToGoogleSheet = async (
  mode: 'register' | 'login',
  userId: string,
  password: string,
  name?: string
): Promise<void> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) return;

  try {
    const payload = {
      action