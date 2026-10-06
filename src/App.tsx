import React, { useState, useEffect, useMemo } from 'react';
import { HeaderNav } from './components/common/HeaderNav';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';

type PeriodTab = 'daily' | 'weekly' | 'monthly';

const DEFAULT_TARGET_CALORIES = 1700;

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('min_diet_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('min_diet_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodTab>('daily');

  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = session ? `min_diet_log_${session.userId}_${todayStr}` : `min_diet_log_${todayStr}`;

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] };
  });

  useEffect(() => {
    if (!session) return;
    const currentKey = `min_diet_log_${session.userId}_${todayStr}`;
    const saved = localStorage.getItem(currentKey);
    if (saved) {
      setDailyLog(JSON.parse(saved));
    } else {
      setDailyLog({ date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] });
    }
  }, [session, todayStr]);

  const updateDailyLog = (updater: (prev: DailyLog) => DailyLog) => {
    setDailyLog((prev) => {
      const next = updater(prev);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const handleAddMeal = (mealData: Omit<MealItem, 'id'>) => {
    const newMeal: MealItem = { ...mealData, id: Date.now().toString() };
    updateDailyLog((prev) => ({ ...prev, meals: [...prev.meals, newMeal] }));
    if (session) {
      saveMealToSheet(session.userId, todayStr, newMeal);
    }
  };

  const handleDeleteMeal = (id: string) => {
    updateDailyLog((prev) => ({ ...prev, meals: prev.meals.filter((m) => m.id !== id) }));
  };

  const handleStepsChange = (steps: number) => {
    const validSteps = Math.max(0, steps);
    updateDailyLog((prev) => ({ ...prev, steps: validSteps }));
    if (session) {
      saveDailyLogToSheet(session.userId, todayStr, validSteps, dailyLog.targetCalories);
    }
  };

  const handleQuickAddSteps = (amount: number) => {
    handleStepsChange(dailyLog.steps + amount);
  };

  const handleSetExactSteps = (amount: number) => {
    handleStepsChange(amount);
  };

  const handleLogout = () => {
    localStorage.removeItem('min_diet_session');
    setSession(null);
  };

  const inCalories = dailyLog.meals.reduce((sum, m) => sum + m.calories, 0);
  const userWeight = profile?.weight || 65;
  const outCalories = calculateStepCalories(dailyLog.steps, userWeight);
  const netCalories = inCalories - outCalories;
  const targetCalories = dailyLog.targetCalories || DEFAULT_TARGET_CALORIES;
  const remainingCalories = targetCalories - netCalories;

  const periodDayCount = selectedPeriod === 'daily' ? 7 : selectedPeriod === 'weekly' ? 14 : 30;

  const historyData = useMemo(() => {
    const data: { dateLabel: string; fullDate: string; intake: number; diff: number; weight: number }[] = [];
    const baseDate = new Date();

    for (let i = periodDayCount - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;

      if (iso === todayStr) {
        data.push({
          dateLabel: monthDay,
          fullDate: iso,
          intake: inCalories,
          diff: inCalories - targetCalories,
          weight: userWeight,
        });
      } else {
        const stored = session ? localStorage.getItem(`min_diet_log_${session.userId}_${iso}`) : localStorage.getItem(`min_diet_log_${iso}`);
        if (stored) {
          try {
            const parsed: DailyLog = JSON.parse(stored);
            const pastIntake = parsed.meals.reduce((sum, m) => sum + m.calories, 0);
            data.push({
              date