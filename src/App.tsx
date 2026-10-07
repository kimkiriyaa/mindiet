import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LoginView } from './components/auth/LoginView';
import { HeaderNav } from './components/common/HeaderNav';
import { CalorieDashboardCard } from './components/dashboard/CalorieDashboardCard';
import { CalorieSummaryCard } from './components/dashboard/CalorieSummaryCard';
import { WaterTrackerCard } from './components/dashboard/WaterTrackerCard';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { UserSession, UserProfile, DailyLog, MealItem } from './types/diet';
import { loadUserProfile, saveUserProfile } from './services/profileService';
import { loadDailyLog, saveDailyLog } from './services/storageService';
import { calculateStepCalories } from './utils/nutritionCalc';

const SESSION_KEY = 'min_diet_session';
const LEGACY_SESSION_KEY = 'diet_session';

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentDate, setCurrentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    return (
      loadUserProfile() || {
        birthDate: '1995-01-01',
        gender: 'male',
        height: 175,
        weight: 70,
        activityLevel: 'moderate',
        targetWeight: 65,
        targetCalories: 2000,
        targetWater: 2000,
      }
    );
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    return (
      loadDailyLog(currentDate) || {
        date: currentDate,
        targetCalories: Number(profile.targetCalories) || 2000,
        steps: 0,
        meals: [],
        waterIntake: 0,
      }
    );
  });

  useEffect(() => {
    const log = loadDailyLog(currentDate);
    const fallbackTarget = Number(profile.targetCalories) || 2000;
    if (log) {
      setDailyLog({
        ...log,
        targetCalories: Number(log.targetCalories) || fallbackTarget,
        steps: Number(log.steps) || 0,
        waterIntake: Number(log.waterIntake) || 0,
        meals: Array.isArray(log.meals) ? log.meals : [],
      });
    } else {
      setDailyLog({
        date: currentDate,
        targetCalories: fallbackTarget,
        steps: 0,
        meals: [],
        waterIntake: 0,
      });
    }
  }, [currentDate, profile.targetCalories]);

  const handleUpdateLog = useCallback(
    (newLog: DailyLog) => {
      const sanitizedLog: DailyLog = {
        ...newLog,
        targetCalories: Number(newLog.targetCalories) || 2000,
        steps: Math.max(0, Number(newLog.steps) || 0),
        waterIntake: Math.max(0, Number(newLog.waterIntake) || 0),
        meals: Array.isArray(newLog.meals) ? newLog.meals : [],
      };
      setDailyLog(sanitizedLog);
      saveDailyLog(sanitizedLog);
    },
    []
  );

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    const serialized = JSON.stringify(newSession);
    localStorage.setItem(SESSION_KEY, serialized);
    localStorage.setItem(LEGACY_SESSION_KEY, serialized);
  };

  const handleLogout = () => {
    if (window.confirm('정말 로그아웃 하시겠습니까?')) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
      setSession(null);
    }
  };

  const handlePrevDate = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleSaveProfile = (newProfile: UserProfile) => {
    const sanitizedProfile: UserProfile = {
      ...newProfile,
      height: Number(newProfile.height) || 170,
      weight: Number(newProfile.weight) || 65,
      targetCalories: Number(newProfile.targetCalories) || 2000,
      targetWater: Number(newProfile.targetWater) || 2000,
    };
    setProfile(sanitizedProfile);
    saveUserProfile(sanitizedProfile);
    if (sanitizedProfile.targetCalories && sanitizedProfile.targetCalories !== dailyLog.targetCalories) {
      handleUpdateLog({
        ...dailyLog,
        targetCalories: sanitizedProfile.targetCalories,
      });
    }
  };

  const handleAddMeal = (mealData: Omit<MealItem, 'id'>) => {
    const newMeal: MealItem = {
      ...mealData,
      calories: Math.max(0, Number(mealData.calories) || 0),
      carbs: Math.max(0, Number(mealData.carbs) || 0),
      protein: Math.max(0, Number(meal