export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface UserSession {
  userId: string;
  userName: string;
}

export interface UserProfile {
  birthDate: string;
  gender: 'male' | 'female';
  height: number;
  weight: number;
}

export interface MealItem {
  id: string;
  type: MealType;
  name: string;
  calories: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  imageUrl?: string;
}

export interface DailyLog {
  date: string;
  userId?: string;
  targetCalories: number;
  steps: number;
  meals: MealItem[];
}