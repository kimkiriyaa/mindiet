import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Scale, Check } from 'lucide-react';
import { AuthModal } from './components/auth/AuthModal';
import { HeaderNav } from './components/common/HeaderNav';
import { CalorieDashboardCard } from './components/dashboard/CalorieDashboardCard';
import { CalorieSummaryCard } from './components/dashboard/CalorieSummaryCard';
import { WaterTrackerCard } from './components/dashboard/WaterTrackerCard';
import { WeightTrendCard } from './components/dashboard/WeightTrendCard';
import { MealSection } from './components/meal/MealSection';
import { ActivitySection } from './components/activity/ActivitySection';
import { ProfileModal } from './components/profile/ProfileModal';
import { UserSession, UserProfile, DailyLog, MealItem } from './types/diet';
import { loadUserProfile, saveUserProfile } from './services/profileService';
import {
  loadDailyLog,
  saveDailyLog,
  getRecentWeightLogs,
  syncToGoogleSheet,
  getSavedSession,
  setSavedSession,
} from './services/storageService';
import { calculateStepCalories, safeVal } from './utils/nutritionCalc';
import { estimateExerciseCalories } from './services/visionService';

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(() => getSavedSession());

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

  const activeUserId = session?.userId || 'default';

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    const loaded = loadDailyLog(currentDate, activeUserId);
    if (loaded) {
      return loaded;
    }
    return {
      date: currentDate,
      userId: activeUserId,
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

  // 최근 체중 추이 데이터 상태 (유저별 격리)
  const [recentWeightLogs, setRecentWeightLogs] = useState(() =>
    getRecentWeightLogs(currentDate, 14, activeUserId)
  );

  useEffect(() => {
    if (!session) return;
    const currentUid = session.userId;
    const log = loadDailyLog(currentDate, currentUid);
    const fallbackTarget = safeVal(profile.targetCalories, 2000);
    const fallbackWeight = profile.weight ? safeVal(profile.weight, 70) : undefined;

    if (log) {
      const sanitized: DailyLog = {
        ...log,
        userId: currentUid,
        targetCalories: safeVal(log.targetCalories, fallbackTarget),
        steps: Math.max(0, safeVal(log.steps, 0)),
        waterIntake: Math.max(0, safeVal(log.waterIntake, 0)),
        weight: log.weight !== undefined ? safeVal(log.weight, fallbackWeight ?? 70) : fallbackWeight,
        meals: Array.isArray(log.meals) ? log.meals : [],
        exerciseCalories: Math.max(0, safeVal(log.exerciseCalories, 0)),
        exerciseNotes: log.exerciseNotes || '',
      };
      setDailyLog(sanitized);
      setWeightInput(sanitized.weight ? String(sanitized.weight) : (fallbackWeight ? String(fallbackWeight) : ''));
    } else {
      const newEmptyLog: DailyLog = {
        date: currentDate,
        userId: currentUid,
        targetCalories: fallbackTarget,
        steps: 0,
        meals: [],
        waterIntake: 0,
        weight: fallbackWeight,
        exerciseCalories: 0,
        exerciseNotes: '',
      };
      setDailyLog(newEmptyLog);
      setWeightInput(fallbackWeight ? String(fallbackWeight) : '');
    }

    setRecentWeightLogs(getRecentWeightLogs(currentDate, 14, currentUid));
  }, [currentDate, profile.targetCalories, profile.weight, session]);

  const handleUpdateLog = useCallback(
    (newLog: DailyLog) => {
      const currentUid = session?.userId || 'default';
      const sanitizedLog: DailyLog = {
        ...newLog,
        userId: currentUid,
        targetCalories: Math.max(0, safeVal(newLog.targetCalories, 2000)),
        steps: Math.max(0, safeVal(newLog.steps, 0)),
        waterIntake: Math.max(0, safeVal(newLog.waterIntake, 0)),
        weight: newLog.weight !== undefined ? safeVal(newLog.weight, 0) : undefined,
        meals: Array.isArray(newLog.meals) ? newLog.meals : [],
        exerciseCalories: Math.max(0, safeVal(newLog.exerciseCalories, 0)),
        exerciseNotes: newLog.exerciseNotes || '',
      };
      setDailyLog(sanitizedLog);
      saveDailyLog(sanitizedLog, currentUid);
      syncToGoogleSheet(sanitizedLog);
      setRecentWeightLogs(getRecentWeightLogs(newLog.date, 14, currentUid));
    },
    [session]
  );

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setSavedSession(newSession);
  };

  const handleLogout = () => {
    if (window.confirm('정말 로그아웃 하시겠습니까?')) {
      setSavedSession(null);
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
      height: Math.max(0, safeVal(newProfile.height, 170)),
      weight: Math.max(0, safeVal(newProfile.weight, 65)),
      targetCalories: Math.max(0, safeVal(newProfile.targetCalories, 2000)),
      targetWater: Math.max(0, safeVal(newProfile.targetWater, 2000)),
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

  // 몸무게 저장 버튼 클릭 또는 엔터 키 입력 시 저장 핸들러
  const handleSaveWeight = () => {
    const parsed = parseFloat(weightInput.trim());
    if (isNaN(parsed) || parsed < 30 || parsed > 250) {
      alert('체중을 30kg ~ 250kg 사이의 숫자로 올바르게 입력해 주세요.');