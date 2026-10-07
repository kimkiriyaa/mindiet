import React from 'react';
import { Utensils, Footprints } from 'lucide-react';

interface CalorieDashboardCardProps {
  netCalories: number;
  targetCalories: number;
  remainingCalories: number;
  totalInCalories: number;
  burnedStepCalories: number;
}

export const CalorieDashboardCard: React.FC<CalorieDashboardCardProps> = ({
  netCalories,
  targetCalories,
  remainingCalories,
  totalInCalories,
  burnedStepCalories,
}) => {
  return (
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
  );
};
