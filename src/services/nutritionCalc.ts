import { DailyLog, NutritionTotals } from '../types/diet';

export const calculateDailyNutrition = (log: DailyLog): NutritionTotals => {
  const totalIn = log.meals.reduce((sum, item) => sum + item.calories, 0);
  const totalOut = log.workouts.reduce(
    (sum, item) => sum + item.burnedCalories,
    0
  );
  const remainingCalories = log.targetCalories - totalIn + totalOut;

  const totalCarbs = log.meals.reduce(
    (sum, item) => sum + (item.carbs || 0),
    0
  );
  const totalProtein = log.meals.reduce(
    (sum, item) => sum + (item.protein || 0),
    0
  );
  const totalFat = log.meals.reduce(
    (sum, item) => sum + (item.fat || 0),
    0
  );

  return {
    totalIn,
    totalOut,
    remainingCalories,
    totalCarbs,
    totalProtein,
    totalFat,
  };
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(Math.round(num));
};
