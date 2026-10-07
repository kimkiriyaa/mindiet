import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { CalorieDashboardCard } from './components/dashboard/CalorieDashboardCard';
import { WaterTrackerCard } from './components/dashboard/WaterTrackerCard';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';
import { Calendar, User, LogOut, CheckCircle2 } from 'lucide-react';

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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const storageKey = session ? `min_diet_log_${session.userId}_${todayStr}` : `min_diet_log_${todayStr}`;
  const waterStorageKey = session ? `min_diet_water_${session.userId}_${todayStr}` : `min_diet_water_${todayStr}`;

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

  const saveToStorageSafely = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('로컬스토리지 저장 용량 부족:', e);
      alert('저장 공간이 부족합니다. 이전 기록이나 사진 데이터를 정리해 주세요.');
    }
  }, []);

  const updateDailyLog = useCallback((updater: (prev: DailyLog) => DailyLog) => {
    setDailyLog((prev) => {
      const next = updater(prev);
      saveToStorageSafely(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey, saveToStorageSafely]);

  const handleAddWater = useCallback((amount: number) => {
    setWaterIntake((prev) => {
      const next = Math.max(0, prev + amount);
      saveToStorageSafely(waterStorageKey, next.toString());
      return next;
    });
  }, [waterStorageKey, saveToStorageSafely]);

  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    saveToStorageSafely('min_diet_session', JSON.stringify(userSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('min_diet_session');
  };

  const handleSaveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    saveToStorageSafely('min_diet_profile', JSON.stringify(newProfile));
  };

  const handleAddMeal = async (newMealData: Omit<MealItem, 'id'>) => {
    const newMeal: MealItem = {
      ...newMealData,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    updateDailyLog((prev) => ({
      ...prev,
      meals: [...prev.meals, newMeal],
    }));

    if (session) {
      try {
        await saveMealToSheet(session.userName, newMeal, dailyLog.date);
      } catch (err) {
        console.warn('구글 시트 저장 실패:', err);
      }
    }
  };

  const handleDeleteMeal = (id: string) => {
    updateDailyLog((prev) => ({
      ...prev,
      meals: prev.meals.filter((m) => m.id !== id),
    }));
  };

  const handleStepsChange = (steps: number) => {
    updateDailyLog((prev) => ({ ...prev, steps }));
  };

  const handleSyncToSheet = async () => {
    if (!session) return;
    try {
      await saveDailyLogToSheet(session.userName, dailyLog);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (err) {
      console.error('구글 시트 동기화 실패:', err);
      alert('구글 시트 저장 중 문제가 발생했습니다.');
    }
  };

  const totalInCalories = useMemo(() => {
    return dailyLog.meals.reduce((sum, item) => sum + item.calories, 0);
  }, [dailyLog.meals]);

  const burnedStepCalories = useMemo(() => {
    const weight = profile?.weight || 65;
    return calculateStepCalories(dailyLog.steps, weight);
  }, [dailyLog.steps, profile]);

  const netCalories = totalInCalories - burnedStepCalories;
  const targetCalories = dailyLog.targetCalories || DEFAULT_TARGET_CALORIES;
  const remainingCalories = targetCalories - netCalories;

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-0 sm:py-6">
      <div className="w-full max-w-md bg-white sm:rounded-3xl shadow-lg border border-slate-200/60 flex flex-col min-h-screen sm:min-h-0 overflow-hidden">
        {/* 상단 헤더 */}
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥗</span>
            <div>
              <h1 className="font-extrabold text-base text-slate-800 leading-tight">민다이어트</h1>
              <p className="text-[11px] text-slate-400 font-medium">{session.userName}님의 다이어트 기록</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
              title="프로필 및 설정"
            >
              <User className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* 오늘 날짜 표시 */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold">{dailyLog.date}</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full">
              오늘
            </span>
          </div>

          {/* 순 칼로리 요약 대시보드 */}
          <CalorieDashboardCard
            netCalories={netCalories}
            targetCalories={targetCalories}
            remainingCalories={remainingCalories}
            totalInCalories={totalInCalories}
            burnedStepCalories={burnedStepCalories}
          />

          {/* 물 섭취량 카드 */}
          <WaterTrackerCard
            waterIntake={waterIntake}
            targetWater={DEFAULT_TARGET_WATER}
            onAddWater={handleAddWater}
          />

          {/* 식단 기록 섹션 */}
          <MealSection
            meals={dailyLog.meals}
            onAddMeal={handleAddMeal}
            onDeleteMeal={handleDeleteMeal}
          />

          {/* 걸음 수 및 활동 섹션 */}
          <WorkoutSection
            steps={dailyLog.steps}
            onStepsChange={handleStepsChange}
            burnedCalories={burnedStepCalories}
          />

          {/* 구글 시트 동기화 백업 버튼 */}
          <div className="pt-2">
            <button
              onClick={handleSyncToSheet}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>구글 시트에 오늘 기록 백업하기</span>
            </button>
          </div>
        </main>

        {/* 저장 토스트 */}
        {saveToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg z-50 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>구글 스프레드시트에 성공적으로 저장되었습니다!</span>
          </div>
        )}

        {/* 프로필 수정 모달 */}
        {isProfileOpen && (
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            profile={
              profile || {
                birthDate: '1995-01-01',
                gender: 'male',
                height: 175,
                weight: 68,
                targetWeight: 65,
                activityLevel: 'moderate',
                targetCalories: DEFAULT_TARGET_CALORIES,
              }
            }
            onSaveProfile={handleSaveProfile}
          />
        )}
      </div>
    </div>
  );
};
