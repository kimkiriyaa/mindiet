import { DailyLog } from '../types/diet';

const STORAGE_KEY_PREFIX = 'min_diet_log_';
const LEGACY_KEY_PREFIX = 'inout_diet_log_';
const DEFAULT_TARGET_CALORIES = 2000;

export const GOOGLE_SHEET_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxpmy9pg2KByZcerul2YgQJqVnwB5Z4_gri2UNJSvAQsK12kqFRARyNPD4NewbvMUAV/exec';

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

/**
 * 구글 스프레드시트 Apps Script 웹앱으로 일일 데이터 비동기 백업
 * 모바일 CORS 리디렉션 이슈 방지를 위해 mode: 'no-cors' 적용
 */
export const syncToGoogleSheet = async (dailyLog: DailyLog): Promise<void> => {
  if (!GOOGLE_SHEET_SCRIPT_URL) return;

  const payload = {
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
    // 백그라운드 전송 실패 시에도 앱 정상 동작을 위해 silent catch
    console.warn('[StorageService] Google Sheet 동기화 지연/실패 (로컬 저장은 완료됨):', error);
  }
};
