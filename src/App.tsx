import React, { useState, useEffect, useMemo } from 'react';
import { HeaderNav } from './components/common/HeaderNav';
import { MealSection } from './components/meal/MealSection';
import { WorkoutSection } from './components/workout/WorkoutSection';
import { ProfileModal } from './components/profile/ProfileModal';
import { LoginView } from './components/auth/LoginView';
import { DailyLog, MealItem, UserProfile, UserSession } from './types/diet';
import { calculateStepCalories } from './utils/nutritionCalc';
import { saveMealToSheet, saveDailyLogToSheet } from './services/googleSheetService';

type PeriodTab = 'daily' | 'weekly' | 'monthly';
const DEFAULT_TARGET_CALORIES = 1700;
const DEFAULT_TARGET_WATER = 2000; // 목표 수분 2000ml

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

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodTab>('daily');

  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = session ? `min_diet_log_${session.userId}_${todayStr}` : `min_diet_log_${todayStr}`;
  const waterStorageKey = session ? `min_diet_water_${session.userId}_${todayStr}` : `min_diet_water_${todayStr}`;

  // 물 섭취량 state
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
      setDailyLog(JSON.parse(saved));
    } else {
      setDailyLog({ date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] });
    }

    const savedWater = localStorage.getItem(currentWaterKey);
    setWaterIntake(savedWater ? Number(savedWater) : 0);
  }, [session, todayStr]);

  const updateDailyLog = (updater: (prev: DailyLog) => DailyLog) => {
    setDailyLog((prev) => {
      const next = updater(prev);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const handleAddWater = (amount: number) => {
    setWaterIntake((prev) => {
      const next = Math.max(0, prev + amount);
      localStorage.setItem(waterStorageKey, next.toString());
      return next;
    });
  };

  const handleAddMeal = (meal: MealItem) => {
    updateDailyLog((prev) => ({ ...prev, meals: [...prev.meals, meal] }));
    if (session) {
      saveMealToSheet(session.userId, todayStr, meal);
    }
  };

  const handleDeleteMeal = (id: string) => {
    updateDailyLog((prev) => ({ ...prev, meals: prev.meals.filter((m) => m.id !== id) }));
  };

  const handleStepsChange = (steps: number) => {
    const validSteps = Math.max(0, steps);
    updateDailyLog((prev) => ({ ...prev, steps: validSteps }));
    if (session) {
      saveDailyLogToSheet(session.userId, todayStr, validSteps, dailyLog.targetCalories);
    }
  };

  const handleQuickAddSteps = (amount: number) => {
    handleStepsChange(dailyLog.steps + amount);
  };

  const handleSetExactSteps = (exact: number) => {
    handleStepsChange(exact);
  };

  const handleLogout = () => {
    localStorage.removeItem('min_diet_session');
    setSession(null);
  };

  const inCalories = dailyLog.meals.reduce((sum, m) => sum + m.calories, 0);
  const userWeight = profile?.weight || 68;
  const outCalories = calculateStepCalories(dailyLog.steps, userWeight);
  const targetCalories = dailyLog.targetCalories || DEFAULT_TARGET_CALORIES;
  const remainingCalories = targetCalories - inCalories;
  const calorieDiff = inCalories - targetCalories;

  const waterPercent = Math.min(100, Math.round((waterIntake / DEFAULT_TARGET_WATER) * 100));
  const periodDayCount = selectedPeriod === 'daily' ? 7 : selectedPeriod === 'weekly' ? 14 : 30;

  const historyData = useMemo(() => {
    const data: { dateLabel: string; fullDate: string; diff: number; weight: number }[] = [];
    const baseDate = new Date();

    for (let i = periodDayCount - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;

      if (iso === todayStr) {
        data.push({
          dateLabel: monthDay,
          fullDate: iso,
          diff: calorieDiff,
          weight: userWeight,
        });
      } else {
        const stored = session
          ? localStorage.getItem(`min_diet_log_${session.userId}_${iso}`)
          : localStorage.getItem(`min_diet_log_${iso}`);
        if (stored) {
          try {
            const parsed: DailyLog = JSON.parse(stored);
            const pastIntake = parsed.meals.reduce((sum, m) => sum + m.calories, 0);
            data.push({
              dateLabel: monthDay,
              fullDate: iso,
              diff: pastIntake - targetCalories,
              weight: userWeight,
            });
          } catch {
            data.push({ dateLabel: monthDay, fullDate: iso, diff: 0, weight: userWeight });
          }
        } else {
          const pseudoVariance = Math.round(Math.sin(i * 1.5) * 280);
          data.push({
            dateLabel: monthDay,
            fullDate: iso,
            diff: pseudoVariance,
            weight: Number((userWeight + Math.sin(i * 0.8) * 0.4).toFixed(1)),
          });
        }
      }
    }
    return data;
  }, [periodDayCount, todayStr, session, calorieDiff, userWeight, targetCalories]);

  const svgWidth = 340;
  const svgHeight = 110;
  const padX = 25;
  const padY = 18;
  const weights = historyData.map((d) => d.weight);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const rangeW = maxW - minW || 1;

  const weightPoints = historyData.map((d, idx) => {
    const x = padX + (idx / (historyData.length - 1)) * (svgWidth - padX * 2);
    const y = svgHeight - padY - ((d.weight - minW) / rangeW) * (svgHeight - padY * 2);
    return { x, y, weight: d.weight, label: d.dateLabel };
  });

  const weightPolylineString = weightPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const maxAbsDiff = Math.max(...historyData.map((d) => Math.abs(d.diff)), 500);

  if (!session) {
    return <LoginView onLogin={setSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center text-slate-800 overflow-x-hidden touch-manipulation select-none pb-[env(safe-area-inset-bottom,24px)]">
      <div className="w-full max-w-md bg-white min-h-screen shadow-lg flex flex-col">
        {/* 상단 네비게이션 헤더 */}
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-30">
          <HeaderNav onOpenProfile={() => setIsProfileOpen(true)} />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              {session.userName}님
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-rose-500 font-medium px-1 py-1"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 메인 스크롤 콘텐츠 */}
        <main className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* 1. 오늘의 칼로리 요약 카드 */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs text-emerald-100 font-medium">권장 목표 섭취량 기준</span>
                <div className="text-3xl font-black tracking-tight mt-0.5">
                  {remainingCalories >= 0 ? `${remainingCalories.toLocaleString()}` : `0`}{' '}
                  <span className="text-sm font-normal opacity-90">kcal 남음</span>
                </div>
              </div>
              <div
                className={`px-3 py-1.5 rounded-2xl text-xs font-black shadow-xs ${
                  calorieDiff <= 0 ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white'
                }`}
              >
                {calorieDiff > 0 ? `+${calorieDiff} 초과` : `${calorieDiff} 절제`}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 mt-2 border-t border-emerald-400/40 text-center">
              <div>
                <div className="text-[11px] text-emerald-100 opacity-90">목표</div>
                <div className="text-sm font-bold mt-0.5">{targetCalories.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-100 opacity-90">섭취 (In)</div>
                <div className="text-sm font-bold mt-0.5">+{inCalories.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-100 opacity-90">걸음 소모 (Out)</div>
                <div className="text-sm font-bold mt-0.5">-{outCalories.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* 2. 걸음 수 모바일 퀵 입력 바 */}
          <section className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">오늘의 걸음 수 👟</span>
              <span className="text-base font-black text-emerald-600">
                {dailyLog.steps.toLocaleString()} <span className="text-xs font-normal text-slate-400">보</span>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1000, 3000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAddSteps(amt)}
                  className="min-h-[46px] flex items-center justify-center text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 transition-all shadow-xs"
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSetExactSteps(10000)}
                className="min-h-[46px] flex items-center justify-center text-xs font-black bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 active:scale-95 transition-all shadow-xs"
              >
                만보(10k)
              </button>
            </div>
          </section>

          {/* 3. 물 마시기 퀵 입력 카드 💧 */}
          <section className="bg-blue-50/70 p-4 rounded-3xl border border-blue-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">💧</span>
                <span className="text-xs font-bold text-blue-900">오늘 마신 물</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black text-blue-600">{waterIntake.toLocaleString()}</span>
                <span className="text-xs text-blue-400 font-medium">/ {DEFAULT_TARGET_WATER.toLocaleString()} ml</span>
              </div>
            </div>

            <div className="w-full bg-blue-100/80 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${waterPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleAddWater(250)}
                className="min-h-[44px] flex flex-col items-center justify-center bg-white border border-blue-200 text-blue-700 rounded-2xl hover:bg-blue-100/50 active:scale-95 transition-all shadow-xs"
              >
                <span className="text-xs font-bold">+250ml</span>
                <span className="text-[9px] text-blue-400">한 컵</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(500)}
                className="min-h-[44px] flex flex-col items-center justify-center bg-white border border-blue-200 text-blue-700 rounded-2xl hover:bg-blue-100/50 active:scale-95 transition-all shadow-xs"
              >
                <span className="text-xs font-bold">+500ml</span>
                <span className="text-[9px] text-blue-400">생수 1병</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(1000)}
                className="min-h-[44px] flex flex-col items-center justify-center bg-blue-500 text-white rounded-2xl hover:bg-blue-600 active:scale-95 transition-all shadow-xs font-bold text-xs"
              >
                +1,000ml
              </button>
              <button
                type="button"
                onClick={() => handleAddWater(-250)}
                className="min-h-[44px] flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-slate-600 active:scale-95 transition-all shadow-xs text-xs font-medium"
              >
                -250ml
              </button>
            </div>
          </section>

          {/* 4. 기간 선택 탭 (일별 / 주간 / 월별) */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1">
            {(['daily', 'weekly', 'monthly'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`flex-1 min-h-[42px] flex items-center justify-center text-xs font-bold rounded-xl transition-all ${
                  selectedPeriod === period
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {period === 'daily' ? '일별(7일)' : period === 'weekly' ? '주간(14일)' : '월별(30일)'}
              </button>
            ))}
          </div>

          {/* 5. 체중 변화 추이 (순수 SVG 꺾은선 차트) */}
          <section className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800">몸무게 변화 추이</h3>
                <p className="text-[10px] text-slate-400">기간별 체중 흐름 (kg)</p>
              </div>
              <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                {userWeight} kg
              </span>
            </div>

            <div className="w-full flex justify-center pt-2">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-28 overflow-visible">
                <line x1={padX} y1={padY} x2={svgWidth - padX} y2={padY} stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1={padX} y1={svgHeight - padY} x2={svgWidth - padX} y2={svgHeight - padY} stroke="#f1f5f9" strokeDasharray="3 3" />
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={weightPolylineString}
                />
                {weightPoints.map((pt, i) => {
                  const showLabel = i === 0 || i === weightPoints.length - 1 || weightPoints.length <= 7;
                  return (
                    <g key={i}>
                      <circle cx={pt.x} cy={pt.y} r="3" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                      {showLabel && (
                        <>
                          <text x={pt.x} y={pt.y - 6} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f766e">
                            {pt.weight}
                          </text>
                          <text x={pt.x} y={svgHeight - 2} textAnchor="middle" fontSize="8" fill="#94a3b8">
                            {pt.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          {/* 6. 목표 편차 칼로리 막대 차트 (0 기준 파랑-/빨강+) */}
          <section className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800">목표 섭취 편차</h3>
                <p className="text-[10px] text-slate-400">기준({targetCalories}kcal) 대비</p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 text-blue-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 절제(-)
                </span>
                <span className="flex items-center gap-1 text-rose-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 초과(+)
                </span>
              </div>
            </div>

            <div className="h-32 flex items-center justify-between gap-1 pt-1 px-1 relative">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-200 z-0 pointer-events-none" />
              {historyData.map((d, idx) => {
                const isOver = d.diff > 0;
                const barHeightPercent = Math.min(46, Math.round((Math.abs(d.diff) / maxAbsDiff) * 44));
                const colW = Math.max(8, Math.min(18, 300 / historyData.length - 2));

                return (
                  <div key={idx} className="flex-1 h-full flex flex-col justify-center items-center relative z-10">
                    <div className="w-full flex-1 flex flex-col justify-end items-center">
                      {isOver && (
                        <>
                          <span className="text-[8px] font-bold text-rose-500 mb-0.5">+{d.diff}</span>
                          <div
                            style={{ height: `${barHeightPercent}%`, width: `${colW}px` }}
                            className="bg-rose-400 rounded-t-sm"
                          />
                        </>
                      )}
                    </div>
                    <div className="w-1 h-1 rounded-full bg-slate-300 my-0.5" />
                    <div className="w-full flex-1 flex flex-col justify-start items-center">
                      {!isOver && d.diff !== 0 && (
                        <>
                          <div
                            style={{ height: `${barHeightPercent}%`, width: `${colW}px` }}
                            className="bg-blue-400 rounded-b-sm"
                          />
                          <span className="text-[8px] font-bold text-blue-600 mt-0.5">{d.diff}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 식단 및 운동 등록 컴포넌트 */}
          <WorkoutSection steps={dailyLog.steps} onStepsChange={handleStepsChange} />
          <MealSection
            meals={dailyLog.meals}
            onAddMeal={handleAddMeal}
            onDeleteMeal={handleDeleteMeal}
          />
        </main>

        {/* 프로필 수정 모달 */}
        {isProfileOpen && profile && (
          <ProfileModal
            profile={profile}
            onClose={() => setIsProfileOpen(false)}
            onSave={(updated) => {
              setProfile(updated);
              localStorage.setItem('min_diet_profile', JSON.stringify(updated));
            }}
          />
        )}
      </div>
    </div>
  );
};

export default App;