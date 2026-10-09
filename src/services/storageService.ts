import { DailyLog, AuthUser, UserSession } from '../types/diet';

const DEFAULT_TARGET_CALORIES = 2000;
const REGISTERED_USERS_KEY = 'registered_users';

export const GOOGLE_SHEET_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwQ2A-RTrbZs3oNp5G2j-3cH2M-1UfSEI28E18X1ZRCF1Y9YjikTqNa9yvRAZU09V1u/exec';

const getLogKey = (date: string, userId: string = 'default'): string => {
  const safeId = encodeURIComponent(userId.trim() || 'default');
  return `min_diet_${safeId}_log_${date}`;
};

const getLegacyLogKey = (date: string): string => {
  return `min_diet_log_${date}`;
};

export const getEmptyDailyLog = (date: string, userId: string = 'default'): DailyLog => ({
  date,
  userId,
  targetCalories: DEFAULT_TARGET_CALORIES,
  steps: 0,
  meals: [],
  waterIntake: 0,
});

export const getDailyLog = (date: string, userId: string = 'default'): DailyLog => {
  try {
    const rawData =
      localStorage.getItem(getLogKey(date, userId)) ||
      (userId === 'default' ? localStorage.getItem(getLegacyLogKey(date)) : null);
    if (!rawData) {
      return getEmptyDailyLog(date, userId);
    }
    const parsed = JSON.parse(rawData) as DailyLog;
    return {
      ...getEmptyDailyLog(date, userId),
      ...parsed,
      userId,
      waterIntake: parsed.waterIntake !== undefined ? parsed.waterIntake : (parsed.water ?? 0),
    };
  } catch (error) {
    console.error('Failed to load daily log from localStorage:', error);
    return getEmptyDailyLog(date, userId);
  }
};

export const saveDailyLog = (log: DailyLog, userId?: string): void => {
  const activeUserId = userId || log.userId || 'default';
  const key = getLogKey(log.date, activeUserId);

  try {
    const payload = JSON.stringify({ ...log, userId: activeUserId });
    localStorage.setItem(key, payload);
  } catch (error: any) {
    console.warn('[StorageService] 저장 실패, 이미지 제거 후 재시도 시도:', error);

    // 용량 초과(QuotaExceededError) 발생 시 이미지 필드를 제외하고 순수 데이터만 안전 저장
    try {
      const lightweightLog: DailyLog = {
        ...log,
        userId: activeUserId,