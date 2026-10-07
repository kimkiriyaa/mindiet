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
        targetCalories: profile.targetCalories || 2000,
        steps: 0,
        meals: [],
        waterIntake: 0,
      }
    );
  });

  useEffect(() => {
    const log = loadDailyLog(currentDate);
    if (log) {
      setDailyLog(log);
    } else {
      setDailyLog({
        date: currentDate,
        targetCalories: profile.targetCalories || 2000,
        steps: 0,
        meals: [],
        waterIntake: 0,
      });
    }
  }, [currentDate, profile.targetCalories]);

  const handleUpdateLog = useCallback(
    (newLog: DailyLog) => {
      setDailyLog(newLog);
      saveDailyLog(newLog);
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
      setSession