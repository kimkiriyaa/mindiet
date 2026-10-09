import { DailyLog, AuthUser, UserSession } from '../types/diet';

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
 * 최근 N일간의 체중 기록을 수집하는 헬퍼 함수
 */
export const getRecentWeightLogs = (
  baseDateStr: string,
  days = 14,
  userId: string = 'default'
): { date: string; weight?: number }[] => {
  const result: { date: string; weight?: number }[] = [];
  const base = new Date(baseDateStr);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = loadDailyLog(dateStr, userId);
    result.push({
      date: dateStr,
      weight: log?.weight && log.weight > 0 ? log.weight : undefined,
    });
  }

  return result;
};

/**
 * 구글 스프레드시트 Apps Script 웹앱으로 일일 데이터 비동기 백업
 * 모바일 CORS 리디렉션 이슈 방지를 위해 mode: 'no-cors' 적용
 */
export const syncToGoogleSheet = async (dailyLog: DailyLog): Promise<void> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) return;

  const payload = {
    action: 'saveLog',
    userId: dailyLog.userId || 'default',
    date: dailyLog.date,
    weight: dailyLog.weight,
    waterIntake: dailyLog.waterIntake,
    steps: dailyLog.steps,
    exerciseCalories: dailyLog.exerciseCalories,
    exerciseNotes: dailyLog.exerciseNotes,
    targetCalories: dailyLog.targetCalories,
    meals: (dailyLog.meals || []).map((m) => ({
      id: m.id,
      type: m.type,
      name: m.name,
      calories: m.calories,
      carbs: m.carbs,
      protein: m.protein,
      fat: m.fat,
    })),
  };

  try {
    await fetch(GOOGLE_SHEET_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[StorageService] Google Sheet 동기화 지연/실패 (로컬 저장은 완료됨):', error);
  }
};

/**
 * 로컬 사용자 계정 목록 로드
 */
export const getRegisteredUsersLocal = (): AuthUser[] => {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * 로컬 사용자 회원가입
 */
export const registerUserLocal = (user: AuthUser): { success: boolean; message?: string } => {
  const users = getRegisteredUsersLocal();
  const exists = users.some((u) => u.userId.toLowerCase() === user.userId.toLowerCase());
  if (exists) {
    return { success: false, message: '이미 존재하는 아이디입니다.' };
  }
  const updated = [...users, { ...user, createdAt: new Date().toISOString() }];
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updated));
  return { success: true };
};

/**
 * 로컬 사용자 로그인 검증
 */
export const loginUserLocal = (userId: string, password: string): { success: boolean; user?: AuthUser; message?: string } => {
  const users = getRegisteredUsersLocal();
  const found = users.find((u) => u.userId.toLowerCase() === userId.trim().toLowerCase());
  if (!found) {
    return { success: false, message: '존재하지 않는 아이디입니다.' };
  }
  if (found.password !== password.trim()) {
    return { success: false, message: '비밀번호가 일치하지 않습니다.' };
  }
  return { success: true, user: found };
};

/**
 * 사용자 가입/로그인 정보를 구글 시트 Users 탭에 백그라운드 동기화
 */
export const syncAuthToGoogleSheet = async (
  mode: 'register' | 'login',
  user: { userId: string; password?: string; userName: string }
): Promise<void> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) return;

  const payload = {
    action: 'auth',
    mode,
    userId: user.userId,
    password: user.password || '',
    userName: user.userName,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(GOOGLE_SHEET_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[StorageService] Google Sheet Auth 동기화 오류 (로컬 인증 유지):', error);
  }
};

export const getSavedSession = (): UserSession | null => {
  try {
    const saved = localStorage.getItem(CURRENT_SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const setSavedSession = (session: UserSession | null): void => {
  if (session) {
    const serialized = JSON.stringify(session);
    localStorage.setItem(CURRENT_SESSION_KEY, serialized);
    localStorage.setItem(LEGACY_SESSION_KEY, serialized);
  } else {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
};
