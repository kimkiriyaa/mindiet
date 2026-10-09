import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Scale, Check, Dumbbell, Zap, Loader2 } from 'lucide-react';
import { LoginView } from './components/auth/LoginView';
import { HeaderNav } from './components/common/HeaderNav';
import { CalorieDashboardCard } from './components/dashboard/CalorieDashboardCard';
import { CalorieSummaryCard } from './components/dashboard/CalorieSummaryCard';
import { WaterTrackerCard } from './components/dashboard/WaterTrackerCard';
import { WeightTrendCard } from './components/dashboard/WeightTrendCard';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { UserSession, UserProfile, DailyLog, MealItem } from './types/diet';
import { loadUserProfile, saveUserProfile } from './services/profileService';
import { loadDailyLog, saveDailyLog, getRecentWeightLogs } from './services/storageService';
import { calculateStepCalories, safeVal } from './utils/nutritionCalc';
import { estimateExerciseCalories } from './services/visionService';

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
    const loaded = loadDailyLog(currentDate);
    if (loaded) {
      return loaded;
    }
    return {
      date: currentDate,
      targetCalories: safeVal(profile.targetCalories, 2000),
      steps: 0,
      meals: [],
      waterIntake: 0,
      weight: profile.weight ? safeVal(profile.weight, 70) : undefined,
      exerciseCalories: 0,
      exerciseNotes: '',
    };
  });

  // 몸무게 입력란 로컬 상태 및 저장 피드백
  const [weightInput, setWeightInput] = useState<string>(() => {
    return dailyLog.weight ? String(dailyLog.weight) : (profile.weight ? String(profile.weight) : '');
  });
  const [isWeightSaved, setIsWeightSaved] = useState<boolean>(false);

  // 운동 입력란 상태
  const [exerciseText, setExerciseText] = useState<string>('');
  const [isEstimatingExercise, setIsEstimatingExercise] = useState<boolean>(false);

  // 최근 체중 추이 데이터 상태
  const [recentWeightLogs, setRecentWeightLogs]