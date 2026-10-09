import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Scale, Check } from 'lucide-react';
import { LoginView } from './components/auth/LoginView';
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
import { loadDailyLog, saveDailyLog, getRecentWeightLogs, syncToGoogleSheet } from './services/storageService';
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

  // 최근 체중 추이 데이터 상태
  const [recentWeightLogs, setRecentWeightLogs] = useState(() => getRecentWeightLogs(currentDate, 14));

  useEffect(() => {
    const log = loadDailyLog(currentDate);
    const fallbackTarget = safeVal(profile.targetCalories, 2000);
    const fallbackWeight = profile.weight ? safeVal(profile.weight, 70) : undefined;

    if (log) {
      const sanitized: DailyLog = {
        ...log,
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

    setRecentWeightLogs(getRecentWeightLogs(currentDate, 14));
  }, [currentDate, profile.targetCalories, profile.weight]);

  const handleUpdateLog = useCallback(
    (newLog: DailyLog) => {
      const sanitizedLog: DailyLog = {
        ...newLog,
        targetCalories: Math.max(0, safeVal(newLog.targetCalories, 2000)),
        steps: Math.max(0, safeVal(newLog.steps, 0)),
        waterIntake: Math.max(0, safeVal(newLog.waterIntake, 0)),
        weight: newLog.weight !== undefined ? safeVal(newLog.weight, 0) : undefined,
        meals: Array.isArray(newLog.meals) ? newLog.meals : [],
        exerciseCalories: Math.max(0, safeVal(newLog.exerciseCalories, 0)),
        exerciseNotes: newLog.exerciseNotes || '',
      };
      setDailyLog(sanitizedLog);
      saveDailyLog(sanitizedLog);
      syncToGoogleSheet(sanitizedLog);
      setRecentWeightLogs(getRecentWeightLogs(newLog.date, 14));
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
      return;
    }

    const validWeight = Math.round(parsed * 10) / 10;
    const updatedLog: DailyLog = {
      ...dailyLog,
      weight: validWeight,
    };
    handleUpdateLog(updatedLog);

    const updatedProfile: UserProfile = {
      ...profile,
      weight: validWeight,
    };
    setProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    setIsWeightSaved(true);
    setTimeout(() => {
      setIsWeightSaved(false);
    }, 1500);
  };

  const handleAddMeal = (mealData: Omit<MealItem, 'id'>) => {
    const newMeal: MealItem = {
      ...mealData,
      calories: Math.max(0, safeVal(mealData.calories, 0)),
      carbs: mealData.carbs !== undefined ? Math.max(0, safeVal(mealData.carbs, 0)) : undefined,
      protein: mealData.protein !== undefined ? Math.max(0, safeVal(mealData.protein, 0)) : undefined,
      fat: mealData.fat !== undefined ? Math.max(0, safeVal(mealData.fat, 0)) : undefined,
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

  // 걸음 수 명시적 저장 핸들러
  const handleSaveSteps = (stepsVal: number) => {
    const safeSteps = Math.max(0, safeVal(stepsVal, 0));
    handleUpdateLog({
      ...dailyLog,
      steps: safeSteps,
    });
  };

  // 운동 기록 명시적 저장 핸들러
  const handleSaveExercise = (notes: string, caloriesVal: number) => {
    const safeExerciseCal = Math.max(0, safeVal(caloriesVal, 0));
    handleUpdateLog({
      ...dailyLog,
      exerciseNotes: notes,
      exerciseCalories: safeExerciseCal,
    });
  };

  // AI 운동 칼로리 분석 연동
  const handleEstimateExercise = async (text: string) => {
    const currentWeight = safeVal(dailyLog.weight, safeVal(profile.weight, 65));
    return await estimateExerciseCalories(text, currentWeight);
  };

  // 물 추가 및 즉시 저장
  const handleAddWater = (amount: number) => {
    const current = Math.max(0, safeVal(dailyLog.waterIntake, 0));
    const safeAmount = safeVal(amount, 0);
    const updatedLog: DailyLog = {
      ...dailyLog,
      waterIntake: Math.max(0, current + safeAmount),
    };
    handleUpdateLog(updatedLog);
  };

  // 총 섭취 칼로리 계산 (NaN 원천 방어)
  const totalInCalories = useMemo(() => {
    const sum = dailyLog.meals.reduce((acc, item) => acc + safeVal(item?.calories, 0), 0);
    return Math.max(0, Math.round(safeVal(sum, 0)));
  }, [dailyLog.meals]);

  // 걸음 수 소모 칼로리 계산
  const burnedStepCalories = useMemo(() => {
    const safeSteps = Math.max(0, safeVal(dailyLog.steps, 0));
    const currentWeight = safeVal(dailyLog.weight, safeVal(profile.weight, 65));
    const burned = calculateStepCalories(safeSteps, currentWeight);
    return Math.max(0, Math.round(safeVal(burned, 0)));
  }, [dailyLog.steps, dailyLog.weight, profile.weight]);

  // 운동 소모 칼로리
  const exerciseCalories = useMemo(() => {
    return Math.max(0, safeVal(dailyLog.exerciseCalories, 0));
  }, [dailyLog.exerciseCalories]);

  // 총 소모 칼로리 (걸음 수 + 운동)
  const totalOutCalories = useMemo(() => {
    return safeVal(burnedStepCalories + exerciseCalories, 0);
  }, [burnedStepCalories, exerciseCalories]);

  // 순 칼로리 계산: In - Out
  const netCalories = useMemo(() => {
    return safeVal(totalInCalories - totalOutCalories, 0);
  }, [totalInCalories, totalOutCalories]);

  // 목표 칼로리 계산
  const targetCalories = useMemo(() => {
    const target = safeVal(dailyLog.targetCalories, safeVal(profile.targetCalories, 2000));
    return target > 0 ? target : 2000;
  }, [dailyLog.targetCalories, profile.targetCalories]);

  // 잔여 칼로리 계산: 목표 - 순 칼로리
  const remainingCalories = useMemo(() => {
    return safeVal(targetCalories - netCalories, 0);
  }, [targetCalories, netCalories]);

  // 탄단지 영양소 합계
  const nutritionTotals = useMemo(() => {
    return dailyLog.meals.reduce(
      (acc, item) => ({
        calories: acc.calories + safeVal(item.calories, 0),
        carbs: acc.carbs + safeVal(item.carbs, 0),
        protein: acc.protein + safeVal(item.protein, 0),
        fat: acc.fat + safeVal(item.fat, 0),
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
          burnedStepCalories={totalOutCalories}
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

        {/* 활동 및 걸음 수 + 운동 자율 입력 섹션 */}
        <ActivitySection
          steps={dailyLog.steps || 0}
          burnedStepCalories={burnedStepCalories}
          exerciseCalories={exerciseCalories}
          exerciseNotes={dailyLog.exerciseNotes || ''}
          onSaveSteps={handleSaveSteps}
          onSaveExercise={handleSaveExercise}
          onEstimateExercise={handleEstimateExercise}
        />

        {/* 수분 섭취 카드 */}
        <WaterTrackerCard
          waterIntake={dailyLog.waterIntake || 0}
          targetWater={profile.targetWater || 2000}
          onAddWater={handleAddWater}
        />

        {/* 최하단 최근 14일 몸무게 추이 그래프 */}
        <WeightTrendCard
          logs={recentWeightLogs}
          currentWeight={dailyLog.weight ?? profile.weight}
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
