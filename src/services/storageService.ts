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

export interface LocalAuthUser {
  userId: string;
  name: string;
  userName: string;
}

export interface LocalAuthResult {
  success: boolean;
  message?: string;
  user?: LocalAuthUser;
}

export const registerUserLocal = (
  param1: string | { userId: string; password?: string; name?: string; userName?: string },
  param2?: string,
  param3?: string
): LocalAuthResult => {
  let userId = '';
  let password = '';
  let name = '';

  if (typeof param1 === 'object' && param1 !== null) {
    userId = param1.userId || '';
    password = param1.password || '';
    name = param1.userName || param1.name || '';
  } else {
    userId = param1 || '';
    password = param2 || '';
    name = param3 || '';
  }

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
  param2: string | { userId: string; password?: string; userName?: string; name?: string },
  password?: string,
  name?: string
): Promise<void> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) return;

  let targetUserId = '';
  let targetPassword = '';
  let targetName = '';

  if (typeof param2 === 'object' && param2 !== null) {
    targetUserId = param2.userId || '';
    targetPassword = param2.password || '';
    targetName = param2.userName || param2.name || '';
  } else {
    targetUserId = param2 || '';
    targetPassword = password || '';
    targetName = name || '';
  }

  try {
    const payload = {
      action: 'auth',
      mode,
      userId: targetUserId,
      password: targetPassword,
      userName: targetName,
      timestamp: new Date().toISOString(),
    };

    await fetch(GOOGLE_SHEET_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to sync auth with Google Sheet:', error);
  }
};

export const getSavedSession = (): UserSession | null => {
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
};

export const setSavedSession = (session: UserSession | null): void => {
  try {
    if (session) {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to save session to localStorage:', e);
  }
};

export const loadDailyLog = (date: string, userId?: string): DailyLog | null => {
  const userKey = getLogStorageKey(date, userId);
  try {
    const stored = localStorage.getItem(userKey);
    if (stored) {
      return JSON.parse(stored) as DailyLog;
    }

    // 마이그레이션: 기존 레거시 키 확인
    const legacyKey = `${LEGACY_STORAGE_KEY_PREFIX}${date}`;
    const legacyData = localStorage.getItem(legacyKey);
    if (legacyData) {
      const parsed = JSON.parse(legacyData) as DailyLog;
      if (parsed) {
        localStorage.setItem(userKey, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load daily log from localStorage:', e);
  }
  return null;
};

export const saveDailyLog = (log: DailyLog, userId?: string): void => {
  const userKey = getLogStorageKey(log.date, userId);
  try {
    localStorage.setItem(userKey, JSON.stringify(log));
  } catch (e) {
    console.error('Failed to save daily log to localStorage:', e);
  }
};

export const getRecentWeightLogs = (
  endDate: string,
  days: number = 14,
  userId?: string
): { date: string; weight?: number }[] => {
  const result: { date: string; weight?: number }[] = [];
  const end = new Date(endDate);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = loadDailyLog(dateStr, userId);
    result.push({
      date: dateStr,
      weight: log?.weight,
    });
  }

  return result;
};

export const syncToGoogleSheet = async (log: DailyLog): Promise<void> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) return;

  try {
    const payload = {
      action: 'saveLog',
      date: log.date,
      userId: log.userId || 'default',
      targetCalories: log.targetCalories || DEFAULT_TARGET_CALORIES,
      steps: log.steps || 0,
      meals: log.meals || [],
      waterIntake: log.waterIntake || 0,
      weight: log.weight,
      exerciseCalories: log.exerciseCalories || 0,
      exerciseNotes: log.exerciseNotes || '',