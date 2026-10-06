import { DailyLog, NutritionSummary } from '../types/diet';

/**
 * 체중과 걸음 수를 기반으로 소모 칼로리를 연산하는 공식
 * Math.round(steps * 0.0005 * (weight || 65) * 1.036)
 */
export const calculateStepCalories = (steps: number = 0, weight: number = 65): number => {
  if (steps <= 0) return 0;
  return Math.round(steps * 0.0005 * (weight || 65) * 1.036);
};

export const calculateSummary = (log: DailyLog, currentWeight: number = 65): NutritionSummary => {
  let consumedCalories = 0;
  let carbs = 0;
  let protein = 0;
  let fat = 0;

  const mealCategories = Object.values(log.meals);
  mealCategories.forEach(categoryMeals => {
    categoryMeals.forEach(meal => {
      consumedCalories += Number(meal.calories) || 0;
      carbs += Number(meal.carbs) || 0;
      protein += Number(meal.protein) || 0;
      fat += Number(meal.fat) || 0;
    });
  });

  const exerciseCalories = log.exercises.reduce((sum, item) => sum + (Number(item.caloriesBurned) || 0), 0);
  const stepsCalories = calculateStepCalories(log.steps || 0, currentWeight);
  const burnedCalories = exerciseCalories + stepsCalories;
  const netCalories = consumedCalories - burnedCalories;

  return {
    consumedCalories,
    burnedCalories,
    netCalories,
    carbs,
    protein,
    fat,
    stepsCalories,
  };
};
