import { DailyLog } from '../types/diet';

const STORAGE_KEY_PREFIX = 'inout_diet_log_';
const DEFAULT_TARGET_CALORIES = 2000;

export const getEmptyDailyLog = (date: string): DailyLog => ({
  date,
  targetCalories: DEFAULT_TARGET_CALORIES,
  meals: [],
  workouts: [],
});

export const getDailyLog = (date: string): DailyLog => {
  try {
    const rawData = localStorage.getItem(`${STORAGE_KEY_PREFIX}${date}`);
    if (!rawData) {
      return getEmptyDailyLog(date);
    }
    const parsed = JSON.parse(rawData) as DailyLog;
    return {
      ...getEmptyDailyLog(date),
      ...parsed,
    };
  } catch (error) {
    console.error('Failed to load daily log from localStorage:', error);
    return getEmptyDailyLog(date);
  }
};

export const saveDailyLog = (log: DailyLog): void => {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${log.date}`,
      JSON.stringify(log)
    );
  } catch (error) {
    console.error('Failed to save daily log to localStorage:', error);
  }
};

// 호환용 alias export
export const loadDailyLog = (dateStr: string) => {
  const data = localStorage.getItem(`min_diet_log_${dateStr}`);
  return data ? JSON.parse(data) : null;
};