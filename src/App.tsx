import React, { useState, useEffect, useMemo } from 'react';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';

type PeriodTab = 'daily' | 'weekly' | 'monthly';
const DEFAULT_TARGET_CALORIES = 1700;
const DEFAULT_TARGET_WATER = 2000;

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('min_diet_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('min_diet_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodTab>('daily');

  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = session ? `min_diet_log_${session.userId}_${todayStr}` : `min_diet_log_${todayStr}`;
  const waterStorageKey = session ? `min_diet_water_${session.userId}_${todayStr}` : `min_diet_water_${todayStr}`;

  // 물 섭취량 state
  const [waterIntake, setWaterIntake] = useState<number>(() => {
    const saved = localStorage.getItem(waterStorageKey);
    return saved ? Number(saved) : 0;
  });

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved
      ? JSON.parse(saved)
      : { date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] };
  });

  useEffect(() => {
    if (!session) return;
    const currentKey = `min_diet_log_${session.userId}_${todayStr}`;
    const currentWaterKey = `min_diet_water_${session.userId}_${todayStr}`;

    const saved = localStorage.getItem(currentKey);
    if (saved) {
      try {
        setDailyLog(JSON.parse(saved));
      } catch {
        setDailyLog({ date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] });
      }
    } else {
      setDailyLog({ date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] });
    }

    const savedWater = localStorage.getItem(currentWaterKey);
    setWaterIntake(savedWater ? Number(savedWater) : 0);
  }, [session, todayStr]);

  const saveToStorageSafely = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      console.error('로컬스토리지 저장 실패:', e);
      alert('로컬 저장소 공간이 부족합니다. 이전 사진 데이터를 일부 정리해주세요.');
    }
  };

  const updateDailyLog = (updater: (prev: DailyLog) => DailyLog) => {
    setDailyLog((prev) => {
      const next = updater(prev);
      saveToStorageSafely(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const handleAddWater = (amount: number) => {
    setWater