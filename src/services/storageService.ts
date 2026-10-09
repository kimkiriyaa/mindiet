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

export const registerUser = (
  user: Omit<AuthUser, 'createdAt'>
): { success: boolean; message: string } => {
  const trimmedId = user.userId.trim();
  const trimmedName = user.userName.trim();
  const trimmedPassword = user.password.trim();

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
  return { success: true, message: '회원가입이 완료되었습니다.' };
};

export const authenticateUser = (
  userId: string,
  password: string
): { success: boolean; session?: UserSession; message?: string } => {
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

  const session: UserSession = {
    userId: found.userId,
    userName: found.userName,
  };

  return { success: true, session };
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
  const key = getLogStorageKey(date, userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          date: parsed.date || date,
          userId: parsed.userId || userId,
          targetCalories: parsed.targetCalories ?? DEFAULT_TARGET_CALORIES,
          steps: parsed.steps ?? 0,
          meals: Array.isArray(parsed.meals) ? parsed.meals : [],
          waterIntake: parsed.waterIntake ?? parsed.water ?? 0,
          weight: parsed.weight,
          exerciseCalories: parsed.exerciseCalories ?? 0,
          exerciseNotes: parsed.exerciseNotes || '',
        };
      }
    }

    // 마이그레이션: 기존 diet_logs_ 키 형식 지원
    const legacyKey = `${LEGACY_STORAGE_KEY_PREFIX}${date}`;
    const legacyRaw = localStorage.getItem(legacyKey);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (parsedLegacy && typeof parsedLegacy === 'object') {
        const migrated: DailyLog = {
          date: parsedLegacy.date || date,
          userId: parsedLegacy.userId || userId,
          targetCalories: parsedLegacy.targetCalories ?? DEFAULT_TARGET_CALORIES,
          steps: parsedLegacy.steps ?? 0,
          meals: Array.isArray(parsedLegacy.meals) ? parsedLegacy.meals : [],
          waterIntake: parsedLegacy.waterIntake ?? parsedLegacy.water ?? 0,
          weight: parsedLegacy.weight,
          exerciseCalories: parsedLegacy.exerciseCalories ?? 0,
          exerciseNotes: parsedLegacy.exerciseNotes || '',
        };
        localStorage.setItem(key, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.error('Failed to load daily log from localStorage:', e);
  }
  return null;
};

export const saveDailyLog = (log: DailyLog, userId?: string): void => {
  const key = getLogStorageKey(log.date, userId || log.userId);
  try {
    localStorage.setItem(key, JSON.stringify(log));
  } catch (e) {
    console.error('Failed to save daily log to localStorage:', e);
  }
};

export interface WeightLogPoint {
  date: string;
  weight?: number;
}

export const getRecentWeightLogs = (
  baseDate: string,
  days = 14,
  userId?: string
): WeightLogPoint[] => {
  const results: WeightLogPoint[] = [];
  const base = new Date(baseDate);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = loadDailyLog(dateStr, userId);
    results.push({
      date: dateStr,
      weight: log?.weight,
    });
  }

  return results;
};

export const syncToGoogleSheet = async (log: DailyLog): Promise<boolean> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) {
    return false;
  }

  try {
    const payload = {
      action: 'saveLog',
      date: log.date,
      userId: log.userId,
      targetCalories: log.targetCalories,
      steps: log.steps,
      waterIntake: log.waterIntake,
      weight: log.weight,
      exerciseCalories: log.exerciseCalories,
      exerciseNotes: log.exerciseNotes,
      meals: log.meals,
    };

    const response = await fetch(GOOGLE_SHEET_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (e) {
    console.warn('Google Sheet sync skipped or failed:', e);
    return false;
  }
};
