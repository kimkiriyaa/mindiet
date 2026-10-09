import React, { useState, useEffect } from 'react';
import { Footprints, Flame, Dumbbell, Zap, Loader2, Check } from 'lucide-react';
import { safeVal } from '../../utils/nutritionCalc';

interface ActivitySectionProps {
  steps: number;
  burnedStepCalories: number;
  exerciseCalories: number;
  exerciseNotes: string;
  onSaveSteps: (steps: number) => void;
  onSaveExercise: (notes: string, calories: number) => void;
  onEstimateExercise: (text: string) => Promise<{ calories: number; description: string }>;
}

export const ActivitySection: React.FC<ActivitySectionProps> = ({
  steps,
  burnedStepCalories,
  exerciseCalories,
  exerciseNotes,
  onSaveSteps,
  onSaveExercise,
  onEstimateExercise,
}) => {
  const [stepsInput, setStepsInput] = useState<string>(() => (steps ? String(steps) : ''));
  const [isStepsSaved, setIsStepsSaved] = useState(false);

  const [notesInput, setNotesInput] = useState<string>(() => exerciseNotes || '');
  const [caloriesInput, setCaloriesInput] = useState<string>(() => (exerciseCalories ? String(exerciseCalories) : ''));
  const [isEstimating, setIsEstimating] = useState(false);
  const [isExerciseSaved, setIsExerciseSaved] = useState(false);

  useEffect(() => {
    setStepsInput(steps ? String(steps) : '');
  }, [steps]);

  useEffect(() => {
    setNotesInput(exerciseNotes || '');
    setCaloriesInput(exerciseCalories ? String(exerciseCalories) : '');
  }, [exerciseNotes, exerciseCalories]);

  const handleSaveStepsClick = () => {
    const safeNum = Math.max(0, safeVal(stepsInput, 0));
    onSaveSteps(safeNum);
    setIsStepsSaved(true);
    setTimeout(() => {
      setIsStepsSaved(false);
    }, 1200);
  };

  const handleAiEstimate = async () => {
    if (!notesInput.trim()) {
      alert('운동 내용을 먼저 입력해 주세요 (예: 헬스 50분, 빠른 걷기 30분).');
      return;
    }
    setIsEstimating(true);
    try {
      const res = await onEstimateExercise(notesInput.trim());
      const cal = safeVal(res.calories, 0);
      setCaloriesInput(String(cal));
      onSaveExercise(notesInput.trim(), cal);
      alert(`AI 계산 완료: ${res.description} (약 ${cal} kcal 소모)`);
    } catch (err: any) {
      alert(err?.message || '운동 칼로리 계산에 실패했습니다.');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSaveExerciseClick = () => {
    const cal = Math.max(0, safeVal(caloriesInput, 0));
    onSaveExercise(notesInput.trim(), cal);
    setIsExerciseSaved(true);
    setTimeout(() => {
      setIsExerciseSaved(false);
    }, 1200);
  };

  const totalOut = safeVal(burnedStepCalories, 0) + safeVal(exerciseCalories, 0);

  return (
    <div className="space-y-3">
      {/* 1. 걸음 수 카드 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <Footprints className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">활동 및 걸음 수 (Out)</h2>
          </div>
          <div className="flex items-center gap-1 text-orange-500 font-bold text-xs">
            <Flame className="w-3.5 h-3.5" />
            <span>-{totalOut.toLocaleString()} kcal 소모</span>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-600">오늘의 걸음 수</label>
            <span className="text-[11px] font-bold text-orange-600">
              -{safeVal(burnedStepCalories, 0).toLocaleString()} kcal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveStepsClick();
                }
              }}
              placeholder="예: 6000"
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 font-semibold"
            />
            <span className="text-xs font-semibold text-slate-500">걸음</span>
            <button
              type="button"
              onClick={handleSaveStepsClick}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1 active:scale-95 ${
                isStepsSaved
                  ? 'bg-emerald-500 text-white shadow-xs shadow-emerald-200'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              {isStepsSaved ? (
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
      </div>

      {/* 2. 추가 운동 기록 및 AI Kcal 분석 카드 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">추가 운동 기록</h3>
          </div>
          <div className="text-xs font-bold text-orange-600">
            -{safeVal(exerciseCalories, 0).toLocaleString()} kcal
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="운동 내용 (예: 헬스 가슴 50분, 러닝 30분)"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              disabled={isEstimating}
              className="w-full text-xs px-3 py-2.5 pr-24 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={handleAiEstimate}
              disabled={isEstimating || !notesInput.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-0.5"
            >
              {isEstimating ? (
                <>
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>계산 중</span>
                </>
              ) : (
                <>
                  <Zap className="w-2.5 h-2.5" />
                  <span>AI 계산</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 font-medium">소모 칼로리 직접 지정</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={caloriesInput}
                onChange={(e) => setCaloriesInput(e.target.value)}
                placeholder="0"
                className="w-20 px-2.5 py-1.5 text-right text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs text-slate-500 font-semibold">kcal</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveExerciseClick}
            className={`w-full py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 ${
              isExerciseSaved
                ? 'bg-emerald-500 text-white shadow-xs shadow-emerald-200'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xs'
            }`}
          >
            {isExerciseSaved ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>운동 기록 저장됨</span>
              </>
            ) : (
              <span>운동 기록 저장</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
