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
        steps: Math.max(0, Number(log.steps) || 0),
        waterIntake: Math.max(0, Number(log.waterIntake) || 0),
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
        targetCalories: Math.max(0, Number(newLog.targetCalories) || 2000),
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
      height: Math.max(0, Number(newProfile.height) || 170),
      weight: Math.max(0, Number(newProfile.weight) || 65),
      targetCalories: Math.max(0, Number(newProfile.targetCalories) || 2000),
      targetWater: Math.max(0, Number(newProfile.targetWater) || 2000),
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
      protein: Math.max(0, Number(mealData.protein) || 0),
      fat: Math.max(0, Number(mealData.fat) || 0),
      id: Date.now().toString(),
    };
    handleUpdateLog({
      ...dailyLog,
      meals: [...dailyLog.meals, newMeal],
    });
  };

  const handleDeleteMeal = (id: string) => {
    handleUpdateLog({
      ...dailyLog,
      meals: dailyLog.meals.filter((m) => m.id !== id),
    });
  };

  const handleStepsChange = (steps: number) => {
    handleUpdateLog({
      ...dailyLog,
      steps: Math.max(0, Number(steps) || 0),
    });
  };

  const handleAddWater = (amount: number) => {
    const current = Math.max(0, Number(dailyLog.waterIntake) || 0);
    const safeAmount = Number(amount) || 0;
    handleUpdateLog({
      ...dailyLog,
      waterIntake: Math.max(0, current + safeAmount),
    });
  };

  // 총 섭취 칼로리 계산
  const totalInCalories = useMemo(() => {
    const total = dailyLog.meals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
    return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  }, [dailyLog.meals]);

  // 걸음 수 소모 칼로리 계산 (nutritionCalc 공식 사용)
  const burnedStepCalories = useMemo(() => {
    const safeSteps = Math.max(0, Number(dailyLog.steps) || 0);
    const safeWeight = Math.max(0, Number(profile.weight) || 65);
    const burned = calculateStepCalories(safeSteps, safeWeight);
    return Number.isFinite(burned) ? Math.max(0, burned) : 0;
  }, [dailyLog.steps, profile.weight]);

  const netCalories = useMemo(() => {
    const net = totalInCalories - burnedStepCalories;
    return Number.isFinite(net) ? net : 0;
  }, [totalInCalories, burnedStepCalories]);

  const targetCalories = useMemo(() => {
    const target = Number(dailyLog.targetCalories) || Number(profile.targetCalories) || 2000;
    return Number.isFinite(target) ? target : 2000;
  }, [dailyLog.targetCalories, profile.targetCalories]);

  const remainingCalories = useMemo(() => {
    const remaining = targetCalories - netCalories;
    return Number.isFinite(remaining) ? remaining : 0;
  }, [targetCalories, netCalories]);

  const nutritionTotals = useMemo(() => {
    return dailyLog.meals.reduce(
      (acc, item) => {
        const itemCal = Number(item.calories) || 0;
        const itemCarbs = Number(item.carbs) || 0;
        const itemProtein = Number(item.protein) || 0;
        const itemFat = Number(item.fat) || 0;

        return {
          calories: acc.calories + (Number.isFinite(itemCal) ? itemCal : 0),
          carbs: acc.carbs + (Number.isFinite(itemCarbs) ? itemCarbs : 0),
          protein: acc.protein + (Number.isFinite(itemProtein) ? itemProtein : 0),
          fat: acc.fat + (Number.isFinite(itemFat) ? itemFat : 0),
        };
      },
      { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );
  }, [dailyLog.meals]);

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* 최상단 사용자 상태 바 및 로그아웃 버튼 */}
      <div className="bg-white border-b border-slate-100 px-4 py-2">
        <div className="max-w-md mx-auto flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-700">
            {session.userName} 님의 다이어트 기록
          </span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-rose-500 hover:underline transition"
          >
            로그아웃
          </button>
        </div>
      </div>

      <HeaderNav
        currentDate={currentDate}
        onPrevDate={handlePrevDate}
        onNextDate={handleNextDate}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 칼로리 대시보드 카드 */}
        <CalorieDashboardCard
          netCalories={netCalories}
          targetCalories={targetCalories}
          remainingCalories={remainingCalories}
          totalInCalories={totalInCalories}
          burnedStepCalories={burnedStepCalories}
        />

        {/* 탄단지 영양 요약 카드 */}
        <CalorieSummaryCard
          targetCalories={targetCalories}
          totals={nutritionTotals}
        />

        {/* 식단 기록 섹션 */}
        <MealSection
          meals={dailyLog.meals}
          onAddMeal={handleAddMeal}
          onDeleteMeal={handleDeleteMeal}
        />

        {/* 활동 및 걸음 수 섹션 */}
        <WorkoutSection
          steps={dailyLog.steps || 0}
          onStepsChange={handleStepsChange}
          burnedCalories={burnedStepCalories}
        />

        {/* 수분 섭취 카드 */}
        <WaterTrackerCard
          waterIntake={dailyLog.waterIntake || 0}
          targetWater={profile.targetWater || 2000}
          onAddWater={handleAddWater}
        />
      </main>

      {/* 신체 정보 및 설정 모달 */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
};

export default App;
