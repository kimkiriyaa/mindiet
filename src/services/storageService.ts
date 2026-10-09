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