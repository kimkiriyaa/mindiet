import React from 'react';
import { Footprints, Flame } from 'lucide-react';

interface WorkoutSectionProps {
  steps: number;
  onStepsChange: (steps: number) => void;
  burnedCalories: number;
}

export const WorkoutSection: React.FC<WorkoutSectionProps> = ({
  steps,
  onStepsChange,
  burnedCalories,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
            <Footprints className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-800">활동 및 걸음 수 (Out)</h2>
        </div>
        <div className="flex items-center gap-1 text-orange-500 font-bold text-sm">
          <Flame className="w-4 h-4" />
          <span>-{burnedCalories} kcal</span>
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          오늘의 걸음 수
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={steps || ''}
            onChange={(e) => onStepsChange(Number(e.target.value) || 0)}
            placeholder="걸음 수 입력 (예: 6000)"
            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
          <span className="text-xs font-semibold text-slate-500">걸음</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          체중을 반영하여 활동 소모 칼로리가 자동으로 차감 연산됩니다.
        </p>
      </div>
    </div>
  );
};