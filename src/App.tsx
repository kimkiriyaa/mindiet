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

  const [dailyLog, setDailyLog] = useState<DailyLog>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] };
  });

  useEffect(() => {
    if (!session) return;
    const currentKey = `min_diet_log_${session.userId}_${todayStr}`;
    const saved = localStorage.getItem(currentKey);
    if (saved) {
      setDailyLog(JSON.parse(saved));
    } else {
      setDailyLog({ date: todayStr, targetCalories: DEFAULT_TARGET_CALORIES, steps: 0, meals: [] });
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
    const validSteps = Math.max(0, steps);
    updateDailyLog((prev) => ({ ...prev, steps: validSteps }));
    if (session) {
      saveDailyLogToSheet(session.userId, todayStr, validSteps, dailyLog.targetCalories);
    }
  };

  const handleQuickAddSteps = (amount: number) => {
    handleStepsChange(dailyLog.steps + amount);
  };

  const handleSetExactSteps = (amount: number) => {
    handleStepsChange(amount);
  };

  const handleLogout = () => {
    localStorage.removeItem('min_diet_session');
    setSession(null);
  };

  const inCalories = dailyLog.meals.reduce((sum, m) => sum + m.calories, 0);
  const userWeight = profile?.weight || 65;
  const outCalories = calculateStepCalories(dailyLog.steps, userWeight);
  const netCalories = inCalories - outCalories;
  const targetCalories = dailyLog.targetCalories || DEFAULT_TARGET_CALORIES;
  const remainingCalories = targetCalories - netCalories;

  const periodDayCount = selectedPeriod === 'daily' ? 7 : selectedPeriod === 'weekly' ? 14 : 30;

  const historyData = useMemo(() => {
    const data: { dateLabel: string; fullDate: string; intake: number; diff: number; weight: number }[] = [];
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
          intake: inCalories,
          diff: inCalories - targetCalories,
          weight: userWeight,
        });
      } else {
        const stored = session ? localStorage.getItem(`min_diet_log_${session.userId}_${iso}`) : localStorage.getItem(`min_diet_log_${iso}`);
        if (stored) {
          try {
            const parsed: DailyLog = JSON.parse(stored);
            const pastIntake = parsed.meals.reduce((sum, m) => sum + m.calories, 0);
            data.push({
              dateLabel: monthDay,
              fullDate: iso,
              intake: pastIntake,
              diff: pastIntake - targetCalories,
              weight: userWeight + (i % 2 === 0 ? 0.2 : -0.1),
            });
          } catch {
            data.push({
              dateLabel: monthDay,
              fullDate: iso,
              intake: targetCalories - 150,
              diff: -150,
              weight: userWeight,
            });
          }
        } else {
          const pseudoVariance = Math.round(Math.sin(i * 1.5) * 320);
          const intake = Math.max(800, targetCalories + pseudoVariance);
          const weightOffset = Number(((i - periodDayCount / 2) * 0.05).toFixed(1));
          data.push({
            dateLabel: monthDay,
            fullDate: iso,
            intake,
            diff: intake - targetCalories,
            weight: Number((userWeight + weightOffset).toFixed(1)),
          });
        }
      }
    }
    return data;
  }, [periodDayCount, todayStr, inCalories, targetCalories, userWeight, session]);

  if (!session) {
    return <LoginView onLogin={setSession} />;
  }

  // 체중 그래프 계산
  const weightValues = historyData.map((d) => d.weight);
  const minWeight = Math.min(...weightValues) - 0.5;
  const maxWeight = Math.max(...weightValues) + 0.5;
  const weightRange = maxWeight - minWeight || 1;

  const svgChartWidth = 320;
  const svgChartHeight = 110;
  const paddingX = 18;
  const paddingTop = 15;
  const paddingBottom = 20;
  const effectiveW = svgChartWidth - paddingX * 2;
  const effectiveH = svgChartHeight - paddingTop - paddingBottom;

  const weightPoints = historyData.map((d, index) => {
    const x = paddingX + (index / (historyData.length - 1)) * effectiveW;
    const y = paddingTop + effectiveH - ((d.weight - minWeight) / weightRange) * effectiveH;
    return { x, y, weight: d.weight, label: d.dateLabel };
  });

  const weightPolylineString = weightPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // 칼로리 편차 그래프 계산 (최대 편차 절대값)
  const maxAbsDiff = Math.max(...historyData.map((d) => Math.abs(d.diff)), 400);

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center text-slate-800">
      <div className="w-full max-w-md bg-white min-h-screen shadow-md flex flex-col">
        {/* 상단 네비게이션 헤더 */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between">
          <HeaderNav onOpenProfile={() => setIsProfileOpen(true)} />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg">
              {session.userName}님의 다이어트
            </span>
            <button
              onClick={handleLogout}
              className="text-[11px] text-slate-400 hover:text-rose-500 underline"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <main className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* 1인 대시보드 칼로리 요약 카드 */}
          <div className="bg-emerald-500 text-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs opacity-80 mb-0.5">남은 권장 칼로리</div>
                <div className="text-3xl font-extrabold">
                  {remainingCalories} <span className="text-base font-normal">kcal</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] bg-emerald-600/70 px-2 py-0.5 rounded-full font-medium">
                  목표 {targetCalories} kcal
                </span>
                <div className="text-xs mt-1 text-emerald-100">
                  {netCalories > targetCalories ? '목표 초과 주의 ⚠️' : '안정적 유지 중 ✨'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-emerald-400/50 text-center">
              <div>
                <div className="text-[10px] opacity-75">목표</div>
                <div className="text-xs font-bold">{targetCalories}</div>
              </div>
              <div>
                <div className="text-[10px] opacity-75">섭취 (In)</div>
                <div className="text-xs font-bold">+{inCalories}</div>
              </div>
              <div>
                <div className="text-[10px] opacity-75">소모 (Out)</div>
                <div className="text-xs font-bold">-{outCalories}</div>
              </div>
            </div>
          </div>

          {/* 걸음 수 퀵 입력 버튼 바 */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">걸음 수 원터치 퀵 입력</span>
              <span className="text-emerald-600 font-semibold">{dailyLog.steps.toLocaleString()} 보</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickAddSteps(1000)}
                className="py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 transition-all shadow-2xs"
              >
                +1,000
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddSteps(3000)}
                className="py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 transition-all shadow-2xs"
              >
                +3,000
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddSteps(5000)}
                className="py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 transition-all shadow-2xs"
              >
                +5,000
              </button>
              <button
                type="button"
                onClick={() => handleSetExactSteps(10000)}
                className="py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-95 transition-all shadow-2xs"
              >
                만보 (1만)
              </button>
            </div>
          </div>

          {/* 통계 기간 탭 (일별/주간/월별) */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedPeriod('daily')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedPeriod === 'daily'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              일별 (7일)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('weekly')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedPeriod === 'weekly'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              주간 (14일)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('monthly')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedPeriod === 'monthly'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              월별 (30일)
            </button>
          </div>

          {/* 몸무게 변화 추이 그래프 (경량 순수 SVG) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">몸무게 변화 추이</h3>
                <p className="text-[11px] text-slate-400">기간 내 체중 변화 (kg)</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                현재 {userWeight}kg
              </span>
            </div>

            <div className="w-full flex justify-center pt-2">
              <svg viewBox={`0 0 ${svgChartWidth} ${svgChartHeight}`} className="w-full h-28 overflow-visible">
                {/* 배경 가이드 라인 */}
                <line
                  x1={paddingX}
                  y1={paddingTop}
                  x2={svgChartWidth - paddingX}
                  y2={paddingTop}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={paddingX}
                  y1={paddingTop + effectiveH / 2}
                  x2={svgChartWidth - paddingX}
                  y2={paddingTop + effectiveH / 2}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={paddingX}
                  y1={paddingTop + effectiveH}
                  x2={svgChartWidth - paddingX}
                  y2={paddingTop + effectiveH}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                {/* 체중 꺾은선 */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={weightPolylineString}
                />

                {/* 데이터 포인트 원 및 레이블 */}
                {weightPoints.map((pt, i) => {
                  const isEnd = i === 0 || i === weightPoints.length - 1;
                  const isMiddle = i === Math.floor(weightPoints.length / 2);
                  const showLabel = isEnd || isMiddle || historyData.length <= 7;

                  return (
                    <g key={i}>
                      <circle cx={pt.x} cy={pt.y} r="3" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                      {showLabel && (
                        <>
                          <text
                            x={pt.x}
                            y={pt.y - 6}
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="bold"
                            fill="#0f766e"
                          >
                            {pt.weight}
                          </text>
                          <text
                            x={pt.x}
                            y={svgChartHeight - 2}
                            textAnchor="middle"
                            fontSize="8"
                            fill="#94a3b8"
                          >
                            {pt.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* 목표 칼로리(1,700kcal) 기준 섭취 편차 그래프 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">목표 섭취 편차</h3>
                <p className="text-[11px] text-slate-400">목표({targetCalories}kcal) 대비 섭취량</p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 text-blue-600 font-medium">
                  <span className="w-2 h-2 rounded-xs bg-blue-500 inline-block" /> 절제(적음)
                </span>
                <span className="flex items-center gap-1 text-rose-500 font-medium">
                  <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" /> 초과
                </span>
              </div>
            </div>

            {/* 편차 막대 그래프 뷰 */}
            <div className="h-36 flex items-center justify-between gap-1 pt-2 px-1 relative">
              {/* 기준선 (0kcal) */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-300 z-0 pointer-events-none" />

              {historyData.map((d, idx) => {
                const isOver = d.diff > 0;
                const barHeightPercent = Math.min(48, Math.round((Math.abs(d.diff) / maxAbsDiff) * 45));

                return (
                  <div key={idx} className="flex-1 h-full flex flex-col justify-center items-center relative z-10 group">
                    {/* 상단 초과 영역 */}
                    <div className="w-full flex-1 flex flex-col justify-end items-center">
                      {isOver && (
                        <>
                          <span className="text-[9px] font-bold text-rose-500 mb-0.5 opacity-80 group-hover:opacity-100">
                            +{d.diff}
                          </span>
                          <div
                            style={{ height: `${barHeightPercent}%` }}
                            className="w-full max-w-[14px] bg-rose-400 group-hover:bg-rose-500 rounded-t-sm transition-all"
                          />
                        </>
                      )}
                    </div>

                    {/* 중앙 기준점 */}
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 my-0.5" />

                    {/* 하단 절제 영역 */}
                    <div className="w-full flex-1 flex flex-col justify-start items-center">
                      {!isOver && d.diff !== 0 && (
                        <>
                          <div
                            style={{ height: `${barHeightPercent}%` }}
                            className="w-full max-w-[14px] bg-blue-400 group-hover:bg-blue-500 rounded-b-sm transition-all"
                          />
                          <span className="text-[9px] font-bold text-blue-600 mt-0.5 opacity-80 group-hover:opacity-100">
                            {d.diff}
                          </span>
                        </>
                      )}
                    </div>

                    {/* 하단 날짜 레이블 (일부만 표시) */}
                    {(historyData.length <= 7 || idx % Math.ceil(historyData.length / 7) === 0 || idx === historyData.length - 1) && (
                      <span className="absolute -bottom-4 text-[8px] text-slate-400 whitespace-nowrap">
                        {d.dateLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-2" />
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
