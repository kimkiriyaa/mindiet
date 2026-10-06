import React, { useState, useEffect } from 'react';
import { HeaderNav } from './components/common/HeaderNav';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';

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

  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = session ? `min_diet_log_${session.userId}_${todayStr}` : `min_diet_log_${todayStr}`;

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { date: todayStr, targetCalories: 2000, steps: 0, meals: [] };
  });

  useEffect(() => {
    if (!session) return;
    const currentKey = `min_diet_log_${session.userId}_${todayStr}`;
    const saved = localStorage.getItem(currentKey);
    if (saved) {
      setDailyLog(JSON.parse(saved));
    } else {
      setDailyLog({ date: todayStr, targetCalories: 2000, steps: 0, meals: [] });
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
    updateDailyLog((prev) => ({ ...prev, steps }));
    if (session) {
      saveDailyLogToSheet(session.userId, todayStr, steps, dailyLog.targetCalories);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('min_diet_session');
    setSession(null);
  };

  if (!session) {
    return <LoginView onLogin={setSession} />;
  }

  const inCalories = dailyLog.meals.reduce((sum, m) => sum + m.calories, 0);
  const outCalories = calculateStepCalories(dailyLog.steps, profile?.weight || 65);
  const netCalories = inCalories - outCalories;
  const remainingCalories = dailyLog.targetCalories - netCalories;

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center text-slate-800">
      <div className="w-full max-w-md bg-white min-h-screen shadow-md flex flex-col">
        {/* 상단 네비게이션 헤더 */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between">
          <HeaderNav onOpenProfile={() => setIsProfileOpen(true)} />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg">
              {session.userName}님
            </span>
            <button
              onClick={handleLogout}
              className="text-[11px] text-slate-400 hover:text-rose-500 underline"
            >
              변경
            </button>
          </div>
        </header>

        {/* 대시보드 칼로리 요약 카드 */}
        <main className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="bg-emerald-500 text-white rounded-2xl p-4 shadow-sm">
            <div className="text-xs opacity-80 mb-1">남은 권장 칼로리</div>
            <div className="text-3xl font-extrabold mb-3">
              {remainingCalories} <span className="text-base font-normal">kcal</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-400/50 text-center">
              <div>
                <div className="text-[10px] opacity-75">목표</div>
                <div className="text-xs font-bold">{dailyLog.targetCalories}</div>
              </div>
              <div>
                <div className="text-[10px] opacity-75">섭취(In)</div>
                <div className="text-xs font-bold">+{inCalories}</div>
              </div>
              <div>
                <div className="text-[10px] opacity-75">소모(Out)</div>
                <div className="text-xs font-bold">-{outCalories}</div>
              </div>
            </div>
          </div>

          {/* 걸음 수 입력 & 운동 섹션 */}
          <WorkoutSection
            steps={dailyLog.steps}
            onStepsChange={handleStepsChange}
            burnedCalories={outCalories}
          />

          {/* 식단 추가 및 사진 AI 분석 섹션 */}
          <MealSection
            meals={dailyLog.meals}
            onAddMeal={handleAddMeal}
            onDeleteMeal={handleDeleteMeal}
          />
        </main>

        {/* 프로필 설정 모달 */}
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentProfile={profile}
          onSaveProfile={(newProf, bmr) => {
            setProfile(newProf);
            localStorage.setItem('min_diet_profile', JSON.stringify(newProf));
            updateDailyLog((prev) => ({ ...prev, targetCalories: bmr }));
            if (session) {
              saveDailyLogToSheet(session.userId, todayStr, dailyLog.steps, bmr);
            }
          }}
        />
      </div>
    </div>
  );
};
export default App;