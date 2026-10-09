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

const getProfileKey = (userId: string = 'default'): string => {
  const safeId = encodeURIComponent(userId.trim() || 'default');
  return `min_diet_${safeId}_profile`;
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
        meals: log.meals.map((meal) => ({
          ...meal,
          imageUrl: undefined,
        })),
      };
      const strippedPayload = JSON.stringify(lightweightLog);
      localStorage.setItem(key, strippedPayload);
      console.info('[StorageService] 용량 초과 방어를 위해 이미지를 제외하고 안전하게 저장되었습니다.');
    } catch (retryError) {
      console.error('[StorageService] 치명적 저장 에러:', retryError);
    }
  }
};

// 호환용 alias export
export const loadDailyLog = (dateStr: string, userId?: string): DailyLog | null => {
  try {
    const activeUserId = userId || 'default';
    const data =
      localStorage.getItem(getLogKey(dateStr, activeUserId)) ||
      (activeUserId === 'default' ? localStorage.getItem(getLegacyLogKey(dateStr)) : null);
    if (!data) return null;
    const parsed = JSON.parse(data) as DailyLog;
    return {
      ...parsed,
      userId: activeUserId,
      waterIntake: parsed.waterIntake !== undefined ? parsed.waterIntake : (parsed.water ?? 0),
    };
  } catch (error) {
    console.error('[StorageService] loadDailyLog 오류:', error);
    return null;
  }
};

/**
 * 사용자별 프로필 불러오기 (신규 계정 시 기본 프로필 생성)
 */
export const getUserProfile = (userId: string = 'default'): UserProfile => {
  const defaultProfile: UserProfile = {
    birthDate: '1995-01-01',
    gender: 'male',
    height: 175,
    weight: 70,
    activityLevel: 'moderate',
    targetWeight: 65,
    targetCalories: 2000,
    targetWater: 2000,
  };

  try {
    const raw = localStorage.getItem(getProfileKey(userId));
    if (raw) {
      return { ...defaultProfile, ...JSON.parse(raw) };
    }
    // 레거시 단일 키 호환
    if (userId === 'default') {
      const legacy = localStorage.getItem('user_profile');
      if (legacy) return { ...defaultProfile, ...JSON.parse(legacy) };
    }
    return defaultProfile;
  } catch (error) {
    console.error('[StorageService] 프로필 로드 실패:', error);