import { MealItem, UserProfile } from '../types/diet';

const API_URL = import.meta.env.VITE_GOOGLE_SHEET_API_URL;

export const saveUserToSheet = async (user: UserProfile & { userId: string; name: string }) => {
  if (!API_URL) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'saveUser', ...user }),
    });
  } catch (e) {
    console.error('구글시트 유저 저장 실패:', e);
  }
};

export const saveDailyLogToSheet = async (userId: string, date: string, steps: number, targetCalories: number) => {
  if (!API_URL) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'saveDailyLog', userId, date, steps, targetCalories }),
    });
  } catch (e) {
    console.error('구글시트 활동로그 저장 실패:', e);
  }
};

export const saveMealToSheet = async (userId: string, date: string, meal: MealItem) => {
  if (!API_URL) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'saveMeal',
        userId,
        date,
        mealType: meal.type,
        name: meal.name,
        calories: meal.calories,
        carbs: meal.carbs || 0,
        protein: meal.protein || 0,
        fat: meal.fat || 0,
        imageUrl: meal.imageUrl || '',
      }),
    });
  } catch (e) {
    console.error('구글시트 식단 저장 실패:', e);
  }
};