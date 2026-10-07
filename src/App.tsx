import React, { useState, useEffect, useMemo } from 'react';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Flame,
  Utensils,
  Footprints,
  Droplet,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';

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
    setWaterIntake((prev) => {
      const next = Math.max(0, prev + amount);
      saveToStorageSafely(waterStorageKey, next.toString());
      return next;
    });
  };

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
    updateDailyLog((prev) => ({
      ...prev,
      steps,
    }));
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
          {/* 날짜 선택 카드 */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold">{dailyLog.date}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                오늘
              </span>
            </div>
          </div>

          {/* 칼로리 요약 대시보드 카드 */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-md shadow-emerald-500/20">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-emerald-100 font-medium">순 섭취 칼로리 (In - Out)</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black tracking-tight">{netCalories.toLocaleString()}</span>
                  <span className="text-sm font-semibold text-emerald-100">/ {targetCalories.toLocaleString()} kcal</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full font-bold">
                  {remainingCalories >= 0 ? `${remainingCalories} kcal 남음` : `${Math.abs(remainingCalories)} kcal 초과`}
                </span>
              </div>
            </div>

            {/* 영양/소비 간편 요약 그리드 */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/15">
              <div className="bg-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-emerald-100" />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-100">먹은 칼로리 (In)</div>
                  <div className="text-xs font-bold">+{totalInCalories.toLocaleString()} kcal</div>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Footprints className="w-4 h-4 text-emerald-100" />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-100">걸음 소모 (Out)</div>
                  <div className="text-xs font-bold">-{burnedStepCalories.toLocaleString()} kcal</div>
                </div>
              </div>
            </div>
          </div>

          {/* 물 섭취 기록 섹션 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                  <Droplet className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">물 섭취량</h2>
                </div>
              </div>
              <div className="text-xs font-bold text-sky-600">
                {waterIntake} / {DEFAULT_TARGET_WATER} ml
              </div>
            </div>

            {/* 게이지 바 */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (waterIntake / DEFAULT_TARGET_WATER) * 100)}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddWater(250)}
                className="flex-1 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+250ml (한 컵)</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(500)}
                className="flex-1 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+500ml (텀블러)</span>
              </button>
              {waterIntake > 0 && (
                <button
                  type="button"
                  onClick={() => handleAddWater(-250)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                  title="250ml 빼기"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

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

          {/* 구글 시트 백업 동기화 버튼 */}
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

        {/* 저장 성공 토스트 */}
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
