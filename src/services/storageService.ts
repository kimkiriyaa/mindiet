import { DailyLog, AuthUser, UserSession, UserProfile } from '../types/diet';

const DEFAULT_TARGET_CALORIES = 2000;
const REGISTERED_USERS_KEY = 'registered_users';
const CURRENT_SESSION_KEY = 'min_diet_session';
const LEGACY_SESSION_KEY = 'diet_session';

export const GOOGLE_SHEET_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwQ2A-RTrbZs3oNp5G2j-3cH2M-1UfSEI28E18X1ZRCF1Y9YjikTqNa9yvRAZU09V1u/exec';

const getLogKey = (date: string, userId: string = 'default'): string => {
  const safeId = encodeURIComponent(userId.trim() || 'default');
  return `min_diet_${safeId}_log_${date}`;
};

const getLegacyLogKey = (date: string): string => {
  return `min_diet_log_${date}`;
};

const getProfileKey = (userId: string = 'default'): string =>