import { DailyLog } from '../types/diet';

const STORAGE_KEY_PREFIX = 'min_diet_log_';
const LEGACY_KEY_PREFIX = 'inout_diet_log_';
const DEFAULT_TARGET_CALORIES = 2000;

export const getEmptyDailyLog = (date: string): DailyLog => ({
  date,
  targetCalories: DEFAULT_TARGET_CALORIES,
  steps: 0,
  meals: [],
  waterIntake: 0,
});

export const getDailyLog = (date: string): DailyLog => {
  try {
    const rawData =
      localStorage.getItem(`${STORAGE_KEY_PREFIX}${date}`) ||
      localStorage.getItem(`${LEGACY_KEY_PREFIX}${date}`);
    if (!rawData) {
      return getEmptyDailyLog(date);
    }
    const parsed = JSON.parse(rawData) as DailyLog;
    return {
      ...getEmptyDailyLog(date),
      ...parsed,
      waterIntake: parsed.waterIntake !== undefined ? parsed.waterIntake : (parsed.water ?? 0),
    };
  } catch (error) {
    console.error('Failed to load daily log from localStorage:', error);
    return getEmptyDailyLog(date);
  }
};

export const saveDailyLog = (log: DailyLog): void => {
  try {
    const payload = JSON.stringify(log);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${log.date}`, payload);
    localStorage.setItem(`${LEGACY_KEY_PREFIX}${log.date}`, payload);
  } catch (error: any) {
    console.warn('[StorageService] 저장 실패, 이미지 제거 후 재시도 시도:', error);

    // 용량 초과(QuotaExceededError) 발생 시 이미지 필드를 제외하고 순수 데이터만 안전 저장
    try {
      const lightweightLog: DailyLog = {
        ...log,
        meals: log.meals.map((meal) => ({
          ...meal,
          imageUrl: undefined,
        })),
      };
      const strippedPayload = JSON.stringify(lightweightLog);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${log.date}`, strippedPayload);
      localStorage.setItem(`${LEGACY_KEY_PREFIX}${log.date}`, strippedPayload);
      console.info('[StorageService] 용량 초과 방어를 위해 이미지를 제외하고 안전하게 저장되었습니다.');
    } catch (retryError) {
      console.error('[StorageService] 치명적 저장 에러:', retryError);
    }
  }
};

// 호환용 alias export
export const loadDailyLog = (dateStr: string): DailyLog | null => {
  try {
    const data =
      localStorage.getItem(`${STORAGE_KEY_PREFIX}${dateStr}`) ||
      localStorage.getItem(`${LEGACY_KEY_PREFIX}${dateStr}`);
    if (!data) return null;
    const parsed = JSON.parse(data) as DailyLog;
    return {
      ...parsed,
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
export const getRecentWeightLogs = (baseDateStr: string, days = 14): { date: string; weight?: number }[] => {
  const result: { date: string; weight?: number }[] = [];
  const base = new Date(baseDateStr);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = loadDailyLog(dateStr);
    result.push({
      date: dateStr,
      weight: log?.weight && log.weight > 0 ? log.weight : undefined,
    });
  }

  return result;
};
