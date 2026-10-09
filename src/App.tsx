import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Scale, Check } from 'lucide-react';
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

const safeNumber = (val: unknown, fallback: number = 0): number => {
  const n = Number(val);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
};

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
      targetCalories: safeNumber(profile.targetCalories, 2000),
      steps: 0,
      meals: [],
      waterIntake: 0,
      weight: profile.weight ? safeNumber(profile.weight, 70) : undefined,
    };
  });

  // 몸무게 입력란 로컬 상태 및 저장 완료 피드백 상태
  const [weightInput, setWeightInput] = useState<string>(() => {
    return dailyLog.weight ? String(dailyLog.weight) : (profile.weight ? String(profile.weight) : '');
  });
  const [isWeightSaved, setIsWeightSaved] = useState<boolean>(false);

  useEffect(() => {
    const log = loadDailyLog(currentDate);
    const fallbackTarget = safeNumber(profile.targetCalories, 2000);
    const fallbackWeight = profile.weight ? safeNumber(profile.weight, 70) : undefined;

    if (log) {
      const sanitized: DailyLog = {
        ...log,
        targetCalories: safeNumber(log.targetCalories, fallbackTarget),
        steps: Math.max(0, safeNumber(log.steps, 0)),
        waterIntake: Math.max(0, safeNumber(log.waterIntake, 0)),
        weight: log.weight !== undefined ? safeNumber(log.weight, fallbackWeight ?? 70) : fallbackWeight,
        meals: Array.isArray(log.meals) ? log.meals : [],
      };
      setDailyLog(sanitized);
      setWeightInput(sanitized.weight ? String(sanitized.weight) : (fallbackWeight ? String(fallbackWeight) : ''));
    } else {
      const newEmptyLog: DailyLog = {
        date: currentDate,
        targetCalories: fallbackTarget,
        steps: 0,
        meals: [],
        waterIntake: 0,
        weight: fallbackWeight,
      };
      setDailyLog(newEmptyLog);
      setWeightInput(fallbackWeight ? String(fallbackWeight) : '');
    }
  }, [currentDate, profile.targetCalories, profile.weight]);

  const handleUpdateLog = useCallback(
    (newLog: DailyLog) => {
      const sanitizedLog: DailyLog = {
        ...newLog,
        targetCalories: Math.max(0, safeNumber(newLog.targetCalories, 2000)),
        steps: Math.max(0, safeNumber(newLog.steps, 0)),
        waterIntake: Math.max(0, safeNumber(newLog.waterIntake, 0)),
        weight: newLog.weight !== undefined ? safeNumber(newLog.weight, 0) : undefined,
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
      height: Math.max(0, safeNumber(newProfile.height, 170)),
      weight: Math.max(0, safeNumber(newProfile.weight, 65)),
      targetCalories: Math.max(0, safeNumber(newProfile.targetCalories, 2000)),
      targetWater: Math.max(0, safeNumber(newProfile.targetWater, 2000)),
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
      return;
    }

    const validWeight = Math.round(parsed * 10) / 10;
    const updatedLog: DailyLog = {
      ...dailyLog,
      weight: validWeight,
    };
    handleUpdateLog(updatedLog);

    // 사용자 프로필 체중도 함께 동기화
    const updatedProfile: UserProfile = {
      ...profile,
      weight: validWeight,
    };
    setProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    // 저장 완료 피드백 표시 (1.5초)
    setIsWeightSaved(true);
    setTimeout(() => {
      setIsWeightSaved(false);
    }, 1500);
  };

  const handleAddMeal = (mealData: Omit<MealItem, 'id'>) => {
    const newMeal: MealItem = {
      ...mealData,
      calories: Math.max(0, safeNumber(mealData.calories, 0)),
      carbs: mealData.carbs !== undefined ? Math.max(0, safeNumber(mealData.carbs, 0)) : undefined,
      protein: mealData.protein !== undefined ? Math.max(0, safeNumber(mealData.protein, 0)) : undefined,
      fat: mealData.fat !== undefined ? Math.max(0, safeNumber(mealData.fat, 0)) : undefined,
      id: Date.now().toString(),
    };
    const updatedLog: DailyLog = {
      ...dailyLog,
      meals: [...dailyLog.meals, newMeal],
    };
    handleUpdateLog(updatedLog);
  };

  const handleDeleteMeal = (id: string) => {
    const updatedLog: DailyLog = {
      ...dailyLog,
      meals: dailyLog.meals.filter((m) => m.id !== id),
    };
    handleUpdateLog(updatedLog);
  };

  const handleStepsChange = (steps: number) => {
    const safeSteps = Math.max(0, safeNumber(steps, 0));
    const updatedLog: DailyLog = {
      ...dailyLog,
      steps: safeSteps,
    };
    handleUpdateLog(updatedLog);
  };

  const handleAddWater = (amount: number) => {
    const current = Math.max(0, safeNumber(dailyLog.waterIntake, 0));
    const safeAmount = safeNumber(amount, 0);
    const updatedLog: DailyLog = {
      ...dailyLog,
      waterIntake: Math.max(0, current + safeAmount),
    };
    handleUpdateLog(updatedLog);
  };

  // 총 섭취 칼로리 계산 (NaN 방어)
  const totalInCalories = useMemo(() => {
    const sum = dailyLog.meals.reduce((acc, item) => acc + safeNumber(item?.calories, 0), 0);
    return Math.max(0, Math.round(safeNumber(sum, 0)));
  }, [dailyLog.meals]);

  // 걸음 수 소모 칼로리 계산 (오늘 체중 반영 및 NaN 방어)
  const burnedStepCalories = useMemo(() => {
    const safeSteps = Math.max(0, safeNumber(dailyLog.steps, 0));
    const currentWeight = safeNumber(dailyLog.weight, safeNumber(profile.weight, 65));
    const burned = calculateStepCalories(safeSteps, currentWeight);
    return Math.max(0, Math.round(safeNumber(burned, 0)));
  }, [dailyLog.steps, dailyLog.weight, profile.weight]);

  // 순 칼로리 계산
  const netCalories = useMemo(() => {
    return safeNumber(totalInCalories - burnedStepCalories, 0);
  }, [totalInCalories, burnedStepCalories]);

  // 목표 칼로리 계산
  const targetCalories = useMemo(() => {
    const target = safeNumber(dailyLog.targetCalories, safeNumber(profile.targetCalories, 2000));
    return target > 0 ? target : 2000;
  }, [dailyLog.targetCalories, profile.targetCalories]);

  // 잔여 칼로리 계산
  const remainingCalories = useMemo(() => {
    return safeNumber(targetCalories - netCalories, 0);
  }, [targetCalories, netCalories]);

  // 탄단지 영양소 합계
  const nutritionTotals = useMemo(() => {
    return dailyLog.meals.reduce(
      (acc, item) => ({
        calories: acc.calories + safeNumber(item.calories, 0),
        carbs: acc.carbs + safeNumber(item.carbs, 0),
        protein: acc.protein + safeNumber(item.protein, 0),
        fat: acc.fat + safeNumber(item.fat, 0),
      }),
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

        {/* 오늘 체중(kg) 직관적 입력 및 저장 카드 */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">오늘의 몸무게</div>
              <div className="text-[10px] text-slate-400">소모 칼로리에 실시간 반영</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.1"
              min="30"
              max="250"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveWeight();
                }
              }}
              placeholder={(profile.weight || 65).toString()}
              className="w-16 px-2 py-1.5 text-right font-bold text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-indigo-600 placeholder:text-slate-300"
            />
            <span className="text-xs font-semibold text-slate-500 mr-1">kg</span>
            <button
              type="button"
              onClick={handleSaveWeight}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs active:scale-95 ${
                isWeightSaved
                  ? 'bg-emerald-500 text-white shadow-emerald-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
              }`}
            >
              {isWeightSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>저장됨</span>
                </>
              ) : (
                <span>저장</span>
              )}
            </button>
          </div>
        </div>

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
